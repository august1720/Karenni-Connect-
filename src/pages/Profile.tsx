import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { EditProfileModal } from '../components/EditProfileModal';
import { Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { userProfile, currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const fetchCounts = async () => {
      try {
        const pQuery = query(collection(db, 'posts'), where('authorId', '==', currentUser.uid));
        const pSnap = await getCountFromServer(pQuery);
        setPostsCount(pSnap.data().count);
        
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
    fetchCounts();
  }, [currentUser]);
  
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
                  {userProfile.interests?.map(i => (
                    <span key={i} className="px-4 py-1.5 bg-slate-100 dark:bg-[#D62828]/10 text-slate-700 dark:text-[#FCA5A5] border border-slate-200 dark:border-[#D62828]/20 text-xs font-semibold rounded-full shadow-sm">{i}</span>
                  )) || <span className="text-slate-500 ml-1">{t("Not specified")}</span>}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
              <Button className="flex-1 rounded-2xl" variant="primary" onClick={() => setIsEditModalOpen(true)}>{t("Edit Profile")}</Button>
            </div>
          </div>
          
          <h2 className="text-xl font-bold tracking-tight px-1 mb-4">{t("Showcase")}</h2>
          
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-200 dark:bg-slate-800 h-48 rounded-[2rem] overflow-hidden relative group cursor-pointer shadow-sm">
               <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Code" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
               <div className="absolute bottom-4 left-4 right-4">
                 <p className="text-white text-sm font-semibold truncate">React Native App</p>
                 <p className="text-white/70 text-[10px] font-medium">Coding</p>
               </div>
             </div>
             <div className="bg-slate-200 dark:bg-slate-800 h-48 rounded-[2rem] overflow-hidden relative group cursor-pointer shadow-sm">
               <img src="https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Design" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
               <div className="absolute bottom-4 left-4 right-4">
                 <p className="text-white text-sm font-semibold truncate">Brand Identity</p>
                 <p className="text-white/70 text-[10px] font-medium">Design</p>
               </div>
             </div>
          </div>
        </motion.div>
      )}

      {isEditModalOpen && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}
    </div>
  );
}
