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
        ? 'bg-[#0a0a0a] border-gray-800/50' 
        : 'bg-white border-gray-300 shadow-lg'
    } border rounded-xl mb-6 overflow-hidden`}>
      <div 
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-blue-500">VS</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-left">
            <p className={`text-xs uppercase tracking-wide mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your Balance</p>
            <p className={`text-2xl font-bold ${isWinning ? 'text-green-500' : isLosing ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${myBalanceNum.toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col items-center">
            {opponent.avatar ? (
              <img 
                src={opponent.avatar} 
                alt={opponent.username}
                className="w-14 h-14 rounded-full border-2 border-blue-500 mb-1"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white mb-1">
                {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
              </div>
            )}
            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}</p>
            {opponent.winRate && (
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {parseFloat(opponent.winRate).toFixed(0)}% win rate
              </p>
            )}
          </div>

          <div className="text-right">
            <p className={`text-xs uppercase tracking-wide mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Opponent</p>
            <p className={`text-2xl font-bold ${isLosing ? 'text-green-500' : isWinning ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${oppBalanceNum.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-left">
            <p className="text-xl font-bold text-yellow-500">${winnerPayout.toLocaleString()}</p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Winner takes all</p>
          </div>

          <div className="flex items-center gap-2 text-right">
            <p className={`text-xl font-bold ${timeRemaining && timeRemaining <= 0 ? 'text-red-500' : timeRemaining && timeRemaining < 3600000 ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {formatTimeRemaining(timeRemaining)}
            </p>
            <span className={`transition-transform duration-200 text-lg ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              &#x25BC;
            </span>
          </div>
        </div>

        <div className={`pt-3 border-t ${isDarkMode ? 'border-gray-800/50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isWinning ? (
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : isLosing ? (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500">
                  <span className="text-white text-xs font-bold">!</span>
                </span>
              ) : (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500">
                  <span className="text-black text-xs font-bold">=</span>
                </span>
              )}
              <span className={`font-medium ${isWinning ? 'text-green-500' : isLosing ? 'text-red-500' : 'text-yellow-500'}`}>
                {isTied ? 'Tied!' : isWinning ? 'You\'re winning!' : 'You\'re behind'}
              </span>
            </div>
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {challengeLabel} Battle
            </span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className={`border-t ${isDarkMode ? 'border-gray-800/50 bg-[#111111]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-[#0a0a0a] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
                <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Your Stats</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
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

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-[#0a0a0a] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
                <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}'s Stats</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
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

            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-[#0a0a0a] border border-gray-800/50' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{canSeeBets ? '👀' : '🔒'}</span>
                  <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}'s Bets</h4>
                </div>
                {canSeeBets && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
                      {pendingBets.length} pending
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      isDarkMode ? 'bg-[#1a1a1a] text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {settledBets.length} settled
                    </span>
                    {onRefreshOpponentBets && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefreshOpponentBets();
                        }}
                        className="text-blue-500 text-xs hover:text-blue-400 transition ml-2"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!canSeeBets ? (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Place a bet to unlock your opponent's picks
                </p>
              ) : opponentBets.length === 0 ? (
                <p className={`text-sm text-center py-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No bets placed yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {opponentBets.map((bet, index) => (
                    <div 
                      key={bet.id || index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-gray-100'
                      }`}
                    >
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {bet.selection || bet.matchupName}
                        </p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {bet.matchupName} {bet.marketType ? `• ${bet.marketType}` : ''}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          ${parseFloat(bet.stake || 0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>@ {bet.odds}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            bet.status === 'won' ? 'bg-green-500/20 text-green-500' :
                            bet.status === 'lost' ? 'bg-red-500/20 text-red-500' :
                            bet.status === 'push' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-yellow-500/20 text-yellow-500'
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
