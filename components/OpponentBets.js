import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function OpponentBets({ 
  matchupId, 
  canSeeBets, 
  opponentBets = [],
  opponentName = 'Opponent',
  onRefresh 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isDarkMode } = useTheme();

  if (!canSeeBets) {
    return (
      <div className={`${
        isDarkMode 
          ? 'bg-[#0a0a0a] border-gray-800/50' 
          : 'bg-white border-gray-300 shadow-lg'
      } border rounded-xl p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentName}'s Bets</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Place a bet to see your opponent's picks</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingBets = opponentBets.filter(b => b.status === 'pending');
  const settledBets = opponentBets.filter(b => b.status !== 'pending');
  const totalStaked = opponentBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0);

  return (
    <div className={`${
      isDarkMode 
        ? 'bg-[#0a0a0a] border-gray-800/50' 
        : 'bg-white border-gray-300 shadow-lg'
    } border rounded-xl p-4 mb-4`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">👀</span>
          <div>
            <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentName}'s Bets</h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {opponentBets.length} pick{opponentBets.length !== 1 ? 's' : ''} • ${totalStaked.toLocaleString()} staked
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
              {pendingBets.length} pending
            </span>
            <span className={`px-2 py-1 rounded text-xs ${
              isDarkMode ? 'bg-[#1a1a1a] text-gray-300' : 'bg-gray-200 text-gray-700'
            }`}>
              {settledBets.length} settled
            </span>
          </div>
          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className={`mt-4 pt-4 border-t space-y-3 ${isDarkMode ? 'border-gray-800/50' : 'border-gray-200'}`}>
          {opponentBets.length === 0 ? (
            <p className={`text-center py-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No bets placed yet</p>
          ) : (
            opponentBets.map((bet, index) => (
              <div 
                key={bet.id || index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {bet.selection || bet.matchupName}
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span className="truncate min-w-0">{bet.matchupName}</span>
                    <span className="flex-shrink-0">• {bet.marketType}</span>
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
            ))
          )}
        </div>
      )}

      {isExpanded && onRefresh && (
        <div className="mt-3 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="text-blue-500 text-sm hover:text-blue-400 transition"
          >
            Refresh bets
          </button>
        </div>
      )}
    </div>
  );
}
