import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import BasketballCourt from '../components/BasketballCourt';

export default function TestCourt() {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPlayByPlay = useCallback(async () => {
    try {
      const res = await fetch('/api/goalserve/playbyplay?sport=basketball_nba');
      const data = await res.json();
      
      if (data.success && data.games) {
        setGames(data.games);
        
        if (data.games.length > 0) {
          const gameToShow = selectedGame 
            ? data.games.find(g => g.id === selectedGame.id) || data.games[0]
            : data.games[0];
          
          setSelectedGame(gameToShow);
          setPlays(gameToShow.plays || []);
        }
        setLastUpdate(new Date());
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGame]);

  useEffect(() => {
    fetchPlayByPlay();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchPlayByPlay, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchPlayByPlay, autoRefresh]);

  const handleGameSelect = (game) => {
    setSelectedGame(game);
    setPlays(game.plays || []);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <Head>
        <title>Live Court Widget - Piks</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Live Court Widget</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-400">Auto-refresh (5s)</span>
            </label>
            <button
              onClick={fetchPlayByPlay}
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 transition"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading live games...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-xl">
            <p className="text-gray-400 text-lg">No live NBA games right now</p>
            <p className="text-gray-500 text-sm mt-2">Check back during game time</p>
          </div>
        ) : (
          <>
            {games.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleGameSelect(game)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                      selectedGame?.id === game.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {game.away_team_abbr} @ {game.home_team_abbr}
                  </button>
                ))}
              </div>
            )}

            {selectedGame && (
              <div className="bg-gray-900 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center flex-1">
                    <p className="text-gray-400 text-sm">{selectedGame.away_team}</p>
                    <p className="text-4xl font-bold">{selectedGame.scores?.away?.total || 0}</p>
                  </div>
                  <div className="text-center px-6">
                    <p className="text-xs text-gray-500 uppercase">{selectedGame.status}</p>
                    <p className="text-lg font-mono text-green-400">{selectedGame.timer}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-gray-400 text-sm">{selectedGame.home_team}</p>
                    <p className="text-4xl font-bold">{selectedGame.scores?.home?.total || 0}</p>
                  </div>
                </div>

                <BasketballCourt plays={plays} />

                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Recent Plays</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {plays.slice().reverse().slice(0, 10).map((play, idx) => (
                      <div
                        key={`${play.timestamp}-${idx}`}
                        className={`p-3 rounded-lg text-sm ${
                          idx === 0 ? 'bg-blue-900/50 border border-blue-500' : 'bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">{play.time} - {play.period}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            play.isScoring ? 'bg-green-600' :
                            play.isShooting ? 'bg-amber-600' :
                            'bg-gray-600'
                          }`}>
                            {play.type}
                          </span>
                        </div>
                        <p className="mt-1">{play.description}</p>
                        {play.x !== null && play.y !== null && (
                          <p className="text-xs text-gray-500 mt-1">
                            Court position: ({play.x}, {play.y})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {lastUpdate && (
          <p className="text-center text-gray-500 text-xs">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
