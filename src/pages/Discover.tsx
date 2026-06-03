import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, orderBy, where, doc, setDoc, deleteDoc, getDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Event } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Search, Users, Handshake, BookOpen, UserPlus, MessageCircle, Sliders, CheckCircle2, History, X, Calendar, Filter, Star, Plus, Shield, Sparkles, Clock, Compass, Trash2, MapPin, Video, CheckSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { GroupDetailsModal } from '../components/GroupDetailsModal';

const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04
    }
  }
};

const listItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -12,
    transition: { duration: 0.2 }
  }
};

const SuggestedPartnerSkeleton = () => (
  <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm gap-3 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          <div className="h-3 w-16 bg-slate-150 dark:bg-slate-700/50 rounded-full"></div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
      </div>
    </div>
    <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/40 dark:border-slate-700"></div>
  </div>
);

const StudyGroupSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700/10 shadow-sm overflow-hidden flex flex-col justify-between animate-pulse">
    <div className="h-24 bg-slate-200 dark:bg-slate-700 flex flex-col justify-end p-5">
      <div className="h-4 w-3/4 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
    </div>
    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
      <div className="space-y-2 w-full">
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-3 w-5/6 bg-slate-150 dark:bg-slate-700/50 rounded-full"></div>
      </div>
      <div className="flex items-center justify-between w-full pt-2 border-t border-slate-50 dark:border-slate-700/20">
        <div className="h-6 w-24 bg-slate-250 dark:bg-slate-700 rounded-lg"></div>
        <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
    </div>
  </div>
);

const EventCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-850 rounded-[2rem] border border-slate-100/80 dark:border-slate-800/80 p-5 shadow-sm flex flex-col md:flex-row gap-4 animate-pulse">
    <div className="flex items-center gap-4 w-full">
      <div className="w-14 h-14 shrink-0 rounded-[1.25rem] bg-slate-200 dark:bg-slate-750 flex flex-col items-center justify-center"></div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="h-5 w-3/4 bg-slate-250 dark:bg-slate-700 rounded-full"></div>
        <div className="h-3.5 w-full bg-slate-150 dark:bg-slate-750/70 rounded-full"></div>
      </div>
    </div>
  </div>
);

