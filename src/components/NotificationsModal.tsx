import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserData } from '../hooks/useUserData';
import { X, Bell, CheckCheck, Trash2, Heart, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationRow({ noti, onRead }: { key?: any; noti: any; onRead: (id: string) => void }) {
  const actor = useUserData(noti.fromUserId);
  const { t } = useLanguage();

  const getNotificationText = () => {
    switch (noti.type) {
      case 'like':
        return t("liked your post");
      case 'comment':
        return t("commented on your post");
      case 'follow':
        return t("followed you");
      case 'event':
        return t("created a new event");
      default:
        return t("interacted with you");
    }
  };

  const getIcon = () => {
     switch (noti.type) {
       case 'like':
         return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
       case 'comment':
         return <MessageSquare className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />;
       default:
         return <Bell className="w-3.5 h-3.5 text-slate-500" />;
     }
  };

  return (
    <div 
      onClick={() => onRead(noti.id)}
      className={`p-3.5 rounded-2xl flex items-start gap-3 border transition-colors cursor-pointer ${
        noti.read 
          ? 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/40' 
          : 'bg-[#D62828]/5 dark:bg-[#D62828]/10 border-[#D62828]/20 dark:border-[#D62828]/20 ring-1 ring-[#D62828]/10'
      } hover:bg-slate-50 dark:hover:bg-slate-800/80`}
    >
      <div className="relative shrink-0">
        <Link to={`/user/${noti.fromUserId}`}>
          {actor?.photoURL ? (
            <img src={actor.photoURL} alt={actor.name} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-705" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs">
              {actor?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </Link>
        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 p-0.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-750">
           {getIcon()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-800 dark:text-slate-200 leading-normal">
          <span className="font-bold text-slate-900 dark:text-white mr-1">
            {actor?.name || t("An elegant user")}
          </span>
          {getNotificationText()}
        </p>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block mt-1">
          {new Date(noti.createdAt).toLocaleDateString()} at {new Date(noti.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
      </div>

      {!noti.read && (
        <span className="w-2.5 h-2.5 bg-[#D62828] rounded-full mt-1.5 shrink-0 animate-pulse"></span>
      )}
    </div>
  );
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    setLoading(true);
    const q = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error reading notifications:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, isOpen]);

  const handleMarkAsRead = async (notiId: string) => {
    if (!currentUser) return;
    try {
      const notiRef = doc(db, 'users', currentUser.uid, 'notifications', notiId);
      await updateDoc(notiRef, { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUser || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach((n) => {
      if (!n.read) {
        const ref = doc(db, 'users', currentUser.uid, 'notifications', n.id);
        batch.update(ref, { read: true });
      }
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl flex flex-col h-[75vh] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-100 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4.5 border-b border-slate-100 dark:border-slate-800 relative shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#D62828]/10 text-[#D62828] flex items-center justify-center">
                 <Bell className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{t("Notifications")}</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {notifications.some(n => !n.read) && (
                <button 
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-xs text-[#1E3A8A] dark:text-sky-300 hover:opacity-85 font-extrabold pr-2"
                  title={t("Mark all read")}
                >
                  <CheckCheck className="w-4 h-4" />
                  {t("Read All")}
                </button>
              )}
              <button 
                onClick={onClose} 
                className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-3 border-[#D62828] border-t-transparent animate-spin"></div>
                <p className="text-xs text-slate-400 font-semibold">{t("Loading updates...")}</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(n => (
                <NotificationRow key={n.id} noti={n} onRead={handleMarkAsRead} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
                  <Bell className="w-7 h-7 stroke-[1.25]" />
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">{t("All caught up!")}</p>
                <p className="text-slate-500 text-xs mt-1.5 max-w-[240px] leading-relaxed">{t("We'll let you know when people interact with your profile, posts, or events.")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
