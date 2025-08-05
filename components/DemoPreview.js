import { useState } from 'react';
import Link from 'next/link';

export default function DemoPreview({ demoBetSlipCount, setDemoBetSlipCount, showDemoBetSlip, setShowDemoBetSlip }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState(100);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [betType, setBetType] = useState('single');

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
    const combinedDecimal = selectedBets.reduce((acc, bet) => {
      const decimal = bet.odds > 0 ? (bet.odds / 100 + 1) : (100 / Math.abs(bet.odds) + 1);
      return acc * decimal;
    }, 1);
    return Math.round((combinedDecimal - 1) * 100);
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
      {/* Demo Challenge Dashboard - Floating responsive */}
      {showDemoBetSlip && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:top-20 lg:right-8 lg:w-[480px]">
          {/* Mobile Overlay */}
          <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={() => setShowDemoBetSlip(false)}></div>

          {/* Challenge Dashboard Panel - Full height without scrolling */}
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] lg:relative bg-black border border-slate-700 rounded-t-2xl lg:rounded-2xl shadow-2xl lg:h-auto w-full lg:w-[480px] flex flex-col">
            <div className="flex-shrink-0 p-3 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                  </svg>
                  Challenge 1
                </h3>
                <button
                  onClick={() => setShowDemoBetSlip(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main Betting Area - Primary Focus */}
            <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
              {/* Bet Type Toggle - Prominent */}
              <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
                <h3 className="text-white font-bold mb-3 text-lg">Bet Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setBetType('single')}
                    className={`font-bold py-3 px-4 rounded-xl text-base transition-all duration-200 ${
                      betType === 'single' 
                        ? 'bg-green-500 text-white shadow-lg' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    Single Bets
                  </button>
                  <button 
                    onClick={() => setBetType('parlay')}
                    className={`font-bold py-3 px-4 rounded-xl text-base transition-all duration-200 ${
                      betType === 'parlay' 
                        ? 'bg-green-500 text-white shadow-lg' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    Parlay
                  </button>
                </div>
                {betType === 'parlay' && selectedBets.length > 1 && (
                  <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                    <p className="text-blue-400 font-bold text-center">
                      Parlay Odds: {calculateParlayOdds() > 0 ? '+' : ''}{calculateParlayOdds()}
                    </p>
                  </div>
                )}
              </div>

              {/* Active Bets - Main Focus */}
              {selectedBets.length > 0 ? (
                <div className="flex-1 space-y-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-bold text-xl">Your Bets ({selectedBets.length})</h4>
                    <button
                      onClick={clearAllBets}
                      className="text-red-400 hover:text-red-300 font-medium text-sm"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedBets.map((bet) => (
                      <div key={bet.id} className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                        {/* Bet Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="text-white font-bold text-lg mb-1">{bet.team}</div>
                            <div className="text-gray-300 font-medium">{bet.matchup}</div>
                            <div className="text-gray-400 text-sm">{bet.betType}</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg font-bold text-lg">
                              {bet.odds > 0 ? '+' : ''}{bet.odds}
                            </span>
                            <button
                              onClick={() => removeBet(bet.id)}
                              className="text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Stake Input */}
                        <div className="space-y-3">
                          <label className="text-gray-300 font-medium">Wager Amount</label>
                          <div className="relative">
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-lg">$</div>
                            <input
                              type="number"
                              placeholder="Enter amount"
                              value={betType === 'parlay' ? (selectedBets[0]?.stake || '') : (bet.stake || '')}
                              onChange={(e) => {
                                if (betType === 'parlay') {
                                  updateAllBetStakes(e.target.value);
                                } else {
                                  updateBetStake(bet.id, e.target.value);
                                }
                              }}
                              className="w-full bg-gradient-to-r from-slate-700 to-slate-600 text-white font-bold text-lg pl-12 pr-6 py-4 rounded-xl border border-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 focus:outline-none transition-all duration-200"
                              style={{ fontSize: '18px' }}
                            />
                          </div>
                          {((betType === 'single' && bet.stake > 0) || (betType === 'parlay' && selectedBets[0]?.stake > 0)) && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                              <div className="text-green-400 font-bold text-lg text-center">
                                {betType === 'parlay' 
                                  ? `Parlay Payout: $${(selectedBets[0].stake * (calculateParlayOdds() > 0 ? calculateParlayOdds()/100 + 1 : 100/Math.abs(calculateParlayOdds()) + 1)).toFixed(0)}`
                                  : `To Win: $${calculatePayout(bet.odds, bet.stake).toFixed(0)}`
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Bet Amounts */}
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <h3 className="text-white font-bold mb-3">Quick Amounts</h3>
                    <div className="grid grid-cols-5 gap-2">
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
                          className="bg-slate-800 hover:bg-green-500 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-xl font-bold text-white mb-2">No Bets Selected</h3>
                    <p className="text-gray-400">Click on odds below to add bets to your slip</p>
                  </div>
                </div>
              )}

              {/* Challenge Stats - Secondary Info */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">Balance</div>
                  <div className="text-lg font-bold text-green-400">${demoBalance.toLocaleString()}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">Challenge Progress</div>
                  <div className="text-lg font-bold text-blue-400">78%</div>
                </div>
              </div>
            </div>

            {/* Bottom Actions - Fixed */}
            <div className="flex-shrink-0 border-t border-slate-600 p-4 lg:p-6 space-y-3">
              {/* Place Bets Button */}
              {selectedBets.some(bet => bet.stake > 0) && (
                <button
                  onClick={() => {
                    alert('Demo bets placed successfully! This shows how your real challenge would work.');
                    setSelectedBets([]);
                    setShowDemoBetSlip(false);
                    setDemoBetSlipCount?.(0);
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Place Demo Bets
                </button>
              )}

              <button
                onClick={() => alert('This is just a demo! Sign up to start your real funded challenge.')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
              >
                Start Real Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3 sm:mb-4">Want a Demo?</h2>
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
  );
}