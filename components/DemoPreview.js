
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
        setShowDemoBetSlip(true);
        setDemoBetSlipCount?.(finalBets.length);
        return finalBets;
      }
      
      // Add the new bet
      const finalBets = [...prev, newBet];
      setShowDemoBetSlip(true);
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
    <div className="bg-black py-16 relative">
      

      {/* Demo Bet Slip - Floating responsive */}
      {showDemoBetSlip && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:top-20 lg:right-4 lg:w-80 lg:max-h-96">
          {/* Mobile Overlay */}
          <div className="lg:hidden fixed inset-0 bg-black/50" onClick={() => setShowDemoBetSlip(false)}></div>
          
          {/* Bet Slip Panel */}
          <div className="lg:relative bg-slate-800 border border-slate-700 rounded-none lg:rounded-2xl shadow-2xl h-full lg:h-auto overflow-y-auto lg:max-h-96 w-full lg:w-80">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Demo Bet Slip ({selectedBets.length})
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

          <div className="p-4 space-y-3">
            {/* Bet Type Toggle */}
            {selectedBets.length > 1 && (
              <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                <h4 className="text-white font-semibold mb-3 text-sm">Bet Type</h4>
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
                {betType === 'parlay' && selectedBets.length > 1 && (
                  <div className="mt-3 p-3 bg-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-sm font-medium">
                      Parlay Odds: {calculateParlayOdds() > 0 ? '+' : ''}{calculateParlayOdds()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Individual Bets */}
            {selectedBets.map((bet) => (
              <div key={bet.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm mb-1">{bet.matchup}</div>
                    <div className="text-gray-300 text-sm">{bet.team}</div>
                    <div className="text-gray-400 text-xs">{bet.betType}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-semibold">
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

                {betType === 'single' && (
                  <div className="space-y-2">
                    <label className="text-gray-300 text-sm font-medium">Stake</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={bet.stake || ''}
                        onChange={(e) => updateBetStake(bet.id, e.target.value)}
                        className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-400 transition-colors text-sm"
                        placeholder="0.00"
                        min="0"
                        max={demoBalance}
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
                )}
              </div>
            ))}

            {/* Parlay Stake Input */}
            {betType === 'parlay' && selectedBets.length > 1 && (
              <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">Parlay Stake</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={selectedBets[0]?.stake || ''}
                      onChange={(e) => updateAllBetStakes(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-400 transition-colors text-sm"
                      placeholder="0.00"
                      min="0"
                      max={demoBalance}
                      step="0.01"
                    />
                  </div>
                  {selectedBets[0]?.stake > 0 && (
                    <div className="text-right">
                      <div className="text-green-400 text-sm font-semibold">
                        To Win: ${((selectedBets[0].stake * calculateParlayOdds() / 100)).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-600 pt-3">
              <div className="flex justify-between text-gray-300 text-sm mb-2">
                <span>Total Stake:</span>
                <span className="font-semibold">${totalStake.toFixed(2)}</span>
              </div>
              <div className="flex space-x-2 mb-3">
                <button
                  onClick={clearAllBets}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Clear All
                </button>
                <button
                  onClick={() => alert('This is just a demo! Sign up to place real bets.')}
                  className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
                >
                  Place Demo Bet
                </button>
              </div>
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
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-spread-away`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
                          }`}
                        >
                          <div className="text-gray-300 text-xs">{game.spread > 0 ? -game.spread : Math.abs(game.spread)}</div>
                          <div className="text-green-400 text-xs font-medium">-110</div>
                        </button>
                        <button
                          onClick={() => placeDemoBet(game, 'total', -110, `Over ${game.total}`, `${game.id}-total-over`)}
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-total-over`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
                          }`}
                        >
                          <div className="text-gray-300 text-xs">O {game.total}</div>
                          <div className="text-green-400 text-xs font-medium">-110</div>
                        </button>
                        <button
                          onClick={() => placeDemoBet(game, 'moneyline', game.moneylineAway, game.awayTeam, `${game.id}-moneyline-away`)}
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-moneyline-away`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
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
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-spread-home`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
                          }`}
                        >
                          <div className="text-gray-300 text-xs">{game.spread > 0 ? '+' + game.spread : game.spread}</div>
                          <div className="text-green-400 text-xs font-medium">-110</div>
                        </button>
                        <button
                          onClick={() => placeDemoBet(game, 'total', -110, `Under ${game.total}`, `${game.id}-total-under`)}
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-total-under`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
                          }`}
                        >
                          <div className="text-gray-300 text-xs">U {game.total}</div>
                          <div className="text-green-400 text-xs font-medium">-110</div>
                        </button>
                        <button
                          onClick={() => placeDemoBet(game, 'moneyline', game.moneylineHome, game.homeTeam, `${game.id}-moneyline-home`)}
                          className={`border rounded-lg py-2 px-2 sm:px-3 transition-all duration-200 text-center ${
                            isBetSelected(`${game.id}-moneyline-home`)
                              ? 'bg-green-600 border-green-500 shadow-lg scale-105' 
                              : 'bg-gray-700 border-gray-600 text-white hover:bg-green-600 hover:border-green-500'
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
