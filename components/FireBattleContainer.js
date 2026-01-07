import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FireBattleContainer({ isDarkMode }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [turbulenceSeed, setTurbulenceSeed] = useState(1);
  const router = useRouter();
  
  const holdStartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFromRef = useRef(0);
  const turbulenceRef = useRef(null);

  const HOLD_DURATION = 1500;
  const RELEASE_DURATION = 800;

  useEffect(() => {
    const interval = setInterval(() => {
      setTurbulenceSeed(prev => (prev % 5) + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const startHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsHolding(true);
    holdStartRef.current = Date.now();
    const startFrom = holdProgress;
    
    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(startFrom + (elapsed / HOLD_DURATION) * (1 - startFrom), 1);
      setHoldProgress(progress);
      
      if (progress >= 1) {
        setIsHolding(false);
        setHoldProgress(0);
        router.push('/battle');
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const endHold = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsHolding(false);
    
    releaseStartRef.current = Date.now();
    releaseFromRef.current = holdProgress;
    
    const animateDrain = () => {
      const elapsed = Date.now() - releaseStartRef.current;
      const t = Math.min(elapsed / RELEASE_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const newProgress = releaseFromRef.current * (1 - eased);
      
      setHoldProgress(newProgress);
      
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animateDrain);
      } else {
        setHoldProgress(0);
      }
    };
    
    if (releaseFromRef.current > 0) {
      animationFrameRef.current = requestAnimationFrame(animateDrain);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes ember-float {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 1; 
          }
          50% {
            transform: translateY(-40px) translateX(5px) scale(0.8);
            opacity: 0.8;
          }
          100% { 
            transform: translateY(-100px) translateX(-3px) scale(0.2); 
            opacity: 0; 
          }
        }
        @keyframes flame-sway {
          0%, 100% { transform: skewX(-2deg) scaleX(1); }
          25% { transform: skewX(3deg) scaleX(0.95); }
          50% { transform: skewX(-3deg) scaleX(1.05); }
          75% { transform: skewX(2deg) scaleX(0.98); }
        }
      `}</style>
      
      <div 
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(180deg, #0f0502 0%, #1a0804 40%, #2a0f08 100%)',
        }}
      >
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="fire-turbulence" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence 
                type="fractalNoise" 
                baseFrequency="0.015 0.08" 
                numOctaves="3" 
                seed={turbulenceSeed}
                result="noise"
              />
              <feDisplacementMap 
                in="SourceGraphic" 
                in2="noise" 
                scale="25" 
                xChannelSelector="R" 
                yChannelSelector="G"
              />
            </filter>
            <linearGradient id="flame-gradient-main" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#7f1d1d" />
              <stop offset="15%" stopColor="#dc2626" />
              <stop offset="35%" stopColor="#ea580c" />
              <stop offset="55%" stopColor="#f97316" />
              <stop offset="75%" stopColor="#fbbf24" />
              <stop offset="90%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#fef9c3" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="flame-gradient-bright" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="40%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(18)].map((_, i) => (
              <div
                key={`ember-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${2 + (i % 4)}px`,
                  height: `${2 + (i % 4)}px`,
                  left: `${5 + (i * 5.5)}%`,
                  bottom: `${8 + (i * 3) % 20}%`,
                  background: i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#fbbf24' : '#fb923c',
                  boxShadow: `0 0 ${4 + (i % 3) * 2}px ${i % 3 === 0 ? '#fef08a' : '#fbbf24'}`,
                  animation: `ember-float ${2 + (i % 3) * 0.7}s ease-out infinite`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          
          <div 
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: '120%',
              transform: `translateY(${90 - (holdProgress * 90)}%)`,
              willChange: 'transform',
            }}
          >
            <div 
              className="absolute inset-0"
              style={{
                filter: 'url(#fire-turbulence)',
                animation: 'flame-sway 0.8s ease-in-out infinite',
              }}
            >
              {[...Array(12)].map((_, i) => {
                const baseHeight = 50 + (i % 4) * 20;
                const width = 60 + (i % 3) * 30;
                const left = i * 8.5 - 2;
                
                return (
                  <div
                    key={`flame-tongue-${i}`}
                    className="absolute"
                    style={{
                      left: `${left}%`,
                      bottom: 0,
                      width: `${width}px`,
                      height: `${baseHeight}%`,
                      background: 'url(#flame-gradient-main)',
                      background: `linear-gradient(to top, 
                        #7f1d1d 0%, 
                        #dc2626 15%, 
                        #ea580c 30%, 
                        #f97316 50%, 
                        #fbbf24 70%, 
                        #fde047 85%,
                        rgba(254, 249, 195, 0.6) 95%,
                        transparent 100%)`,
                      clipPath: `polygon(
                        ${20 + (i % 3) * 5}% 100%, 
                        0% ${60 - (i % 4) * 5}%, 
                        ${15 + (i % 2) * 10}% ${30 - (i % 3) * 5}%, 
                        ${40 + (i % 3) * 5}% ${5 + (i % 2) * 3}%, 
                        ${60 - (i % 2) * 5}% ${8 + (i % 3) * 4}%, 
                        ${85 - (i % 3) * 5}% ${35 - (i % 2) * 8}%, 
                        100% ${55 + (i % 4) * 5}%, 
                        ${80 - (i % 2) * 5}% 100%
                      )`,
                      opacity: 0.9,
                      transformOrigin: 'bottom center',
                    }}
                  />
                );
              })}
            </div>
            
            <div 
              className="absolute inset-0"
              style={{
                filter: 'url(#fire-turbulence) blur(4px)',
                animation: 'flame-sway 0.6s ease-in-out infinite reverse',
              }}
            >
              {[...Array(8)].map((_, i) => {
                const baseHeight = 35 + (i % 3) * 15;
                const width = 80 + (i % 4) * 25;
                const left = i * 12.5;
                
                return (
                  <div
                    key={`flame-inner-${i}`}
                    className="absolute"
                    style={{
                      left: `${left}%`,
                      bottom: 0,
                      width: `${width}px`,
                      height: `${baseHeight}%`,
                      background: `linear-gradient(to top, 
                        #f97316 0%, 
                        #fbbf24 30%, 
                        #fde047 60%,
                        #fef9c3 85%,
                        transparent 100%)`,
                      clipPath: `polygon(
                        30% 100%, 
                        5% 50%, 
                        25% 20%, 
                        50% 0%, 
                        75% 15%, 
                        95% 45%, 
                        70% 100%
                      )`,
                      opacity: 0.7,
                      transformOrigin: 'bottom center',
                    }}
                  />
                );
              })}
            </div>
            
            <div 
              className="absolute bottom-0 left-0 right-0 h-[50%]" 
              style={{ 
                background: 'linear-gradient(to top, #fde047 0%, #fbbf24 20%, #f97316 50%, transparent 100%)',
                opacity: 0.5,
                filter: 'blur(15px)',
              }} 
            />
            
            <div 
              className="absolute bottom-0 left-0 right-0 h-[25%]" 
              style={{ 
                background: 'linear-gradient(to top, #ffffff 0%, #fef9c3 40%, transparent 100%)',
                opacity: 0.4,
                filter: 'blur(8px)',
              }} 
            />
          </div>
        </div>
        
        <div className="relative z-10 p-4 h-[140px] md:h-[180px] flex flex-col overflow-hidden">
          <div className="absolute top-3 right-3 bg-yellow-400 text-black px-3 py-1 rounded-md shadow-lg transform rotate-3" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 5% 50%)' }}>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black">$10</span>
              <span className="text-[8px] font-bold uppercase">Free</span>
            </div>
          </div>
          
          <div className="flex flex-col mb-1">
            <span className="text-white/70 text-[10px] uppercase tracking-wide">1v1 Battle</span>
            <span className="text-white text-lg md:text-4xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              Piks Fire Off
            </span>
          </div>
          
          <div className="flex items-center justify-center -mt-4 md:mt-[10px]">
            <div 
              className="relative px-6 py-2 bg-white/25 active:bg-white/40 rounded-xl shadow-lg overflow-hidden select-none cursor-pointer active:scale-95 transition-transform duration-150"
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={startHold}
              onTouchEnd={endHold}
              onTouchCancel={endHold}
              style={{ touchAction: 'none' }}
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-orange-400"
                style={{
                  width: `${holdProgress * 100}%`,
                  opacity: 0.6,
                }}
              />
              <span className="relative text-white text-sm md:text-base font-bold tracking-wide pointer-events-none">
                {isHolding ? 'IGNITING...' : 'HOLD TO START'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className="text-white/60 text-[10px]">Winner takes 90%</span>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-[10px]">Up to $9,000</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
