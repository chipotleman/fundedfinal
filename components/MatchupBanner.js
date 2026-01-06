import { useState, useEffect, useRef } from 'react';
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef(null);
  const { isDarkMode } = useTheme();

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

  const pendingBets = opponentBets.filter(b => b.status === 'pending');
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

  const slides = [
    { id: 'battle', label: 'Battle Status' },
    { id: 'stats', label: 'Detailed Stats' },
    { id: 'bets', label: 'Opponent Bets' }
  ];

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const slideWidth = scrollRef.current.offsetWidth;
      const newSlide = Math.round(scrollLeft / slideWidth);
      setCurrentSlide(newSlide);
    }
  };

  const scrollToSlide = (index) => {
    if (scrollRef.current) {
      const slideWidth = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
      setCurrentSlide(index);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-center md:justify-start">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="w-full md:w-[864px] overflow-x-auto snap-x snap-mandatory scrollbar-hide flex"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {/* Slide 1: Battle Status */}
          <div className="w-full md:w-[864px] flex-shrink-0 snap-center">
            <div className={`h-full ${
              isDarkMode 
                ? 'bg-white/5 backdrop-blur-xl border-white/10' 
                : 'bg-white/80 backdrop-blur-xl border-gray-200'
            } border rounded-2xl overflow-hidden`}>
              
              <div className="flex justify-center">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-b-lg ${
                  isDarkMode ? 'bg-white/10 backdrop-blur-md border-x border-b border-white/10' : 'bg-gray-100 border border-gray-200'
                }`}>
                  <span className="text-sm">🎮</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {durationLabel}
                  </span>
                </div>
              </div>

              <div className="p-3">
                <div className="flex items-stretch gap-2">
                  
                  <div className={`flex flex-col items-center flex-1 py-2 md:py-3 px-2 rounded-xl ${
                    isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-base md:text-lg text-white shadow-lg shadow-green-500/30 mb-1.5 border-2 border-green-300/50">
                      🐉
                    </div>
                    <span className={`text-[9px] md:text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Balance</span>
                    <p className="text-lg md:text-2xl font-extrabold text-green-400 mb-1">
                      ${myBalanceNum.toLocaleString()}
                    </p>
                    <p className={`text-[8px] md:text-[9px] uppercase tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{piksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center flex-1 px-2 py-2 md:py-3">
                    <span className="text-2xl md:text-3xl mb-0.5">🏆</span>
                    <span className={`text-[9px] md:text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Prize Pool</span>
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

                  <div className={`flex flex-col items-center flex-1 py-2 md:py-3 px-2 rounded-xl ${
                    isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                  }`}>
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
                    <p className={`text-[8px] md:text-[9px] uppercase tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{oppPiksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slide 2: Detailed Stats */}
          <div className="w-full md:w-[864px] flex-shrink-0 snap-center">
            <div className={`h-full ${
              isDarkMode 
                ? 'bg-white/5 backdrop-blur-xl border-white/10' 
                : 'bg-white/80 backdrop-blur-xl border-gray-200'
            } border rounded-2xl overflow-hidden p-4`}>
              
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-lg">📊</span>
                <span className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Battle Stats
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className={`font-semibold text-xs mb-2 text-green-400`}>Your Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Balance</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${myBalanceNum.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>P&L</p>
                      <p className={`font-bold ${myPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {myPnL >= 0 ? '+' : ''}${myPnL.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Bets</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myBetsCount}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Record</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myWins}W - {myLosses}L</p>
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className={`font-semibold text-xs mb-2 text-red-400`}>{opponent.username}'s Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Balance</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${oppBalanceNum.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>P&L</p>
                      <p className={`font-bold ${oppPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {oppPnL >= 0 ? '+' : ''}${oppPnL.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Bets</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentBets.length}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Total Staked</p>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${settledBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slide 3: Opponent Bets */}
          <div className="w-full md:w-[864px] flex-shrink-0 snap-center">
            <div className={`h-full ${
              isDarkMode 
                ? 'bg-white/5 backdrop-blur-xl border-white/10' 
                : 'bg-white/80 backdrop-blur-xl border-gray-200'
            } border rounded-2xl overflow-hidden p-4`}>
              
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-lg">🎯</span>
                <span className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Opponent's Bets
                </span>
              </div>

              {canSeeBets ? (
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                  {opponentBets.length === 0 ? (
                    <p className={`text-center text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No bets placed yet</p>
                  ) : (
                    opponentBets.slice(0, 4).map((bet, i) => (
                      <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-xs ${
                        isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className="flex-1 truncate">
                          <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{bet.selection}</span>
                          <span className={`ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>({bet.odds})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>${parseFloat(bet.stake).toFixed(0)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
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
                  {opponentBets.length > 4 && (
                    <p className={`text-center text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      +{opponentBets.length - 4} more bets
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="text-3xl mb-2">🔒</div>
                  <p className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Place a bet to reveal opponent's bets
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicators */}
      <div className="flex justify-center gap-2 mt-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => scrollToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentSlide === index 
                ? (isDarkMode ? 'bg-white w-6' : 'bg-gray-900 w-6')
                : (isDarkMode ? 'bg-white/30 hover:bg-white/50' : 'bg-gray-300 hover:bg-gray-400')
            }`}
            aria-label={`Go to ${slide.label}`}
          />
        ))}
      </div>
    </div>
  );
}
