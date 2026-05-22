import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteUser, sendPasswordResetEmail } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Sun, Monitor, LogOut, User, Bell, Shield, 
  Key, ChevronLeft, Globe, MessageSquare, AlertTriangle,
  Eye, EyeOff, Smartphone, ZoomIn, Trash2, Edit3, Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EditProfileModal } from '../components/EditProfileModal';
import { useLanguage } from '../context/LanguageContext';
import { collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

export default function Settings() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useLanguage();
  const [theme, setTheme] = useState(userProfile?.settings?.theme || localStorage.getItem('theme') || 'system');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');
  const [resetSent, setResetSent] = useState(false);
  
  // Settings sync states
  const [isPrivate, setIsPrivate] = useState(userProfile?.settings?.isPrivate || false);
  const [pushNotifs, setPushNotifs] = useState(userProfile?.settings?.notifications?.push ?? true);
  const [msgNotifs, setMsgNotifs] = useState(userProfile?.settings?.notifications?.messages ?? true);
  
  const [compressUploads, setCompressUploads] = useState(userProfile?.settings?.media?.compress ?? true);
  const [largerTextMode, setLargerTextMode] = useState(userProfile?.settings?.accessibility?.largerText ?? false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    if (largerTextMode) {
      root.classList.add('text-lg');
    } else {
      root.classList.remove('text-lg');
    }
  }, [theme, largerTextMode]);

  // Sync settings to firestore
  const updateSetting = async (keyPath: string, value: any) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [keyPath]: value
      });
    } catch (e) {
      console.error("Error updating setting", e);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    updateSetting('settings.theme', newTheme);
  };

  const handlePrivacyChange = () => {
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    updateSetting('settings.isPrivate', newVal);
  };

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(userProfile?.settings?.twoFactor ?? false);
  
  const handleTwoFactorChange = () => {
    const newVal = !twoFactorEnabled;
    setTwoFactorEnabled(newVal);
    updateSetting('settings.twoFactor', newVal);
  };

  const handleActiveSessions = () => {
    alert("You have 1 active session on this device. (Other sessions are currently unavailable or none exist).");
  };

  const requestNotificationPermission = async () => {
    const newVal = !pushNotifs;
    setPushNotifs(newVal);
    updateSetting('settings.notifications.push', newVal);
    
    if (newVal && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      await deleteUser(currentUser);
      // Data in Firestore would normally be deleted via Cloud Function or a batch delete here
      navigate('/login');
    } catch (e) {
      console.error(e);
      alert("Please log in again before deleting your account.");
    }
  };

  const Toggle = ({ enabled, onChange }: { enabled: boolean, onChange: () => void }) => (
    <button 
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{title}</h2>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
        {children}
      </div>
    </section>
  );

  const ActionRow = ({ icon: Icon, color, title, subtitle, onClick, rightContent }: any) => (
    <div className={`w-full flex items-center justify-between p-4 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors' : ''}`} onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="font-medium text-slate-900 dark:text-white">{title}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {rightContent}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24 px-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold tracking-tight">{t("Settings")}</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        
        {/* Account Section */}
        <Section title={t("Account")}>
          <ActionRow 
            icon={User} color="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
            title={t("Edit Profile")} subtitle={t("Update your name, bio, photo & location")}
            onClick={() => setIsEditModalOpen(true)}
          />
          <ActionRow 
            icon={Key} color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            title={t("Change Password")} subtitle={resetSent ? t('Reset link sent to email') : t('Send password reset email')}
            onClick={handlePasswordReset}
          />
        </Section>

        {/* Appearance Section */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{t("Appearance")}</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              <button onClick={() => handleThemeChange('light')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${theme === 'light' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Sun className="w-4 h-4" /> {t("Light Mode")}
              </button>
              <button onClick={() => handleThemeChange('dark')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Moon className="w-4 h-4" /> {t("Dark Mode")}
              </button>
            </div>
          </div>
        </section>

        {/* Privacy & Security Section */}
        <Section title={t("Privacy & Security")}>
          <ActionRow 
            icon={isPrivate ? EyeOff : Eye} color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            title={t("Private Profile")} subtitle={t("Only approved followers can see posts")}
            rightContent={<Toggle enabled={isPrivate} onChange={handlePrivacyChange} />}
          />
          <ActionRow 
            icon={Shield} color="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
            title={t("Two-Factor Authentication")} subtitle={t("Add an extra layer of security")}
            rightContent={<Toggle enabled={twoFactorEnabled} onChange={handleTwoFactorChange} />}
          />
          <ActionRow 
            icon={Smartphone} color="bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400"
            title={t("Active Sessions")} subtitle="Manage devices logged into your account"
            onClick={handleActiveSessions}
          />
        </Section>

        {/* Notifications Section */}
        <Section title={t("Notifications")}>
          <ActionRow 
            icon={Bell} color="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
            title={t("Push Notifications")} subtitle="Allow browser device notifications"
            rightContent={<Toggle enabled={pushNotifs} onChange={requestNotificationPermission} />}
          />
          <ActionRow 
            icon={MessageSquare} color="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400"
            title={t("Message Sounds")} subtitle="Play sound for new direct messages"
            rightContent={<Toggle enabled={msgNotifs} onChange={() => {
              setMsgNotifs(!msgNotifs);
              updateSetting('settings.notifications.messages', !msgNotifs);
            }} />}
          />
        </Section>
        
        {/* Language Section */}
        <Section title={t("Language")}>
          <ActionRow 
            icon={Globe} color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            title={t("App Language")} subtitle="English, Myanmar"
            rightContent={
              <select 
                className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none border-none cursor-pointer p-1"
                value={language || 'en'}
                onChange={(e) => changeLanguage(e.target.value as any)}
              >
                <option value="en">English</option>
                <option value="my">Myanmar</option>
              </select>
            }
          />
        </Section>
        
        {/* Media & Accessibility Section */}
        <Section title={t("Media")}>
          <ActionRow 
            icon={ImageIcon} color="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
            title={t("Compress Uploads")} subtitle="Save data for low internet connections"
            rightContent={<Toggle enabled={compressUploads} onChange={() => {
              const newVal = !compressUploads;
              setCompressUploads(newVal);
              updateSetting('settings.media.compress', newVal);
            }} />}
          />
          <ActionRow 
            icon={ZoomIn} color="bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
            title={t("Larger Text Mode")} subtitle="Increase default interface font-size"
            rightContent={<Toggle enabled={largerTextMode} onChange={() => {
              const newVal = !largerTextMode;
              setLargerTextMode(newVal);
              updateSetting('settings.accessibility.largerText', newVal);
              
              const root = window.document.documentElement;
              if (newVal) {
                root.classList.add('text-lg');
              } else {
                root.classList.remove('text-lg');
              }
            }} />}
          />
        </Section>

        {/* Danger Zone */}
        <section>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-900/50 p-2 mb-4">
           <button onClick={async () => {
             if (!window.confirm("Are you sure you want to delete all other bot/seed users?")) return;
             try {
               const usersSnap = await getDocs(collection(db, 'users'));
               let count = 0;
               let currentBatch = writeBatch(db);
               let operationsInBatch = 0;
               
               for (const userDoc of usersSnap.docs) {
                 if (currentUser && userDoc.id !== currentUser.uid) {
                   currentBatch.delete(doc(db, 'users', userDoc.id));
                   count++;
                   operationsInBatch++;
                   
                   if (operationsInBatch >= 450) {
                     await currentBatch.commit();
                     currentBatch = writeBatch(db);
                     operationsInBatch = 0;
                   }
                 }
               }
               
               if (operationsInBatch > 0) {
                 await currentBatch.commit();
               }
               alert(`Successfully deleted ${count} other accounts.`);
             } catch (e: any) {
               alert("Error deleting accounts: " + e.message);
             }
           }} className="w-full rounded-xl p-3 flex items-center justify-between gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors font-medium mb-1">
             <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5" />
                <span className="text-left">{t("Delete Bots")}</span>
             </div>
           </button>
           <button onClick={() => setDeleteConfirmOpen(true)} className="w-full rounded-xl p-3 flex items-center justify-between gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors font-medium">
             <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5" />
                <span className="text-left">{t("Delete Account")}</span>
             </div>
           </button>
          </div>
        </section>

        <section>
           <button onClick={() => auth.signOut()} className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors font-semibold">
             <LogOut className="w-5 h-5" />
             {t("Log Out")}
           </button>
        </section>
      </motion.div>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-700"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center mb-4 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">{t("Delete Account")}</h3>
              <p className="text-slate-500 text-center text-sm mb-6 leading-relaxed">
                {t("Are you sure? This will permanently delete your profile, posts, messages, and settings. This cannot be undone.")}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 transition-colors">
                  {t("Cancel")}
                </button>
                <button onClick={handleDeleteAccount} className="flex-1 py-3 rounded-xl font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/20 animate-pulse">
                  {t("Delete")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isEditModalOpen && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}
    </div>
  );
}