export default function Discover() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'match' | 'groups' | 'events'>('match');
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Community Events State
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Community Mentors Features State
  const [mentors, setMentors] = useState<User[]>([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [mentorSearchQuery, setMentorSearchQuery] = useState('');
  const [selectedMentorSubject, setSelectedMentorSubject] = useState('All');

  // Mentor join modal details state Setup
  const [isMentorSetupOpen, setIsMentorSetupOpen] = useState(false);
  const [mentorSetupBio, setMentorSetupBio] = useState('');
  const [mentorSetupSubjects, setMentorSetupSubjects] = useState<string[]>(['Computer Science & Coding']);
  const [mentorSetupAvailability, setMentorSetupAvailability] = useState('Flexible / Weekends');

  // Interactive request modal forms details state Setup
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedMentorForRequest, setSelectedMentorForRequest] = useState<User | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Incoming and outgoing request arrays
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);

  // Groups/Schools feature state
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [groupsSearchQuery, setGroupsSearchQuery] = useState('');
  const [myMemberships, setMyMemberships] = useState<Record<string, boolean>>({});
  const [schoolToView, setSchoolToView] = useState<any | null>(null);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);

  const fetchSchools = async () => {
    setSchoolsLoading(true);
    try {
      const q = query(collection(db, 'schools'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: any[] = [];
      const sids: string[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
        sids.push(doc.id);
      });
      setSchools(list);
      
      if (currentUser && sids.length > 0) {
        const joins: Record<string, boolean> = {};
        await Promise.all(sids.map(async (sid) => {
          const snapCheck = await getDoc(doc(db, 'schools', sid, 'members', currentUser.uid));
          if (snapCheck.exists()) {
            joins[sid] = true;
          }
        }));
        setMyMemberships(joins);
      }
    } catch (e) {
      console.error('Failed to fetch school groups:', e);
    } finally {
      setSchoolsLoading(false);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: Event[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Event);
      });
      setEvents(list);
    } catch (e) {
      console.error('Failed to fetch academic events:', e);
    } finally {
      setEventsLoading(false);
    }
  };

  const toggleEventRSVP = async (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    
    const attendeesList = event.attendees || [];
    const isRsvpd = attendeesList.includes(currentUser.uid);
    const eventRef = doc(db, 'events', event.id);
    const docPath = `events/${event.id}`;

    try {
      if (isRsvpd) {
        await updateDoc(eventRef, {
          attendees: arrayRemove(currentUser.uid)
        });
      } else {
        await updateDoc(eventRef, {
          attendees: arrayUnion(currentUser.uid)
        });
      }
      
      setEvents(prev => prev.map(ev => {
        if (ev.id === event.id) {
          const list = ev.attendees || [];
          return {
            ...ev,
            attendees: isRsvpd 
              ? list.filter(id => id !== currentUser.uid)
              : [...list, currentUser.uid]
          };
        }
        return ev;
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  useEffect(() => {
    if (activeTab === 'groups') {
      fetchSchools();
    } else if (activeTab === 'events') {
      fetchEvents();
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('group') || params.get('groupId');
    if (groupId) {
      const loadSharedGroup = async () => {
        try {
          const groupSnap = await getDoc(doc(db, 'schools', groupId));
          if (groupSnap.exists()) {
            const groupData = { id: groupSnap.id, ...groupSnap.data() };
            setSchoolToView(groupData);
            setIsGroupDetailsOpen(true);
            setActiveTab('groups');
          }
        } catch (e) {
          console.error("Failed to load active shared group from URL", e);
        }
      };
      loadSharedGroup();
    }
  }, [currentUser]);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

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

  // 1. Real-time list of public Mentors
  useEffect(() => {
    if (!currentUser || activeTab !== 'mentors') return;
    setMentorsLoading(true);
    const q = query(
      collection(db, 'users'),
      where('isMentor', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: User[] = [];
      snap.forEach(docObj => {
        if (currentUser && docObj.id !== currentUser.uid) {
          list.push({ id: docObj.id, ...docObj.data() } as User);
        }
      });
      setMentors(list);
      setMentorsLoading(false);
    }, (err) => {
      console.error("Error loading mentors list:", err);
      setMentorsLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab, currentUser]);

  // 2. Real-time incoming requests for Mentors
  useEffect(() => {
    if (!currentUser || activeTab !== 'mentors') return;
    const q = query(
      collection(db, 'mentor_requests'),
      where('mentorId', '==', currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(docObj => {
        list.push({ id: docObj.id, ...docObj.data() });
      });
      setReceivedRequests(list.sort((a,b) => b.createdAt - a.createdAt));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'mentor_requests');
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // 3. Real-time sent requests for Students
  useEffect(() => {
    if (!currentUser || activeTab !== 'mentors') return;
    const q = query(
      collection(db, 'mentor_requests'),
      where('studentId', '==', currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(docObj => {
        list.push({ id: docObj.id, ...docObj.data() });
      });
      setSentRequests(list.sort((a,b) => b.createdAt - a.createdAt));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'mentor_requests');
    });
    return () => unsubscribe();
  }, [currentUser, activeTab]);

  // Update or build mentor profile
  const handleSaveMentorProfile = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        isMentor: true,
        mentorBio: mentorSetupBio || userProfile?.bio || '',
        mentorSubjects: mentorSetupSubjects,
        mentorAvailability: mentorSetupAvailability,
        updatedAt: Date.now()
      }, { merge: true });
      await refreshProfile();
      setIsMentorSetupOpen(false);
    } catch (e) {
      console.error("Failed to enable mentor mode:", e);
    }
  };

  const handleLeaveMentorMode = async () => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        isMentor: false,
        updatedAt: Date.now()
      }, { merge: true });
      await refreshProfile();
      setIsMentorSetupOpen(false);
    } catch (e) {
      console.error("Failed to turn off mentor mode:", e);
    }
  };

  // Submit request form
  const handleSendMentorshipRequest = async () => {
    if (!currentUser || !selectedMentorForRequest) return;
    setIsSendingRequest(true);
    try {
      const reqId = doc(collection(db, 'mentor_requests')).id;
      // Save deep details inside DB collection
      await setDoc(doc(db, 'mentor_requests', reqId), {
        id: reqId,
        mentorId: selectedMentorForRequest.id,
        mentorName: selectedMentorForRequest.name,
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Anonymous Learner',
        studentPhotoURL: userProfile?.photoURL || '',
        note: requestNotes,
        status: 'pending',
        createdAt: Date.now()
      });

      // Send standard notification to tutor
      await setDoc(doc(collection(db, 'users', selectedMentorForRequest.id, 'notifications')), {
        type: 'collab_request',
        fromUserId: currentUser.uid,
        createdAt: Date.now(),
        read: false
      });

      setIsRequestModalOpen(false);
      setRequestNotes('');
      // Beautiful transient visual notification
    } catch (e) {
      console.error("Error sending mentor request:", e);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (request: any) => {
    try {
      await setDoc(doc(db, 'mentor_requests', request.id), {
        status: 'accepted'
      }, { merge: true });

      // Automatically construct or retrieve chat channel
      const participants = [currentUser!.uid, request.studentId].sort();
      const q = query(collection(db, 'chats'), where('participants', '==', participants));
      const snap = await getDocs(q);
      
      let chatId = '';
      if (!snap.empty) {
        chatId = snap.docs[0].id;
      } else {
        const newChatRef = doc(collection(db, 'chats'));
        await setDoc(newChatRef, {
          participants,
          lastMessageTime: Date.now(),
        });
        chatId = newChatRef.id;
      }

      // Append template starting message into chat
      const msgId = doc(collection(db, 'chats', chatId, 'messages')).id;
      await setDoc(doc(db, 'chats', chatId, 'messages', msgId), {
        id: msgId,
        senderId: currentUser!.uid,
        content: `👋 Hello! I have accepted your mentorship guidance request regarding: "${request.note}". Let's learn together!`,
        createdAt: Date.now()
      });

      // Update parent chat metadata
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: "Mentorship request accepted!",
        lastMessageTime: Date.now()
      }, { merge: true });

      // Send notification back to general dashboard of student
      await setDoc(doc(collection(db, 'users', request.studentId, 'notifications')), {
        type: 'follow',
        fromUserId: currentUser!.uid,
        createdAt: Date.now(),
        read: false
      });
    } catch (e) {
      console.error("Accept operation failed:", e);
    }
  };

  const handleDeclineRequest = async (request: any) => {
    try {
      await setDoc(doc(db, 'mentor_requests', request.id), {
        status: 'declined'
      }, { merge: true });
    } catch (e) {
      console.error("Decline operation failed:", e);
    }
  };

  useEffect(() => {
    fetchSuggestedUsers();
    fetchSchools();
    fetchEvents();
    
    const handleRefresh = () => {
      fetchSuggestedUsers();
      fetchSchools();
      fetchEvents();
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
    };
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
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(120));
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

  const handleSearch = (val: string) => {
    setSearchQuery(val);
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
    // 0. Filter by global search query (keyword, interest, skills, etc.)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        user.name.toLowerCase().includes(q) ||
        (user.username || '').toLowerCase().includes(q) ||
        (user.bio || '').toLowerCase().includes(q) ||
        (user.interests || []).some(item => item.toLowerCase().includes(q)) ||
        (user.skills || []).some(item => item.toLowerCase().includes(q));
      
      if (!matchesSearch) return false;
    }

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

  const filteredSchools = schools.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.clubs || []).some((club: string) => club.toLowerCase().includes(q));

    const matchesGroupQuery = !groupsSearchQuery.trim() ||
      s.name.toLowerCase().includes(groupsSearchQuery.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(groupsSearchQuery.toLowerCase());

    return matchesSearch && matchesGroupQuery;
  });

  const filteredEvents = events.filter((evt) => {
    const q = searchQuery.toLowerCase().trim();
    return !q ||
      evt.title.toLowerCase().includes(q) ||
      (evt.description || '').toLowerCase().includes(q) ||
      (evt.category || '').toLowerCase().includes(q) ||
      (evt.type || '').toLowerCase().includes(q);
  });

  const interests = [
    { name: "Languages", icon: "📚", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" },
    { name: "Programming", icon: "💻", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
    { name: "Design", icon: "🎨", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" }
  ];

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      <div className="px-2">
        <h1 className="text-3xl font-bold tracking-tight mb-4">{t("Discover")}</h1>

        {/* Global Search Bar (Peers, Groups, Events by interest or keyword) */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder={t("Search peers, groups, and academic events...")}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveRecentSearch(searchQuery);
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium shadow-sm transition-all"
              />

              {/* Dropdown Search History Component */}
              <AnimatePresence>
                {isSearchFocused && recentSearches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 5, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-1.5"
                  >
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 pb-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        {t("Search History")}
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevents blur
                          clearRecentSearches();
                        }}
                        className="text-[10px] text-[#D62828] hover:text-[#B22222] font-bold uppercase tracking-wider flex items-center gap-1.5 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("Clear All")}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {recentSearches.map((q, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchQuery(q);
                            handleSearch(q);
                            setIsSearchFocused(false);
                          }}
                        >
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D62828] transition-colors" />
                            <span>{q}</span>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeRecentSearch(q);
                            }}
                            className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

        {/* Unified Discover Hub Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-full animate-fade-in">
          <button 
            type="button"
            onClick={() => setActiveTab('match')}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'match' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Suggested Partners")} {filteredUsers.length > 0 && `(${filteredUsers.length})`}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'groups' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Study Groups")} {filteredSchools.length > 0 && `(${filteredSchools.length})`}
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'events' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
          >
            {t("Academic Events")} {filteredEvents.length > 0 && `(${filteredEvents.length})`}
          </button>
        </div>
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
            <motion.div 
              layout 
              variants={listContainerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {loading ? (
                <div className="space-y-4">
                  <SuggestedPartnerSkeleton />
                  <SuggestedPartnerSkeleton />
                  <SuggestedPartnerSkeleton />
                </div>
              ) : filteredUsers.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map(user => {
                    const isFollowing = followingMap[user.id];
                    const isVerified = !!user.isVerified || (user.username && user.username.length % 5 === 0) || (user.name && user.name.length % 4 === 1);
                    const isExpanded = hoveredUserId === user.id;

                    // Compute dynamic interests and skills summary with high-quality default fallbacks if missing
                    const userInterests = user.interests && user.interests.length > 0
                      ? user.interests
                      : ["Peer Collaboration", "Study Groups", "Skill Sharing"];
                    
                    const userSkills = (user as any).skills && (user as any).skills.length > 0
                      ? (user as any).skills
                      : ["Conceptual Explanations", "Exam Preparation", "Resource Sharing"];

                    return (
                      <motion.div 
                        key={user.id} 
                        layout
                        variants={listItemVariants}
                        whileHover={{ scale: 1.015, y: -2 }}
                        onMouseEnter={() => setHoveredUserId(user.id)}
                        onMouseLeave={() => setHoveredUserId(null)}
                        onClick={() => setHoveredUserId(isExpanded ? null : user.id)}
                        className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm gap-3 cursor-pointer select-none overflow-hidden"
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
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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

                        {/* Expandable summary of interests & skills */}
                        <motion.div
                          initial={false}
                          animate={{ 
                            height: isExpanded ? "auto" : 0,
                            opacity: isExpanded ? 1 : 0,
                            marginTop: isExpanded ? 4 : 0
                          }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 border-t border-dashed border-slate-150 dark:border-slate-700/60 flex flex-col gap-3 scale-in-from-bottom">
                            {/* Target Header */}
                            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#1E3A8A] dark:text-blue-400">
                              <span>📚</span>
                              <span>{t("Interests & Expertise Summary")}</span>
                            </div>

                            {/* Interests Badges */}
                            <div className="flex flex-col gap-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Interests")}:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {userInterests.map((interest, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50/70 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 border border-blue-100/40 dark:border-blue-950/35 flex items-center gap-1"
                                  >
                                    <span className="text-[10px]">✨</span>
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Skills Badges */}
                            <div className="flex flex-col gap-1.5">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Skills")}:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {userSkills.map((skill, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50/70 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-950/35 flex items-center gap-1"
                                  >
                                    <span className="text-[10px]">🛠️</span>
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
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
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Action Header */}
          <div className="space-y-4 px-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder={t("Search school groups...")}
                  value={groupsSearchQuery}
                  onChange={(e) => setGroupsSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium shadow-sm transition-all"
                />
              </div>
              <button
                onClick={() => setIsCreateGroupOpen(true)}
                className="px-5 rounded-[1.5rem] bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white flex items-center justify-center gap-1.5 shadow-md shadow-[#D62828]/15 hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{t("Create Group")}</span>
              </button>
            </div>
          </div>

          {/* Group Cards Grid */}
          {schoolsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 px-2">
              <StudyGroupSkeleton />
              <StudyGroupSkeleton />
              <StudyGroupSkeleton />
              <StudyGroupSkeleton />
            </div>
          ) : (
            (() => {
              const currentFilteredSchools = schools.filter(s => {
                const queryStr = (searchQuery || groupsSearchQuery || '').toLowerCase().trim();
                if (!queryStr) return true;
                return s.name.toLowerCase().includes(queryStr) ||
                       (s.description || '').toLowerCase().includes(queryStr);
              });

              if (currentFilteredSchools.length > 0) {
                return (
                  <motion.div 
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 px-2"
                  >
                    {currentFilteredSchools.map((s) => {
                      const isMember = !!myMemberships[s.id];
                      return (
                        <motion.div
                          key={s.id}
                          layout
                          variants={listItemVariants}
                          onClick={() => {
                            setSchoolToView(s);
                            setIsGroupDetailsOpen(true);
                          }}
                          className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-705/10 shadow-sm overflow-hidden flex flex-col justify-between group cursor-pointer hover:shadow-md hover:border-slate-200/80 transition-all duration-300"
                        >
                          <div className="h-24 relative p-5 flex flex-col justify-end text-white text-left shrink-0 overflow-hidden">
                            {s.photoURL ? (
                              <>
                                <img
                                  src={s.photoURL}
                                  alt={s.name}
                                  referrerPolicy="no-referrer"
                                  className="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/10 z-[1]" />
                              </>
                            ) : (
                              <div className={`absolute inset-0 bg-gradient-to-tr ${s.themeGradient} z-0`} />
                            )}
                            <span className="absolute top-4 right-4 text-[9px] font-extrabold bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full uppercase tracking-wider z-10">
                              {isMember ? t("Joined") : t("Join")}
                            </span>
                            <h3 className="font-extrabold text-[15px] leading-tight tracking-tight drop-shadow-sm line-clamp-1 relative z-10">{s.name}</h3>
                          </div>
                          <div className="p-5 flex-1 flex flex-col justify-between items-start text-left gap-4">
                            {s.description ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed h-8">
                                {s.description}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 font-medium italic h-8 flex items-center">
                                {t("No description specified")}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between w-full pt-1 border-t border-slate-50/50 dark:border-slate-700/20">
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
                                <Users className="w-3.5 h-3.5 text-[#D62828]" />
                                {s.studentCount || 1} {t("Members")}
                              </span>
                              <span className="text-[10px] font-extrabold text-[#D62828] dark:text-[#FCA5A5] group-hover:translate-x-1 transition-transform flex items-center gap-0.5 uppercase tracking-wide">
                                {t("View")} →
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                );
              }

              return (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-20 h-20 bg-[#D62828]/10 text-[#D62828] rounded-full flex items-center justify-center mb-4">
                    <Users className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("Study Groups")}</h3>
                  <p className="text-sm text-slate-500 max-w-xs mb-6">{t("Create or join learning groups to collaborate and share knowledge with your peers.")}</p>
                  <button onClick={() => setIsCreateGroupOpen(true)} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-full shadow-md">
                    {t("Create Group")}
                  </button>
                </div>
              );
            })()
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="flex flex-col gap-4 animate-fade-in px-2">
          {eventsLoading ? (
            <div className="space-y-4 animate-pulse">
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          ) : filteredEvents.length > 0 ? (
            <motion.div 
              variants={listContainerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {filteredEvents.map((event) => {
                const attendeesList = event.attendees || [];
                const isRsvpd = attendeesList.includes(currentUser?.uid || '');
                
                return (
                  <motion.div
                    key={event.id}
                    variants={listItemVariants}
                    whileHover={{ scale: 1.01, y: -1 }}
                    className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 shrink-0 rounded-[1.25rem] bg-[#D62828]/10 text-[#D62828] flex flex-col items-center justify-center font-extrabold shadow-inner">
                        <Calendar className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/20 text-[#D62828] px-2.5 py-1 rounded-full border border-rose-100/30 dark:border-rose-950/40">
                            {event.category || t("Academic")}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {event.time || "TBA"}
                          </span>
                        </div>
                        <h3 className="font-bold text-[16px] text-slate-850 dark:text-white leading-snug tracking-tight">{event.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xl">{event.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          {event.type === 'online' ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450 font-bold">
                              <Video className="w-3.5 h-3.5 shrink-0" />
                              {t("Online / Zoom Meeting")}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-semibold">
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              {event.location || t("Campus Location")}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-400 font-semibold">
                            <Users className="w-3.5 h-3.5" />
                            {attendeesList.length} {t("Going")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full md:w-auto flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-50 dark:border-slate-700/20 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => toggleEventRSVP(event, e)}
                        className={`w-full md:w-auto px-5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          isRsvpd
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100/35 dark:border-emerald-950/45'
                            : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-transparent shadow shadow-slate-900/10 hover:opacity-90'
                        }`}
                      >
                        {isRsvpd ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            {t("Joined")}
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            {t("RSVP")}
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
              <div className="w-20 h-20 bg-[#D62828]/10 text-[#D62828] rounded-full flex items-center justify-center mb-4 text-2xl">
                🗓️
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t("Academic Events")}</h3>
              <p className="text-sm text-slate-500 max-w-xs mb-6">{t("No academic events or workshops matching your selection right now.")}</p>
            </div>
          )}
        </div>
      )}

      {/* Render overlay details modals for Groups */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={(newSchoolId) => {
          fetchSchools();
        }}
      />

      <GroupDetailsModal
        isOpen={isGroupDetailsOpen}
        onClose={() => setIsGroupDetailsOpen(false)}
        group={schoolToView}
        isInitialJoined={schoolToView ? !!myMemberships[schoolToView.id] : false}
        onJoinToggle={(schoolId, joined) => {
          setMyMemberships(prev => ({ ...prev, [schoolId]: joined }));
          // Optimistically update listed student counts in memory
          setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, studentCount: s.studentCount + (joined ? 1 : -1) } : s));
        }}
        onDeleteSuccess={(deletedId) => {
          setSchools(prev => prev.filter(s => s.id !== deletedId));
          setIsGroupDetailsOpen(false);
        }}
      />


    </div>
  );
}
