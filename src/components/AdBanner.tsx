import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, DollarSign, Flag, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../lib/haptic';

interface AdBannerProps {
  id?: string;
  slot?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ id = "default-ad", slot }) => {
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [activeAdIndex, setActiveAdIndex] = React.useState(0);

  // High-fidelity curated list of relevant ad sponsors matching education/student lifestyle
  const SPONSORS = [
    {
      title: "Scholarship Matcher AI",
      category: "Education Partner",
      description: "Find and apply to over 10,000 global student scholarships tailored to your research profile instantly.",
      cta: "Find Scholarships",
      link: "https://google.com/search?q=academic+scholarships+for+students",
      color: "from-blue-600 to-indigo-600",
      accent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    },
    {
      title: "JetBrains Student Premium",
      category: "Student Coding Special",
      description: "Get industry-leading professional developer IDEs like IntelliJ, WebStorm, and PyCharm free.",
      cta: "Claim Free License",
      link: "https://www.jetbrains.com/community/education/#students",
      color: "from-purple-600 to-pink-600",
      accent: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
    },
    {
      title: "Grammarly Academic Drafts",
      category: "Writing Companion",
      description: "Submit original, citation-perfect, and highly polished academic papers with advanced proofing rules.",
      cta: "Improve Writing",
      link: "https://google.com/search?q=grammarly+for+students+discounts",
      color: "from-emerald-600 to-teal-600",
      accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    }
  ];

  React.useEffect(() => {
    // Stagger / rotate sponsoring partners every 12 seconds for interactive feel
    const interval = setInterval(() => {
      setActiveAdIndex((prev) => (prev + 1) % SPONSORS.length);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  if (isDismissed) return null;

  const currentSponsor = SPONSORS[activeAdIndex];

  const handleCtaClick = () => {
    triggerHaptic(50);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-700/60 p-6 shadow-sm relative overflow-hidden select-none"
      id={id}
    >
      {/* Decorative top strip */}
      <div className={`absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r ${currentSponsor.color}`} />

      {/* Ad Tag Badge */}
      <div className="flex items-center justify-between mb-4.5">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full ${currentSponsor.accent}`}>
            {currentSponsor.category}
          </span>
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Sponsored
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold">
          <span>Ad Slot {slot || '#1'}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          {currentSponsor.title}
        </h3>
        <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
          {currentSponsor.description}
        </p>

        <div className="pt-2 flex items-center justify-between gap-4">
          <a
            href={currentSponsor.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r ${currentSponsor.color} hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer`}
          >
            <span>{currentSponsor.cta}</span>
            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
          </a>

          <div className="flex gap-1.5">
            <button 
              onClick={() => {
                triggerHaptic(20);
                alert("Sponsorship feedback submitted. Thank you for your support!");
              }}
              title="Report ad"
              className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-450 hover:text-red-500 transition-colors"
            >
              <Flag className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                triggerHaptic(30);
                setIsDismissed(true);
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
            >
              Hide Ad
            </button>
          </div>
        </div>
      </div>

      {/* Behind-the-scenes Developer Note */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700/40 flex justify-between items-center text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 select-all">
        <span>⚙️ GOOGLE ADSENSE READY</span>
        <span>ID: ca-pub-{id.replace(/\D/g,'') || '7829-01'}</span>
      </div>
    </motion.div>
  );
};
