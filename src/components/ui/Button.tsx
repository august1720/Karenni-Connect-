import React from 'react';
import { cn } from '../../lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
    
    const variants = {
      primary: "bg-gradient-to-r from-[#D62828] to-[#1E3A8A] text-white hover:opacity-90 focus:ring-[#D62828] shadow-lg shadow-[#D62828]/25",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 shadow-sm",
      outline: "border border-slate-200 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800",
      ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      glass: "bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-white hover:bg-white/80 dark:hover:bg-slate-800/80 shadow-sm",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm rounded-xl",
      md: "h-12 px-6 text-base",
      lg: "h-14 px-8 text-lg rounded-[1.25rem]",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.96 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
