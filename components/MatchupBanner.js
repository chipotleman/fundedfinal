import { useState, useEffect } from 'react';

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
  onViewDetails 
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);

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
  const isWinning = myBalanceNum > oppBalanceNum;
  const isLosing = myBalanceNum < oppBalanceNum;
  const isTied = myBalanceNum === oppBalanceNum;

  const potSize = parseFloat(matchup.potSize || 0);
  const winnerPayout = parseFloat(matchup.winnerPayout || 0);

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-blue-400">VS</div>
          
          <div className="flex items-center gap-3">
            {opponent.avatar ? (
              <img 
                src={opponent.avatar} 
                alt={opponent.username}
                className="w-12 h-12 rounded-full border-2 border-blue-500"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
                {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
              </div>
            )}
            
            <div>
              <p className="text-white font-semibold">{opponent.username}</p>
              {opponent.winRate && (
                <p className="text-gray-400 text-xs">
                  {parseFloat(opponent.winRate).toFixed(0)}% win rate
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-center">
          <div>
            <p className="text-gray-400 text-xs uppercase mb-1">Your Balance</p>
            <p className={`text-xl font-bold ${isWinning ? 'text-green-500' : isLosing ? 'text-red-500' : 'text-white'}`}>
              ${myBalanceNum.toLocaleString()}
            </p>
          </div>
          
          <div className="text-gray-600">vs</div>
          
          <div>
            <p className="text-gray-400 text-xs uppercase mb-1">Opponent</p>
            <p className={`text-xl font-bold ${isLosing ? 'text-green-500' : isWinning ? 'text-red-500' : 'text-white'}`}>
              ${oppBalanceNum.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-gray-400 text-xs uppercase mb-1">Prize Pool</p>
            <p className="text-yellow-500 font-bold text-lg">
              ${winnerPayout.toLocaleString()}
            </p>
            <p className="text-gray-500 text-xs">Winner takes all</p>
          </div>

          <div className="text-center min-w-[100px]">
            <p className="text-gray-400 text-xs uppercase mb-1">Time Left</p>
            <p className={`text-xl font-bold ${timeRemaining && timeRemaining < 3600000 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {formatTimeRemaining(timeRemaining)}
            </p>
          </div>

          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm font-medium"
            >
              View Battle
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              isWinning ? 'bg-green-500' : isLosing ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <span className="text-gray-400">
              {isTied ? 'Tied' : isWinning ? 'You\'re winning!' : 'You\'re behind'}
            </span>
          </div>
          <span className="text-gray-500">
            Challenge: {matchup.challengeType?.charAt(0).toUpperCase() + matchup.challengeType?.slice(1)} (${parseFloat(matchup.startingBalance).toLocaleString()})
          </span>
        </div>
      </div>
    </div>
  );
}
