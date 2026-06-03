import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a14] flex items-center justify-center select-none overflow-hidden font-['Cinzel',_serif]">
      {/* Scope-specific Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');

        .scene {
          position: relative;
          width: 340px;
          height: 340px;
          transform: scale(0.55);
          transform-origin: center;
        }

        /* Outer glow */
        .glow-bg {
          position: absolute;
          inset: -40px;
          background: radial-gradient(circle, rgba(180,30,30,0.12) 0%, rgba(30,80,180,0.10) 50%, transparent 75%);
          border-radius: 50%;
          animation: pulseGlow 3s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        /* === RINGS === */
        .ring {
          position: absolute;
          border-radius: 50%;
          border-style: solid;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        }

        /* Ring 1 - RED - outermost */
        .ring-1 {
          width: 320px; height: 320px;
          border-width: 4px;
          border-color: #cc1111 transparent #cc1111 transparent;
          animation: spinCW 3s linear infinite;
          box-shadow: 0 0 18px rgba(204,17,17,0.5), inset 0 0 18px rgba(204,17,17,0.1);
        }

        /* Ring 2 - WHITE */
        .ring-2 {
          width: 270px; height: 270px;
          border-width: 3.5px;
          border-color: transparent #e8e8e8 transparent #e8e8e8;
          animation: spinCCW 2.5s linear infinite;
          box-shadow: 0 0 14px rgba(230,230,230,0.4);
        }

        /* Ring 3 - BLUE */
        .ring-3 {
          width: 225px; height: 225px;
          border-width: 4px;
          border-color: #1133bb transparent #1133bb transparent;
          animation: spinCW 2s linear infinite;
          box-shadow: 0 0 18px rgba(17,51,187,0.5), inset 0 0 18px rgba(17,51,187,0.1);
        }

        /* Ring 4 - RED thin */
        .ring-4 {
          width: 185px; height: 185px;
          border-width: 2.5px;
          border-color: transparent #dd2222 transparent #dd2222;
          animation: spinCCW 1.8s linear infinite;
          box-shadow: 0 0 10px rgba(221,34,34,0.4);
        }

        /* Ring 5 - WHITE thin */
        .ring-5 {
          width: 150px; height: 150px;
          border-width: 2px;
          border-color: #dddddd transparent #dddddd transparent;
          animation: spinCW 1.5s linear infinite;
          box-shadow: 0 0 8px rgba(220,220,220,0.3);
        }

        @keyframes spinCW {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to   { transform: translate(-50%,-50%) rotate(-360deg); }
        }

        /* === SYMBOLS ON RINGS (orbit) === */
        .orbit {
          position: absolute;
          top: 50%; left: 50%;
          transform-origin: 0 0;
        }

        .orbit-container {
          position: absolute;
          top: 50%; left: 50%;
          width: 0; height: 0;
        }

        .symbol {
          position: absolute;
          font-size: 20px;
          filter: drop-shadow(0 0 4px rgba(255,255,255,0.6));
          transform-origin: center;
        }

        /* Orbiting frog symbols (4 frogs on outer ring) */
        .frog-orbit {
          width: 320px; height: 320px;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: spinCW 6s linear infinite;
          border: none;
        }

        .frog-sym {
          position: absolute;
          font-size: 18px;
          filter: drop-shadow(0 0 6px rgba(200,50,50,0.8)) brightness(1.2);
        }
        .frog-sym.f1 { top: -12px; left: 50%; transform: translateX(-50%); }
        .frog-sym.f2 { bottom: -12px; left: 50%; transform: translateX(-50%); }
        .frog-sym.f3 { left: -12px; top: 50%; transform: translateY(-50%); }
        .frog-sym.f4 { right: -12px; top: 50%; transform: translateY(-50%); }

        /* Orbiting fish symbols (4 fish on mid ring) */
        .fish-orbit {
          width: 270px; height: 270px;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: spinCCW 5s linear infinite;
          border: none;
        }

        .fish-sym {
          position: absolute;
          font-size: 16px;
          filter: drop-shadow(0 0 5px rgba(50,100,220,0.8)) brightness(1.2);
        }
        .fish-sym.fish1 { top: -10px; left: 50%; transform: translateX(-50%); }
        .fish-sym.fish2 { bottom: -10px; left: 50%; transform: translateX(-50%); }
        .fish-sym.fish3 { left: -10px; top: 50%; transform: translateY(-50%); }
        .fish-sym.fish4 { right: -10px; top: 50%; transform: translateY(-50%); }

        /* === CENTER STAR / SUN === */
        .center-star {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 100px; height: 100px;
          display: flex; align-items: center; justify-content: center;
          animation: starPulse 2s ease-in-out infinite;
        }

        .star-svg {
          width: 90px; height: 90px;
          filter: drop-shadow(0 0 20px rgba(255,220,80,0.9))
                  drop-shadow(0 0 40px rgba(255,160,30,0.6));
          animation: starRotate 8s linear infinite;
        }

        @keyframes starPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50% { transform: translate(-50%,-50%) scale(1.12); }
        }
        @keyframes starRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Star rays */
        .star-core {
          fill: #fff8d0;
        }
        .star-ray {
          fill: url(#starGrad);
        }

        /* === LOADING TEXT === */
        .loading-text {
          position: absolute;
          bottom: -50px;
          left: 50%;
          transform: translateX(-50%);
          color: #ccc;
          font-size: 13px;
          letter-spacing: 4px;
          text-transform: uppercase;
          opacity: 0.7;
          animation: textFade 2s ease-in-out infinite;
          white-space: nowrap;
        }

        @keyframes textFade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        /* Dots after loading */
        .dots span {
          animation: dotBlink 1.4s infinite;
          display: inline-block;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dotBlink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }

        /* Decorative arc dashes */
        .arc-dashes {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
      ` }} />

      <div className="scene">
        <div className="glow-bg"></div>

        {/* Arc/dash decorations (SVG) */}
        <svg 
          className="arc-dashes" 
          width="340" 
          height="340" 
          viewBox="0 0 340 340" 
          style={{ animation: 'spinCCW 20s linear infinite', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
        >
          <defs>
            <radialGradient id="starGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff9a0"/>
              <stop offset="40%" stopColor="#ffcc30"/>
              <stop offset="100%" stopColor="#ff8800"/>
            </radialGradient>
          </defs>
          {/* Small decorative arc dashes around middle area */}
          <g stroke="#888" strokeWidth="1.5" fill="none" opacity="0.35">
            <path d="M170,60 A110,110 0 0,1 260,130" strokeDasharray="6 8"/>
            <path d="M280,170 A110,110 0 0,1 210,270" strokeDasharray="6 8"/>
            <path d="M130,280 A110,110 0 0,1 60,200" strokeDasharray="6 8"/>
            <path d="M60,130 A110,110 0 0,1 130,60"  strokeDasharray="6 8"/>
          </g>
        </svg>

        {/* Rotating Rings */}
        <div className="ring ring-1"></div>
        <div className="ring ring-2"></div>
        <div className="ring ring-3"></div>
        <div className="ring ring-4"></div>
        <div className="ring ring-5"></div>

        {/* Frog symbols orbiting outer ring */}
        <div className="frog-orbit">
          <span className="frog-sym f1">🐸</span>
          <span className="frog-sym f2">🐸</span>
          <span className="frog-sym f3">🐸</span>
          <span className="frog-sym f4">🐸</span>
        </div>

        {/* Fish symbols orbiting mid ring */}
        <div className="fish-orbit">
          <span className="fish-sym fish1">🐟</span>
          <span className="fish-sym fish2">🐟</span>
          <span className="fish-sym fish3">🐟</span>
          <span className="fish-sym fish4">🐟</span>
        </div>

        {/* Center Starburst / Compass Star */}
        <div className="center-star">
          <svg className="star-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="30%" stopColor="#fff9a0"/>
                <stop offset="70%" stopColor="#ffcc30"/>
                <stop offset="100%" stopColor="#ff8800" stopOpacity="0.6"/>
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* 16-point star */}
            <g filter="url(#glow)">
              <polygon fill="url(#coreGrad)" points="
                50,5  53,45  65,10  55,47  75,20  57,50
                90,35  59,53  95,50  59,57  90,65  57,59
                75,80  55,61  65,90  53,63  50,95  47,63
                35,90  45,61  25,80  43,59  10,65  41,57
                5,50   41,53  10,35  43,50  25,20  45,47
                35,10  47,45
              "/>
              {/* Inner bright core */}
              <circle cx="50" cy="50" r="10" fill="white" opacity="0.95"/>
              <circle cx="50" cy="50" r="5" fill="white"/>
            </g>
          </svg>
        </div>

        <div className="loading-text">
          Loading <span className="dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    </div>
  );
};
