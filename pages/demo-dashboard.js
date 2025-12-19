import { useEffect, useState, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';
import BetReceipt from '../components/BetReceipt';
import CoinRain from '../components/CoinRain';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';

export default function DemoDashboard() {
  const router = useRouter();
  const [demoChallenge, setDemoChallenge] = useState(null);
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [selectedTab, setSelectedTab] = useState('upcoming');
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
  const [expandedBets, setExpandedBets] = useState({});
  const [betMode, setBetMode] = useState('straight'); // 'straight' or 'parlay'
  const [parlayStake, setParlayStake] = useState('');
  const [mounted, setMounted] = useState(false);

  const sports = ['NBA', 'NFL', 'NCAAB', 'NCAAF', 'MLB', 'NHL'];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate parlay odds from all selected bets
  const calculateParlayOdds = () => {
    if (selectedBets.length < 2) return null;
    
    // Convert American odds to decimal, multiply, then convert back
    let decimalOdds = 1;
    selectedBets.forEach(bet => {
      const american = bet.odds;
      let decimal;
      if (american > 0) {
        decimal = (american / 100) + 1;
      } else {
        decimal = (100 / Math.abs(american)) + 1;
      }
      decimalOdds *= decimal;
    });
    
    // Convert back to American
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  };

  const toggleBetExpanded = (key) => {
    setExpandedBets(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
  const [apiGames, setApiGames] = useState([]);

  useEffect(() => {
    const fetchAllGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          setApiGames(data.games || []);
        }
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };
    
    fetchAllGames();
    const interval = setInterval(fetchAllGames, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const categorizedGames = useMemo(() => categorizeGames(apiGames), [apiGames]);

  useEffect(() => {
    const activeGames = selectedTab === 'live' 
      ? categorizedGames.liveGames 
      : categorizedGames.upcomingGames;
    
    if (selectedSport === 'All Sports') {
      baseGamesRef.current = { 'All Sports': activeGames };
      setGames(activeGames);
    } else {
      const filteredGames = activeGames.filter(g => g.sportName === selectedSport);
      baseGamesRef.current = { [selectedSport]: filteredGames };
      setGames(filteredGames);
    }
  }, [selectedSport, selectedTab, apiGames, categorizedGames]);


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

  const OddsDisplay = ({ odds, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    return (
      <div className={`text-xs font-medium ${baseClass}`}>
        {formatOdds(odds)}
      </div>
    );
  };

  const getSportIcon = (sport) => {
    const icons = { 'NFL': '🏈', 'NCAAF': '🏈', 'NBA': '🏀', 'NCAAB': '🏀', 'MLB': '⚾', 'NHL': '🏒', 'Soccer': '⚽' };
    return icons[sport] || '🏆';
  };

  const getSportLabel = (sport) => {
    const labels = {
      'NFL': 'Football',
      'NCAAF': 'College Football',
      'NBA': 'Basketball',
      'NCAAB': 'College Basketball',
      'MLB': 'Baseball',
      'NHL': 'Hockey'
    };
    return labels[sport] || sport;
  };

  const handleSportClick = (sport) => {
    setSelectedSport(selectedSport === sport ? 'All Sports' : sport);
  };

  const addToBetSlip = (game, betType, odds, team) => {
    const betKey = `${game.id}-${betType}-${team}`;
    const existingIndex = selectedBets.findIndex(bet => bet.key === betKey);

    if (existingIndex >= 0) {
      // Clicking same bet removes it
      setSelectedBets(prev => prev.filter(bet => bet.key !== betKey));
    } else {
      // Remove any existing bet on the same game and bet type (opposite side)
      const conflictKey = `${game.id}-${betType}`;
      
      const newBet = {
        key: betKey,
        gameId: game.id,
        matchup: `${game.awayTeamFull || game.awayTeam} @ ${game.homeTeamFull || game.homeTeam}`,
        betType,
        odds: typeof odds === 'object' ? odds.odds : odds,
        selection: team,
        stake: 100
      };
      
      setSelectedBets(prev => {
        // Filter out any bet on the same game with the same bet type (opposite side)
        const filtered = prev.filter(bet => !bet.key.startsWith(conflictKey));
        return [...filtered, newBet];
      });
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
      
      {/* Demo Slip - Full screen on mobile, side panel on desktop */}
      {mounted && showBetSlip && ReactDOM.createPortal(
        <>
          <div 
            className="fixed inset-0 bg-black z-[98] hidden md:block"
            onClick={() => setShowBetSlip(false)}
          />
          
          <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] bg-black z-[99] flex flex-col h-full">
            {/* Header with Piks branding */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center">
                <img src="/pikslogotransparent.png" alt="Piks" className="h-28 object-contain -ml-8" />
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

            {/* Mode Toggle */}
            {selectedBets.length >= 2 && (
              <div className="px-4 py-3 border-b border-gray-800/50">
                <div className="flex bg-[#1a1a1a] rounded-lg p-1">
                  <button
                    onClick={() => setBetMode('straight')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      betMode === 'straight' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Straight
                  </button>
                  <button
                    onClick={() => setBetMode('parlay')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      betMode === 'parlay' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Parlay
                  </button>
                </div>
                {betMode === 'parlay' && calculateParlayOdds() && (
                  <div className="mt-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300 text-sm font-medium">{selectedBets.length}-Leg Parlay</span>
                      <span className="text-white font-bold text-lg">{formatOdds(calculateParlayOdds())}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedBets.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 font-medium text-lg mb-2">Your demo slip is empty</p>
                  <p className="text-gray-600">Click on odds to add picks</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {selectedBets.map((bet, index) => {
                    const isExpanded = expandedBets[bet.key] !== false; // Default expanded for first bet
                    const isCollapsible = selectedBets.length > 1;
                    
                    // Determine border color based on odds movement
                    let borderColor = 'border-blue-500/50';
                    let flashClass = '';
                    if (bet.oddsMoved === 'up') {
                      borderColor = 'border-green-500';
                      flashClass = 'animate-pulse bg-green-500/10';
                    } else if (bet.oddsMoved === 'down') {
                      borderColor = 'border-red-500';
                      flashClass = 'animate-pulse bg-red-500/10';
                    }
                    
                    return (
                      <div key={bet.key} className={`bg-black rounded-lg border ${borderColor} overflow-hidden ${flashClass}`}>
                        {/* Collapsible Header */}
                        <div 
                          className={`bg-slate-900/80 px-4 py-2 flex items-center justify-between ${isCollapsible ? 'cursor-pointer hover:bg-slate-800/80' : ''}`}
                          onClick={() => isCollapsible && toggleBetExpanded(bet.key)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {isCollapsible && (
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            <div className={`w-2 h-2 rounded-full ${
                              bet.oddsMoved === 'up' ? 'bg-green-400' : 
                              bet.oddsMoved === 'down' ? 'bg-red-400' : 'bg-blue-400 animate-pulse'
                            }`}></div>
                            <span className={`text-xs font-bold uppercase ${
                              bet.oddsMoved === 'up' ? 'text-green-400' : 
                              bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                            }`}>{bet.betType || 'Spread'}</span>
                            {!isExpanded && (
                              <span className="text-gray-300 text-xs ml-2 truncate">{bet.selection}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isExpanded && (
                              <span className={`font-bold text-sm ${
                                bet.oddsMoved === 'up' ? 'text-green-400' : 
                                bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                              }`}>{formatOdds(bet.odds)}</span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeBet(bet.key); }} className="text-gray-500 hover:text-red-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Expandable Content */}
                        {isExpanded && (
                          <>
                            {/* Selection & Odds */}
                            <div className="px-4 py-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="text-white font-bold text-base">{bet.selection}</div>
                                  <div className="text-gray-400 text-xs uppercase mt-0.5">{bet.betType}</div>
                                </div>
                                <div className={`font-bold text-xl flex items-center gap-1 ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                }`}>
                                  {bet.oddsMoved === 'up' && <span className="text-sm">▲</span>}
                                  {bet.oddsMoved === 'down' && <span className="text-sm">▼</span>}
                                  {formatOdds(bet.odds)}
                                </div>
                              </div>
                              
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
                            
                            {/* Stake Input - Only for straight bets */}
                            {betMode === 'straight' && (
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
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedBets.length > 0 && (
              <div className="flex-shrink-0 p-4 border-t border-gray-800/50 bg-black">
                {/* Parlay Stake Input */}
                {betMode === 'parlay' && selectedBets.length >= 2 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={parlayStake}
                          onChange={(e) => setParlayStake(e.target.value)}
                          className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-base focus:outline-none focus:border-blue-500"
                          placeholder="Enter parlay stake"
                        />
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-gray-500 text-[10px] uppercase">Parlay Win</div>
                        <div className="text-green-400 font-bold text-lg">
                          ${calculatePayout(parseFloat(parlayStake) || 0, calculateParlayOdds() || -110).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Total Pikked</span>
                    <span className="text-white font-bold">
                      ${betMode === 'parlay' ? (parseFloat(parlayStake) || 0).toFixed(2) : getTotalStake().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Potential Payout</span>
                    <span className="text-green-400 font-bold text-lg">
                      ${betMode === 'parlay' 
                        ? ((parseFloat(parlayStake) || 0) + calculatePayout(parseFloat(parlayStake) || 0, calculateParlayOdds() || -110)).toFixed(2)
                        : (getTotalStake() + getTotalPotentialWin()).toFixed(2)
                      }
                    </span>
                  </div>
                </div>

                <button
                  onClick={placeBets}
                  disabled={betMode === 'parlay' ? !parlayStake || parseFloat(parlayStake) <= 0 : getTotalStake() === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed text-lg"
                >
                  {betMode === 'parlay' ? `Place ${selectedBets.length}-Leg Parlay` : `Place ${selectedBets.length} Demo Pik${selectedBets.length > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
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
            {/* Demo Balance Display */}
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                <span className="text-white font-bold text-sm">${bankroll.toLocaleString()}</span>
                {pnl !== 0 && (
                  <span className={`text-xs font-medium ${pnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    ({pnl >= 0 ? '+' : ''}{pnl.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
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
      <div className="pt-4 pb-24">
        {/* Live/Upcoming Tabs */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                selectedTab === 'upcoming'
                  ? 'bg-green-600 text-white'
                  : 'bg-[#1a1a1a] text-gray-400'
              }`}
            >
              Upcoming {categorizedGames.upcomingGames.length > 0 && `(${categorizedGames.upcomingGames.length})`}
            </button>
            <button
              onClick={() => setSelectedTab('live')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                selectedTab === 'live'
                  ? 'bg-red-600 text-white'
                  : 'bg-[#1a1a1a] text-gray-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                selectedTab === 'live'
                  ? 'bg-white'
                  : categorizedGames.liveGames.length > 0 ? 'bg-red-500' : 'bg-gray-500'
              }`}></span>
              Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}
            </button>
          </div>
        </div>
        
        {/* Sports Filter Pills */}
        <div className="px-4 mb-6">
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => handleSportClick(sport)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium ${
                  selectedSport === sport
                    ? 'bg-[#1a1a1a] text-white border border-gray-600'
                    : 'bg-transparent text-gray-400 border border-gray-800'
                }`}
              >
                <span className="text-base">{getSportIcon(sport)}</span>
                <span>{getSportLabel(sport)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h2 className="text-white font-bold text-lg">Featured</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {games.slice(0, 3).map((game, idx) => {
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              return (
                <div 
                  key={game.id} 
                  className="flex-shrink-0 w-[280px] bg-[#111111] rounded-2xl border border-gray-800/50 overflow-hidden cursor-pointer hover:border-gray-600 transition-colors"
                  onClick={() => router.push(`/game/${game.id}?demo=true`)}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">FEATURED</span>
                      <span className="text-gray-500 text-xs">{game.sportName || 'NBA'}</span>
                      {isLive ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 text-xs font-medium">LIVE</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs ml-auto">{game.time || 'TBD'}</span>
                      )}
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-base">{game.awayTeamFull || game.awayTeam}</span>
                        {isLive && <span className="text-white font-bold">{game.awayScore || 0}</span>}
                      </div>
                      <div className="text-gray-500 text-xs">@</div>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-base">{game.homeTeamFull || game.homeTeam}</span>
                        {isLive && <span className="text-white font-bold">{game.homeScore || 0}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam); }}
                        className={`flex-1 rounded-lg py-3 px-3 ${
                          isBetInSlip(game, 'moneyline', game.homeTeam) 
                            ? 'bg-green-600 border border-green-500' 
                            : 'bg-[#1a1a1a] border border-gray-700 active:bg-green-600'
                        }`}
                      >
                        <div className="text-gray-400 text-xs mb-0.5">{game.homeTeam.split(' ').pop()}</div>
                        <div className={`font-bold ${isBetInSlip(game, 'moneyline', game.homeTeam) ? 'text-white' : 'text-green-400'}`}>
                          {formatOdds(game.lines.moneyline.home)}
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam); }}
                        className={`flex-1 rounded-lg py-3 px-3 ${
                          isBetInSlip(game, 'moneyline', game.awayTeam) 
                            ? 'bg-green-600 border border-green-500' 
                            : 'bg-[#1a1a1a] border border-gray-700 active:bg-green-600'
                        }`}
                      >
                        <div className="text-gray-400 text-xs mb-0.5">{game.awayTeam.split(' ').pop()}</div>
                        <div className={`font-bold ${isBetInSlip(game, 'moneyline', game.awayTeam) ? 'text-white' : 'text-green-400'}`}>
                          {formatOdds(game.lines.moneyline.away)}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Games Section */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedTab === 'live' ? '⚡' : '📅'}</span>
              <h2 className="text-white font-bold text-lg">{selectedTab === 'live' ? 'Live Now' : 'Upcoming Games'}</h2>
              {selectedTab === 'live' && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
            </div>
          </div>

          <div className="space-y-3">
            {games.map(game => {
              const sport = game.sportName || 'NBA';
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              
              return (
                <div 
                  key={game.id} 
                  className="bg-[#111111] rounded-xl border border-gray-800/50 overflow-hidden cursor-pointer hover:border-gray-600 transition-colors"
                  onClick={() => router.push(`/game/${game.id}?demo=true`)}
                >
                  {/* Game Header */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs font-medium">{sport}</span>
                        {isLive ? (
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-500 text-xs font-medium">LIVE</span>
                            {game.quarter && <span className="text-gray-400 text-xs">• {game.quarter}</span>}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">{game.time || 'TBD'}</span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    
                    {/* Teams with Scores */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{game.awayTeamFull || game.awayTeam}</span>
                        {isLive ? (
                          <span className="text-white font-bold text-lg">{game.awayScore || 0}</span>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{game.homeTeamFull || game.homeTeam}</span>
                        {isLive ? (
                          <span className="text-white font-bold text-lg">{game.homeScore || 0}</span>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>
                    </div>

                    {/* Moneyline Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam); }}
                        className={`flex-1 rounded-xl py-3 px-4 ${
                          isBetInSlip(game, 'moneyline', game.awayTeam) 
                            ? 'bg-green-600 border border-green-500' 
                            : 'bg-[#1a1a1a] border border-gray-700 active:bg-green-600'
                        }`}
                      >
                        <div className="text-gray-400 text-xs mb-1">{game.awayTeam.split(' ').pop()}</div>
                        <div className={`font-bold text-lg ${isBetInSlip(game, 'moneyline', game.awayTeam) ? 'text-white' : 'text-white'}`}>
                          {formatOdds(game.lines.moneyline.away)}
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam); }}
                        className={`flex-1 rounded-xl py-3 px-4 ${
                          isBetInSlip(game, 'moneyline', game.homeTeam) 
                            ? 'bg-green-600 border border-green-500' 
                            : 'bg-[#1a1a1a] border border-gray-700 active:bg-green-600'
                        }`}
                      >
                        <div className="text-gray-400 text-xs mb-1">{game.homeTeam.split(' ').pop()}</div>
                        <div className={`font-bold text-lg ${isBetInSlip(game, 'moneyline', game.homeTeam) ? 'text-white' : 'text-white'}`}>
                          {formatOdds(game.lines.moneyline.home)}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-gray-800 z-40 md:hidden">
        <div className="flex items-center justify-around py-2">
          <button className="flex flex-col items-center py-2 px-4 text-green-500">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span className="text-xs mt-1 font-medium">Home</span>
          </button>
          <button 
            onClick={() => setSelectedSport('All Sports')}
            className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <span className="text-xs mt-1">Sports</span>
          </button>
          <button 
            onClick={() => setShowBetSlip(true)}
            className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-white relative"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            {selectedBets.length > 0 && (
              <span className="absolute -top-1 right-2 bg-green-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {selectedBets.length}
              </span>
            )}
            <span className="text-xs mt-1">Demo Slip</span>
          </button>
          <button className="flex flex-col items-center py-2 px-4 text-gray-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </button>
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
