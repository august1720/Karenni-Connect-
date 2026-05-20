import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { PostCard } from '../components/PostCard';
import { uploadMedia } from '../lib/storage';
import { Image, X, Video, StopCircle } from 'lucide-react';

export default function Home() {
  const { userProfile, currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(postsQuery);
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(fetchedPosts);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setUploadProgress(0);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    stopCamera();
    setShowCamera(false);
  };

  const startCamera = async () => {
    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setShowCamera(true);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        setRecordingError('Camera or microphone permission was denied.');
      } else {
        setRecordingError('Could not access camera.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], 'recording.webm', { type: 'video/webm' });
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(blob));
      stopCamera();
      setShowCamera(false);
    };

    mediaRecorder.start();
    setIsRecording(true);
    
    // Auto stop after 15 seconds
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        stopRecording();
      }
    }, 15000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPostContent.trim() && !selectedImage) || !currentUser) return;
    
    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      let mediaURL = '';
      if (selectedImage) {
        mediaURL = await uploadMedia(selectedImage, `posts/${currentUser.uid}`, (progress) => {
          setUploadProgress(progress);
        });
      }

      const postId = crypto.randomUUID();
      const postRef = doc(db, 'posts', postId);
      await setDoc(postRef, {
        authorId: currentUser.uid,
        content: newPostContent.trim(),
        postType: 'simple',
        ...(mediaURL && { mediaURL }),
        likesCount: 0,
        commentsCount: 0,
        createdAt: Date.now()
      });
      setNewPostContent('');
      clearImage();
      fetchPosts();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
      setUploadProgress(-1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const stories = [
    { id: 1, name: "Moo Khu", grad: "from-[#D62828] to-[#1E3A8A]" },
    { id: 2, name: "Design", grad: "from-[#1E3A8A] to-blue-400" },
    { id: 3, name: "Loikaw", grad: "from-rose-400 to-[#D62828]" },
    { id: 4, name: "Coding", grad: "from-[#D62828] to-blue-500" },
    { id: 5, name: "Music", grad: "from-[#1E3A8A] to-[#D62828]" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="px-2 pt-4 flex justify-between items-center">
        <div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Good morning,</p>
          <h1 className="text-2xl font-bold tracking-tight">{userProfile?.name?.split(' ')[0] || 'Student'} 👋</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative">
          {userProfile?.photoURL ? (
            <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <>
              <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full blur-[1px]"></span>
            </>
          )}
        </div>
      </header>

      {/* Stories / Highlights */}
      <div className="px-1">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-1 snap-x">
          <div className="flex flex-col items-center gap-1.5 snap-center shrink-0">
            <div className="w-16 h-16 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm">
               <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">Add Story</span>
          </div>
          {stories.map(story => (
            <div key={story.id} className="flex flex-col items-center gap-1.5 snap-center shrink-0">
              <div className={`w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr ${story.grad}`}>
                <div className="w-full h-full rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="w-full h-full bg-white dark:bg-slate-700 opacity-50"></div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{story.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <form onSubmit={handleCreatePost} className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 mx-1">
        {uploadProgress === -1 && (
           <div className="bg-red-50 text-red-600 p-2 rounded-xl text-xs font-medium mb-3">Failed to post. Permission denied or error occurred.</div>
        )}
        <div className="flex gap-3 items-start">
          {userProfile?.photoURL ? (
            <img src={userProfile.photoURL} alt="Profile" className="w-10 h-10 rounded-full object-cover shrink-0 shadow-inner" />
          ) : (
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center text-white font-bold shadow-inner">
              {userProfile?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
          )}
          <div className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent resize-none border-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none font-medium text-base pt-2"
              rows={2}
            />
          </div>
        </div>
        
        {showCamera && (
          <div className="relative mt-2 mb-3 mr-2 ml-12 rounded-xl overflow-hidden bg-black">
            <video ref={liveVideoRef} autoPlay playsInline muted className="w-full max-h-64 object-cover" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button type="button" onClick={stopCamera} className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {recordingError && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-xs p-4 text-center">{recordingError}</div>}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              {!isRecording ? (
                <button type="button" onClick={startRecording} className="w-12 h-12 bg-rose-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                </button>
              ) : (
                <button type="button" onClick={stopRecording} className="w-12 h-12 bg-white rounded-full border-4 border-rose-500 shadow-lg flex items-center justify-center animate-pulse">
                  <StopCircle className="w-6 h-6 text-rose-500" />
                </button>
              )}
            </div>
          </div>
        )}

        {imagePreview && !showCamera && (
          <div className="relative mt-2 mb-3 mr-2 ml-12">
            {selectedImage?.type.includes('video') ? (
              <video src={imagePreview} controls className="rounded-xl w-full max-h-64 object-cover bg-black" />
            ) : (
              <img src={imagePreview} alt="Preview" className="rounded-xl w-full max-h-64 object-cover" />
            )}
            <button type="button" onClick={clearImage} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex gap-1 ml-10">
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-[#D62828] rounded-full hover:bg-[#D62828]/10 transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button type="button" onClick={startCamera} className="p-2 text-slate-400 hover:text-[#D62828] rounded-full hover:bg-[#D62828]/10 transition-colors">
              <Video className="w-5 h-5" />
            </button>
          </div>
          <Button type="submit" size="sm" disabled={(!newPostContent.trim() && !selectedImage) || isSubmitting} className="rounded-full px-5 h-9 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white hover:opacity-90 shadow-sm text-sm border-0 disabled:opacity-50 min-w-[5rem]">
            {isSubmitting ? (uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : 'Posting...') : 'Post'}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-[#1E3A8A] dark:border-white border-t-transparent animate-spin"></div>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-5 mx-1">
          <AnimatePresence>
            {posts.map(post => (
              <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm mx-1">
          <p className="text-slate-500 font-medium">No updates yet.</p>
        </div>
      )}
    </div>
  );
}
