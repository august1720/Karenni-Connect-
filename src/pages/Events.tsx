import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Event } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus, 
  Search, 
  Sparkles, 
  Filter, 
  ArrowRight, 
  CheckSquare, 
  X, 
  Compass, 
  GraduationCap, 
  Code, 
  Award, 
  PartyPopper, 
  CheckCircle2, 
  Trash2, 
  Share2 
} from 'lucide-react';

// Categories Configuration
const CATEGORIES = [
  { id: 'All', label: 'All', icon: Compass, color: 'from-slate-500 to-slate-600', bg: 'bg-slate-50 dark:bg-slate-800' },
  { id: 'Academic', label: 'Academic', icon: GraduationCap, color: 'from-[#1E3A8A] to-indigo-600', bg: 'bg-indigo-50/50 dark:bg-indigo-950/20' },
  { id: 'Hackathon', label: 'Hackathons', icon: Code, color: 'from-[#D62828] to-rose-650', bg: 'bg-rose-50/50 dark:bg-rose-950/20' },
  { id: 'Social', label: 'Socials', icon: PartyPopper, color: 'from-purple-500 to-fuchsia-600', bg: 'bg-purple-50/50 dark:bg-purple-950/20' },
  { id: 'Workshop', label: 'Workshops', icon: Award, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' }
];

export default function Events() {
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  
  // States
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // New Event Form State
  const [newEvent, setNewEvent] = useState({ 
    title: '', 
    description: '', 
    date: '', 
    type: 'Google Meet', 
    time: '',
    category: 'Academic' 
  });

  // Fetch events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Event)));
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    const handleRefresh = () => {
      fetchEvents();
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
    };
  }, [currentUser]);

  // Handle Event Creation
  const handleCreateEvent = async () => {
    if (!currentUser || !newEvent.title || !newEvent.date) return;
    try {
      const eventId = crypto.randomUUID();
      const eventData = {
        title: newEvent.title,
        description: newEvent.description || `${newEvent.time} • ${newEvent.type}`,
        date: new Date(newEvent.date).getTime(),
        creatorId: currentUser.uid,
        createdAt: Date.now(),
        type: newEvent.type,
        time: newEvent.time,
        category: newEvent.category,
        attendees: [currentUser.uid] // Initial attendee is the creator
      };
      
      const docPath = `events/${eventId}`;
      try {
        await setDoc(doc(db, 'events', eventId), eventData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }

      setIsCreating(false);
      setNewEvent({ 
        title: '', 
        description: '', 
        date: '', 
        type: 'Google Meet', 
        time: '', 
        category: 'Academic' 
      });
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle RSVP status
  const toggleRSVP = async (event: Event, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card details click
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
      
      // Update local state instantly for extreme responsiveness
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

      // If active selected event is open, update it too
      if (selectedEvent && selectedEvent.id === event.id) {
        setSelectedEvent(prev => {
          if (!prev) return null;
          const list = prev.attendees || [];
          return {
            ...prev,
            attendees: isRsvpd 
              ? list.filter(id => id !== currentUser.uid)
              : [...list, currentUser.uid]
          };
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  // Category based filtering & search query matching
  const filteredEvents = events.filter(evt => {
    const categoryMatches = activeTab === 'All' || evt.category === activeTab || (activeTab === 'My RSVPs' && evt.attendees?.includes(currentUser?.uid || ''));
    const searchMatches = 
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.category && evt.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return categoryMatches && searchMatches;
  });

  // Featured Spotlight Event (find the nearest upcoming event of type 'Hackathon' or 'Academic')
  const featuredEvent = events.find(evt => evt.category === 'Hackathon') || events[0];

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      {/* Dynamic Visual Navigation and Heading */}
      <div className="flex items-center justify-between px-2">
        <div>
          <span className="text-[10px] font-black tracking-widest text-[#D62828] uppercase flex items-center gap-1.5 mb-1 bg-[#D62828]/10 px-2.5 py-1 rounded-full w-max">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {t("EXPLORE CAMPUS LIFE")}
          </span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{t("Events")}</h1>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="h-11 px-4 rounded-xl bg-gradient-to-tr from-[#D62828] to-red-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t("Add Event")}
        </button>
      </div>

      {/* Featured Event Spotlight (Visual Showcase) */}
      {featuredEvent && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelectedEvent(featuredEvent)}
          className="relative bg-slate-900 dark:bg-slate-950 text-white rounded-[2.5rem] border border-slate-800 p-8 shadow-xl overflow-hidden mx-1 cursor-pointer group"
        >
          {/* Futuristic Visual background details */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/20 rounded-full blur-[4rem] group-hover:bg-rose-500/25 transition-all duration-500 -z-0 translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[3rem] -z-0 -translate-x-1/3 translate-y-1/3"></div>
          
          <div className="z-10 relative flex flex-col w-full">
            <div className="flex items-center justify-between mb-5">
              <span className="px-3.5 py-1 bg-gradient-to-tr from-[#D62828] to-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-500/30">
                ⭐ {t("Featured Spotlight")}
              </span>
              <span className="text-[11px] font-bold text-slate-400 capitalize flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full">
                {featuredEvent.category || 'Seminar'}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-3 text-white group-hover:text-red-400 transition-colors">
              {featuredEvent.title}
            </h2>
            <p className="text-slate-300 text-sm font-medium mb-6 line-clamp-2 max-w-lg">
              {featuredEvent.description}
            </p>
            
            <div className="grid grid-cols-2 gap-4 bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 mb-6 border border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{t("Date")}</span>
                  <span className="text-xs font-bold text-white truncate">
                    {new Date(featuredEvent.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{t("Time & Location")}</span>
                  <span className="text-xs font-bold text-white truncate">
                    {featuredEvent.time || t("Flexible")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {(featuredEvent.attendees || []).slice(0, 3).map((uid, idx) => (
                    <div key={idx} className="w-8 h-8 rounded-full border border-slate-800 bg-slate-700 overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} alt="User" className="w-full h-full" />
                    </div>
                  ))}
                  {((featuredEvent.attendees || []).length > 3) && (
                    <div className="w-8 h-8 rounded-full border border-slate-800 bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                      +{((featuredEvent.attendees || []).length) - 3}
                    </div>
                  )}
                </div>
                <span className="text-slate-400 text-[11px] font-bold">
                  {(featuredEvent.attendees || []).length} {t("Going")}
                </span>
              </div>
              
              <button 
                onClick={(e) => toggleRSVP(featuredEvent, e)}
                className={`py-2 px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md border active:scale-95 transition-all ${
                  (featuredEvent.attendees || []).includes(currentUser?.uid || '')
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-white hover:bg-slate-150 text-slate-900 border-white'
                }`}
              >
                {/* Visual Check icon if RSVP'd */}
                {(featuredEvent.attendees || []).includes(currentUser?.uid || '') ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                    {t("RSVP'd")}
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 text-slate-900" />
                    {t("RSVP Now")}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modern Search Field in Events */}
      <div className="relative mx-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("Search by title, details...")}
          className="block w-full pl-10 pr-4 py-2.5 border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-850 rounded-2xl text-xs font-semibold placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-500">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Compact Categories Tab List */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none px-1">
        {CATEGORIES.map((cat) => {
          const IconComponent = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                isActive 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-md'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-red-400 dark:text-red-500' : 'text-slate-400'}`} />
              {t(cat.label)}
            </button>
          );
        })}
        <button
          onClick={() => setActiveTab('My RSVPs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all border ${
            activeTab === 'My RSVPs'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-md'
              : 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          {t("My RSVPs")}
        </button>
      </div>

      {/* Dynamic Staggered Events Grid Layout */}
      <div className="space-y-4 px-1">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#D62828] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredEvents.length > 0 ? (
          <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4"
          >
            {filteredEvents.map((evt, idx) => {
              const d = new Date(evt.date);
              const month = d.toLocaleString('default', { month: 'short' });
              const day = d.getDate();
              const isCreator = evt.creatorId === currentUser?.uid;
              const hasJoined = (evt.attendees || []).includes(currentUser?.uid || '');
              
              const catConf = CATEGORIES.find(c => c.id === evt.category) || CATEGORIES[0];
              const IconComp = catConf.icon;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.3 }}
                  key={evt.id} 
                  onClick={() => setSelectedEvent(evt)}
                  className="bg-white dark:bg-slate-850 rounded-[2rem] border border-slate-100/80 dark:border-slate-800/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 cursor-pointer relative overflow-hidden group hover:border-[#D62828]/25"
                >
                  <div className="flex items-center gap-4 w-full">
                    {/* Visual custom date square design */}
                    <div className="w-14 h-14 shrink-0 rounded-[1.25rem] bg-gradient-to-br from-[#1E3A8A] to-[#D62828] shadow-md flex flex-col items-center justify-center text-white font-sans shrink-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">{month}</span>
                      <span className="text-lg font-black leading-none mt-0.5">{day}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border flex items-center gap-1 ${catConf.bg} text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/60`}>
                          <IconComp className="w-3 h-3 text-[#D62828]" />
                          {t(evt.category || 'Other')}
                        </span>
                        {evt.type === 'Online' || evt.type?.toLowerCase().includes('google') || evt.type?.toLowerCase().includes('zoom') ? (
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50/50 dark:bg-blue-950/20 px-2 py-0.5 rounded-full">
                            🌐 {t("Virtual")}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight group-hover:text-[#D62828] transition-colors truncate">
                        {evt.title}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1 truncate">
                        {evt.description}
                      </p>
                    </div>

                    {/* RSVP Trigger check btn */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button 
                        onClick={(e) => toggleRSVP(evt, e)}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center hover:scale-110 active:scale-95 transition-all ${
                          hasJoined 
                            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' 
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#D62828]'
                        }`}
                        title={hasJoined ? t("Leave Event") : t("Join Event")}
                      >
                        <CheckSquare className="w-4.5 h-4.5" />
                      </button>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {(evt.attendees || []).length} {t("attending")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-850 rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-800">
            <Compass className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-semibold">{t("No events match your selected filters.")}</p>
          </div>
        )}
      </div>

      {/* Dialog: Create New Event Drawer Overlay */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] border-t border-slate-200/50 dark:border-slate-800 p-6 shadow-2xl overflow-y-auto max-h-[85vh] select-none"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-150 dark:bg-rose-950/45 flex items-center justify-center text-[#D62828]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">{t("Create campus event")}</h3>
                </div>
                <button 
                  onClick={() => setIsCreating(false)}
                  className="p-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Event Category selector */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">{t("Event Category")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'All').map((cat) => {
                      const CatIcon = cat.icon;
                      const isCatSelected = newEvent.category === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setNewEvent(p => ({ ...p, category: cat.id }))}
                          className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-[10px] font-bold transition-all ${
                            isCatSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white'
                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-800'
                          }`}
                        >
                          <CatIcon className="w-3.5 h-3.5 text-[#D62828]" />
                          {t(cat.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">{t("Event Title")}</label>
                  <input 
                    type="text" 
                    placeholder={t("Code Hackathon, Edu Fair...")} 
                    value={newEvent.title} 
                    onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))} 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 outline-none border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">{t("Short Description")}</label>
                  <textarea 
                    placeholder={t("Briefly describe what this event covers...")} 
                    value={newEvent.description} 
                    onChange={e => setNewEvent(f => ({ ...f, description: e.target.value }))} 
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 outline-none border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">{t("Calendar Date")}</label>
                    <input 
                      type="date" 
                      value={newEvent.date} 
                      onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold outline-none border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">{t("Exact Time")}</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 2:00 PM - 5:00 PM" 
                      value={newEvent.time} 
                      onChange={e => setNewEvent(f => ({ ...f, time: e.target.value }))} 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 outline-none border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">{t("Location or Meet Link")}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Google Meet Code, Hall 3" 
                    value={newEvent.type} 
                    onChange={e => setNewEvent(f => ({ ...f, type: e.target.value }))} 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 outline-none border border-slate-150 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500" 
                  />
                </div>

                <div className="pt-2">
                  <Button 
                    onClick={handleCreateEvent} 
                    className="w-full rounded-xl bg-gradient-to-tr from-[#D62828] to-red-500 text-white font-bold text-xs py-3 shadow-lg shadow-rose-500/20"
                  >
                    {t("Publish Event")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dialog: Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-150 dark:border-slate-800 p-6 shadow-2xl mx-2 relative overflow-hidden"
            >
              {/* Decorative top colored ring element */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-indigo-500 to-emerald-500"></div>

              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {selectedEvent.category || 'CAMPUS EVENT'}
                </span>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                {selectedEvent.title}
              </h2>
              
              <p className="text-slate-600 dark:text-slate-350 text-xs font-semibold leading-relaxed mb-5 bg-slate-50 dark:bg-slate-850/50 p-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/40">
                {selectedEvent.description}
              </p>

              <div className="space-y-3.5 mb-6">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-350">
                  <div className="w-8 h-8 rounded-xl bg-slate-10 w-8 flex items-center justify-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-500 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block leading-none mb-0.5">{t("Date")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white-100">
                      {new Date(selectedEvent.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-350">
                  <div className="w-8 h-8 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 text-purple-500 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block leading-none mb-0.5">{t("Time Slot")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {selectedEvent.time || t("Not specified")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-350">
                  <div className="w-8 h-8 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-[#D62828] shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block leading-none mb-0.5">{t("Location or Link")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {selectedEvent.type || t("Google Meet")}
                    </span>
                  </div>
                </div>

                {selectedEvent.type?.startsWith('http') && (
                  <a 
                    href={selectedEvent.type} 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-center text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    🌐 {t("Join Live Conference")}
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{t("People attending")}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">
                    {(selectedEvent.attendees || []).length} {t("Going")}
                  </span>
                </div>
                
                <button
                  onClick={(e) => toggleRSVP(selectedEvent, e)}
                  className={`py-2 px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all border active:scale-95 ${
                    (selectedEvent.attendees || []).includes(currentUser?.uid || '')
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/35 hover:bg-emerald-500/20'
                      : 'bg-gradient-to-tr from-[#D62828] to-red-500 text-white border-red-500 hover:from-red-650'
                  }`}
                >
                  {(selectedEvent.attendees || []).includes(currentUser?.uid || '') ? (
                    <>
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                      {t("Attending ✔")}
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4.5 h-4.5" />
                      {t("Reserve Spot")}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
