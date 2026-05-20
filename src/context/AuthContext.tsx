import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
