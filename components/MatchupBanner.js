import { useState, useEffect } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);
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
  const hasEnded = timeRemaining && timeRemaining <= 0;

  const winnerPayout = parseFloat(matchup.winnerPayout || 0);

  const myPnL = myBalanceNum - startingBalance;
  const oppPnL = oppBalanceNum - startingBalance;

  const pendingBets = opponentBets.filter(b => b.status === 'pending');
  const settledBets = opponentBets.filter(b => b.status !== 'pending');
  const oppTotalStaked = opponentBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0);

  const challengeLabel = matchup.challengeType?.charAt(0).toUpperCase() + matchup.challengeType?.slice(1);

  return (
    <div className={`${
      isDarkMode 
        ? 'bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0a] border-gray-700/50' 
        : 'bg-white border-gray-300 shadow-lg'
    } border rounded-2xl mb-6 overflow-hidden`}>
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between mb-2">
          {/* Left side - User */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-base font-bold text-white border-2 border-green-400 mb-1">
              Y
            </div>
            <span className="text-[10px] uppercase tracking-wide text-green-400 font-medium mb-0.5">Your Balance</span>
            <p className="text-2xl font-bold text-green-400">
              ${myBalanceNum.toLocaleString()}
            </p>
          </div>

          {/* Center - VS, Opponent Avatar, Prize */}
          <div className="flex flex-col items-center flex-shrink-0 px-2">
            <span className="text-2xl font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] mb-1">VS</span>
            <div className="relative">
              {opponent.avatar ? (
                <img 
                  src={opponent.avatar} 
                  alt={opponent.username}
                  className="w-10 h-10 rounded-full border-2 border-blue-400"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-base font-bold text-white border-2 border-blue-400">
                  {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
                </div>
              )}
            </div>
            <p className={`font-semibold text-xs mt-0.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
              {opponent.winRate ? `${parseFloat(opponent.winRate).toFixed(0)}% win rate` : 'New player'}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-base">🏆</span>
              <p className="text-lg font-bold text-yellow-400">${winnerPayout.toLocaleString()}</p>
            </div>
          </div>

          {/* Right side - Opponent */}
          <div className="flex flex-col items-center flex-1">
            <div className="relative">
              {opponent.avatar ? (
                <img 
                  src={opponent.avatar} 
                  alt={opponent.username}
                  className="w-10 h-10 rounded-full border-2 border-red-400 mb-1"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-base font-bold text-white border-2 border-red-400 mb-1">
                  {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
                </div>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wide text-red-400 font-medium mb-0.5">Opponent</span>
            <p className="text-2xl font-bold text-red-400">
              ${oppBalanceNum.toLocaleString()}
            </p>
          </div>
        </div>

        <div className={`pt-3 border-t flex items-center justify-between ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
            isWinning 
              ? 'bg-green-500/20 border border-green-500/50' 
              : isLosing 
                ? 'bg-red-500/20 border border-red-500/50' 
                : 'bg-yellow-500/20 border border-yellow-500/50'
          }`}>
            <svg className={`w-4 h-4 ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className={`text-xs font-medium ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
              {isTied ? 'Tied!' : isWinning ? "You're winning!" : "You're behind"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-base">🎮</span>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {challengeLabel} Battle
            </span>
            <span className={`transition-transform duration-200 text-xs ml-1 ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className={`border-t ${isDarkMode ? 'border-gray-700/50 bg-[#0a0a0a]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
                <h4 className={`font-semibold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Your Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Balance</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${myBalanceNum.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>P&L</p>
                    <p className={`font-bold ${myPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {myPnL >= 0 ? '+' : ''}${myPnL.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Total Bets</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myBetsCount}</p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Record</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myWins}W - {myLosses}L</p>
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
                <h4 className={`font-semibold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}'s Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Balance</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${oppBalanceNum.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>P&L</p>
                    <p className={`font-bold ${oppPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {oppPnL >= 0 ? '+' : ''}${oppPnL.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Total Bets</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentBets.length}</p>
                  </div>
                  <div>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Staked</p>
                    <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${oppTotalStaked.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{canSeeBets ? '👀' : '🔒'}</span>
                  <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}'s Bets</h4>
                </div>
                {canSeeBets && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-[10px]">
                      {pendingBets.length} pending
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                      {settledBets.length} settled
                    </span>
                    {onRefreshOpponentBets && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefreshOpponentBets();
                        }}
                        className="text-blue-400 text-[10px] hover:text-blue-300 transition"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!canSeeBets ? (
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Place a bet to unlock your opponent's picks
                </p>
              ) : opponentBets.length === 0 ? (
                <p className={`text-xs text-center py-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No bets placed yet
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {opponentBets.map((bet, index) => (
                    <div 
                      key={bet.id || index}
                      className={`flex items-center justify-between p-2 rounded-lg ${isDarkMode ? 'bg-[#0a0a0a] border border-gray-800/50' : 'bg-gray-100'}`}
                    >
                      <div className="flex-1">
                        <p className={`font-medium text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {bet.selection || bet.matchupName}
                        </p>
                        <p className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {bet.matchupName} {bet.marketType ? `• ${bet.marketType}` : ''}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-semibold text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          ${parseFloat(bet.stake || 0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>@ {bet.odds}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            bet.status === 'won' ? 'bg-green-500/20 text-green-400' :
                            bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                            bet.status === 'push' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {bet.status === 'pending' ? 'Pending' :
                             bet.status === 'won' ? `+$${parseFloat(bet.pnl || 0).toLocaleString()}` :
                             bet.status === 'lost' ? `-$${parseFloat(bet.stake || 0).toLocaleString()}` :
                             'Push'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
