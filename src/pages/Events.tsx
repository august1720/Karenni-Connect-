import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { collection, query, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Event } from '../types';

export default function Events() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', type: 'Google Meet', time: '' });

  useEffect(() => {
    fetchEvents();
  }, [currentUser]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!currentUser || !newEvent.title || !newEvent.date) return;
    try {
      const eventId = crypto.randomUUID();
      await setDoc(doc(db, 'events', eventId), {
        title: newEvent.title,
        description: newEvent.description || newEvent.time + ' • ' + newEvent.type,
        date: new Date(newEvent.date).getTime(),
        creatorId: currentUser.uid,
        createdAt: Date.now()
      });
      setIsCreating(false);
      setNewEvent({ title: '', description: '', date: '', type: 'Google Meet', time: '' });
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("Events")}</h1>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="w-10 h-10 rounded-full bg-[#1E3A8A]/10 dark:bg-[#1E3A8A]/30 shadow-sm border border-[#1E3A8A]/20 dark:border-[#1E3A8A]/50 flex items-center justify-center text-[#1E3A8A] dark:text-blue-400 font-bold text-xl"
        >
          {isCreating ? '×' : '+'}
        </button>
      </div>

      {isCreating && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mx-1 bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm"
        >
          <h3 className="font-bold mb-4">{t("Create New Event")}</h3>
          <div className="space-y-3">
            <input type="text" placeholder={t("Event Title")} value={newEvent.title} onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm outline-none" />
            <input type="datetime-local" value={newEvent.date} onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm outline-none" />
            <input type="text" placeholder={t("Time (e.g. 2:00 PM - 4:00 PM)")} value={newEvent.time} onChange={e => setNewEvent(f => ({ ...f, time: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm outline-none" />
            <input type="text" placeholder={t("Platform (e.g. Google Meet)")} value={newEvent.type} onChange={e => setNewEvent(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm outline-none" />
            <Button onClick={handleCreateEvent} className="w-full rounded-xl bg-[#D62828] text-white">{t("Create")}</Button>
          </div>
        </motion.div>
      )}
      
      {/* Featured Event */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 p-8 shadow-sm flex flex-col relative overflow-hidden mx-1 cursor-pointer"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D62828]/10 rounded-full blur-[3rem] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div className="z-10 flex flex-col w-full">
          <span className="px-3 py-1 bg-[#D62828]/10 text-[#D62828] dark:bg-[#D62828]/20 dark:text-[#FCA5A5] rounded-full text-[10px] font-bold uppercase tracking-wider w-max mb-4">{t("Featured")}</span>
          <h2 className="text-3xl font-bold tracking-tight leading-none mb-3 text-slate-900 dark:text-white">{t("Edu Summit")} <br/><span className="text-[#D62828]">2026</span></h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">{t("Annual virtual gathering for all student networks.")}</p>
          
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t("Date & Time")}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">December 15, 2026</span>
            </div>
            <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-full shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center text-xl">
              🗓️
            </div>
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 z-${5-i}`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="Avatar" className="w-full h-full rounded-full animate-fade-in" />
                </div>
              ))}
              <div className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold z-0 text-slate-500">
                +120
              </div>
            </div>
            <Button variant="primary" className="rounded-full px-6 bg-[#D62828] hover:bg-[#D62828]/90 text-white shadow-lg shadow-[#D62828]/20">{t("Join")}</Button>
          </div>
        </div>
      </motion.div>

      {/* Upcoming List */}
      <h2 className="text-xl font-bold px-2 mt-2">{t("Upcoming Events")}</h2>
      <div className="space-y-4 mx-1">
        {loading ? (
           <div className="flex justify-center py-8">
             <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : events.length > 0 ? events.map((event, i) => {
          const d = new Date(event.date);
          const month = d.toLocaleString('default', { month: 'short' });
          const day = d.getDate();
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              key={event.id} 
              className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4"
            >
              <div className={`w-16 h-16 shrink-0 rounded-[1.5rem] bg-gradient-to-br from-[#1E3A8A] to-[#D62828] shadow-inner flex flex-col items-center justify-center text-white`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{month}</span>
                <span className="text-xl font-black leading-none mt-1">{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">{event.title}</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">{event.description}</p>
              </div>
              <button onClick={() => alert('Joined!')} className="w-10 h-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
            </motion.div>
          );
        }) : (
          <p className="text-center text-slate-500 text-sm mt-4">{t("No events found.")}</p>
        )}
      </div>
    </div>
  );
}
