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

  const { isDarkMode } = useTheme();

  if (!matchup || !opponent) return null;

  const myBalanceNum = parseFloat(myBalance || 0);
  const oppBalanceNum = parseFloat(opponentBalance || 0);
  const isWinning = myBalanceNum > oppBalanceNum;
  const isLosing = myBalanceNum < oppBalanceNum;
  const isTied = myBalanceNum === oppBalanceNum;

  const potSize = parseFloat(matchup.potSize || 0);
  const winnerPayout = parseFloat(matchup.winnerPayout || 0);

  return (
    <div className={`${
      isDarkMode 
        ? 'bg-[#0a0a0a] border-gray-800/50' 
        : 'bg-white border-gray-300 shadow-lg'
    } border rounded-xl px-4 py-3 mb-3`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-lg font-bold text-blue-500">VS</div>
          
          {opponent.avatar ? (
            <img 
              src={opponent.avatar} 
              alt={opponent.username}
              className="w-8 h-8 rounded-full border-2 border-blue-500"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
              {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
            </div>
          )}
          
          <div>
            <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}</p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {opponent.winRate ? `${parseFloat(opponent.winRate).toFixed(0)}% win rate` : 'Opponent'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-center flex-shrink-0">
          <div>
            <p className={`text-[10px] uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>You</p>
            <p className={`text-base font-bold ${isWinning ? 'text-green-500' : isLosing ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${myBalanceNum.toLocaleString()}
            </p>
          </div>
          
          <div className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>vs</div>
          
          <div>
            <p className={`text-[10px] uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Opp</p>
            <p className={`text-base font-bold ${isLosing ? 'text-green-500' : isWinning ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${oppBalanceNum.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-center">
            <p className={`text-[10px] uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Prize</p>
            <p className="text-yellow-500 font-bold text-base">
              ${winnerPayout.toLocaleString()}
            </p>
          </div>

          <div className="text-center">
            <p className={`text-[10px] uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Time</p>
            <p className={`text-base font-bold ${timeRemaining && timeRemaining < 3600000 ? 'text-red-500 animate-pulse' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {formatTimeRemaining(timeRemaining)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              isWinning ? 'bg-green-500' : isLosing ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isTied ? 'Tied' : isWinning ? 'Winning' : 'Behind'}
            </span>
          </div>

          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-xs font-medium"
            >
              View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
