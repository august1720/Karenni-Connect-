import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useMatch, useLocation } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, setDoc, onSnapshot, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserData } from '../hooks/useUserData';
import { motion } from 'framer-motion';
import { Send, Image as ImageIcon, ArrowLeft, Video, Settings, Search, Check, CheckCheck, X, Smile, Link as LinkIcon } from 'lucide-react';
import { uploadMedia } from '../lib/storage';
import { VideoCall } from '../components/VideoCall';
import { triggerHaptic } from '../lib/haptic';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageAuthorId?: string;
  unreadCount?: Record<string, number>;
}

interface Message {
  id: string;
  text: string;
  authorId: string;
  createdAt: number;
  mediaURL?: string;
  stickerCode?: string;
  stickerURL?: string;
  readBy?: string[];
}

function ChatList() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();
  const [chats, setChats] = useState<Chat[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || location.pathname !== '/messages') return;

    let unsubscribe: (() => void) | undefined;
    const processChats = (allChats: Chat[]) => {
      // Deduplicate by other user id
      const uniqueChats = [];
      const seenUsers = new Set();
      
      for (const chat of allChats) {
        const otherUserId = chat.participants.find(p => p !== currentUser.uid) || currentUser.uid;
        if (!seenUsers.has(otherUserId)) {
          seenUsers.add(otherUserId);
          uniqueChats.push(chat);
        }
      }
      return uniqueChats;
    };

    const runMainQuery = () => {
      const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', currentUser.uid)
      );
      
      unsubscribe = onSnapshot(q, (snap) => {
        const allChats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
        // Sort client side based on lastMessageTime desc
        allChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        setChats(processChats(allChats));
      }, (err) => {
        console.error("Chats query failed:", err);
        handleFirestoreError(err, OperationType.GET, 'chats');
      });
    };

    runMainQuery();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, location.pathname]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0F172A] pt-4 px-2 pb-24">
      <h1 className="text-3xl font-bold tracking-tight px-2 mb-4">{t("Messages")}</h1>
      <div className="space-y-2">
        {chats.length > 0 ? chats.map(chat => (
          <ChatItem key={chat.id} chat={chat} onClick={() => navigate(`/messages/${chat.id}`)} />
        )) : (
          <p className="text-center text-slate-500 mt-8 text-sm">{t("No messages yet. Start a chat from a user's profile!")}</p>
        )}
      </div>
    </div>
  );
}

