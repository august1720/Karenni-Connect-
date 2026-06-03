import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  UploadCloud, 
  BookOpen, 
  MessageSquare, 
  CheckCircle, 
  HelpCircle, 
  FileText, 
  Trash2, 
  Send, 
  Bookmark, 
  Globe, 
  Plus, 
  FileCode, 
  X,
  Compass,
  Zap,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  BookMarked,
  Mic,
  MicOff,
  Flame,
  Link
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptic';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  content: string;
  isCustom?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface StudyPlanMilestone {
  phase: string;
  topics: string;
  tasks: string;
}

interface StudyPlan {
  title: string;
  milestones: StudyPlanMilestone[];
  tips: string;
}

interface QuizResult {
  id: string;
  timestamp: string;
  score: number;
  total: number;
  topic: string;
  weakPoints: string[];
}

// Preset sources cleared to keep empty slate for user-uploaded documents
const DEFAULT_PRESETS: DocumentFile[] = [];

const cleanMathText = (text: string): string => {
  if (!text) return "";
  let res = text
    // Replace $c^2$ or similar power notation with standard superscript
    .replace(/\$([a-zA-Z0-9])\^2\$/g, '$1²')
    .replace(/\$([a-zA-Z0-9])\^2/g, '$1²')
    .replace(/([a-zA-Z0-9])\^2/g, '$1²')
    .replace(/\$([a-zA-Z0-9])\^3\$/g, '$1³')
    .replace(/\$([a-zA-Z0-9])\^3/g, '$1³')
    .replace(/([a-zA-Z0-9])\^3/g, '$1³');

  // Strip double display dollars
  res = res.replace(/\$\$([\s\S]+?)\$\$/g, '$1');

  // Strip single dollars wrapping variables or math text expressions
  res = res.replace(/\$([^\$]+?)\$/g, '$1');

  return res;
};

