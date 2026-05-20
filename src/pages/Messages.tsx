import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useMatch } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, setDoc, onSnapshot, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../hooks/useUserData';
import { motion } from 'framer-motion';
import { Send, Image as ImageIcon, ArrowLeft, Video, Settings, Search, Check, CheckCheck, X } from 'lucide-react';
import { uploadMedia } from '../lib/storage';
import { VideoCall } from '../components/VideoCall';

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
  readBy?: string[];
}

function ChatList() {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageTime', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat)));
    });
    return unsub;
  }, [currentUser]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0F172A] pt-4 px-2 pb-24">
      <h1 className="text-3xl font-bold tracking-tight px-2 mb-4">Messages</h1>
      <div className="space-y-2">
        {chats.length > 0 ? chats.map(chat => (
          <ChatItem key={chat.id} chat={chat} onClick={() => navigate(`/messages/${chat.id}`)} />
        )) : (
          <p className="text-center text-slate-500 mt-8 text-sm">No messages yet. Start a chat from a user's profile!</p>
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
      {otherUser?.photoURL ? (
        <img src={otherUser.photoURL} alt={otherUser.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-lg shrink-0">
          {otherUser?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}
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

function ChatRoom() {
  const { chatId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVideoCall, setShowVideoCall] = useState(false);

  useEffect(() => {
    if (!chatId || !currentUser) return;
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) setChatInfo({ id: snap.id, ...snap.data() } as Chat);
    });

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubMsgs = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      
      // mark as read
      if (chatInfo?.unreadCount?.[currentUser.uid] && chatInfo.unreadCount[currentUser.uid] > 0) {
        setDoc(doc(db, 'chats', chatId), {
           unreadCount: { ...chatInfo.unreadCount, [currentUser.uid]: 0 }
        }, { merge: true });
      }
    });
    
    return () => { unsubChat(); unsubMsgs(); };
  }, [chatId, currentUser]);

  const otherUserId = chatInfo?.participants.find(p => p !== currentUser?.uid) || '';
  const otherUser = useUserData(otherUserId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !currentUser || (!text.trim() && !imageFile)) return;
    
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
          
          <div className="flex items-center gap-2">
            {otherUser?.photoURL ? (
              <img src={otherUser.photoURL} alt="pfp" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                {otherUser?.name?.charAt(0) || 'U'}
              </div>
            )}
            <h2 className="font-semibold text-slate-900 dark:text-white">{otherUser?.name || 'Loading...'}</h2>
          </div>
        </div>
        <button onClick={() => setShowVideoCall(true)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-[#1E3A8A] dark:text-blue-400 hover:bg-slate-200 transition-colors">
          <Video className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col max-w-2xl mx-auto w-full">
        {messages.map(msg => {
          const isMe = msg.authorId === currentUser?.uid;
          return (
            <div key={msg.id} className={`flex max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
              <div className={`p-3 rounded-2xl ${isMe ? 'bg-[#1E3A8A] text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none shadow-sm border border-slate-100 dark:border-slate-700'}`}>
                {msg.mediaURL && (
                  <img src={msg.mediaURL} alt="attachment" className="w-full max-w-xs rounded-xl mb-2 object-contain" />
                )}
                {msg.text && <p className="text-[15px] space-y-1 break-words">{msg.text}</p>}
                <div className={`flex justify-end items-center gap-1 mt-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                  {isMe && (msg.readBy?.includes(otherUserId) ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 opacity-70" />)}
                  {isMe && (
                     <button onClick={() => deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id))} className="ml-2 bg-transparent text-blue-200 hover:text-white opacity-50 hover:opacity-100">
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
        <form onSubmit={handleSend} className="flex gap-2 items-center max-w-2xl mx-auto">
          <label className="p-2.5 text-slate-400 hover:text-[#D62828] bg-slate-100 dark:bg-slate-700 rounded-full cursor-pointer hover:bg-slate-200 transition-colors shrink-0">
            <ImageIcon className="w-5 h-5" />
            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />
          </label>
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={text} onChange={e => setText(e.target.value)}
            className="flex-1 bg-slate-100 dark:bg-slate-700/50 px-4 py-3 rounded-full text-[15px] outline-none focus:ring-2 focus:ring-[#1E3A8A] transition-all border border-transparent dark:border-slate-700 min-w-0"
          />
          <button type="submit" disabled={(!text.trim() && !imageFile) || isUploading} className="p-3 bg-[#1E3A8A] hover:bg-[#152C69] disabled:opacity-50 text-white rounded-full shrink-0 transition-colors shadow-sm">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const match = useMatch('/messages');
  return (
    <>
      <Routes>
        <Route path="/" element={<ChatList />} />
        <Route path="/:chatId" element={<ChatRoom />} />
      </Routes>
    </>
  );
}
