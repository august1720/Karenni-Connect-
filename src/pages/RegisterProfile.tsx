import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

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

const VisibilityToggle = ({ label, value, onChange }: { label: string, value: Visibility, onChange: (v: Visibility) => void }) => {
  return (
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => onChange('public')}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${value === 'public' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Public
        </button>
        <button
          type="button"
          onClick={() => onChange('private')}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${value === 'private' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Private
        </button>
      </div>
    </div>
  );
};

export default function RegisterProfile() {
  const { currentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const userId = currentUser.uid;
      await setDoc(doc(db, 'users', userId), {
        name: formData.name,
        username: formData.username,
        educationLevel: formData.educationLevel,
        school: formData.school,
        studentId: formData.studentId,
        educationDescription: formData.educationDescription,
        location: formData.location,
        bio: formData.bio,
        interests: selectedInterests,
        skills: [],
        majorEthnicity: formData.majorEthnicity,
        subEthnicity: formData.subEthnicity,
        customEthnicity: formData.customEthnicity,
        visibility: visibility,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0F172A] px-4 py-8 md:py-12 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm p-6 md:p-10 border border-slate-100 dark:border-slate-700/50">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">Create Profile</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Let the community know who you are. You can choose what to share publicly.</p>
        
        {error && <div className="mb-4 p-3 bg-red-50/80 text-red-600 rounded-2xl backdrop-blur-sm border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            
            {/* Full Name */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Full Name" value={visibility.name} onChange={(v) => handleVisibilityChange('name', v)} />
              <input required type="text" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>

            {/* Username */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Username" value={visibility.username} onChange={(v) => handleVisibilityChange('username', v)} />
              <input required type="text" placeholder="@johndoe" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>

            {/* Ethnicity */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
               <VisibilityToggle label="Ethnicity" value={visibility.ethnicity} onChange={(v) => handleVisibilityChange('ethnicity', v)} />
               <div className="space-y-3 mt-1">
                 <select 
                    value={formData.majorEthnicity} 
                    onChange={e => setFormData({...formData, majorEthnicity: e.target.value, subEthnicity: '', customEthnicity: ''})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
                  >
                    <option value="" disabled>Select Major Ethnicity</option>
                    {MAJOR_ETHNICITIES.map(eth => (
                      <option key={eth} value={eth}>{eth}</option>
                    ))}
                  </select>

                  {formData.majorEthnicity && SUB_ETHNICITIES_MAP[formData.majorEthnicity] && (
                    <select 
                      value={formData.subEthnicity} 
                      onChange={e => setFormData({...formData, subEthnicity: e.target.value, customEthnicity: ''})} 
                      className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
                    >
                      <option value="" disabled>Select Subgroup</option>
                      {SUB_ETHNICITIES_MAP[formData.majorEthnicity].map(eth => (
                        <option key={eth} value={eth}>{eth}</option>
                      ))}
                    </select>
                  )}

                  {(formData.majorEthnicity === 'Others' || formData.subEthnicity === 'Others') && (
                    <input 
                      type="text" 
                      placeholder="Please specify your ethnicity"
                      value={formData.customEthnicity} 
                      onChange={e => setFormData({...formData, customEthnicity: e.target.value})} 
                      className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                    />
                  )}
               </div>
            </div>

            {/* Education */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Education" value={visibility.education} onChange={(v) => handleVisibilityChange('education', v)} />
              <div className="space-y-3 mt-1">
                <select 
                    value={formData.educationLevel} 
                    onChange={e => setFormData({...formData, educationLevel: e.target.value, school: '', studentId: '', educationDescription: ''})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all appearance-none"
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
                    onChange={e => setFormData({...formData, school: e.target.value})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                  />
                )}

                {(formData.educationLevel === 'College' || formData.educationLevel === 'University') && (
                  <input 
                    type="text" 
                    placeholder="Student ID / Roll Number"
                    value={formData.studentId} 
                    onChange={e => setFormData({...formData, studentId: e.target.value})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                  />
                )}

                {formData.educationLevel === 'Others' && (
                  <input 
                    type="text" 
                    placeholder="Brief description about your education"
                    value={formData.educationDescription} 
                    onChange={e => setFormData({...formData, educationDescription: e.target.value})} 
                    className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" 
                  />
                )}
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Location" value={visibility.location} onChange={(v) => handleVisibilityChange('location', v)} />
              <input type="text" placeholder="City, Country" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all mt-1" />
            </div>

            {/* Bio */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Bio" value={visibility.bio} onChange={(v) => handleVisibilityChange('bio', v)} />
              <textarea rows={3} placeholder="Tell us a bit about yourself..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full mt-1 px-5 py-4 rounded-[1.25rem] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all resize-none" />
            </div>
            
            {/* Interests */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
              <VisibilityToggle label="Interests" value={visibility.interests} onChange={(v) => handleVisibilityChange('interests', v)} />
              <div className="flex flex-wrap gap-2 mt-2">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      selectedInterests.includes(interest) 
                        ? 'bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white border-transparent shadow-md shadow-[#D62828]/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2">
            <Button type="submit" size="lg" disabled={loading} className="w-full text-lg rounded-2xl h-14 bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white border-none shadow-xl shadow-[#D62828]/20 hover:shadow-[#D62828]/40 transition-all font-bold">
              {loading ? 'Creating Profile...' : 'Complete Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
