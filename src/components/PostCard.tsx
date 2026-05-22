import React, { useState, useEffect, useRef } from 'react';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../hooks/useUserData';
import { doc, getDoc, deleteDoc, runTransaction, setDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, MoreHorizontal, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import { CommentsModal } from './CommentsModal';
import { Link } from 'react-router-dom';

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
  const author = useUserData(post.authorId);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showOptions, setShowOptions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  useEffect(() => {
    if (!currentUser) return;
    const checkLike = async () => {
      const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
      const snap = await getDoc(likeRef);
      setIsLiked(snap.exists());
    };
    checkLike();
  }, [post.id, currentUser]);

  const handleToggleLike = async () => {
    if (!currentUser) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const tempSnap = await transaction.get(likeRef);
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) return;

        const pData = postSnap.data();
        let newCount = pData.likesCount || 0;

        if (tempSnap.exists()) {
          transaction.delete(likeRef);
          newCount = Math.max(0, newCount - 1);
          transaction.update(postRef, { likesCount: newCount });
        } else {
          transaction.set(likeRef, { userId: currentUser.uid, createdAt: Date.now() });
          newCount += 1;
          transaction.update(postRef, { likesCount: newCount });
        }
      });
      setIsLiked(!isLiked);
      setLikesCount((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1));
      
      if (!isLiked && post.authorId !== currentUser.uid) {
         await setDoc(doc(collection(db, 'users', post.authorId, 'notifications')), {
            type: 'like',
            fromUserId: currentUser.uid,
            postId: post.id,
            createdAt: Date.now(),
            read: false
         });
      }

    } catch (e) {
      console.error(e);
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
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{author?.name || 'Loading...'}</p>
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
                      Edit
                    </button>
                    <button 
                      onClick={handleDelete}
                      className="w-full text-left px-4 py-2 flex items-center gap-2 text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
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
          <p className="text-slate-800 dark:text-slate-200 mb-4 font-medium text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}
        
        <div className="flex items-center gap-6 text-sm font-semibold text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-1">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 transition-colors group ${isLiked ? 'text-rose-500' : 'hover:text-rose-500'}`}
          >
            <div className="p-1.5 rounded-full group-hover:bg-rose-50 dark:group-hover:bg-rose-500/10 transition-colors">
              <motion.div animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500' : ''}`} />
              </motion.div>
            </div>
            {likesCount > 0 ? likesCount : 'Like'}
          </motion.button>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 hover:text-blue-500 transition-colors group">
            <div className="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </div>
            {post.commentsCount > 0 ? post.commentsCount : 'Comment'}
          </button>
        </div>
      </motion.div>
      <CommentsModal 
        isOpen={showComments} 
        onClose={() => setShowComments(false)} 
        postId={post.id} 
        postAuthorId={post.authorId} 
      />
    </>
  );
}
