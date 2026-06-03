import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, runTransaction, updateDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserData } from '../hooks/useUserData';
import { Button } from './ui/Button';
import { X, Trash2, Mic, Smile, Play, Pause, Reply, Heart, StopCircle, SmilePlus } from 'lucide-react';
import { Comment } from '../types';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { uploadMedia } from '../lib/storage';
import { checkContentModeration } from '../lib/moderation';
import { AudioPlayer } from './AudioPlayer';
import { triggerHaptic } from '../lib/haptic';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postAuthorId: string;
}

const REACTION_LIMIT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Sub-component to render each reply in the thread
function ReplyRow({ reply, commentId, postId, onDelete }: { key?: any; reply: any; commentId: string; postId: string; onDelete: (id: string) => void }) {
  const author = useUserData(reply.authorId);
  const { currentUser } = useAuth();

  return (
    <div className="flex gap-2.5 py-2 pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-4 relative group">
      <Link to={`/user/${reply.authorId}`} className="shrink-0 mt-0.5">
        {author?.photoURL ? (
          <img src={author.photoURL} alt={author.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-[9px] shrink-0">
            {author?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </Link>
      <div className="flex-1 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-2xl rounded-tl-none text-xs">
        <Link to={`/user/${reply.authorId}`} className="hover:underline">
          <h5 className="font-bold text-slate-800 dark:text-slate-200">{author?.name || 'Loading...'}</h5>
        </Link>
        <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed font-medium">{reply.content}</p>
        <span className="text-[9px] text-slate-400 mt-1.5 block">{new Date(reply.createdAt).toLocaleDateString()}</span>
      </div>
      {currentUser?.uid === reply.authorId && (
        <button 
          onClick={() => onDelete(reply.id)}
          className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity self-center"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Sub-component to render each comment item
function CommentItem({ 
  comment, 
  postId, 
  onDelete, 
  onCommentUpdate 
}: { 
  key?: any;
  comment: any; 
  postId: string; 
  onDelete: (id: string) => void;
  onCommentUpdate: (updated: any) => void;
}) {
  const author = useUserData(comment.authorId);
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  // Nested states for comment reactions & replies
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReplyText, setNewReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [showWarningContent, setShowWarningContent] = useState(false);

  // Grouped comment reactions
  const reactionsMap = comment.reactions || {};
  const activeReactions = Object.values(reactionsMap) as string[];
  const likesCount = activeReactions.length;
  const userHasReacted = currentUser ? !!reactionsMap[currentUser.uid] : false;
  const userActiveEmoji = currentUser ? reactionsMap[currentUser.uid] : null;

  // Listen or fetch replies in real-time when thread is opened
  useEffect(() => {
    if (!currentUser || !showReplies) return;
    const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
    const q = query(repliesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setReplies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `posts/${postId}/comments/${comment.id}/replies`);
    });
    return () => unsubscribe();
  }, [currentUser, showReplies, postId, comment.id]);

  const handleReactToComment = async (emoji: string) => {
    if (!currentUser) return;
    triggerHaptic(emoji ? [20, 10] : 15);
    const commentRef = doc(db, 'posts', postId, 'comments', comment.id);
    const currentMap = { ...reactionsMap };
    
    if (currentMap[currentUser.uid] === emoji) {
      delete currentMap[currentUser.uid];
    } else {
      currentMap[currentUser.uid] = emoji;
    }

    try {
      await updateDoc(commentRef, { reactions: currentMap });
      // update main modal state
      onCommentUpdate({ ...comment, reactions: currentMap });
      setShowReactionPanel(false);
    } catch (e) {
      console.error("Error setting reaction", e);
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyText.trim() || !currentUser) return;
    triggerHaptic(20);
    
    setIsSubmittingReply(true);
    try {
      const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
      await addDoc(repliesRef, {
        authorId: currentUser.uid,
        content: newReplyText.trim(),
        createdAt: Date.now()
      });
      setNewReplyText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    triggerHaptic(30);
    try {
      const replyRef = doc(db, 'posts', postId, 'comments', comment.id, 'replies', replyId);
      await deleteDoc(replyRef);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="border-b border-slate-100/60 dark:border-slate-800/40 py-4.5 last:border-0">
      <div className="flex gap-3 relative group">
        <Link to={`/user/${comment.authorId}`} className="shrink-0 mt-0.5">
          {author?.photoURL ? (
            <img src={author.photoURL} alt={author.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {author?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </Link>
        <div className="flex-1">
          <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-none relative border border-slate-100/50 dark:border-slate-800/50 shadow-inner">
            <Link to={`/user/${comment.authorId}`} className="hover:underline block select-none">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{author?.name || 'Loading...'}</h4>
            </Link>
            
            {comment.isFlagged && !showWarningContent ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mt-2 flex flex-col gap-2 select-none">
                <p className="font-extrabold text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  ⚠️ Flagmarked for Safety Review
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed font-semibold">
                  This comment was automatically flagged according to Campus Connect Safe Space Guidelines under standard category: "{comment.flaggedCategory?.replace('_', ' ') || 'Content infraction'}"
                </p>
                <p className="text-[10px] italic text-amber-600 dark:text-amber-400 font-medium">
                  Reason: "{comment.flaggedReason || 'Undergoing moderation evaluation'}"
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setShowWarningContent(true);
                  }}
                  className="mt-1 self-start text-[10.5px] font-black uppercase text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  [Show comment anyway]
                </button>
              </div>
            ) : (
              <>
                <p className={`text-[13px] text-slate-700 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap font-medium ${comment.isFlagged ? 'bg-amber-500/5 border-l-2 border-amber-500/80 pl-2 rounded-r-lg. py-1' : ''}`}>
                  {comment.content}
                </p>
                {comment.isFlagged && (
                  <span className="inline-block mt-1 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[8.5px] px-1.5 py-0.5 font-bold uppercase rounded-md tracking-wider">
                    Auto-Flagged: {comment.flaggedCategory?.replace('_', ' ')}
                  </span>
                )}
              </>
            )}

            {/* Custom Audio Player for comment voice attachments */}
            {comment.audioURL && (
              <div className="mt-2.5">
                <AudioPlayer src={comment.audioURL} />
              </div>
            )}

            {/* Float-out reaction status indicators */}
            {likesCount > 0 && (
              <div className="absolute -bottom-2 right-3.5 bg-white dark:bg-slate-750 px-2 py-0.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-1 select-none">
                <span className="text-xs">
                  {Array.from(new Set(activeReactions)).slice(0, 3).join('')}
                </span>
                <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                  {likesCount}
                </span>
              </div>
            )}
          </div>

          {/* Comment actions section: React, Reply indicators */}
          <div className="flex items-center gap-4.5 mt-2 ml-1 select-none">
            <span className="text-[10px] text-slate-400 font-semibold">{new Date(comment.createdAt).toLocaleDateString()}</span>
            
            {/* Reaction toggle slider with popover trigger */}
            <div className="relative">
              <button 
                onClick={() => setShowReactionPanel(!showReactionPanel)}
                className={`text-[10.5px] font-extrabold transition-colors flex items-center gap-1 ${
                  userHasReacted ? 'text-[#D62828] dark:text-[#FCA5A5]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {userHasReacted && userActiveEmoji ? (
                  <span>{userActiveEmoji} Reacted</span>
                ) : (
                  <>
                    <SmilePlus className="w-3.5 h-3.5" />
                    React
                  </>
                )}
              </button>

              <AnimatePresence>
                {showReactionPanel && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute bottom-5 left-0 mb-2 bg-white dark:bg-slate-750 px-2.5 py-1.5 rounded-full border border-slate-100 dark:border-slate-700 shadow-xl flex gap-2.5 z-50 shrink-0"
                  >
                    {REACTION_LIMIT_EMOJIS.map(emoji => (
                      <button 
                        key={emoji} 
                        onClick={() => handleReactToComment(emoji)}
                        className="text-xl hover:scale-130 active:scale-90 transition-transform cursor-pointer"
                      >
                         {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Thread Replies toggle */}
            <button 
              onClick={() => setShowReplies(!showReplies)}
              className="text-[10.5px] font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <Reply className="w-3.5 h-3.5" />
              {t("Reply")} {replies.length > 0 ? `(${replies.length})` : ''}
            </button>
          </div>
          
          {/* Thread Replies Expanded Section */}
          {showReplies && (
            <div className="mt-3.5 pl-6 space-y-2.5">
               {replies.map(r => (
                 <ReplyRow 
                   key={r.id} 
                   reply={r} 
                   commentId={comment.id} 
                   postId={postId} 
                   onDelete={handleDeleteReply} 
                 />
               ))}

               {/* Reply creation form input */}
               <form onSubmit={handleCreateReply} className="flex gap-2.5 ml-4 pt-1.5 shrink-0">
                  <input 
                    type="text"
                    value={newReplyText}
                    onChange={e => setNewReplyText(e.target.value)}
                    placeholder={t("Write a reply...")}
                    className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 border-none focus:ring-1 focus:ring-[#D62828] outline-none text-xs text-slate-900 dark:text-white"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newReplyText.trim() || isSubmittingReply} 
                    className="rounded-full px-4 text-xs h-8.5 bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] text-white py-0 font-bold"
                  >
                     Send
                  </Button>
               </form>
            </div>
          )}
        </div>

        {currentUser?.uid === comment.authorId && (
          <button 
            onClick={() => onDelete(comment.id)}
            className="absolute top-4 right-1.5 p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete comment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CommentsModal({ isOpen, onClose, postId, postAuthorId }: CommentsModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice recording states for comments
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioIntervalRef = useRef<any>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Emojis
  const [showEmojis, setShowEmojis] = useState(false);
  const EMOJIS = [
    '😂', '❤️', '👍', '🔥', '😍', '🙌', '👏', '🎉', '🚀', '💡', '😢', '😡', '✨', '🇲🇲',
    '😊', '🥰', '🤔', '😎', '🤩', '🥳', '🥺', '😭', '🤯', '🥱', '😴', '💀', '💩', '👑', '💯', '🌟',
    '🐱', '🐶', '🦊', '🐼', '🦖', '🍎', '🍕', '☕', '🥤', '📚', '📖', '💻', '🎓', '🏆', '🎯', '🎈',
    '🎁', '💬', '📢', '🔔', '💖', '🍀', '🌈', '⚡', '💪', '🤝', '🫡', '🙏', '🫠', '✍️', '📝'
  ];

  useEffect(() => {
    if (!currentUser || !isOpen || !postId) return;
    setLoading(true);
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `posts/${postId}/comments`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, isOpen, postId]);

  // Handle comments updates
  const handleCommentUpdate = (updated: any) => {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Audio recording toggle controls for comments
  const startCommentRecording = async () => {
    triggerHaptic([30, 40]);
    try {
      setRecordingError(null);
      setAudioBlob(null);
      setAudioPreviewUrl(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const combinedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(combinedBlob);
        setAudioPreviewUrl(URL.createObjectURL(combinedBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      audioIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone feedback error:", err);
      setRecordingError(t("Could not access microphone."));
    }
  };

  const stopCommentRecording = () => {
    triggerHaptic(20);
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    setIsRecordingAudio(false);
  };

  const clearCommentRecording = () => {
    triggerHaptic(15);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
    setIsPlayingPreview(false);
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  };

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      audio.play();
      setIsPlayingPreview(true);
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !audioBlob) || !currentUser) return;
    triggerHaptic(20);
    setIsSubmitting(true);
    
    // 1. Check AI Moderation
    let isFlagged = false;
    let flaggedReason = '';
    let flaggedCategory = '';

    if (newComment.trim()) {
      try {
        const mod = await checkContentModeration(newComment.trim());
        if (mod.isHarmful) {
          if (mod.flag === 'flag_block') {
            alert(`Guidelines Warning:\n\nYour comment could not be published because it triggers our safe space policy on ${mod.category.replace('_', ' ')}:\n\n"${mod.reason}"`);
            setIsSubmitting(false);
            return;
          } else {
            isFlagged = true;
            flaggedReason = mod.reason;
            flaggedCategory = mod.category;
          }
        }
      } catch (err) {
        console.error("Comment moderation check failed: ", err);
      }
    }

    const commentId = crypto.randomUUID();
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);

    try {
      let audioURL = '';
      if (audioBlob) {
        const file = new File([audioBlob], `comment_voice_${Date.now()}.webm`, { type: 'audio/webm' });
        audioURL = await uploadMedia(file, `posts/${currentUser.uid}/comments/${commentId}`, () => {});
      }

      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error("Post not found");
        
        const newCount = (postSnap.data().commentsCount || 0) + 1;
        
        transaction.set(commentRef, {
          authorId: currentUser.uid,
          content: newComment.trim(),
          ...(audioURL && { audioURL }),
          createdAt: Date.now(),
          isFlagged,
          flaggedReason,
          flaggedCategory,
          moderationStatus: isFlagged ? 'flagged' : 'approved'
        });
        
        transaction.update(postRef, { commentsCount: newCount });
      });

      // Register the flagged comment in 'flagged_items' for the admin review panel
      if (isFlagged) {
        await setDoc(doc(db, 'flagged_items', commentId), {
          contentId: commentId,
          type: 'comment',
          postId: postId,
          authorId: currentUser.uid,
          authorName: userProfile?.name || 'Anonymous',
          content: newComment.trim(),
          category: flaggedCategory,
          reason: flaggedReason,
          createdAt: Date.now(),
          status: 'pending'
        });
      }
      
      if (postAuthorId !== currentUser.uid && !isFlagged) { // only notify on unflagged comments to prevent spam
        await setDoc(doc(collection(db, 'users', postAuthorId, 'notifications')), {
          type: 'comment',
          fromUserId: currentUser.uid,
          postId: postId,
          createdAt: Date.now(),
          read: false
        });
      }

      setNewComment('');
      clearCommentRecording();
      setShowEmojis(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    triggerHaptic(30);
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);
    try {
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) return;
        
        const newCount = Math.max(0, (postSnap.data().commentsCount || 0) - 1);
        
        transaction.delete(commentRef);
        transaction.update(postRef, { commentsCount: newCount });
      });
    } catch (e) {
      console.error(e);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0"
      >
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col h-[85vh] sm:h-[75vh] shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-center p-4.5 border-b border-slate-100 dark:border-slate-800 relative shrink-0">
            <h2 className="text-base font-extrabold select-none">Comments ({comments.length})</h2>
            <button onClick={onClose} className="absolute right-4 p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-755 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Comment list scrolled list */}
          <div className="flex-1 overflow-y-auto p-4.5 space-y-2 bg-slate-50/20 dark:bg-slate-950/20">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : comments.length > 0 ? (
              comments.map(c => (
                <CommentItem 
                  key={c.id} 
                  comment={c} 
                  postId={postId} 
                  onDelete={handleDeleteComment} 
                  onCommentUpdate={handleCommentUpdate}
                />
              ))
            ) : (
              <div className="text-center py-16 text-slate-400 font-bold text-xs select-none">
                No comments yet. Be the first to express!
              </div>
            )}
          </div>

          {/* Post active Voice Recording Status */}
          {isRecordingAudio && (
            <div className="px-4.5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-t border-red-500/20 shadow-lg">
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                 <p className="text-xs font-bold">{t("Recording...")} ({formatSeconds(recordingSeconds)})</p>
               </div>
               
               <button 
                 type="button" 
                 onClick={stopCommentRecording}
                 className="px-3.5 py-1.5 bg-[#D62828] text-white text-[10px] font-black rounded-full transition-transform active:scale-95 flex items-center gap-1"
               >
                 <StopCircle className="w-3.5 h-3.5" />
                 Stop
               </button>
            </div>
          )}

          {/* Micro Voice attachment review */}
          {audioPreviewUrl && !isRecordingAudio && (
            <div className="px-4.5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-850 flex items-center gap-2">
               <audio ref={previewAudioRef} src={audioPreviewUrl} onEnded={() => setIsPlayingPreview(false)} onPause={() => setIsPlayingPreview(false)} />
               <button
                 type="button"
                 onClick={togglePreviewPlay}
                 className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all text-xs"
               >
                  {isPlayingPreview ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
               </button>
               <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300">Voice comment ({formatSeconds(recordingSeconds)})</span>
               <button type="button" onClick={clearCommentRecording} className="ml-auto p-1.5 hover:text-[#D62828] rounded-full hover:bg-slate-100 transition-colors">
                  <X className="w-4.5 h-4.5" />
               </button>
            </div>
          )}

          {/* Sliding emoji tray inside comments modal footer */}
          <AnimatePresence>
            {showEmojis && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 overflow-hidden shrink-0"
              >
                <div className="flex gap-2.5 overflow-x-auto py-2.5 px-4.5 scrollbar-hide">
                   {EMOJIS.map(val => (
                     <button
                       type="button"
                       key={val}
                       onClick={() => setNewComment(prev => prev + val)}
                       className="text-2xl hover:scale-130 active:scale-90 select-none transition-transform p-1 cursor-pointer shrink-0"
                     >
                        {val}
                     </button>
                   ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input form */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
            <form onSubmit={handleCreateComment} className="flex items-center gap-2">
              <input 
                type="text" 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                disabled={isRecordingAudio}
                className="flex-1 px-4.5 py-3 rounded-full bg-slate-50 dark:bg-slate-800 border-none focus:ring-1 focus:ring-[#D62828] outline-none text-xs text-slate-900 dark:text-white"
              />
              
              <div className="flex items-center gap-1 shrink-0">
                {/* Voice Input icon */}
                <button
                  type="button"
                  onClick={startCommentRecording}
                  disabled={isRecordingAudio}
                  className={`p-2 rounded-full transition-colors text-slate-400 hover:text-[#D62828] hover:bg-slate-50 dark:hover:bg-slate-800 ${isRecordingAudio ? 'text-[#D62828] bg-rose-50' : ''}`}
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
                {/* Emoji tray toggle icon */}
                <button
                  type="button"
                  onClick={() => setShowEmojis(!showEmojis)}
                  className={`p-2 rounded-full transition-colors text-slate-400 hover:text-[#1E3A8A] hover:bg-slate-50 dark:hover:bg-slate-800 ${showEmojis ? 'text-[#1E3A8A] bg-blue-50' : ''}`}
                >
                  <Smile className="w-4.5 h-4.5" />
                </button>
              </div>

              <Button 
                type="submit" 
                disabled={(!newComment.trim() && !audioBlob) || isSubmitting || isRecordingAudio} 
                className="rounded-full px-5 h-9 bg-[#1E3A8A] hover:bg-opacity-90 text-white text-xs font-black shrink-0 transition-all"
              >
                Send
              </Button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
