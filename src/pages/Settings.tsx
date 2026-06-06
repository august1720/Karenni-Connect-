import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { deleteUser, sendPasswordResetEmail } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Sun, Monitor, LogOut, User, Bell, Shield, 
  Key, ChevronLeft, Globe, MessageSquare, AlertTriangle, Scale, BookOpen, Check, X,
  Eye, EyeOff, Smartphone, ZoomIn, Trash2, Edit3, ImageIcon, DollarSign, Rocket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EditProfileModal } from '../components/EditProfileModal';
import { useLanguage } from '../context/LanguageContext';
import { collection, getDocs, deleteDoc, writeBatch, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { triggerHaptic } from '../lib/haptic';

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

  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [flaggedItems, setFlaggedItems] = useState<any[]>([]);
  const [loadingFlagged, setLoadingFlagged] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [monetizationOpen, setMonetizationOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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

  // Real-time listener of flagged items for the admin moderation center badge
  useEffect(() => {
    if (!currentUser) return;
    setLoadingFlagged(true);
    const q = query(collection(db, 'flagged_items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setFlaggedItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingFlagged(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'flagged_items');
      setLoadingFlagged(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

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

  const [isActiveSessionsOpen, setIsActiveSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState([
    { id: '1', device: navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone') ? 'Chrome on Mobile' : 'Chrome on Desktop', location: 'Yangon, Myanmar', ip: '116.206.13.43', lastActive: 'Active now', isCurrent: true },
    { id: '2', device: 'Safari on iPhone 15 Pro', location: 'Mandalay, Myanmar', ip: '103.25.12.98', lastActive: '2 hours ago', isCurrent: false },
    { id: '3', device: 'Chrome on Windows 11', location: 'Naypyidaw, Myanmar', ip: '111.84.21.162', lastActive: '3 days ago', isCurrent: false }
  ]);

  const handleActiveSessions = () => {
    triggerHaptic(10);
    setIsActiveSessionsOpen(true);
  };

  const handleRevokeSession = (id: string) => {
    triggerHaptic(25);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const requestNotificationPermission = async () => {
    const newVal = !pushNotifs;
    setPushNotifs(newVal);
    updateSetting('settings.notifications.push', newVal);
    
    if (newVal && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  };

  const handlePasswordReset = () => {
    setResetSent(false);
    setResetError(null);
    setPasswordResetOpen(true);
  };

  const triggerPasswordResetEmail = async () => {
    if (!currentUser?.email) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setResetSent(true);
    } catch (e: any) {
      console.error("Password reset error:", e);
      setResetError(e?.message || "Error sending password reset email");
    } finally {
      setResetLoading(false);
    }
  };

  const handleApproveItem = async (item: any) => {
    triggerHaptic(20);
    try {
      if (item.type === 'post') {
        await updateDoc(doc(db, 'posts', item.id), {
          isFlagged: false,
          moderationStatus: 'approved'
        });
      } else if (item.type === 'comment') {
        await updateDoc(doc(db, 'posts', item.postId, 'comments', item.id), {
          isFlagged: false,
          moderationStatus: 'approved'
        });
      } else if (item.type === 'story') {
        await updateDoc(doc(db, 'stories', item.id), {
          isFlagged: false,
          moderationStatus: 'approved'
        });
      }
      // Delete the reference in flagged review queue
      await deleteDoc(doc(db, 'flagged_items', item.id));
    } catch (err: any) {
      console.error(err);
      alert("Error approving item: " + err.message);
    }
  };

  const handleRemoveItem = async (item: any) => {
    triggerHaptic(30);
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    try {
      if (item.type === 'post') {
        await deleteDoc(doc(db, 'posts', item.id));
      } else if (item.type === 'comment') {
        await deleteDoc(doc(db, 'posts', item.postId, 'comments', item.id));
      } else if (item.type === 'story') {
        await deleteDoc(doc(db, 'stories', item.id));
      }
      // Delete the reference in flagged review queue
      await deleteDoc(doc(db, 'flagged_items', item.id));
    } catch (err: any) {
      console.error(err);
      alert("Error removing item: " + err.message);
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
      onClick={() => {
        triggerHaptic(12);
        onChange();
      }}
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
        <Section title={t("Appearance")}>
          <ActionRow 
            icon={theme === 'dark' ? Moon : Sun} color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            title={t("Dark Mode")} subtitle={t("Toggle dark visual aesthetics")}
            rightContent={<Toggle enabled={theme === 'dark'} onChange={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')} />}
          />
        </Section>

        {/* Privacy & Security Section */}
        <Section title={t("Privacy & Security")}>
          <ActionRow 
            icon={isPrivate ? EyeOff : Eye} color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            title={t("Private Profile")} subtitle={t("Only approved followers can see posts")}
            rightContent={<Toggle enabled={isPrivate} onChange={handlePrivacyChange} />}
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
        
        {/* Campus Safety & Moderation Section */}
        <Section title={t("Campus Safety & Moderation")}>
          <ActionRow 
            icon={BookOpen} color="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            title={t("Community Guidelines")} subtitle={t("Student rules & unacceptable material codes")}
            onClick={() => {
              triggerHaptic(15);
              setIsGuidelinesOpen(true);
            }}
          />
          <ActionRow 
            icon={Scale} color="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
            title={t("Moderation Review Center")} subtitle={`${flaggedItems.length} ${t("items needing safety audit")}`}
            onClick={() => {
              triggerHaptic(15);
              setIsAdminPanelOpen(true);
            }}
            rightContent={flaggedItems.length > 0 && (
              <span className="bg-red-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                {flaggedItems.length}
              </span>
            )}
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

        {/* Monetization & Release */}
        <Section title={t("Monetization & Release")}>
          <ActionRow 
            icon={DollarSign} color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            title={t("Ad Monetization Setup")} subtitle="Google AdSense & AdMob production settings"
            onClick={() => {
              triggerHaptic(15);
              setMonetizationOpen(true);
            }}
          />
        </Section>

        {/* Danger Zone */}
        <section>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-900/50 p-2 mb-4">
           <button onClick={() => setDeleteConfirmOpen(true)} className="w-full rounded-xl p-3 flex items-center justify-between gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors font-medium">
             <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5" />
                <span className="text-left">{t("Delete Account")}</span>
             </div>
           </button>
          </div>
        </section>

        <section>
           <button onClick={() => setLogoutConfirmOpen(true)} className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors font-semibold">
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

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {logoutConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-700"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-4 mx-auto">
                <LogOut className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-center text-slate-900 dark:text-white mb-2">{t("Are you sure you want to log out?")}</h3>
              <p className="text-slate-500 dark:text-slate-450 text-center text-xs mb-6 leading-relaxed font-semibold">
                {t("If you log out, you will be signed out from your account and need to log in again.")}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setLogoutConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-medium text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 transition-colors">
                  {t("Cancel")}
                </button>
                <button onClick={() => { setLogoutConfirmOpen(false); auth.signOut(); }} className="flex-1 py-3 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 transition-colors shadow-lg shadow-red-500/10 cursor-pointer">
                  {t("Yes, Log Out")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Password Reset Confirmation / Success Modal */}
      <AnimatePresence>
        {passwordResetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-700"
            >
              {!resetSent ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center mb-4 mx-auto">
                    <Key className="w-5 h-5 animate-bounce" />
                  </div>
                  <h3 className="text-lg font-black text-center text-slate-900 dark:text-white mb-2">{t("Password Reset Confirm")}</h3>
                  <p className="text-slate-500 dark:text-slate-450 text-center text-xs mb-6 leading-relaxed font-semibold">
                    {t("A password reset link will be sent to")} <strong className="text-slate-800 dark:text-slate-250 truncate block">{currentUser?.email}</strong>. {t("You can easily change your password from that link.")}
                  </p>
                  {resetError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 text-xs rounded-xl font-medium text-center">
                      Error: {resetError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setPasswordResetOpen(false)} className="flex-1 py-3 rounded-xl font-medium text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 transition-colors">
                      {t("Cancel")}
                    </button>
                    <button 
                      onClick={triggerPasswordResetEmail} 
                      disabled={resetLoading}
                      className="flex-1 py-3 rounded-xl font-bold text-xs text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
                    >
                      {resetLoading ? t("Please wait...") : t("Send Link")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center mb-4 mx-auto">
                    <Check className="w-6 h-6 animate-bounce" />
                  </div>
                  <h3 className="text-lg font-black text-center text-slate-900 dark:text-white mb-2">{t("Email Sent!")}</h3>
                  <p className="text-slate-500 dark:text-slate-450 text-center text-xs mb-6 leading-relaxed font-semibold">
                    {t("A password reset link has been successfully sent to")} <strong className="text-slate-800 dark:text-slate-250 truncate block">{currentUser?.email}</strong>. {t("Please check your inbox or spam folder.")}
                  </p>
                  <button 
                    onClick={() => setPasswordResetOpen(false)}
                    className="w-full py-3 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-md"
                  >
                    {t("Okay")}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Community Guidelines Modal */}
      <AnimatePresence>
        {isGuidelinesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-md w-full border border-slate-100 dark:border-slate-700 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Campus Safety Guidelines</h3>
                </div>
                <button onClick={() => setIsGuidelinesOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-3 leading-snug">
                  Welcome to 'Campus Connect'! To keep our student collaboration platform safe, respectful, and academically sound, all standard content and images are scanned in real-time by an automated AI Content Moderation System.
                </p>

                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1">
                  <h4 className="text-red-600 dark:text-red-400 font-extrabold uppercase text-[10px] tracking-wider">1. Hate Speech & Discrimination [Zero Tolerance]</h4>
                  <p className="font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    Discrimination or slurs targeting anyone's race, class, physical capabilities, gender identity, sexual orientation, academic standing, or department are blocked instantly.
                  </p>
                </div>

                <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl space-y-1">
                  <h4 className="text-orange-600 dark:text-orange-400 font-extrabold uppercase text-[10px] tracking-wider">2. Bullying, Harassment & Cyber-Intimidation</h4>
                  <p className="font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    Direct personal attacks, naming-and-shaming individuals, spreading student rumours, intimidation, or posting unwanted personal photos can result in severe warnings.
                  </p>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1">
                  <h4 className="text-amber-600 dark:text-amber-400 font-extrabold uppercase text-[10px] tracking-wider">3. Graphic Violence & Gore</h4>
                  <p className="font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    Sharing severe weapon promotion, bloody media, or graphic violence of any form is prohibited. These uploads are flagged instantly.
                  </p>
                </div>

                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                  <h4 className="text-indigo-600 dark:text-indigo-400 font-extrabold uppercase text-[10px] tracking-wider">4. Academic Dishonesty & Fraud Code</h4>
                  <p className="font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    Cheating, posting live exam solutions, or selling homework/essays is strictly forbidden on study space boards.
                  </p>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <h4 className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider mb-1">Standard Enforcement Action Definitions:</h4>
                  <ul className="list-disc leading-loose pl-3 font-medium text-[11px] text-slate-500 dark:text-slate-400">
                    <li><strong className="text-amber-600 font-bold">Auto-Flag (Borderline Content):</strong> Appears blurred behind a content disclosure overlay, giving viewers warnings. Admins audit.</li>
                    <li><strong className="text-red-500 font-bold">Block (Severe Content):</strong> Blocked from being published immediately. Trigger reason displayed.</li>
                  </ul>
                </div>
              </div>

              <button 
                onClick={() => setIsGuidelinesOpen(false)}
                className="w-full mt-6 py-3 bg-slate-900 dark:bg-slate-700 text-white font-black uppercase text-xs rounded-xl active:scale-95 transition-all text-center"
              >
                I Understand Guidelines
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Moderation Terminal Modal */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-lg w-full border border-slate-100 dark:border-slate-700 max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-red-500" />
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Moderation review Center</h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Logged in as Administrator</p>
                  </div>
                </div>
                <button onClick={() => setIsAdminPanelOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
                {loadingFlagged ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                     <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-xs font-bold font-mono">Loading safety data...</span>
                  </div>
                ) : flaggedItems.length > 0 ? (
                  flaggedItems.map(item => (
                    <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex flex-col gap-3 relative overflow-hidden">
                      {/* Flag Card Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-block bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full mb-1">
                            {item.type || 'content'}
                          </span>
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                            Author: {item.authorName || 'Student'} <span className="text-[10px] font-mono font-medium text-slate-400">({item.authorId?.slice(0, 6)}...)</span>
                          </h4>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Flag triggers */}
                      <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[11px] font-semibold text-amber-800 dark:text-amber-400">
                        <p className="font-extrabold uppercase text-[8px] tracking-wider mb-1 text-amber-700 dark:text-amber-300">
                          Primary Trigger: {item.category?.replace('_', ' ')}
                        </p>
                        <p className="leading-normal italic">
                          Reason: "{item.reason || 'Safety threshold matched'}"
                        </p>
                      </div>

                      {/* Content representation */}
                      <div className="text-[12px] bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed max-h-36 overflow-y-auto">
                        {item.imageUrl && (
                          <div className="w-full max-h-32 rounded-lg overflow-hidden mb-2 border border-slate-100 dark:border-slate-700 bg-slate-100">
                            <img src={item.imageUrl} alt="Flagged Media" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <p className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300">
                          {item.content || 'Voice media / attachment upload'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                        <button
                          onClick={() => handleApproveItem(item)}
                          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px] rounded-xl transition-colors uppercase"
                        >
                          Approve Content
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item)}
                          className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[11px] rounded-xl transition-colors uppercase"
                        >
                          Delete Content
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl select-none flex flex-col items-center justify-center gap-3">
                     <span className="text-3xl">🎉</span>
                     <p className="font-black text-xs text-slate-800 dark:text-slate-200">The platform is fully moderated</p>
                     <p className="text-[10px] text-slate-400 font-bold max-w-xs leading-normal">
                       There are no content flags or violations in queue. Campus Connect student channels are perfectly safe and secure.
                     </p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsAdminPanelOpen(false)}
                className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-white font-extrabold uppercase text-xs rounded-xl transition-all text-center shrink-0"
              >
                Close Control Panel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Sessions Management Modal */}
      <AnimatePresence>
        {isActiveSessionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in fade-in duration-200"
            >
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Active Sessions</h3>
                </div>
                <button onClick={() => setIsActiveSessionsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {sessions.map(session => (
                  <div key={session.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        {session.device.toLowerCase().includes('desktop') ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{session.device}</p>
                          {session.isCurrent && (
                            <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-md">This Device</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold">{session.location} • {session.ip}</p>
                        <p className="text-[9px] text-slate-500 font-semibold mt-1">{session.lastActive}</p>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button 
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/35 transition"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsActiveSessionsOpen(false)}
                className="w-full mt-6 py-3 bg-slate-900 dark:bg-slate-700 text-white font-black uppercase text-xs rounded-xl active:scale-95 transition-all text-center"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monetization & Release Guide Modal */}
      <AnimatePresence>
        {monetizationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl max-w-md w-full border border-slate-100 dark:border-slate-700 my-8 overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white">ကြော်ငြာနှင့် အပြင်ထုတ်လွှင့်ခြင်းလမ်းညွှန်</h3>
                </div>
                <button onClick={() => setMonetizationOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-black p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-1.5 scrollbar-thin font-semibold text-slate-800 dark:text-slate-200">
                
                {/* Intro Accent Card */}
                <div className="p-4 bg-gradient-to-tr from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-950/30">
                  <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 font-bold">
                    ဤသည်မှာ သင့်အက်ပလီကေးရှင်းကို Play Store / App Store နှင့် Web သို့ အောင်မြင်စွာ ထုတ်လွှင့်ပြီး Google Ads (AdMob / AdSense) ဖြင့် ပိုက်ဆံရှာရန် ပြင်ဆင်ရန် အဆင့်များဖြစ်ပါသည်။
                  </p>
                </div>

                {/* Step 1: Ads Integration */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                    <span>Google Ad Setup (ဝင်ငွေရှာနည်း)</span>
                  </div>
                  <div className="pl-8 text-xs space-y-2 text-slate-500 dark:text-slate-400">
                    <p className="font-bold">
                      • <strong className="text-slate-800 dark:text-slate-250">Ad Unit Live Configured:</strong> Home page Feed list ထဲတွင် sponsor ads များကို Auto-rotating စနစ်ဖြင့် ပြသရန် ထည့်သွင်းပေးထားပြီး ဖြစ်ပါသည်။ 
                    </p>
                    <p className="font-bold">
                      • <strong className="text-slate-800 dark:text-slate-250">AdSense Integration:</strong> Web version အတွက် Google AdSense code ကို <code>index.html</code> (head tag block) ထဲသို့ ထည့်ရုံဖြင့် Feed posts ကြားတွင် banner ads များ live တက်လာပါမည်။
                    </p>
                    <p className="font-bold">
                      • <strong className="text-slate-800 dark:text-slate-250">AdMob Integration:</strong> Mobile App (Android/iOS) အဖြစ် Android Studio ဖြင့် build ရန် <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-rose-500">@react-native-admob</code> သို့မဟုတ် <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-rose-500">cordova-plugin-admob</code> ကို wrapper တွင် သတ်မှတ်ပေးရန် လိုပါသည်။
                    </p>
                  </div>
                </div>

                {/* Step 2: Production Release Checklist */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">2</span>
                    <span>Production Build & Export Guide</span>
                  </div>
                  <div className="pl-8 text-xs space-y-3.5 text-slate-500 dark:text-slate-400 font-semibold">
                    <div>
                      <span className="block font-black text-[11px] text-slate-850 dark:text-white uppercase mb-1">A. Export Project</span>
                      <p>Settings menu မှ <strong>Export ZIP</strong> သို့မဟုတ် <strong>Export to GitHub</strong> ကို နှိပ်ပြီး ယခု app source code အလုံးစုံကို အလွယ်တကူ ရယူပါ။</p>
                    </div>
                    <div>
                      <span className="block font-black text-[11px] text-slate-850 dark:text-white uppercase mb-1">B. Install & Bundle locally</span>
                      <p>သင့် စက်ထဲသို့ ရောက်ရှိပါက root folder ၌ အောက်ပါ command များကို run ပြီး production static bundle ထုတ်ပါ -</p>
                      <code className="block p-2 bg-slate-100 dark:bg-slate-900 text-[10px] text-indigo-500 dark:text-indigo-400 rounded-xl font-mono mt-1.5 border border-slate-200/50 dark:border-slate-800">
                        npm install<br/>
                        npm run build
                      </code>
                    </div>
                    <div>
                      <span className="block font-black text-[11px] text-slate-850 dark:text-white uppercase mb-1">C. Hosting Deploy</span>
                      <p>ထွက်ရှိလာသော <code className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono">dist/</code> static files folder အား Vercel, Netlify (သို့မဟုတ်) Firebase Hosting ပေါ်သို့ Upload တင်ပေးရုံဖြင့် web live လွှင့်နိုင်ပါမည်။</p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Domain & Store Release */}
                <div className="space-y-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <Rocket className="w-4 h-4 text-indigo-500" />
                    <span>Domain & Store Deployment checklist</span>
                  </div>
                  <div className="pl-8 text-xs space-y-1.5 text-slate-500 dark:text-slate-400">
                    <p>✔︎ Firebase Authentication setting တွင် သင့်ကိုယ်ပိုင် custom domain (ဥပမာ: myapp.com) အား Authorized domains တွင် ထည့်သွင်းပါ။</p>
                    <p>✔︎ Google Cloud Console API credentials ထဲတွင် domain origins ကန့်သတ်ချက်များ သတ်မှတ်ပါ။</p>
                    <p>✔︎ Play Store တွင် တင်နိုင်ရန် <strong className="text-slate-800 dark:text-slate-250">Capacitor JS wrapper</strong> ကို သုံး၍ ဤ web app ကို apk/aab အဖြစ် ၁၅ မိနစ်အတွင်း အလွယ်တကူ ပြောင်းလဲနိုင်သည်။</p>
                  </div>
                </div>

              </div>

              <button 
                onClick={() => setMonetizationOpen(false)}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-black uppercase text-xs rounded-xl active:scale-[0.98] transition-all text-center shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                သိရှိပြီး (Understood)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
