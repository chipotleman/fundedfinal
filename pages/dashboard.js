
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [selectedSport, setSelectedSport] = useState('ALL');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const { betSlip, addToBetSlip, removeBet, clearBetSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const router = useRouter();

  useEffect(() => {
    // Fetch games based on selected sport (using mock data for now)
    const fetchGames = async () => {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockGames = {
        'NFL': [
          {
            id: 1,
            awayTeam: { name: 'LA Chargers', logo: '/logos/lac.png' },
            homeTeam: { name: 'Detroit Lions', logo: '/logos/det.png' },
            time: '1:00 PM ET',
            sport: 'NFL',
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
            awayTeam: { name: 'Lakers', logo: '/logos/lal.png' },
            homeTeam: { name: 'Warriors', logo: '/logos/gsw.png' },
            time: '10:00 PM ET',
            sport: 'NBA',
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
            awayTeam: { name: 'Yankees', logo: '/logos/nyy.png' },
            homeTeam: { name: 'Red Sox', logo: '/logos/bos.png' },
            time: '7:30 PM ET',
            sport: 'MLB',
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
            awayTeam: { name: 'Rangers', logo: '/logos/nyr.png' },
            homeTeam: { name: 'Bruins', logo: '/logos/bos.png' },
            time: '8:00 PM ET',
            sport: 'NHL',
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
            awayTeam: { name: 'Fighter A', logo: '/logos/ufc.png' },
            homeTeam: { name: 'Fighter B', logo: '/logos/ufc.png' },
            time: '10:00 PM ET',
            sport: 'UFC',
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
            awayTeam: { name: 'Manchester United', logo: '/logos/mu.png' },
            homeTeam: { name: 'Liverpool', logo: '/logos/lfc.png' },
            time: '12:30 PM ET',
            sport: 'Soccer',
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

      // Sport selection filter
      const sportFilter = (games) => {
        return games.filter(game => selectedSport === 'ALL' || game.sport === selectedSport);
      };

      if (selectedSport === 'ALL') {
        // Combine all sports
        setGames(Object.values(mockGames).flat());
      } else {
        setGames(mockGames[selectedSport] || []);
      }
      setLoading(false);
    };

    fetchGames();
  }, [selectedSport]);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer'];

  const filteredGames = games.filter(game => selectedSport === 'ALL' || game.sport === selectedSport);

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        bankroll={bankroll} 
        pnl={pnl} 
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(true)}
      />

      {/* Main Content */}
      <div className="pt-24 sm:pt-28 lg:pt-32 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white leading-tight">
            {selectedSport} Betting
          </h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="bg-slate-800 px-4 py-3 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm sm:text-base whitespace-nowrap">Live Lines</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sport Selection */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setSelectedSport('ALL')}
              className={`px-4 py-2 rounded-full font-medium transition-all duration-200 text-sm sm:text-base ${
                selectedSport === 'ALL'
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              All Sports
            </button>
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-4 py-2 rounded-full font-medium transition-all duration-200 text-sm sm:text-base ${
                  selectedSport === sport
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg">Loading games...</p>
            </div>
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredGames.map((game) => (
              <div key={game.id} className="bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden hover:bg-slate-700 transition-all duration-300 hover:shadow-xl">
                {/* Game Header */}
                <div className="p-4 sm:p-6 border-b border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider">
                      {game.sport} • {game.time}
                    </span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400 font-medium">LIVE</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                      <span className="text-white font-bold text-sm sm:text-base">{game.awayTeam.name}</span>
                    </div>
                    <span className="text-gray-400 text-xs sm:text-sm">@</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-bold text-sm sm:text-base">{game.homeTeam.name}</span>
                      <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                    </div>
                  </div>
                </div>

                {/* Betting Options */}
                <div className="p-4 sm:p-6">
                  {/* Headers */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                    <div className="text-center text-xs sm:text-sm text-gray-400 font-medium">Moneyline</div>
                    <div className="text-center text-xs sm:text-sm text-gray-400 font-medium">Spread</div>
                    <div className="text-center text-xs sm:text-sm text-gray-400 font-medium">Total</div>
                  </div>
                  
                  {/* Away Team */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.moneyline.away > 0 ? `+${game.lines.moneyline.away}` : game.lines.moneyline.away}
                    </button>
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.spread.away.point} ({game.lines.spread.away.odds > 0 ? `+${game.lines.spread.away.odds}` : game.lines.spread.away.odds})
                    </button>
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.total.over.point} ({game.lines.total.over.odds > 0 ? `+${game.lines.total.over.odds}` : game.lines.total.over.odds})
                    </button>
                  </div>
                  
                  {/* Home Team */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.moneyline.home > 0 ? `+${game.lines.moneyline.home}` : game.lines.moneyline.home}
                    </button>
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.spread.home.point} ({game.lines.spread.home.odds > 0 ? `+${game.lines.spread.home.odds}` : game.lines.spread.home.odds})
                    </button>
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm">
                      {game.lines.total.under.point} ({game.lines.total.under.odds > 0 ? `+${game.lines.total.under.odds}` : game.lines.total.under.odds})
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-center items-center py-20">
            <div className="text-center text-gray-400">
              <p className="text-lg">No games available for {selectedSport}</p>
            </div>
          </div>
        )}
      </div>

      {showBetSlip && <BetSlip onClose={() => setShowBetSlip(false)} />}
    </div>
  );
}
