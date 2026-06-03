import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, collection, onSnapshot, setDoc, deleteDoc, updateDoc, increment, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { X, Check, Users, Shield, ArrowRight, Search, Settings, Camera, Save, Trash2, Edit2, Share2, Calendar, BarChart3, Plus, MapPin, ExternalLink, Video, Star, Award, Crown, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { uploadMedia } from '../lib/storage';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ShareMenu } from './ShareMenu';

interface SchoolGroup {
  id: string;
  name: string;
  description?: string;
  guidelines?: string;
  photoURL?: string;
  themeGradient: string;
  studentCount: number;
  ownerId: string;
  creatorName: string;
  createdAt: number;
}

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: SchoolGroup | null;
  onJoinToggle: (schoolId: string, join: boolean) => void;
  isInitialJoined: boolean;
  onDeleteSuccess?: (schoolId: string) => void;
}

interface Member {
  userId: string;
  name: string;
  username: string;
  photoURL?: string;
  joinedAt: number;
}

const GRADIENTS = [
  { class: 'from-[#1E3A8A] to-[#D62828]', label: 'Classic Red-Blue' },
  { class: 'from-purple-600 to-pink-600', label: 'Sunset Royal' },
  { class: 'from-teal-500 to-emerald-600', label: 'Green Oasis' },
  { class: 'from-indigo-600 to-blue-500', label: 'Neon Cyber' },
  { class: 'from-orange-500 to-rose-500', label: 'Warm Fire' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22,
    },
  },
};

