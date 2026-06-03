import React, { useState, useEffect, useRef } from 'react';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserData } from '../hooks/useUserData';
import { doc, getDoc, deleteDoc, runTransaction, setDoc, collection, updateDoc, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, MoreHorizontal, Trash2, Edit2, Check, X, Share2, FileText, Link2, Youtube, ExternalLink, File, Globe } from 'lucide-react';
import { Button } from './ui/Button';
import { CommentsModal } from './CommentsModal';
import { ReactorsModal } from './ReactorsModal';
import { Link } from 'react-router-dom';
import { AudioPlayer } from './AudioPlayer';

import { triggerHaptic } from '../lib/haptic';

interface PostCardProps {
  key?: React.Key;
  post: Post;
  onDelete?: (postId: string) => void;
}

export function formatRelativeTime(date: number) {
  const now = Date.now();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) return years === 1 ? '1 year ago' : `${years} years ago`;
  if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`;
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'just now';
}

export function PostCard({ post, onDelete }: PostCardProps) {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const author = useUserData(post.authorId);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showFlaggedContent, setShowFlaggedContent] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleSharePost = async () => {
    if (!currentUser) return;
    setIsSharing(true);
    triggerHaptic(20);
    try {
      const originalAuthorName = author?.name || 'Student';
      const sharedPostData = {
        authorId: currentUser.uid,
        content: shareNote.trim(),
        postType: 'simple',
        likesCount: 0,
        commentsCount: 0,
        createdAt: Date.now(),
        // Core shared reference info
        sharedPostId: post.id,
        sharedPostAuthorId: post.authorId,
        sharedPostAuthorName: originalAuthorName,
        sharedPostContent: post.content || '',
        sharedPostMediaURL: post.mediaURL || '',
        sharedPostAudioURL: post.audioURL || ''
      };

      await addDoc(collection(db, 'posts'), sharedPostData);
      
      // Notify original post author
      if (post.authorId !== currentUser.uid) {
        const notiRef = doc(collection(db, 'users', post.authorId, 'notifications'));
        await setDoc(notiRef, {
          type: 'event',
          fromUserId: currentUser.uid,
          postId: post.id,
          createdAt: Date.now(),
          read: false,
          customTitle: `${currentUser.displayName || 'A classmate'} shared your post`,
          customMessage: shareNote.trim() || 'Shared your post with others.'
        });
      }
      
      setShowShareModal(false);
      setShareNote('');
    } catch (err: any) {
      console.error("Error sharing post: ", err);
      alert("Error sharing post: " + err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const [showReactionsPop, setShowReactionsPop] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);

  const REACTION_EMOJIS = [
    { emoji: '👍', label: 'Like' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Haha' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '🔥', label: 'Fire' }
  ];

  useEffect(() => {
    if (!currentUser) return;
    const checkUserReaction = async () => {
      try {
        const reactionRef = doc(db, 'reactions', `${post.id}_${currentUser.uid}`);
        const snap = await getDoc(reactionRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserReaction(data.emoji || '👍');
          setIsLiked(true);
        } else {
          // Fallback or double-check traditional likes subcollection
          const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
          const likeSnap = await getDoc(likeRef);
          if (likeSnap.exists()) {
            setUserReaction('❤️');
            setIsLiked(true);
          } else {
            setUserReaction(null);
            setIsLiked(false);
          }
        }
      } catch (err) {
        console.error('Error fetching reaction:', err);
      }
    };
    checkUserReaction();
  }, [post.id, currentUser]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowReactionsPop(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowReactionsPop(false);
    }, 400);
  };

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowReactionsPop(true);
    }, 400); // 400ms long press opens reaction bar
    setTouchTimeout(timer);
  };

  const handleTouchEnd = () => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
  };

  const handleReact = async (emoji: string | null) => {
    if (!currentUser) return;
    triggerHaptic(emoji ? [20, 10] : 15);
    const reactionRef = doc(db, 'reactions', `${post.id}_${currentUser.uid}`);
    const postRef = doc(db, 'posts', post.id);
    const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
    
    const previousReaction = userReaction;
    const previousLikesCount = likesCount;
    const previousIsLiked = isLiked;

    let targetLikesCount = previousLikesCount;
    let targetIsLiked = previousIsLiked;

    if (emoji === null) {
      targetIsLiked = false;
      if (previousReaction) {
        targetLikesCount = Math.max(0, previousLikesCount - 1);
      }
    } else {
      targetIsLiked = true;
      if (!previousReaction) {
        targetLikesCount = previousLikesCount + 1;
      }
    }

    // Optimistic state transitions
    setUserReaction(emoji);
    setIsLiked(targetIsLiked);
    setLikesCount(targetLikesCount);

    try {
      const batch = writeBatch(db);

      if (emoji === null) {
        // Remove reaction document
        batch.delete(reactionRef);
        // Remove traditional subcollection like document
        batch.delete(likeRef);
        // Update likesCount inside the same batched transaction
        batch.update(postRef, {
          likesCount: targetLikesCount
        });
      } else {
        // Create or update reaction representation
        batch.set(reactionRef, {
          userId: currentUser.uid,
          postId: post.id,
          emoji: emoji,
          createdAt: Date.now()
        });
        
        // Match standard likes subcollection
        batch.set(likeRef, {
          userId: currentUser.uid,
          createdAt: Date.now()
        });

        // Update likesCount atomically inside the batch
        batch.update(postRef, {
          likesCount: targetLikesCount
        });

        // Trigger in-app notifications atomically if needed
        if (post.authorId !== currentUser.uid && !previousReaction) {
          const notiRef = doc(collection(db, 'users', post.authorId, 'notifications'));
          batch.set(notiRef, {
            type: 'like',
            fromUserId: currentUser.uid,
            postId: post.id,
            createdAt: Date.now(),
            read: false
          });
        }
      }

      await batch.commit();
    } catch (e) {
      console.error('Failed to react:', e);
      // Rollback to secure consistent UI state on network failures
      setUserReaction(previousReaction);
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || currentUser.uid !== post.authorId) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      if (onDelete) onDelete(post.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUser || currentUser.uid !== post.authorId) return;
    if (editContent.trim() === post.content) {
      setIsEditing(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: editContent.trim()
      });
      post.content = editContent.trim(); // optimistic update
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to update post', e);
    }
  };

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 relative"
      >
        <div className="flex items-center gap-3 mb-3">
          <Link to={`/user/${post.authorId}`}>
            {author?.photoURL ? (
              <img src={author.photoURL} alt={author.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                {author?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </Link>
          
          <div className="flex-1">
            <Link to={`/user/${post.authorId}`} className="hover:underline">
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{author?.name || t('Loading...')}</p>
            </Link>
            <p className="text-[11px] text-slate-500 font-medium">{formatRelativeTime(post.createdAt)}</p>
          </div>
          
          {currentUser?.uid === post.authorId && (
            <div className="relative">
              <button 
                onClick={() => setShowOptions(!showOptions)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showOptions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute right-0 top-8 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-100 dark:border-slate-600 w-32 py-1 z-10"
                  >
                    <button 
                      onClick={() => { setIsEditing(true); setShowOptions(false); }}
                      className="w-full text-left px-4 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t("Edit")}
                    </button>
                    <button 
                      onClick={handleDelete}
                      className="w-full text-left px-4 py-2 flex items-center gap-2 text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("Delete")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {post.postType === 'showcase' && post.title && (
           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{post.title}</h3>
        )}

        {post.mediaURL && (
          <div className="mb-4 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-700">
            {post.mediaURL.includes('.mp4') ? (
              <video src={post.mediaURL} controls className="w-full h-auto max-h-[80vh] object-cover" />
            ) : (
              <img src={post.mediaURL} alt="Post media" className="w-full h-auto max-h-[80vh] object-cover" loading="lazy" />
            )}
          </div>
        )}

        {isEditing ? (
          <div className="mb-4">
            <textarea
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full dark:hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSaveEdit} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full dark:hover:bg-blue-900/30">
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          post.isFlagged && !showFlaggedContent ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] p-5 mb-4 select-none flex flex-col gap-3 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <span className="text-base font-bold">⚠️ Flagged Content Warning</span>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed font-semibold">
                This post is flagged according to 'Campus Connect' guidelines on standard category <span className="uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/10 rounded-md text-[10px] text-amber-800 dark:text-amber-300 font-extrabold">{post.flaggedCategory?.replace('_', ' ') || 'Content Rule'}</span>.
              </p>
              <p className="text-xs italic text-amber-600 dark:text-amber-400 font-medium">
                Reason: "{post.flaggedReason || 'Undergoing student community evaluation.'}"
              </p>
              <button
                type="button"
                onClick={() => setShowFlaggedContent(true)}
                className="mt-1 self-start text-xs font-black uppercase text-amber-750 hover:text-amber-800 dark:text-amber-400 dark:hover:text-[#FCA311] transition-colors"
              >
                [Disclose and view post content]
              </button>
            </div>
          ) : (
            <>
              <p className={`text-slate-800 dark:text-slate-200 mb-4 font-medium text-[15px] leading-relaxed whitespace-pre-wrap ${post.isFlagged ? 'bg-amber-500/5 border-l-2 border-amber-500/80 pl-3.5 py-2 rounded-r-2xl' : ''}`}>
                {post.content}
              </p>
              {post.isFlagged && (
                <div className="mb-4">
                  <span className="inline-block bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[9px] px-2.5 py-1 font-extrabold uppercase rounded-full tracking-widest select-none">
                    ⚠️ Auto-Flagged: {post.flaggedCategory?.replace('_', ' ')}
                  </span>
                </div>
              )}
            </>
          )
        )}

        {post.audioURL && (
          <div className="mb-4">
            <AudioPlayer src={post.audioURL} />
          </div>
        )}

        {post.attachmentType && (
          <div className="mb-4">
            {/* 1. Document files: PDF, Word, PowerPoint */}
            {(post.attachmentType === 'pdf' || post.attachmentType === 'word' || post.attachmentType === 'powerpoint') && (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors text-left">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                  {post.attachmentType === 'pdf' ? (
                    <FileText className="w-8 h-8 text-rose-500" />
                  ) : post.attachmentType === 'word' ? (
                    <File className="w-8 h-8 text-blue-500" />
                  ) : (
                    <File className="w-8 h-8 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                    {post.attachmentName || t("Document file")}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {post.attachmentType === 'pdf' ? t('PDF Slide/Document') : post.attachmentType === 'word' ? t('Word Document') : t('PowerPoint presentation')}
                  </p>
                </div>
                {post.attachmentURL && (
                  <a 
                    href={post.attachmentURL} 
                    download={post.attachmentName || `file.${post.attachmentType}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-full shadow-sm tracking-wider uppercase shrink-0 transition-colors"
                  >
                    {t("View")}
                  </a>
                )}
              </div>
            )}

            {/* 2. YouTube Links */}
            {post.attachmentType === 'youtube' && post.attachmentLink && (() => {
              const ytId = (() => {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\/\?v=|&v=)([^#&?]*).*/;
                const match = post.attachmentLink.match(regExp);
                return (match && match[2].length === 11) ? match[2] : null;
              })();

              return (
                <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/30 p-3.5 flex flex-col gap-3 text-left">
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs select-none">
                    <Youtube className="w-5 h-5 fill-current shrink-0" />
                    <span>YouTube Video</span>
                  </div>
                  {ytId ? (
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm border border-slate-200/50 dark:border-slate-800">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  ) : null}
                  <a 
                    href={post.attachmentLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 truncate pr-2">
                      <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{post.attachmentLink}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                  </a>
                </div>
              );
            })()}

            {/* 3. General Website Links */}
            {post.attachmentType === 'website' && post.attachmentLink && (
              <a 
                href={post.attachmentLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-indigo-50/20 dark:bg-slate-900/20 hover:bg-indigo-50/40 dark:hover:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800 text-left transition-colors"
              >
                <div className="p-2.5 bg-white dark:bg-slate-800 text-[#1E3A8A] dark:text-blue-400 rounded-xl shadow-sm shrink-0 border border-slate-100 dark:border-slate-700">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#1E3A8A] dark:text-blue-400">{t("Attached Website")}</span>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                    {post.attachmentName || t("Visit link")}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                    {post.attachmentLink}
                  </p>
                </div>
                <ExternalLink className="w-4.5 h-4.5 text-slate-400 shrink-0" />
              </a>
            )}
          </div>
        )}

        {post.sharedPostId && (
          <div className="mb-4 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 text-left relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {post.sharedPostAuthorName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{post.sharedPostAuthorName}</p>
                <p className="text-[9px] text-slate-400 font-medium">Original Post</p>
              </div>
            </div>
            {post.sharedPostContent && (
              <p className="text-xs text-slate-600 dark:text-slate-350 font-medium leading-relaxed mb-2 whitespace-pre-wrap">
                {post.sharedPostContent}
              </p>
            )}
            {post.sharedPostMediaURL && (
              <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 max-h-[300px] mb-2 border border-slate-200/25">
                {post.sharedPostMediaURL.includes('.mp4') ? (
                  <video src={post.sharedPostMediaURL} controls className="w-full h-auto max-h-[300px] object-cover" />
                ) : (
                  <img src={post.sharedPostMediaURL} alt="Shared media" className="w-full h-auto max-h-[300px] object-cover" loading="lazy" />
                )}
              </div>
            )}
            {post.sharedPostAudioURL && (
              <AudioPlayer src={post.sharedPostAudioURL} />
            )}
          </div>
        )}
        
        <div className="flex items-center gap-6 text-sm font-semibold text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-1">
          <div 
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Reactions Selector Popover */}
            <AnimatePresence>
              {showReactionsPop && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: -45, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl rounded-full px-3 py-2 flex gap-3.5 z-40"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {REACTION_EMOJIS.map((item, index) => (
                    <motion.button
                      key={item.emoji}
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 15, 
                        delay: index * 0.03 
                      }}
                      whileHover={{ scale: 1.4, y: -4, transition: { type: "spring", stiffness: 450, damping: 12 } }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        handleReact(item.emoji);
                        setShowReactionsPop(false);
                      }}
                      className="text-2xl filter hover:drop-shadow-md transition-all duration-150 focus:outline-none relative group/emoji"
                    >
                      {item.emoji}
                      
                      {/* Tooltip Label for better accessibility */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[10px] font-bold text-white bg-slate-900/90 dark:bg-slate-950/90 rounded-md opacity-0 group-hover/emoji:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none shadow-md border border-slate-800/20">
                        {t(item.label)}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Toggle & Reactors View Trigger */}
            <div className="flex items-center gap-1">
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLiked) {
                    handleReact(null);
                  } else {
                    handleReact('👍');
                  }
                }}
                className={`flex items-center transition-colors group ${isLiked ? 'text-[#D62828] dark:text-[#FCA5A5]' : 'hover:text-[#D62828]'}`}
              >
                <div className="p-1.5 rounded-full group-hover:bg-rose-50/50 dark:group-hover:bg-rose-500/10 transition-colors">
                  <motion.div 
                    animate={isLiked ? { scale: [1, 1.4, 1] } : { scale: 1 }} 
                    transition={isLiked ? { duration: 0.35, ease: "easeOut" } : { type: "spring", stiffness: 350, damping: 15 }}
                  >
                    {isLiked && userReaction ? (
                      <span className="text-xl leading-none select-none">{userReaction}</span>
                    ) : (
                      <Heart className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-[#D62828]" />
                    )}
                  </motion.div>
                </div>
              </motion.button>

              {likesCount > 0 ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReactors(true);
                  }}
                  className="text-[13px] font-bold select-none text-slate-600 dark:text-slate-300 hover:text-[#D62828] hover:underline"
                >
                  {likesCount}
                </button>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact('👍');
                  }}
                  className="text-[13px] font-bold select-none text-slate-600 dark:text-slate-300 hover:text-[#D62828]"
                >
                  {t('Like')}
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 hover:text-blue-500 transition-colors group">
            <div className="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </div>
            {post.commentsCount > 0 ? post.commentsCount : t('Comment')}
          </button>

          <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors group ml-auto">
            <div className="p-1.5 rounded-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
              <Share2 className="w-5 h-5" />
            </div>
            {t('Share')}
          </button>
        </div>
      </motion.div>
      <CommentsModal 
        isOpen={showComments} 
        onClose={() => setShowComments(false)} 
        postId={post.id} 
        postAuthorId={post.authorId} 
      />
      <ReactorsModal
        isOpen={showReactors}
        onClose={() => setShowReactors(false)}
        postId={post.id}
      />

      {/* Share Post Custom Prompt Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border border-slate-100 dark:border-slate-700/80 p-6 shadow-2xl overflow-hidden text-left"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-500" />
                  {t('Share Post')}
                </h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview target post being shared */}
              <div className="p-3.5 mb-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-[10px]">
                    {author?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{author?.name}</span>
                </div>
                {post.content && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                )}
                {post.mediaURL && (
                  <span className="text-[9px] font-bold text-indigo-500/80 block mt-1 uppercase tracking-wider">📷 Connected Media Attachment</span>
                )}
                {post.audioURL && (
                  <span className="text-[9px] font-bold text-[#E63946] block mt-1 uppercase tracking-wider">🎙️ Voice Note Recording Attached</span>
                )}
              </div>

              {/* Share Message Input */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t("Say something about this post...")}</label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder-slate-400"
                  rows={4}
                  placeholder={t("Say something about this post...")}
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowShareModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  {t('Cancel')}
                </Button>
                <Button 
                  onClick={handleSharePost}
                  disabled={isSharing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  {isSharing ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  {t('Share Now')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
