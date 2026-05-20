import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadMedia } from '../lib/storage';
import { Button } from './ui/Button';
import { X, Image as ImageIcon } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { userProfile, currentUser, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    username: userProfile?.username || '',
    bio: userProfile?.bio || '',
    school: userProfile?.school || '',
    location: userProfile?.location || '',
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(userProfile?.photoURL || null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !userProfile || !currentUser) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let photoURL = userProfile.photoURL;
      if (selectedPhoto) {
        photoURL = await uploadMedia(selectedPhoto, `profiles/${currentUser.uid}`, (progress) => {
          setUploadProgress(progress);
        });
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...formData,
        ...(photoURL && { photoURL }),
        updatedAt: Date.now()
      });

      await refreshProfile();
      onClose();
    } catch (e) {
      console.error('Error updating profile:', e);
      setUploadProgress(-1);
    } finally {
      setIsSaving(false);
    }
  };

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
          className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh] shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700/50 relative">
            <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">Edit Profile</h2>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="rounded-full px-5 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white border-none shadow-md shadow-[#D62828]/20 disabled:opacity-50 min-w-[5rem]">
              {isSaving ? (uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : 'Saving...') : 'Save'}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {uploadProgress === -1 && (
               <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">Failed to upload profile picture. Please try again.</div>
            )}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] p-1">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-800" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 flex items-center justify-center font-bold text-3xl">
                      {formData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-slate-900 border-2 border-white dark:border-slate-800 rounded-full flex items-center justify-center text-white shadow-md hover:bg-slate-800 transition-colors">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoSelect} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                <input type="text" value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bio</label>
                <textarea rows={3} value={formData.bio} onChange={e => setFormData(f => ({ ...f, bio: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">School / College</label>
                <input type="text" value={formData.school} onChange={e => setFormData(f => ({ ...f, school: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                <input type="text" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
