import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize and handle play toggle
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    // If duration already loaded
    if (audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  // Real-time Canvas Waveform Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    
    // Stable pseudo-random base amplitudes to model an audio track fingerprint
    const baseAmplitudes = [
      0.35, 0.55, 0.75, 0.45, 0.25, 0.65, 0.85, 0.55, 
      0.35, 0.45, 0.75, 0.85, 0.65, 0.45, 0.55, 0.75, 
      0.85, 0.55, 0.35, 0.45, 0.65, 0.35
    ];
    const totalBars = baseAmplitudes.length;

    const render = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const clientWidth = 90;
      const clientHeight = 32;
      
      // High-DPI Retina scale factor configuration
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
      }
      
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, clientWidth, clientHeight);

      const barWidth = 2.5;
      const barGap = 1.5;
      const centerY = clientHeight / 2;
      const maxBarHeight = clientHeight - 4;
      
      // Calculate current visual playback progress ratio
      const currTime = audioRef.current ? audioRef.current.currentTime : 0;
      const totalDuration = duration || (audioRef.current ? audioRef.current.duration : 0) || 1;
      const progress = currTime / totalDuration;

      // Classlist dark mode check
      const isDark = document.documentElement.classList.contains('dark');

      for (let i = 0; i < totalBars; i++) {
        const baseHeight = baseAmplitudes[i];
        
        // Modulate with smooth oscillator waves only when active
        let waveFactor = 0.35;
        if (isPlaying) {
          const waveSpeed = 0.008;
          const waveFreq = 0.55;
          const offset = i * waveFreq;
          waveFactor = 0.65 + 0.35 * Math.sin(timestamp * waveSpeed + offset);
        }
        
        const finalRatio = baseHeight * waveFactor;
        const barHeight = Math.max(2, finalRatio * maxBarHeight);
        const startX = i * (barWidth + barGap) + 2;
        
        // Is this specific segment of the visualizer currently played?
        const barPos = i / totalBars;
        const isActive = barPos <= progress;
        
        ctx.beginPath();
        ctx.lineWidth = barWidth;
        ctx.lineCap = 'round';
        
        if (isActive) {
          // Dynamic red-to-blue active gradient matching app design
          const grad = ctx.createLinearGradient(startX, centerY - barHeight / 2, startX, centerY + barHeight / 2);
          grad.addColorStop(0, '#D62828');
          grad.addColorStop(1, '#1E3A8A');
          ctx.strokeStyle = grad;
        } else {
          // Muted modern slate for unplayed sections
          ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.45)';
        }
        
        ctx.moveTo(startX + barWidth / 2, centerY - barHeight / 2);
        ctx.lineTo(startX + barWidth / 2, centerY + barHeight / 2);
        ctx.stroke();
      }
      
      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, duration]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-inner w-full">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D62828] to-[#1E3A8A] flex items-center justify-center text-white shrink-0 shadow-md hover:scale-105 transition-transform active:scale-95"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      {/* Seek Track */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            {isPlaying ? 'Playing Voice Note' : 'Voice Note'}
          </span>
          <span>
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
        
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.01"
          value={currentTime}
          onChange={handleSeekChange}
          className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#D62828]"
        />
      </div>

      {/* Authentic Canvas-Based Soundwave Graphic */}
      <div className="h-8 w-[90px] shrink-0 overflow-hidden flex items-center select-none">
        <canvas ref={canvasRef} className="w-[90px] h-8 block" />
      </div>
    </div>
  );
}
