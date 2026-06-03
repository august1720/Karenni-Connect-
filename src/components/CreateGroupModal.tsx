import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { X, Check, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (schoolId: string) => void;
}

const GRADIENTS = [
  { class: 'from-[#1E3A8A] to-[#D62828]', label: 'Classic Red-Blue' },
  { class: 'from-purple-600 to-pink-600', label: 'Sunset Royal' },
  { class: 'from-teal-500 to-emerald-600', label: 'Green Oasis' },
  { class: 'from-indigo-600 to-blue-500', label: 'Neon Cyber' },
  { class: 'from-orange-500 to-rose-500', label: 'Warm Fire' },
];

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [themeGradient, setThemeGradient] = useState(GRADIENTS[0].class);
  const [isChecking, setIsChecking] = useState(false);
  const [isNameAvailable, setIsNameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userProfile?.school && isOpen) {
      setName(userProfile.school);
    } else if (isOpen) {
      setName('');
    }
  }, [userProfile?.school, isOpen]);

  // Check unique name on change (debounced)
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setIsNameAvailable(null);
      setError('');
      return;
    }

    setIsChecking(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const schoolId = trimmed.toLowerCase();
        // Since we allow doc creation on lowercase ids, checking existence of this document
        const docSnap = await getDoc(doc(db, 'schools', schoolId));
        if (docSnap.exists()) {
          setIsNameAvailable(false);
          setError(t("Group already exists"));
        } else {
          setIsNameAvailable(true);
          setError('');
        }
      } catch (e) {
        console.error('Error validation:', e);
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [name, t]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setError(t("Name must be at least 3 characters"));
      return;
    }
    if (isNameAvailable === false) {
      setError(t("Group already exists"));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const schoolId = trimmedName.toLowerCase();
      const schoolDocRef = doc(db, 'schools', schoolId);

      // Unique double-check transaction-like operation
      const currentSnap = await getDoc(schoolDocRef);
      if (currentSnap.exists()) {
        setError(t("Group already exists"));
        setIsSubmitting(false);
        setIsNameAvailable(false);
        return;
      }

      // Create Group Doc
      const schoolData = {
        name: trimmedName,
        ownerId: currentUser.uid,
        creatorName: userProfile.name || 'Anonymous',
        description: description.trim(),
        guidelines: guidelines.trim(),
        themeGradient,
        studentCount: 1, // Automatically counting creator
        createdAt: Date.now(),
      };

      await setDoc(schoolDocRef, schoolData);

      // Create Member Doc inside the school
      await setDoc(doc(db, 'schools', schoolId, 'members', currentUser.uid), {
        userId: currentUser.uid,
        name: userProfile.name || 'Anonymous',
        username: userProfile.username || 'user',
        photoURL: userProfile.photoURL || '',
        joinedAt: Date.now(),
      });

      onSuccess(schoolId);
      setName('');
      setDescription('');
      setGuidelines('');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error creating group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-700/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700/50">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("Create Group")}</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="flex gap-2 items-start bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-2xl text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* School Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("School / Group Name")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={!!userProfile?.school}
                  placeholder={t("School / Institution Name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-2xl py-3 px-4 pr-10 outline-none text-sm font-medium transition-all ${
                    userProfile?.school
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-705 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#D62828]'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  {isChecking && (
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {!isChecking && isNameAvailable === true && (
                    <Check className="w-5 h-5 text-emerald-500" />
                  )}
                  {!isChecking && isNameAvailable === false && (
                    <X className="w-5 h-5 text-rose-500" />
                  )}
                </div>
              </div>

              {userProfile?.school && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                  🔒 {t("Group name is automatically locked to your profile's school name.")}
                </p>
              )}

              {/* Unique Status Hint */}
              {isNameAvailable === true && (
                <p className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  {t("Group name is unique and available!")}
                </p>
              )}
              {isNameAvailable === false && (
                <p className="text-[11px] font-bold text-rose-500">
                  {t("Group already exists")}
                </p>
              )}
            </div>

            {/* Description Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("About Group / Motto")}
              </label>
              <textarea
                rows={3}
                placeholder={t("Let other students know about this school or study space...")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium transition-all resize-none"
              />
            </div>

            {/* Guidelines Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("Guidelines & Rules (Optional)")}
              </label>
              <textarea
                rows={3}
                placeholder={t("Write space rules or guidelines...")}
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#D62828] text-sm font-medium transition-all resize-none"
              />
            </div>

            {/* Theme Gadients */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t("Group Banner Theme")}
              </label>
              <div className="flex gap-2.5">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.class}
                    type="button"
                    onClick={() => setThemeGradient(g.class)}
                    className={`h-9 w-9 rounded-full bg-gradient-to-tr ${g.class} relative flex items-center justify-center transition-all ${
                      themeGradient === g.class ? 'ring-4 ring-offset-2 ring-indigo-505 scale-105 shadow-md' : 'scale-95 hover:scale-100'
                    }`}
                    title={g.label}
                  >
                    {themeGradient === g.class && (
                      <Check className="w-4 h-4 text-white drop-shadow-sm stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 rounded-2xl"
              >
                {t("Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isChecking || isNameAvailable === false}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white"
              >
                {isSubmitting ? '...' : t("Create Group")}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
