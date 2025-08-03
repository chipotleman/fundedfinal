
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import LiveBetting from '../components/LiveBetting';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import BetBuilder from '../components/BetBuilder';
import CashOutModal from '../components/CashOutModal';
import AchievementSystem from '../components/AchievementSystem';

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
        moneyline: {
          away: +520,
          home: -850
        }
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
        moneyline: {
          away: +140,
          home: -160
        }
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
        moneyline: {
          away: +130,
          home: -150
        }
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
        moneyline: {
          away: +120,
          home: -140
        }
      }
    }
  ],
  'UFC': [
    {
      id: 5,
      awayTeam: 'Fighter A',
      homeTeam: 'Fighter B',
      time: '10:00 PM ET',
      lines: {
        spread: {
          away: { point: 'N/A', odds: 'N/A' },
          home: { point: 'N/A', odds: 'N/A' }
        },
        total: {
          over: { point: 'N/A', odds: 'N/A' },
          under: { point: 'N/A', odds: 'N/A' }
        },
        moneyline: {
          away: +180,
          home: -220
        }
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
        moneyline: {
          away: +250,
          home: -150
        }
      }
    }
  ]
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [betSlip, setBetSlip] = useState([]);
  const [showBetSlip, setShowBetSlip] = useState(false);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const [showCashOut, setShowCashOut] = useState(false);
  const [selectedCashOutBet, setSelectedCashOutBet] = useState(null);
  const [liveGames] = useState([mockGames.NFL[0]]);
  const [activeView, setActiveView] = useState('sportsbook');
  const [showBetBuilder, setShowBetBuilder] = useState(false);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer'];

  useEffect(() => {
    if (selectedSport === 'All Sports') {
      const allGames = Object.values(mockGames).flat();
      setGames(allGames);
    } else {
      setGames(mockGames[selectedSport] || []);
    }
    setLoading(false);
  }, [selectedSport]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const addToBetSlip = (game, betType, odds, selection) => {
    const newBet = {
      id: `${game.id}-${betType}-${selection}`,
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      selection: selection,
      betType: betType,
      odds: odds,
      stake: 0
    };

    setBetSlip(prev => {
      const existing = prev.find(bet => bet.id === newBet.id);
      if (existing) {
        return prev.filter(bet => bet.id !== newBet.id);
      }

      const sameGameBet = prev.find(bet => bet.game_id === game.id && bet.betType === betType);
      if (sameGameBet) {
        return prev.filter(bet => !(bet.game_id === game.id && bet.betType === betType)).concat(newBet);
      }

      return [...prev, newBet];
    });
  };

  const getSportIcon = (sport) => {
    const icons = {
      'NFL': '🏈',
      'NBA': '🏀', 
      'MLB': '⚾',
      'NHL': '🏒',
      'UFC': '🥊',
      'Soccer': '⚽'
    };
    return icons[sport] || '🏆';
  };

  const handleSportClick = (sport) => {
    if (selectedSport === sport) {
      setSelectedSport('All Sports');
    } else {
      setSelectedSport(sport);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        user={user}
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Main Content */}
      <div className="pt-24 sm:pt-28 lg:pt-32 px-4 sm:px-6 lg:px-8">
        {/* Header with View Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
              {activeView === 'sportsbook' ? `${selectedSport} Betting` : 
               activeView === 'analytics' ? 'Performance Analytics' : 
               activeView === 'achievements' ? 'Achievements & Rewards' : 'Sportsbook'}
            </h1>
            
            {/* Clean navigation */}
            <div className="flex space-x-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setActiveView('sportsbook')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === 'sportsbook'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                Sportsbook
              </button>
              <button
                onClick={() => setActiveView('analytics')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === 'analytics'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveView('achievements')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeView === 'achievements'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                Achievements
              </button>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            {activeView === 'sportsbook' && (
              <>
                <button
                  onClick={() => setShowBetBuilder(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Bet Builder
                </button>
                <div className="bg-slate-800 px-4 py-3 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm whitespace-nowrap">Live Lines</span>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content based on active view */}
        <div className="pb-20">
          {activeView === 'sportsbook' && (
            <div className="space-y-6">
              {/* Live Games Section */}
              {liveGames.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <h2 className="text-xl font-bold text-white">Live Betting</h2>
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs font-medium">
                      {liveGames.length} Live
                    </span>
                  </div>
                  {liveGames.map(game => (
                    <LiveBetting 
                      key={`live-${game.id}`} 
                      game={game} 
                      onBetSelect={addToBetSlip}
                      betSlip={betSlip}
                    />
                  ))}
                </div>
              )}

              {/* Sports Selection */}
              <div className="mb-6">
                <h2 className="text-lg font-bold text-white mb-4">Sports</h2>
                <div className="flex space-x-3 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide">
                  <button
                    onClick={() => setSelectedSport('All Sports')}
                    className={`flex-shrink-0 px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                      selectedSport === 'All Sports'
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                  >
                    All Sports
                  </button>
                  {sports.map((sport) => (
                    <button
                      key={sport}
                      onClick={() => handleSportClick(sport)}
                      className={`flex-shrink-0 flex items-center space-x-2 px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                        selectedSport === sport
                          ? 'bg-green-500 text-white shadow-lg'
                          : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                    >
                      <span className="text-lg">{getSportIcon(sport)}</span>
                      <span>{sport}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Games List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white text-lg">Loading games...</p>
                </div>
              ) : games.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-white">
                    {selectedSport === 'All Sports' ? 'All Games' : `${selectedSport} Games`}
                  </h2>
                  {games.map(game => (
                    <div key={game.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors">
                      {/* Game Header */}
                      <div className="bg-slate-700/30 px-6 py-4 border-b border-slate-600">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-bold text-lg">{game.awayTeam} @ {game.homeTeam}</h3>
                          <span className="text-gray-400 text-sm font-medium">{game.time}</span>
                        </div>
                      </div>

                      {/* Betting Options */}
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Spread */}
                          <div className="space-y-3">
                            <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wide">Spread</h4>
                            <div className="space-y-2">
                              <button
                                onClick={() => addToBetSlip(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-spread-${game.awayTeam} ${game.lines.spread.away.point}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div>
                                  <div className="text-white font-medium">{game.awayTeam}</div>
                                  <div className="text-gray-300 text-sm">{game.lines.spread.away.point}</div>
                                </div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.spread.away.odds)}</div>
                              </button>
                              <button
                                onClick={() => addToBetSlip(game, 'spread', game.lines.spread.home.odds, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-spread-${game.homeTeam} ${game.lines.spread.home.point}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div>
                                  <div className="text-white font-medium">{game.homeTeam}</div>
                                  <div className="text-gray-300 text-sm">{game.lines.spread.home.point}</div>
                                </div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.spread.home.odds)}</div>
                              </button>
                            </div>
                          </div>

                          {/* Total */}
                          <div className="space-y-3">
                            <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wide">Total</h4>
                            <div className="space-y-2">
                              <button
                                onClick={() => addToBetSlip(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-total-Over ${game.lines.total.over.point}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div>
                                  <div className="text-white font-medium">Over</div>
                                  <div className="text-gray-300 text-sm">{game.lines.total.over.point}</div>
                                </div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.total.over.odds)}</div>
                              </button>
                              <button
                                onClick={() => addToBetSlip(game, 'total', game.lines.total.under.odds, `Under ${game.lines.total.under.point}`)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-total-Under ${game.lines.total.under.point}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div>
                                  <div className="text-white font-medium">Under</div>
                                  <div className="text-gray-300 text-sm">{game.lines.total.under.point}</div>
                                </div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.total.under.odds)}</div>
                              </button>
                            </div>
                          </div>

                          {/* Moneyline */}
                          <div className="space-y-3">
                            <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wide">Moneyline</h4>
                            <div className="space-y-2">
                              <button
                                onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-moneyline-${game.awayTeam}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div className="text-white font-medium">{game.awayTeam}</div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.moneyline.away)}</div>
                              </button>
                              <button
                                onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                  betSlip.find(bet => bet.id === `${game.id}-moneyline-${game.homeTeam}`) 
                                    ? 'bg-green-600 border-green-500 shadow-lg' 
                                    : 'bg-slate-700 hover:bg-green-600 border-slate-600 hover:border-green-500'
                                }`}
                              >
                                <div className="text-white font-medium">{game.homeTeam}</div>
                                <div className="text-green-400 font-bold">{formatOdds(game.lines.moneyline.home)}</div>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-auto border border-slate-700">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-xl font-bold text-white mb-2">No Games Available</h3>
                    <p className="text-gray-400">Check back later for {selectedSport} games and betting lines.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'analytics' && (
            <AnalyticsDashboard user={user} />
          )}

          {activeView === 'achievements' && (
            <AchievementSystem userStats={{}} />
          )}
        </div>
      </div>

      {/* Bet Slip */}
      {showBetSlip && (
        <BetSlip
          isOpen={showBetSlip}
          onClose={() => setShowBetSlip(false)}
          bets={betSlip}
          setBets={setBetSlip}
          bankroll={bankroll}
          setBankroll={setBankroll}
          pnl={pnl}
          setPnl={setPnl}
          onCashOut={(bet) => {
            setSelectedCashOutBet(bet);
            setShowCashOut(true);
          }}
        />
      )}

      {/* Bet Builder Modal */}
      {showBetBuilder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Bet Builder</h2>
              <button
                onClick={() => setShowBetBuilder(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <BetBuilder 
                games={games}
                onBetSelect={addToBetSlip}
                betSlip={betSlip}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cash Out Modal */}
      <CashOutModal
        isOpen={showCashOut}
        onClose={() => setShowCashOut(false)}
        bet={selectedCashOutBet}
        onCashOut={(betId, amount) => {
          setBankroll(prev => prev + amount);
          setPnl(prev => prev + (amount - selectedCashOutBet.stake));
          setBetSlip(prev => prev.filter(bet => bet.id !== betId));
        }}
      />

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
