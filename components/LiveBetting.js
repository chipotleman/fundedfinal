
import { useState, useEffect } from 'react';

export default function LiveBetting({ onAddToBetSlip }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch('/api/fetch-slates');
      if (!response.ok) throw new Error('Failed to fetch games');
      const data = await response.json();
      setGames(data.events || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching games:', err);
      setError(err.message);
      // Use mock data when API fails
      setGames([
        {
          id: 'mock-1',
          awayTeam: 'Lakers',
          homeTeam: 'Warriors',
          date: new Date().toISOString(),
          status: 'live',
          lines: {
            spread: {
              away: { point: '+3.5', odds: -110 },
              home: { point: '-3.5', odds: -110 }
            },
            moneyline: {
              away: 140,
              home: -160
            },
            total: {
              over: { point: '215.5', odds: -110 },
              under: { point: '215.5', odds: -110 }
            }
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const handleBetClick = (game, betType, odds, description) => {
    const bet = {
      id: `${game.id}-${betType}-${description}`,
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      selection: description,
      odds,
      stake: 0,
      isLive: true
    };
    onAddToBetSlip(bet);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        <h2 className="text-2xl font-bold text-white">Live Betting</h2>
        <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
          LIVE
        </span>
      </div>

      <div className="space-y-6">
        {games.map((game) => (
          <div key={game.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Game Header */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-white font-bold text-lg">
                    {game.awayTeam} @ {game.homeTeam}
                  </div>
                  {game.status === 'live' && (
                    <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="text-gray-400 text-sm">
                  {new Date(game.date).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Clean Betting Layout */}
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                
                {/* Spread Column */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h4 className="text-gray-400 text-sm font-medium mb-3">Point Spread</h4>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-blue-500/20 border border-slate-600 hover:border-blue-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">{game.awayTeam}</div>
                        <div className="text-white font-bold">{game.lines.spread.away.point}</div>
                        <div className="text-gray-400 text-xs">{formatOdds(game.lines.spread.away.odds)}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'spread', game.lines.spread.home.odds, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-blue-500/20 border border-slate-600 hover:border-blue-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">{game.homeTeam}</div>
                        <div className="text-white font-bold">{game.lines.spread.home.point}</div>
                        <div className="text-gray-400 text-xs">{formatOdds(game.lines.spread.home.odds)}</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Moneyline Column */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h4 className="text-gray-400 text-sm font-medium mb-3">Moneyline</h4>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'moneyline', game.lines.moneyline.away, `${game.awayTeam} ML`)}
                      className="w-full bg-slate-700/50 hover:bg-green-500/20 border border-slate-600 hover:border-green-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">{game.awayTeam}</div>
                        <div className="text-white font-bold">{formatOdds(game.lines.moneyline.away)}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'moneyline', game.lines.moneyline.home, `${game.homeTeam} ML`)}
                      className="w-full bg-slate-700/50 hover:bg-green-500/20 border border-slate-600 hover:border-green-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">{game.homeTeam}</div>
                        <div className="text-white font-bold">{formatOdds(game.lines.moneyline.home)}</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Total Column */}
                <div className="space-y-3">
                  <div className="text-center">
                    <h4 className="text-gray-400 text-sm font-medium mb-3">Total Points</h4>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-purple-500/20 border border-slate-600 hover:border-purple-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">Over</div>
                        <div className="text-white font-bold">{game.lines.total.over.point}</div>
                        <div className="text-gray-400 text-xs">{formatOdds(game.lines.total.over.odds)}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'total', game.lines.total.under.odds, `Under ${game.lines.total.under.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-purple-500/20 border border-slate-600 hover:border-purple-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="text-center">
                        <div className="text-white font-semibold text-sm">Under</div>
                        <div className="text-white font-bold">{game.lines.total.under.point}</div>
                        <div className="text-gray-400 text-xs">{formatOdds(game.lines.total.under.odds)}</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">
            Live betting temporarily unavailable. Showing demo data.
          </p>
        </div>
      )}
    </div>
  );
}
