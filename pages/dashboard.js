
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';

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
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [betSlip, setBetSlip] = useState([]);
  const [showBetSlip, setShowBetSlip] = useState(false);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer'];

  useEffect(() => {
    setGames(mockGames[selectedSport] || []);
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
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white">{selectedSport} Betting</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-xs sm:text-sm">Live Lines</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sports Selection - DraftKings Style Horizontal Scroll */}
        <div className="mb-6">
          <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full transition-all duration-200 ${
                  selectedSport === sport
                    ? 'bg-green-500 text-white shadow-lg scale-110'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span className="text-xl sm:text-2xl mb-1">{getSportIcon(sport)}</span>
                <span className="text-xs font-medium">{sport}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-4 pb-20">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg">Loading games...</p>
            </div>
          ) : games.length > 0 ? (
            games.map(game => (
              <div key={game.id} className="bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden">
                {/* Game Header */}
                <div className="bg-slate-700/50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span className="text-red-400 text-xs sm:text-sm font-medium uppercase tracking-wide">Live</span>
                    </div>
                    <span className="text-gray-400 text-xs sm:text-sm">{game.time}</span>
                  </div>
                  <h3 className="text-white font-bold text-lg sm:text-xl mt-2">{game.awayTeam} @ {game.homeTeam}</h3>
                </div>

                {/* Betting Options - Compact DraftKings Style */}
                <div className="overflow-x-auto">
                  {/* Header Row */}
                  <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider border-b border-slate-600">
                    <div className="col-span-1"></div>
                    <div className="col-span-2 text-center">Spread</div>
                    <div className="col-span-2 text-center">Total</div>
                    <div className="col-span-2 text-center">Moneyline</div>
                  </div>

                  {/* Away Team Row */}
                  <div className="grid grid-cols-7 gap-2 px-4 py-3 border-b border-slate-600/50">
                    <div className="flex items-center">
                      <div className="text-white font-bold text-sm">{game.awayTeam}</div>
                    </div>
                    <button
                      onClick={() => addToBetSlip(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-spread-${game.awayTeam} ${game.lines.spread.away.point}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-gray-300 text-xs">{game.lines.spread.away.point}</div>
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.spread.away.odds)}</div>
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-total-Over ${game.lines.total.over.point}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-gray-300 text-xs">{game.lines.total.over.point}</div>
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.total.over.odds)}</div>
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-moneyline-${game.awayTeam}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.moneyline.away)}</div>
                    </button>
                    <div></div>
                  </div>

                  {/* Home Team Row */}
                  <div className="grid grid-cols-7 gap-2 px-4 py-3">
                    <div className="flex items-center">
                      <div className="text-white font-bold text-sm">{game.homeTeam}</div>
                    </div>
                    <button
                      onClick={() => addToBetSlip(game, 'spread', game.lines.spread.home.odds, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-spread-${game.homeTeam} ${game.lines.spread.home.point}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-gray-300 text-xs">{game.lines.spread.home.point}</div>
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.spread.home.odds)}</div>
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'total', game.lines.total.under.odds, `Under ${game.lines.total.under.point}`)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-total-Under ${game.lines.total.under.point}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-gray-300 text-xs">{game.lines.total.under.point}</div>
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.total.under.odds)}</div>
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                      className={`bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 rounded-lg py-2 px-3 transition-all duration-200 text-center ${
                        betSlip.find(bet => bet.id === `${game.id}-moneyline-${game.homeTeam}`) 
                          ? 'bg-green-600 border-green-500' 
                          : ''
                      }`}
                    >
                      <div className="text-green-400 text-xs font-medium">{formatOdds(game.lines.moneyline.home)}</div>
                    </button>
                    <div></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-auto">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <h3 className="text-xl font-bold text-white mb-2">No Games Available</h3>
                <p className="text-gray-400">Check back later for {selectedSport} games and betting lines.</p>
              </div>
            </div>
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
        />
      )}

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
