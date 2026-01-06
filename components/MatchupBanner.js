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

  const minPicks = 20;
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

  return (
    <div className={`${
      isDarkMode 
        ? 'bg-white/5 backdrop-blur-xl border-white/10' 
        : 'bg-white/80 backdrop-blur-xl border-gray-200'
    } border rounded-3xl mb-6 overflow-hidden`}>
      
      {/* Header - Battle Type - positioned at top edge */}
      <div className="flex justify-center -mt-0">
        <div className={`flex items-center gap-2 px-5 py-2 rounded-b-xl ${
          isDarkMode ? 'bg-white/10 backdrop-blur-md border-x border-b border-white/10' : 'bg-gray-100 border border-gray-200'
        }`}>
          <span className="text-lg">🎮</span>
          <span className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {challengeLabel} Battle
          </span>
        </div>
      </div>

      <div 
        className="p-3 pt-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Main content - 3 columns */}
        <div className="flex items-stretch gap-2">
          
          {/* Left side - User */}
          <div className={`flex flex-col items-center flex-1 py-3 px-2 rounded-xl ${
            isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-lg text-white shadow-lg shadow-green-500/30 mb-2 border-2 border-green-300/50">
              🐉
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Balance</span>
            <p className="text-xl font-extrabold text-green-400 mb-2">
              ${myBalanceNum.toLocaleString()}
            </p>
            <p className={`text-[9px] uppercase tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{piksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
            </p>
          </div>

          {/* Center - Prize Pool */}
          <div className="flex flex-col items-center justify-center flex-1 px-2 py-3">
            <span className="text-3xl mb-1">🏆</span>
            <span className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Prize Pool</span>
            <p className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-2">
              ${winnerPayout.toLocaleString()}
            </p>
            
            {/* Status pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs ${
              isWinning 
                ? 'bg-green-500 text-white shadow-green-500/30' 
                : isLosing 
                  ? 'bg-red-500 text-white shadow-red-500/30' 
                  : 'bg-yellow-500 text-black shadow-yellow-500/30'
            }`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-bold whitespace-nowrap">
                {isTied ? 'Tied!' : isWinning ? "You're winning!" : "You're behind"}
              </span>
            </div>
          </div>

          {/* Right side - Opponent */}
          <div className={`flex flex-col items-center flex-1 py-3 px-2 rounded-xl ${
            isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
          }`}>
            {opponent.avatar ? (
              <img 
                src={opponent.avatar} 
                alt={opponent.username}
                className="w-12 h-12 rounded-full border-2 border-red-300/50 shadow-lg shadow-red-500/30 mb-2"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-lg text-white shadow-lg shadow-red-500/30 mb-2 border-2 border-red-300/50">
                🦅
              </div>
            )}
            <span className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Opponent</span>
            <p className="text-xl font-extrabold text-red-400 mb-2">
              ${oppBalanceNum.toLocaleString()}
            </p>
            <p className={`text-[9px] uppercase tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Piks: <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{oppPiksRemaining}</span> · <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
            </p>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex justify-center mt-2">
          <span className={`transition-transform duration-200 text-xs ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            ▼
          </span>
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
