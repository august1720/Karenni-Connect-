import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User as UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setUserProfile({ id: snapshot.id, ...snapshot.data() } as UserProfile);
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            setUserProfile({ id: snapshot.id, ...snapshot.data() } as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.error(err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser || !userProfile) return;

    const updatePresence = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          lastSeen: Date.now()
        });
      } catch (err) {
        console.error('Error updating presence lastSeen:', err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 45000); // 45 seconds

    return () => clearInterval(interval);
  }, [currentUser, !!userProfile]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
