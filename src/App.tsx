/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import RegisterProfile from './pages/RegisterProfile';
import Discover from './pages/Discover';
import Events from './pages/Events';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Navigation from './components/Navigation';

import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import AIStudy from './pages/AIStudy';
import { LanguageProvider } from './context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from './lib/haptic';

function ProtectedRoute() {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  const [forceHideNav, setForceHideNav] = React.useState(false);

  // Pull to refresh gesture states
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const touchStartY = React.useRef(0);
  const isPullActive = React.useRef(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const mainEl = mainRef.current;
    if (mainEl && mainEl.scrollTop === 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPullActive.current = true;
    } else {
      isPullActive.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPullActive.current || isRefreshing) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      // Damping resistance to make pulling feel springy
      const dist = Math.min(100, deltaY * 0.4);
      setPullDistance(dist);
      
      // If we pull down significantly, prevent default scrolling so bounce-scrolling is suppressed
      if (dist > 15 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (isRefreshing) return;
    isPullActive.current = false;
    if (pullDistance >= 60) {
      // Trigger refresh!
      setIsRefreshing(true);
      setPullDistance(45); // Hold at active position
      triggerHaptic(20); // Nice firm feedback
      
      // Emit the refresh event
      const refreshEvent = new CustomEvent('app-refresh');
      window.dispatchEvent(refreshEvent);

      // Auto clear after 1.5s
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1500);
    } else {
      setPullDistance(0);
    }
  };

  // Keep track of scroll positions of each page component
  const scrollPositions = React.useRef<Record<string, number>>({});
  const mainRef = React.useRef<HTMLDivElement | null>(null);
  const prevPathname = React.useRef<string>(location.pathname);

  React.useEffect(() => {
    const handleHide = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setForceHideNav(customEvent.detail);
    };
    window.addEventListener('hide-bottom-bar', handleHide);
    return () => {
      window.removeEventListener('hide-bottom-bar', handleHide);
    };
  }, []);

  React.useEffect(() => {
    if (userProfile?.settings?.theme) {
      const root = window.document.documentElement;
      const theme = userProfile.settings.theme;
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      localStorage.setItem('theme', theme);
    }
  }, [userProfile?.settings?.theme]);

  // Track and restore scroll positions on navigation to prevent state/scroll resets
  React.useEffect(() => {
    const mainEl = mainRef.current;
    if (mainEl && prevPathname.current) {
      scrollPositions.current[prevPathname.current] = mainEl.scrollTop;
    }

    const nextScrollTop = scrollPositions.current[location.pathname] || 0;
    
    // Smooth frame deferred layout update to ensure elements are updated first
    const timeout = setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = nextScrollTop;
      }
    }, 50);

    prevPathname.current = location.pathname;
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-[#F5F7FB]/50 dark:bg-[#0F172A]/50 backdrop-blur-md"><div className="w-8 h-8 rounded-full border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin"></div></div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  // If the user hasn't created a profile yet, force them to do so before accessing the app
  if (!userProfile) return <Navigate to="/register-profile" replace />;

  const isHome = location.pathname === '/';
  const isDiscover = location.pathname === '/discover' || location.pathname.startsWith('/discover');
  const isAIStudy = location.pathname === '/ai-study';
  const isMessages = location.pathname.startsWith('/messages');
  const isEvents = location.pathname === '/events';
  const isProfile = location.pathname === '/profile';
  
  const isSettings = location.pathname === '/settings';
  const isUserProfile = location.pathname.startsWith('/user/');

  const isChatRoom = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
  const hidenav = isChatRoom || isSettings || forceHideNav;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-50 font-sans selection:bg-[#D62828]/20 dark:selection:bg-[#D62828]/40 transition-colors duration-300 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#D62828]/5 dark:bg-[#D62828]/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#1E3A8A]/5 dark:bg-[#1E3A8A]/15 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      {/* Premium Magical Pull to Refresh Indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              y: pullDistance - 20, 
              scale: isRefreshing ? 1.05 : Math.min(1, pullDistance / 45) 
            }}
            exit={{ opacity: 0, y: -50, scale: 0.8, transition: { duration: 0.25 } }}
            className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pt-2 select-none pointer-events-none"
            style={{ top: '15px' }}
          >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-slate-200/50 dark:border-slate-800/80 flex items-center justify-center">
              
              {/* Magical Double-Orb Rotating Circles */}
              <div className="relative w-6 h-6 flex items-center justify-center">
                {isRefreshing ? (
                  <>
                    {/* Pulsing ring */}
                    <motion.div 
                      className="absolute inset-0 rounded-full border border-[#D62828]/25 dark:border-red-500/25"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                      transition={{ scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }, opacity: { repeat: Infinity, duration: 1.5, ease: "easeInOut" } }}
                    />
                    {/* Rotating segmented arc */}
                    <motion.svg 
                      className="absolute inset-0 w-full h-full text-[#1E3A8A] dark:text-blue-500" 
                      viewBox="0 0 24 24"
                      animate={{ rotate: 360 }}
                      transition={{ rotate: { repeat: Infinity, duration: 0.8, ease: "linear" } }}
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" cy="12" r="10" 
                        stroke="currentColor" strokeWidth="3" fill="none" 
                      />
                      <path 
                        className="opacity-100" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                      />
                    </motion.svg>
                    {/* Glowing magic inner orb */}
                    <motion.div 
                      className="w-2.5 h-2.5 rounded-full bg-[#D62828] dark:bg-red-500 shadow-sm"
                      animate={{ scale: [0.8, 1.2, 0.8] }}
                      transition={{ scale: { repeat: Infinity, duration: 1.2, ease: "easeInOut" } }}
                    />
                  </>
                ) : (
                  <>
                    {/* Rotation matching pull distance */}
                    <motion.svg 
                      className="w-full h-full text-slate-400 dark:text-slate-500" 
                      viewBox="0 0 24 24"
                      style={{ rotate: pullDistance * 4 }}
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" cy="12" r="10" 
                        stroke="currentColor" strokeWidth="2.5" fill="none" 
                      />
                      <circle 
                        cx="12" cy="12" r="10" 
                        stroke="currentColor" strokeWidth="2.5" fill="none" 
                        strokeDasharray="63"
                        strokeDashoffset={63 - (63 * Math.min(100, (pullDistance / 60) * 100)) / 100}
                        strokeLinecap="round"
                        className="text-[#D62828] dark:text-red-400"
                      />
                    </motion.svg>
                    {/* Floating static center core */}
                    <div 
                      className="absolute w-2 h-2 rounded-full bg-[#1E3A8A] dark:bg-blue-400 transition-transform"
                      style={{ transform: `scale(${Math.min(1, pullDistance / 40)})` }}
                    />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main 
        ref={mainRef} 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 overflow-y-auto ${hidenav ? 'pb-0' : 'pb-28'} pt-8 relative z-10`}
      >
        <div className={`max-w-md mx-auto w-full min-h-full ${isChatRoom ? '' : 'px-4'}`}>
          {/* Keep primary tabs persistently mounted to avoid refreshes and state resets */}
          <div style={{ display: isHome ? 'block' : 'none' }} className="w-full">
            <Home />
          </div>
          <div style={{ display: isDiscover ? 'block' : 'none' }} className="w-full">
            <Discover />
          </div>
          <div style={{ display: isAIStudy ? 'block' : 'none' }} className="w-full">
            <AIStudy />
          </div>
          <div style={{ display: isMessages ? 'block' : 'none' }} className="w-full">
            <Messages />
          </div>
          <div style={{ display: isEvents ? 'block' : 'none' }} className="w-full">
            <Events />
          </div>
          <div style={{ display: isProfile ? 'block' : 'none' }} className="w-full">
            <Profile />
          </div>

          {/* Sub-pages like Settings and Personal profiles render normally via Outlet */}
          <Outlet />
        </div>
      </main>
      {!hidenav && <Navigation />}
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    const root = window.document.documentElement;
    const localTheme = localStorage.getItem('theme') || 'system';
    
    const applyTheme = (t: string) => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };
    
    applyTheme(localTheme);

    // Sync with media query alterations
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const currentTheme = localStorage.getItem('theme') || 'system';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register-profile" element={<RegisterProfile />} />
            
            {/* Safe persistent nested DOM shell */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={null} />
              <Route path="/discover" element={null} />
              <Route path="/ai-study" element={null} />
              <Route path="/messages/*" element={null} />
              <Route path="/events" element={null} />
              <Route path="/profile" element={null} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/user/:id" element={<UserProfile />} />
            </Route>
          </Routes>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

