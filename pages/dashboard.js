import { useEffect, useState, useRef } from 'react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { simulateOddsMovement } from '../lib/oddsSimulator';

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
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);

  const handleBetSlipClick = () => {
    setShowBetSlip(!showBetSlip);
  };

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer'];

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
    setLoading(false);
  }, [selectedSport]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGames(prevGames => {
        const updatedGames = simulateOddsMovement(prevGames);
        return updatedGames;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const OddsDisplay = ({ odds, moved, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    const moveClass = moved === 'up' ? 'animate-pulse text-green-400' : moved === 'down' ? 'animate-pulse text-red-400' : '';
    
    return (
      <div className={`text-sm font-bold flex items-center justify-center gap-1 ${moveClass || baseClass}`}>
        {moved === 'up' && <span className="text-xs">▲</span>}
        {moved === 'down' && <span className="text-xs">▼</span>}
        {formatOdds(odds)}
      </div>
    );
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
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={handleBetSlipClick}
      />

      {/* Main Content */}
      <div className="pt-2 sm:pt-6 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end mb-4 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="bg-[#111111] px-4 py-3 rounded-lg border border-gray-800/50">
              <div className="flex items-center space-x-2">
                <span className="text-gray-300 text-sm sm:text-base whitespace-nowrap">Live Lines</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sports Selection - DraftKings Style Horizontal Scroll */}
        <div className="mb-4">
          <div className="flex space-x-3 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => handleSportClick(sport)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-18 h-18 sm:w-20 sm:h-20 rounded-full transition-all duration-200 ${
                  selectedSport === sport
                    ? 'bg-[#111111] text-white shadow-lg border-2 border-green-500'
                    : 'bg-[#111111] text-gray-300 hover:bg-[#1a1a1a] hover:text-white border border-gray-800/50'
                }`}
              >
                <span className="text-lg sm:text-xl mb-1">{getSportIcon(sport)}</span>
                <span className="text-xs font-medium text-center leading-tight">{sport}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg">Loading games...</p>
            </div>
          ) : games.length > 0 ? (
            games.map(game => (
              <div key={game.id} className="bg-[#111111] rounded-2xl border border-gray-800/50 overflow-hidden">
                {/* Card Header */}
                <div className="px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold text-base sm:text-lg truncate">{game.awayTeam} @ {game.homeTeam}</h3>
                    <div className="flex items-center space-x-2 bg-red-500/20 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span className="text-red-400 text-xs font-semibold uppercase">Live</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs">{game.time}</p>
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
                      onClick={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.spread.away.oddsMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <div className={`text-xs ${game.lines.spread.away.moved ? 'text-yellow-400' : isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`) ? 'text-white' : 'text-gray-400'}`}>
                        {game.lines.spread.away.moved && <span className="mr-0.5">{game.lines.spread.away.moved === 'up' ? '▲' : '▼'}</span>}
                        {game.lines.spread.away.point}
                      </div>
                      <OddsDisplay odds={game.lines.spread.away.odds} moved={game.lines.spread.away.oddsMoved} isSelected={isBetInSlip(game, 'spread', `${game.awayTeam} ${game.lines.spread.away.point}`)} />
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.total.over.oddsMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <div className={`text-xs ${game.lines.total.over.moved ? 'text-yellow-400' : isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? 'text-white' : 'text-gray-400'}`}>
                        {game.lines.total.over.moved && <span className="mr-0.5">{game.lines.total.over.moved === 'up' ? '▲' : '▼'}</span>}
                        {game.lines.total.over.point}
                      </div>
                      <OddsDisplay odds={game.lines.total.over.odds} moved={game.lines.total.over.oddsMoved} isSelected={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)} />
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'moneyline', game.awayTeam) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.moneyline.awayMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <OddsDisplay odds={game.lines.moneyline.away} moved={game.lines.moneyline.awayMoved} isSelected={isBetInSlip(game, 'moneyline', game.awayTeam)} />
                    </button>
                  </div>

                  {/* Home Team Row */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    <div className="flex items-center">
                      <span className="text-white font-semibold text-sm truncate">{game.homeTeam}</span>
                    </div>
                    <button
                      onClick={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.spread.home.oddsMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <div className={`text-xs ${game.lines.spread.home.moved ? 'text-yellow-400' : isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`) ? 'text-white' : 'text-gray-400'}`}>
                        {game.lines.spread.home.moved && <span className="mr-0.5">{game.lines.spread.home.moved === 'up' ? '▲' : '▼'}</span>}
                        {game.lines.spread.home.point}
                      </div>
                      <OddsDisplay odds={game.lines.spread.home.odds} moved={game.lines.spread.home.oddsMoved} isSelected={isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`)} />
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.total.under.oddsMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <div className={`text-xs ${game.lines.total.under.moved ? 'text-yellow-400' : isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? 'text-white' : 'text-gray-400'}`}>
                        {game.lines.total.under.moved && <span className="mr-0.5">{game.lines.total.under.moved === 'up' ? '▲' : '▼'}</span>}
                        {game.lines.total.under.point}
                      </div>
                      <OddsDisplay odds={game.lines.total.under.odds} moved={game.lines.total.under.oddsMoved} isSelected={isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`)} />
                    </button>
                    <button
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                      className={`rounded-lg py-2.5 px-2 transition-all duration-200 text-center ${
                        isBetInSlip(game, 'moneyline', game.homeTeam) 
                          ? 'bg-green-600 shadow-lg shadow-green-500/20' 
                          : game.lines.moneyline.homeMoved ? 'bg-[#1a1a1a] ring-1 ring-yellow-500/50' : 'bg-[#1a1a1a] hover:bg-[#252525]'
                      }`}
                    >
                      <OddsDisplay odds={game.lines.moneyline.home} moved={game.lines.moneyline.homeMoved} isSelected={isBetInSlip(game, 'moneyline', game.homeTeam)} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-[#111111] rounded-2xl p-8 max-w-md mx-auto border border-gray-800/50">
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
      <BetSlip
        bankroll={bankroll}
        isOpen={showBetSlip}
        onClose={() => setShowBetSlip(false)}
      />
      
      

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .w-18 {
          width: 4.5rem;
        }
        .h-18 {
          height: 4.5rem;
        }

        /* Disable hover effects on touch devices */
        @media (hover: none) and (pointer: coarse) {
          button:hover {
            background-color: inherit !important;
            border-color: inherit !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}