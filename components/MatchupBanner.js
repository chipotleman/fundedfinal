import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../contexts/ThemeContext';
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

export default function MatchupBanner({ 
  matchup, 
  opponent, 
  myBalance, 
  opponentBalance,
  opponentBets = [],
  canSeeBets = false,
  onRefreshOpponentBets,
  myBetsCount = 0,
  myWins = 0,
  myLosses = 0,
  onForfeit,
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [availablePool, setAvailablePool] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [showPoolPopup, setShowPoolPopup] = useState(false);
  const [myPoolData, setMyPoolData] = useState(null);
  const [poolTimeRemaining, setPoolTimeRemaining] = useState(null);
  const scrollRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const holdStartRef = useRef(null);
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const totalSlides = 4;

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

  const handleJoinSuccess = () => {
    fetchPoolData();
  };

  // Hold-to-join handlers
  const HOLD_DURATION = 1500; // 1.5 seconds to complete
  const RELEASE_DURATION = 800; // 0.8 seconds to drain back
  const animationFrameRef = useRef(null);
  const releaseStartRef = useRef(null);
  const releaseFromRef = useRef(0);

  const startHold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cancel any ongoing release animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setIsHolding(true);
    holdStartRef.current = Date.now();
    const startFrom = holdProgress; // Continue from current position
    
    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      // Account for starting from a partial fill
      const progress = Math.min(startFrom + (elapsed / HOLD_DURATION) * (1 - startFrom), 1);
      setHoldProgress(progress);
      
      if (progress >= 1) {
        setIsHolding(false);
        setHoldProgress(0);
        setShowPoolPopup(true);
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
    
    // Animate water draining back down
    releaseStartRef.current = Date.now();
    releaseFromRef.current = holdProgress;
    
    const animateDrain = () => {
      const elapsed = Date.now() - releaseStartRef.current;
      const t = Math.min(elapsed / RELEASE_DURATION, 1);
      // Ease-out cubic for smooth wave-like motion
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!matchup?.endsAt) return;

    const updateTime = () => {
      const remaining = new Date(matchup.endsAt).getTime() - Date.now();
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [matchup?.endsAt]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollLeft = container.scrollLeft;
      const containerCenter = scrollLeft + container.offsetWidth / 2;
      
      const slides = container.querySelectorAll('[data-slide-index]');
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(containerCenter - slideCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      setCurrentSlide(closestIndex);
    }
  };

  const scrollToSlide = (index) => {
    if (scrollRef.current) {
      const slides = scrollRef.current.querySelectorAll('[data-slide-index]');
      const targetSlide = slides[index];
      if (targetSlide) {
        scrollRef.current.scrollTo({
          left: targetSlide.offsetLeft,
          behavior: 'smooth'
        });
      }
    }
  };

  if (!matchup || !opponent) return null;

  const myBalanceNum = parseFloat(myBalance || 0);
  const oppBalanceNum = parseFloat(opponentBalance || 0);
  const startingBalance = parseFloat(matchup.startingBalance || 0);
  const isWinning = myBalanceNum > oppBalanceNum;
  const isLosing = myBalanceNum < oppBalanceNum;
  const isTied = myBalanceNum === oppBalanceNum;

  const winnerPayout = parseFloat(matchup.winnerPayout || 0);

  const myPnL = myBalanceNum - startingBalance;
  const oppPnL = oppBalanceNum - startingBalance;

  const settledBets = opponentBets.filter(b => b.status !== 'pending');

  const getDurationLabel = (durationType) => {
    const labels = {
      '30_min': '30 MIN FLASH',
      '1_hour': '1 HOUR BATTLE',
      '1_day': '24 HOUR BATTLE',
      '3_days': '3 DAY BATTLE',
      '1_week': '1 WEEK BATTLE'
    };
    return labels[durationType] || durationType?.replace(/_/g, ' ')?.toUpperCase() || 'BATTLE';
  };

  const durationLabel = getDurationLabel(matchup.durationType);

  const minPicks = 4;
  const piksRemaining = Math.max(0, minPicks - myBetsCount);
  const oppPiksRemaining = Math.max(0, minPicks - opponentBets.length);

  const formatTimer = (ms) => {
    if (!ms || ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const containerClass = `${
    isDarkMode 
      ? 'bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/10' 
      : 'bg-white/80 backdrop-blur-xl border-gray-200 hover:bg-white'
  } border rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer`;

  return (
    <>
      <div className="mb-6">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            
            {/* Container 1: Battle Status */}
            <div 
              data-slide-index="0"
              className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass} p-4 h-[140px] md:h-[180px]`}
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center justify-between h-full">
                
                {/* Left - User */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-base md:text-lg text-white shadow-lg shadow-green-500/30 mb-1.5 border-2 border-green-300/50">
                    🐉
                  </div>
                  <span className={`text-[9px] md:text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Balance</span>
                  <p className="text-lg md:text-2xl font-extrabold text-green-400 mb-1">
                    ${myBalanceNum.toLocaleString()}
                  </p>
                  <p className={`text-[11px] md:text-xs uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{piksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
                  </p>
                </div>

                {/* Center - Prize Pool */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full mb-2 ${
                    isDarkMode ? 'bg-white/10' : 'bg-gray-100'
                  }`}>
                    <span className="text-[10px]">🎮</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {durationLabel}
                    </span>
                  </div>
                  <span className="text-2xl md:text-3xl mb-0.5">🏆</span>
                  <p className="text-2xl md:text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] mb-1.5">
                    ${winnerPayout.toLocaleString()}
                  </p>
                  
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg text-[10px] md:text-xs ${
                    isWinning 
                      ? 'bg-green-500 text-white shadow-green-500/30' 
                      : isLosing 
                        ? 'bg-red-500 text-white shadow-red-500/30' 
                        : 'bg-yellow-500 text-black shadow-yellow-500/30'
                  }`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold whitespace-nowrap">
                      {isTied ? 'Tied!' : isWinning ? "You're winning!" : "You're behind"}
                    </span>
                  </div>
                </div>

                {/* Right - Opponent */}
                <div className="flex flex-col items-center flex-1">
                  {opponent.avatar ? (
                    <img 
                      src={opponent.avatar} 
                      alt={opponent.username}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-red-300/50 shadow-lg shadow-red-500/30 mb-1.5"
                    />
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-base md:text-lg text-white shadow-lg shadow-red-500/30 mb-1.5 border-2 border-red-300/50">
                      🦅
                    </div>
                  )}
                  <span className={`text-[9px] md:text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Opponent</span>
                  <p className="text-lg md:text-2xl font-extrabold text-red-400 mb-1">
                    ${oppBalanceNum.toLocaleString()}
                  </p>
                  <p className={`text-[11px] md:text-xs uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{oppPiksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Container 2: Pik Pool */}
            <div 
              data-slide-index="1" 
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
                        className="w-[200%] h-full wave-crest" 
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
                        key={player.odId || player.odId || i}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                          player.isCurrentUser ? 'bg-cyan-400/30 border border-cyan-300/50' : 'bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold w-5 ${player.rank === 1 ? 'text-yellow-400' : 'text-white/70'}`}>
                            {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                          </span>
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border border-white/30 flex items-center justify-center text-[10px] overflow-hidden">
                            {player.avatar ? (
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
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>Prize Pool</span>
                    <span className="text-lg md:text-4xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ color: '#ffffff' }}>
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
                      <span className="relative text-sm md:text-base font-bold tracking-wide pointer-events-none" style={{ color: '#ffffff' }}>
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
                        {(!availablePool || availablePool.participants?.length === 0) && [...Array(3)].map((_, i) => (
                          <div 
                            key={`placeholder-${i}`} 
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-[10px]"
                          >
                            {['🐉', '🦅', '🐺'][i]}
                          </div>
                        ))}
                      </div>
                      <span className="text-white/70 text-[10px]">
                        {availablePool ? `${availablePool.currentPlayers}/${availablePool.maxPlayers}` : '0/25'} Players
                      </span>
                    </div>
                    <span className="text-white/70 text-[10px]">
                      {availablePool?.status === 'filling' ? 'Almost Full!' : 'Starts When Full'}
                    </span>
                  </div>
                </div>
              )}
              <style jsx>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                  50% { transform: translateY(-10px) scale(1.1); opacity: 0.5; }
                }
                .wave-crest {
                  animation: waveSlide 10s linear infinite;
                }
                @keyframes waveSlide {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
              `}</style>
            </div>

            {/* Container 3: Promo Placeholder */}
            <div data-slide-index="2" className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass}`}>
              <div className="h-[140px] md:h-[180px] flex flex-col items-center justify-center p-6">
                <span className="text-3xl md:text-4xl mb-2 md:mb-3">🏆</span>
                <h3 className={`text-base md:text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Leaderboard</h3>
                <p className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Top players this week</p>
              </div>
            </div>

            {/* Container 4: Promo Placeholder */}
            <div data-slide-index="3" className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass}`}>
              <div className="h-[140px] md:h-[180px] flex flex-col items-center justify-center p-6">
                <span className="text-3xl md:text-4xl mb-2 md:mb-3">💎</span>
                <h3 className={`text-base md:text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>VIP Program</h3>
                <p className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Exclusive benefits await</p>
              </div>
            </div>

          </div>
        </div>

        {/* Small indicator dots */}
        <div className="flex justify-center gap-1.5 mt-2">
          {[...Array(totalSlides)].map((_, i) => (
            <span
              key={i}
              onClick={() => scrollToSlide(i)}
              role="button"
              aria-label={`Go to slide ${i + 1}`}
              style={{ width: '6px', height: '6px', minWidth: '6px', minHeight: '6px' }}
              className={`block rounded-full cursor-pointer transition-all duration-200 ${
                currentSlide === i 
                  ? (isDarkMode ? 'bg-white' : 'bg-gray-900')
                  : (isDarkMode ? 'bg-white/30' : 'bg-gray-300')
              }`}
            />
          ))}
        </div>
      </div>

      {/* Modal for detailed info */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="flex min-h-full items-start justify-center p-4 pt-4 md:pt-8">
            <div 
              className={`relative w-full max-w-2xl ${
                isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200'
              } border rounded-2xl overflow-hidden`}
              onClick={e => e.stopPropagation()}
            >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Battle Details</h2>
              <button 
                onClick={() => setShowModal(false)}
                className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className="font-semibold text-sm mb-3 text-green-400">Your Stats</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Balance</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${myBalanceNum.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>P&L</p>
                      <p className={`font-bold ${myPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {myPnL >= 0 ? '+' : ''}${myPnL.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Bets</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myBetsCount}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Record</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myWins}W - {myLosses}L</p>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className="font-semibold text-sm mb-3 text-red-400">{opponent.username}'s Stats</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Balance</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${oppBalanceNum.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>P&L</p>
                      <p className={`font-bold ${oppPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {oppPnL >= 0 ? '+' : ''}${oppPnL.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Bets</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentBets.length}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Staked</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${settledBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opponent Bets */}
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <h4 className={`font-semibold text-sm mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Opponent's Bets</h4>
                {canSeeBets ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {opponentBets.length === 0 ? (
                      <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No bets placed yet</p>
                    ) : (
                      opponentBets.map((bet, i) => (
                        <div key={i} className={`flex justify-between items-center p-3 rounded-lg text-sm ${
                          isDarkMode ? 'bg-black/30' : 'bg-white'
                        }`}>
                          <div className="flex-1 truncate">
                            <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{bet.selection}</span>
                            <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>({bet.odds})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>${parseFloat(bet.stake).toFixed(0)}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              bet.status === 'won' ? 'bg-green-500/20 text-green-400' :
                              bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {bet.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="text-4xl mb-2">🔒</div>
                    <p className={`text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Place a bet to reveal opponent's bets
                    </p>
                  </div>
                )}
              </div>

              {onForfeit && (
                <div className="pt-2 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to forfeit this battle? Your opponent will be declared the winner and receive the payout.')) {
                        onForfeit();
                        setShowModal(false);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                  >
                    Forfeit Battle
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
      
      <PiksPoolPopup 
        isOpen={showPoolPopup} 
        onClose={() => setShowPoolPopup(false)} 
        pool={availablePool}
        onJoinSuccess={handleJoinSuccess}
      />
    </>
  );
}
