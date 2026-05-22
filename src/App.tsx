/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { LanguageProvider } from './context/LanguageContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-[#F5F7FB]/50 dark:bg-[#0F172A]/50 backdrop-blur-md"><div className="w-8 h-8 rounded-full border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin"></div></div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  // If the user hasn't created a profile yet, force them to do so before accessing the app
  if (!userProfile) return <Navigate to="/register-profile" replace />;

  const isChatRoom = location.pathname.startsWith('/messages/') && location.pathname !== '/messages';
  const hidenav = isChatRoom || location.pathname === '/settings';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-50 font-sans selection:bg-[#D62828]/20 dark:selection:bg-[#D62828]/40 transition-colors duration-300 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#D62828]/5 dark:bg-[#D62828]/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-[#1E3A8A]/5 dark:bg-[#1E3A8A]/15 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
      <main className={`flex-1 overflow-y-auto ${hidenav ? 'pb-0' : 'pb-28'} pt-8 relative z-10`}>
        <div className={`max-w-md mx-auto w-full min-h-full ${isChatRoom ? '' : 'px-4'}`}>
          {children}
        </div>
      </main>
      {!hidenav && <Navigation />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register-profile" element={<RegisterProfile />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
            <Route path="/messages/*" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/user/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          </Routes>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