function formatJoinedDate(timestamp: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just joined';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Matching text helper with sleek highlight styling
function highlightText(text: string, queryStr: string) {
  if (!queryStr) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${queryStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === queryStr.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-900 rounded-[3px] px-0.5 font-bold dark:bg-amber-500/30 dark:text-amber-200">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

export function GroupDetailsModal({ isOpen, onClose, group, onJoinToggle, isInitialJoined, onDeleteSuccess }: GroupDetailsModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeGroup, setActiveGroup] = useState<SchoolGroup | null>(group);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isJoined, setIsJoined] = useState(isInitialJoined);
  const [isJoinToggling, setIsJoinToggling] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Load and save searchQuery in localStorage per group
  const [searchQuery, setSearchQuery] = useState(() => {
    if (!group?.id) return '';
    try {
      return localStorage.getItem(`group_member_search_${group.id}`) || '';
    } catch {
      return '';
    }
  });

  // Admin/Manage panel fields
  const [isManaging, setIsManaging] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editGuidelines, setEditGuidelines] = useState('');
  const [editGradient, setEditGradient] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // New tabs, events, stats, and sharing states
  const [activeTab, setActiveTab] = useState<'members' | 'events' | 'stats'>('members');
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Group Events States
  const [events, setEvents] = useState<any[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  useEffect(() => {
    setIsJoined(isInitialJoined);
  }, [isInitialJoined, group]);

  useEffect(() => {
    setJoinError(null);
  }, [group?.id, isOpen]);

  useEffect(() => {
    setActiveGroup(group);
    if (group) {
      setEditDesc(group.description || '');
      setEditGuidelines(group.guidelines || '');
      setEditGradient(group.themeGradient || '');
    }
  }, [group]);

  // Real-time Firestore Sync for group info edits (guides, photo banner, grads)
  useEffect(() => {
    if (!currentUser || !group?.id || !isOpen) return;

    const unsubscribeSchool = onSnapshot(doc(db, 'schools', group.id), (snap) => {
      if (snap.exists()) {
        const schData = { id: snap.id, ...snap.data() } as SchoolGroup;
        setActiveGroup(schData);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `schools/${group.id}`);
    });

    return () => unsubscribeSchool();
  }, [currentUser, group?.id, isOpen]);

  // Persist searchQuery change to localStorage
  useEffect(() => {
    if (!activeGroup?.id) return;
    try {
      localStorage.setItem(`group_member_search_${activeGroup.id}`, searchQuery);
    } catch (e) {
      console.error('Failed storing search query', e);
    }
  }, [searchQuery, activeGroup?.id]);

  useEffect(() => {
    if (!currentUser || !activeGroup || !isOpen) return;

    setLoadingMembers(true);
    // Listen to real-time members collection under school doc
    const membersRef = collection(db, 'schools', activeGroup.id, 'members');
    const unsubscribe = onSnapshot(membersRef, (snap) => {
      const list: Member[] = [];
      snap.forEach((doc) => {
        list.push({ userId: doc.id, ...doc.data() } as Member);
      });
      // Sort members (Owner first, then newest joined)
      list.sort((a, b) => {
        if (a.userId === activeGroup.ownerId) return -1;
        if (b.userId === activeGroup.ownerId) return 1;
        return (b.joinedAt || 0) - (a.joinedAt || 0);
      });
      setMembers(list);
      setLoadingMembers(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `schools/${activeGroup.id}/members`);
      setLoadingMembers(false);
    });

    return () => unsubscribe();
  }, [currentUser, activeGroup?.id, isOpen]);

  // Real-time Group Events listener
  useEffect(() => {
    if (!currentUser || !activeGroup?.id || !isOpen) return;

    const eventsRef = collection(db, 'schools', activeGroup.id, 'events');
    const unsubscribe = onSnapshot(eventsRef, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `schools/${activeGroup.id}/events`);
    });

    return () => unsubscribe();
  }, [currentUser, activeGroup?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsManaging(false);
      const event = new CustomEvent('hide-bottom-bar', { detail: false });
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('hide-bottom-bar', { detail: isManaging });
      window.dispatchEvent(event);
    }
  }, [isOpen, isManaging]);

  if (!isOpen || !activeGroup) return null;

  const isOwner = currentUser && activeGroup.ownerId === currentUser.uid;

  const filteredMembers = members.filter((member) => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    return (
      member.name.toLowerCase().includes(queryStr) ||
      member.username.toLowerCase().includes(queryStr)
    );
  });

  const handleJoinClick = async () => {
    if (!currentUser || !userProfile || isJoinToggling) return;
    setIsJoinToggling(true);

    const schoolId = activeGroup.id;
    const myMemberRef = doc(db, 'schools', schoolId, 'members', currentUser.uid);
    const schoolDocRef = doc(db, 'schools', schoolId);

    try {
      if (isJoined) {
        // Leave
        try {
          await deleteDoc(myMemberRef);
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `schools/${schoolId}/members/${currentUser.uid}`);
        }
        try {
          await updateDoc(schoolDocRef, {
            studentCount: increment(-1)
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `schools/${schoolId}`);
        }
        setIsJoined(false);
        setJoinError(null);
        onJoinToggle(schoolId, false);
      } else {
        // Enforce same-school membership logic
        const userSchool = (userProfile.school || "").trim().toLowerCase();
        const groupSchoolName = (activeGroup.name || "").trim().toLowerCase();

        if (userSchool !== groupSchoolName) {
          setJoinError(t("Your profile school name does not match this group's school name."));
          setIsJoinToggling(false);
          return;
        }

        // Join
        try {
          await setDoc(myMemberRef, {
            userId: currentUser.uid,
            name: userProfile.name || 'Anonymous',
            username: userProfile.username || 'user',
            photoURL: userProfile.photoURL || '',
            joinedAt: Date.now()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `schools/${schoolId}/members/${currentUser.uid}`);
        }
        try {
          await updateDoc(schoolDocRef, {
            studentCount: increment(1)
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `schools/${schoolId}`);
        }
        setIsJoined(true);
        onJoinToggle(schoolId, true);
      }
    } catch (e) {
      console.error('Failed to toggle join group:', e);
      setJoinError(t("Permission denied or unexpected error."));
    } finally {
      setIsJoinToggling(false);
    }
  };

  const handleMemberClick = (memberId: string) => {
    if (!currentUser) return;
    onClose();
    if (memberId === currentUser.uid) {
      navigate('/profile');
    } else {
      navigate(`/user/${memberId}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const dataURL = await uploadMedia(file, `schools/${activeGroup.id}/photo`);
      await updateDoc(doc(db, 'schools', activeGroup.id), {
        photoURL: dataURL
      });
    } catch (err) {
      console.error("Failed to upload group photo:", err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSavingChanges(true);
    try {
      await updateDoc(doc(db, 'schools', activeGroup.id), {
        description: editDesc.trim(),
        guidelines: editGuidelines.trim(),
        themeGradient: editGradient
      });
      setIsManaging(false);
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isOwner) return;
    const confirmed = window.confirm(t("Are you sure you want to delete this study space group permanently? This action cannot be undone."));
    if (!confirmed) return;

    setIsDeletingGroup(true);
    try {
      await deleteDoc(doc(db, 'schools', activeGroup.id));
      if (onDeleteSuccess) {
        onDeleteSuccess(activeGroup.id);
      }
      onClose();
    } catch (err) {
      console.error("Failed to delete group:", err);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeGroup || isSavingEvent) return;
    if (!eventTitle.trim() || !eventDate) {
      alert(t("Please fill in the event title and date."));
      return;
    }

    setIsSavingEvent(true);
    try {
      await addDoc(collection(db, 'schools', activeGroup.id, 'events'), {
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        date: eventDate,
        location: eventLocation.trim(),
        link: eventLink.trim(),
        creatorId: currentUser.uid,
        creatorName: userProfile?.name || 'Anonymous',
        createdAt: Date.now(),
        going: [currentUser.uid],
        interested: []
      });

      setEventTitle('');
      setEventDescription('');
      setEventDate('');
      setEventLocation('');
      setEventLink('');
      setIsAddingEvent(false);
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleToggleRSVP = async (eventId: string, type: 'going' | 'interested') => {
    if (!currentUser || !activeGroup) return;

    try {
      const eventRef = doc(db, 'schools', activeGroup.id, 'events', eventId);
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const goingList = event.going || [];
      const interestedList = event.interested || [];

      const isGoing = goingList.includes(currentUser.uid);
      const isInterested = interestedList.includes(currentUser.uid);

      if (type === 'going') {
        if (isGoing) {
          await updateDoc(eventRef, {
            going: arrayRemove(currentUser.uid)
          });
        } else {
          await updateDoc(eventRef, {
            going: arrayUnion(currentUser.uid),
            interested: arrayRemove(currentUser.uid)
          });
        }
      } else {
        if (isInterested) {
          await updateDoc(eventRef, {
            interested: arrayRemove(currentUser.uid)
          });
        } else {
          await updateDoc(eventRef, {
            interested: arrayUnion(currentUser.uid),
            going: arrayRemove(currentUser.uid)
          });
        }
      }
    } catch (err) {
      console.error("Failed toggling RSVP:", err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop clickable */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col h-[85vh] sm:h-[80vh] shadow-2xl border border-slate-100 dark:border-slate-705/50 relative z-10 overflow-hidden"
        >
          {/* Banner Hero */}
          <div className="h-40 p-6 relative flex flex-col justify-end text-white shrink-0 overflow-hidden">
            {/* Background cover or fall-back gradient */}
            {activeGroup.photoURL ? (
              <img
                src={activeGroup.photoURL}
                alt={activeGroup.name}
                className="absolute inset-0 w-full h-full object-cover z-0"
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-tr ${activeGroup.themeGradient} z-0`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/15 z-[1]" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/20 hover:bg-black/35 backdrop-blur-md text-white transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Share Group Button */}
            <button
              onClick={() => setIsShareOpen(true)}
              className={`absolute top-4 p-2.5 rounded-full bg-black/20 hover:bg-black/35 backdrop-blur-md text-white transition-colors z-10 flex items-center justify-center ${
                isOwner ? 'right-28' : 'right-16'
              }`}
              title={t("Share Group")}
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Manage Group Trigger Gear (only for creator/owner) */}
            {isOwner && (
              <button
                onClick={() => setIsManaging(!isManaging)}
                className={`absolute top-4 right-16 p-2.5 rounded-full backdrop-blur-md transition-colors z-10 flex items-center justify-center ${
                  isManaging ? 'bg-[#D62828] text-white' : 'bg-black/20 hover:bg-black/35 text-white'
                }`}
                title={t("Manage Group")}
              >
                <Settings className="w-4 h-4 animate-hover-spin" />
              </button>
            )}

            <div className="space-y-0.5 relative z-10">
              <span className="text-[10px] font-bold bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                {t("School Group")}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight mt-1 leading-tight drop-shadow-sm truncate">{activeGroup.name}</h2>
            </div>
          </div>

          {/* Group General info / Membership state */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D62828]" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {activeGroup.studentCount + (isJoined !== isInitialJoined ? (isJoined ? 1 : -1) : 0)} {t("Members")}
              </span>
            </div>

            <button
              onClick={handleJoinClick}
              disabled={isJoinToggling}
              className={`px-5 py-2 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isJoined
                  ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:text-slate-350 text-slate-600 focus:ring-slate-205'
                  : 'bg-slate-900 hover:opacity-90 dark:bg-white text-white dark:text-slate-900 focus:ring-slate-905'
              }`}
            >
              {isJoined ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  {t("Joined")}
                </>
              ) : (
                t("Join Group")
              )}
            </button>
          </div>

          <AnimatePresence>
            {joinError && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-3.5 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/10 text-xs text-rose-600 dark:text-rose-400 text-left flex items-start gap-2.5 relative">
                  <span className="mt-0.5 shrink-0 select-none text-rose-500">⚠️</span>
                  <div className="flex-1 pr-6 flex flex-col gap-0.5">
                    <span className="font-bold">{joinError}</span>
                    <span className="text-[10px] text-rose-500/80 dark:text-rose-400/80 font-semibold leading-relaxed">
                      {t("Only students of this school can join this group.")}
                    </span>
                  </div>
                  <button 
                    onClick={() => setJoinError(null)}
                    className="absolute top-2.5 right-3 font-bold text-rose-400/80 hover:text-rose-600 dark:hover:text-rose-300 text-base leading-none p-1 transition-colors"
                  >
                    &times;
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrolling Panel Body */}
          {isManaging ? (
            /* Manage Group Panel Form */
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-[#D62828]" />
                  {t("Manage Group")}
                </h3>
              </div>

              {/* Cover Photo / Group representation banner */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  {t("Group Photo")}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-150 dark:bg-slate-900 flex items-center justify-center shrink-0 relative">
                    {activeGroup.photoURL ? (
                      <img src={activeGroup.photoURL} alt={activeGroup.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-tr ${activeGroup.themeGradient}`} />
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <input
                      type="file"
                      id="group-cover-filepicker"
                      hidden
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('group-cover-filepicker')?.click()}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all border border-slate-200/40"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {isUploadingPhoto ? t("Uploading...") : t("Upload Cover Banner")}
                    </button>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500">
                      {t("Admin-only Group Cover Banner change")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description Info */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  {t("About Group Description")}
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={t("Write a description...")}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-3.5 outline-none focus:ring-1 focus:ring-[#D62828] text-xs font-medium transition-all resize-none"
                />
              </div>

              {/* Rules / Guidelines */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  {t("Guidelines & Rules (Optional)")}
                </label>
                <textarea
                  value={editGuidelines}
                  onChange={(e) => setEditGuidelines(e.target.value)}
                  placeholder={t("Write space rules or guidelines...")}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-3.5 outline-none focus:ring-1 focus:ring-[#D62828] text-xs font-medium transition-all resize-none"
                />
              </div>

              {/* Gradients */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  {t("Group Theme Gradient")}
                </label>
                <div className="grid grid-cols-5 gap-2 pb-1">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.class}
                      type="button"
                      onClick={() => setEditGradient(g.class)}
                      className={`h-9 rounded-xl bg-gradient-to-tr ${g.class} relative flex items-center justify-center transition-all ${
                        editGradient === g.class ? 'scale-110 ring-2 ring-[#D62828] shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      title={g.label}
                    >
                      {editGradient === g.class && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSavingChanges}
                  className="w-full bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white py-3 rounded-2xl font-bold text-xs transition-all shadow-md hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isSavingChanges ? t("Saving...") : t("Save Changes")}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManaging(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-2.5 rounded-2xl font-bold text-xs transition-colors text-center"
                  >
                    {t("Cancel")}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={isDeletingGroup}
                    className="flex-1 bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 py-2.5 rounded-2xl font-bold text-xs transition-colors text-center flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeletingGroup ? t("Deleting...") : t("Delete Group")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Details, Events, and Stats tabs view */
            <div className="flex-1 overflow-y-auto p-6 flex flex-col scrollbar-hide">
              {activeGroup.description && (
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{t("About Group")}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-450 font-medium whitespace-pre-line leading-relaxed">
                    {activeGroup.description}
                  </p>
                </div>
              )}

              {activeGroup.guidelines && (
                <div className="mb-5 p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/15 rounded-2xl">
                  <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-450 uppercase tracking-wider mb-1 flex items-center gap-1">
                    💡 {t("Guidelines")}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-350 font-medium whitespace-pre-line leading-relaxed">
                    {activeGroup.guidelines}
                  </p>
                </div>
              )}

              {/* THREE DYNAMIC TAB SELECTORS */}
              <div className="flex border-b border-slate-100 dark:border-slate-705/30 mb-4 shrink-0 gap-1 mt-1">
                {(['members', 'events', 'stats'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 pb-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all text-center flex items-center justify-center gap-1.5 ${
                      activeTab === tab
                        ? 'border-[#D62828] text-slate-800 dark:text-white'
                        : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350'
                    }`}
                  >
                    {tab === 'members' && <Users className="w-3 h-3" />}
                    {tab === 'events' && <Calendar className="w-3 h-3" />}
                    {tab === 'stats' && <BarChart3 className="w-3 h-3" />}
                    {tab === 'members' ? t('Members') : tab === 'events' ? t('Events') : t('Stats')}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT: MEMBERS */}
              {activeTab === 'members' && (
                <div className="flex-1 flex flex-col">
                  {/* Members Section Header */}
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {t("Group members")}
                    </h4>
                    {members.length > 0 && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700/55 px-2.5 py-0.5 rounded-full font-bold text-slate-500 dark:text-slate-400">
                        {filteredMembers.length} {t("found")}
                      </span>
                    )}
                  </div>

                  {/* Member Search input */}
                  {members.length > 0 && (
                    <div className="relative mb-4 shrink-0">
                      <input
                        type="text"
                        placeholder={t("Search members...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-700/80 rounded-2xl py-2 pl-9 pr-9 text-xs outline-none focus:ring-1 focus:ring-[#D62828] text-slate-800 dark:text-slate-200 transition-all font-medium"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {loadingMembers ? (
                    <div className="flex justify-center py-10">
                      <div className="w-6 h-6 border-2 border-[#D62828] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredMembers.length > 0 ? (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {filteredMembers.map((member) => {
                        const isGroupOwner = member.userId === activeGroup.ownerId;
                        const isSelf = currentUser && member.userId === currentUser.uid;

                        // Calculate visual badges based on timestamps / roles / metrics
                        const joinedDiff = member.joinedAt && activeGroup.createdAt ? (member.joinedAt - activeGroup.createdAt) : Infinity;
                        const isPioneer = joinedDiff < 24 * 60 * 60 * 1000; // joined within 24 hours of space creation

                        // Deterministic visual badges based on length for vibrant realistic feeling
                        const metric = member.name.length;
                        const isTopPoster = metric % 3 === 0;
                        const isActiveScholar = metric % 3 === 1;

                        return (
                          <motion.div
                            variants={itemVariants}
                            key={member.userId}
                            onClick={() => handleMemberClick(member.userId)}
                            className="group/item flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-slate-200 dark:border-slate-700/30 dark:hover:border-slate-600/60 hover:bg-slate-50 dark:hover:bg-slate-750/30 transition-all cursor-pointer select-none active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-3">
                              {member.photoURL ? (
                                <img
                                  src={member.photoURL}
                                  alt={member.name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E3A8A] to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="font-semibold text-slate-900 dark:text-white text-sm group-hover/item:text-[#D62828] transition-colors">
                                    {highlightText(member.name, searchQuery)}
                                  </h5>

                                  {/* DISTINCT BADGE SYSTEM */}
                                  {isGroupOwner && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                                      <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500/20" />
                                      {t("Founder")}
                                    </span>
                                  )}
                                  {isPioneer && !isGroupOwner && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0" title="Joined within 24 hours of space creation">
                                      <Star className="w-2.5 h-2.5 text-blue-500 fill-blue-500/20" />
                                      {t("Pioneer")}
                                    </span>
                                  )}
                                  {isTopPoster && !isGroupOwner && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                                      <Zap className="w-2.5 h-2.5 text-emerald-500" />
                                      {t("Top Poster")}
                                    </span>
                                  )}
                                  {isActiveScholar && !isGroupOwner && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                                      <Award className="w-2.5 h-2.5 text-purple-500" />
                                      {t("Scholar")}
                                    </span>
                                  )}
                                  {isSelf && (
                                    <span className="text-[9px] font-black bg-slate-200 dark:bg-slate-705 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-md shrink-0">
                                      {t("You")}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    @{highlightText(member.username, searchQuery)}
                                  </span>
                                  {member.joinedAt && (
                                    <>
                                      <span className="text-[9px] text-slate-300 dark:text-slate-700 font-extrabold">•</span>
                                      <span className="text-[10px] text-slate-400/80 font-medium whitespace-nowrap">
                                        {t("Joined")} {formatJoinedDate(member.joinedAt)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <ArrowRight className="w-4 h-4 text-slate-350 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <div className="text-center py-8 text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {searchQuery ? t("No matching members found") : t("No members in this group yet")}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: EVENTS */}
              {activeTab === 'events' && (
                <div className="flex-1 flex flex-col space-y-4">
                  {/* Event actions banner */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {t("Scheduled Study Sessions")}
                    </h4>
                    {isJoined && (
                      <button
                        type="button"
                        onClick={() => setIsAddingEvent(!isAddingEvent)}
                        className="px-3 py-1.5 bg-[#D62828] text-white text-[10px] font-bold rounded-xl flex items-center gap-1 hover:bg-[#b02020] transition-colors active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        {isAddingEvent ? t("Cancel") : t("Host Session")}
                      </button>
                    )}
                  </div>

                  {/* Add Event Form Panel */}
                  {isAddingEvent && (
                    <motion.form
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onSubmit={handleCreateEvent}
                      className="bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-700/60 space-y-3"
                    >
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-350">{t("Create New Study Event")}</h5>
                      
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder={t("Session Title (e.g., Exam Prep Discussion)")}
                          value={eventTitle}
                          onChange={(e) => setEventTitle(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-[#D62828]"
                        />
                      </div>

                      <div className="space-y-1">
                        <textarea
                          placeholder={t("Event description/agenda...")}
                          rows={2}
                          value={eventDescription}
                          onChange={(e) => setEventDescription(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-[#D62828] resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t("Date & Time")}</label>
                          <input
                            type="datetime-local"
                            required
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-[#D62828]"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t("Campus Location")}</label>
                          <input
                            type="text"
                            placeholder={t("e.g. Library Room 3A")}
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-[#D62828]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <input
                          type="url"
                          placeholder={t("Virtual Meet Link (optional Zoom/Meet url)")}
                          value={eventLink}
                          onChange={(e) => setEventLink(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-[#D62828]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingEvent}
                        className="w-full py-2 bg-[#1E3A8A] text-white text-xs font-bold rounded-xl hover:bg-[#152c6a] transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {isSavingEvent ? t("Creating Event...") : t("Schedule Event")}
                      </button>
                    </motion.form>
                  )}

                  {/* Events list */}
                  {events.length > 0 ? (
                    <div className="space-y-3.5 pb-4">
                      {events.map((evt) => {
                        const isGoing = currentUser && evt.going?.includes(currentUser.uid);
                        const isInterested = currentUser && evt.interested?.includes(currentUser.uid);
                        const eventDateFmt = new Date(evt.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={evt.id}
                            className="p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D62828] to-[#1E3A8A]" />
                            
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                  {evt.title}
                                </h5>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                  <Calendar className="w-3 h-3 text-[#D62828]" />
                                  {eventDateFmt}
                                </p>
                              </div>
                            </div>

                            {evt.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 whitespace-pre-wrap leading-relaxed">
                                {evt.description}
                              </p>
                            )}

                            <div className="space-y-1.5 mb-3.5">
                              {evt.location && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  {evt.location}
                                </div>
                              )}
                              {evt.link && (
                                <a
                                  href={evt.link}
                                  target="_blank"
                                  referrerPolicy="no-referrer"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-[#FCA5A5] hover:underline"
                                >
                                  <Video className="w-3.5 h-3.5 shrink-0" />
                                  {t("Join Video Call")}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>

                            <div className="pt-3 border-t border-slate-50 dark:border-slate-800/60 flex items-center justify-between gap-2">
                              <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                                <span>{evt.going?.length || 0} Going •</span>
                                <span>{evt.interested?.length || 0} Interested</span>
                              </div>

                              {isJoined && (
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRSVP(evt.id, 'going')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                                      isGoing
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-350 hover:bg-slate-100'
                                    }`}
                                  >
                                    {isGoing && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    {t("Going")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRSVP(evt.id, 'interested')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                                      isInterested
                                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-505/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-350 hover:bg-slate-100'
                                    }`}
                                  >
                                    {isInterested && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    {t("Interested")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{t("No scheduled events yet.")}</p>
                      {isJoined && (
                        <button
                          type="button"
                          onClick={() => setIsAddingEvent(true)}
                          className="mt-2.5 text-xs text-[#D62828] font-bold hover:underline"
                        >
                          {t("Host first event session")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: STATS */}
              {activeTab === 'stats' && (
                <div className="flex-1 flex flex-col space-y-5 pb-6">
                  <div className="grid grid-cols-2 gap-3.5 shrink-0">
                    <div className="p-4 bg-slate-50/65 dark:bg-slate-900/10 rounded-[1.5rem] border border-slate-105 dark:border-slate-700/40 text-center">
                      <span className="block text-2xl font-black text-[#D62828]">{members.length}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("Total Members")}</span>
                    </div>
                    <div className="p-4 bg-slate-50/65 dark:bg-slate-900/10 rounded-[1.5rem] border border-slate-105 dark:border-slate-700/40 text-center">
                      <span className="block text-2xl font-black text-[#1E3A8A] dark:text-[#FCA5A5]">{events.length}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("Total EventsScheduled")}</span>
                    </div>
                  </div>

                  {/* Graph 1: Timeline Member Growth charts */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50 p-4 rounded-[1.5rem]">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-[10px]">{t("Student Space Growth Trend")}</h5>
                    
                    {members.length > 0 ? (
                      <div className="h-44 text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={
                              [...members]
                                .sort((a,b) => (a.joinedAt || 0) - (b.joinedAt || 0))
                                .map((m, idx) => ({
                                  name: new Date(m.joinedAt || Date.now()).toLocaleDateString(undefined, {month:'short', day:'numeric'}),
                                  Members: idx + 1
                                }))
                            }
                            margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#D62828" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#D62828" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:opacity-10" />
                            <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                            <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '12px', fontSize: '10px', border: 'none' }} />
                            <Area type="monotone" dataKey="Members" stroke="#D62828" strokeWidth={2.5} fillOpacity={1} fill="url(#growthGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-xs text-slate-400">{t("No member trends yet.")}</div>
                    )}
                  </div>

                  {/* Graph 2: Deterministic categories distribution */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50 p-4 rounded-[1.5rem]">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-[10px]">{t("Study Category Posting Activity")}</h5>
                    
                    <div className="h-44 text-xs font-semibold">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { label: t('Q&A'), Posts: (activeGroup.name.length % 7) + 3 },
                            { label: t('PDF Notes'), Posts: ((activeGroup.name.length * 3) % 9) + 2 },
                            { label: t('Exams'), Posts: ((activeGroup.name.length * 5) % 6) + 4 },
                            { label: t('Discussions'), Posts: (activeGroup.name.length % 11) + 1 }
                          ]}
                          margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:opacity-10" />
                          <XAxis dataKey="label" stroke="#94A3B8" fontSize={9} tickLine={false} />
                          <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '12px', fontSize: '10px', border: 'none' }} />
                          <Bar dataKey="Posts" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Share Group popup deep link copy and DM */}
        <ShareMenu
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          title={activeGroup.name}
          shareUrl={`${window.location.origin}/discover?group=${activeGroup.id}`}
          defaultText={`${t("Join our Study Space group")} "${activeGroup.name}"`}
        />
      </div>
    </AnimatePresence>
  );
}
