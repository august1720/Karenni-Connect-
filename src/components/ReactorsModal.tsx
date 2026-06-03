import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { useUserData } from '../hooks/useUserData';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ReactorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

interface ReactorData {
  userId: string;
  emoji: string;
  createdAt: number;
}

const REACTION_TYPES = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🔥', label: 'Fire' }
];

function ReactorRow({ userId, emoji }: { key?: React.Key; userId: string; emoji: string }) {
  const user = useUserData(userId);
  const { t } = useLanguage();

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Link to={`/user/${userId}`} className="relative">
          {user?.photoURL ? (
            <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-700" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          {/* Reaction emoji badge */}
          <span className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 p-0.5 rounded-full text-sm shadow-sm border border-slate-150 dark:border-slate-750 select-none">
            {emoji}
          </span>
        </Link>
        <div className="flex flex-col">
          <Link to={`/user/${userId}`} className="font-bold text-sm text-slate-900 dark:text-white hover:underline">
            {user?.name || t("Loading...")}
          </Link>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            @{user?.username || 'user'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function ReactorsModal({ isOpen, onClose, postId }: ReactorsModalProps) {
  const [reactors, setReactors] = useState<ReactorData[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen || !postId) return;

    const fetchReactors = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'reactions'), where('postId', '==', postId));
        const snapshot = await getDocs(q);
        const data: ReactorData[] = [];
        snapshot.forEach((doc) => {
          const item = doc.data();
          if (item.userId && item.emoji) {
            data.push({
              userId: item.userId,
              emoji: item.emoji,
              createdAt: item.createdAt || 0,
            });
          }
        });
        // Sort newest first
        data.sort((a, b) => b.createdAt - a.createdAt);
        setReactors(data);
        setSelectedFilter('all'); // reset to All on open or new post
      } catch (err) {
        console.error("Error fetching reactors:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReactors();
  }, [isOpen, postId]);

  // Calculate counts for each emoji
  const counts = reactors.reduce((acc, cur) => {
    acc[cur.emoji] = (acc[cur.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter reactors list based on active filter button selection
  const filteredReactors = selectedFilter === 'all'
    ? reactors
    : reactors.filter(r => r.emoji === selectedFilter);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 350, damping: 25, mass: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t("Who Reacted")}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                id="close-reactors-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reaction Filter Sub-Header / Summary count row */}
            {!loading && reactors.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto border-b border-slate-100 dark:border-slate-800 scrollbar-none bg-slate-55/10 dark:bg-slate-950/20">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedFilter('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span>{t("All")}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${selectedFilter === 'all' ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {reactors.length}
                  </span>
                </motion.button>

                {REACTION_TYPES.map((type) => {
                  const count = counts[type.emoji] || 0;
                  if (count === 0) return null; // Show active reactors count summary

                  const isActive = selectedFilter === type.emoji;
                  return (
                    <motion.button
                      key={type.emoji}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedFilter(type.emoji)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="text-sm">{type.emoji}</span>
                      <span>{t(type.label)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        isActive
                          ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Content list */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredReactors.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm animate-pulse">
                  {t("No reactions matching this filter")}
                </div>
              ) : (
                filteredReactors.map((reactor) => (
                  <ReactorRow key={reactor.userId} userId={reactor.userId} emoji={reactor.emoji} />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

