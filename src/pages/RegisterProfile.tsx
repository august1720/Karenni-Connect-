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

export default function RegisterProfile() {
  const { currentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: currentUser?.displayName || '',
    username: '',
    school: '',
    location: '',
    bio: '',
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
        school: formData.school,
        location: formData.location,
        bio: formData.bio,
        interests: selectedInterests,
        skills: [],
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
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0F172A] px-4 py-12 flex flex-col items-center">
      <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm p-6 md:p-10 border border-slate-100 dark:border-slate-700/50">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">Create Profile</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Let the community know who you are.</p>
        
        {error && <div className="mb-4 p-3 bg-red-50/80 text-red-600 rounded-2xl backdrop-blur-sm border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username</label>
              <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">School</label>
              <input type="text" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Location</label>
              <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
              <textarea rows={3} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-[#D62828] outline-none text-slate-900 dark:text-white font-medium transition-all resize-none" />
            </div>
          </div>
          
          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    selectedInterests.includes(interest) 
                      ? 'bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white border-transparent shadow-md shadow-[#D62828]/20' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" disabled={loading} className="w-full mt-8">
            {loading ? 'Saving...' : 'Complete Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
