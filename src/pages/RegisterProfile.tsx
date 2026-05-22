import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { Camera, ArrowRight, ArrowLeft, Image as ImageIcon, Sparkles, Globe, User, Check, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INTERESTS = [
  'Programming', 'Design', 'Video Editing', 'English',
  'Photography', 'Music', 'Sports', 'Content Creation'
];

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

interface VisibilityToggleProps {
  label: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
}

const VisibilityToggle = ({ label, value, onChange }: VisibilityToggleProps) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between mb-3 bg-white/50 dark:bg-slate-800/30 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700/30">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t(label)}</label>
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => onChange('public')}
          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
            value === 'public' 
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t("Public")}
        </button>
        <button
          type="button"
          onClick={() => onChange('private')}
          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
            value === 'private' 
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t("Private")}
        </button>
      </div>
    </div>
  );
};

export default function RegisterProfile() {
  const { currentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    name: currentUser?.displayName || '',
    username: '',
    educationLevel: '',
    school: '',
    studentId: '',
    educationDescription: '',
    location: '',
    bio: '',
    majorEthnicity: '',
    subEthnicity: '',
    customEthnicity: '',
  });

  const [visibility, setVisibility] = useState<Record<string, Visibility>>({
    name: 'public',
    username: 'public',
    education: 'public',
    location: 'public',
    bio: 'public',
    interests: 'public',
    ethnicity: 'public'
  });

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Image Upload States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleVisibilityChange = (field: string, val: Visibility) => {
    setVisibility(prev => ({ ...prev, [field]: val }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError(t('Max photo file size is 2MB'));
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'my' : 'en');
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    
    // Step Validations
    if (step === 1) {
      // Bio step is optional but encouraged
      setStep(2);
    } else if (step === 2) {
      if (!formData.name.trim()) {
        setError(t('Full Name is required'));
        return;
      }
      if (!formData.username.trim() || formData.username.trim().length < 3) {
        setError(t('Username must be at least 3 characters'));
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    // Validate final fields
    if (!formData.name.trim() || !formData.username.trim()) {
      setError(t('Please fill all required details in Step 2'));
      setStep(2);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setUploadProgress(t('Uploading Profile Photo...'));
      
      let photoURLStr = '';

      // Upload profile image to storage if selected
      if (imageFile) {
        const imageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
        await uploadBytes(imageRef, imageFile);
        photoURLStr = await getDownloadURL(imageRef);
      }

      setUploadProgress(t('Saving Profile...'));
      const userId = currentUser.uid;

      await setDoc(doc(db, 'users', userId), {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase().replace(/\s+/g, ''),
        photoURL: photoURLStr || currentUser.photoURL || '',
        educationLevel: formData.educationLevel,
        school: formData.school.trim(),
        studentId: formData.studentId.trim(),
        educationDescription: formData.educationDescription.trim(),
        location: formData.location.trim(),
        bio: formData.bio.trim(),
        interests: selectedInterests,
        skills: [],
        majorEthnicity: formData.majorEthnicity,
        subEthnicity: formData.subEthnicity,
        customEthnicity: formData.customEthnicity,
        visibility: visibility,
        settings: {
          theme: 'light',
          language: language,
          isPrivate: false,
          notifications: {
            push: true,
            messages: true
          },
          media: {
            compress: true
          },
          accessibility: {
            largerText: false
          }
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('Failed to create profile.'));
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0F172A] px-4 py-8 md:py-12 flex flex-col items-center relative overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-[-10%] left-[-10%] w-[30vh] h-[30vh] bg-[#D62828]/5 dark:bg-[#D62828]/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vh] h-[30vh] bg-[#1E3A8A]/5 dark:bg-[#1E3A8A]/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Floating Language Bar */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 bg-white/85 dark:bg-slate-800/85 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 hover:shadow transition-all font-bold scale-95 active:scale-95"
        >
          <Globe className="w-4 h-4 text-slate-500" />
          <span className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {language === 'en' ? 'မြန်မာ' : 'English'}
          </span>
        </button>
      </div>

      <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm p-6 md:p-10 border border-slate-100 dark:border-slate-700/50 relative z-10 my-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
            {t("Create Profile")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed max-w-sm mx-auto">
            {t("Let the community know who you are. You can choose what to share publicly.")}
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3.5">
            <span className={step === 1 ? 'text-[#D62828] dark:text-[#FCA5A5]' : ''}>
              {t("Step 1")}
            </span>
            <span className={step === 2 ? 'text-[#1E3A8A] dark:text-indigo-300' : ''}>
              {t("Step 2")}
            </span>
            <span className={step === 3 ? 'text-emerald-500' : ''}>
              {t("Step 3")}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex gap-0.5">
            <div className={`h-full rounded-full transition-all duration-300 ${step >= 1 ? 'w-1/3 bg-[#D62828]' : 'w-0'}`}></div>
            <div className={`h-full rounded-full transition-all duration-300 ${step >= 2 ? 'w-1/3 bg-[#1E3A8A]' : 'w-0'}`}></div>
            <div className={`h-full rounded-full transition-all duration-300 ${step >= 3 ? 'w-1/3 bg-emerald-500' : 'w-0'}`}></div>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50/80 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold border border-red-100 dark:border-red-900/40 text-center animate-wiggle">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: PHOTO & BIO */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="text-center bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <span className="block text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">
                    {t("Step 1: Bio & Profile Picture")}
                  </span>
                  
                  {/* Photo picker circular component */}
                  <div className="relative w-28 h-28 mx-auto mt-4 mb-3 group">
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="Profile preview" 
                        className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md transition-transform group-hover:scale-105" 
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#1E3A8A] to-[#D62828] text-white flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
                        <User className="w-9 h-9 stroke-[1.25] mb-1" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFF-80]">{t("Photo")}</span>
                      </div>
                    )}
                    
                    <label className="absolute bottom-0 right-0 bg-[#D62828] hover:bg-rose-600 text-white p-2.5 rounded-full shadow-lg cursor-pointer transition-all hover:scale-110 active:scale-95 flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4 max-w-xs mx-auto leading-relaxed">
                    {t("Select a nice photo of yourself so friends can recognize you")}
                  </p>

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(''); }}
                      className="text-xs font-bold text-rose-500 hover:underline inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("Remove Photo")}
                    </button>
                  )}
                </div>

                {/* Bio text field */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Bio" value={visibility.bio} onChange={(v) => handleVisibilityChange('bio', v)} />
                  <textarea 
                    rows={4} 
                    placeholder={t("Tell us a bit about yourself...")} 
                    value={formData.bio} 
                    maxLength={300}
                    onChange={e => setFormData({...formData, bio: e.target.value})} 
                    className="w-full mt-2 px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all resize-none shadow-inner" 
                  />
                  <div className="flex justify-end text-[11px] text-slate-400 font-bold mt-1.5 uppercase select-none">
                    {formData.bio.length} / 300
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DETAILS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="text-center mb-1 select-none">
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    {t("Step 2: Basic & Contact Details")}
                  </span>
                </div>

                {/* Full Name */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Full Name" value={visibility.name} onChange={(v) => handleVisibilityChange('name', v)} />
                  <input 
                    required 
                    type="text" 
                    placeholder="John Doe" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                  />
                </div>

                {/* Username */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Username" value={visibility.username} onChange={(v) => handleVisibilityChange('username', v)} />
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg select-none">@</span>
                    <input 
                      required 
                      type="text" 
                      placeholder="johndoe" 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})} 
                      className="w-full pl-10 pr-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Location" value={visibility.location} onChange={(v) => handleVisibilityChange('location', v)} />
                  <input 
                    type="text" 
                    placeholder="Malo, Kayah State" 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: ETHNICITY & EDUCATION */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="text-center mb-1 select-none">
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    {t("Step 3: Identity & Education")}
                  </span>
                </div>

                {/* Ethnicity */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Ethnicity" value={visibility.ethnicity} onChange={(v) => handleVisibilityChange('ethnicity', v)} />
                  <div className="space-y-3.5 mt-1">
                    <select 
                      value={formData.majorEthnicity} 
                      onChange={e => setFormData({...formData, majorEthnicity: e.target.value, subEthnicity: '', customEthnicity: ''})} 
                      className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
                    >
                      <option value="" disabled>{t("Select Major Ethnicity")}</option>
                      {MAJOR_ETHNICITIES.map(eth => (
                        <option key={eth} value={eth}>{t(eth)}</option>
                      ))}
                    </select>

                    {formData.majorEthnicity && SUB_ETHNICITIES_MAP[formData.majorEthnicity] && (
                      <select 
                        value={formData.subEthnicity} 
                        onChange={e => setFormData({...formData, subEthnicity: e.target.value, customEthnicity: ''})} 
                        className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
                      >
                        <option value="" disabled>{t("Select Subgroup")}</option>
                        {SUB_ETHNICITIES_MAP[formData.majorEthnicity].map(eth => (
                          <option key={eth} value={eth}>{t(eth)}</option>
                        ))}
                      </select>
                    )}

                    {(formData.majorEthnicity === 'Others' || formData.subEthnicity === 'Others') && (
                      <input 
                        type="text" 
                        placeholder={t("Please specify your ethnicity")}
                        value={formData.customEthnicity} 
                        onChange={e => setFormData({...formData, customEthnicity: e.target.value})} 
                        className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                      />
                    )}
                  </div>
                </div>

                {/* Education */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Education" value={visibility.education} onChange={(v) => handleVisibilityChange('education', v)} />
                  <div className="space-y-3.5 mt-1">
                    <select 
                      value={formData.educationLevel} 
                      onChange={e => setFormData({...formData, educationLevel: e.target.value, school: '', studentId: '', educationDescription: ''})} 
                      className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
                    >
                      <option value="" disabled>{t("Select Education Level")}</option>
                      <option value="High School">{t("High School")}</option>
                      <option value="College">{t("College")}</option>
                      <option value="University">{t("University")}</option>
                      <option value="Others">{t("Others")}</option>
                    </select>

                    {formData.educationLevel && (
                      <input 
                        type="text" 
                        placeholder={t("School / Institution Name")}
                        value={formData.school} 
                        onChange={e => setFormData({...formData, school: e.target.value})} 
                        className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                      />
                    )}

                    {(formData.educationLevel === 'College' || formData.educationLevel === 'University') && (
                      <input 
                        type="text" 
                        placeholder={t("Student ID / Roll Number")}
                        value={formData.studentId} 
                        onChange={e => setFormData({...formData, studentId: e.target.value})} 
                        className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                      />
                    )}

                    {formData.educationLevel === 'Others' && (
                      <input 
                        type="text" 
                        placeholder={t("Brief description about your education")}
                        value={formData.educationDescription} 
                        onChange={e => setFormData({...formData, educationDescription: e.target.value})} 
                        className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                      />
                    )}
                  </div>
                </div>

                {/* Interests */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/40">
                  <VisibilityToggle label="Interests" value={visibility.interests} onChange={(v) => handleVisibilityChange('interests', v)} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {INTERESTS.map(interest => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                          selectedInterests.includes(interest) 
                            ? 'bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white border-transparent shadow shadow-[#D62828]/25' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload loading indicator */}
          {uploadProgress && (
            <div className="flex items-center justify-center gap-3 py-2 text-slate-500 dark:text-slate-400 font-bold text-xs select-none uppercase tracking-wider animate-pulse">
              <div className="w-4.5 h-4.5 rounded-full border-2 border-[#D62828] border-t-transparent animate-spin"></div>
              {uploadProgress}
            </div>
          )}

          {/* Stepper Wizard Navigation Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-700/40 mt-6 select-none">
            {step > 1 && (
              <Button 
                type="button" 
                onClick={handlePrevStep} 
                variant="glass" 
                size="lg" 
                disabled={loading}
                className="flex-1 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-2xl md:h-13 font-bold transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2 stroke-[2.25]" />
                {t("Back")}
              </Button>
            )}
            
            {step < 3 ? (
              <Button 
                type="button" 
                onClick={handleNextStep} 
                size="lg" 
                className="flex-1 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white rounded-2xl md:h-13 font-bold shadow-lg hover:shadow-xl shadow-[#D62828]/15 hover:shadow-[#D62828]/30 border-none transition-all"
              >
                {t("Next")}
                <ArrowRight className="w-4 h-4 ml-2 stroke-[2.25]" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                size="lg" 
                disabled={loading} 
                className="flex-1 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white rounded-2xl md:h-13 font-bold shadow-xl hover:shadow-2xl shadow-[#D62828]/20 hover:shadow-[#D62828]/40 border-none transition-all"
              >
                {loading ? t('Processing...') : t('Complete Profile')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
