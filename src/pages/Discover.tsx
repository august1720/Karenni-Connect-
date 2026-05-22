import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, orderBy, where, doc, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Users, Handshake, BookOpen, UserPlus, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Discover() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'match' | 'groups' | 'mentors'>('match');
  const navigate = useNavigate();

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
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(15));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)).filter(u => u.id !== currentUser.uid);
      setUsers(fetched);
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
      const q = query(collection(db, 'users'), where('name', '>=', val), where('name', '<=', val + '\uf8ff'), limit(15));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)).filter(u => u.id !== currentUser.uid);
      setUsers(fetched);
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

  const interests = [
    { name: "UI Design", icon: "✨", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { name: "Web Dev", icon: "💻", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { name: "Music", icon: "🎧", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" },
    { name: "Languages", icon: "📚", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" }
  ];

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      <div className="px-2">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Exchange</h1>
        <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
          <button 
            onClick={() => setActiveTab('match')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            Find Partners
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'groups' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            Study Groups
          </button>
          <button 
            onClick={() => setActiveTab('mentors')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'mentors' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            Mentors
          </button>
        </div>

        {activeTab === 'match' && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search skills or interests..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium shadow-sm transition-all"
            />
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full ${i.color} shadow-sm backdrop-blur-sm cursor-pointer`}
                >
                  <span className="text-base">{i.icon}</span>
                  <span className="font-semibold text-sm whitespace-nowrap">{i.name}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mx-1 mt-2">
            <h2 className="text-xl font-semibold mb-4 px-1 tracking-tight">
              {searchQuery ? "Search Results" : "Suggested Partners"}
            </h2>
            <div className="space-y-3">
              {loading ? (
                 <div className="flex justify-center py-8">
                   <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : users.length > 0 ? users.map(user => {
                const isFollowing = followingMap[user.id];
                return (
                  <div key={user.id} className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#D62828] flex items-center justify-center text-white font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white text-[15px]">{user.name}</h4>
                          <p className="text-xs text-slate-500 font-medium">Student</p>
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
                        Offers: {user.bio}
                      </p>
                    )}
                  </div>
                );
              }) : (
                <p className="text-center text-slate-500 text-sm mt-8">No partners found.</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-[#D62828]/10 text-[#D62828] rounded-full flex items-center justify-center mb-4">
            <Users className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Study Groups</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">Create or join learning groups to collaborate and share knowledge with your peers.</p>
          <button className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-full shadow-md">
            Create Study Session
          </button>
        </div>
      )}

      {activeTab === 'mentors' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Community Mentors</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.</p>
          <button className="px-6 py-2.5 bg-gradient-to-r from-[#1E3A8A] to-blue-500 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all">
            Find a Mentor
          </button>
        </div>
      )}
    </div>
  );
}