function ChatItem({ chat, onClick }: { key?: React.Key, chat: Chat, onClick: () => void }) {
  const { currentUser } = useAuth();
  const otherUserId = chat.participants.find(p => p !== currentUser?.uid) || '';
  const otherUser = useUserData(otherUserId);
  const unreadCount = chat.unreadCount?.[currentUser?.uid || ''] || 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] flex items-center gap-4 cursor-pointer shadow-sm border border-slate-100 dark:border-slate-700/50"
    >
      <div className="relative shrink-0">
        {otherUser?.photoURL ? (
          <img src={otherUser.photoURL} alt={otherUser.name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-lg">
            {otherUser?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        {otherUser?.lastSeen && (Date.now() - otherUser.lastSeen < 120000) && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" title="Active now"></span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 dark:text-white truncate">{otherUser?.name || 'Loading...'}</h3>
        <p className="text-sm text-slate-500 truncate">{chat.lastMessage || 'Sent a media'}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-slate-400 font-medium">
          {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : ''}
        </span>
        {unreadCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-[#D62828] text-white flex items-center justify-center text-[10px] font-bold">
            {unreadCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}

const EMOJI_CATEGORIES = [
  { id: 'smileys', name: '😀 Smileys & People', emojis: ['😊','😂','🥰','😍','👍','🙌','👏','🔥','❤️','🎉','✨','💡','📚','🚀','🤔','😭','😡','😎','🤩','😜','😱','🥱','🌟','🥳','😏','🥺','👑','💎','💯','💀','💩','💔','👋','🎓','🤝','🫠','😹','😻'] },
  { id: 'animals', name: '🐱 Animals & Nature', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🐝','🐛','🦋','🦖','🐳','🐬','🐙','⭐','🌙','☀️','☁️','🌧️','⚡','🌈','🍀','🌸'] },
  { id: 'food', name: '🍏 Food & Drink', emojis: ['🍏','🍎','🍌','🍉','🍓','🍒','🍍','🥥','🥦','🥑','🥐','🧀','🍳','🍔','🍟','🍕','🍜','🍨','🍰','🍩','🍪','🍫','🍬','🥛','☕','🍵','🥤'] },
  { id: 'study', name: '📚 Objects & Study', emojis: ['📚','📖','📒','📔','✍️','📝','💻','📱','🖥️','⏱️','🔋','💡','🎒','🎓','🏆','🎨','🎭','🎬','🎧','🎪','📍','🔑','🔒','✉️','📁','📊','⚙️','🛡️','🧸','🎁'] },
  { id: 'symbols', name: '🔴 Symbols & Flags', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','💖','💘','💯','💬','💭','🔔','📣','📢','🔶','🔷','🔴','🔵','🟢','🟡','🏁','🇲🇲','🇺🇸','🇬🇧','🇯🇵','🇰🇷','🇹🇭','🇸🇬'] }
];

const STICKER_PACKS = [
  {
    id: 'cats',
    name: '🐱 Cute Cats',
    stickers: [
      { id: 'cat_study', emoji: '🐱📖', label: 'စာလုပ်နေတယ်', text: 'စာလုပ်နေတယ်' },
      { id: 'cat_coding', emoji: '🐱💻', label: 'ကုဒ်ရေးနေတယ်', text: 'ကုဒ်ရေးနေတယ်' },
      { id: 'cat_sleeping', emoji: '🐱💤', label: 'အိပ်ချင်ပြီ', text: 'အိပ်ချင်ပြီ' },
      { id: 'cat_victory', emoji: '🐱🏆', label: 'အောင်ပြီဟေ့', text: 'အောင်ပြီဟေ့' },
      { id: 'cat_rich', emoji: '🐱💵', label: 'မုန့်ဖိုးပေး', text: 'မုန့်ဖိုးပေး' },
      { id: 'cat_shock', emoji: '🐱🙀', label: 'တကယ်လား!', text: 'တကယ်လား!' },
      { id: 'cat_crying', emoji: '🐱😭', label: 'စိတ်မကောင်းဘူး', text: 'စိတ်မကောင်းဘူး' },
      { id: 'cat_heart', emoji: '🐱❤️', label: 'ချစ်တယ်နော်', text: 'ချစ်တယ်နော်' },
    ]
  },
  {
    id: 'school',
    name: '📚 Student Life',
    stickers: [
      { id: 'sch_idea', emoji: '💡✨', label: 'ဦးနှောက်ပြေးတယ်', text: 'ဦးနှောက်ပြေးတယ်' },
      { id: 'sch_writing', emoji: '✍️🔥', label: 'စာမေးပွဲနီးပြီ', text: 'စာမေးပွဲနီးပြီ' },
      { id: 'sch_coffee', emoji: '☕️🔋', label: 'ကော်ဖီလိုတယ်', text: 'ကော်ဖီလိုတယ်' },
      { id: 'sch_group', emoji: '👥💬', label: 'ဆွေးနွေးကြစို့', text: 'ဆွေးနွေးကြစို့' },
      { id: 'sch_stressed', emoji: '🤯💨', label: 'ဦးနှောက်စားတယ်', text: 'ဦးနှောက်စားတယ်' },
      { id: 'sch_passed', emoji: '💯🎉', label: 'အမှတ်ပြည့်ရပြီ', text: 'အမှတ်ပြည့်ရပြီ' },
      { id: 'sch_deadline', emoji: '🚨📅', label: 'မှီပါတော့မလား', text: 'မှီပါတော့မလား' },
      { id: 'sch_cheers', emoji: '🙌🎓', label: 'ဘွဲ့ရပြီဗျို့', text: 'ဘွဲ့ရပြီဗျို့' },
    ]
  },
  {
    id: 'expression',
    name: '🔥 Expressions',
    stickers: [
      { id: 'exp_cool', emoji: '😎🔥', label: 'ဘန်းပြနေတာ', text: 'ဘန်းပြနေတာ' },
      { id: 'exp_lmao', emoji: '😂🤣', label: 'ခဟဟဟ', text: 'ခဟဟဟ' },
      { id: 'exp_pray', emoji: '🙏✨', label: 'ကျေးဇူးတင်ပါတယ်', text: 'ကျေးဇူးတင်ပါတယ်' },
      { id: 'exp_love', emoji: '💖🙈', label: 'ရှက်လို့', text: 'ရှက်လို့' },
      { id: 'exp_shy', emoji: '🥺👉👈', label: 'တောင်းပန်ပါတယ်', text: 'တောင်းပန်ပါတယ်' },
      { id: 'exp_angry', emoji: '😡💢', label: 'မကျေနပ်ဘူးနော်', text: 'မကျေနပ်ဘူးနော်' },
      { id: 'exp_salute', emoji: '🫡🫡', label: 'လေးစားသွားပြီ', text: 'လေးစားသွားပြီ' },
      { id: 'exp_celebrate', emoji: '🥳🎆', label: 'အောင်ပွဲခံမယ်', text: 'အောင်ပွဲခံမယ်' },
    ]
  }
];

const renderMessageText = (text: string, isMe: boolean) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  if (parts.length === 1) {
    return <p className="text-[15px] space-y-1 break-words">{text}</p>;
  }

  return (
    <p className="text-[15px] space-y-1 break-words">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          const isGroupLink = part.includes('/discover?group=') || part.includes('/discover?groupId=');
          let displayLabel = part;
          if (isGroupLink) {
            displayLabel = "🏫 Click to join Study Space Group ➔";
          }
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={isMe 
                ? "underline font-bold text-[#FCA5A5] dark:text-[#FECDD3] hover:text-white break-all inline" 
                : "underline font-bold text-[#D62828] dark:text-rose-450 hover:underline break-all inline"
              }
              onClick={(e) => e.stopPropagation()}
            >
              {displayLabel}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
};

function ChatRoom() {
  const { chatId } = useParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVideoCall, setShowVideoCall] = useState(false);

  // Rich messaging features
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [joinedGroups, setJoinedGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // Advanced stickers/emojis states
  const [activeKeyboardMode, setActiveKeyboardMode] = useState<'emoji' | 'sticker'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('smileys');
  const [selectedStickerPack, setSelectedStickerPack] = useState('cats');

  useEffect(() => {
    if (showShareModal) {
      const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
          const snap = await getDocs(collection(db, 'schools'));
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setJoinedGroups(list);
        } catch (err) {
          console.error("Failed to load schools to share:", err);
        } finally {
          setLoadingGroups(false);
        }
      };
      fetchGroups();
    }
  }, [showShareModal]);

  useEffect(() => {
    if (!chatId || !currentUser || !location.pathname.startsWith('/messages/')) return;
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) setChatInfo({ id: snap.id, ...snap.data() } as Chat);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `chats/${chatId}`);
    });

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubMsgs = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      
      // mark as read
      let hasUnread = false;
      msgs.forEach(msg => {
          if (msg.authorId !== currentUser.uid && (!msg.readBy || !msg.readBy.includes(currentUser.uid))) {
              hasUnread = true;
              setDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
                 readBy: [...(msg.readBy || []), currentUser.uid]
              }, { merge: true });
          }
      });

      if (hasUnread || (chatInfo?.unreadCount?.[currentUser.uid] && chatInfo.unreadCount[currentUser.uid] > 0)) {
        setDoc(doc(db, 'chats', chatId), {
           unreadCount: { ...(chatInfo?.unreadCount || {}), [currentUser.uid]: 0 }
        }, { merge: true });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `chats/${chatId}/messages`);
    });
    
    return () => { unsubChat(); unsubMsgs(); };
  }, [chatId, currentUser]);

  const otherUserId = chatInfo?.participants.find(p => p !== currentUser?.uid) || '';
  const otherUser = useUserData(otherUserId);

  const handleSendSticker = async (stickerCode: string) => {
    if (!chatId || !currentUser) return;
    triggerHaptic([15, 10, 15]); // provide a distinctive tap for sticker sending
    try {
      const msgId = crypto.randomUUID();
      const newMsg: any = {
        authorId: currentUser.uid,
        text: `[sticker:${stickerCode}]`,
        stickerCode,
        createdAt: Date.now(),
        readBy: [currentUser.uid]
      };
      await setDoc(doc(db, 'chats', chatId, 'messages', msgId), newMsg);
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: 'Sent a sticker 🧸',
        lastMessageTime: Date.now(),
        lastMessageAuthorId: currentUser.uid,
        unreadCount: { 
          [otherUserId]: (chatInfo?.unreadCount?.[otherUserId] || 0) + 1,
          [currentUser.uid]: 0
        }
      }, { merge: true });
    } catch (e) {
      console.error("Error sending sticker: ", e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !currentUser || (!text.trim() && !imageFile)) return;
    triggerHaptic(20); // clean simple vibration tap for standard message
    
    setIsUploading(true);
    setUploadProgress(0);
    try {
      let mediaURL = '';
      if (imageFile) {
        mediaURL = await uploadMedia(imageFile, `chats/${chatId}`, (progress) => {
          setUploadProgress(progress);
        });
        setImageFile(null);
      }

      const msgId = crypto.randomUUID();
      const newMsg: any = {
        authorId: currentUser.uid,
        text: text.trim(),
        createdAt: Date.now(),
        readBy: [currentUser.uid]
      };
      if (mediaURL) newMsg.mediaURL = mediaURL;

      await setDoc(doc(db, 'chats', chatId, 'messages', msgId), newMsg);
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: text.trim() || 'Image',
        lastMessageTime: Date.now(),
        lastMessageAuthorId: currentUser.uid,
        unreadCount: { 
          [otherUserId]: (chatInfo?.unreadCount?.[otherUserId] || 0) + 1,
          [currentUser.uid]: 0
        }
      }, { merge: true });
      
      setText('');
      setUploadProgress(0);
    } catch (e) {
      console.error(e);
      setUploadProgress(-1);
    } finally {
      setIsUploading(false);
    }
  };

  if (showVideoCall && otherUser) {
    return <VideoCall roomId={chatId || ''} targetUser={otherUser} onEnd={() => setShowVideoCall(false)} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0F172A] flex flex-col pt-safe px-0">
      <header className="flex items-center justify-between p-4 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
          
          <div 
            onClick={() => otherUserId && navigate(`/user/${otherUserId}`)}
            className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 py-1.5 px-2 rounded-xl transition-all active:scale-[0.98]"
            title={t("View Profile")}
          >
            <div className="relative shrink-0">
              {otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt="pfp" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                  {otherUser?.name?.charAt(0) || 'U'}
                </div>
              )}
              {otherUser?.lastSeen && (Date.now() - otherUser.lastSeen < 120000) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" title="Active now"></span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white leading-tight">{otherUser?.name || 'Loading...'}</h2>
              <p className="text-[10px] font-semibold text-slate-500">
                {otherUser?.lastSeen ? (
                  Date.now() - otherUser.lastSeen < 120000 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">{t("Active now")}</span>
                  ) : (
                    `${t("Active now")} ${(() => {
                      const diff = Date.now() - otherUser.lastSeen;
                      const secs = Math.floor(diff / 1000);
                      if (secs < 60) return t('just now');
                      const mins = Math.floor(secs / 60);
                      if (mins < 60) return `${mins}m ago`;
                      const hours = Math.floor(mins / 60);
                      if (hours < 24) return `${hours}h ago`;
                      return new Date(otherUser.lastSeen).toLocaleDateString();
                    })()}`
                  )
                ) : (
                  t('offline')
                )}
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowVideoCall(true)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-[#1E3A8A] dark:text-blue-400 hover:bg-slate-200 transition-colors">
          <Video className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col max-w-2xl mx-auto w-full">
        {messages.map(msg => {
          const isMe = msg.authorId === currentUser?.uid;
          const isSticker = msg.stickerCode || (msg.text && msg.text.startsWith('[sticker:'));
          let stickerEmoji = '';
          let stickerLabel = '';
          if (isSticker) {
            const stickerId = msg.stickerCode || msg.text.slice(9, -1);
            const found = STICKER_PACKS.flatMap(p => p.stickers).find(s => s.id === stickerId);
            stickerEmoji = found?.emoji || '🧸';
            stickerLabel = found?.label || stickerId;
          }

          return (
            <div key={msg.id} className={`flex max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
              <div className={isSticker ? "p-1 rounded-2xl flex flex-col items-center select-none" : `p-3 rounded-2xl ${isMe ? 'bg-[#1E3A8A] text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none shadow-sm border border-slate-100 dark:border-slate-700'}`}>
                {isSticker ? (
                  <div className="flex flex-col items-center p-1.5 relative group max-w-xs animate-fade-in">
                    <div className="w-20 h-20 flex items-center justify-center bg-slate-100/30 dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200/20 dark:border-slate-700/30 hover:scale-110 transition-transform active:scale-90 relative overflow-hidden">
                      <span className="text-4xl select-none filter drop-shadow">
                        {stickerEmoji}
                      </span>
                    </div>
                    <span className="mt-1.5 px-2 py-0.5 bg-slate-900/60 dark:bg-slate-800/80 text-white text-[9px] font-bold rounded-full">
                      {stickerLabel}
                    </span>
                  </div>
                ) : (
                  <>
                    {msg.mediaURL && (
                      <img src={msg.mediaURL} alt="attachment" className="w-full max-w-xs rounded-xl mb-2 object-contain" />
                    )}
                    {msg.text && renderMessageText(msg.text, isMe)}
                  </>
                )}
                <div className={`flex justify-end items-center gap-1 mt-1 text-[10px] ${isMe ? (isSticker ? 'text-slate-400 dark:text-slate-500' : 'text-blue-200') : 'text-slate-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                  {isMe && (msg.readBy?.includes(otherUserId) ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 opacity-70" />)}
                  {isMe && (
                     <button onClick={() => deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id))} className={`ml-2 bg-transparent opacity-50 hover:opacity-100 ${isSticker ? 'text-slate-400 hover:text-red-500' : 'text-blue-200 hover:text-white'}`}>
                        <X className="w-3 h-3" />
                     </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700/50 pb-safe">
        {uploadProgress === -1 && (
           <div className="bg-red-50 text-red-600 p-2 rounded-xl text-xs font-medium mb-2 w-full max-w-2xl mx-auto">Upload failed or permission denied.</div>
        )}
        {imageFile && (
          <div className="mb-2 relative inline-block">
            <img src={URL.createObjectURL(imageFile)} alt="preview" className="h-20 rounded-xl" />
            <button onClick={() => setImageFile(null)} className="absolute -top-2 -right-2 p-1 bg-black/60 text-white rounded-full"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Dynamic Emoji & Sticker drawer panel */}
        {showEmojiPicker && (
          <div className="mb-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/50 rounded-[1.5rem] shadow-xl max-w-2xl mx-auto flex flex-col relative animate-fade-in z-50">
            {/* Top Close Button & Mode Switch */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveKeyboardMode('emoji')}
                  className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all ${activeKeyboardMode === 'emoji' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350'}`}
                >
                  😊 {t("Emojis")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKeyboardMode('sticker')}
                  className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all ${activeKeyboardMode === 'sticker' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350'}`}
                >
                  🧸 {t("Stickers")}
                </button>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(false)}
                className="p-1 text-slate-450 hover:text-slate-700 dark:hover:text-white bg-slate-50 dark:bg-slate-750 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mode 1: Categorized Emojis */}
            {activeKeyboardMode === 'emoji' && (
              <div className="space-y-2">
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100 dark:border-slate-750">
                  {EMOJI_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedEmojiCategory(cat.id)}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg whitespace-nowrap transition-all shrink-0 ${selectedEmojiCategory === cat.id ? 'bg-[#D62828] text-white' : 'bg-slate-50 dark:bg-slate-900/40 text-slate-550 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto py-1.5 scrollbar-hide justify-items-center">
                  {(EMOJI_CATEGORIES.find(c => c.id === selectedEmojiCategory)?.emojis || []).map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setText(prev => prev + emo)}
                      className="w-9 h-9 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-transform active:scale-130 select-none filter drop-shadow-sm"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode 2: Custom Stickers Pack */}
            {activeKeyboardMode === 'sticker' && (
              <div className="space-y-2">
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100 dark:border-slate-755">
                  {STICKER_PACKS.map(pack => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedStickerPack(pack.id)}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg whitespace-nowrap transition-all shrink-0 ${selectedStickerPack === pack.id ? 'bg-[#D62828] text-white' : 'bg-slate-50 dark:bg-slate-900/40 text-slate-550 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                      {pack.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2.5 max-h-52 overflow-y-auto py-1.5 scrollbar-hide justify-items-center">
                  {(STICKER_PACKS.find(p => p.id === selectedStickerPack)?.stickers || []).map(stk => (
                    <button
                      key={stk.id}
                      type="button"
                      onClick={() => {
                        handleSendSticker(stk.id);
                        setShowEmojiPicker(false);
                      }}
                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-900/40 dark:hover:bg-slate-700/50 border border-slate-200/30 dark:border-slate-700/30 hover:scale-110 active:scale-95 transition-transform w-[68px] h-[78px]"
                      title={stk.label}
                    >
                      <span className="text-3xl filter drop-shadow select-none animate-bounce-slow">
                        {stk.emoji}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-450 font-bold mt-1.5 truncate max-w-full text-center">
                        {stk.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Study Space / Link Selection drawer panel */}
        {showShareModal && (
          <div className="mb-3 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-[1.5rem] shadow-lg max-w-2xl mx-auto animate-fade-in relative flex flex-col space-y-3 z-50">
            <div className="flex justify-between items-center px-0.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <LinkIcon className="w-3.5 h-3.5 text-[#D62828]" />
                {t("Share Study Space or Link")}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowShareModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-700/30 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Manual link template trigger */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="https://example.com" 
                  value={shareUrl}
                  onChange={e => setShareUrl(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-705 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (shareUrl.trim()) {
                      const finalLink = shareUrl.trim().startsWith('http') ? shareUrl.trim() : `https://${shareUrl.trim()}`;
                      setText(prev => (prev ? prev + ' ' : '') + finalLink);
                      setShareUrl('');
                      setShowShareModal(false);
                    }
                  }}
                  className="bg-[#1E3A8A] px-3.5 py-2 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-[#152C69]"
                >
                  {t("Insert")}
                </button>
              </div>
            </div>

            {/* Quick Share Study Spaces list */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {t("Quick Share Study Groups")}
              </span>
              {loadingGroups ? (
                <div className="text-center py-2 text-xs text-slate-400">{t("Loading...")}</div>
              ) : joinedGroups.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {joinedGroups.map(group => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        const dl = `${window.location.origin}/discover?group=${group.id}`;
                        const shareMsg = `Join group "${group.name}": ${dl}`;
                        setText(shareMsg);
                        setShowShareModal(false);
                      }}
                      className="shrink-0 p-2 text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-300 font-semibold"
                    >
                      📢 {group.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold py-1">
                  {t("No study groups found to share. Go to Discover to create or join groups first.")}
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-center max-w-2xl mx-auto">
          <div className="flex gap-1.5 shrink-0">
            <label className="p-2.5 text-slate-400 hover:text-[#D62828] bg-slate-100 dark:bg-slate-700 rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
              <ImageIcon className="w-5 h-5" />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />
            </label>
            <button 
              type="button"
              onClick={() => {
                setShowShareModal(!showShareModal);
                setShowEmojiPicker(false);
              }}
              className={`p-2.5 rounded-full transition-colors ${showShareModal ? 'text-[#D62828] bg-[#D62828]/10' : 'text-slate-400 hover:text-[#D62828] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200'}`}
              title={t("Share Study Space or Link")}
            >
              <LinkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center">
            <input 
              type="text" 
              placeholder={t("Type a message...")} 
              value={text} onChange={e => setText(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-700/50 pl-4 pr-11 py-3 rounded-full text-[15px] outline-none focus:ring-2 focus:ring-[#1E3A8A] transition-all border border-transparent dark:border-slate-700 min-w-0"
            />
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowShareModal(false);
              }}
              className={`absolute right-3 p-1 rounded-full transition-colors ${showEmojiPicker ? 'text-[#D62828] bg-[#D62828]/15' : 'text-slate-400 hover:text-slate-600 dark:hover:text-amber-200'}`}
              title={t("Toggle Emojis")}
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          <button type="submit" disabled={(!text.trim() && !imageFile) || isUploading} className="p-3 bg-[#1E3A8A] hover:bg-[#152C69] disabled:opacity-50 text-white rounded-full shrink-0 transition-colors shadow-sm">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const location = useLocation();
  if (!location.pathname.startsWith('/messages')) return null;

  return (
    <Routes>
      <Route path="/messages" element={<ChatList />} />
      <Route path="/messages/:chatId" element={<ChatRoom />} />
    </Routes>
  );
}
