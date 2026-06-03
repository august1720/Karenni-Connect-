import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ModerationResult {
  isHarmful: boolean;
  flag: 'none' | 'flag_warn' | 'flag_block';
  category: string;
  reason: string;
  confidence: number;
}

export async function checkContentModeration(text: string, image?: string): Promise<ModerationResult> {
  try {
    // Check if moderation is disabled globally in Firestore setting doc
    try {
      const settingsRef = doc(db, 'settings', 'global_moderation');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists() && settingsSnap.data().enabled === false) {
        console.log('AI Content Moderation is globally disabled in database.');
        return {
          isHarmful: false,
          flag: 'none',
          category: 'none',
          reason: 'Moderation globally disabled',
          confidence: 1.0,
        };
      }
    } catch (dbErr) {
      console.warn('Could not read global moderation settings from database, defaulting to enabled:', dbErr);
    }

    const res = await fetch('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to communicate with the content moderation API');
    }
    
    return await res.json();
  } catch (err) {
    console.error('Moderation error, failing safe:', err);
    return {
      isHarmful: false,
      flag: 'none',
      category: 'none',
      reason: '',
      confidence: 0,
    };
  }
}
