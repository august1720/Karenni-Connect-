import { NavLink } from 'react-router-dom';
import { Home, Compass, MessageCircle, Calendar, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function Navigation() {
  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/discover", icon: Compass, label: "Exchange" },
    { to: "/messages", icon: MessageCircle, label: "Messages" },
    { to: "/events", icon: Calendar, label: "Events" },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-sm bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-[2rem] z-50 shadow-xl shadow-slate-300/40 dark:shadow-none">
      <div className="flex items-center justify-between px-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative w-[3.25rem] h-[3.25rem] rounded-full flex flex-col items-center justify-center transition-all duration-300",
                isActive 
                  ? "text-[#D62828] dark:text-[#FCA5A5]" 
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-gradient-to-tr from-[#D62828]/10 to-[#1E3A8A]/10 dark:from-[#D62828]/20 dark:to-[#1E3A8A]/20 rounded-full z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <item.icon className={cn("w-6 h-6 stroke-[1.5] relative z-10 transition-transform duration-300", isActive && "scale-110")} />
                <span className="sr-only">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
