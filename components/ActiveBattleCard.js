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
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 30%, #1a0a00 70%, #0d0500 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(251,146,60,0.12) 0%, rgba(251,146,60,0.04) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(251,146,60,0.12) 0%, rgba(251,146,60,0.04) 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    vsColor: '#fb923c',
    prizeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    scanAnim: 'rush-scan',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    cardBg: 'linear-gradient(135deg, #020a1a 0%, #0c1a35 30%, #081428 70%, #040c18 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(251,146,60,0.10) 0%, rgba(251,146,60,0.03) 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    vsColor: '#ffffff',
    prizeColor: '#facc15',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    scanAnim: 'original-pulse',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 30%, #0a1a0e 70%, #040d06 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(250,204,21,0.10) 0%, rgba(250,204,21,0.03) 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    vsColor: '#facc15',
    prizeColor: '#10b981',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    scanAnim: 'tournament-shimmer',
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
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const [userName, setUserName] = useState('You');
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.avatar) setUserAvatar(data.avatar);
          if (data?.username) setUserName(data.username);
        })
        .catch(() => {});
    }
  }, [session?.user?.id]);

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
        @keyframes rush-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes original-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes tournament-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes avatar-ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px] active:scale-[0.98]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${isWinning ? 'rgba(34, 197, 94, 0.5)' : isLosing ? 'rgba(239, 68, 68, 0.5)' : 'rgba(250, 204, 21, 0.5)'}`,
        }}
        onClick={() => setShowModal(true)}
      >
        {mode === 'rush' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.1 }}>
            <div className="absolute inset-0" style={{
              background: `linear-gradient(90deg, transparent, rgba(${theme.accentRgb},0.5), transparent)`,
              animation: 'rush-scan 1.8s linear infinite',
            }} />
          </div>
        )}
        {mode === 'original' && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 50% 100%, rgba(${theme.accentRgb},0.12) 0%, transparent 60%)`,
            animation: 'original-pulse 3s ease-in-out infinite',
          }} />
        )}
        {mode === 'tournament' && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(270deg, rgba(16,185,129,0.04), rgba(250,204,21,0.06), rgba(16,185,129,0.04))`,
            backgroundSize: '200% 200%',
            animation: 'tournament-shimmer 6s ease infinite',
          }} />
        )}

        <div className="relative z-10 h-full flex items-stretch">
          <div className="flex-1 flex flex-col items-center justify-center px-2 md:px-4 relative" style={{ background: theme.leftPanelBg }}>
            <div className="relative mb-1">
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: `3px solid ${theme.avatarRing}`,
                  boxShadow: theme.avatarGlow,
                  background: '#111',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl md:text-3xl">👤</span>
                )}
              </div>
            </div>
            <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center">{userName}</p>
            <p className={`text-[10px] md:text-xs font-bold leading-tight ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
              ${myBalanceNum.toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center w-[100px] md:w-[140px] flex-shrink-0 relative z-20">
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full mb-1" style={{ background: theme.badgeBg }}>
              <span className="text-[8px] md:text-[9px]">{theme.icon}</span>
              <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
            </div>

            <div
              className="text-xl md:text-2xl font-black italic mb-0.5"
              style={{
                color: theme.vsColor,
                textShadow: `0 0 12px rgba(${theme.accentRgb},0.5)`,
                animation: 'vs-pulse 2s ease-in-out infinite',
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

          <div className="flex-1 flex flex-col items-center justify-center px-2 md:px-4 relative" style={{ background: theme.rightPanelBg }}>
            <div className="relative mb-1">
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
                  <span className="text-2xl md:text-3xl">👤</span>
                )}
              </div>
            </div>
            <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center">{opponent.username || 'Opponent'}</p>
            <p className="text-[10px] md:text-xs font-bold text-red-400 leading-tight">
              ${oppBalanceNum.toLocaleString()}
            </p>
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
