import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Language = 'en' | 'my';

interface Translations {
  [key: string]: {
    en: string;
    my: string;
  };
}

const translations: Translations = {
  // Navigation
  "Home": { en: "Home", my: "ပင်မစာမျက်နှာ" },
  "Discover": { en: "Discover", my: "ရှာဖွေရန်" },
  "Events": { en: "Events", my: "ပွဲအစီအစဥ်များ" },
  "Messages": { en: "Messages", my: "စာတိုများ" },
  "Profile": { en: "Profile", my: "ကိုယ်ရေးအကျဉ်း" },
  "Settings": { en: "Settings", my: "ဆက်တင်များ" },
  
  // Settings
  "Account": { en: "Account", my: "အကောင့်" },
  "Appearance": { en: "Appearance", my: "အသွင်အပြင်" },
  "Light Mode": { en: "Light Mode", my: "အလင်းစနစ်" },
  "Dark Mode": { en: "Dark Mode", my: "အမှောင်စနစ်" },
  "Privacy & Security": { en: "Privacy & Security", my: "လုံခြုံရေး" },
  "Private Profile": { en: "Private Profile", my: "ကိုယ်ရေးကိုယ်တာလုံခြုံမှု" },
  "Only approved followers can see posts": { en: "Only approved followers can see posts", my: "ခွင့်ပြုသူများသာ ပို့စ်များကိုမြင်နိုင်သည်" },
  "Two-Factor Authentication": { en: "Two-Factor Authentication", my: "အဆင့်နှစ်ဆင့်အတည်ပြုခြင်း" },
  "Add an extra layer of security": { en: "Add an extra layer of security", my: "လုံခြုံရေးအတွက်နောက်ထပ်အလွှာထပ်ထည့်ပါ" },
  "Active Sessions": { en: "Active Sessions", my: "အသက်ဝင်သောအကောင့်ဝင်မှုများ" },
  "Notifications": { en: "Notifications", my: "အသိပေးချက်များ" },
  "Push Notifications": { en: "Push Notifications", my: "Push အသိပေးချက်များ" },
  "Message Sounds": { en: "Message Sounds", my: "မက်ဆေ့ချ်အသံများ" },
  "Language": { en: "Language", my: "ဘာသာစကား" },
  "App Language": { en: "App Language", my: "အက်ပ် ဘာသာစကား" },
  "Media": { en: "Media", my: "မီဒီယာ" },
  "Compress Uploads": { en: "Compress Uploads", my: "ပုံများချုံ့တင်ရန်" },
  "Larger Text Mode": { en: "Larger Text Mode", my: "စာလုံးကြီးစနစ်" },
  
  // Profile
  "Edit Profile": { en: "Edit Profile", my: "အချက်အလက်ကိုပြင်ရန်" },
  "Photos": { en: "Photos", my: "ဓာတ်ပုံများ" },
  "Followers": { en: "Followers", my: "Follower များ" },
  "Following": { en: "Following", my: "Following များ" },
  "Posts": { en: "Posts", my: "ပို့စ်များ" },
  "No bio yet": { en: "No bio yet. Tap Edit Profile to add one.", my: "Bio မရှိသေးပါ။ ပြင်ဆင်ရန် အချက်အလက်ကိုပြင်ရန် ကိုနှိပ်ပါ။" },
  "Log Out": { en: "Log Out", my: "ထွက်မည်" },
  
  // Create Post
  "What's on your mind?": { en: "What's on your mind?", my: "ဘာတွေတွေးနေလဲ?" },
  "Post": { en: "Post", my: "တင်မည်" },
  "Delete Bots": { en: "Delete Bot Accounts", my: "ဘော့တ်အကောင့်များဖျက်ရန်" },
};

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const language = (userProfile?.settings?.language as Language) || 'en';

  const t = (key: string) => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
