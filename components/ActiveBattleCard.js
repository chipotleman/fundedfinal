import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '../contexts/ThemeContext';
import ForfeitModal from './battle/ForfeitModal';

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const MODE_THEMES = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 25%, #1a0a00 50%, #0d0500 75%, #050200 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    vsColor: '#fb923c',
    prizeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    glowColor: 'rgba(251,146,60,0.4)',
    emberColors: ['#fdba74', '#fb923c', '#f97316'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef3c7 0%, #fb923c 50%, #ea580c 100%)',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    cardBg: 'linear-gradient(135deg, #020a18 0%, #0a1628 25%, #122240 50%, #0d1a30 75%, #050d1a 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    vsColor: '#ffffff',
    prizeColor: '#facc15',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    glowColor: 'rgba(59,130,246,0.4)',
    emberColors: ['#93c5fd', '#60a5fa', '#3b82f6'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 25%, #0a1a0e 50%, #040d06 75%, #020804 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    vsColor: '#facc15',
    prizeColor: '#10b981',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    glowColor: 'rgba(16,185,129,0.4)',
    emberColors: ['#6ee7b7', '#34d399', '#10b981'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
};

function getGameMode(matchup) {
  const dm = matchup?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function ActiveBattleCard({
  matchup,
  opponent,
  myBalance,
  opponentBalance,
  myBetsCount = 0,
  opponentBets = [],
  canSeeBets = false,
  onForfeit,
  myProfile,
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();

  const userAvatar = myProfile?.avatar || null;
  const userName = myProfile?.username || session?.user?.name || 'You';

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

  const mode = getGameMode(matchup);
  const theme = MODE_THEMES[mode];

  const myBalanceNum = parseFloat(myBalance ?? 0);
  const oppBalanceNum = parseFloat(opponentBalance ?? 0);
  const startingBalance = parseFloat(matchup.startingBalance ?? 0);
  const isWinning = myBalanceNum > oppBalanceNum;
  const isLosing = myBalanceNum < oppBalanceNum;
  const isTied = myBalanceNum === oppBalanceNum;
  const winnerPayout = parseFloat(matchup.winnerPayout ?? 0);
  const myPnL = myBalanceNum - startingBalance;
  const oppPnL = oppBalanceNum - startingBalance;
  const settledBets = opponentBets.filter(b => b.status !== 'pending');
  const minPicks = 4;
  const piksRemaining = Math.max(0, minPicks - myBetsCount);

  return (
    <>
      <style>{`
        @keyframes abc-ember-float {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 0.9; 
          }
          100% { 
            transform: translateY(-160px) translateX(10px) scale(0.3); 
            opacity: 0; 
          }
        }
        @keyframes abc-smoke-rise {
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
        @keyframes abc-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes abc-glow {
          0%, 100% { box-shadow: 0 0 15px ${theme.glowColor}; }
          50% { box-shadow: 0 0 30px ${theme.glowColor}, 0 0 50px ${theme.glowColor}; }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px] active:scale-[0.98]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${isWinning ? 'rgba(34, 197, 94, 0.5)' : isLosing ? 'rgba(239, 68, 68, 0.5)' : theme.borderColor}`,
        }}
        onClick={() => setShowModal(true)}
      >
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${theme.glowColor} 0%, transparent 60%)`,
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
                background: `radial-gradient(circle, rgba(100,100,100,${theme.smokeOpacity + 0.05}) 0%, rgba(70,70,70,${theme.smokeOpacity * 0.5}) 50%, transparent 70%)`,
                filter: 'blur(6px)',
                animation: `abc-smoke-rise ${3.5 + (i % 3) * 0.8}s linear infinite`,
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
                background: theme.emberColors[i % 3],
                boxShadow: `0 0 ${6 + (i % 3) * 3}px ${theme.emberColors[i % 3]}`,
                animation: `abc-ember-float ${2.5 + (i % 5) * 0.4}s linear infinite`,
                animationDelay: `${(i * 0.12)}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 h-full flex items-center px-4 md:px-8">
          <div className="flex items-center w-full">
            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: `3px solid ${theme.avatarRing}`,
                  boxShadow: theme.avatarGlow,
                  background: '#111',
                  animation: 'abc-glow 2s ease-in-out infinite',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                )}
              </div>
              <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center mt-1">{userName}</p>
              <p className={`text-[10px] md:text-xs font-bold leading-tight ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                ${myBalanceNum.toLocaleString()}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center" style={{ width: '50%' }}>
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full mb-1" style={{ background: theme.badgeBg }}>
                <span className="text-[8px] md:text-[9px]">{theme.icon}</span>
                <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
              </div>

              <div
                className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text mb-0.5"
                style={{
                  backgroundImage: theme.vsGradient,
                  WebkitBackgroundClip: 'text',
                  animation: 'abc-vs-pulse 2s ease-in-out infinite',
                }}
              >
                VS
              </div>

              <div className="text-center">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-none">Prize</p>
                <p className="text-sm md:text-lg font-black leading-tight" style={{
                  color: theme.prizeColor,
                  textShadow: `0 0 10px rgba(${theme.accentRgb},0.4)`,
                }}>
                  ${winnerPayout.toLocaleString()}
                </p>
              </div>

              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold mt-0.5 ${
                isWinning ? 'bg-green-500/20 text-green-400'
                : isLosing ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {isTied ? 'TIED' : isWinning ? 'WINNING' : 'BEHIND'}
                <span className="text-white/50">{formatTimer(timeRemaining)}</span>
              </div>
            </div>

            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: '3px solid #ef4444',
                  boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                  background: '#111',
                }}
              >
                {opponent.avatar ? (
                  <img src={opponent.avatar} alt={opponent.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-white/70">{(opponent.username || 'O')[0].toUpperCase()}</span>
                )}
              </div>
              <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center mt-1">{opponent.username || 'Opponent'}</p>
              <p className="text-[10px] md:text-xs font-bold text-red-400 leading-tight">
                ${oppBalanceNum.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="flex min-h-full items-start justify-center p-4 pt-4 md:pt-8">
            <div
              className={`relative w-full max-w-2xl rounded-2xl overflow-hidden ${isDarkMode ? 'bg-[#111] border border-gray-800' : 'bg-white border border-gray-200'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.accentColor + '33' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{theme.icon}</span>
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{theme.label} Battle</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                >
                  <svg className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                    <h4 className="font-semibold text-sm mb-3 text-green-400">Your Stats</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Balance</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${myBalanceNum.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">P&L</p>
                        <p className={`font-bold ${myPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {myPnL >= 0 ? '+' : ''}${myPnL.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Bets</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myBetsCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Time Left</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                    <h4 className="font-semibold text-sm mb-3 text-red-400">{opponent.username}'s Stats</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Balance</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${oppBalanceNum.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">P&L</p>
                        <p className={`font-bold ${oppPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {oppPnL >= 0 ? '+' : ''}${oppPnL.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Bets</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentBets.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Staked</p>
                        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${settledBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className={`font-semibold text-sm mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Opponent's Bets</h4>
                  {canSeeBets ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {opponentBets.length === 0 ? (
                        <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No bets placed yet</p>
                      ) : (
                        opponentBets.map((bet, i) => (
                          <div key={i} className={`flex justify-between items-center p-3 rounded-lg text-sm ${isDarkMode ? 'bg-black/30' : 'bg-white'}`}>
                            <div className="flex-1 truncate">
                              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{bet.selection}</span>
                              <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>({bet.odds})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400">${parseFloat(bet.stake).toFixed(0)}</span>
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
                      <p className="text-sm text-center text-gray-500">
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
                        setShowForfeitModal(true);
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

      <ForfeitModal
        isOpen={showForfeitModal}
        matchup={matchup}
        onCancel={() => setShowForfeitModal(false)}
        onConfirm={async () => {
          if (onForfeit) {
            await onForfeit();
          }
          setShowForfeitModal(false);
          setShowModal(false);
        }}
      />
    </>
  );
}
