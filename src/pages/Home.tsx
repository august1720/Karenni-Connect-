import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, addDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { PostCard } from '../components/PostCard';
import { uploadMedia } from '../lib/storage';
import { checkContentModeration } from '../lib/moderation';
import { X, StopCircle, RefreshCw, Search, Mic, Smile, Trash2, Play, Pause, Bell, CircleAlert, Paperclip, Link2, Globe, FileText, Youtube, File } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationsModal } from '../components/NotificationsModal';
import { GroupDetailsModal } from '../components/GroupDetailsModal';
import { triggerHaptic } from '../lib/haptic';

const FeedCardSkeleton = () => (
  <div className="flex flex-col p-5 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm gap-4 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-1.5">
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-16 rounded bg-slate-150 dark:bg-slate-700/40" />
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-750" />
    </div>
    
    <div className="space-y-2 py-1">
      <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3.5 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3.5 w-2/3 rounded bg-slate-150 dark:bg-slate-700/40" />
    </div>

    <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-700/20">
      <div className="flex gap-4">
        <div className="h-6 w-12 rounded-full bg-slate-100 dark:bg-slate-700" />
        <div className="h-6 w-12 rounded-full bg-slate-100 dark:bg-slate-700" />
      </div>
      <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-700" />
    </div>
  </div>
);

