import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../hooks/useUserData';
import { Button } from './ui/Button';
import { X, Trash2 } from 'lucide-react';
import { Comment } from '../types';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postAuthorId: string;
}

function CommentItem({ comment, postId, onDelete }: { key?: React.Key, comment: Comment, postId: string, onDelete: (id: string) => void }) {
  const author = useUserData(comment.authorId);
  const { currentUser } = useAuth();
  
  return (
    <div className="flex gap-3 relative py-3 group">
      {author?.photoURL ? (
        <img src={author.photoURL} alt={author.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex items-center justify-center font-bold text-xs shrink-0">
          {author?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}
      <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-2xl rounded-tl-none">
        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">{author?.name || 'Loading...'}</h4>
        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{comment.content}</p>
        <span className="text-[10px] text-slate-400 mt-2 block">{new Date(comment.createdAt).toLocaleDateString()}</span>
      </div>
      {currentUser?.uid === comment.authorId && (
        <button 
          onClick={() => onDelete(comment.id)}
          className="absolute top-4 right-2 p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function CommentsModal({ isOpen, onClose, postId, postAuthorId }: CommentsModalProps) {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) return;
    const fetchComments = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [isOpen, postId]);

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    setIsSubmitting(true);
    
    const commentId = crypto.randomUUID();
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);

    try {
      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) throw new Error("Post not found");
        
        const newCount = (postSnap.data().commentsCount || 0) + 1;
        
        transaction.set(commentRef, {
          authorId: currentUser.uid,
          content: newComment.trim(),
          createdAt: Date.now()
        });
        
        transaction.update(postRef, { commentsCount: newCount });
      });
      
      if (postAuthorId !== currentUser.uid) {
        // notification
        await setDoc(doc(collection(db, 'users', postAuthorId, 'notifications')), {
          type: 'comment',
          fromUserId: currentUser.uid,
          postId: postId,
          createdAt: Date.now(),
          read: false
        });
      }

      setNewComment('');
      // Optimistic update
      setComments(prev => [...prev, { id: commentId, authorId: currentUser.uid, content: newComment.trim(), createdAt: Date.now() }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
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
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0"
      >
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col h-[85vh] sm:h-[70vh] shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-center p-4 border-b border-slate-100 dark:border-slate-700/50 relative shrink-0">
            <h2 className="text-lg font-bold">Comments</h2>
            <button onClick={onClose} className="absolute right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : comments.length > 0 ? (
              comments.map(c => <CommentItem key={c.id} comment={c} postId={postId} onDelete={handleDeleteComment} />)
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                No comments yet. Be the first to reply!
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 shrink-0 bg-white dark:bg-slate-800">
            <form onSubmit={handleCreateComment} className="flex gap-2">
              <input 
                type="text" 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-[#1E3A8A] outline-none text-sm"
              />
              <Button type="submit" disabled={!newComment.trim() || isSubmitting} className="rounded-full px-5 bg-[#1E3A8A] hover:bg-[#152C69] text-white">
                Send
              </Button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
