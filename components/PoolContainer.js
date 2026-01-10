import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PiksPoolPopup from './PiksPoolPopup';

function formatTimeRemaining(ms) {
  if (!ms || ms <= 0) return 'Ended';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const h = hours % 24;
    return `${days}d ${h}h`;
  }
  if (hours > 0) {
    const m = minutes % 60;
    return `${hours}h ${m}m`;
  }
  if (minutes > 0) {
    const s = seconds % 60;
    return `${minutes}m ${s}s`;
  }
  return `${seconds}s`;
}

export default function PoolContainer({ isDarkMode }) {
  const getInitialPoolState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('poolContainerState');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return null;
  };

  const [availablePool, setAvailablePool] = useState(null);
  const [myPoolData, setMyPoolData] = useState(getInitialPoolState);
  const [poolTimeRemaining, setPoolTimeRemaining] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [showPoolPopup, setShowPoolPopup] = useState(false);
  
  const holdStartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFromRef = useRef(0);

  const HOLD_DURATION = 1500;
  const RELEASE_DURATION = 800;

  const fetchPoolData = async () => {
    try {
      const [availableRes, myPoolRes] = await Promise.all([
        fetch('/api/pools/available', { credentials: 'include' }),
        fetch('/api/pools/my-pool', { credentials: 'include' })
      ]);
      
      const availableData = await availableRes.json();
      if (availableData.pools && availableData.pools.length > 0) {
        setAvailablePool(availableData.pools[0]);
      }
      
      const myPoolDataRes = await myPoolRes.json();
      if (myPoolDataRes.hasActivePool) {
        setMyPoolData(myPoolDataRes);
        try {
          localStorage.setItem('poolContainerState', JSON.stringify(myPoolDataRes));
        } catch (e) {}
      } else {
        setMyPoolData(null);
        try {
          localStorage.removeItem('poolContainerState');
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error fetching pool:', err);
    }
  };

  useEffect(() => {
    fetchPoolData();
  }, []);

  useEffect(() => {
    if (!myPoolData?.pool?.endsAt) return;
    
    const updatePoolTime = () => {
      const remaining = new Date(myPoolData.pool.endsAt).getTime() - Date.now();
      setPoolTimeRemaining(remaining > 0 ? remaining : 0);
    };
    
    updatePoolTime();
    const interval = setInterval(updatePoolTime, 1000);
    return () => clearInterval(interval);
  }, [myPoolData?.pool?.endsAt]);

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
        setShowPoolPopup(true);
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const endHold = () => {
    if (!isHolding) return;
    
    setIsHolding(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    releaseFromRef.current = holdProgress;
    releaseStartRef.current = Date.now();
    
    const animateRelease = () => {
      const elapsed = Date.now() - releaseStartRef.current;
      const progress = Math.max(releaseFromRef.current - (elapsed / RELEASE_DURATION) * releaseFromRef.current, 0);
      setHoldProgress(progress);
      
      if (progress > 0) {
        animationFrameRef.current = requestAnimationFrame(animateRelease);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animateRelease);
  };

  const handleJoinSuccess = () => {
    fetchPoolData();
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative"
      style={{
        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 25%, #0369a1 50%, #075985 75%, #0c4a6e 100%)',
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          {[...Array(8)].map((_, i) => (
            <div
              key={`bubble-${i}`}
              className="absolute rounded-full bg-white/20"
              style={{
                width: `${20 + (i * 5)}px`,
                height: `${20 + (i * 5)}px`,
                left: `${10 + (i * 11)}%`,
                top: `${20 + (i * 8) % 60}%`,
                animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
        {!myPoolData && (
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
                background: 'linear-gradient(to top, #0ea5e9 0%, rgba(103, 232, 249, 0.8) 70%, transparent 100%)'
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-[30px]" style={{ transform: 'translateY(-50%)' }}>
              <svg 
                className="w-[200%] h-full pool-wave-crest" 
                viewBox="0 0 2880 30" 
                preserveAspectRatio="none"
                style={{ filter: 'blur(1px)' }}
              >
                <path 
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.7)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  d="M0,15 C60,8 120,22 180,15 C240,8 300,22 360,15 C420,8 480,22 540,15 C600,8 660,22 720,15 C780,8 840,22 900,15 C960,8 1020,22 1080,15 C1140,8 1200,22 1260,15 C1320,8 1380,22 1440,15 C1500,8 1560,22 1620,15 C1680,8 1740,22 1800,15 C1860,8 1920,22 1980,15 C2040,8 2100,22 2160,15 C2220,8 2280,22 2340,15 C2400,8 2460,22 2520,15 C2580,8 2640,22 2700,15 C2760,8 2820,22 2880,15"
                />
              </svg>
            </div>
            <div 
              className="absolute top-0 left-0 right-0 h-[20px]" 
              style={{ 
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)'
              }} 
            />
          </div>
        )}
      </div>
      
      {myPoolData ? (
        <div className="relative z-10 p-4 h-[140px] md:h-[180px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-[10px] uppercase tracking-wide">Your Rank</span>
              <span className={`text-xl font-black ${myPoolData.userRank === 1 ? 'text-yellow-400' : myPoolData.userRank <= 3 ? 'text-cyan-300' : 'text-white'}`}>
                #{myPoolData.userRank}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-[10px] uppercase">Balance</span>
              <span className="text-white text-lg font-black">${myPoolData.userBalance?.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
              <span className="text-[10px]">⏱️</span>
              <span className="text-white text-xs font-bold">{formatTimeRemaining(poolTimeRemaining)}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-1">
            {myPoolData.leaderboard?.slice(0, 5).map((player, i) => (
              <div 
                key={player.odId || i}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                  player.isCurrentUser ? 'bg-cyan-400/30 border border-cyan-300/50' : 'bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-5 ${player.rank === 1 ? 'text-yellow-400' : 'text-white/70'}`}>
                    {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                  </span>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] overflow-hidden ${
                    player.isCurrentUser 
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-800 border-yellow-400' 
                      : 'bg-gradient-to-br from-cyan-300 to-blue-500 border-white/30'
                  }`}>
                    {player.isCurrentUser ? (
                      '🐍'
                    ) : player.avatar ? (
                      <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <span className={`text-xs font-medium ${player.isCurrentUser ? 'text-cyan-200' : 'text-white/80'}`}>
                    {player.isCurrentUser ? 'You' : player.username}
                  </span>
                </div>
                <span className={`text-sm font-bold ${player.isCurrentUser ? 'text-cyan-200' : 'text-white'}`}>
                  ${player.balance?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
            <span className="text-white/60 text-[10px]">🏆 Prize: ${myPoolData.pool?.prizePool?.toLocaleString()}</span>
            <span className="text-white/60 text-[10px]">{myPoolData.pool?.currentPlayers}/{myPoolData.pool?.maxPlayers} Players</span>
          </div>
        </div>
      ) : (
        <div className="relative z-10 p-4 h-[140px] md:h-[180px] flex flex-col overflow-hidden">
          <div className="absolute top-3 right-3 bg-yellow-400 text-black px-3 py-1 rounded-md shadow-lg transform rotate-3" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 5% 50%)' }}>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black">${availablePool ? parseFloat(availablePool.buyIn).toFixed(0) : '25'}</span>
              <span className="text-[8px] font-bold uppercase">Entry</span>
            </div>
          </div>
          <div className="flex flex-col mb-1">
            <span className="text-white/70 text-[10px] uppercase tracking-wide">Prize Pool</span>
            <span className="text-white text-lg md:text-4xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              ${availablePool ? parseFloat(availablePool.maxPrizePool || availablePool.prizePool).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '562.50'}
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
                className="absolute inset-0 bg-gradient-to-r from-cyan-300 to-white"
                style={{
                  width: `${holdProgress * 100}%`,
                  opacity: 0.6,
                }}
              />
              <span className="relative text-white text-sm md:text-base font-bold tracking-wide pointer-events-none">
                {isHolding ? 'JOINING...' : 'HOLD TO JOIN'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className="text-white/60 text-[10px]">Winner takes all</span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {(availablePool?.participants || []).slice(0, 3).map((p, i) => (
                  <div 
                    key={p.odId || i} 
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-[10px] overflow-hidden"
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      ['🐉', '🦅', '🐺'][i] || '👤'
                    )}
                  </div>
                ))}
                {(!availablePool?.participants || availablePool.participants.length === 0) && (
                  <>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-[10px]">🐉</div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-[10px]">🦅</div>
                  </>
                )}
              </div>
              <span className="text-white/80 text-[10px] font-medium">
                {availablePool ? `${availablePool.currentPlayers}/${availablePool.maxPlayers}` : '0/25'} joined
              </span>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .pool-wave-crest {
          animation: pool-wave-shift 10s linear infinite;
        }
        @keyframes pool-wave-shift {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      
      {typeof window !== 'undefined' && createPortal(
        <PiksPoolPopup 
          isOpen={showPoolPopup}
          onClose={() => setShowPoolPopup(false)}
          pool={availablePool}
          onJoinSuccess={handleJoinSuccess}
        />,
        document.body
      )}
    </div>
  );
}
