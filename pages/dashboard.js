import { useEffect, useState, useRef } from 'react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { simulateOddsMovement, updateBetSlipWithNewOdds } from '../lib/oddsSimulator';

const mockGames = {
  'NFL': [
    {
      id: 1,
      awayTeam: 'LA Chargers',
      homeTeam: 'Detroit Lions',
      time: '1:00 PM ET',
      awayScore: 14,
      homeScore: 21,
      quarter: '3rd',
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
      awayScore: 87,
      homeScore: 92,
      quarter: '3rd',
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
      awayScore: 4,
      homeScore: 3,
      quarter: '7th',
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
      awayScore: 2,
      homeScore: 3,
      quarter: '2nd',
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
      awayScore: 1,
      homeScore: 2,
      quarter: "65'",
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

export default function Dashboard() {
  const { user } = useAuth();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [games, setGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);

  const handleBetSlipClick = () => {
    setShowBetSlip(!showBetSlip);
  };

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer'];

  const baseGamesRef = useRef({});
  const betSlipRef = useRef(betSlip);
  
  useEffect(() => {
    betSlipRef.current = betSlip;
  }, [betSlip]);

  useEffect(() => {
    const allGamesList = Object.values(mockGames).flat();
    setAllGames(allGamesList);
    
    if (selectedSport === 'All Sports') {
      baseGamesRef.current = { 'All Sports': allGamesList };
      setGames(allGamesList);
    } else {
      baseGamesRef.current = { [selectedSport]: mockGames[selectedSport] || [] };
      setGames(mockGames[selectedSport] || []);
    }
    setLoading(false);
  }, [selectedSport]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGames(prevGames => simulateOddsMovement(prevGames));
      
      setAllGames(prevAll => {
        const updatedAll = simulateOddsMovement(prevAll);
        
        if (setBetSlip && betSlipRef.current.length > 0) {
          setBetSlip(prevBets => updateBetSlipWithNewOdds(prevBets, updatedAll));
        }
        
        return updatedAll;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [setBetSlip]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const OddsDisplay = ({ odds, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    return (
      <div className={`text-sm font-bold ${baseClass}`}>
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

      <div className="pt-2 sm:pt-6 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16">
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

        <div className="mb-4">
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
                <span>{sport === 'NFL' ? 'Football' : sport === 'NBA' ? 'Basketball' : sport === 'MLB' ? 'Baseball' : sport === 'NHL' ? 'Hockey' : sport}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h2 className="text-white font-bold text-lg">Featured</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {allGames.slice(0, 3).map((game) => (
              <div key={game.id} className="flex-shrink-0 w-[280px] bg-[#111111] rounded-2xl border border-gray-800/50 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">FEATURED</span>
                    <span className="text-gray-500 text-xs">{sports.find(s => mockGames[s]?.some(g => g.id === game.id)) || 'NFL'}</span>
                  </div>
                  <div className="mb-4">
                    <div className="text-white font-bold text-base">{game.awayTeam}</div>
                    <div className="text-gray-500 text-xs">@</div>
                    <div className="text-white font-bold text-base">{game.homeTeam}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
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
                      onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeam)}
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
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 className="text-white font-bold text-lg">Live Now</h2>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white text-lg">Loading games...</p>
              </div>
            ) : games.length > 0 ? (
              games.map(game => {
                const sport = sports.find(s => mockGames[s]?.some(g => g.id === game.id)) || 'NFL';
                
                return (
                  <div key={game.id} className="bg-[#111111] rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-medium">{sport}</span>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                            <span className="text-red-500 text-xs font-medium">LIVE</span>
                          </div>
                          {game.quarter && (
                            <span className="text-gray-400 text-xs">• {game.quarter}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{game.awayTeam}</span>
                          <span className="text-white font-bold text-lg">{game.awayScore || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{game.homeTeam}</span>
                          <span className="text-white font-bold text-lg">{game.homeScore || 0}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                          className={`rounded-lg py-2.5 px-2 ${
                            isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`) 
                              ? 'bg-green-600 border border-green-500' 
                              : 'bg-[#1a1a1a] border border-gray-700'
                          }`}
                        >
                          <div className="text-gray-400 text-[10px] uppercase mb-1">Spread</div>
                          <div className={`text-xs ${isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`) ? 'text-white' : 'text-gray-300'}`}>
                            {game.lines.spread.home.point}
                          </div>
                          <OddsDisplay odds={game.lines.spread.home.odds} isSelected={isBetInSlip(game, 'spread', `${game.homeTeam} ${game.lines.spread.home.point}`)} />
                        </button>
                        <button
                          onClick={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                          className={`rounded-lg py-2.5 px-2 ${
                            isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) 
                              ? 'bg-green-600 border border-green-500' 
                              : 'bg-[#1a1a1a] border border-gray-700'
                          }`}
                        >
                          <div className="text-gray-400 text-[10px] uppercase mb-1">Total</div>
                          <div className={`text-xs ${isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? 'text-white' : 'text-gray-300'}`}>
                            {game.lines.total.over.point}
                          </div>
                          <OddsDisplay odds={game.lines.total.over.odds} isSelected={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)} />
                        </button>
                        <button
                          onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                          className={`rounded-lg py-2.5 px-2 ${
                            isBetInSlip(game, 'moneyline', game.homeTeam) 
                              ? 'bg-green-600 border border-green-500' 
                              : 'bg-[#1a1a1a] border border-gray-700'
                          }`}
                        >
                          <div className="text-gray-400 text-[10px] uppercase mb-1">ML</div>
                          <OddsDisplay odds={game.lines.moneyline.home} isSelected={isBetInSlip(game, 'moneyline', game.homeTeam)} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
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
      </div>

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
