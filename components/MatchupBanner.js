import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../contexts/ThemeContext';

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
  myLosses = 0
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPoolInfoModal, setShowPoolInfoModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [availablePool, setAvailablePool] = useState(null);
  const scrollRef = useRef(null);
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const totalSlides = 4;

  useEffect(() => {
    const fetchPool = async () => {
      try {
        const res = await fetch('/api/pools/available');
        const data = await res.json();
        if (data.pools && data.pools.length > 0) {
          setAvailablePool(data.pools[0]);
        }
      } catch (err) {
        console.error('Error fetching pool:', err);
      }
    };
    fetchPool();
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
              className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass} p-4`}
              onClick={() => setShowModal(true)}
            >
              <div className="flex items-center justify-between">
                
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
              onClick={() => router.push('/pools')}
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
                <svg className="absolute bottom-0 left-0 right-0 opacity-20" viewBox="0 0 1440 120" preserveAspectRatio="none">
                  <path fill="white" d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z">
                    <animate attributeName="d" dur="4s" repeatCount="indefinite" values="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L0,120Z;M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,64C672,53,768,43,864,48C960,53,1056,75,1152,80C1248,85,1344,75,1392,69.3L1440,64L1440,120L0,120Z;M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L0,120Z" />
                  </path>
                </svg>
              </div>
              <div className="relative z-10 p-4 min-h-[140px] md:min-h-[180px] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowPoolInfoModal(true); }}
                    className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
                  >
                    <span className="text-white/80">❓</span>
                    <span className="text-white font-medium text-xs md:text-sm underline underline-offset-2">HOW DO POOLS WORK?</span>
                  </button>
                  <div className="px-2 py-0.5 bg-white/20 rounded-full">
                    <span className="text-white text-[10px] font-semibold">${availablePool ? parseFloat(availablePool.buyIn).toFixed(0) : '25'} BUY-IN</span>
                  </div>
                </div>
                <div className="flex items-center justify-between flex-1">
                  <div className="flex flex-col">
                    <span className="text-white/70 text-[10px] uppercase tracking-wide mb-1">Prize Pool</span>
                    <span className="text-white text-2xl md:text-3xl font-black">
                      ${availablePool ? parseFloat(availablePool.calculatedPrizePool || availablePool.prizePool).toLocaleString() : '562.50'}
                    </span>
                    <span className="text-white/60 text-[10px]">Winner takes all</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex -space-x-2 mb-1">
                      {(availablePool?.participants || []).slice(0, 5).map((p, i) => (
                        <div 
                          key={p.odId || i} 
                          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-xs overflow-hidden"
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            ['🐉', '🦅', '🐺', '🦁', '🐯'][i] || '👤'
                          )}
                        </div>
                      ))}
                      {(!availablePool || availablePool.participants?.length === 0) && [...Array(3)].map((_, i) => (
                        <div 
                          key={`placeholder-${i}`} 
                          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 border-2 border-white/30 flex items-center justify-center text-xs"
                        >
                          {['🐉', '🦅', '🐺'][i]}
                        </div>
                      ))}
                      {availablePool && availablePool.spotsRemaining > 0 && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">+{availablePool.spotsRemaining}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-white/70 text-[10px]">
                      {availablePool ? `${availablePool.currentPlayers}/${availablePool.maxPlayers}` : '0/25'} Players
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-white/70 text-[10px] uppercase tracking-wide mb-1">
                      {availablePool?.status === 'filling' ? 'Almost Full!' : 'Starts When Full'}
                    </span>
                    <div className="px-3 py-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <span className="text-white text-sm font-bold">JOIN NOW</span>
                    </div>
                  </div>
                </div>
              </div>
              <style jsx>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                  50% { transform: translateY(-10px) scale(1.1); opacity: 0.5; }
                }
              `}</style>
            </div>

            {/* Container 3: Promo Placeholder */}
            <div data-slide-index="2" className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass}`}>
              <div className="h-full flex flex-col items-center justify-center p-6 min-h-[140px] md:min-h-[180px]">
                <span className="text-3xl md:text-4xl mb-2 md:mb-3">🏆</span>
                <h3 className={`text-base md:text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Leaderboard</h3>
                <p className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Top players this week</p>
              </div>
            </div>

            {/* Container 4: Promo Placeholder */}
            <div data-slide-index="3" className={`w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 ${containerClass}`}>
              <div className="h-full flex flex-col items-center justify-center p-6 min-h-[140px] md:min-h-[180px]">
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
            </div>
            </div>
          </div>
        </div>
      )}

      {showPoolInfoModal && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={() => setShowPoolInfoModal(false)}
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="flex min-h-full items-start justify-center p-4 pt-4 md:pt-8">
            <div 
              className={`relative w-full max-w-lg ${
                isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200'
              } border rounded-2xl overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPoolInfoModal(false)}
                className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full ${
                  isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                } transition-colors z-10`}
              >
                ✕
              </button>

              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-2xl">
                    🏊
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>How Pik Pools Work</h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Multi-player betting competitions</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">👥</span>
                      <div>
                        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Join a Pool</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Pay the buy-in to enter. Pools have 5-25 players competing for the prize pot.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💰</span>
                      <div>
                        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Everyone Starts Equal</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Each player gets $1,000 in virtual chips to bet with during the pool duration.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Make Your Picks</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Place bets on games during the pool window. Grow your bankroll to beat other players.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🏆</span>
                      <div>
                        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Winner Takes All</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          The player with the highest balance when time expires wins 90% of the prize pot!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'}`}>
                    <p className={`text-sm text-center ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                      <span className="font-semibold">Example:</span> 25 players × $25 buy-in = $625 pot → Winner gets $562.50
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => { setShowPoolInfoModal(false); router.push('/pools'); }}
                  className="w-full mt-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all"
                >
                  Browse Available Pools
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
