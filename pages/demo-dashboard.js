import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';
import BetReceipt from '../components/BetReceipt';
import CoinRain from '../components/CoinRain';
import { simulateOddsMovement, updateBetSlipWithNewOdds } from '../lib/oddsSimulator';

const mockGames = {
  'NFL': [
    {
      id: 1,
      awayTeam: 'LA Chargers',
      homeTeam: 'Detroit Lions',
      time: '1:00 PM ET',
      lines: {
        spread: {
          away: { point: '+10.5', odds: -115 },
          home: { point: '-10.5', odds: -115 }
        },
        total: {
          over: { point: 'O 37.5', odds: -115 },
          under: { point: 'U 37.5', odds: -115 }
        },
        moneyline: { away: +520, home: -850 }
      }
    }
  ],
  'NBA': [
    {
      id: 2,
      awayTeam: 'Lakers',
      homeTeam: 'Warriors',
      time: '10:00 PM ET',
      lines: {
        spread: {
          away: { point: '+3.5', odds: -110 },
          home: { point: '-3.5', odds: -110 }
        },
        total: {
          over: { point: 'O 225.5', odds: -110 },
          under: { point: 'U 225.5', odds: -110 }
        },
        moneyline: { away: +140, home: -160 }
      }
    }
  ],
  'MLB': [
    {
      id: 3,
      awayTeam: 'Yankees',
      homeTeam: 'Red Sox',
      time: '7:30 PM ET',
      lines: {
        spread: {
          away: { point: '+1.5', odds: -140 },
          home: { point: '-1.5', odds: +120 }
        },
        total: {
          over: { point: 'O 9.5', odds: -105 },
          under: { point: 'U 9.5', odds: -115 }
        },
        moneyline: { away: +130, home: -150 }
      }
    }
  ],
  'NHL': [
    {
      id: 4,
      awayTeam: 'Rangers',
      homeTeam: 'Bruins',
      time: '8:00 PM ET',
      lines: {
        spread: {
          away: { point: '+1.5', odds: -180 },
          home: { point: '-1.5', odds: +150 }
        },
        total: {
          over: { point: 'O 6.5', odds: +110 },
          under: { point: 'U 6.5', odds: -130 }
        },
        moneyline: { away: +120, home: -140 }
      }
    }
  ],
  'Soccer': [
    {
      id: 6,
      awayTeam: 'Manchester United',
      homeTeam: 'Liverpool',
      time: '12:30 PM ET',
      lines: {
        spread: {
          away: { point: '+0.5', odds: -110 },
          home: { point: '-0.5', odds: -110 }
        },
        total: {
          over: { point: 'O 2.5', odds: -120 },
          under: { point: 'U 2.5', odds: +100 }
        },
        moneyline: { away: +250, home: -150 }
      }
    }
  ]
};

