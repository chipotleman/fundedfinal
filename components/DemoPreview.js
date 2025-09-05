
import { useState } from 'react';
import Link from 'next/link';

export default function DemoPreview({ demoBetSlipCount, setDemoBetSlipCount, showDemoBetSlip, setShowDemoBetSlip }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState(100);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [betType, setBetType] = useState('single');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successBetData, setSuccessBetData] = useState(null);

  const mockGames = [
    {
      id: 1,
      sport: 'NFL',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      spread: -3.5,
      total: 47.5,
      moneylineHome: -180,
      moneylineAway: +150
    },
    {
      id: 2,
      sport: 'NBA',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Boston Celtics',
      spread: +2.5,
      total: 218.5,
      moneylineHome: +110,
      moneylineAway: -130
    },
    {
      id: 3,
      sport: 'NHL',
      homeTeam: 'Toronto Maple Leafs',
      awayTeam: 'Montreal Canadiens',
      spread: -1.5,
      total: 6.5,
      moneylineHome: -140,
      moneylineAway: +120
    }
  ];

  const isOpposingBet = (newBet, existingBets) => {
    return existingBets.some(bet => {
      if (bet.gameId !== newBet.gameId) return false;

      // Check for opposing spread bets
      if (bet.betType === 'spread' && newBet.betType === 'spread') {
        return true;
      }

      // Check for opposing moneyline bets
      if (bet.betType === 'moneyline' && newBet.betType === 'moneyline') {
        return true;
      }

      // Check for opposing total bets
      if (bet.betType === 'total' && newBet.betType === 'total') {
        return true;
      }

      return false;
    });
  };

  const placeDemoBet = (game, betType, odds, team, selectionKey) => {
    const newBet = {
      id: selectionKey,
      gameId: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      odds,
      team,
      selectionKey,
      stake: 0
    };

    setSelectedBets(prev => {
      // Check if this exact bet is already selected
      const existingIndex = prev.findIndex(bet => bet.selectionKey === selectionKey);

      if (existingIndex >= 0) {
        // Remove the bet (toggle off)
        const newBets = prev.filter(bet => bet.selectionKey !== selectionKey);
        if (newBets.length === 0) {
          setShowDemoBetSlip(false);
        }
        setDemoBetSlipCount?.(newBets.length);
        return newBets;
      }

      // Check for opposing bets
      if (isOpposingBet(newBet, prev)) {
        // Remove the opposing bet and add the new one
        const filteredBets = prev.filter(bet =>
          !(bet.gameId === newBet.gameId && bet.betType === newBet.betType)
        );
        const finalBets = [...filteredBets, newBet];
        setDemoBetSlipCount?.(finalBets.length);
        return finalBets;
      }

      // Add the new bet
      const finalBets = [...prev, newBet];
      setDemoBetSlipCount?.(finalBets.length);
      return finalBets;
    });
  };

  const isBetSelected = (selectionKey) => {
    return selectedBets.some(bet => bet.selectionKey === selectionKey);
  };

  const updateBetStake = (betId, stake) => {
    setSelectedBets(prev =>
      prev.map(bet =>
        bet.id === betId ? { ...bet, stake: parseFloat(stake) || 0 } : bet
      )
    );
  };

  const removeBet = (betId) => {
    setSelectedBets(prev => {
      const newBets = prev.filter(bet => bet.id !== betId);
      if (newBets.length === 0) {
        setShowDemoBetSlip(false);
      }
      setDemoBetSlipCount?.(newBets.length);
      return newBets;
    });
  };

  const totalStake = betType === 'parlay'
    ? (selectedBets.length > 0 ? (selectedBets[0].stake || 0) : 0)
    : selectedBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);

  const calculatePayout = (odds, stake) => {
    if (odds > 0) {
      return (stake * odds / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(odds))) + stake;
    }
  };

  const calculateParlayOdds = () => {
    if (selectedBets.length < 2) return 0;
    const decimal = selectedBets.reduce((acc, bet) => {
      const decimalOdds = bet.odds > 0 ? (bet.odds / 100 + 1) : (100 / Math.abs(bet.odds) + 1);
      return acc * decimalOdds;
    }, 1);
    return Math.round((decimal - 1) * 100);
  };

  const updateAllBetStakes = (stake) => {
    if (betType === 'parlay') {
      setSelectedBets(prev =>
        prev.map(bet => ({ ...bet, stake: parseFloat(stake) || 0 }))
      );
    }
  };

  const clearAllBets = () => {
    setSelectedBets([]);
    setShowDemoBetSlip(false);
    setDemoBetSlipCount?.(0);
  };

  return (
    <div className="bg-black py-4 relative" data-demo-section>
      {/* Demo Challenge Dashboard - Full page overlay like real bet slip */}
      {showDemoBetSlip && (
        <>
          {/* Desktop/Mobile Overlay */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowDemoBetSlip(false)}></div>

          {/* Demo Bet Slip Panel - Same style as real bet slip */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm lg:max-w-md lg:w-96 bg-slate-800 border-l border-slate-700 flex flex-col z-50 transform translate-x-0 transition-transform duration-300 ease-in-out">
            {/* Header */}
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Demo Bet Slip ({selectedBets.length})
                </h2>
                <button
                  onClick={() => setShowDemoBetSlip(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div></div>

            {/* Bets */}
            <div className="flex-1 overflow-y-auto"></div>
              <div className="p-4 space-y-4">
              {/* Bet Type Toggle - Only show when multiple bets selected */}
              {selectedBets.length > 1 && (
                <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                  <h3 className="text-white font-bold mb-2 text-sm">Bet Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBetType('single')}
                      className={`font-medium py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                        betType === 'single'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      Singles
                    </button>
                    <button
                      onClick={() => setBetType('parlay')}
                      className={`font-medium py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                        betType === 'parlay'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      Parlay
                    </button>
                  </div>
                  {betType === 'parlay' && (
                    <div className="mt-2 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 font-medium text-center text-sm">
                        Parlay Odds: {calculateParlayOdds() > 0 ? '+' : ''}{calculateParlayOdds()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Active Bets - Main Focus */}
              {selectedBets.length > 0 ? (
                <div className="flex-1 space-y-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-bold text-lg">Your Bets ({selectedBets.length})</h4>
                    <button
                      onClick={clearAllBets}
                      className="text-red-400 hover:text-red-300 font-medium text-sm"
                    >
                      Clear All
                    </button>
                  </div>

                  {betType === 'parlay' ? (
                    <div className="space-y-3">
                      {/* Parlay Bets List */}
                      <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                        <div className="text-white font-bold text-sm mb-3">Parlay ({selectedBets.length} bets)</div>
                        {selectedBets.map((bet, index) => (
                          <div key={bet.id} className="flex justify-between items-center py-2 border-b border-slate-600/30 last:border-b-0">
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-xs truncate">{bet.team}</div>
                              <div className="text-gray-400 text-xs truncate">{bet.matchup}</div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-bold">
                                {bet.odds > 0 ? '+' : ''}{bet.odds}
                              </span>
                              <button
                                onClick={() => removeBet(bet.id)}
                                className="text-gray-400 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Single Parlay Stake Input */}
                        <div className="mt-3 space-y-2">
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium text-sm">$</div>
                            <input
                              type="number"
                              placeholder="Parlay Amount"
                              value={selectedBets[0]?.stake || ''}
                              onChange={(e) => updateAllBetStakes(e.target.value)}
                              className="w-full bg-slate-700 text-white font-medium text-sm pl-8 pr-4 py-2 rounded-lg border border-slate-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                            />
                          </div>
                          {selectedBets[0]?.stake > 0 && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                              <div className="text-green-400 font-medium text-sm text-center">
                                Parlay Payout: ${(selectedBets[0].stake * (calculateParlayOdds() > 0 ? calculateParlayOdds()/100 + 1 : 100/Math.abs(calculateParlayOdds()) + 1)).toFixed(0)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedBets.map((bet) => (
                        <div key={bet.id} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                          {/* Compact Bet Header */}
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-bold text-sm truncate">{bet.team}</div>
                              <div className="text-gray-400 text-xs truncate">{bet.matchup}</div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-bold">
                                {bet.odds > 0 ? '+' : ''}{bet.odds}
                              </span>
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

                          {/* Compact Stake Input */}
                          <div className="space-y-2">
                            <div className="relative">
                              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium text-sm">$</div>
                              <input
                                type="number"
                                placeholder="Amount"
                                value={bet.stake || ''}
                                onChange={(e) => updateBetStake(bet.id, e.target.value)}
                                className="w-full bg-slate-700 text-white font-medium text-sm pl-8 pr-4 py-2 rounded-lg border border-slate-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                              />
                            </div>
                            {bet.stake > 0 && (
                              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                                <div className="text-green-400 font-medium text-sm text-center">
                                  To Win: ${calculatePayout(bet.odds, bet.stake).toFixed(0)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                
                  {/* Quick Bet Amounts */}
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <h3 className="text-white font-medium mb-2 text-sm">Quick Amounts</h3>
                    <div className="grid grid-cols-5 gap-1">
                      {[25, 50, 100, 250, 500].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => {
                            if (betType === 'parlay') {
                              updateAllBetStakes(amount);
                            } else {
                              selectedBets.forEach(bet => updateBetStake(bet.id, amount));
                            }
                          }}
                          className="bg-slate-800 hover:bg-green-500 text-white font-medium py-1.5 px-2 rounded text-xs transition-colors"
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 text-lg font-medium mb-2">Your demo bet slip is empty</p>
                  <p className="text-gray-500 text-sm">Click on odds to add demo bets</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedBets.length > 0 && (
              <div className="p-6 border-t border-slate-700 space-y-4">
                {/* Demo Balance Info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-300">
                    <span>Demo Balance:</span>
                    <span className="font-semibold text-green-400">${demoBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Total Stake:</span>
                    <span className="font-semibold">${totalStake.toFixed(2)}</span>
                  </div>
                  {betType === 'parlay' && selectedBets[0]?.stake > 0 ? (
                    <div className="flex justify-between text-green-400 font-bold text-lg border-t border-slate-600 pt-2">
                      <span>Potential Payout:</span>
                      <span>${(selectedBets[0].stake * (calculateParlayOdds() > 0 ? calculateParlayOdds()/100 + 1 : 100/Math.abs(calculateParlayOdds()) + 1)).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-green-400 font-bold text-lg border-t border-slate-600 pt-2">
                      <span>Potential Payout:</span>
                      <span>${selectedBets.reduce((sum, bet) => sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Place Demo Bet Button */}
                <button
                  onClick={() => {
                    if (selectedBets.some(bet => bet.stake > 0)) {
                      // Calculate total stake and potential payout
                      const totalStake = betType === 'parlay' 
                        ? (selectedBets[0]?.stake || 0)
                        : selectedBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);
                      
                      const totalPayout = betType === 'parlay' && selectedBets[0]?.stake > 0
                        ? selectedBets[0].stake * (calculateParlayOdds() > 0 ? calculateParlayOdds()/100 + 1 : 100/Math.abs(calculateParlayOdds()) + 1)
                        : selectedBets.reduce((sum, bet) => sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0);

                      setSuccessBetData({
                        bets: selectedBets.filter(bet => bet.stake > 0),
                        betType,
                        totalStake,
                        totalPayout,
                        balanceAfter: demoBalance - totalStake
                      });
                      setShowSuccessModal(true);
                    } else {
                      setSuccessBetData(null);
                      setShowSuccessModal(true);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 rounded-xl transition-all duration-300"
                >
                  Place Demo Bet{selectedBets.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Demo Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowSuccessModal(false)}></div>
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {successBetData ? 'Demo Bet Placed!' : 'Demo Mode'}
              </h3>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {successBetData ? (
              <div className="space-y-4">
                {/* Success Message */}
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="text-green-400 font-bold text-lg mb-2">✅ Bet Placed Successfully!</div>
                  <p className="text-green-300 text-sm">This shows how your real challenge would work</p>
                </div>

                {/* Bet Summary */}
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-3">Bet Summary</h4>
                  
                  {successBetData.betType === 'parlay' ? (
                    <div className="space-y-2">
                      <div className="text-blue-400 font-medium text-sm">Parlay ({successBetData.bets.length} bets)</div>
                      {successBetData.bets.map((bet, index) => (
                        <div key={bet.id} className="text-gray-300 text-sm">
                          • {bet.team} ({bet.odds > 0 ? '+' : ''}{bet.odds})
                        </div>
                      ))}
                      <div className="border-t border-slate-600 pt-2 mt-2">
                        <div className="text-white text-sm">Parlay Odds: {calculateParlayOdds() > 0 ? '+' : ''}{calculateParlayOdds()}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {successBetData.bets.map((bet) => (
                        <div key={bet.id} className="text-gray-300 text-sm">
                          • {bet.team} - ${bet.stake} ({bet.odds > 0 ? '+' : ''}{bet.odds})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                    <div className="text-gray-400 text-sm">Total Stake</div>
                    <div className="text-xl font-bold text-red-400">${successBetData.totalStake.toFixed(0)}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                    <div className="text-gray-400 text-sm">Potential Payout</div>
                    <div className="text-xl font-bold text-green-400">${successBetData.totalPayout.toFixed(0)}</div>
                  </div>
                </div>

                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Updated Balance</div>
                  <div className="text-2xl font-bold text-green-400">${successBetData.balanceAfter.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs mt-1">*Demo balance for illustration</div>
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSelectedBets([]);
                    setShowDemoBetSlip(false);
                    setDemoBetSlipCount?.(0);
                    setDemoBalance(successBetData.balanceAfter);
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Continue Demo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 text-center">
                  <div className="text-blue-400 font-bold text-lg mb-2">🎮 Demo Mode</div>
                  <p className="text-blue-300 text-sm">Add stake amounts to your bets to see how placing bets works!</p>
                </div>

                <div className="bg-slate-700/30 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-3">How to Use:</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div>1. Add stake amounts to your selected bets</div>
                    <div>2. Choose between single bets or parlay</div>
                    <div>3. Click "Place Demo Bet" to see the results</div>
                    <div>4. Sign up to start betting with real funded accounts!</div>
                  </div>
                </div>

                <Link href="/auth" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 text-center block">
                  Start Real Challenge
                </Link>

                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Continue Demo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowStatsModal(false)}></div>
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Challenge Details</h3>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">Starting Balance</div>
                <div className="text-2xl font-bold text-green-400">$10,000</div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">Current Balance</div>
                <div className="text-2xl font-bold text-green-400">${demoBalance.toLocaleString()}</div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">Total P&L</div>
                <div className="text-2xl font-bold text-green-400">+$0</div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">Target Goal</div>
                <div className="text-2xl font-bold text-blue-400">$12,800</div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-1">Progress</div>
                <div className="text-2xl font-bold text-blue-400">78%</div>
                <div className="w-full bg-slate-600 rounded-full h-3 mt-2">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-sm">Bets Placed</div>
                  <div className="text-xl font-bold text-white">12</div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-sm">Win Rate</div>
                  <div className="text-xl font-bold text-green-400">67%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-sm">Days Left</div>
                  <div className="text-xl font-bold text-orange-400">14</div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-sm">Max Loss</div>
                  <div className="text-xl font-bold text-red-400">$1,000</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStatsModal(false)}
              className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div id="demo-section" className="py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Want a <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Demo</span>?
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 mb-2">No sign up required</p>
            <p className="text-sm sm:text-base text-gray-500">Try placing bets with mock funds to see how our platform works</p>
          </div>

          {/* Demo Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Games List */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-slate-700 p-3 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                  <span className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></span>
                  Live Games
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {mockGames.map((game) => (
                    <div key={game.id} className="bg-slate-700/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div>
                          <div className="text-white font-semibold text-sm sm:text-base">{game.awayTeam} @ {game.homeTeam}</div>
                          <div className="text-gray-400 text-xs sm:text-sm">{game.sport} • Live</div>
                        </div>
                        <div className="text-green-400 font-bold text-xs sm:text-sm">DEMO</div>
                      </div>

                      {/* Betting Options - Dashboard Style Table */}
                      <div className="overflow-x-auto">
                        {/* Header Row */}
                        <div className="grid grid-cols-4 gap-1 sm:gap-4 px-2 sm:px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider border-b border-slate-600">
                          <div className="text-left">Team</div>
                          <div className="text-center">Spread</div>
                          <div className="text-center">Total</div>
                          <div className="text-center">Moneyline</div>
                        </div>

                        {/* Away Team Row */}
                        <div className="grid grid-cols-4 gap-1 sm:gap-4 px-2 sm:px-4 py-2 sm:py-3 border-b border-slate-600/50">
                          <div className="flex items-center">
                            <div className="text-white font-bold text-xs sm:text-sm truncate">{game.awayTeam}</div>
                          </div>
                          <button
                            onClick={() => placeDemoBet(game, 'spread', -110, `${game.awayTeam} ${game.spread > 0 ? -game.spread : Math.abs(game.spread)}`, `${game.id}-spread-away`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-spread-away`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-gray-300 text-xs">{game.spread > 0 ? -game.spread : Math.abs(game.spread)}</div>
                            <div className="text-green-400 text-xs font-medium">-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'total', -110, `Over ${game.total}`, `${game.id}-total-over`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-total-over`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-gray-300 text-xs">O {game.total}</div>
                            <div className="text-green-400 text-xs font-medium">-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'moneyline', game.moneylineAway, game.awayTeam, `${game.id}-moneyline-away`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-moneyline-away`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-green-400 text-xs font-medium">{game.moneylineAway > 0 ? '+' : ''}{game.moneylineAway}</div>
                          </button>
                        </div>

                        {/* Home Team Row */}
                        <div className="grid grid-cols-4 gap-1 sm:gap-4 px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-center">
                            <div className="text-white font-bold text-xs sm:text-sm truncate">{game.homeTeam}</div>
                          </div>
                          <button
                            onClick={() => placeDemoBet(game, 'spread', -110, `${game.homeTeam} ${game.spread > 0 ? '+' + game.spread : game.spread}`, `${game.id}-spread-home`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-spread-home`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-gray-300 text-xs">{game.spread > 0 ? '+' + game.spread : game.spread}</div>
                            <div className="text-green-400 text-xs font-medium">-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'total', -110, `Under ${game.total}`, `${game.id}-total-under`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-total-under`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-gray-300 text-xs">U {game.total}</div>
                            <div className="text-green-400 text-xs font-medium">-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'moneyline', game.moneylineHome, game.homeTeam, `${game.id}-moneyline-home`)}
                            className={`border rounded-lg py-2 px-2 sm:px-3 text-center ${
                              isBetSelected(`${game.id}-moneyline-home`)
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-gray-700 border-gray-600 text-white'
                            }`}
                          >
                            <div className="text-green-400 text-xs font-medium">{game.moneylineHome > 0 ? '+' : ''}{game.moneylineHome}</div>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Static Bet Slip */}
            <div className="lg:col-span-1">
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-slate-700 p-4 sm:p-6 sticky top-6">
                <h3 className="text-xl font-bold text-white mb-6">How to Use</h3>

                {/* Demo Balance */}
                <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
                  <div className="text-gray-400 text-sm">Demo Balance</div>
                  <div className="text-2xl font-bold text-green-400">${demoBalance.toLocaleString()}</div>
                </div>

                <div className="space-y-4 text-sm text-gray-300">
                  <div className="flex items-start space-x-3">
                    <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                    <p>Click on any odds to add bets to your slip</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                    <p>Selected bets will appear in a slip at the top</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                    <p>You can select multiple bets for parlays</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                    <p>Try it out with our mock games above!</p>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <Link href="/auth" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 text-center block">
                    Start Betting for Real
                  </Link>
                  <p className="text-center text-gray-400 text-sm mt-2">
                    Get funded up to $50K
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