export default function Home() {
  const { userProfile, currentUser } = useAuth();
  const { t } = useLanguage();
  
  const getGreetingKey = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "Good morning,";
    } else if (hour >= 12 && hour < 17) {
      return "Good afternoon,";
    } else if (hour >= 17 && hour < 22) {
      return "Good evening,";
    } else {
      return "Good night,";
    }
  };

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Audio Voice recording states
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

  // File upload and link sharing states
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileType, setPendingFileType] = useState<'pdf' | 'word' | 'powerpoint' | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLinkInput, setShowLinkInput] = useState(false);
  const [attachedLink, setAttachedLink] = useState('');
  const [detectedLinkType, setDetectedLinkType] = useState<'youtube' | 'website' | ''>('');

  // Emojis
  const [showEmojis, setShowEmojis] = useState(false);
  const EMOJIS = [
    '😂', '❤️', '👍', '🔥', '😍', '🙌', '👏', '🎉', '🚀', '💡', '😢', '😡', '✨', '🎤', '🇲🇲', '📍',
    '😊', '🥰', '🤔', '😎', '🤩', '🥳', '🥺', '😭', '🤯', '🥱', '😴', '💀', '💩', '👑', '💯', '🌟',
    '🐱', '🐶', '🦊', '🐼', '🦖', '🍎', '🍕', '☕', '🥤', '📚', '📖', '💻', '🎓', '🏆', '🎯', '🎈',
    '🎁', '💬', '📢', '🔔', '💖', '🍀', '🌈', '⚡', '💪', '🤝', '🫡', '🙏', '🫠', '✍️', '📝'
  ];

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotiOpen, setIsNotiOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [stories, setStories] = useState<any[]>([]);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingStory, setIsUploadingStory] = useState(false);

  const navigate = useNavigate();
  const [authorsMap, setAuthorsMap] = useState<Record<string, any>>({});
  const [matchedUsers, setMatchedUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [matchedGroups, setMatchedGroups] = useState<any[]>([]);
  const [searchingGroups, setSearchingGroups] = useState(false);
  const [selectedSearchGroup, setSelectedSearchGroup] = useState<any | null>(null);
  const [myMemberships, setMyMemberships] = useState<Record<string, boolean>>({});

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(postsQuery);
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      // Resolve authors for filtering
      const uniqueAuthorIds = Array.from(new Set(fetchedPosts.map(p => p.authorId)));
      const resolvedAuthors: Record<string, any> = {};
      await Promise.all(
        uniqueAuthorIds.map(async (authorId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', authorId));
            if (userDoc.exists()) {
              resolvedAuthors[authorId] = userDoc.data();
            }
          } catch (e) {
            console.error("Error fetching author details:", e);
          }
        })
      );
      setAuthorsMap(resolvedAuthors);
      setPosts(fetchedPosts);

      const storiesQuery = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(15));
      const storiesSnapshot = await getDocs(storiesQuery);
      setStories(storiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error("Firestore Loading issues captured gracefully:", err);
      setConnectionError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Listen to unread notifications counts in real-time
  useEffect(() => {
    if (!currentUser) return;
    const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
    const unsubscribe = onSnapshot(notificationsRef, (snap) => {
      const unread = snap.docs.filter(d => !d.data().read);
      setUnreadCount(unread.length);
    }, (err) => {
      console.error("Notifications real-time snapshot warning:", err);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedUsers([]);
      setMatchedGroups([]);
      return;
    }
    
    const searchAll = async () => {
      setSearchingUsers(true);
      setSearchingGroups(true);
      try {
        const lowerQuery = searchQuery.toLowerCase().trim();

        // 1. Search Users
        const usersSnap = await getDocs(collection(db, 'users'));
        const fetchedUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredUsers = fetchedUsers.filter((u: any) => 
          u.name?.toLowerCase().includes(lowerQuery) || 
          u.username?.toLowerCase().includes(lowerQuery)
        );
        setMatchedUsers(filteredUsers);

        // 2. Search Schools/Groups
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        const fetchedGroups = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredGroups = fetchedGroups.filter((s: any) => 
          s.name?.toLowerCase().includes(lowerQuery) || 
          (s.description && s.description.toLowerCase().includes(lowerQuery))
        );
        setMatchedGroups(filteredGroups);

        // 3. Resolve user memberships to highlight joined status
        if (currentUser && filteredGroups.length > 0) {
          const joins: Record<string, boolean> = {};
          await Promise.all(filteredGroups.map(async (g) => {
            const snapCheck = await getDoc(doc(db, 'schools', g.id, 'members', currentUser.uid));
            if (snapCheck.exists()) {
              joins[g.id] = true;
            }
          }));
          setMyMemberships(joins);
        }
      } catch (err) {
        console.error("Error searching users and groups:", err);
      } finally {
        setSearchingUsers(false);
        setSearchingGroups(false);
      }
    };

    const timer = setTimeout(() => {
      searchAll();
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  useEffect(() => {
    fetchPosts();
    
    const handleRefresh = () => {
      fetchPosts();
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
    };
  }, []);

  // Voice recording handlers
  const startAudioRecording = async () => {
    triggerHaptic([30, 40]);
    try {
      setRecordingError(null);
      setAudioBlob(null);
      setAudioPreviewUrl(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      // Determine mimeType
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // defaults to browser average
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
        // releases microphone properly
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      audioIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Voice recording access error:", err);
      setRecordingError(t("Could not access microphone. Ensure hardware is enabled."));
    }
  };

  const stopAudioRecording = () => {
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

  const clearAudioRecording = () => {
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

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, []);

  const handleStoryImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      setIsUploadingStory(true);
      try {
        // Read file as Base64 to moderate the image before uploading
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;

        // Perform Gemini content moderation scan
        const mod = await checkContentModeration("Campus Story Image upload.", base64Data);
        if (mod.isHarmful && mod.flag === 'flag_block') {
          alert(`Safety Block:\n\n${mod.reason || 'This story media violates Campus Connect safety guidelines.'}`);
          setIsUploadingStory(false);
          return;
        }

        const isFlagged = mod.isHarmful;
        const flaggedReason = mod.reason;
        const flaggedCategory = mod.category;

        const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(uploadResult.ref);
        
        const storyId = crypto.randomUUID();
        await setDoc(doc(db, 'stories', storyId), {
          id: storyId,
          authorId: currentUser.uid,
          authorName: userProfile?.name || 'User',
          imageUrl: imageUrl,
          createdAt: Date.now(),
          isFlagged,
          flaggedReason,
          flaggedCategory,
          moderationStatus: isFlagged ? 'flagged' : 'approved'
        });

        // If borderline flagged, set up automatic flagging for admin review
        if (isFlagged) {
          await setDoc(doc(db, 'flagged_items', storyId), {
            contentId: storyId,
            type: 'story',
            authorId: currentUser.uid,
            authorName: userProfile?.name || 'User',
            content: "Story Image Upload",
            imageUrl: imageUrl,
            category: flaggedCategory,
            reason: flaggedReason,
            createdAt: Date.now(),
            status: 'pending'
          });
        }
        
        await fetchPosts();
      } catch (err: any) {
        console.error(err);
        alert('Failed to upload story');
      } finally {
        setIsUploadingStory(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 800 * 1024; // 800KB for Firestore safe size
    if (file.size > MAX_SIZE) {
      alert(t("File is too large! Please choose a file smaller than 800 KB so it can be uploaded successfully."));
      return;
    }

    const nameLower = file.name.toLowerCase();
    let type: 'pdf' | 'word' | 'powerpoint' | '' = '';
    if (nameLower.endsWith('.pdf')) {
      type = 'pdf';
    } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx')) {
      type = 'word';
    } else if (nameLower.endsWith('.ppt') || nameLower.endsWith('.pptx')) {
      type = 'powerpoint';
    } else {
      alert(t("Unsupported file format. Please upload PDF, Word, or PowerPoint files only."));
      return;
    }

    setPendingFile(file);
    setPendingFileType(type);
    
    // Clear other attachments to keep one rich attachment
    setAttachedLink('');
    setDetectedLinkType('');
    setShowLinkInput(false);
  };

  const handleLinkChange = (val: string) => {
    setAttachedLink(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setDetectedLinkType('');
      return;
    }
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      setDetectedLinkType('youtube');
    } else {
      setDetectedLinkType('website');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPostContent.trim() && !audioBlob && !pendingFile && !attachedLink.trim()) || !currentUser) return;
    triggerHaptic(20);
    
    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      // 1. Run AI Moderator
      let isFlagged = false;
      let flaggedReason = '';
      let flaggedCategory = '';

      if (newPostContent.trim()) {
        const mod = await checkContentModeration(newPostContent.trim());
        if (mod.isHarmful) {
          if (mod.flag === 'flag_block') {
            alert(`Guidelines Warning:\n\nYour post could not be published because it was detected to violate our Community guidelines on ${mod.category.replace('_', ' ')}:\n\n"${mod.reason}"`);
            setIsSubmitting(false);
            return;
          } else {
            // Under borderline warning, allow but flag automatically
            isFlagged = true;
            flaggedReason = mod.reason;
            flaggedCategory = mod.category;
          }
        }
      }

      let audioURL = '';
      if (audioBlob) {
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        audioURL = await uploadMedia(file, `posts/${currentUser.uid}`, (progress) => {
          setUploadProgress(progress);
        });
      }

      let attachmentURL = '';
      let attachmentName = '';
      let attachmentType = '';
      let attachmentLink = '';

      if (pendingFile) {
        attachmentName = pendingFile.name;
        attachmentType = pendingFileType;
        attachmentURL = await uploadMedia(pendingFile, `posts/${currentUser.uid}/attachments`, (progress) => {
          setUploadProgress(progress);
        });
      } else if (attachedLink.trim()) {
        attachmentLink = attachedLink.trim();
        attachmentType = detectedLinkType;
        attachmentName = detectedLinkType === 'youtube' ? 'YouTube' : 'Website';
      }

      const postId = crypto.randomUUID();
      const postRef = doc(db, 'posts', postId);
      await setDoc(postRef, {
        authorId: currentUser.uid,
        content: newPostContent.trim(),
        postType: 'simple',
        ...(audioURL && { audioURL }),
        ...(attachmentURL && { attachmentURL }),
        ...(attachmentName && { attachmentName }),
        ...(attachmentType && { attachmentType }),
        ...(attachmentLink && { attachmentLink }),
        likesCount: 0,
        commentsCount: 0,
        createdAt: Date.now(),
        isFlagged,
        flaggedReason,
        flaggedCategory,
        moderationStatus: isFlagged ? 'flagged' : 'approved'
      });

      // Register borderline infraction for admin evaluation
      if (isFlagged) {
        await setDoc(doc(db, 'flagged_items', postId), {
          contentId: postId,
          type: 'post',
          authorId: currentUser.uid,
          authorName: userProfile?.name || 'Anonymous',
          content: newPostContent.trim(),
          category: flaggedCategory,
          reason: flaggedReason,
          createdAt: Date.now(),
          status: 'pending'
        });
      }

      setNewPostContent('');
      clearAudioRecording();
      setPendingFile(null);
      setPendingFileType('');
      setAttachedLink('');
      setDetectedLinkType('');
      setShowLinkInput(false);
      fetchPosts();
    } catch (err: any) {
      alert("Post error: " + (err.message || String(err)));
      handleFirestoreError(err, OperationType.CREATE, 'posts');
      setUploadProgress(-1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    triggerHaptic(30);
    setPosts(posts.filter(p => p.id !== postId));
  };

  const filteredPosts = posts.filter(post => {
    const author = authorsMap[post.authorId];
    const authorName = author?.name?.toLowerCase() || '';
    const authorUsername = author?.username?.toLowerCase() || '';
    const query = searchQuery.toLowerCase().trim();
    
    return post.content.toLowerCase().includes(query) || 
      authorName.includes(query) || 
      authorUsername.includes(query);
  });

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col gap-6 relative">
      
      {/* Connection Error / Offline Helpful Alert */}
      {connectionError && (
        <div className="mx-2 p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500/30 rounded-2xl text-slate-800 dark:text-slate-200 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
              Firebase Firestore အော့ဖ်လိုင်း/မချိတ်ဆက်နိုင်ပါ
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            အောက်ပါ အဆင့် ၃ ဆင့်ကို လုပ်ဆောင်ပေးရန် လိုအပ်ပါသည် -
          </p>
          <ol className="text-[11px] list-decimal pl-4.5 space-y-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <li>
              <strong>Firestore database ဆောက်ရန်</strong>: Firebase Console သို့သွားပြီး Left menu ရှိ <strong className="text-amber-600">Firestore Database</strong> ကိုနှိပ်ပါ။ <strong className="text-amber-600">Create database</strong> ကိုနှိပ်၍ select လုပ်ပြီး ဖွင့်ရပါမည်။
            </li>
            <li>
              <strong>GCP API Key restriction စစ်ရန်</strong>: Google Cloud Console Credentials တွင် <strong className="text-amber-600">Browser key (auto created by Firebase)</strong> ကိုနှိပ်ပြီး "Cloud Firestore API" ကို restrict မလုပ်ထားဘဲ enable လုပ်ရန် လိုအပ်ပါသည်။
            </li>
            <li>
              <strong>Authorized Domains (Domain ခွင့်ပြုချက်)</strong>: Firebase Authentication settings &gt; <strong className="text-amber-600">Authorized Domains</strong> တွင် ယခု preview app link domain ကို list ထဲသို့ ထည့်သွင်းပေးရပါမည်။
            </li>
          </ol>
          <div className="pt-1 select-all">
            <code className="text-[10px] font-mono block p-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-500 overflow-x-auto max-h-16">
              Error details: {connectionError}
            </code>
          </div>
        </div>
      )}
      
      {/* Dynamic Header */}
      <header className="px-2 pt-4 flex justify-between items-center">
        <div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{t(getGreetingKey())}</p>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">{userProfile?.name?.split(' ')[0] || t('Student')} 👋</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Functional Notification Bell */}
          <button 
            type="button"
            onClick={() => setIsNotiOpen(true)}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center relative hover:scale-105 active:scale-95 transition-all text-slate-700 dark:text-slate-300"
          >
            <motion.div
              animate={unreadCount > 0 ? {
                scale: [1, 1.15, 1],
                rotate: [0, -8, 8, -8, 8, 0]
              } : {}}
              transition={unreadCount > 0 ? {
                repeat: Infinity,
                duration: 2.2,
                ease: "easeInOut"
              } : {}}
              className="flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
            </motion.div>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 bg-[#D62828] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-850 animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative cursor-pointer hover:border-[#D62828] transition-colors"
          >
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm">
                {userProfile?.name?.charAt(0).toUpperCase() || 'S'}
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Search Bar */}
      <div className="px-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700/50 rounded-2xl leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 sm:text-sm shadow-sm transition-all"
            placeholder={t("Search posts, people, or events...")}
          />
        </div>
      </div>

      {searchQuery.trim() && (
        <div className="px-2 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 select-none">
              {t("People")} {searchingUsers ? "..." : `(${matchedUsers.length})`}
            </h3>
            {searchingUsers ? (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-1.5 p-3.5 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm shrink-0 w-24 animate-pulse select-none">
                    <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="h-2.5 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                ))}
              </div>
            ) : matchedUsers.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {matchedUsers.map(user => (
                  <div 
                    key={user.id} 
                    onClick={() => navigate(`/user/${user.id}`)}
                    className="flex flex-col items-center gap-1.5 p-3.5 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm shrink-0 cursor-pointer hover:border-[#D62828]/50 dark:hover:border-[#D62828]/50 transition-colors w-24 text-center snap-center animate-fade-in"
                  >
                    {user.photoURL ? (
                      <img referrerPolicy="no-referrer" src={user.photoURL} alt={user.name} className="w-11 h-11 rounded-full object-cover shadow-sm bg-slate-50" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center text-white font-bold shadow-sm text-sm">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate w-full">
                      {user.name}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold truncate w-full uppercase tracking-wider">
                      @{user.username || 'user'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1 select-none">{t("No users match your search.")}</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 select-none">
              {t("Study Spaces")} {searchingGroups ? "..." : `(${matchedGroups.length})`}
            </h3>
            {searchingGroups ? (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[1, 2].map((n) => (
                  <div key={n} className="flex-1 min-w-[200px] h-24 bg-white dark:bg-slate-800 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-700/50 animate-pulse shrink-0" />
                ))}
              </div>
            ) : matchedGroups.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
                {matchedGroups.map(group => {
                  const joined = !!myMemberships[group.id];
                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedSearchGroup(group)}
                      className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 hover:border-[#D62828]/50 dark:border-slate-700/50 dark:hover:border-[#D62828]/50 shadow-sm shrink-0 cursor-pointer transition-colors w-52 snap-center h-28 relative overflow-hidden group animate-fade-in"
                    >
                      {group.photoURL ? (
                        <div className="absolute top-0 right-0 w-16 h-16 opacity-10 dark:opacity-20 translate-x-3 -translate-y-3 rounded-full overflow-hidden">
                          <img src={group.photoURL} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-tr ${group.themeGradient} opacity-20 translate-x-3 -translate-y-3 rounded-full blur-[2px]`} />
                      )}

                      <div className="space-y-0.5 z-10 relative">
                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-[#D62828] transition-colors truncate pr-3">
                          {group.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                          {group.description || t("No group description provided.")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-auto z-10 relative">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                          {group.studentCount || 0} {t("Members")}
                        </span>
                        {joined && (
                          <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                            {t("Joined")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1 select-none">
                {t("No study groups match your search.")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stories / Highlights */}
      <div className="px-1">
        <input type="file" ref={storyFileInputRef} hidden accept="image/*" onChange={handleStoryImageSelect} />
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-1 snap-x">
          <div className="flex flex-col items-center gap-1.5 snap-center shrink-0 cursor-pointer" onClick={() => storyFileInputRef.current?.click()}>
            <div className={`w-16 h-16 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm ${isUploadingStory ? 'opacity-50 animate-pulse' : ''}`}>
               <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">{isUploadingStory ? t('Uploading...') : t('Add Story')}</span>
          </div>
          {stories.map(story => (
            <div key={story.id} className="flex flex-col items-center gap-1.5 snap-center shrink-0" title={story.isFlagged ? `Flagged: ${story.flaggedReason}` : undefined}>
              <div className={`w-16 h-16 rounded-full p-[2px] ${story.isFlagged ? 'bg-red-500' : 'bg-gradient-to-tr from-[#D62828] to-[#1E3A8A]'}`}>
                <div className="w-full h-full rounded-full border-2 border-white dark:border-slate-900 overflow-hidden relative">
                  <img src={story.imageUrl} alt="Story" className={`w-full h-full object-cover ${story.isFlagged ? 'blur-[3px] brightness-[0.6]' : ''}`} />
                  {story.isFlagged && (
                    <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center cursor-help" onClick={() => alert(`Content Flagged:\n\nThis photo story is flagged for administrator review because it triggered our safety guidelines on ${story.flaggedCategory?.replace('_', ' ') || 'Content Rule'}.\n\nReason: "${story.flaggedReason || 'Under safety review'}"`)}>
                      <span className="text-white text-[10px] font-bold">⚠️</span>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                {story.authorName?.split(' ')[0] || 'User'}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Restructured Post Creation Box (Voice, Emoji, Text, Documents & Link attachments) */}
      <form onSubmit={handleCreatePost} className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[2.5rem] p-5 shadow-inner border border-slate-200/60 dark:border-slate-700/30 mx-1 backdrop-blur-sm">
        {uploadProgress === -1 && (
           <div className="bg-red-50 text-red-600 p-2 rounded-xl text-xs font-medium mb-3">{t("Failed to post. Permission denied or error occurred.")}</div>
        )}
        
        {/* Hidden Document Picker */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.ppt,.pptx" 
        />

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
              placeholder={t("What's on your mind?")}
              className="w-full bg-transparent resize-none border-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none font-medium text-base pt-2 focus:outline-none"
              rows={2}
            />
          </div>
        </div>
        
        {/* Dynamic Voice Recording / Wave UI */}
        {isRecordingAudio && (
          <div className="relative mt-3 mb-4 mr-2 ml-12 bg-slate-900/90 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg border border-red-500/20">
             <div className="flex items-center gap-3">
               <span className="w-3 h-3 bg-[#D62828] rounded-full animate-ping"></span>
               <span className="text-sm font-bold tracking-wider text-rose-100">{t("Recording...")} ({formatSeconds(recordingSeconds)})</span>
             </div>
             
             {/* Visual frequency waveform indicators */}
             <div className="flex items-end gap-1 h-8 px-4 flex-1 justify-center max-w-[150px]">
               {Array.from({ length: 8 }).map((_, idx) => (
                 <span 
                   key={idx} 
                   className="w-[3px] bg-rose-500 rounded-full animate-pulse" 
                   style={{ 
                     height: `${Math.floor(Math.random() * 85) + 15}%`,
                     animationDuration: `${0.4 + (idx * 0.1)}s` 
                   }}
                 />
               ))}
             </div>
             
             <button 
               type="button" 
               onClick={stopAudioRecording}
               className="h-9 px-4.5 bg-[#D62828] hover:bg-rose-700 text-white rounded-full text-xs font-black transition-transform active:scale-95 flex items-center gap-1.5 shadow-md"
             >
               <StopCircle className="w-4 h-4" />
               Stop
             </button>
          </div>
        )}

        {recordingError && (
          <div className="mt-2 mb-3 mr-2 ml-12 flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl text-xs font-bold leading-relaxed border border-rose-100 dark:border-rose-950/30">
            <CircleAlert className="w-4 h-4 shrink-0" />
            <span>{recordingError}</span>
            <button type="button" onClick={() => setRecordingError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
               <X className="w-4 h-4" />
             </button>
          </div>
        )}

        {/* Local Playback Preview for Voice note */}
        {audioPreviewUrl && !isRecordingAudio && (
          <div className="relative mt-3 mb-4 mr-2 ml-12 bg-slate-100/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-inner">
             <audio 
               ref={previewAudioRef} 
               src={audioPreviewUrl} 
               onEnded={() => setIsPlayingPreview(false)} 
               onPause={() => setIsPlayingPreview(false)} 
             />
             <button
               type="button"
               onClick={togglePreviewPlay}
               className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow active:scale-95 transition-all hover:bg-black"
             >
                {isPlayingPreview ? <Pause className="w-4.5 h-4.5 fill-current" /> : <Play className="w-4.5 h-4.5 fill-current ml-0.5" />}
             </button>
             <div className="flex-1">
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Voice Note Attachment</p>
                <p className="text-[10px] text-slate-400 font-semibold">{formatSeconds(recordingSeconds)} seconds captured</p>
             </div>
             
             <button 
               type="button" 
               onClick={clearAudioRecording}
               className="p-2 text-slate-400 hover:text-[#D62828] hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors"
               title="Discard audio"
             >
                <Trash2 className="w-4.5 h-4.5" />
             </button>
          </div>
        )}

        {/* Local Document Attachment Preview */}
        {pendingFile && (
          <div className="relative mt-3 mb-4 mr-2 ml-12 bg-indigo-50/50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-slate-800 flex items-center gap-3.5 shadow-inner">
            {pendingFileType === 'pdf' ? (
              <FileText className="w-8 h-8 text-rose-500 shrink-0" />
            ) : pendingFileType === 'word' ? (
              <File className="w-8 h-8 text-blue-500 shrink-0" />
            ) : (
              <File className="w-8 h-8 text-amber-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{pendingFile.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {pendingFileType === 'pdf' ? 'PDF File' : pendingFileType === 'word' ? 'Word Document' : 'PowerPoint presentation'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setPendingFile(null); setPendingFileType(''); }}
              className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-full transition-colors"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        )}

        {/* Link Attachment Input Panel */}
        {showLinkInput && (
          <div className="relative mt-3 mb-4 mr-2 ml-12 bg-slate-100/60 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {detectedLinkType === 'youtube' ? (
                <Youtube className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-[#1E3A8A] dark:text-blue-400 shrink-0" />
              )}
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                {detectedLinkType === 'youtube' ? t('YouTube Attachment Link') : t('Website Attachment Link')}
              </span>
              {attachedLink.trim() && (
                <button
                  type="button"
                  onClick={() => { setAttachedLink(''); setDetectedLinkType(''); }}
                  className="ml-auto text-[10px] text-rose-500 font-bold hover:underline"
                >
                  {t('Clear')}
                </button>
              )}
            </div>
            <input
              type="url"
              value={attachedLink}
              onChange={(e) => handleLinkChange(e.target.value)}
              placeholder={t("Paste website URL or YouTube watch link...")}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        )}

        {/* Collapsible Emojis drawer */}
        <AnimatePresence>
          {showEmojis && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative mt-3 mr-2 ml-12 overflow-hidden"
            >
              <div className="flex gap-2.5 overflow-x-auto py-2.5 pb-3 px-1.5 scrollbar-hide snap-x">
                 {EMOJIS.map((emoji) => (
                    <motion.button
                      type="button"
                      key={emoji}
                      whileHover={{ scale: 1.25 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setNewPostContent((prev) => prev + emoji)}
                      className="text-2xl filter hover:drop-shadow-md select-none shrink-0 cursor-pointer p-1"
                    >
                      {emoji}
                    </motion.button>
                 ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer controls for creating post */}
        <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex gap-1 bg-slate-100/50 dark:bg-slate-800/40 p-1 rounded-full ml-10">
            {/* Audio Recording Toggle */}
            <button 
              type="button" 
              onClick={startAudioRecording} 
              disabled={isRecordingAudio}
              className={`p-2 rounded-full transition-all duration-350 hover:bg-[#D62828]/10 text-slate-400 hover:text-[#D62828] ${isRecordingAudio ? 'text-[#D62828] bg-[#D62828]/15 scale-105 shadow-inner' : ''}`}
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Document upload trigger */}
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className={`p-2 rounded-full transition-all duration-350 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 ${pendingFile ? 'text-rose-500 bg-rose-500/15' : ''}`}
              title="Upload PDF, Word, or PowerPoint file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Paste website or YouTube link */}
            <button 
              type="button" 
              onClick={() => {
                setShowLinkInput(!showLinkInput);
                if (!showLinkInput) {
                  setPendingFile(null);
                  setPendingFileType('');
                }
              }} 
              className={`p-2 rounded-full transition-all duration-350 hover:bg-[#1E3A8A]/10 text-slate-400 hover:text-[#1E3A8A] ${showLinkInput || attachedLink.trim() ? 'text-[#1E3A8A] bg-[#1E3A8A]/10' : ''}`}
              title="Attach website or YouTube link"
            >
              <Link2 className="w-5 h-5" />
            </button>

            {/* Show Emoji picker Toggle */}
            <button 
              type="button" 
              onClick={() => setShowEmojis(!showEmojis)} 
              className={`p-2.5 rounded-full transition-all duration-350 hover:bg-[#1E3A8A]/10 text-slate-400 hover:text-[#1E3A8A] ${showEmojis ? 'text-[#1E3A8A] bg-[#1E3A8A]/10' : ''}`}
              title="Select emojis"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <Button 
            type="submit" 
            size="sm" 
            disabled={(!newPostContent.trim() && !audioBlob && !pendingFile && !attachedLink.trim()) || isSubmitting || isRecordingAudio} 
            className="rounded-full px-5.5 h-9.5 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white hover:opacity-95 hover:scale-[1.02] shadow-sm text-xs font-black border-0 disabled:opacity-50 transition-all min-w-[5.5rem]"
          >
            {isSubmitting ? (uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : t('Posting...')) : t('Post')}
          </Button>
        </div>
      </form>

      {/* Feed listing */}
      {loading ? (
        <div className="space-y-4">
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-5 mx-1">
          <AnimatePresence>
            {filteredPosts.map(post => (
              <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 shadow-sm mx-1">
          <p className="text-slate-500 font-medium">{t("No updates yet.")}</p>
        </div>
      )}

      {/* Dynamic Slide-in Notifications drawer */}
      <NotificationsModal isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} />

      {/* Group Details Modal mounted inside search triggers */}
      <GroupDetailsModal
        isOpen={selectedSearchGroup !== null}
        onClose={() => setSelectedSearchGroup(null)}
        group={selectedSearchGroup}
        onJoinToggle={(schoolId, joined) => {
          setMyMemberships(prev => ({ ...prev, [schoolId]: joined }));
          setMatchedGroups(prev =>
            prev.map(g => (g.id === schoolId ? { ...g, studentCount: g.studentCount + (joined ? 1 : -1) } : g))
          );
        }}
        isInitialJoined={selectedSearchGroup ? !!myMemberships[selectedSearchGroup.id] : false}
        onDeleteSuccess={(deletedId) => {
          setMatchedGroups(prev => prev.filter(g => g.id !== deletedId));
          setSelectedSearchGroup(null);
        }}
      />
    </div>
  );
}
