import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, setDoc, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Send, Search, Share2, Users } from 'lucide-react';

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  shareUrl: string;
  defaultText: string;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
}

interface ChatUser {
  userId: string;
  name: string;
  photoURL?: string;
  username: string;
}

export function ShareMenu({ isOpen, onClose, title, shareUrl, defaultText }: ShareMenuProps) {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatUsers, setChatUsers] = useState<Record<string, ChatUser>>({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentUser || !isOpen) return;

    setLoadingChats(true);
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
      setChats(list);
      setLoadingChats(false);

      // Dynamically fetch other user info
      for (const chat of list) {
        const otherUserId = chat.participants.find(p => p !== currentUser.uid);
        if (otherUserId && !chatUsers[otherUserId]) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherUserId));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              setChatUsers(prev => ({
                ...prev,
                [otherUserId]: {
                  userId: otherUserId,
                  name: uData.name || 'Anonymous',
                  username: uData.username || 'user',
                  photoURL: uData.photoURL || '',
                }
              }));
            }
          } catch (err) {
            console.error("Failed loading chat user info:", err);
          }
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'chats');
      setLoadingChats(false);
    });

    return () => unsub();
  }, [currentUser, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const event = new CustomEvent('hide-bottom-bar', { detail: true });
      window.dispatchEvent(event);
    }
    return () => {
      const event = new CustomEvent('hide-bottom-bar', { detail: false });
      window.dispatchEvent(event);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  const handleShareToChat = async (chatId: string, otherUserId: string) => {
    if (!currentUser || sentMap[chatId]) return;

    try {
      const msgId = crypto.randomUUID();
      const messageText = `${defaultText}: ${shareUrl}`;

      await setDoc(doc(db, 'chats', chatId, 'messages', msgId), {
        authorId: currentUser.uid,
        text: messageText,
        createdAt: Date.now(),
        readBy: [currentUser.uid]
      });

      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: `Shared a post 🔗`,
        lastMessageTime: Date.now(),
        lastMessageAuthorId: currentUser.uid,
      }, { merge: true });

      setSentMap(prev => ({ ...prev, [chatId]: true }));
    } catch (err) {
      console.error("Failed to share link to chat:", err);
    }
  };

  const filteredChats = chats.filter((chat) => {
    const otherUserId = chat.participants.find(p => p !== currentUser?.uid);
    if (!otherUserId) return false;
    const uInfo = chatUsers[otherUserId];
    if (!uInfo) return true; // Keep loading
    const queryStr = searchQuery.toLowerCase().trim();
    return (
      uInfo.name.toLowerCase().includes(queryStr) ||
      uInfo.username.toLowerCase().includes(queryStr)
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop clickable */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] flex flex-col max-h-[75vh] sm:max-h-[65vh] shadow-2xl border border-slate-100 dark:border-slate-705 relative z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-xs">
              <Share2 className="w-4 h-4 text-[#D62828]" />
              {t("Share")}: {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/40 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-hide">
            {/* Copy Field */}
            <div className="space-y-1.5 mb-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("Copy Deep Link")}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap outline-none select-all cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1 text-white shrink-0 ${
                    copied ? 'bg-emerald-500 scale-95' : 'bg-[#1E3A8A] hover:bg-[#152C69] active:scale-95'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t("Copied") : t("Copy")}
                </button>
              </div>
            </div>

            {/* Selector list of chats */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("Send to Chat")}
              </span>

              {/* Chat Search input */}
              <div className="relative shrink-0">
                <input
                  type="text"
                  placeholder={t("Search chats...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-8 text-xs outline-none focus:ring-1 focus:ring-[#D62828] text-slate-800 dark:text-slate-200 transition-all font-medium"
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-605"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {loadingChats ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[#D62828] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredChats.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {filteredChats.map((chat) => {
                    const otherUserId = chat.participants.find(p => p !== currentUser?.uid);
                    if (!otherUserId) return null;
                    const uInfo = chatUsers[otherUserId];
                    const isSent = sentMap[chat.id];

                    return (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 hover:bg-slate-100/60 dark:bg-slate-900/20 dark:hover:bg-slate-700/30 transition-all border border-slate-100/50 dark:border-slate-700/30"
                      >
                        <div className="flex items-center gap-2">
                          {uInfo?.photoURL ? (
                            <img src={uInfo.photoURL} alt={uInfo.name} className="w-8 h-8 rounded-full object-cover border border-slate-200/50" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[11px] font-bold">
                              {uInfo?.name.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="max-w-[150px]">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">
                              {uInfo?.name || 'Loading...'}
                            </h4>
                            <p className="text-[9px] text-slate-400 truncate">@{uInfo?.username || 'username'}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleShareToChat(chat.id, otherUserId)}
                          disabled={isSent || !uInfo}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                            isSent
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 shadow-sm'
                              : 'bg-slate-100 hover:bg-[#D62828] hover:text-white dark:bg-slate-700 text-slate-755 dark:text-slate-200 border border-transparent'
                          }`}
                        >
                          {isSent ? (
                            <>
                              <Check className="w-3 h-3 stroke-[3]" />
                              {t("Sent")}
                            </>
                          ) : (
                            <>
                              <Send className="w-2.5 h-2.5" />
                              {t("Send")}
                            </>
                          )
                        }
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 text-[11px] text-slate-400 font-bold">
                  {t("No active chats found. Direct messages to copy is always supported.")}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
