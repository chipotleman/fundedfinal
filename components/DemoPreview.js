
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import BetReceipt from './BetReceipt';
import LiveCommunityStats from './LiveCommunityStats';
import { categorizeGames } from '../lib/gamesUtils';

export default function DemoPreview({ demoBetSlipCount, setDemoBetSlipCount, showDemoBetSlip, setShowDemoBetSlip }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState(100);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [betType, setBetType] = useState('single');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('upcoming');

  // Fetch real games from API
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          setAllGames(data.games || []);
        }
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGames();
    const interval = setInterval(fetchGames, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const categorizedGames = useMemo(() => categorizeGames(allGames), [allGames]);

  useEffect(() => {
    const activeGames = selectedTab === 'live' 
      ? categorizedGames.liveGames 
      : categorizedGames.upcomingGames;
    
    const transformedGames = activeGames.slice(0, 6).map(game => ({
      id: game.id,
      sport: game.sportName,
      homeTeam: game.homeTeamFull || game.homeTeam,
      awayTeam: game.awayTeamFull || game.awayTeam,
      homeTeamShort: game.homeTeam,
      awayTeamShort: game.awayTeam,
      spread: parseFloat(game.lines?.spread?.home?.point) || 0,
      total: parseFloat(game.lines?.total?.over?.point?.replace('O ', '')) || 220,
      moneylineHome: game.lines?.moneyline?.home || -150,
      moneylineAway: game.lines?.moneyline?.away || +130,
      time: game.time
    }));
    setGames(transformedGames);
  }, [selectedTab, categorizedGames]);

  // Sync bet count with parent component
  useEffect(() => {
    setDemoBetSlipCount?.(selectedBets.length);
  }, [selectedBets.length, setDemoBetSlipCount]);

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
        return newBets;
      }

      // Check for opposing bets
      if (isOpposingBet(newBet, prev)) {
        // Remove the opposing bet and add the new one
        const filteredBets = prev.filter(bet =>
          !(bet.gameId === newBet.gameId && bet.betType === newBet.betType)
        );
        const finalBets = [...filteredBets, newBet];
        return finalBets;
      }

      // Add the new bet
      const finalBets = [...prev, newBet];
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
  };

  return (
    <div className="bg-black py-4 relative" data-demo-section>
      {/* Demo Challenge Dashboard - Floating responsive */}
      {showDemoBetSlip && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:top-4 lg:right-8 lg:bottom-4 lg:w-[480px]">
          {/* Mobile Overlay */}
          <div className="fixed inset-0 bg-black/80 lg:hidden" onClick={() => setShowDemoBetSlip(false)}></div>

          {/* Challenge Dashboard Panel - Full screen mobile, sticky desktop */}
          <div className="absolute inset-0 lg:relative bg-black border-0 lg:border border-gray-800/50 rounded-none lg:rounded-xl shadow-2xl lg:h-full w-full lg:w-[480px] flex flex-col">
            <div className="flex-shrink-0 p-4 lg:p-4 border-b border-gray-800/50">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center">
                  <img src="/pikslogotransparent.png" alt="Piks" className="h-10 mr-2" />
                  Demo Bet Slip
                </h3>
                <button
                  onClick={() => setShowDemoBetSlip(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main Betting Area - Primary Focus */}
            <div className="flex-1 flex flex-col p-3 lg:p-4 overflow-y-auto lg:overflow-y-auto relative">
              {/* Bet Type Toggle - Only show when multiple bets selected */}
              {selectedBets.length > 1 && (
                <div className="bg-[#111111] rounded-xl p-3 lg:p-4 mb-3 lg:mb-4 border border-gray-800/50">
                  <h3 className="text-white font-bold mb-2 lg:mb-3 text-base lg:text-lg">Bet Type</h3>
                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    <button
                      onClick={() => setBetType('single')}
                      className={`font-bold py-2.5 lg:py-3 px-3 lg:px-4 rounded-lg text-sm lg:text-base transition-all duration-200 ${
                        betType === 'single'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                      }`}
                    >
                      Single Bets
                    </button>
                    <button
                      onClick={() => setBetType('parlay')}
                      className={`font-bold py-2.5 lg:py-3 px-3 lg:px-4 rounded-lg text-sm lg:text-base transition-all duration-200 ${
                        betType === 'parlay'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                      }`}
                    >
                      Parlay
                    </button>
                  </div>
                  {betType === 'parlay' && (
                    <div className="mt-3 lg:mt-4 p-3 lg:p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-green-400 font-bold text-center text-sm lg:text-base">
                        Parlay Odds: {calculateParlayOdds() > 0 ? '+' : ''}{calculateParlayOdds()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Active Bets - Main Focus */}
              {selectedBets.length > 0 ? (
                <div className="flex-1 space-y-3 lg:space-y-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-bold text-lg lg:text-xl">Your Bets ({selectedBets.length})</h4>
                    <button
                      onClick={clearAllBets}
                      className="text-red-400 hover:text-red-300 font-medium text-sm"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-3 lg:space-y-4">
                    {selectedBets.map((bet) => (
                      <div key={bet.id} className="bg-[#111111] rounded-xl p-3 lg:p-4 border border-gray-800/50">
                        {/* Bet Header */}
                        <div className="flex justify-between items-start mb-3 lg:mb-4">
                          <div className="flex-1">
                            <div className="text-white font-bold text-base lg:text-lg mb-1">{bet.team}</div>
                            <div className="text-gray-300 font-medium text-sm lg:text-base">{bet.matchup}</div>
                            <div className="text-gray-400 text-xs lg:text-sm">{bet.betType}</div>
                          </div>
                          <div className="flex items-center space-x-2 lg:space-x-3">
                            <span className="bg-green-500/20 text-green-400 px-2 lg:px-3 py-1 lg:py-2 rounded-lg font-bold text-base lg:text-lg">
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
                        <div className="space-y-2 lg:space-y-3">
                          <label className="text-gray-300 font-medium text-sm lg:text-base">Wager Amount</label>
                          <div className="relative">
                            <div className="absolute left-3 lg:left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-base lg:text-lg">$</div>
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
                              className="w-full bg-[#1a1a1a] text-white font-bold text-base lg:text-lg pl-10 lg:pl-12 pr-4 lg:pr-6 py-3 lg:py-4 rounded-lg border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-200"
                            />
                          </div>
                          {((betType === 'single' && bet.stake > 0) || (betType === 'parlay' && selectedBets[0]?.stake > 0)) && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 lg:p-4">
                              <div className="text-green-400 font-bold text-base lg:text-lg text-center">
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
                  <div className="bg-[#111111] rounded-xl p-3 lg:p-4 border border-gray-800/50">
                    <h3 className="text-white font-bold mb-2 lg:mb-3 text-sm lg:text-base">Quick Amounts</h3>
                    <div className="grid grid-cols-5 gap-1.5 lg:gap-2">
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
                          className="bg-[#1a1a1a] hover:bg-green-600 text-white font-bold py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg transition-colors text-xs lg:text-sm"
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
              <div className="mt-4 lg:mt-6 space-y-3 lg:space-y-4">
                {!showDetailedStats ? (
                  <div className="grid grid-cols-2 gap-2 lg:gap-4">
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Balance</div>
                      <div className="text-base lg:text-lg font-bold text-green-400">${demoBalance.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Challenge Progress</div>
                      <div className="text-base lg:text-lg font-bold text-green-400">78%</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 lg:gap-4">
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Bets Placed</div>
                      <div className="text-base lg:text-lg font-bold text-white">12</div>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Win Rate</div>
                      <div className="text-base lg:text-lg font-bold text-green-400">67%</div>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Days Left</div>
                      <div className="text-base lg:text-lg font-bold text-orange-400">14</div>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-2 lg:p-3 border border-gray-800/50">
                      <div className="text-gray-500 text-xs">Max Loss</div>
                      <div className="text-base lg:text-lg font-bold text-red-400">$1,000</div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowDetailedStats(!showDetailedStats)}
                  className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white font-medium py-2 px-3 lg:px-4 rounded-lg transition-colors text-xs lg:text-sm border border-gray-800/50"
                >
                  {showDetailedStats ? 'VIEW LESS' : 'VIEW MORE'}
                </button>
              </div>
            </div>

            {/* Bottom Actions - Fixed */}
            <div className="flex-shrink-0 border-t border-gray-800/50 p-4 pb-6 lg:p-4 bg-[#0a0a0a]">
              <button
                onClick={() => {
                  if (selectedBets.some(bet => bet.stake > 0)) {
                    const betsWithStake = selectedBets.filter(bet => bet.stake > 0);
                    
                    // Save demo bets to localStorage
                    const demoBets = JSON.parse(localStorage.getItem('demo_bet_history') || '[]');
                    const newBets = betsWithStake.map(bet => ({
                        id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        matchup: bet.matchup,
                        selection: bet.team,
                        betType: bet.betType,
                        odds: bet.odds,
                        stake: bet.stake,
                        status: 'open',
                        placedAt: new Date().toISOString(),
                        profit: 0,
                        isDemo: true
                      }));
                    
                    localStorage.setItem('demo_bet_history', JSON.stringify([...demoBets, ...newBets]));
                    
                    // Show receipt for first bet (or combined for parlay)
                    if (betType === 'parlay') {
                      const parlayOdds = selectedBets.reduce((acc, bet) => {
                        const decimalOdds = bet.odds > 0 ? (bet.odds / 100 + 1) : (100 / Math.abs(bet.odds) + 1);
                        return acc * decimalOdds;
                      }, 1);
                      const americanOdds = Math.round((parlayOdds - 1) * 100);
                      
                      setCurrentReceipt({
                        matchup: `${selectedBets.length}-Leg Parlay`,
                        team: selectedBets.map(b => b.team).join(', '),
                        betType: 'parlay',
                        odds: americanOdds,
                        stake: selectedBets[0].stake
                      });
                    } else {
                      setCurrentReceipt(selectedBets.find(bet => bet.stake > 0));
                    }
                    
                    setShowReceipt(true);
                    setSelectedBets([]);
                    setShowDemoBetSlip(false);
                    setDemoBetSlipCount?.(0);
                  } else {
                    alert('Please enter a wager amount for your bet(s)');
                  }
                }}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 lg:py-3 px-4 rounded-lg transition-all duration-300 text-sm"
              >
                PLACE DEMO BET
              </button>
            </div>
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
          {/* Community Stats Header */}
          <div className="max-w-xl mx-auto mb-8 sm:mb-12">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                Community <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Stats</span>
              </h2>
              <p className="text-gray-400 text-sm">
                Real-time data from our community
              </p>
            </div>
            <div className="border border-gray-800/50 rounded-2xl">
              <LiveCommunityStats />
            </div>
          </div>

          {/* Demo Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Games List */}
            <div className="lg:col-span-2">
              <div className="bg-[#0a0a0a] backdrop-blur-lg rounded-xl sm:rounded-2xl border border-gray-800/50 p-3 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-3 ${selectedTab === 'live' ? 'bg-red-400 animate-pulse' : 'bg-green-400 animate-pulse'}`}></span>
                    {selectedTab === 'live' ? 'Live Games' : 'Upcoming Games'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTab('upcoming')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selectedTab === 'upcoming'
                          ? 'bg-green-600 text-white'
                          : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                      }`}
                    >
                      Upcoming {categorizedGames.upcomingGames.length > 0 && `(${categorizedGames.upcomingGames.length})`}
                    </button>
                    <button
                      onClick={() => setSelectedTab('live')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        selectedTab === 'live'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${categorizedGames.liveGames.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
                      Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {loading && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading games...</p>
                    </div>
                  )}
                  {!loading && games.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">
                        {selectedTab === 'live' 
                          ? 'No live games right now. Check the Upcoming tab!' 
                          : 'No upcoming games available. Check back soon!'}
                      </p>
                    </div>
                  )}
                  {games.map((game) => (
                    <div key={game.id} className="bg-[#111111] rounded-2xl border border-gray-800/50 overflow-hidden">
                      {/* Card Header */}
                      <div className="px-4 sm:px-5 py-3 sm:py-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-white font-bold text-base sm:text-lg truncate">{game.awayTeam} @ {game.homeTeam}</h3>
                          <div className="flex items-center space-x-2 bg-green-500/20 px-3 py-1 rounded-full">
                            <span className="text-green-400 text-xs font-semibold uppercase">Demo</span>
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs">{game.sport} • {game.time || (selectedTab === 'live' ? 'Live' : 'Upcoming')}</p>
                      </div>

                      {/* Betting Options */}
                      <div className="px-4 sm:px-5 pb-4">
                        {/* Header Row */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-2 text-xs text-gray-500 font-medium uppercase">
                          <div className="text-left"></div>
                          <div className="text-center">Spread</div>
                          <div className="text-center">Total</div>
                          <div className="text-center">ML</div>
                        </div>

                        {/* Away Team Row */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-2">
                          <div className="flex items-center">
                            <span className="text-white font-semibold text-sm truncate">{game.awayTeam}</span>
                          </div>
                          <button
                            onClick={() => placeDemoBet(game, 'spread', -110, `${game.awayTeam} ${game.spread > 0 ? -game.spread : '+' + Math.abs(game.spread)}`, `${game.id}-spread-away`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-spread-away`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-xs ${isBetSelected(`${game.id}-spread-away`) ? 'text-white' : 'text-gray-400'}`}>{game.spread > 0 ? -game.spread : '+' + Math.abs(game.spread)}</div>
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-spread-away`) ? 'text-white' : 'text-green-400'}`}>-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'total', -110, `Over ${game.total}`, `${game.id}-total-over`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-total-over`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-xs ${isBetSelected(`${game.id}-total-over`) ? 'text-white' : 'text-gray-400'}`}>O {game.total}</div>
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-total-over`) ? 'text-white' : 'text-green-400'}`}>-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'moneyline', game.moneylineAway, game.awayTeam, `${game.id}-moneyline-away`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-moneyline-away`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-moneyline-away`) ? 'text-white' : 'text-green-400'}`}>{game.moneylineAway > 0 ? '+' : ''}{game.moneylineAway}</div>
                          </button>
                        </div>

                        {/* Home Team Row */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3">
                          <div className="flex items-center">
                            <span className="text-white font-semibold text-sm truncate">{game.homeTeam}</span>
                          </div>
                          <button
                            onClick={() => placeDemoBet(game, 'spread', -110, `${game.homeTeam} ${game.spread > 0 ? '+' + game.spread : game.spread}`, `${game.id}-spread-home`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-spread-home`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-xs ${isBetSelected(`${game.id}-spread-home`) ? 'text-white' : 'text-gray-400'}`}>{game.spread > 0 ? '+' + game.spread : game.spread}</div>
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-spread-home`) ? 'text-white' : 'text-green-400'}`}>-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'total', -110, `Under ${game.total}`, `${game.id}-total-under`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-total-under`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-xs ${isBetSelected(`${game.id}-total-under`) ? 'text-white' : 'text-gray-400'}`}>U {game.total}</div>
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-total-under`) ? 'text-white' : 'text-green-400'}`}>-110</div>
                          </button>
                          <button
                            onClick={() => placeDemoBet(game, 'moneyline', game.moneylineHome, game.homeTeam, `${game.id}-moneyline-home`)}
                            className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                              isBetSelected(`${game.id}-moneyline-home`)
                                ? 'bg-green-600 shadow-lg shadow-green-500/20'
                                : 'bg-[#1a1a1a] hover:bg-[#252525]'
                            }`}
                          >
                            <div className={`text-sm font-bold ${isBetSelected(`${game.id}-moneyline-home`) ? 'text-white' : 'text-green-400'}`}>{game.moneylineHome > 0 ? '+' : ''}{game.moneylineHome}</div>
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
                    Get funded up to $100K
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bet Receipt Modal */}
      {showReceipt && currentReceipt && (
        <BetReceipt 
          bet={currentReceipt} 
          isDemo={true}
          onClose={() => {
            setShowReceipt(false);
            setCurrentReceipt(null);
          }}
        />
      )}
    </div>
  );
}
