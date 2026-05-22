import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  "Education": { en: "Education", my: "ပညာရေး" },
  "Location": { en: "Location", my: "တည်နေရာ" },
  "Ethnicity": { en: "Ethnicity", my: "လူမျိုး" },
  "Bio": { en: "Bio", my: "ကိုယ်ရေးအကျဉ်း" },
  "Interests & Skills": { en: "Interests & Skills", my: "စိတ်ဝင်စားမှုနှင့် ကျွမ်းကျင်မှုများ" },
  "Interests": { en: "Interests", my: "စိတ်ဝင်စားမှုများ" },
  "Skills": { en: "Skills", my: "ကျွမ်းကျင်မှုများ" },
  "Student": { en: "Student", my: "ကျောင်းသား" },
  
  // Home page
  "Good morning,": { en: "Good morning,", my: "မင်္ဂလာနံနက်ခင်းပါ၊" },
  "Search posts, people, or events...": { en: "Search posts, people, or events...", my: "ပိုစ့်များ၊ လူများ သို့မဟုတ် ပွဲအစီအစဥ်များကို ရှာဖွေပါ..." },
  "Add Story": { en: "Add Story", my: "Story တင်ရန်" },
  "What's on your mind?": { en: "What's on your mind?", my: "ဘာတွေတွေးနေလဲ?" },
  "Post": { en: "Post", my: "တင်မည်" },
  "No updates yet.": { en: "No updates yet.", my: "ပို့စ်တင်ထားခြင်း မရှိသေးပါ။" },
  "Failed to post. Permission denied or error occurred.": { en: "Failed to post. Permission denied or error occurred.", my: "ပို့စ်တင်၍မရပါ။ ခွင့်ပြုချက်မရပါ သို့မဟုတ် ချို့ယွင်းချက်ရှိနေပါသည်။" },
  "Posting...": { en: "Posting...", my: "တင်နေသည်..." },
  
  // Discover page
  "Search Results": { en: "Search Results", my: "ရှာဖွေမှုရလဒ်များ" },
  "Suggested Partners": { en: "Suggested Partners", my: "အကြံပြုထားသော မိတ်ဖက်များ" },
  "No partners found.": { en: "No partners found.", my: "မိတ်ဖက်များ မတွေ့ပါ။" },
  "Study Groups": { en: "Study Groups", my: "လေ့လာရေးအဖွဲ့များ" },
  "Create or join learning groups to collaborate and share knowledge with your peers.": { 
    en: "Create or join learning groups to collaborate and share knowledge with your peers.", 
    my: "သူငယ်ချင်းများနှင့် ပူးပေါင်းပြီး ဗဟုသုတများ မျှဝေရန် သင်ယူမှုအဖွဲ့များ ဖန်တီးပါ သို့မဟုတ် ပူးပေါင်းပါ။" 
  },
  "Create Study Session": { en: "Create Study Session", my: "လေ့လာမှုအစီအစဥ် ဖန်တီးမည်" },
  "Community Mentors": { en: "Community Mentors", my: "လူထု လမ်းညွှန်ပြသသူများ" },
  "Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.": { 
    en: "Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.", 
    my: "ဝါရင့်သူငယ်ချင်းများနှင့် ချိတ်ဆက်ပါ၊ တစ်ဦးချင်းလမ်းညွှန်မှု တောင်းဆိုပါ၊ သို့မဟုတ် အခြားသူများကို ကူညီရန် သင့်စွမ်းရည်များကို ကမ်းလှမ်းပါ။" 
  },
  "Find a Mentor": { en: "Find a Mentor", my: "လမ်းညွှန်ပြသမည့်သူ ရှာဖွေပါ" },
  "Offers:": { en: "Offers:", my: "ကမ်းလှမ်းချက်များ -" },
  
  // Events page
  "Create New Event": { en: "Create New Event", my: "ပွဲအစီအစဥ်အသစ် ဖန်တီးမည်" },
  "Event Title": { en: "Event Title", my: "ပွဲအစီအစဥ် ခေါင်းစဉ်" },
  "Time (e.g. 2:00 PM - 4:00 PM)": { en: "Time (e.g. 2:00 PM - 4:00 PM)", my: "အချိန် (ဥပမာ ညနေ ၂:၀၀ - ညနေ ၄:၀၀)" },
  "Platform (e.g. Google Meet)": { en: "Platform (e.g. Google Meet)", my: "ပလက်ဖောင်း (ဥပမာ Google Meet)" },
  "Create": { en: "Create", my: "ဖန်တီးမည်" },
  "Featured": { en: "Featured", my: "အဓိက ပွဲအစီအစဥ်" },
  "Edu Summit": { en: "Edu Summit", my: "ပညာရေး ဆွေးနွေးပွဲ" },
  "Annual virtual gathering for all student networks.": { 
    en: "Annual virtual gathering for all student networks.", 
    my: "ကျောင်းသားကွန်ရက်အားလုံးအတွက် နှစ်ပတ်လည် အွန်လိုင်း တွေ့ဆုံပွဲ။" 
  },
  "Date & Time": { en: "Date & Time", my: "ရက်စွဲနှင့် အချိန်" },
  "Join": { en: "Join", my: "ပါဝင်မည်" },
  "Upcoming Events": { en: "Upcoming Events", my: "လာမည့် ပွဲအစီအစဉ်များ" },
  "No events found.": { en: "No events found.", my: "ပွဲအစီအစဉ်များ မတွေ့ပါ။" },
  
  // Login Page & Auth
  "Connect, learn, and grow together.": { en: "Connect, learn, and grow together.", my: "အတူတကွ ချိတ်ဆက်၊ သင်ယူပြီး ကြီးထွားလာကြပါစို့။" },
  "Email address": { en: "Email address", my: "အီးမေးလ် လိပ်စာ" },
  "Password": { en: "Password", my: "စကားဝှက်" },
  "Sign In": { en: "Sign In", my: "အကောင့်ဝင်မည်" },
  "Sign Up": { en: "Sign Up", my: "မှတ်ပုံတင်မည်" },
  "Processing...": { en: "Processing...", my: "လုပ်ဆောင်နေပါသည်..." },
  "Or continue with": { en: "Or continue with", my: "သို့မဟုတ် အောက်ပါတို့ဖြင့် ဆက်လုပ်မည်" },
  "Don't have an account? Sign up": { en: "Don't have an account? Sign up", my: "အကောင့်မရှိသေးဘူးလား? မှတ်ပုံတင်ပါ" },
  "Already have an account? Sign in": { en: "Already have an account? Sign in", my: "အကောင့်ရှိပြီးသားလား? ဝင်ရောက်ပါ" },
  
  // Messages Page
  "Search chats or friends...": { en: "Search chats or friends...", my: "ချက်တင်များ သို့မဟုတ် သူငယ်ချင်းများကို ရှာဖွေပါ..." },
  "Start a new conversation": { en: "Start a new conversation", my: "ပြောဆိုမှုအသစ် စတင်ပါ" },
  "Active now": { en: "Active now", my: "လတ်တလော အသုံးပြုနေသည်" },
  "offline": { en: "offline", my: "အော့ဖ်လိုင်း" },
  "Offline": { en: "Offline", my: "အော့ဖ်လိုင်း" },
  "Type a message...": { en: "Type a message...", my: "စာတိုရေးပါ..." },
  "Calling...": { en: "Calling...", my: "ခေါ်ဆိုနေပါသည်..." },
  
  // Other / Bots Deleted
  "Delete Bots": { en: "Delete Bot Accounts", my: "ဘော့တ်အကောင့်များဖျက်ရန်" },
  
  // Registration and General
  "Change Password": { en: "Change Password", my: "စကားဝှက် ပြောင်းလဲရန်" },
  "Send password reset email": { en: "Send password reset email", my: "စကားဝှက်အသစ်လင့်ခ် ပေးပို့မည်" },
  "Reset link sent to email": { en: "Reset link sent to email", my: "လင့်ခ်အား ပေးပို့ပြီးဖြစ်ပါသည်" },
  "Delete Account": { en: "Delete Account", my: "အကောင့်ဖျက်သိမ်းမည်" },
  "Are you sure? This will permanently delete your profile, posts, messages, and settings. This cannot be undone.": {
    en: "Are you sure? This will permanently delete your profile, posts, messages, and settings. This cannot be undone.",
    my: "သေချာပါသလား? ဤလုပ်ဆောင်ချက်သည် သင့်ကိုယ်ရေးအချက်အလက်၊ ပို့စ်များ၊ မက်ဆေ့ခ်ျနှင့် ပြင်ဆင်ချက်များကို အပြီးတိုင် ဖျက်ဆီးမည်ဖြစ်ပြီး ပြန်လည်ရယူနိုင်မည် မဟုတ်ပါ။"
  },
  "Cancel": { en: "Cancel", my: "မလုပ်တော့ပါ" },
  "Delete": { en: "Delete", my: "ဖျက်မည်" },
  "Create Profile": { en: "Create Profile", my: "ပရိုဖိုင်ဖန်တီးပါ" },
  "Profile Picture": { en: "Profile Picture", my: "ပရိုဖိုင်ဓာတ်ပုံ" },
  "Select a nice photo of yourself so friends can recognize you": { en: "Select a nice photo of yourself so friends can recognize you", my: "သူငယ်ချင်းများ သင့်ကိုမှတ်မိစေရန် သင့်ပုံ တင်သွင်းပါ" },
  "Tell us a bit about yourself...": { en: "Tell us a bit about yourself...", my: "သင့်အကြောင်း အနည်းငယ် မျှဝေပါ..." },
  "Next": { en: "Next", my: "ရှေ့သို့" },
  "Back": { en: "Back", my: "နောက်သို့" },
  "Complete Profile": { en: "Complete Profile", my: "စတင်အသုံးပြုမည်" },
  "Let the community know who you are. You can choose what to share publicly.": { 
    en: "Let the community know who you are. You can choose what to share publicly.", 
    my: "သင့်ကိုယ်သင် ကွန်ရက်အား မိတ်ဆက်ပေးပါ။ မည်သည့်အရာကို လူသိရှင်ကြား မျှဝေမည်ကို စိတ်ကြိုက်ရွေးချယ်ပါ။" 
  },
  "Full Name": { en: "Full Name", my: "အမည်အပြည့်အစုံ" },
  "Username": { en: "Username", my: "အသုံးပြုသူအမည်" },
  "Education Level": { en: "Education Level", my: "ပညာအရည်အချင်း" },
  "School / Institution Name": { en: "School / Institution Name", my: "ကျောင်း / တက္ကသိုလ် အမည်" },
  "Student ID / Roll Number": { en: "Student ID / Roll Number", my: "ကျောင်းသား ကတ်အမှတ် / ခုံနံပါတ်" },
  "Select Major Ethnicity": { en: "Select Major Ethnicity", my: "အဓိက ကရင်နီလူမျိုးစု ရွေးချယ်ပါ" },
  "Select Subgroup": { en: "Select Subgroup", my: "မျိုးနွယ်စုခွဲ ရွေးချယ်ပါ" },
  "Please specify your ethnicity": { en: "Please specify your ethnicity", my: "မျိုးနွယ်စုအမည်အား ဖော်ပြပေးပါ" },
  "Select Education Level": { en: "Select Education Level", my: "ပညာအရည်အချင်း အဆင့်အတန်း ရွေးချယ်ပါ" },
  "Step 1: Bio & Profile Picture": { en: "Step 1: Bio & Profile Picture", my: "အဆင့် ၁ - ကိုယ်ရေးအချက်အလက်နှင့် သင့်ပုံရိပ်" },
  "Step 2: Basic & Contact Details": { en: "Step 2: Account Details", my: "အဆင့် ၂ - မိတ်ဆက်နှင့် နေရပ်လိပ်စာ" },
  "Step 3: Identity & Education": { en: "Step 3: Background & Education", my: "အဆင့် ၃ - လူမျိုးစုနှင့် ပညာရေးနောက်ခံ" },
  "Skip Profile Picture": { en: "Skip Photo", my: "ဓာတ်ပုံကျော်ရန်" },
  "Upload Custom Image": { en: "Upload Image", my: "ပုံတင်ယူရန်" },
  "Uploading Profile Photo...": { en: "Uploading Photo...", my: "ဓာတ်ပုံ တင်သွင်းနေသည်..." },
  "Failed to upload photo": { en: "Failed to upload photo", my: "ဓာတ်ပုံ တင်သွင်း၍ မရပါ" },
  "Crop Profile Picture": { en: "Crop Profile Picture", my: "ပရိုဖိုင်ပုံအား ညှိယူရန်" },
  "Drag to position & slide to zoom": { en: "Drag to position & slide to zoom", my: "ပုံအား လိုချင်သလိုရွှေ့ပြီး ချဲ့နိုင်သည်" },
  "Apply": { en: "Apply", my: "အသုံးပြုမည်" },
};

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
  changeLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: (key: string) => key,
  changeLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { userProfile, currentUser, refreshProfile } = useAuth();
  const [localLanguage, setLocalLanguage] = useState<Language>(
    (localStorage.getItem('language') as Language) || 'en'
  );

  const language = (userProfile?.settings?.language as Language) || localLanguage;

  useEffect(() => {
    if (userProfile?.settings?.language) {
      const dbLang = userProfile.settings.language as Language;
      setLocalLanguage(dbLang);
      localStorage.setItem('language', dbLang);
    }
  }, [userProfile?.settings?.language]);

  const changeLanguage = async (newLang: Language) => {
    setLocalLanguage(newLang);
    localStorage.setItem('language', newLang);
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          'settings.language': newLang
        });
        await refreshProfile();
      } catch (e) {
        console.error('Error saving language selection:', e);
      }
    }
  };

  const t = (key: string) => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
