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
  "Generate Study Avatar with AI": { en: "Generate Study Avatar with AI", my: "AI ဖြင့် စာပေလေ့လာမှုပုံစံ Avatar ဖန်တီးမည်" },
  "Imagen Study Designer": { en: "Imagen Study Designer", my: "Imagen စာပေလေ့လာမှုဒီဇိုင်နာ" },
  "Study Theme": { en: "Study Theme", my: "လေ့လာမှုခေါင်းစဉ်" },
  "Computer Science & Coding": { en: "Computer Science & Coding", my: "ကွန်ပျူတာသိပ္ပံနှင့် ကုဒ်ဒင်း" },
  "Library & Literature": { en: "Library & Literature", my: "စာကြည့်တိုက်နှင့် စာပေ" },
  "Mathematics & Formulas": { en: "Mathematics & Formulas", my: "သင်္ချာနှင့် ညီမျှခြင်းများ" },
  "Creative Arts & Canvas": { en: "Creative Arts & Canvas", my: "ဖန်တီးမှုအနုပညာနှင့် ပန်းချီကား" },
  "Medical Lab & Chemistry": { en: "Medical Lab & Chemistry", my: "ဆေးဘက်ဆိုင်ရာဓာတ်ခွဲခန်းနှင့် ဓာတုဗေဒ" },
  "Space & Astronomy": { en: "Space & Astronomy", my: "အာကာသနှင့် နက္ခတ္တဗေဒ" },
  "Visual Style": { en: "Visual Style", my: "ရုပ်ပုံစတိုင်" },
  "Minimalist 3D Illustration": { en: "Minimalist 3D Illustration", my: "ရိုးရှင်းလှပသော 3D သရုပ်ဖော်ပုံ" },
  "Flat Pastel Vector Icon": { en: "Flat Pastel Vector Icon", my: "ရောင်စုံ Pastel Vector သင်္ကေတ" },
  "Retro Pixel Art / Gaming": { en: "Retro Pixel Art / Gaming", my: "ခေတ်ဟောင်း Pixel ရုပ်ပုံစတိုင်" },
  "Cute Claymation Chibi": { en: "Cute Claymation Chibi", my: "ချစ်စရာကောင်းသော ရွှံ့စေးကာတွန်းရုပ်စတိုင်" },
  "Technical Blueprint Drawing": { en: "Technical Blueprint Drawing", my: "နည်းပညာပုံကြမ်းရေးဆွဲမှုစတိုင်" },
  "Designing Avatar...": { en: "Designing Avatar...", my: "Avatar ဖန်တီးပေးနေသည်..." },
  "Generate Masterpiece": { en: "Generate Masterpiece", my: "ရုပ်ပုံဖန်တီးမည်" },
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
  "Good afternoon,": { en: "Good afternoon,", my: "မင်္ဂလာနေ့လည်ခင်းပါ၊" },
  "Good evening,": { en: "Good evening,", my: "မင်္ဂလာညနေခင်းပါ၊" },
  "Good night,": { en: "Good night,", my: "မင်္ဂလာညချမ်းပါ၊" },
  "Search posts, people, or events...": { en: "Search posts, people, or events...", my: "ပိုစ့်များ၊ လူများ သို့မဟုတ် ပွဲအစီအစဥ်များကို ရှာဖွေပါ..." },
  "Add Story": { en: "Add Story", my: "Story တင်ရန်" },
  "What's on your mind?": { en: "What do you want to share?", my: "ဘာကိုမျှဝေချင်တာလည်း" },
  "Post": { en: "Post", my: "တင်မည်" },
  "Share": { en: "Share", my: "မျှဝေမည်" },
  "Share Post": { en: "Share Post", my: "ပို့စ်အား မျှဝေရန်" },
  "Say something about this post...": { en: "Say something about this post...", my: "ဤပို့စ်နှင့်ပတ်သက်ပြီး တစ်ခုခုရေးပါ..." },
  "Share Now": { en: "Share Now", my: "ယခုပင် မျှဝေမည်" },
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
  "Only students of this school can join this group.": {
    en: "Only students of this school can join this group.",
    my: "ဤကျောင်းမှ ကျောင်းသားများသာ ဤအဖွဲ့သို့ ဝင်ရောက်ခွင့်ရှိသည်။"
  },
  "Your profile school name does not match this group's school name.": {
    en: "Your profile school name does not match this group's school name.",
    my: "သင့်ပရိုဖိုင်ရှိ ကျောင်းအမည်သည် ဤအဖွဲ့၏ ကျောင်းအမည်နှင့် ကိုက်ညီမှုမရှိပါ။"
  },
  "Group name is automatically locked to your profile's school name.": {
    en: "Group name is automatically locked to your profile's school name.",
    my: "အဖွဲ့အမည်ကို သင့်ပရိုဖိုင်ရှိ ကျောင်းအမည်အတိုင်း အလိုအလျောက် သတ်မှတ်ထားပါသည်။"
  },
  "File is too large! Please choose a file smaller than 800 KB so it can be uploaded successfully.": {
    en: "File is too large! Please choose a file smaller than 800 KB so it can be uploaded successfully.",
    my: "ဖိုင်အရွယ်အစား ကြီးလွန်းနေပါသည်။ ပိုမိုမြန်ဆန်ချောမွေ့စွာ တင်နိုင်ရန် 800 KB အောက် ဖိုင်အသေးများကိုသာ ရွေးချယ်တင်ပေးပါ။"
  },
  "Unsupported file format. Please upload PDF, Word, or PowerPoint files only.": {
    en: "Unsupported file format. Please upload PDF, Word, or PowerPoint files only.",
    my: "ဤဖိုင်အမျိုးအစားကို လက်မခံပါ။ PDF, Word, သို့မဟုတ် PowerPoint ဖိုင်များကိုသာ တင်ပေးပါ။"
  },
  "Document file": { en: "Document file", my: "စာရွက်စာတမ်း ဖိုင်" },
  "PDF Slide/Document": { en: "PDF Slide/Document", my: "PDF စာရွက်စာတမ်း" },
  "Word Document": { en: "Word Document", my: "Word စာရွက်စာတမ်း" },
  "PowerPoint presentation": { en: "PowerPoint presentation", my: "PowerPoint တင်ဆက်မှုဖိုင်" },
  "View": { en: "View", my: "ကြည့်ရှုရန်" },
  "Visit link": { en: "Visit link", my: "လင့်ခ်သို့ သွားရန်" },
  "YouTube Attachment Link": { en: "YouTube Attachment Link", my: "YouTube ဗီဒီယို လင့်ခ်" },
  "Website Attachment Link": { en: "Website Attachment Link", my: "ဝဘ်ဆိုဒ် လင့်ခ်" },
  "Clear": { en: "Clear", my: "ဖျက်ရန်" },
  "Paste website URL or YouTube watch link...": {
    en: "Paste website URL or YouTube watch link...",
    my: "ဝဘ်ဆိုဒ်လင့်ခ် သို့မဟုတ် YouTube လင့်ခ်ကို ဤနေရာတွင် ထည့်ပါ..."
  },
  "Attached Website": { en: "Attached Website", my: "ပူးတွဲ ဝဘ်ဆိုဒ်" },
  "Create Study Session": { en: "Create Study Session", my: "လေ့လာမှုအစီအစဥ် ဖန်တီးမည်" },
  "Community Mentors": { en: "Community Mentors", my: "လူထု လမ်းညွှန်ပြသသူများ" },
  "Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.": { 
    en: "Connect with experienced peers, request 1-on-1 guidance, or offer your skills to help others.", 
    my: "ဝါရင့်သူငယ်ချင်းများနှင့် ချိတ်ဆက်ပါ၊ တစ်ဦးချင်းလမ်းညွှန်မှု တောင်းဆိုပါ၊ သို့မဟုတ် အခြားသူများကို ကူညီရန် သင့်စွမ်းရည်များကို ကမ်းလှမ်းပါ။" 
  },
  "Find a Mentor": { en: "Find a Mentor", my: "လမ်းညွှန်ပြသမည့်သူ ရှာဖွေပါ" },
  "Become a Mentor": { en: "Become a Mentor", my: "လမ်းညွှန်ပြသသူ ဖြစ်လာပါ" },
  "Help others grow by sharing your academic expertise and experiences.": { en: "Help others grow by sharing your academic expertise and experiences.", my: "သင့်စာပေကျွမ်းကျင်မှုနှင့် အတွေ့အကြုံများကို ဝေမျှကာ လမ်းညွှန်ပြသပေးပါ။" },
  "Join Mentoring Community": { en: "Join Mentoring Community", my: "လမ်းညွှန်မှုအသိုင်းအဝိုင်းသို့ ဝင်မည်" },
  "You are a Mentor": { en: "You are a Mentor", my: "သင်သည် လမ်းညွှန်ပြသသူ ဖြစ်ပါသည်" },
  "Manage Mentor Profile": { en: "Manage Mentor Profile", my: "လမ်းညွှန်သူ စာမျက်နှာ ပြင်ဆင်ရန်" },
  "Leave Mentoring Mode": { en: "Leave Mentoring Mode", my: "လမ်းညွှန်သူအဖြစ်မှ ထွက်မည်" },
  "Mentor Bio": { en: "Mentor Bio", my: "လမ်းညွှန်သူ မိတ်ဆက်စကား" },
  "Mentor Subjects": { en: "Mentor Subjects", my: "သင်ကြားပြသမည့် ဘာသာရပ်များ" },
  "Availability": { en: "Availability", my: "အခွင့်သာသော အချိန်" },
  "Save Mentor Settings": { en: "Save Mentor Settings", my: "လမ်းညွှန်သူ အချက်အလက် သိမ်းမည်" },
  "Request 1-on-1 Mentorship": { en: "Request 1-on-1 Mentorship", my: "တစ်ဦးချင်း လမ်းညွှန်မှု တောင်းဆိုမည်" },
  "Send Request": { en: "Send Request", my: "တောင်းဆိုမှု ပို့မည်" },
  "Write a brief note...": { en: "Write a brief note...", my: "အကျဉ်းချုပ် ရေးသားပါ..." },
  "Mentorship Request Sent": { en: "Mentorship Request Sent", my: "လမ်းညွှန်မှု တောင်းဆိုချက် ပေးပို့ပြီးပါပြီ" },
  "Mentor Requests": { en: "Mentor Requests", my: "လမ်းညွှန်မှု တောင်းဆိုချက်များ" },
  "No mentor requests yet.": { en: "No mentor requests yet.", my: "လမ်းညွှန်မှု တောင်းဆိုချက် မရှိသေးပါ။" },
  "Accept": { en: "Accept", my: "လက်ခံမည်" },
  "Decline": { en: "Decline", my: "ပယ်ဖျက်မည်" },
  "Accepted": { en: "Accepted", my: "လက်ခံပြီးပြီ" },
  "Declined": { en: "Declined", my: "ပယ်ဖျက်ပြီးပြီ" },
  "Mentor Panel": { en: "Mentor Panel", my: "လမ်းညွှန်သူ ထိန်းချုပ်ခန်း" },
  "No mentors found matching your filters.": { en: "No mentors found matching your filters.", my: "ရှာဖွေမှုစစ်ထုတ်ချက်နှင့်ကိုက်ညီသော လမ်းညွှန်ပြသူ မတွေ့ပါ။" },
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
  "liked your post": { en: "liked your post", my: "သင့်ပို့စ်ကို သဘောကျသည်" },
  "commented on your post": { en: "commented on your post", my: "သင့်ပို့စ်တွင် မှတ်ချက်ရေးခဲ့သည်" },
  "followed you": { en: "followed you", my: "သင့်အား follow လုပ်ခဲ့သည်" },
  "created a new event": { en: "created a new event", my: "ပွဲသစ်တစ်ခု ဖန်တီးခဲ့သည်" },
  "interacted with you": { en: "interacted with you", my: "သင့်အား ဆက်သွယ်ခဲ့သည်" },
  "Read All": { en: "Read All", my: "အားလုံးဖတ်မည်" },
  "All caught up!": { en: "All caught up!", my: "အရာအားလုံး ပြီးပြည့်စုံသွားပြီ!" },
  "Loading updates...": { en: "Loading updates...", my: "အချက်အလက်အသစ်များ တင်နေသည်..." },
  "We'll let you know when people interact with your profile, posts, or events.": { en: "We'll let you know when people interact with your profile, posts, or events.", my: "လူများ သင့်ပရိုဖိုင်၊ ပို့စ်များ သို့မဟုတ် ပွဲများကို လာရောက်ကြည့်ရှု တုံ့ပြန်လျှင် အသိပေးပါမည်။" },
  "Recording...": { en: "Recording...", my: "အသံဖမ်းယူနေသည်..." },
  "Voice Note": { en: "Voice Note", my: "အသံမှတ်စု" },
  "Reply": { en: "Reply", my: "ပြန်လည်ဖြေကြားရန်" },
  "Replies": { en: "Replies", my: "တုံ့ပြန်မှုများ" },
  "Write a reply...": { en: "Write a reply...", my: "တုံ့ပြန်ချက် ရေးသားရန်..." },
  "Gender": { en: "Gender", my: "ፆတာ / ကျား၊ မ" },
  "Male": { en: "Male", my: "ကျား" },
  "Female": { en: "Female", my: "မ" },
  "Non-binary": { en: "Non-binary", my: "Non-binary" },
  "Select Gender": { en: "Select Gender", my: "ፆတာ ရွေးချယ်ပါ" },
  "Study Groups / School Groups": { en: "Study Groups / School Groups", my: "ကျောင်းသားအုပ်စုများ" },
  "School / Group Name": { en: "Group Name (School)", my: "ကျောင်း / အုပ်စု အမည်" },
  "Create Group": { en: "Create Group", my: "အုပ်စုအသစ် ဖွဲ့မည်" },
  "Join Group": { en: "Join Group", my: "အုပ်စုဝင်မည်" },
  "Joined": { en: "Joined", my: "ဝင်ပြီး" },
  "Leave Group": { en: "Leave Group", my: "အုပ်စုမှထွက်မည်" },
  "Members": { en: "Members", my: "အဖွဲ့ဝင်များ" },
  "Group members": { en: "Group members", my: "အုပ်စုဝင်ကျောင်းသားများ" },
  "Group already exists": { en: "A Group / School with this name already exists. Please choose a unique name.", my: "ဤကျောင်းအုပ်စုအမည်အား သုံးပြီးသားဖြစ်ပါသည်။ အခြားထူးခြားသော အမည်တစ်ခုကို ရွေးချယ်ပါ။" },
  "Guidelines": { en: "Guidelines", my: "စည်းကမ်းချက်များနှင့် လမ်းညွှန်ချက်များ" },
  "Group Guidelines": { en: "Group Guidelines", my: "အုပ်စုတွင်း လမ်းညွှန်ချက်များ" },
  "Guidelines & Rules (Optional)": { en: "Guidelines & Rules (Optional)", my: "လမ်းညွှန်ချက်များနှင့် စည်းကမ်းများ (ရွေးချယ်ရန်)" },
  "Write space rules or guidelines...": { en: "Write space rules or guidelines...", my: "အုပ်စုတွင်း လမ်းညွှန်ချက်များနှင့် စည်းကမ်းများ ရေးသားရန်..." },
  "Search members...": { en: "Search members...", my: "အဖွဲ့ဝင်များကို ရှာဖွေပါ..." },
  "Group name is unique and available!": { en: "Group name is unique and available!", my: "အုပ်စုအမည် အသုံးပြုနိုင်ပါသည်!" },
  "No study groups match your search.": { en: "No study groups match your search.", my: "ရှာဖွေမှုနှင့်ကိုက်ညီသော အုပ်စုများမရှိပါ။" },
  "No matching members found": { en: "No matching members found", my: "ရှာဖွေသူနှင့်ကိုက်ညီသော အဖွဲ့ဝင်များ မတွေ့ရှိပါ။" },
  "found": { en: "found", my: "တွေ့ရှိ" },
  "Manage Group": { en: "Manage Group", my: "အုပ်စုကို စီမံခန့်ခွဲမည်" },
  "Save Changes": { en: "Save Changes", my: "ပြောင်းလဲမှုများသိမ်းဆည်းမည်" },
  "Delete Group": { en: "Delete Group", my: "အုပ်စုအပြီးဖျက်မည်" },
  "Uploading cover photo...": { en: "Uploading cover photo...", my: "မျက်နှာဖုံးပုံ တင်နေသည်..." },
  "Are you sure you want to delete this study space group permanently? This action cannot be undone.": { en: "Are you sure you want to delete this study space group permanently? This action cannot be undone.", my: "ဤလေ့လာရေးအုပ်စုအား အပြီးအပိုင်ဖျက်လိုပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။" },
  "Upload Cover Banner": { en: "Upload Cover Banner", my: "မျက်နှာဖုံးနဖူးစည်းပုံ တင်ရန်" },
  "Edit Rules & Guidelines": { en: "Edit Rules & Guidelines", my: "စည်းကမ်းချက်နှင့် လမ်းညွှန်ချက်များ ပြင်ဆင်ရန်" },
  "About Group Description": { en: "About Group Description", my: "အုပ်စုအကြောင်း ဖော်ပြချက်" },
  "Are you sure you want to log out?": { en: "Are you sure you want to log out?", my: "အကောင့်မှ ထွက်ရန် သေချာပါသလား?" },
  "If you log out, you will be signed out from your account and need to log in again.": { en: "If you log out, you will be signed out of your current session.", my: "အကယ်၍ ထွက်မည်ဆိုပါက ယခု login ဝင်ထားသော အကောင့်မှ logout ဖြစ်သွားမည် ဖြစ်သည်။" },
  "Yes, Log Out": { en: "Yes, Log Out", my: "သေချာပေါက် ထွက်မည်" },
  "Password Reset Confirm": { en: "Password Reset", my: "စကားဝှက် ပြောင်းလဲခြင်း" },
  "A password reset link will be sent to": { en: "A password reset link will be sent to your email", my: "စကားဝှက်အသစ် ပြောင်းလဲသတ်မှတ်နိုင်မည့် လင့်ခ်ခလုတ်ကို ကလစ်နှိပ်ပြီး သင်၏အကောင့်အီးမေးလ် သို့ ပို့ပေးမည် ဖြစ်သည်။" },
  "You can easily change your password from that link.": { en: "You can easily change your password from that link.", my: "ထိုလင့်ခ်မှတစ်ဆင့် စကားဝှက်ကို လွယ်ကူစွာ ပြောင်းလဲနိုင်ပါသည်။" },
  "Please wait...": { en: "Please wait...", my: "ခေတ္တစောင့်ပါ..." },
  "Send Link": { en: "Send Link", my: "လင့်ခ် ပို့မည်" },
  "Email Sent!": { en: "Email Sent!", my: "အီးမေးလ် ပို့ပြီးပါပြီ!" },
  "A password reset link has been successfully sent to": { en: "A password reset link has been successfully sent to", my: "စကားဝှက်အသစ်သတ်မှတ်ရန် လင့်ခ်ကို အောင်မြင်စွာ ပို့ထားပြီး ဖြစ်သည်။" },
  "Please check your inbox or spam folder.": { en: "Please check your inbox or spam folder.", my: "ကျေးဇူးပြု၍ သင်၏ အီးမေးလ် Inbox (သို့မဟုတ် Spam folder) တွင် ဝင်ရောက်စစ်ဆေးကြည့်ပေးပါ။" },
  "Okay": { en: "Okay", my: "သိရှိပြီး (Okay)" },
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
