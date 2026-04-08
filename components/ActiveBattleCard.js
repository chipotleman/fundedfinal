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
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.avatar) setUserAvatar(data.avatar);
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

  const getDurationLabel = (durationType) => {
    const labels = {
      '30_min': 'FLASH',
      '1_hour': '1HR',
      '1_day': '24HR',
      '3_days': '3 DAY',
      '1_week': '1 WEEK'
    };
    return labels[durationType] || durationType?.replace(/_/g, ' ')?.toUpperCase() || 'BATTLE';
  };

  const borderColor = isWinning
    ? 'rgba(34, 197, 94, 0.4)'
    : isLosing
      ? 'rgba(239, 68, 68, 0.4)'
      : 'rgba(250, 204, 21, 0.4)';

  const glowColor = isWinning
    ? 'rgba(34, 197, 94, 0.15)'
    : isLosing
      ? 'rgba(239, 68, 68, 0.15)'
      : 'rgba(250, 204, 21, 0.15)';

  return (
    <>
      <style>{`
        @keyframes active-battle-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px] active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, #020a18 0%, #0a1628 25%, #122240 50%, #0d1a30 75%, #050d1a 100%)',
          border: `2px solid ${borderColor}`,
        }}
        onClick={() => setShowModal(true)}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${glowColor} 0%, transparent 60%)`,
            animation: 'active-battle-glow 3s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 h-full flex items-center px-3 md:px-5">
          <div className="flex items-center justify-between w-full">

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-lg flex-shrink-0"
                style={{
                  borderColor: isWinning ? '#22c55e' : isLosing ? '#ef4444' : '#facc15',
                  boxShadow: isWinning ? '0 0 12px rgba(34,197,94,0.4)' : isLosing ? '0 0 12px rgba(239,68,68,0.4)' : '0 0 12px rgba(250,204,21,0.4)',
                  background: 'linear-gradient(135deg, #1e3a5f, #0d1a30)',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base md:text-lg">👤</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold block">You</span>
                <p className={`text-sm md:text-lg font-extrabold leading-tight ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                  ${myBalanceNum.toLocaleString()}
                </p>
                <p className="text-[9px] text-gray-500 leading-tight">
                  {piksRemaining > 0 ? `${piksRemaining} piks left` : `${myBetsCount} piks`}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center flex-shrink-0 px-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 mb-0.5">
                <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wide text-white whitespace-nowrap">
                  {getDurationLabel(matchup.durationType)}
                </span>
              </div>
              <span className="text-base md:text-xl">🏆</span>
              <p className="text-base md:text-xl font-black text-yellow-400 leading-tight drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                ${winnerPayout.toLocaleString()}
              </p>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold ${
                isWinning
                  ? 'bg-green-500/20 text-green-400'
                  : isLosing
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {isTied ? 'Tied' : isWinning ? 'Winning' : 'Behind'}
                <span className="text-white/60 ml-1">{formatTimer(timeRemaining)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold block truncate max-w-[70px] ml-auto">
                  {opponent.username || 'Opponent'}
                </span>
                <p className="text-sm md:text-lg font-extrabold text-red-400 leading-tight">
                  ${oppBalanceNum.toLocaleString()}
                </p>
                <p className="text-[9px] text-gray-500 leading-tight">
                  {opponentBets.length} piks
                </p>
              </div>
              {opponent.avatar ? (
                <img
                  src={opponent.avatar}
                  alt={opponent.username}
                  className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-red-400/50 shadow-lg shadow-red-500/20 flex-shrink-0"
                />
              ) : (
                <div
                  className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border-2 border-red-400/50 shadow-lg shadow-red-500/20 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5f1e1e, #301a0d)' }}
                >
                  <span className="text-base md:text-lg">👤</span>
                </div>
              )}
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
              <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Battle Details</h2>
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
