import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FireBattleContainer({ isDarkMode }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const router = useRouter();
  
  const holdStartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFromRef = useRef(0);

  const HOLD_DURATION = 1500;
  const RELEASE_DURATION = 800;

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
        @keyframes fire-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-15px) scale(1.1); opacity: 0.9; }
        }
        @keyframes ember-rise {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
        }
        @keyframes flame-dance {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          25% { transform: scaleY(1.1) scaleX(0.95); }
          50% { transform: scaleY(0.95) scaleX(1.05); }
          75% { transform: scaleY(1.05) scaleX(0.98); }
        }
        .fire-crest {
          animation: fire-wave-crest 10s linear infinite;
        }
        @keyframes fire-wave-crest {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      
      <div 
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 25%, #dc2626 50%, #b91c1c 75%, #991b1b 100%)',
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            {[...Array(12)].map((_, i) => (
              <div
                key={`ember-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${4 + (i % 4) * 2}px`,
                  height: `${4 + (i % 4) * 2}px`,
                  left: `${5 + (i * 8)}%`,
                  bottom: `${10 + (i * 5) % 30}%`,
                  background: i % 2 === 0 ? '#fbbf24' : '#fb923c',
                  animation: `ember-rise ${2 + (i % 3)}s ease-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          
          <div 
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: '100%',
              transform: `translateY(${86 - (holdProgress * 86)}%)`,
              willChange: 'transform',
            }}
          >
            <div 
              className="absolute inset-0" 
              style={{
                background: 'linear-gradient(to top, #f97316 0%, rgba(251, 191, 36, 0.8) 50%, rgba(253, 224, 71, 0.4) 80%, transparent 100%)'
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-[30px]" style={{ transform: 'translateY(-50%)' }}>
              <svg 
                className="w-[200%] h-full fire-crest" 
                viewBox="0 0 2880 30" 
                preserveAspectRatio="none"
                style={{ filter: 'blur(2px)' }}
              >
                <path 
                  fill="none"
                  stroke="rgba(253, 224, 71, 0.8)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  d="M0,15 C40,5 80,25 120,15 C160,5 200,25 240,15 C280,5 320,25 360,15 C400,5 440,25 480,15 C520,5 560,25 600,15 C640,5 680,25 720,15 C760,5 800,25 840,15 C880,5 920,25 960,15 C1000,5 1040,25 1080,15 C1120,5 1160,25 1200,15 C1240,5 1280,25 1320,15 C1360,5 1400,25 1440,15 C1480,5 1520,25 1560,15 C1600,5 1640,25 1680,15 C1720,5 1760,25 1800,15 C1840,5 1880,25 1920,15 C1960,5 2000,25 2040,15 C2080,5 2120,25 2160,15 C2200,5 2240,25 2280,15 C2320,5 2360,25 2400,15 C2440,5 2480,25 2520,15 C2560,5 2600,25 2640,15 C2680,5 2720,25 2760,15 C2800,5 2840,25 2880,15"
                />
              </svg>
            </div>
            <div 
              className="absolute top-0 left-0 right-0 h-[20px]" 
              style={{ 
                background: 'linear-gradient(to bottom, rgba(253,224,71,0.5), transparent)'
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
