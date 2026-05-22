import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, language, changeLanguage } = useLanguage();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || `Failed to ${isLogin ? 'log in' : 'sign up'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'my' : 'en');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] dark:bg-[#0F172A] p-4 relative overflow-hidden">
      {/* Floating Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 bg-white/85 dark:bg-slate-800/85 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-sm border border-slate-200/65 dark:border-slate-700/50 hover:shadow transition-all group scale-95 hover:scale-100"
        >
          <Globe className="w-4 h-4 text-slate-500 group-hover:text-[#D62828] transition-colors" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {language === 'en' ? 'မြန်မာ' : 'English'}
          </span>
        </button>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#D62828]/20 dark:bg-[#D62828]/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#1E3A8A]/20 dark:bg-[#1E3A8A]/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700/50 relative z-10">
        <div className="text-center">
          <div className="w-24 h-24 bg-white dark:bg-slate-700 rounded-3xl mx-auto flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow mb-6 overflow-hidden border border-slate-100/80 dark:border-slate-600/50">
            <img 
              src="/icon.png" 
              alt="Logo" 
              className="w-full h-full object-cover" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector('.fallback-logo')) {
                  const fallback = document.createElement('div');
                  fallback.className = "fallback-logo w-full h-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center font-bold text-white text-3xl";
                  fallback.innerText = "K";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("Karenni Youth Hub")}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {t("Connect, learn, and grow together.")}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-2xl text-center backdrop-blur-sm border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-5">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder={t("Email address")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D62828] transition-all font-medium"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder={t("Password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D62828] transition-all font-medium"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? t('Processing...') : isLogin ? t('Sign In') : t('Sign Up')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white dark:bg-slate-800 text-slate-500 font-medium">
                {t("Or continue with")}
              </span>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            variant="glass"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#D62828] dark:hover:text-[#FCA5A5] transition-colors"
            >
              {isLogin ? t("Don't have an account? Sign up") : t("Already have an account? Sign in")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
