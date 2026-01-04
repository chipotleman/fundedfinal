import { useState, useEffect } from 'react';

export default function OpponentBets({ 
  matchupId, 
  canSeeBets, 
  opponentBets = [],
  opponentName = 'Opponent',
  onRefresh 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!canSeeBets) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="text-white font-semibold">{opponentName}'s Bets</h3>
              <p className="text-gray-400 text-sm">Place a bet to see your opponent's picks</p>
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
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">👀</span>
          <div>
            <h3 className="text-white font-semibold">{opponentName}'s Bets</h3>
            <p className="text-gray-400 text-sm">
              {opponentBets.length} pick{opponentBets.length !== 1 ? 's' : ''} • ${totalStaked.toLocaleString()} staked
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
              {pendingBets.length} pending
            </span>
            <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
              {settledBets.length} settled
            </span>
          </div>
          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {opponentBets.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No bets placed yet</p>
          ) : (
            opponentBets.map((bet, index) => (
              <div 
                key={bet.id || index}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">
                    {bet.selection || bet.matchupName}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {bet.matchupName} • {bet.marketType}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-white font-semibold">
                    ${parseFloat(bet.stake || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">@ {bet.odds}</span>
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
            className="text-blue-400 text-sm hover:text-blue-300 transition"
          >
            Refresh bets
          </button>
        </div>
      )}
    </div>
  );
}
