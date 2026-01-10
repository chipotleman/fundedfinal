import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const PLACEHOLDER_AVATARS = [
  '🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '🦈', '🐻', '🦇', '🐍',
  '🦂', '🦎', '🐊', '🦍', '🐘', '🦏', '🐃', '🐎', '🦌', '🐗'
];

export default function FireBattleContainer({ isDarkMode }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [currentAvatarIndex, setCurrentAvatarIndex] = useState(0);
  const [uploadedAvatars, setUploadedAvatars] = useState([]);
  const router = useRouter();
  
  useEffect(() => {
    fetch('/api/admin/battle-avatars')
      .then(res => res.ok ? res.json() : { avatars: [] })
      .then(data => setUploadedAvatars(data.avatars || []))
      .catch(() => {});
  }, []);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const avatarList = uploadedAvatars.length > 0 ? uploadedAvatars : PLACEHOLDER_AVATARS;
      setCurrentAvatarIndex(prev => (prev + 1) % avatarList.length);
    }, 600);
    return () => clearInterval(interval);
  }, [uploadedAvatars]);
  
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
        @keyframes battle-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes battle-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.5); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.8); }
        }
        @keyframes ember-float {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 0.9; 
          }
          100% { 
            transform: translateY(-160px) translateX(10px) scale(0.3); 
            opacity: 0; 
          }
        }
        @keyframes smoke-rise {
          0% { 
            transform: translateY(0) translateX(0) scale(1) rotate(0deg); 
            opacity: 0.35; 
          }
          50% {
            transform: translateY(-60px) translateX(12px) scale(1.6) rotate(8deg);
            opacity: 0.2;
          }
          100% { 
            transform: translateY(-140px) translateX(-8px) scale(2.5) rotate(-5deg); 
            opacity: 0; 
          }
        }
        @keyframes vs-pulse {
          0%, 100% { transform: scale(1); text-shadow: 0 0 20px rgba(250,204,21,0.8); }
          50% { transform: scale(1.1); text-shadow: 0 0 40px rgba(253,224,71,1); }
        }
      `}</style>
      
      <div 
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(135deg, #0a0515 0%, #1a103d 25%, #2d1b69 50%, #1e1450 75%, #0d0820 100%)',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center bottom, rgba(139, 92, 246, 0.4) 0%, transparent 60%)',
          }}
        />
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <div
              key={`smoke-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${20 + (i % 4) * 12}px`,
                height: `${20 + (i % 4) * 12}px`,
                left: `${5 + (i * 9.5)}%`,
                bottom: `${5 + (i * 4) % 20}%`,
                background: 'radial-gradient(circle, rgba(100,100,100,0.4) 0%, rgba(70,70,70,0.2) 50%, transparent 70%)',
                filter: 'blur(6px)',
                animation: `smoke-rise ${3.5 + (i % 3) * 0.8}s linear infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
          {[...Array(25)].map((_, i) => (
            <div
              key={`ember-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${2 + (i % 3) * 2}px`,
                height: `${2 + (i % 3) * 2}px`,
                left: `${2 + (i * 4)}%`,
                bottom: `-5%`,
                background: i % 3 === 0 ? '#c4b5fd' : i % 3 === 1 ? '#a78bfa' : '#8b5cf6',
                boxShadow: `0 0 ${6 + (i % 3) * 3}px ${i % 3 === 0 ? '#c4b5fd' : '#a78bfa'}`,
                animation: `ember-float ${2.5 + (i % 5) * 0.4}s linear infinite`,
                animationDelay: `${(i * 0.12)}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 h-full flex items-center px-3 md:px-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col items-center flex-1">
              <div className="flex flex-col items-center h-[90px] md:h-[110px]">
                <div 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-yellow-400 shadow-lg bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center"
                  style={{ animation: 'battle-glow 2s ease-in-out infinite' }}
                >
                  <span className="text-2xl md:text-3xl">🐍</span>
                </div>
                <span className="text-white/80 text-[9px] md:text-xs mt-1 uppercase tracking-wide">You</span>
                <div 
                  className="mt-1 px-3 py-1 rounded-lg text-xs md:text-sm font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(34, 197, 94, 0.3) 100%)',
                    border: '1px solid rgba(74, 222, 128, 0.5)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                    color: '#4ade80',
                  }}
                >
                  FREE $10
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1">
              <div 
                className="text-3xl md:text-5xl font-black text-transparent bg-clip-text"
                style={{ 
                  backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                  animation: 'vs-pulse 1.5s ease-in-out infinite',
                  WebkitBackgroundClip: 'text',
                }}
              >
                VS
              </div>
              <div className="text-yellow-400 text-[9px] md:text-xs font-bold uppercase tracking-wider mt-1">1v1 Battle</div>
            </div>

            <div className="flex flex-col items-center flex-1">
              <div className="flex flex-col items-center h-[90px] md:h-[110px]">
                <div 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-violet-600 to-indigo-900 flex items-center justify-center border-2 border-violet-400 shadow-lg overflow-hidden"
                  style={{ animation: 'battle-pulse 2s ease-in-out infinite' }}
                >
                  {uploadedAvatars.length > 0 ? (
                    <img 
                      src={uploadedAvatars[currentAvatarIndex]} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl md:text-3xl">{PLACEHOLDER_AVATARS[currentAvatarIndex]}</span>
                  )}
                </div>
                <div className="flex flex-col items-center mt-0.5">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 animate-bounce" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" transform="rotate(-90 12 12)"/>
                  </svg>
                  <span className="text-yellow-400 text-[10px] md:text-xs font-bold uppercase tracking-wide text-center leading-tight">
                    Battle<br/>Real Players
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
