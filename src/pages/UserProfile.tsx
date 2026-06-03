import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getCountFromServer, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { User } from '../types';
import { Share2 } from 'lucide-react';
import { ShareMenu } from '../components/ShareMenu';

const formatLastSeen = (timestamp?: number) => {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const fetchUser = async () => {
    if (!id) return;
    try {
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as User);
      }
      
      const pQuery = query(collection(db, 'posts'), where('authorId', '==', id));
      const pSnap = await getCountFromServer(pQuery);
      setPostsCount(pSnap.data().count);
      
      const followingsQuery = collection(db, 'users', id, 'following');
      const followingsSnap = await getCountFromServer(followingsQuery);
      setFollowingCount(followingsSnap.data().count);
      
      const followersQuery = collection(db, 'users', id, 'followers');
      const followersSnap = await getCountFromServer(followersQuery);
      setFollowersCount(followersSnap.data().count);
      
      if (currentUser) {
         const myFollowSnap = await getDoc(doc(db, 'users', id, 'followers', currentUser.uid));
         setIsFollowing(myFollowSnap.exists());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id === currentUser?.uid) {
      navigate('/profile', { replace: true });
      return;
    }

    fetchUser();

    const handleRefresh = () => {
      fetchUser();
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
    };
  }, [id, currentUser, navigate]);

  const toggleFollow = async () => {
    if (!currentUser || !id || isFollowLoading) return;
    
    setIsFollowLoading(true);
    try {
      const followerRef = doc(db, 'users', id, 'followers', currentUser.uid);
      const followingRef = doc(db, 'users', currentUser.uid, 'following', id);
      
      if (isFollowing) {
         // Unfollow
         await deleteDoc(followerRef);
         await deleteDoc(followingRef);
         setIsFollowing(false);
         setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
         // Follow
         await setDoc(followerRef, { createdAt: Date.now() });
         await setDoc(followingRef, { createdAt: Date.now() });
         setIsFollowing(true);
         setFollowersCount(prev => prev + 1);
         
         // Notify
         await setDoc(doc(collection(db, 'users', id, 'notifications')), {
            type: 'follow',
            fromUserId: currentUser.uid,
            createdAt: Date.now(),
            read: false
         });
      }
    } catch (e) {
      console.error('Error toggling follow:', e);
      alert('Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-4 border-[#1E3A8A] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-500">User not found</div>;
  }

  return (
    <div className="flex flex-col gap-6 pt-4 pb-12">
      <div className="flex items-center px-2">
        <button onClick={() => navigate(-1)} className="mr-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-1"
      >
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700/50 relative overflow-hidden mb-6">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-[#D62828]/10 via-purple-500/10 to-[#1E3A8A]/10 blur-2xl -z-10"></div>
          <div className="flex flex-col items-center gap-3 mb-6 text-center pt-2">
            <div className="relative">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.name} className="w-28 h-28 rounded-full object-cover shadow-xl shadow-[#D62828]/20 border-4 border-white dark:border-slate-800" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center shadow-xl shadow-[#D62828]/20 text-white font-bold text-5xl border-4 border-white dark:border-slate-800">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.lastSeen && (Date.now() - profile.lastSeen < 120000) && (
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-md shadow-emerald-500/30" title="Active now">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping absolute duration-1000"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full relative z-10"></div>
                </div>
              )}
            </div>
            <div className="space-y-1 mt-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
                {profile.name}
              </h2>
              <div className="flex flex-col items-center gap-1.5 pb-2">
                <p className="text-slate-500 font-medium">@{profile.username}</p>
                {profile.lastSeen ? (
                  Date.now() - profile.lastSeen < 120000 ? (
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-sm animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active now
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-medium">
                      Active {formatLastSeen(profile.lastSeen)}
                    </p>
                  )
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">Offline</p>
                )}
              </div>
              
              <div className="flex gap-2.5 justify-center items-center mt-2 flex-wrap">
                {currentUser && currentUser.uid !== id && (
                  <button
                    onClick={toggleFollow}
                    disabled={isFollowLoading}
                    className={`px-6 py-2 rounded-full font-bold text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 w-32 ${
                      isFollowing 
                        ? 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 focus:ring-slate-200' 
                        : 'bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white hover:opacity-90 focus:ring-[#D62828]'
                    }`}
                  >
                    {isFollowLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="px-5 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm shadow-sm hover:bg-slate-200 dark:hover:bg-slate-650 transition-all flex items-center gap-1.5"
                >
                  <Share2 className="w-4 h-4 text-[#D62828]" />
                  Share Profile
                </button>
              </div>
            </div>
            <div className="flex gap-6 mt-4 pb-2 border-b border-slate-100 dark:border-slate-700/50 w-full justify-center">
              <div className="text-center">
                <span className="block font-bold text-lg text-slate-900 dark:text-white">{postsCount}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Posts</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-lg text-slate-900 dark:text-white">{followersCount}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Followers</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-lg text-slate-900 dark:text-white">{followingCount}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Following</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-5 mt-4">
            {(!profile.visibility?.education || profile.visibility.education === 'public') && profile.educationLevel && (
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">🎓</div>
                <div className="pt-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Education ({profile.educationLevel})</p>
                  <p className="text-slate-500">
                    {profile.school || 'Not specified'} 
                    {profile.studentId ? ` | ID: ${profile.studentId}` : ''}
                    {profile.educationDescription ? ` | ${profile.educationDescription}` : ''}
                  </p>
                </div>
              </div>
            )}
            {(!profile.visibility?.location || profile.visibility.location === 'public') && (
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">📍</div>
                <div className="pt-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Location</p>
                  <p className="text-slate-500">{profile.location || 'Not specified'}</p>
                </div>
              </div>
            )}
            {profile.gender && (
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">👤</div>
                <div className="pt-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Gender</p>
                  <p className="text-slate-500">{profile.gender}</p>
                </div>
              </div>
            )}
            {(!profile.visibility?.ethnicity || profile.visibility.ethnicity === 'public') && (profile.majorEthnicity || profile.customEthnicity) && (
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">🌍</div>
                <div className="pt-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Ethnicity</p>
                  <p className="text-slate-500">
                    {profile.majorEthnicity === 'Others' || profile.subEthnicity === 'Others' 
                      ? profile.customEthnicity 
                      : `${profile.majorEthnicity}${profile.subEthnicity ? ` - ${profile.subEthnicity}` : ''}`
                    }
                  </p>
                </div>
              </div>
            )}
            {(!profile.visibility?.bio || profile.visibility.bio === 'public') && profile.bio && (
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">📝</div>
                <div className="pt-1 w-full text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap">
                  {profile.bio}
                </div>
              </div>
            )}
            
            {(!profile.visibility?.interests || profile.visibility.interests === 'public') && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
                <strong className="text-slate-900 dark:text-slate-100 text-sm block mb-3 font-semibold text-center uppercase tracking-wider text-[10px]">Interests & Skills</strong>
                <div className="flex flex-wrap justify-center gap-2">
                  {profile.interests?.map((i, idx) => (
                    <span key={`${i}-${idx}`} className="px-4 py-1.5 bg-slate-100 dark:bg-[#D62828]/10 text-slate-700 dark:text-[#FCA5A5] border border-slate-200 dark:border-[#D62828]/20 text-xs font-semibold rounded-full shadow-sm">{i}</span>
                  )) || <span className="text-slate-500 ml-1">None</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <ShareMenu
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={profile.name}
        shareUrl={`${window.location.origin}/user/${profile.id}`}
        defaultText={`Check out this student profile on StudySpace: @${profile.username} (${profile.name})`}
      />
    </div>
  );
}
