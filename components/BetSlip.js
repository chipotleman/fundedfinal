import { useState } from 'react';

export default function BetSlip({ bets, setBets, bankroll, onClose, onCashOut }) {
  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');

  const updateStake = (betId, stake) => {
    setBets(bets.map(bet => 
      bet.id === betId ? { ...bet, stake: parseFloat(stake) || 0 } : bet
    ));
  };

  const removeBet = (betId) => {
    setBets(bets.filter(bet => bet.id !== betId));
  };

  const calculatePayout = (odds, stake) => {
    if (odds > 0) {
      return (stake * odds / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(odds))) + stake;
    }
  };

  const totalStake = bets.reduce((sum, bet) => sum + (bet.stake || 0), 0);
  const totalPayout = bets.reduce((sum, bet) => 
    sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0
  );
  const potentialProfit = totalPayout - totalStake;

  const placeBets = async () => {
    if (totalStake === 0 || totalStake > bankroll) return;

    setIsPlacing(true);

    // Simulate bet placement
    setTimeout(() => {
      alert(`${bets.length} bet(s) placed successfully!`);
      setBets([]);
      setIsPlacing(false);
      onClose();
    }, 1500);
  };

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const addBet = (bet) => {
    setBets(prev => {
      const existing = prev.find(b => b.id === bet.id);
      if (existing) {
        return prev.filter(b => b.id !== bet.id);
      }

      // Check if there's already a bet for the same game
      const sameGameBet = prev.find(b => b.game_id === bet.game_id);
      if (sameGameBet) {
        // Remove the existing bet for this game and add the new one
        return prev.filter(b => b.game_id !== bet.game_id).concat(bet);
      }

      return [...prev, bet];
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose}></div>

      {/* Bet Slip Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm lg:max-w-md lg:w-96 bg-slate-800 border-l border-slate-700 flex flex-col z-50 lg:relative lg:border-l">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Bet Slip ({bets.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bets */}
      <div className="flex-1 overflow-y-auto">
        {bets.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-lg font-medium mb-2">Your bet slip is empty</p>
            <p className="text-gray-500 text-sm">Click on odds to add bets</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {bets.map((bet) => (
              <div key={bet.id} className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                {/* Bet Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm mb-1">{bet.matchup}</div>
                    <div className="text-gray-300 text-sm">{bet.selection}</div>
                    <div className="text-gray-400 text-xs">{bet.betType}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-semibold">
                      {formatOdds(bet.odds)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onCashOut && onCashOut(bet)}
                        className="text-yellow-400 hover:text-yellow-300 transition-colors text-xs bg-yellow-500/20 px-2 py-1 rounded"
                      >
                        Cash Out
                      </button>
                      <button
                        onClick={() => removeBet(bet.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stake Input */}
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">Stake</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={bet.stake || ''}
                      onChange={(e) => updateStake(bet.id, e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-400 transition-colors"
                      placeholder="0.00"
                      min="0"
                      max={bankroll}
                      step="0.01"
                    />
                  </div>
                  {bet.stake > 0 && (
                    <div className="text-right">
                      <div className="text-green-400 text-sm font-semibold">
                        To Win: ${(calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Bet Type Toggle */}
            <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
              <h3 className="text-white font-semibold mb-3">Bet Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setBetType('single')}
                  className={`font-semibold py-2 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'single' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  Singles
                </button>
                <button 
                  onClick={() => setBetType('parlay')}
                  className={`font-semibold py-2 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'parlay' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  Parlay
                </button>
              </div>
              {betType === 'parlay' && bets.length > 1 && (
                <div className="mt-3 p-3 bg-blue-500/20 rounded-lg">
                  <p className="text-blue-400 text-sm font-medium">
                    Parlay Odds: {((bets.reduce((acc, bet) => acc * (bet.odds > 0 ? (bet.odds/100 + 1) : (100/Math.abs(bet.odds) + 1)), 1) - 1) * 100).toFixed(0) > 0 ? '+' : ''}{((bets.reduce((acc, bet) => acc * (bet.odds > 0 ? (bet.odds/100 + 1) : (100/Math.abs(bet.odds) + 1)), 1) - 1) * 100).toFixed(0)}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Bet Amounts */}
            <div className="bg-slate-700/50 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3">Quick Amounts</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (bets.length >= 1) {
                        if (betType === 'parlay') {
                          // For parlay, set the same amount on all bets
                          bets.forEach(bet => updateStake(bet.id, amount));
                        } else {
                          // For singles, set amount on the first bet or all if only one
                          if (bets.length === 1) {
                            updateStake(bets[0].id, amount);
                          } else {
                            // Set on first bet if multiple singles
                            updateStake(bets[0].id, amount);
                          }
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-slate-800 hover:bg-green-500 disabled:bg-slate-800/50 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (bets.length >= 1) {
                        if (betType === 'parlay') {
                          // For parlay, set the same amount on all bets
                          bets.forEach(bet => updateStake(bet.id, amount));
                        } else {
                          // For singles, set amount on the first bet or all if only one
                          if (bets.length === 1) {
                            updateStake(bets[0].id, amount);
                          } else {
                            // Set on first bet if multiple singles
                            updateStake(bets[0].id, amount);
                          }
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-slate-800 hover:bg-green-500 disabled:bg-slate-800/50 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {bets.length > 0 && (
        <div className="p-6 border-t border-slate-700 space-y-4">
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Total Stake:</span>
              <span className="font-semibold">${totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Potential Payout:</span>
              <span className="font-semibold">${totalPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-400 font-bold text-lg border-t border-slate-600 pt-2">
              <span>Potential Profit:</span>
              <span>${potentialProfit.toFixed(2)}</span>
            </div>
          </div>

          {/* Balance Check */}
          {totalStake > bankroll && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-medium">
                Insufficient balance. Available: ${bankroll.toFixed(2)}
              </p>
            </div>
          )}

          {/* Place Bet Button */}
          <button
            onClick={placeBets}
            disabled={totalStake === 0 || totalStake > bankroll || isPlacing}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isPlacing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Placing Bets...</span>
              </div>
            ) : (
              `Place ${bets.length} Bet${bets.length > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
      </div>
    </>
  );
}