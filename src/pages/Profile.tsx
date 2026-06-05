import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth, db, notifyDbError } from '../lib/firebase';
import { collection, query, where, getCountFromServer, doc, updateDoc, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { EditProfileModal } from '../components/EditProfileModal';
import { Settings as SettingsIcon, Share2, Plus, Trash2, X, Image as ImageIcon, Briefcase, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShareMenu } from '../components/ShareMenu';
import { triggerHaptic } from '../lib/haptic';
import { PostCard } from '../components/PostCard';
import { Post } from '../types';

export default function Profile() {
  const { userProfile, currentUser, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const fetchMyPosts = async () => {
    if (!currentUser) return;
    try {
      setPostsLoading(true);
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(postsQuery);
      const fetchedPosts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Post);
      // Sort client-side based on createdAt desc
      fetchedPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMyPosts(fetchedPosts);
      setPostsCount(fetchedPosts.length);
    } catch (e: any) {
      console.error("Error fetching my posts:", e);
      notifyDbError(e?.message || String(e));
    } finally {
      setPostsLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setMyPosts(prev => prev.filter(post => post.id !== postId));
      setPostsCount(prev => Math.max(0, prev - 1));
      triggerHaptic(10);
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const fetchCounts = async () => {
    if (!currentUser) return;
    try {
      const followingsQuery = collection(db, 'users', currentUser.uid, 'following');
      const followingsSnap = await getCountFromServer(followingsQuery);
      setFollowingCount(followingsSnap.data().count);
      
      const followersQuery = collection(db, 'users', currentUser.uid, 'followers');
      const followersSnap = await getCountFromServer(followersQuery);
      setFollowersCount(followersSnap.data().count);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchCounts();
    fetchMyPosts();

    const handleRefresh = () => {
      fetchCounts();
      fetchMyPosts();
    };
    window.addEventListener('app-refresh', handleRefresh);
    return () => {
      window.removeEventListener('app-refresh', handleRefresh);
    };
  }, [currentUser]);

  const [isAddShowcaseOpen, setIsAddShowcaseOpen] = useState(false);
  const [newShowcaseTitle, setNewShowcaseTitle] = useState('');
  const [newShowcaseCategory, setNewShowcaseCategory] = useState('Coding');
  const [newShowcaseImage, setNewShowcaseImage] = useState('');
  const [isSavingShowcase, setIsSavingShowcase] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic(5);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewShowcaseImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddShowcase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newShowcaseTitle.trim()) return;

    triggerHaptic(15);
    setIsSavingShowcase(true);
    try {
      const defaultImages: Record<string, string> = {
        Coding: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=400',
        Design: 'https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=400',
        Writing: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400',
        Research: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
        Other: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&q=80&w=400'
      };

      const finalImage = newShowcaseImage || defaultImages[newShowcaseCategory] || defaultImages.Other;

      const newShowcaseItem = {
        id: `showcase-${Date.now()}`,
        title: newShowcaseTitle.trim(),
        category: newShowcaseCategory,
        image: finalImage,
        createdAt: new Date().toISOString()
      };

      const currentShowcases = userProfile?.showcases || [];
      const updatedShowcases = [...currentShowcases, newShowcaseItem];

      await updateDoc(doc(db, 'users', currentUser.uid), {
        showcases: updatedShowcases
      });

      if (refreshProfile) {
        await refreshProfile();
      }

      setNewShowcaseTitle('');
      setNewShowcaseCategory('Coding');
      setNewShowcaseImage('');
      setIsAddShowcaseOpen(false);
    } catch (err) {
      console.error("Error adding showcase item:", err);
    } finally {
      setIsSavingShowcase(false);
    }
  };

  const handleDeleteShowcase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (!window.confirm(t("Are you sure you want to delete this showcase item?"))) return;

    triggerHaptic(20);
    try {
      const currentShowcases = userProfile?.showcases || [];
      const updatedShowcases = currentShowcases.filter((s: any) => s.id !== id);

      await updateDoc(doc(db, 'users', currentUser.uid), {
        showcases: updatedShowcases
      });

      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      console.error("Error deleting showcase item:", err);
    }
  };
  
  return (
    <div className="flex flex-col gap-6 pt-4 pb-12">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("Profile")}</h1>
        <button onClick={() => navigate('/settings')} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
      
      {userProfile && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-1"
        >
          {/* Identity Card */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700/50 relative overflow-hidden mb-6">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-[#D62828]/10 via-purple-500/10 to-[#1E3A8A]/10 blur-2xl -z-10"></div>
            <div className="flex flex-col items-center gap-3 mb-6 text-center pt-2">
              <div className="relative">
                {userProfile.photoURL ? (
                  <img src={userProfile.photoURL} alt={userProfile.name} className="w-28 h-28 rounded-full object-cover shadow-xl shadow-[#D62828]/20 border-4 border-white dark:border-slate-800" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center shadow-xl shadow-[#D62828]/20 text-white font-bold text-5xl border-4 border-white dark:border-slate-800">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] text-white">✨</div>
              </div>
              <div className="space-y-1 mt-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
                  {userProfile.name}
                  <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM9.29 16.29L5.7 12.7C5.31 12.31 5.31 11.68 5.7 11.29C6.09 10.9 6.72 10.9 7.11 11.29L10 14.17L16.89 7.29C17.28 6.9 17.91 6.9 18.3 7.29C18.69 7.68 18.69 8.31 18.3 8.7L10.71 16.29C10.32 16.68 9.68 16.68 9.29 16.29Z" /></svg>
                </h2>
                <p className="text-slate-500 font-medium">@{userProfile.username}</p>
              </div>
              <div className="flex gap-6 mt-4 pb-2 border-b border-slate-100 dark:border-slate-700/50 w-full justify-center">
                <div className="text-center">
                  <span className="block font-bold text-lg text-slate-900 dark:text-white">{postsCount}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t("Posts")}</span>
                </div>
                <div className="text-center">
                  <span className="block font-bold text-lg text-slate-900 dark:text-white">{followersCount}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t("Followers")}</span>
                </div>
                <div className="text-center">
                  <span className="block font-bold text-lg text-slate-900 dark:text-white">{followingCount}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t("Following")}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-5 mt-4">
              {userProfile.educationLevel && (
                <div className="flex gap-3 text-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">🎓</div>
                  <div className="pt-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t("Education")} ({userProfile.educationLevel})</p>
                    <p className="text-slate-500">
                      {userProfile.school || t('Not specified')} 
                      {userProfile.studentId ? ` | ID: ${userProfile.studentId}` : ''}
                      {userProfile.educationDescription ? ` | ${userProfile.educationDescription}` : ''}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">📍</div>
                <div className="pt-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{t("Location")}</p>
                  <p className="text-slate-500">{userProfile.location || t('Not specified')}</p>
                </div>
              </div>
              {userProfile.gender && (
                <div className="flex gap-3 text-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">👤</div>
                  <div className="pt-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t("Gender")}</p>
                    <p className="text-slate-500">{t(userProfile.gender)}</p>
                  </div>
                </div>
              )}
              {(userProfile.majorEthnicity || userProfile.customEthnicity) && (
                <div className="flex gap-3 text-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">🌍</div>
                  <div className="pt-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t("Ethnicity")}</p>
                    <p className="text-slate-500">
                      {userProfile.majorEthnicity === 'Others' || userProfile.subEthnicity === 'Others' 
                        ? userProfile.customEthnicity 
                        : `${userProfile.majorEthnicity}${userProfile.subEthnicity ? ` - ${userProfile.subEthnicity}` : ''}`
                      }
                    </p>
                  </div>
                </div>
              )}
              {userProfile.bio && (
                <div className="flex gap-3 text-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-600">📝</div>
                  <div className="pt-1 w-full text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap">
                    {userProfile.bio}
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
                <strong className="text-slate-900 dark:text-slate-100 text-sm block mb-3 font-semibold text-center uppercase tracking-wider text-[10px]">{t("Interests & Skills")}</strong>
                <div className="flex flex-wrap justify-center gap-2">
                  {userProfile.interests?.map((i, idx) => (
                    <span key={`${i}-${idx}`} className="px-4 py-1.5 bg-slate-100 dark:bg-[#D62828]/10 text-slate-700 dark:text-[#FCA5A5] border border-slate-200 dark:border-[#D62828]/20 text-xs font-semibold rounded-full shadow-sm">{i}</span>
                  )) || <span className="text-slate-500 ml-1">{t("Not specified")}</span>}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
              <Button className="flex-1 rounded-2xl" variant="primary" onClick={() => setIsEditModalOpen(true)}>{t("Edit Profile")}</Button>
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-205 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-750 dark:text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200/40 dark:border-slate-700/30 shadow-sm"
              >
                <Share2 className="w-4 h-4 text-[#D62828]" />
                {t("Share Profile")}
              </button>
            </div>
          </div>
          
          {/* Responsive Layout with Left and Right Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-8">
            {/* Left/Main Column: Post History (equivalent to Facebook profile stream) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📰</span> {t("Post History")}
                </h2>
                {postsCount > 0 && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    {postsCount} {postsCount === 1 ? t("Post") : t("Posts")}
                  </span>
                )}
              </div>

              {postsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-4 border-[#1E3A8A] border-t-transparent animate-spin"></div>
                </div>
              ) : myPosts.length > 0 ? (
                <div className="space-y-4">
                  {myPosts.map(post => (
                    <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm text-slate-500 flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">✍️</span>
                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{t("No posts yet")}</p>
                  <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-relaxed">
                    {t("Create a post on the homepage or discover board to see it in your history!")}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Showcase (placed separately on the right side) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>✨</span> {t("Showcase")}
                </h2>
                <button
                  onClick={() => {
                    triggerHaptic(10);
                    setIsAddShowcaseOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-[#D62828] dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-xl hover:opacity-85 transition border border-red-100 dark:border-red-950/35"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("Add")}</span>
                </button>
              </div>

              {userProfile.showcases && userProfile.showcases.length > 0 ? (
                <div className="grid grid-cols-1 gap-3.5">
                  {userProfile.showcases.map((item: any) => (
                    <div key={item.id} className="bg-slate-200 dark:bg-slate-800 h-48 rounded-[2rem] overflow-hidden relative group shadow-sm border border-slate-100 dark:border-slate-700/30">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>
                      
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteShowcase(item.id, e)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-rose-450 hover:text-rose-505 hover:bg-black/60 transition opacity-0 group-hover:opacity-100 duration-200"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="absolute bottom-4 left-4 right-4 animate-in slide-in-from-bottom-2 duration-200">
                        <p className="text-white text-xs font-bold truncate leading-tight">{item.title}</p>
                        <p className="text-white/75 text-[10px] font-medium uppercase tracking-wider">{item.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 select-none flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📁</span>
                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{t("No Projects")}</p>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                    {t("Add project showcases to display your skills and work!")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {isEditModalOpen && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}

      {userProfile && (
        <ShareMenu
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          title={userProfile.name}
          shareUrl={`${window.location.origin}/user/${currentUser?.uid}`}
          defaultText={`Check out my student profile on StudySpace: @${userProfile.username} (${userProfile.name})`}
        />
      )}

      {/* Add Showcase Item Modal */}
      <AnimatePresence>
        {isAddShowcaseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-md w-full border border-slate-100 dark:border-slate-700"
            >
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-slate-100 dark:border-slate-700 font-bold">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-extrabold">Add Showcase Project</h3>
                </div>
                <button onClick={() => setIsAddShowcaseOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddShowcase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Title</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Computer Science Paper, UI Redesign, Art Portfolio"
                    value={newShowcaseTitle}
                    onChange={(e) => setNewShowcaseTitle(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={newShowcaseCategory}
                    onChange={(e) => setNewShowcaseCategory(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                  >
                    <option value="Coding">Coding / Engineering</option>
                    <option value="Design">Design / Art</option>
                    <option value="Writing">Writing / Journalism</option>
                    <option value="Research">Research / Science</option>
                    <option value="Other">Other Skills</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Image (Optional)</label>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-705 bg-slate-50 dark:bg-slate-900 hover:border-indigo-400 cursor-pointer text-slate-500 text-xs font-semibold">
                      <ImageIcon className="w-4 h-4 text-indigo-500" />
                      <span>{newShowcaseImage ? 'Change Image' : 'Upload custom image'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                    {newShowcaseImage && (
                      <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={newShowcaseImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddShowcaseOpen(false)} 
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingShowcase}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold uppercase text-xs rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingShowcase ? 'Saving...' : 'Add to Showcase'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
