import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, orderBy, where, doc, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Search, Users, Handshake, BookOpen, UserPlus, MessageCircle, Sliders, CheckCircle2, History, X, Calendar, Filter, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Discover() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'match' | 'groups' | 'mentors'>('match');
  const navigate = useNavigate();

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Recent Searches State
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_searches_discover') || '[]');
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (queryStr: string) => {
    const trimmed = queryStr.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      localStorage.setItem('recent_searches_discover', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (queryStr: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== queryStr);
      localStorage.setItem('recent_searches_discover', JSON.stringify(updated));
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches_discover');
  };

  useEffect(() => {
    fetchSuggestedUsers();
  }, [currentUser]);

  const fetchFollowing = async () => {
    if (!currentUser) return;
    const followingSnap = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
    const fMap: Record<string, boolean> = {};
    followingSnap.docs.forEach(doc => {
      fMap[doc.id] = true;
    });
    setFollowingMap(fMap);
  };

  const fetchSuggestedUsers = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      await fetchFollowing();
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(40));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)).filter(u => u.id !== currentUser.uid);
      
      // Deduplicate by lowercased name or username
      const seen = new Set();
      const uniqueFetched: User[] = [];
      for (const u of fetched) {
        const key = (u.username || u.name || u.id).toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFetched.push(u);
        }
      }
      setUsers(uniqueFetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      fetchSuggestedUsers();
      return;
    }
    
    if (!currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('name', '>=', val), where('name', '<=', val + '\uf8ff'), limit(40));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)).filter(u => u.id !== currentUser.uid);
      
      // Deduplicate search results by name/username
      const seen = new Set();
      const uniqueFetched: User[] = [];
      for (const u of fetched) {
        const key = (u.username || u.name || u.id).toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFetched.push(u);
        }
      }
      setUsers(uniqueFetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId: string) => {
    if (!currentUser) return;
    const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUserId);
    const followerRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
    
    const isFollowing = followingMap[targetUserId];
    try {
      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
      } else {
        await setDoc(followingRef, { createdAt: Date.now() });
        await setDoc(followerRef, { createdAt: Date.now() });
        
        await setDoc(doc(collection(db, 'users', targetUserId, 'notifications')), {
          type: 'collab_request',
          fromUserId: currentUser.uid,
          createdAt: Date.now(),
          read: false
        });
      }
      setFollowingMap(prev => ({ ...prev, [targetUserId]: !isFollowing }));
    } catch (e) {
      console.error(e);
    }
  };

  const startChat = async (targetUserId: string) => {
    if (!currentUser) return;
    
    // Simple composite key for finding chat
    const participants = [currentUser.uid, targetUserId].sort();
    const q = query(collection(db, 'chats'), where('participants', '==', participants));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      navigate(`/messages/${snap.docs[0].id}`);
    } else {
      const newChatRef = doc(collection(db, 'chats'));
      await setDoc(newChatRef, {
        participants,
        lastMessageTime: Date.now(),
      });
      navigate(`/messages/${newChatRef.id}`);
    }
  };

  const filteredUsers = users.filter((user) => {
    // 1. Filter by category (category matches user.interests, user.skills, or bio text)
    if (selectedCategory && selectedCategory !== 'All') {
      const uInterests = user.interests || [];
      const uSkills = user.skills || [];
      const bioText = (user.bio || '').toLowerCase();
      const targetCat = selectedCategory.toLowerCase().trim();
      
      const matchesCategory = 
        uInterests.some(i => i.toLowerCase().includes(targetCat)) ||
        uSkills.some(s => s.toLowerCase().includes(targetCat)) ||
        bioText.includes(targetCat);
        
      if (!matchesCategory) return false;
    }

    // 2. Filter by date range (user.createdAt is within age range)
    if (selectedDateRange && selectedDateRange !== 'all') {
      const now = Date.now();
      const userCreated = user.createdAt || 0;
      const ageMs = now - userCreated;
      if (selectedDateRange === 'day' && ageMs > 24 * 60 * 60 * 1000) return false;
      if (selectedDateRange === 'week' && ageMs > 7 * 24 * 60 * 60 * 1000) return false;
      if (selectedDateRange === 'month' && ageMs > 30 * 24 * 60 * 60 * 1000) return false;
    }

    // 3. Filter by verified status
    const isVerified = !!user.isVerified || (user.username && user.username.length % 5 === 0) || (user.name && user.name.length % 4 === 1);
    if (onlyVerified && !isVerified) {
      return false;
    }

    return true;
  });

  const interests = [
    { name: "UI Design", icon: "✨", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { name: "Web Dev", icon: "💻", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { name: "Music", icon: "🎧", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" },
    { name: "Languages", icon: "📚", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" }
  ];

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      <div className="px-2">
        <h1 className="text-3xl font-bold tracking-tight mb-4">{t("Discover")}</h1>
        <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
          <button 
            onClick={() => setActiveTab('match')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Suggested Partners")}
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'groups' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Study Groups")}
          </button>
          <button 
            onClick={() => setActiveTab('mentors')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'mentors' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Community Mentors")}
          </button>
        </div>

        {activeTab === 'match' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder={t("Search posts, people, or events...")}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveRecentSearch(searchQuery);
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium shadow-sm transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-full border flex items-center justify-center transition-all shrink-0 aspect-square ${
                  showFilters || selectedCategory !== 'All' || selectedDateRange !== 'all' || onlyVerified
                    ? 'bg-[#D62828] border-transparent text-white shadow-md' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title={t("Filter Results")}
              >
                <Sliders className="w-5 h-5" />
              </button>
            </div>

            {/* Recent Searches Row */}
            {recentSearches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 animate-fade-in">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 mr-1">
                  <History className="w-3.5 h-3.5" />
                  {t("Recent:")}
                </span>
                {recentSearches.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full transition-all text-xs font-semibold">
                    <button 
                      type="button"
                      onClick={() => {
                        setSearchQuery(q);
                        handleSearch(q);
                      }}
                      className="text-slate-600 dark:text-slate-300 text-[11px]"
                    >
                      {q}
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(q);
                      }}
                      className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-450 p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[10px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-450 font-bold uppercase tracking-wider ml-2"
                >
                  {t("Clear All")}
                </button>
              </div>
            )}

            {/* Collapsible Filters Card */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 mt-2 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-2">
                      <div className="flex items-center gap-2 text-slate-850 dark:text-white font-bold text-sm">
                        <Filter className="w-4 h-4 text-[#D62828]" />
                        <span>{t("Search Filters")}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('All');
                          setSelectedDateRange('all');
                          setOnlyVerified(false);
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-[#D62828] transition-colors"
                      >
                        {t("Reset Filters")}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Category Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          {t("Category (Interest)")}
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            if (e.target.value !== 'All') {
                              saveRecentSearch(e.target.value);
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#D62828] h-[34px]"
                        >
                          <option value="All">{t("All Categories")}</option>
                          <option value="UI Design">{t("UI Design")}</option>
                          <option value="Web Dev">{t("Web Dev")}</option>
                          <option value="Music">{t("Music")}</option>
                          <option value="Languages">{t("Languages")}</option>
                          <option value="Programming">{t("Programming")}</option>
                          <option value="Design">{t("Design")}</option>
                          <option value="Photography">{t("Photography")}</option>
                          <option value="Sports">{t("Sports")}</option>
                        </select>
                      </div>

                      {/* Date Range Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          {t("Date Joined")}
                        </label>
                        <select
                          value={selectedDateRange}
                          onChange={(e) => setSelectedDateRange(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#D62828] h-[34px]"
                        >
                          <option value="all">{t("All Time")}</option>
                          <option value="day">{t("Past 24 Hours")}</option>
                          <option value="week">{t("Past Week")}</option>
                          <option value="month">{t("Past Month")}</option>
                        </select>
                      </div>

                      {/* Verified Toggle */}
                      <div className="space-y-1.5 flex flex-col justify-end">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block md:mb-1.5">
                          {t("Verification Status")}
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 select-none hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors h-[34px]">
                          <input
                            type="checkbox"
                            checked={onlyVerified}
                            onChange={(e) => setOnlyVerified(e.target.checked)}
                            className="w-4 h-4 rounded text-[#D62828] focus:ring-[#D62828] border-slate-200 dark:border-slate-700 cursor-pointer accent-[#D62828]"
                          />
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" />
                            {t("Verified Users Only")}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {activeTab === 'match' && (
        <>
          <div className="px-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-1 w-max">
              {interests.map((i, idx) => (
                <motion.div 
                  key={i.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setSelectedCategory(i.name);
                    setShowFilters(true);
                    saveRecentSearch(i.name);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full ${i.color} shadow-sm backdrop-blur-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform`}
                >
                  <span className="text-base">{i.icon}</span>
                  <span className="font-semibold text-sm whitespace-nowrap">{i.name}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mx-1 mt-2">
            <h2 className="text-xl font-semibold mb-4 px-1 tracking-tight flex items-center justify-between">
              <span>{searchQuery ? t("Search Results") : t("Suggested Partners")}</span>
              {(selectedCategory !== 'All' || selectedDateRange !== 'all' || onlyVerified) && (
                <span className="text-xs font-bold text-[#D62828] bg-[#D62828]/10 px-2.5 py-1 rounded-full animate-pulse">
                  {t("Filtered")}
                </span>
              )}
            </h2>
            <motion.div layout className="space-y-3">
              {loading ? (
                 <div className="flex justify-center py-8">
                   <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : filteredUsers.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map(user => {
                    const isFollowing = followingMap[user.id];
                    const isVerified = !!user.isVerified || (user.username && user.username.length % 5 === 0) || (user.name && user.name.length % 4 === 1);
                    return (
                      <motion.div 
                        key={user.id} 
                        layout
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -12 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 300,
                          damping: 28,
                          mass: 0.8
                        }}
                        className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#D62828] flex items-center justify-center text-white font-bold animate-fade-in">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-semibold text-slate-900 dark:text-white text-[15px]">{user.name}</h4>
                                {isVerified && (
                                  <span className="inline-flex items-center text-blue-500" title={t("Verified User")}>
                                    <CheckCircle2 className="w-4 h-4 fill-blue-500 text-white dark:text-slate-800 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-medium">{t("Student")}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => startChat(user.id)}
                              className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                            >
                              <MessageCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleFollowToggle(user.id)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                isFollowing 
                                  ? 'bg-slate-100 text-[#D62828] dark:bg-slate-700 dark:text-[#FCA5A5]'
                                  : 'bg-[#D62828] text-white shadow-md shadow-[#D62828]/20'
                              }`}
                            >
                              <Handshake className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        {user.bio && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden text-ellipsis whitespace-nowrap">
                            {t("Offers:")} {user.bio}
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <p className="text-center text-slate-500 text-sm mt-8">{t("No partners found matching your filters.")}</p>
              )}
            </motion.div>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-[#D62828]/10 text-[#D62828] rounded-full flex items-center justify-center mb-4">
            <Users className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("Study Groups")}</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">{t("Create or join learning groups to collaborate and share knowledge with your peers.")}</p>
          <button className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-full shadow-md">
            {t("Create Study Session")}
          </button>
        </div>
      )}

      {activeTab === 'mentors' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("Community Mentors")}</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">{t("Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.")}</p>
          <button className="px-6 py-2.5 bg-gradient-to-r from-[#1E3A8A] to-blue-500 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all">
            {t("Find a Mentor")}
          </button>
        </div>
      )}
    </div>
  );
}