export default function DemoDashboard() {
  const router = useRouter();
  const [demoChallenge, setDemoChallenge] = useState(null);
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBetSlip, setShowBetSlip] = useState(false);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [showCoinRain, setShowCoinRain] = useState(false);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer'];

  // Load demo challenge and state from localStorage
  useEffect(() => {
    const savedChallenge = localStorage.getItem('demo_challenge');
    const savedState = localStorage.getItem('demo_state');
    
    if (!savedChallenge) {
      router.push('/demo');
      return;
    }

    const challenge = JSON.parse(savedChallenge);
    setDemoChallenge(challenge);
    setBankroll(challenge.startingBalance);

    if (savedState) {
      const state = JSON.parse(savedState);
      setBankroll(state.bankroll || challenge.startingBalance);
      setPnl(state.pnl || 0);
      setTotalBets(state.totalBets || 0);
      setWins(state.wins || 0);
      setLosses(state.losses || 0);
    }
  }, [router]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (demoChallenge) {
      const state = { bankroll, pnl, totalBets, wins, losses };
      localStorage.setItem('demo_state', JSON.stringify(state));
    }
  }, [bankroll, pnl, totalBets, wins, losses, demoChallenge]);

  const baseGamesRef = useRef({});

  useEffect(() => {
    if (selectedSport === 'All Sports') {
      const allGames = Object.values(mockGames).flat();
      baseGamesRef.current = { 'All Sports': allGames };
      setGames(allGames);
    } else {
      baseGamesRef.current = { [selectedSport]: mockGames[selectedSport] || [] };
      setGames(mockGames[selectedSport] || []);
    }
  }, [selectedSport]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGames(prevGames => {
        const updatedGames = simulateOddsMovement(prevGames);
        return updatedGames;
      });

      if (selectedBets.length > 0) {
        setSelectedBets(prevBets => {
          return prevBets.map(bet => {
            const game = games.find(g => g.id === bet.gameId);
            if (!game) return bet;

            let newOdds = bet.odds;
            let newPoint = bet.point;
            let oddsMoved = null;

            if (bet.betType === 'spread') {
              const isAway = bet.selection.includes(game.awayTeam);
              const lineData = isAway ? game.lines.spread.away : game.lines.spread.home;
              if (lineData.odds !== bet.odds) {
                newOdds = lineData.odds;
                oddsMoved = lineData.oddsMoved;
              }
              if (lineData.point !== bet.point) {
                newPoint = lineData.point;
              }
            } else if (bet.betType === 'total') {
              const isOver = bet.selection.toLowerCase().includes('over');
              const lineData = isOver ? game.lines.total.over : game.lines.total.under;
              if (lineData.odds !== bet.odds) {
                newOdds = lineData.odds;
                oddsMoved = lineData.oddsMoved;
              }
            } else if (bet.betType === 'moneyline') {
              const isAway = bet.selection === game.awayTeam;
              const ml = isAway ? game.lines.moneyline.away : game.lines.moneyline.home;
              if (ml !== bet.odds) {
                newOdds = ml;
                oddsMoved = isAway ? game.lines.moneyline.awayMoved : game.lines.moneyline.homeMoved;
              }
            }

            return {
              ...bet,
              odds: newOdds,
              point: newPoint,
              oddsMoved,
              oddsChanged: newOdds !== bet.odds
            };
          });
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [games, selectedBets.length]);

  // Lock body scroll when bet slip is open
  useEffect(() => {
    if (showBetSlip) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [showBetSlip]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const OddsDisplay = ({ odds, moved, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    const moveClass = moved === 'up' ? 'animate-pulse text-green-400' : moved === 'down' ? 'animate-pulse text-red-400' : '';
    
    return (
      <div className={`text-xs font-medium flex items-center justify-center gap-1 ${moveClass || baseClass}`}>
        {moved === 'up' && <span className="text-[10px]">▲</span>}
        {moved === 'down' && <span className="text-[10px]">▼</span>}
        {formatOdds(odds)}
      </div>
    );
  };

  const getSportIcon = (sport) => {
    const icons = { 'NFL': '🏈', 'NBA': '🏀', 'MLB': '⚾', 'NHL': '🏒', 'Soccer': '⚽' };
    return icons[sport] || '🏆';
  };

  const handleSportClick = (sport) => {
    setSelectedSport(selectedSport === sport ? 'All Sports' : sport);
  };

  const addToBetSlip = (game, betType, odds, team) => {
    const betKey = `${game.id}-${betType}-${team}`;
    const existingIndex = selectedBets.findIndex(bet => bet.key === betKey);

    if (existingIndex >= 0) {
      setSelectedBets(prev => prev.filter(bet => bet.key !== betKey));
    } else {
      const newBet = {
        key: betKey,
        gameId: game.id,
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        betType,
        odds: typeof odds === 'object' ? odds.odds : odds,
        selection: team,
        stake: 100
      };
      setSelectedBets(prev => [...prev, newBet]);
      setShowBetSlip(true);
    }
  };

  const isBetInSlip = (game, betType, team) => {
    const betKey = `${game.id}-${betType}-${team}`;
    return selectedBets.some(bet => bet.key === betKey);
  };

  const updateStake = (betKey, newStake) => {
    setSelectedBets(prev =>
      prev.map(bet => bet.key === betKey ? { ...bet, stake: parseFloat(newStake) || 0 } : bet)
    );
  };

  const removeBet = (betKey) => {
    setSelectedBets(prev => prev.filter(bet => bet.key !== betKey));
  };

  const calculatePayout = (stake, odds) => {
    if (odds > 0) {
      return stake * (odds / 100);
    } else {
      return stake / (Math.abs(odds) / 100);
    }
  };

  const getTotalStake = () => {
    return selectedBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);
  };

  const getTotalPotentialWin = () => {
    return selectedBets.reduce((sum, bet) => sum + calculatePayout(bet.stake || 0, bet.odds), 0);
  };

  const placeBets = () => {
    const totalStake = getTotalStake();
    
    if (totalStake > bankroll) {
      alert('Insufficient funds! Reduce your bet amounts.');
      return;
    }

    if (totalStake === 0) {
      alert('Please enter stake amounts for your bets.');
      return;
    }

    // Save demo bets to localStorage history
    const demoBets = JSON.parse(localStorage.getItem('demo_bet_history') || '[]');
    const newBets = selectedBets.map(bet => ({
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matchup: bet.matchup,
      selection: bet.selection || bet.team,
      betType: bet.betType,
      odds: bet.odds,
      stake: bet.stake,
      status: 'open',
      placedAt: new Date().toISOString(),
      profit: 0,
      isDemo: true
    }));
    localStorage.setItem('demo_bet_history', JSON.stringify([...demoBets, ...newBets]));

    // Show receipt for first bet
    if (selectedBets.length > 0 && selectedBets[0].stake > 0) {
      setCurrentReceipt(selectedBets[0]);
      setShowReceipt(true);
    }

    // Trigger coin rain animation
    setShowCoinRain(true);

    // Simulate bet outcome (50/50 random)
    const won = Math.random() > 0.5;
    const potentialWin = getTotalPotentialWin();

    setTimeout(() => {
      if (won) {
        setBankroll(prev => prev + potentialWin);
        setPnl(prev => prev + potentialWin);
        setWins(prev => prev + 1);
      } else {
        setBankroll(prev => prev - totalStake);
        setPnl(prev => prev - totalStake);
        setLosses(prev => prev + 1);
      }

      setTotalBets(prev => prev + selectedBets.length);
      setSelectedBets([]);
      setShowBetSlip(false);
    }, 500);
  };

  const resetDemo = () => {
    if (confirm('Reset your demo challenge? All progress will be lost.')) {
      localStorage.removeItem('demo_state');
      router.push('/demo');
    }
  };

  if (!demoChallenge) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }

  const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : 0;
  const progress = demoChallenge.target > 0 ? Math.min((pnl / demoChallenge.target) * 100, 100) : 0;

  return (
    <>
      <CoinRain trigger={showCoinRain} onComplete={() => setShowCoinRain(false)} />
      
      {/* Bet Slip - Full screen on mobile, side panel on desktop */}
      {showBetSlip && (
        <>
          <div 
            className="fixed inset-0 bg-black z-[98] hidden md:block"
            onClick={() => setShowBetSlip(false)}
          />
          
          <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] bg-black z-[99] flex flex-col">
            {/* Header with Piks branding */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center">
                <img src="/funderlogo/Piks.png" alt="Piks" className="h-14 object-contain -ml-4" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/50 px-2.5 py-1 rounded-full">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span className="text-orange-400 text-xs font-bold">DEMO</span>
                </div>
                <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/50 px-2.5 py-1 rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-400 text-xs font-bold">{selectedBets.length} PICK{selectedBets.length !== 1 ? 'S' : ''}</span>
                </div>
                <button onClick={() => setShowBetSlip(false)} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedBets.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 font-medium text-lg mb-2">Your bet slip is empty</p>
                  <p className="text-gray-600">Click on odds to add picks</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {selectedBets.map(bet => (
                    <div key={bet.key} className="bg-black rounded-lg border border-blue-500/50 overflow-hidden">
                      {/* Ticket Header */}
                      <div className="bg-slate-900/80 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                          <span className="text-blue-400 text-xs font-bold uppercase">{bet.betType || 'Spread'}</span>
                        </div>
                        <button onClick={() => removeBet(bet.key)} className="text-gray-500 hover:text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Selection & Odds */}
                      <div className="px-4 py-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="text-white font-bold text-base">{bet.selection}</div>
                            <div className="text-gray-400 text-xs uppercase mt-0.5">{bet.betType}</div>
                          </div>
                          <div className={`font-bold text-xl flex items-center gap-1 ${
                            bet.oddsMoved === 'up' ? 'text-green-400 animate-pulse' : 
                            bet.oddsMoved === 'down' ? 'text-red-400 animate-pulse' : 'text-blue-400'
                          }`}>
                            {bet.oddsMoved === 'up' && <span className="text-sm">▲</span>}
                            {bet.oddsMoved === 'down' && <span className="text-sm">▼</span>}
                            {formatOdds(bet.odds)}
                          </div>
                        </div>
                        
                        {/* Odds Change Alert */}
                        {bet.oddsChanged && (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-2">
                            <p className="text-yellow-400 text-xs font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Odds have changed
                            </p>
                          </div>
                        )}
                        
                        {/* Live Game Info */}
                        <div className="bg-slate-800/50 rounded-lg p-3 mt-2">
                          <div className="text-gray-500 text-[10px] uppercase mb-1">Game</div>
                          <div className="text-white text-sm font-medium">{bet.matchup}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-400 text-xs">Live</span>
                            <span className="text-gray-500 text-xs">|</span>
                            <span className="text-gray-400 text-xs">Odds updating</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Stake Input */}
                      <div className="px-4 pb-3 border-t border-gray-800/50 pt-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={bet.stake || ''}
                              onChange={(e) => updateStake(bet.key, e.target.value)}
                              className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-base focus:outline-none focus:border-blue-500"
                              placeholder="Enter stake"
                            />
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-gray-500 text-[10px] uppercase">To Win</div>
                            <div className="text-green-400 font-bold text-lg">${calculatePayout(bet.stake || 0, bet.odds).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedBets.length > 0 && (
              <div className="p-4 border-t border-gray-800/50 bg-black">
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Total Pikked</span>
                    <span className="text-white font-bold">${getTotalStake().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Potential Payout</span>
                    <span className="text-green-400 font-bold text-lg">${(getTotalStake() + getTotalPotentialWin()).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={placeBets}
                  disabled={getTotalStake() === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed text-lg"
                >
                  Place {selectedBets.length} Pik{selectedBets.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      <div className="min-h-screen bg-black">
      <Head>
        <title>Demo Dashboard - Funder</title>
      </Head>

      <TopNavbar 
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={selectedBets.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎮</span>
            <div className="text-left">
              <div className="text-white font-bold text-sm">Demo Mode - {demoChallenge.name}</div>
              <div className="text-purple-200 text-xs">Progress saved automatically</div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={resetDemo}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              Reset Demo
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
              className="bg-white hover:bg-gray-100 text-purple-600 font-bold text-sm px-4 py-2 rounded-lg transition-all"
            >
              Start for Real
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-6 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Challenge Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
            <div className="text-gray-500 text-sm">Target</div>
            <div className="text-white font-bold text-xl">${demoChallenge.target.toLocaleString()}</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
            <div className="text-gray-500 text-sm">Progress</div>
            <div className="text-green-400 font-bold text-xl">{progress.toFixed(1)}%</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
            <div className="text-gray-500 text-sm">Win Rate</div>
            <div className="text-green-400 font-bold text-xl">{winRate}%</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
            <div className="text-gray-500 text-sm">Total Bets</div>
            <div className="text-white font-bold text-xl">{totalBets}</div>
          </div>
        </div>

        {/* Sports Selection */}
        <div className="mb-4">
          <div className="flex space-x-3 overflow-x-auto pb-4 px-1 scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => handleSportClick(sport)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-full transition-all ${
                  selectedSport === sport
                    ? 'bg-[#111111] text-white shadow-lg border-2 border-green-500'
                    : 'bg-[#111111] text-gray-300 hover:bg-[#1a1a1a] border border-gray-800/50'
                }`}
              >
                <span className="text-xl mb-1">{getSportIcon(sport)}</span>
                <span className="text-xs font-medium">{sport}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {games.map(game => (
            <div key={game.id} className="bg-[#111111] rounded-xl border border-gray-800/50 overflow-hidden">
              <div className="bg-[#0a0a0a] px-6 py-4 border-b border-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span className="text-red-400 text-sm font-medium">LIVE</span>
                  </div>
                  <span className="text-gray-400 text-sm">{game.time}</span>
                </div>
                <h3 className="text-white font-bold text-lg mt-2">{game.awayTeam} @ {game.homeTeam}</h3>
              </div>

              <div className="overflow-x-auto">
                <div className="grid grid-cols-4 gap-4 px-4 py-2 text-xs text-gray-500 font-medium uppercase border-b border-gray-800/50">
                  <div>Team</div>
                  <div className="text-center">Spread</div>
                  <div className="text-center">Total</div>
                  <div className="text-center">Moneyline</div>
                </div>

                {/* Away Team */}
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-800/50">
                  <div className="text-white font-bold text-sm">{game.awayTeam}</div>
                  <button
                    onClick={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.spread.away.oddsMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <div className={`text-xs ${game.lines.spread.away.moved ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {game.lines.spread.away.moved && <span className="mr-0.5">{game.lines.spread.away.moved === 'up' ? '▲' : '▼'}</span>}
                      {game.lines.spread.away.point}
                    </div>
                    <OddsDisplay odds={game.lines.spread.away.odds} moved={game.lines.spread.away.oddsMoved} isSelected={isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`)} />
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.total.over.oddsMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <div className={`text-xs ${game.lines.total.over.moved ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {game.lines.total.over.moved && <span className="mr-0.5">{game.lines.total.over.moved === 'up' ? '▲' : '▼'}</span>}
                      {game.lines.total.over.point}
                    </div>
                    <OddsDisplay odds={game.lines.total.over.odds} moved={game.lines.total.over.oddsMoved} isSelected={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)} />
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'moneyline', game.awayTeam) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.moneyline.awayMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <OddsDisplay odds={game.lines.moneyline.away} moved={game.lines.moneyline.awayMoved} isSelected={isBetInSlip(game, 'moneyline', game.awayTeam)} />
                  </button>
                </div>

                {/* Home Team */}
                <div className="grid grid-cols-4 gap-4 px-4 py-3">
                  <div className="text-white font-bold text-sm">{game.homeTeam}</div>
                  <button
                    onClick={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.spread.home.oddsMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <div className={`text-xs ${game.lines.spread.home.moved ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {game.lines.spread.home.moved && <span className="mr-0.5">{game.lines.spread.home.moved === 'up' ? '▲' : '▼'}</span>}
                      {game.lines.spread.home.point}
                    </div>
                    <OddsDisplay odds={game.lines.spread.home.odds} moved={game.lines.spread.home.oddsMoved} isSelected={isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`)} />
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.total.under.oddsMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <div className={`text-xs ${game.lines.total.under.moved ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {game.lines.total.under.moved && <span className="mr-0.5">{game.lines.total.under.moved === 'up' ? '▲' : '▼'}</span>}
                      {game.lines.total.under.point}
                    </div>
                    <OddsDisplay odds={game.lines.total.under.odds} moved={game.lines.total.under.oddsMoved} isSelected={isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`)} />
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'moneyline', game.homeTeam) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : game.lines.moneyline.homeMoved ? 'bg-[#1a1a1a] border-yellow-500/50 ring-1 ring-yellow-500/30' : 'bg-[#1a1a1a] border-gray-800/50 hover:bg-green-600'
                    }`}
                  >
                    <OddsDisplay odds={game.lines.moneyline.home} moved={game.lines.moneyline.homeMoved} isSelected={isBetInSlip(game, 'moneyline', game.homeTeam)} />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
    </>
  );
}