export default function AIStudy() {
  const { t } = useLanguage();
  const { userProfile } = useAuth();
  
  // State files
  const [documents, setDocuments] = useState<DocumentFile[]>(DEFAULT_PRESETS);
  const [activeTab, setActiveTab] = useState<'notebook' | 'chat' | 'quiz' | 'flashcards' | 'explain' | 'plan' | 'analytics'>('notebook');
  
  // Editor / Input modal states
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Debounced auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Flashcards Streak gamification states
  const [flashcardStreak, setFlashcardStreak] = useState(0);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);

  // Performance Analytics states
  const [wrongQuestions, setWrongQuestions] = useState<string[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([
    {
      id: 'history-v1',
      timestamp: new Date(Date.now() - 3600 * 1000 * 24).toLocaleDateString() + ' 04:30 PM',
      score: 3,
      total: 5,
      topic: 'Cellular Respiration Study Phase',
      weakPoints: ['Electron Transport Chain details', 'Cytoplasm anaerobic pathways']
    },
    {
      id: 'history-v2',
      timestamp: new Date(Date.now() - 3600 * 1000 * 12).toLocaleDateString() + ' 10:15 AM',
      score: 5,
      total: 5,
      topic: 'Relational DBMS Introduction',
      weakPoints: ['None! Perfect Score! 🎉']
    }
  ]);

  // Microphone Voice Chat state & ref
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition toggler
  const startListening = () => {
    triggerHaptic(15);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("ဝမ်းနည်းပါသည်။ သင့် Browser သို့မဟုတ် Platform တွင် အသံဖမ်းစနစ် (Speech Recognition) မထောက်ပံ့ပါ။ Please open inside modern Safari/Chrome browser!");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setNewChatInput(prev => prev + (prev ? " " : "") + transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Debounced auto-save effect for custom document pastor editor
  useEffect(() => {
    const savedTitle = localStorage.getItem('notebook_draft_title');
    const savedContent = localStorage.getItem('notebook_draft_content');
    if (savedTitle) setPastedTitle(savedTitle);
    if (savedContent) setPastedContent(savedContent);
  }, []);

  useEffect(() => {
    if (!pastedTitle && !pastedContent) {
      setAutoSaveStatus('idle');
      return;
    }
    
    setAutoSaveStatus('saving');
    const handler = setTimeout(() => {
      localStorage.setItem('notebook_draft_title', pastedTitle);
      localStorage.setItem('notebook_draft_content', pastedContent);
      setAutoSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(handler);
  }, [pastedTitle, pastedContent]);

  // AI Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      content: "မင်္ဂလာပါ! ကျွန်တော်က သင်လေ့လာနေတဲ့ သင်ခန်းစာ စာရွက်စာတမ်းတွေကို အနီးကပ် လမ်းညွှန်ရှင်းပြပေးမယ့် AI Study Notebook ဖြစ်ပါတယ်။\n\nဘယ်ဘက် (သို့မဟုတ်) အပေါ်က စာမျက်နှာတွေတင်ပြီး မေးခွန်းများမေးမြန်းနိုင်သလို၊ အနှစ်ချုပ် Summarize လုပ်ခိုင်းခြင်း သို့မဟုတ် Quiz/Flashcards များ ထုတ်ခိုင်းနိုင်ပါတယ်!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [newChatInput, setNewChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quick Action Result states
  const [summaryOutput, setSummaryOutput] = useState<string>('');
  const [simpleExplanation, setSimpleExplanation] = useState<string>('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  // Status Loaders
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  // Quiz active states
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Flashcards active states
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Auto scroll chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  // Handle manual additions
  const handleAddTextDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedTitle.trim() || !pastedContent.trim()) return;

    triggerHaptic(15);
    const newDoc: DocumentFile = {
      id: `custom-${Date.now()}`,
      name: pastedTitle.endsWith('.txt') ? pastedTitle : `${pastedTitle}.txt`,
      type: "text/plain",
      size: `${(pastedContent.length / 1024).toFixed(1)} KB`,
      uploadedAt: new Date().toLocaleDateString(),
      content: pastedContent,
      isCustom: true
    };

    setDocuments([newDoc, ...documents]);
    setSelectedDocs(prev => [...prev, newDoc.id]);
    localStorage.removeItem('notebook_draft_title');
    localStorage.removeItem('notebook_draft_content');
    setPastedTitle('');
    setPastedContent('');
    setAutoSaveStatus('idle');
    setIsAddingDoc(false);
  };

  // Handle URL (YouTube/Web site) content resolver
  const handleResolveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    triggerHaptic(15);
    setIsResolvingUrl(true);
    try {
      const response = await fetch('/api/resolve-url', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl })
      });

      if (!response.ok) {
        throw new Error("Failed to extract data from this link.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const title = data.title || "Study Reference";
      const content = data.content || "";

      const isYoutube = inputUrl.toLowerCase().includes('youtube.com') || inputUrl.toLowerCase().includes('youtu.be');
      const docName = isYoutube ? `🎥 YouTube: ${title}` : `🌐 Web: ${title}`;

      const newDoc: DocumentFile = {
        id: `url-${Date.now()}`,
        name: docName,
        type: isYoutube ? "video/youtube" : "text/html",
        size: `${(content.length / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        content: content,
        isCustom: true
      };

      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDocs(prev => [...prev, newDoc.id]);
      setInputUrl('');
      setIsAddingLink(false);
    } catch (err: any) {
      console.error(err);
      alert(t("Error analyzing link: ") + err.message);
    } finally {
      setIsResolvingUrl(false);
    }
  };

  // Simulated local scanner (Image Upload)
  const handleImageOCRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(20);
    const reader = new FileReader();
    reader.onload = () => {
      // Create a gorgeous mock-extracted OCR material
      const fileName = file.name;
      const contentPool = [
        `[OCR Book Scan - Extracting "${fileName}"]\n\nChapter Study: Chemical Elements and Bonding.\nAtoms combine together through chemical bonds to achieve electronic stability (usually a complete octet of 8 outer shell valency electrons).\n1. Ionic Bond: Formed when metals transfer valence electrons to non-metals, producing oppositely charged ions stabilized by strong electrostatic forces. Example: Sodium Chloride (NaCl).\n2. Covalent Bond: Formed by the sharing of electron pairs between non-metal atoms. Single, double, or triple bonds can occur. Highly localized, creating molecules like Water (H2O) and Carbon Dioxide (CO2).\n3. Metallic Bond: Formed by the attraction of positive metallic cations to a highly mobile delocalized 'sea' of electrons. Provides high conductivity and ductility properties.`,
        `[OCR Book Scan - Extracting "${fileName}"]\n\nNewton's Laws of Motion:\nFirst Law (Inertia): Every body remains in a state of rest or uniform motion unless acted upon by an external net force.\nSecond Law (F = ma): Force is equal to mass multiplied by acceleration. Acceleration is directly proportional to net force and inversely proportional to mass.\nThird Law (Action & Reaction): To every action, there is an equal and opposite reaction.`
      ];

      // Add document
      const randomContent = contentPool[Math.floor(Math.random() * contentPool.length)];
      const newDoc: DocumentFile = {
        id: `scanned-${Date.now()}`,
        name: `📷 Scanned_${fileName.split('.')[0]}.txt`,
        type: file.type || "image/png",
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        content: randomContent,
        isCustom: true
      };

      setDocuments([newDoc, ...documents]);
      setSelectedDocs(prev => [...prev, newDoc.id]);
    };
    reader.readAsDataURL(file);
  };

  // Load pdf.js dynamically from CDN of the requested version
  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = (e) => reject(new Error("Failed to load PDF parsing engine from secure CDN."));
      document.head.appendChild(script);
    });
  };

  // Handle PDF book upload and extract clean text
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(20);
    setIsParsingPdf(true);
    try {
      const pdfjsLib = await loadPdfJS();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      const textValue = fullText.trim();
      if (!textValue) {
        alert("The selected PDF file does not contain any machine-readable text.");
        setIsParsingPdf(false);
        return;
      }

      const newDoc: DocumentFile = {
        id: `pdf-${Date.now()}`,
        name: file.name,
        type: "application/pdf",
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        content: textValue,
        isCustom: true
      };

      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDocs(prev => [...prev, newDoc.id]);
    } catch (err: any) {
      console.error(err);
      alert("Error parsing PDF file: " + err.message);
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Handle standard document text upload
  const handleTextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(15);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string || "";
      const newDoc: DocumentFile = {
        id: `uploaded-${Date.now()}`,
        name: file.name,
        type: file.type || "text/plain",
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        content: text,
        isCustom: true
      };
      setDocuments([newDoc, ...documents]);
      setSelectedDocs(prev => [...prev, newDoc.id]);
    };
    reader.readAsText(file);
  };

  const deleteDoc = (id: string) => {
    triggerHaptic(20);
    setDocuments(documents.filter(doc => doc.id !== id));
    setSelectedDocs(selectedDocs.filter(d => d !== id));
  };

  const toggleSelectDoc = (id: string) => {
    triggerHaptic(8);
    if (selectedDocs.includes(id)) {
      setSelectedDocs(selectedDocs.filter(d => d !== id));
    } else {
      setSelectedDocs([...selectedDocs, id]);
    }
  };

  // Formulate documents text representation to feed the backend
  const getSelectedDocumentsData = () => {
    return documents
      .filter(doc => selectedDocs.includes(doc.id))
      .map(doc => ({
        name: doc.name,
        type: doc.type,
        content: doc.content
      }));
  };

  // Action handlers
  const handleSummarize = async () => {
    if (selectedDocs.length === 0) return;
    triggerHaptic(12);
    setActiveTab('explain'); // we can show simple terms, or we map to specialized sections
    setIsSummaryLoading(true);
    setSummaryOutput('');

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize',
          documents: getSelectedDocumentsData()
        })
      });
      const data = await resp.json();
      if (data.summary) {
        setSummaryOutput(data.summary);
      }
    } catch (e) {
      console.error(e);
      setSummaryOutput("မော်ဒယ်ဆာဗာသို့ ချိတ်ဆက်၍မရပါ။ စာရွက်စာတမ်း အနှစ်ချူပ်ခြင်း မအောင်မြင်ပါ။");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleExplainSimply = async () => {
    if (selectedDocs.length === 0) return;
    triggerHaptic(12);
    setActiveTab('explain');
    setIsExplanationLoading(true);
    setSimpleExplanation('');

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explain',
          documents: getSelectedDocumentsData()
        })
      });
      const data = await resp.json();
      if (data.explanation) {
        setSimpleExplanation(data.explanation);
      }
    } catch (e) {
      console.error(e);
      setSimpleExplanation("မြန်မာလို ရိုးရှင်းစွာ ရှင်းလင်းချက် ထုတ်ယူခြင်း မအောင်မြင်ပါ။");
    } finally {
      setIsExplanationLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (selectedDocs.length === 0) return;
    triggerHaptic(15);
    setActiveTab('quiz');
    setIsQuizLoading(true);
    setQuizQuestions([]);
    setQuizStarted(false);
    setQuizFinished(false);
    setCurrentQuizIndex(0);
    setSelectedQuizAnswer(null);
    setShowExplanation(false);
    setWrongQuestions([]);

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quiz',
          documents: getSelectedDocumentsData(),
          count: 10
        })
      });
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuizQuestions(data);
      } else {
        throw new Error("Invalid format received");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (selectedDocs.length === 0) return;
    triggerHaptic(15);
    setActiveTab('flashcards');
    setIsFlashcardsLoading(true);
    setActiveFlashcards([]);
    setCurrentFlashcardIndex(0);
    setIsCardFlipped(false);

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'flashcards',
          documents: getSelectedDocumentsData()
        })
      });
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        setActiveFlashcards(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFlashcardsLoading(false);
    }
  };

  const handleGenerateStudyPlan = async () => {
    if (selectedDocs.length === 0) return;
    triggerHaptic(15);
    setActiveTab('plan');
    setIsPlanLoading(true);
    setStudyPlan(null);

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          documents: getSelectedDocumentsData()
        })
      });
      const data = await resp.json();
      if (data && data.milestones) {
        setStudyPlan(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlanLoading(false);
    }
  };

  // Grounded Chat workflow
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim() || isChatLoading) return;

    triggerHaptic(10);
    const userMessage: ChatMessage = {
      id: `chat-user-${Date.now()}`,
      role: 'user',
      content: newChatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMessage]);
    setNewChatInput('');
    setIsChatLoading(true);

    // Build chat history context (last 6 messages to keep tokens within limits)
    const historyPayload = chatMessages
      .filter(m => m.id !== 'welcome-msg')
      .slice(-6)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    try {
      const resp = await fetch('/api/ai-notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          documents: getSelectedDocumentsData(),
          message: userMessage.content,
          history: historyPayload
        })
      });

      const data = await resp.json();
      const aiReply: ChatMessage = {
        id: `chat-ai-${Date.now()}`,
        role: 'model',
        content: data.text || "ပြန်လည်ဖြေကြားမှုကို မရယူနိုင်ပါ။",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiReply]);
    } catch (e) {
      console.error(e);
      const errorReply: ChatMessage = {
        id: `chat-err-${Date.now()}`,
        role: 'model',
        content: "ဆာဗာချိတ်ဆက်မှု မအောင်မြင်ပါ။ စာရွက်စာတမ်း သို့မဟုတ် အင်တာနက်ကို စစ်ဆေးပေးပါ။",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorReply]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Interactive Quiz handlers
  const handleAnswerQuizSelect = (option: string) => {
    if (selectedQuizAnswer !== null) return;
    triggerHaptic(12);
    setSelectedQuizAnswer(option);
    setShowExplanation(true);

    if (option === quizQuestions[currentQuizIndex].answer) {
      setQuizScore(prev => prev + 1);
    } else {
      setWrongQuestions(prev => [...prev, quizQuestions[currentQuizIndex].question]);
    }
  };

  const handleNextQuizQuestion = () => {
    triggerHaptic(10);
    setSelectedQuizAnswer(null);
    setShowExplanation(false);

    if (currentQuizIndex + 1 < quizQuestions.length) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      // Finished the quiz! Add to history
      const newResult: QuizResult = {
        id: `res-${Date.now()}`,
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: quizScore,
        total: quizQuestions.length,
        topic: selectedDocs.length > 0 
          ? documents.filter(d => selectedDocs.includes(d.id)).map(d => d.name.replace('.txt', '')).join(', ')
          : 'General Grounded Materials',
        weakPoints: wrongQuestions.length > 0 ? wrongQuestions : ['None! Perfect Score! 🎉']
      };
      setQuizHistory(prev => [newResult, ...prev]);
      setQuizFinished(true);
    }
  };

  const handleFlashcardGotIt = () => {
    triggerHaptic(15);
    setIsCardFlipped(false);
    
    // Increment streak
    const nextStreak = flashcardStreak + 1;
    setFlashcardStreak(nextStreak);
    
    if (nextStreak === 5) {
      setShowStreakAnimation(true);
    }
    
    // Go to next card if available
    if (currentFlashcardIndex + 1 < activeFlashcards.length) {
      setCurrentFlashcardIndex(prev => prev + 1);
    } else {
      setCurrentFlashcardIndex(0);
    }
  };

  const handleFlashcardReviewAgain = () => {
    triggerHaptic(10);
    setIsCardFlipped(false);
    setFlashcardStreak(0); // break streak
    
    if (currentFlashcardIndex + 1 < activeFlashcards.length) {
      setCurrentFlashcardIndex(prev => prev + 1);
    } else {
      setCurrentFlashcardIndex(0);
    }
  };

  // Streak animation timeout effect
  useEffect(() => {
    if (showStreakAnimation) {
      const timer = setTimeout(() => {
        setShowStreakAnimation(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showStreakAnimation]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Upper Status Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 to-[#1E3A8A] dark:from-[#1E293B] dark:to-[#0F172A] text-white px-6 py-8 rounded-3xl shadow-xl shadow-indigo-200/50 dark:shadow-none mb-6">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between relative z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
              <Sparkles className="w-8 h-8 text-[#FCA5A5] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full text-blue-200">NotebookLM Myanmar</span>
              </div>
              <h1 className="text-2xl font-black mt-1">AI Study Notebook</h1>
              <p className="text-sm text-blue-100/80 mt-1">Grounded active recall study workspace.</p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg px-4 py-2.5 rounded-2xl border border-white/15 text-xs">
            <div className="font-semibold text-blue-200">Grounding Status</div>
            <div className="font-bold text-white mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              {selectedDocs.length} of {documents.length} Source{selectedDocs.length !== 1 ? 's' : ''} Selected
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        
        {/* Left Column: Documents & Sources (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-base">Study Materials</h2>
              </div>
            </div>

            {/* Upload Area */}
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              <label className="flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition duration-300 bg-slate-50/50 dark:bg-[#1E293B] text-center">
                <UploadCloud className="w-5 h-5 text-indigo-500 mb-1" />
                <span className="text-[10px] font-bold text-slate-500">Text Notes</span>
                <input 
                  type="file" 
                  accept=".txt" 
                  onChange={handleTextUpload} 
                  className="hidden" 
                />
              </label>

              <label className="flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-rose-450 dark:hover:border-rose-550 cursor-pointer transition duration-300 bg-slate-50/50 dark:bg-[#1E293B] text-center">
                <FileText className="w-5 h-5 text-rose-500 mb-1" />
                <span className="text-[10px] font-bold text-slate-500">PDF File</span>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handlePdfUpload} 
                  className="hidden" 
                />
              </label>

              <label className="flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition duration-300 bg-slate-50/50 dark:bg-[#1E293B] text-center">
                <Globe className="w-5 h-5 text-blue-500 mb-1" />
                <span className="text-[10px] font-bold text-slate-500">Scan OCR</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageOCRUpload} 
                  className="hidden" 
                />
              </label>

              <button 
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  setIsAddingLink(prev => !prev);
                  setIsAddingDoc(false);
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed cursor-pointer transition duration-300 text-center ${
                  isAddingLink 
                    ? 'border-emerald-500 bg-emerald-50/25 dark:bg-emerald-950/20' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 bg-slate-50/50 dark:bg-[#1E293B]'
                }`}
              >
                <Link className="w-5 h-5 text-emerald-500 mb-1" />
                <span className="text-[10px] font-bold text-slate-500">Link / YouTube</span>
              </button>
            </div>

            {/* YouTube or Website Link Form */}
            <AnimatePresence>
              {isAddingLink && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleResolveUrl}
                  className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl mb-4 border border-emerald-200/50 dark:border-emerald-900/30 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Add Link or YouTube Resource</span>
                    <button type="button" onClick={() => setIsAddingLink(false)} className="text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input 
                    type="url" 
                    placeholder="E.g. https://www.youtube.com/watch?v=... or website URL" 
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#1E293B] mb-2 focus:outline-none focus:border-emerald-500"
                  />
                  {isResolvingUrl ? (
                    <div className="w-full py-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing link content...</span>
                    </div>
                  ) : (
                    <button 
                      type="submit"
                      className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                    >
                      Extract Study Material
                    </button>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

            {/* Document Creation Modal in list */}
            <AnimatePresence>
              {isAddingDoc && (
                <motion.form 
                   initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddTextDocument}
                  className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl mb-4 border border-indigo-200/50 dark:border-indigo-900/30 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Add Pasted Textbook Lesson</span>
                    <button type="button" onClick={() => setIsAddingDoc(false)} className="text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Lesson title e.g. chemistry unit 1" 
                    value={pastedTitle}
                    onChange={(e) => setPastedTitle(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#1E293B] mb-2 focus:outline-none focus:border-indigo-500"
                  />
                  <textarea 
                    placeholder="Paste definitions, lecture notes, textbook chapters here..." 
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    required
                    rows={4}
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#1E293B] mb-2 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-end mb-2 px-1">
                    <span className="text-[10px] text-slate-400 h-4">
                      {autoSaveStatus === 'saving' && <span className="animate-pulse text-indigo-500 font-semibold">✍️ Saving draft...</span>}
                      {autoSaveStatus === 'saved' && <span className="text-emerald-500 font-semibold">💾 Draft auto-saved!</span>}
                    </span>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    Load Document
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Document Files List */}
            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
              {isParsingPdf && (
                <div className="p-3 bg-red-50/40 dark:bg-rose-950/20 border border-red-300 dark:border-rose-900 border-dashed rounded-2xl flex items-center justify-center gap-2 animate-pulse">
                  <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[11px] font-bold text-rose-500 dark:text-rose-450">Converting PDF text...</span>
                </div>
              )}
              {documents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
                  No documents found. Upload text or scan images above to start!
                </div>
              ) : (
                documents.map(doc => {
                  const isSelected = selectedDocs.includes(doc.id);
                  return (
                    <motion.div 
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`group p-3 rounded-2xl border transition duration-300 relative ${
                        isSelected 
                          ? 'bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/45 dark:border-indigo-800/80' 
                          : 'bg-slate-50/50 border-slate-200 dark:bg-slate-900/30 border-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDoc(doc.id)}
                          className="mt-1 accent-indigo-600 rounded cursor-pointer"
                        />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelectDoc(doc.id)}>
                          <div className="font-bold text-xs truncate max-w-[190px]">{doc.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                            <span className="uppercase tracking-wider px-1 bg-slate-200 dark:bg-slate-800 rounded">{doc.type.split('/')[1] || 'txt'}</span>
                            <span>•</span>
                            <span>{doc.size}</span>
                          </div>
                        </div>

                        {doc.isCustom && (
                          <button 
                            onClick={() => deleteDoc(doc.id)}
                            className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition absolute right-2.5 top-2.5"
                            title="Remove document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Action Buttons Tray */}
          <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md">
            <h3 className="text-sm font-extrabold mb-3 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Grounding Assistant Hub
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Select documents above, then tap any fast action button below to let Gemini instantly extract value:
            </p>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleExplainSimply}
                disabled={selectedDocs.length === 0 || isExplanationLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-900/30 font-bold text-xs text-left hover:scale-[1.01] transition duration-200 flex items-center justify-between disabled:opacity-40"
              >
                <span>💡 Explain in Simple Terms (Burmese)</span>
                {isExplanationLoading && <div className="w-3.5 h-3.5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button 
                onClick={handleGenerateQuiz}
                disabled={selectedDocs.length === 0 || isQuizLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/30 font-bold text-xs text-left hover:scale-[1.01] transition duration-200 flex items-center justify-between disabled:opacity-40"
              >
                <span>📝 Generate 10 MCQ Practice Quiz</span>
                {isQuizLoading && <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button 
                onClick={handleGenerateFlashcards}
                disabled={selectedDocs.length === 0 || isFlashcardsLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-900/30 font-bold text-xs text-left hover:scale-[1.01] transition duration-200 flex items-center justify-between disabled:opacity-40"
              >
                <span>🏷️ Generate Active Recall Flashcards</span>
                {isFlashcardsLoading && <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button 
                onClick={handleGenerateStudyPlan}
                disabled={selectedDocs.length === 0 || isPlanLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/30 font-bold text-xs text-left hover:scale-[1.01] transition duration-200 flex items-center justify-between disabled:opacity-40"
              >
                <span>📅 Formulate 5-Day Study Lesson Plan</span>
                {isPlanLoading && <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
              </button>

              <button 
                onClick={handleSummarize}
                disabled={selectedDocs.length === 0 || isSummaryLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-900/30 font-bold text-xs text-left hover:scale-[1.01] transition duration-200 flex items-center justify-between disabled:opacity-40"
              >
                <span>📚 Compile Main Summary Sheet</span>
                {isSummaryLoading && <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Grounded Workspace Area (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col min-h-[500px]">
          
          {/* Tabs header */}
          <div className="flex overflow-x-auto bg-white dark:bg-[#1E293B] p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm mb-4 scrollbar-thin whitespace-nowrap min-w-0">
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('notebook'); }}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'notebook' || activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              💬 Chat
            </button>
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('explain'); }}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'explain' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              💡 Terms
            </button>
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('quiz'); }}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'quiz' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📝 Quiz
            </button>
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('flashcards'); }}
              className={`flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'flashcards' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🏷️ Flashcards ({activeFlashcards.length})
            </button>
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('plan'); }}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'plan' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📅 Plan
            </button>
            <button 
              onClick={() => { triggerHaptic(8); setActiveTab('analytics'); }}
              className={`flex-1 min-w-[100px] py-2 px-2.5 rounded-xl text-xs font-bold transition duration-300 ${
                activeTab === 'analytics' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📊 Analytics
            </button>
          </div>

          {/* Tab Screen render */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md p-6 h-[500px] overflow-hidden">
            
            {/* TABS: Conversational Grounded Chat (Default) */}
            {(activeTab === 'notebook' || activeTab === 'chat') && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Floating active documentation anchor */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2 rounded-xl border border-indigo-200/40 dark:border-indigo-900/30 flex items-center justify-between text-[11px] mb-4">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                    <BookMarked className="w-4 h-4" />
                    <span>Selected grounding context covers {selectedDocs.length} files</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{selectedDocs.length > 0 ? "Grounding active" : "Global Knowledge Base"}</span>
                </div>

                {/* Messages Box scrollable */}
                <div className="flex-1 overflow-y-auto pr-1 mb-4 space-y-4">
                  {chatMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                          isUser 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-slate-50 dark:bg-slate-900/60 shadow-sm border border-slate-200/40 dark:border-slate-800 rounded-bl-none'
                        }`}>
                          <div className="whitespace-pre-line leading-relaxed">{cleanMathText(msg.content)}</div>
                          <div className={`text-[9px] mt-1.5 text-right ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl px-4 py-3 rounded-bl-none">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping delay-150"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Form sending block */}
                <form onSubmit={handleSendChatMessage} className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={startListening}
                    title="Speak your question verbally"
                    className={`p-3 rounded-2xl border transition duration-200 flex items-center justify-center relative ${
                      isListening
                        ? 'bg-red-550 border-red-500 text-white animate-pulse'
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      </>
                    ) : (
                      <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </button>
                  <input 
                    type="text" 
                    placeholder={selectedDocs.length > 0 ? "Ask a question about the uploaded document contents..." : "Upload documents or type a general query here..."}
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    className="flex-1 text-xs px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 focus:outline-none focus:border-indigo-500"
                  />
                  <button 
                    type="submit"
                    disabled={isChatLoading || !newChatInput.trim()}
                    className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TABS: Simple terms explanations & notes summaries */}
            {activeTab === 'explain' && (
              <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-[#D62828] text-sm">💡 Simple Burmese Explanations & Summaries</h3>
                </div>

                {isExplanationLoading || isSummaryLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-[#D62828] border-t-transparent animate-spin mb-4"></div>
                    <p className="text-xs text-slate-400">Gemini သည် စာရွက်စာတမ်းများမှ ရိုးရှင်းသောမြန်မာလို ရှင်းလင်းချက်များ ထုတ်နှုတ်နေပါသည်...</p>
                  </div>
                ) : !simpleExplanation && !summaryOutput ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <BookOpen className="w-12 h-12 text-indigo-400 mb-3 opacity-30" />
                    <p className="text-xs text-slate-400">ဘယ်ဘက် Sources ဘောက်စ်မှ စာရွက်ကိုရွေးပြီး <strong className="text-indigo-500 font-bold">"Explain Simply"</strong> သို့မဟုတ် <strong className="text-indigo-500 font-bold">"Compile Summary"</strong> ခလုပ်များကိုနှိပ်ပါ!</p>
                  </div>
                ) : (
                  <div className="space-y-6 text-xs leading-relaxed max-w-none prose dark:prose-invert">
                    {simpleExplanation && (
                      <div className="bg-orange-50/50 dark:bg-orange-950/10 p-5 rounded-2xl border border-orange-200/50 dark:border-orange-900/20 shadow-sm whitespace-pre-line">
                        {cleanMathText(simpleExplanation)}
                      </div>
                    )}
                    {summaryOutput && (
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/20 shadow-sm whitespace-pre-line">
                        {cleanMathText(summaryOutput)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TABS: Robust practice quiz */}
            {activeTab === 'quiz' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-emerald-600 text-sm">📝 Practicing Active Test Quiz ({quizQuestions.length} Questions)</h3>
                  {quizQuestions.length > 0 && !quizFinished && (
                    <span className="text-[10px] font-bold text-slate-400">Progress: {currentQuizIndex + 1}/{quizQuestions.length}</span>
                  )}
                </div>

                {isQuizLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mb-4"></div>
                    <p className="text-xs text-slate-400">Gemini သည် တင်ထားသော သင်ရိုးများအပေါ် အခြေခံ၍ MCQ မေးခွန်းများ ထုတ်လုပ်ပေးနေပါသည်...</p>
                  </div>
                ) : quizQuestions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <FileCode className="w-12 h-12 text-emerald-400 mb-3 opacity-30" />
                    <p className="text-xs text-slate-400">တင်ထားသော သင်ခန်းစာလေ့လာရန် စာရွက်များ (ဥပမာ- Biology Chapter 3) ကိုရွေးပြီး ဘယ်ဘက်မှ <strong className="text-emerald-500">"Generate Quiz"</strong> ခလုပ်ကို နှိပ်ပါ!</p>
                  </div>
                ) : !quizStarted && !quizFinished ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <Award className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
                    <h3 className="text-base font-black">AI MCQ Practice Quiz Ready!</h3>
                    <p className="text-xs text-slate-400 mt-2">Gemini has carefully reading compiled {quizQuestions.length} multiple-choice test questions tailored strictly to your grounded study notes to ensure active visual memory recall.</p>
                    <button 
                      onClick={() => { triggerHaptic(15); setQuizStarted(true); }}
                      className="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                      Start Practicing Test Now
                    </button>
                  </div>
                ) : quizFinished ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <Award className="w-16 h-16 text-amber-500 mb-4" />
                    <h3 className="text-lg font-black">Practice Quiz Completed!</h3>
                    <div className="text-3xl font-black text-emerald-600 mt-2">{quizScore} / {quizQuestions.length}</div>
                    <p className="text-xs text-slate-400 mt-2">
                      You achieved a retention score of {((quizScore / quizQuestions.length) * 100).toFixed(0)}%! Regular testing improves long-term memory retrieval strength.
                    </p>
                    <button 
                      onClick={handleGenerateQuiz}
                      className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold"
                    >
                      Try New Randomized Quiz
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between overflow-hidden h-full">
                    <div className="space-y-4 mb-4">
                      {/* Progress Line */}
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300" 
                          style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 relative overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentQuizIndex}
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          transition={{ duration: 0.22, ease: "easeInOut" }}
                          className="absolute inset-0 flex flex-col justify-between overflow-y-auto pr-1"
                        >
                          <div className="space-y-4">
                            <div className="font-extrabold text-xs text-slate-500 tracking-wider">QUESTION {currentQuizIndex + 1}</div>
                            <h4 className="text-sm font-bold leading-relaxed">{cleanMathText(quizQuestions[currentQuizIndex].question)}</h4>

                            <div className="grid grid-cols-1 gap-2.5 mt-4">
                              {quizQuestions[currentQuizIndex].options.map((option, idx) => {
                                const isSelected = selectedQuizAnswer === option;
                                const isCorrectOption = option === quizQuestions[currentQuizIndex].answer;
                                
                                let cardStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50/50 hover:border-indigo-400 dark:hover:border-slate-700';
                                if (selectedQuizAnswer !== null) {
                                  if (isCorrectOption) {
                                    cardStyle = 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400';
                                  } else if (isSelected) {
                                    cardStyle = 'border-red-400 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400';
                                  } else {
                                    cardStyle = 'opacity-40 border-slate-100 dark:border-slate-800 bg-transparent';
                                  }
                                }

                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => handleAnswerQuizSelect(option)}
                                    disabled={selectedQuizAnswer !== null}
                                    className={`p-3 rounded-2xl border text-left text-xs font-semibold transition duration-200 flex items-center justify-between ${cardStyle}`}
                                  >
                                    <span>{cleanMathText(option)}</span>
                                    {selectedQuizAnswer !== null && isCorrectOption && <Check className="w-4 h-4 text-emerald-600" />}
                                  </button>
                                );
                              })}
                            </div>

                            {showExplanation && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl text-[11px] leading-relaxed mt-4"
                              >
                                <div className="font-bold text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                                  <HelpCircle className="w-3.5 h-3.5" /> Study takeaway:
                                </div>
                                <div>{cleanMathText(quizQuestions[currentQuizIndex].explanation)}</div>
                              </motion.div>
                            )}
                          </div>

                          <div className="pt-4 flex justify-end shrink-0">
                            {selectedQuizAnswer !== null && (
                              <button 
                                onClick={handleNextQuizQuestion}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-indigo-100 dark:shadow-none"
                              >
                                <span>{currentQuizIndex + 1 === quizQuestions.length ? "Finish Quiz" : "Next Question"}</span>
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TABS: Memory active recall flashcards */}
            {activeTab === 'flashcards' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                
                {/* 5-in-a-row Celebration Overlay */}
                <AnimatePresence>
                  {showStreakAnimation && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-center text-white rounded-3xl"
                    >
                      <motion.div
                        initial={{ scale: 0.3, y: 40 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.3, y: 40 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="flex flex-col items-center"
                      >
                        <div className="relative mb-4">
                          <Flame className="w-20 h-20 text-orange-500 fill-orange-500 animate-bounce" />
                          <motion.span 
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="absolute -top-1 -right-1 text-2xl"
                          >
                            ⭐
                          </motion.span>
                        </div>
                        <h3 className="text-xl font-extrabold text-amber-400 uppercase tracking-widest mb-1">
                          STREAK COMPLETED! ⚡
                        </h3>
                        <p className="text-sm font-semibold max-w-xs text-slate-200 mb-3">
                          ၅ ကြိမ်ဆက်တိုက် မှန်ကန်စွာ ဖြေဆိုနိုင်ခဲ့သည့်အတွက် ဂုဏ်ယူပါတယ်! Keep learning high!
                        </p>
                        <div className="px-4 py-2 rounded-2xl bg-amber-500/20 text-amber-300 font-extrabold text-xs">
                          🔥 5 Answer Streak! +10 EXP
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-purple-600 text-sm">🏷️ Memory Flashcards</h3>
                    {flashcardStreak > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-extrabold bg-orange-100 dark:bg-orange-950/40 text-orange-600 px-2.5 py-0.5 rounded-full select-none animate-pulse">
                        <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                        Streak: {flashcardStreak}
                      </span>
                    )}
                  </div>
                  {activeFlashcards.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">Card: {currentFlashcardIndex + 1}/{activeFlashcards.length}</span>
                  )}
                </div>

                {isFlashcardsLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-purple-600 border-t-transparent animate-spin mb-4"></div>
                    <p className="text-xs text-slate-400">Gemini သည် စာရွက်စာတမ်းများမှ Flashcards များ ထုတ်လုပ်ပေးနေပါသည်...</p>
                  </div>
                ) : activeFlashcards.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <Bookmark className="w-12 h-12 text-purple-400 mb-3 opacity-30" />
                    <p className="text-xs text-slate-400">တင်ထားသော သင်ခန်းစာလေ့လာရန် စာရွက်များကိုရွေးပြီး ဘယ်ဘက်မှ <strong className="text-purple-500">"Create Flashcards"</strong> ခလုပ်ကို နှိပ်ပါ!</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between h-full">
                    
                    {/* Centered Flip Card */}
                    <div className="flex-1 flex items-center justify-center my-4">
                      <motion.div 
                        key={currentFlashcardIndex}
                        initial={{ opacity: 0, scale: 0.96, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={() => {
                          triggerHaptic(15);
                          setIsCardFlipped(!isCardFlipped);
                        }}
                        className="w-full max-w-sm h-52 relative cursor-pointer group focus:outline-none"
                      >
                        <motion.div 
                          className="w-full h-full rounded-3xl border-2 shadow-sm p-6 flex flex-col items-center justify-center text-center transition-all duration-300 select-none bg-slate-50 dark:bg-slate-900/40"
                          style={{ borderColor: isCardFlipped ? '#A855F7' : '#C084FC' }}
                          animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                          transition={{ duration: 0.4 }}
                        >
                          {/* Inner container to reverse typography if flipped */}
                          <div className="rotate-y-style" style={{ transform: isCardFlipped ? 'rotateY(180deg)' : 'none' }}>
                            <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider mb-2 block">
                              {isCardFlipped ? "Definition (Back)" : "Concept Term (Front)"}
                            </span>
                            
                            <h4 className="text-sm font-bold max-w-xs leading-relaxed">
                              {cleanMathText(isCardFlipped ? activeFlashcards[currentFlashcardIndex].back : activeFlashcards[currentFlashcardIndex].front)}
                            </h4>
                            
                            <span className="text-[9px] text-slate-400 mt-4 block opacity-60 group-hover:opacity-100 transition duration-300">
                              (Tap Card to Flip definition)
                            </span>
                          </div>
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Feedback Rating/Continuation buttons - gamified study paths */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                      <button 
                        onClick={handleFlashcardReviewAgain}
                        className="py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:dark:bg-red-955/20 text-slate-700 dark:text-slate-300 hover:text-red-600 text-xs font-black transition duration-200 border border-transparent hover:border-red-200"
                      >
                        Need Practice 👎
                      </button>
                      
                      <button 
                        onClick={handleFlashcardGotIt}
                        className="py-3 rounded-2xl bg-purple-650 dark:bg-purple-900 bg-purple-600 text-white hover:bg-purple-700 text-xs font-black transition duration-200 shadow-md shadow-purple-100 dark:shadow-none"
                      >
                        I Got It! 👍
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TABS: Study Lesson Planner */}
            {activeTab === 'plan' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-blue-600 text-sm">📅 Formulated Study Lesson Plans</h3>
                </div>

                {isPlanLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4"></div>
                    <p className="text-xs text-slate-400">Gemini သည် စာရွက်စာတမ်းများမှ ၅ ရက်စာ သင်ရိုးလေ့လာမှုဇယား ရေးဆွဲပေးနေပါသည်...</p>
                  </div>
                ) : !studyPlan ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <BookOpen className="w-12 h-12 text-blue-400 mb-3 opacity-30" />
                    <p className="text-xs text-slate-400">တင်ထားသော သင်ခန်းစာစာရွက်များကိုရွေးပြီး ဘယ်ဘက်မှ <strong className="text-blue-500">"Create Study Plan"</strong> ကို နှိပ်ပါ!</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <h4 className="font-bold text-xs uppercase tracking-wide text-blue-600">{cleanMathText(studyPlan.title)}</h4>
                      </div>

                      <div className="space-y-3">
                        {studyPlan.milestones.map((m, idx) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex flex-col gap-1">
                            <span className="text-[10px] font-black text-blue-500">{cleanMathText(m.phase)}</span>
                            <div className="text-xs font-bold leading-relaxed">{cleanMathText(m.topics)}</div>
                            <div className="text-[11px] text-slate-400 leading-relaxed mt-1">{cleanMathText(m.tasks)}</div>
                          </div>
                        ))}
                      </div>

                      {studyPlan.tips && (
                        <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-200/50 dark:border-indigo-900/20 text-[11px] leading-relaxed mt-4">
                          <strong className="text-indigo-600 dark:text-indigo-400 block font-bold mb-1">💡 Suggested Study Tip:</strong>
                          <span>{cleanMathText(studyPlan.tips)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TABS: Performance Analytics Dashboard */}
            {activeTab === 'analytics' && (
              <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-blue-600 text-sm">📊 Performance Analytics Dashboard</h3>
                </div>

                {/* Grid of quick stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Quizzes Completed</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{quizHistory.length}</span>
                    <span className="text-[9px] text-slate-400 block mt-1">Total interactive attempts</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Average Score</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {quizHistory.length > 0 
                        ? Math.round((quizHistory.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / quizHistory.length) * 100)
                        : 0}%
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-1">Comprehension metric</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Active Study Streak</span>
                    <span className="text-2xl font-black text-orange-500 flex items-center justify-center gap-1">
                      <Flame className="w-5 h-5 fill-current" />
                      {flashcardStreak}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-1">Flashcard correct spree</span>
                  </div>
                </div>

                {/* Dual Column Layout: Weak Points & Quiz History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left sub-column: Weak Topics & Personalized Recommendations */}
                  <div className="space-y-4">
                    <div className="bg-indigo-50/40 dark:bg-slate-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950/40">
                      <h4 className="font-extrabold text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-500" />
                        Identified Weak Topics
                      </h4>

                      {quizHistory.some(q => q.score < q.total) ? (
                        <div className="space-y-2">
                          <p className="text-[11px] leading-relaxed text-slate-400 mb-3">
                            Based on your recent quiz activity, you can benefit from standard revision in the following areas:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(new Set(
                              quizHistory
                                .filter(q => q.score < q.total)
                                .flatMap(q => q.weakPoints)
                            )).map((wpt: any, i) => (
                              <span key={i} className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-955/20 dark:text-red-400 border border-red-200/50 rounded-lg">
                                ⚠️ {cleanMathText(String(wpt))}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-400">
                          🎉 No weak topics identified yet! Perfect or no-data records. Complete some quizzes above!
                        </div>
                      )}
                    </div>

                    <div className="bg-indigo-600 text-white p-5 rounded-2xl border border-transparent shadow-md">
                      <h4 className="font-extrabold text-xs uppercase tracking-widest text-amber-300 mb-2">
                        🎯 Personalized Study Recommendations
                      </h4>
                      <p className="text-[11px] leading-relaxed text-indigo-100">
                        {quizHistory.some(q => q.score < q.total) ? (
                          "We recommend clicking 'Explain Simply' in the sidebar on your custom uploaded materials to allow Gemini to reformulate difficult questions in simple Burmese analogies."
                        ) : (
                          "Exceptional understanding demonstrated! Challenge yourself by pasting complex textbooks, or request a '5-Day Study Lesson Plan' to systematize your target timeline."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right sub-column: Quiz Result History List over Time */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <h4 className="font-extrabold text-xs uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                      <BookMarked className="w-4 h-4 text-indigo-500" />
                      Quiz History Log
                    </h4>

                    {quizHistory.length === 0 ? (
                      <p className="text-center py-8 text-xs text-slate-400">No attempts logged yet.</p>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {quizHistory.map((historyItem) => (
                          <div key={historyItem.id} className="p-3 bg-white dark:bg-[#1E293B] border border-slate-200/50 dark:border-slate-800 rounded-xl flex items-center justify-between">
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="font-extrabold text-xs text-slate-700 dark:text-slate-100 truncate block pr-2" title={historyItem.topic}>
                                {cleanMathText(historyItem.topic)}
                              </span>
                              <span className="text-[9px] text-slate-400">{historyItem.timestamp}</span>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <div className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-slate-800">
                                {historyItem.score} / {historyItem.total}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
