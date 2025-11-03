import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';
import BetReceipt from '../components/BetReceipt';

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

  useEffect(() => {
    if (selectedSport === 'All Sports') {
      const allGames = Object.values(mockGames).flat();
      setGames(allGames);
    } else {
      setGames(mockGames[selectedSport] || []);
    }
  }, [selectedSport]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
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
              onClick={() => router.push('/auth')}
              className="bg-white hover:bg-gray-100 text-purple-600 font-bold text-sm px-4 py-2 rounded-lg transition-all"
            >
              Sign Up for Real
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-6 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Challenge Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-gray-400 text-sm">Target</div>
            <div className="text-white font-bold text-xl">${demoChallenge.target.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-gray-400 text-sm">Progress</div>
            <div className="text-blue-400 font-bold text-xl">{progress.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-gray-400 text-sm">Win Rate</div>
            <div className="text-green-400 font-bold text-xl">{winRate}%</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-gray-400 text-sm">Total Bets</div>
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
                    ? 'bg-gray-800 text-white shadow-lg border-2 border-purple-500'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
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
            <div key={game.id} className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-600">
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
                <div className="grid grid-cols-4 gap-4 px-4 py-2 text-xs text-gray-400 font-medium uppercase border-b border-slate-600">
                  <div>Team</div>
                  <div className="text-center">Spread</div>
                  <div className="text-center">Total</div>
                  <div className="text-center">Moneyline</div>
                </div>

                {/* Away Team */}
                <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-600/50">
                  <div className="text-white font-bold text-sm">{game.awayTeam}</div>
                  <button
                    onClick={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-gray-300 text-xs">{game.lines.spread.away.point}</div>
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.spread.away.odds)}</div>
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-gray-300 text-xs">{game.lines.total.over.point}</div>
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.total.over.odds)}</div>
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'moneyline', game.awayTeam) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.moneyline.away)}</div>
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
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-gray-300 text-xs">{game.lines.spread.home.point}</div>
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.spread.home.odds)}</div>
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-gray-300 text-xs">{game.lines.total.under.point}</div>
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.total.under.odds)}</div>
                  </button>
                  <button
                    onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                    className={`border rounded-lg py-2 px-3 transition-all text-center ${
                      isBetInSlip(game, 'moneyline', game.homeTeam) 
                        ? 'bg-green-600 border-green-500 shadow-lg' 
                        : 'bg-gray-700 border-gray-600 hover:bg-green-600'
                    }`}
                  >
                    <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.moneyline.home)}</div>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet Slip */}
      {showBetSlip && selectedBets.length > 0 && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:top-20 lg:right-8 lg:w-[480px]">
          <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={() => setShowBetSlip(false)}></div>
          
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] lg:relative bg-black border border-slate-700 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col">
            <div className="flex-shrink-0 p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Bet Slip ({selectedBets.length})</h3>
              <button
                onClick={() => setShowBetSlip(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedBets.map(bet => (
                <div key={bet.key} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{bet.matchup}</div>
                      <div className="text-gray-400 text-xs mt-1">{bet.selection}</div>
                      <div className="text-green-400 text-xs font-medium mt-1">{formatOdds(bet.odds)}</div>
                    </div>
                    <button
                      onClick={() => removeBet(bet.key)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Stake Amount</label>
                    <input
                      type="number"
                      value={bet.stake}
                      onChange={(e) => updateStake(bet.key, e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                      placeholder="0"
                    />
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-gray-400">To Win: </span>
                    <span className="text-green-400 font-bold">${calculatePayout(bet.stake, bet.odds).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-shrink-0 p-4 border-t border-slate-700 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Stake:</span>
                <span className="text-white font-bold">${getTotalStake().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Potential Win:</span>
                <span className="text-green-400 font-bold">${getTotalPotentialWin().toFixed(2)}</span>
              </div>
              <button
                onClick={placeBets}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 rounded-xl transition-all"
              >
                Place Bets
              </button>
            </div>
          </div>
        </div>
      )}

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
