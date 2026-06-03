import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadMedia } from '../lib/storage';
import { Button } from './ui/Button';
import { X, Image as ImageIcon, Sparkles } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { useLanguage } from '../context/LanguageContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAJOR_ETHNICITIES = [
  'Bamar', 'Shan', 'Karen (Kayin)', 'Kayah (Karenni)', 'Rakhine', 'Mon', 'Chin', 'Kachin', 'Others'
];

const KAYAH_SUBGROUPS = [
  'Kayah', 'Kayan (Padaung)', 'Kayaw', 'Bre (Bwe)', 'Manu Manaw', 'Geba', 'Yintale', 'Yinbaw', 'Others'
];

const SUB_ETHNICITIES_MAP: Record<string, string[]> = {
  'Kayah (Karenni)': KAYAH_SUBGROUPS,
};

type Visibility = 'public' | 'private';

const VisibilityToggle = ({ label, value, onChange }: { label: string, value: Visibility, onChange: (v: Visibility) => void }) => {
  return (
    <div className="flex items-center justify-between mb-2">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-md">
        <button
          type="button"
          onClick={() => onChange('public')}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-sm transition-all ${value === 'public' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Public
        </button>
        <button
          type="button"
          onClick={() => onChange('private')}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-sm transition-all ${value === 'private' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Private
        </button>
      </div>
    </div>
  );
};

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { userProfile, currentUser, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    username: userProfile?.username || '',
    bio: userProfile?.bio || '',
    educationLevel: userProfile?.educationLevel || '',
    school: userProfile?.school || '',
    studentId: userProfile?.studentId || '',
    educationDescription: userProfile?.educationDescription || '',
    location: userProfile?.location || '',
    majorEthnicity: userProfile?.majorEthnicity || '',
    subEthnicity: userProfile?.subEthnicity || '',
    customEthnicity: userProfile?.customEthnicity || '',
    gender: userProfile?.gender || '',
  });
  const [visibility, setVisibility] = useState<Record<string, 'public' | 'private'>>(
    userProfile?.visibility || {
      name: 'public',
      username: 'public',
      education: 'public',
      location: 'public',
      bio: 'public',
      interests: 'public',
      ethnicity: 'public'
    }
  );
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);

  const handleVisibilityChange = (field: string, val: 'public' | 'private') => {
    setVisibility(prev => ({ ...prev, [field]: val }));
  };
  const [photoPreview, setPhotoPreview] = useState<string | null>(userProfile?.photoURL || null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Avatar Generator States
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiTheme, setAiTheme] = useState('Computer Science & Coding');
  const [aiStyle, setAiStyle] = useState('Minimalist 3D Illustration');
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Convert base64 Data URL to a native File object to integrate with uploadMedia flow flawlessly
  const base64ToFile = (base64String: string, fileName: string): File => {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
  };

  const handleGenerateAIAvatar = async () => {
    setIsGeneratingAvatar(true);
    setAiError(null);
    try {
      const response = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: aiTheme, style: aiStyle }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Avatar generation failed.');
      }

      setPhotoPreview(data.imageUrl);
      
      // Select the generated file so it uploads normally when the profile is saved
      const file = base64ToFile(data.imageUrl, `ai_avatar_${Date.now()}.png`);
      setSelectedPhoto(file);
      setUploadProgress(0);
      setShowAIGenerator(false);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Failed to generate avatar. Please try again.');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  if (!isOpen || !userProfile || !currentUser) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCroppingImage(URL.createObjectURL(file));
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let photoURL = userProfile.photoURL;
      // ... same logic
      if (selectedPhoto) {
        photoURL = await uploadMedia(selectedPhoto, `profiles/${currentUser.uid}`, (progress) => {
          setUploadProgress(progress);
        });
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...formData,
        visibility,
        ...(photoURL && { photoURL }),
        updatedAt: Date.now()
      });

      await refreshProfile();
      onClose();
    } catch (e: any) {
      console.error('Error updating profile:', e);
      alert('Error updating profile: ' + (e.message || String(e)));
      setUploadProgress(-1);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{`nav { display: none !important; }`}</style>
      <AnimatePresence>
        <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0"
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

              {/* Imagen AI Personalized Studio Avatar Feature if user doesn't have a photo */}
              {(!userProfile?.photoURL && !selectedPhoto) && (
                <div className="w-full flex flex-col items-center mt-4">
                  {!showAIGenerator ? (
                    <button
                      type="button"
                      onClick={() => setShowAIGenerator(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all uppercase tracking-wider select-none"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                      {t("Generate Study Avatar with AI")}
                    </button>
                  ) : (
                    <div className="w-full bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200/50 dark:border-slate-705/50 rounded-2xl mt-3 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          {t("Imagen Study Designer")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAIGenerator(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-[11px] font-bold"
                        >
                          {t("Cancel")}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t("Study Theme")}</label>
                          <select
                            value={aiTheme}
                            onChange={(e) => setAiTheme(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                          >
                            <option value="Computer Science & Coding">💻 {t("Computer Science & Coding")}</option>
                            <option value="Library & Literature">📚 {t("Library & Literature")}</option>
                            <option value="Mathematics & Formulas">📐 {t("Mathematics & Formulas")}</option>
                            <option value="Creative Arts & Canvas">🎨 {t("Creative Arts & Canvas")}</option>
                            <option value="Medical Lab & Chemistry">🔬 {t("Medical Lab & Chemistry")}</option>
                            <option value="Space & Astronomy">🚀 {t("Space & Astronomy")}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t("Visual Style")}</label>
                          <select
                            value={aiStyle}
                            onChange={(e) => setAiStyle(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                          >
                            <option value="Minimalist 3D Illustration">{t("Minimalist 3D Illustration")}</option>
                            <option value="Flat Pastel Vector Icon">{t("Flat Pastel Vector Icon")}</option>
                            <option value="Retro Pixel Art / Gaming">{t("Retro Pixel Art / Gaming")}</option>
                            <option value="Cute Claymation Chibi">{t("Cute Claymation Chibi")}</option>
                            <option value="Technical Blueprint Drawing">{t("Technical Blueprint Drawing")}</option>
                          </select>
                        </div>
                      </div>

                      {aiError && (
                        <p className="text-[10px] text-red-500 font-bold bg-red-500/5 px-2.5 py-1.5 rounded-xl border border-red-500/10">{aiError}</p>
                      )}

                      <button
                        type="button"
                        disabled={isGeneratingAvatar}
                        onClick={handleGenerateAIAvatar}
                        className="w-full py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white font-black text-[10px] uppercase rounded-xl transition-all tracking-wider"
                      >
                        {isGeneratingAvatar ? t("Designing Avatar...") : t("Generate Masterpiece")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Name" value={visibility.name} onChange={(v) => handleVisibilityChange('name', v)} />
                <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Username" value={visibility.username} onChange={(v) => handleVisibilityChange('username', v)} />
                <input type="text" value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Ethnicity" value={visibility.ethnicity} onChange={(v) => handleVisibilityChange('ethnicity', v)} />
                <select 
                  value={formData.majorEthnicity} 
                  onChange={e => setFormData(f => ({ ...f, majorEthnicity: e.target.value, subEthnicity: '', customEthnicity: '' }))} 
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium mb-3 appearance-none"
                >
                  <option value="" disabled>Select Major Ethnicity</option>
                  {MAJOR_ETHNICITIES.map(eth => (
                    <option key={eth} value={eth}>{eth}</option>
                  ))}
                </select>

                {formData.majorEthnicity && SUB_ETHNICITIES_MAP[formData.majorEthnicity] ? (
                  <select 
                    value={formData.subEthnicity} 
                    onChange={e => setFormData(f => ({ ...f, subEthnicity: e.target.value, customEthnicity: '' }))} 
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium mb-3 appearance-none"
                  >
                    <option value="" disabled>Select Subgroup</option>
                    {SUB_ETHNICITIES_MAP[formData.majorEthnicity].map(eth => (
                      <option key={eth} value={eth}>{eth}</option>
                    ))}
                  </select>
                ) : null}

                {(formData.majorEthnicity === 'Others' || formData.subEthnicity === 'Others') && (
                  <input 
                    type="text" 
                    placeholder="Please specify your ethnicity"
                    value={formData.customEthnicity} 
                    onChange={e => setFormData(f => ({ ...f, customEthnicity: e.target.value }))} 
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" 
                  />
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Education" value={visibility.education} onChange={(v) => handleVisibilityChange('education', v)} />
                <div className="space-y-3">
                  <select 
                      value={formData.educationLevel} 
                      onChange={e => setFormData(f => ({ ...f, educationLevel: e.target.value, school: '', studentId: '', educationDescription: '' }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium appearance-none"
                    >
                      <option value="" disabled>Select Education Level</option>
                      <option value="High School">High School</option>
                      <option value="College">College</option>
                      <option value="University">University</option>
                      <option value="Others">Others</option>
                  </select>

                  {formData.educationLevel && (
                    <input 
                      type="text" 
                      placeholder="School / Institution Name"
                      value={formData.school} 
                      onChange={e => setFormData(f => ({ ...f, school: e.target.value }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" 
                    />
                  )}

                  {(formData.educationLevel === 'College' || formData.educationLevel === 'University') && (
                    <input 
                      type="text" 
                      placeholder="Student ID / Roll Number"
                      value={formData.studentId} 
                      onChange={e => setFormData(f => ({ ...f, studentId: e.target.value }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" 
                    />
                  )}

                  {formData.educationLevel === 'Others' && (
                    <input 
                      type="text" 
                      placeholder="Brief description about your education"
                      value={formData.educationDescription} 
                      onChange={e => setFormData(f => ({ ...f, educationDescription: e.target.value }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" 
                    />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Location" value={visibility.location} onChange={(v) => handleVisibilityChange('location', v)} />
                <input type="text" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium" />
              </div>
              
              {/* Gender dropdown */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 flex flex-col">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("Gender")}</label>
                <div className="relative">
                  <select 
                    value={formData.gender} 
                    onChange={e => setFormData(f => ({ ...f, gender: e.target.value }))} 
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium appearance-none"
                  >
                    <option value="" disabled>{t("Select Gender")}</option>
                    <option value="Male">{t("Male")}</option>
                    <option value="Female">{t("Female")}</option>
                    <option value="Non-binary">{t("Non-binary")}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <VisibilityToggle label="Bio" value={visibility.bio} onChange={(v) => handleVisibilityChange('bio', v)} />
                <textarea rows={3} value={formData.bio} onChange={e => setFormData(f => ({ ...f, bio: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none transition-all font-medium resize-none" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {croppingImage && (
        <ImageCropper 
          imageSrc={croppingImage}
          onCrop={(croppedFile) => {
            setSelectedPhoto(croppedFile);
            setPhotoPreview(URL.createObjectURL(croppedFile));
            setCroppingImage(null);
            setUploadProgress(0);
          }}
          onCancel={() => setCroppingImage(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
