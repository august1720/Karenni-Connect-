import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';

export function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setUser({ id: snapshot.id, ...snapshot.data() } as User);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, [userId]);

  return user;
}
