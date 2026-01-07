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
        @keyframes ember-rise {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
        }
        @keyframes flame-flicker-1 {
          0%, 100% { transform: scaleY(1) scaleX(1) translateX(0); }
          20% { transform: scaleY(1.15) scaleX(0.9) translateX(-2px); }
          40% { transform: scaleY(0.9) scaleX(1.1) translateX(3px); }
          60% { transform: scaleY(1.1) scaleX(0.95) translateX(-1px); }
          80% { transform: scaleY(0.95) scaleX(1.05) translateX(2px); }
        }
        @keyframes flame-flicker-2 {
          0%, 100% { transform: scaleY(1) scaleX(1) translateX(0); }
          25% { transform: scaleY(1.2) scaleX(0.85) translateX(2px); }
          50% { transform: scaleY(0.85) scaleX(1.15) translateX(-3px); }
          75% { transform: scaleY(1.1) scaleX(0.9) translateX(1px); }
        }
        @keyframes flame-flicker-3 {
          0%, 100% { transform: scaleY(1) scaleX(1) translateX(0); }
          33% { transform: scaleY(1.25) scaleX(0.8) translateX(-2px); }
          66% { transform: scaleY(0.8) scaleX(1.2) translateX(2px); }
        }
        .flame-layer-1 { animation: flame-flicker-1 0.4s ease-in-out infinite; }
        .flame-layer-2 { animation: flame-flicker-2 0.5s ease-in-out infinite; }
        .flame-layer-3 { animation: flame-flicker-3 0.6s ease-in-out infinite; }
      `}</style>
      
      <div 
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(180deg, #1a0a00 0%, #2d1106 30%, #4a1c0a 60%, #6b2710 100%)',
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <div
                key={`ember-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${3 + (i % 3) * 2}px`,
                  height: `${3 + (i % 3) * 2}px`,
                  left: `${3 + (i * 6.5)}%`,
                  bottom: `${5 + (i * 4) % 25}%`,
                  background: i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#fb923c' : '#f97316',
                  boxShadow: i % 3 === 0 ? '0 0 6px #fde047' : '0 0 4px #fb923c',
                  animation: `ember-rise ${1.5 + (i % 4) * 0.5}s ease-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          
          <div 
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: '100%',
              transform: `translateY(${88 - (holdProgress * 88)}%)`,
              willChange: 'transform',
            }}
          >
            <div className="absolute inset-0 flex justify-center items-end">
              {[...Array(20)].map((_, i) => {
                const height = 60 + (Math.sin(i * 0.8) * 25) + (i % 3) * 15;
                const width = 30 + (i % 4) * 8;
                const offset = i * 5 - 2;
                const flickerClass = i % 3 === 0 ? 'flame-layer-1' : i % 3 === 1 ? 'flame-layer-2' : 'flame-layer-3';
                const delay = (i * 0.05) % 0.3;
                
                return (
                  <div
                    key={`flame-${i}`}
                    className={`absolute ${flickerClass}`}
                    style={{
                      left: `${offset}%`,
                      bottom: 0,
                      width: `${width}px`,
                      height: `${height}%`,
                      background: `linear-gradient(to top, 
                        #dc2626 0%, 
                        #ea580c 20%, 
                        #f97316 40%, 
                        #fb923c 60%, 
                        #fbbf24 80%, 
                        #fde047 95%,
                        transparent 100%)`,
                      borderRadius: '50% 50% 20% 20% / 80% 80% 20% 20%',
                      filter: 'blur(3px)',
                      opacity: 0.85,
                      animationDelay: `${delay}s`,
                      transformOrigin: 'bottom center',
                    }}
                  />
                );
              })}
            </div>
            
            <div 
              className="absolute inset-0" 
              style={{
                background: 'linear-gradient(to top, #b91c1c 0%, #dc2626 20%, #ea580c 40%, rgba(251, 146, 60, 0.6) 70%, transparent 100%)',
                mixBlendMode: 'screen',
              }}
            />
            
            <div 
              className="absolute bottom-0 left-0 right-0 h-[40%]" 
              style={{ 
                background: 'linear-gradient(to top, #fde047 0%, #fbbf24 30%, #f97316 60%, transparent 100%)',
                opacity: 0.7,
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
