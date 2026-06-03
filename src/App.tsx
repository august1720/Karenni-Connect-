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
import { LoadingScreen } from './components/LoadingScreen';

import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import AIStudy from './pages/AIStudy';
import { LanguageProvider } from './context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from './lib/haptic';

// Standardized pull-to-refresh configuration for snappier and consistent gesture response
const PULL_THRESHOLD = 60;          // Required pull distance in pixels to trigger refresh
const REFRESH_HOLD_POSITION = 45;   // Active indicator position during refresh loading
const REFRESH_DURATION = 1200;      // Streamlined active anim duration (1.2s) for better responsiveness

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
    if (pullDistance >= PULL_THRESHOLD) {
      // Trigger refresh!
      setIsRefreshing(true);
      setPullDistance(REFRESH_HOLD_POSITION); // Hold at active position
      triggerHaptic(20); // Nice firm feedback
      
      // Emit the refresh event
      const refreshEvent = new CustomEvent('app-refresh');
      window.dispatchEvent(refreshEvent);

      // Auto clear after the standardized duration
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, REFRESH_DURATION);
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

  if (loading) return <LoadingScreen />;
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
            initial={{ opacity: 0, y: -60, scale: 0.6, x: "-50%" }}
            animate={{ 
              opacity: 1, 
              y: pullDistance - 20, 
              scale: isRefreshing ? 1.1 : Math.min(1.1, pullDistance / REFRESH_HOLD_POSITION) 
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 28,
              mass: 0.3,
              ease: [0.22, 1, 0.36, 1]
            }}
            exit={{ 
              opacity: 0, 
              y: -60, 
              scale: 0.6, 
              transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } 
            }}
            className="absolute left-1/2 z-50 flex items-center justify-center pt-2 select-none pointer-events-none"
            style={{ top: '15px', x: '-50%', willChange: 'transform, opacity' }}
          >
            <div className="bg-white dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-full shadow-lg border border-slate-100 dark:border-slate-800/80 flex items-center justify-center">
              
              {/* Concentric red, white, blue rings matching loading screen aesthetic */}
              <div className="relative w-8 h-8 flex items-center justify-center">
                {isRefreshing ? (
                  <>
                    {/* Ring 1 - Outermost Red */}
                    <motion.div 
                      className="absolute inset-0 rounded-full border-2 border-red-500 border-t-transparent border-b-transparent"
                      style={{ willChange: 'transform' }}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                    />
                    {/* Ring 2 - Middle White/Slate */}
                    <motion.div 
                      className="absolute w-6 h-6 rounded-full border-2 border-slate-300 dark:border-white border-l-transparent border-r-transparent"
                      style={{ willChange: 'transform' }}
                      animate={{ rotate: -360 }}
                      transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}
                    />
                    {/* Ring 3 - Innermost Blue */}
                    <motion.div 
                      className="absolute w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent border-b-transparent"
                      style={{ willChange: 'transform' }}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    />
                    {/* Golden star/dot core */}
                    <motion.div 
                      className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      style={{ willChange: 'transform' }}
                      animate={{ scale: [0.8, 1.3, 0.8] }}
                      transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut" }}
                    />
                  </>
                ) : (
                  <>
                    {/* Pulling phase concentric arcs */}
                    <motion.div 
                      className="absolute inset-0 rounded-full border-2 border-red-500 border-t-transparent border-b-transparent"
                      style={{ rotate: pullDistance * 4.5, willChange: 'transform' }}
                    />
                    <motion.div 
                      className="absolute w-6 h-6 rounded-full border-2 border-slate-300 dark:border-white/80 border-l-transparent border-r-transparent"
                      style={{ rotate: -pullDistance * 3.5, willChange: 'transform' }}
                    />
                    <motion.div 
                      className="absolute w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent border-b-transparent"
                      style={{ rotate: pullDistance * 5.5, willChange: 'transform' }}
                    />
                    <div 
                      className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 transition-transform"
                      style={{ transform: `scale(${Math.min(1.1, pullDistance / (REFRESH_HOLD_POSITION * 0.9))})`, willChange: 'transform' }}
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

