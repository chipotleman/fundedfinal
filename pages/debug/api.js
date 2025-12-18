import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function APIDebug() {
  const [nbaGames, setNbaGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/games/nba?upcoming=true');
      const data = await response.json();
      setNbaGames(data.games || []);
      setRawData(data);
      setLastUpdated(new Date().toLocaleString());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Head>
        <title>API Debug - Piks</title>
      </Head>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">API Debug Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">Last updated: {lastUpdated}</span>
            <button
              onClick={fetchData}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">NBA Games ({nbaGames.length} games)</h2>
          
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">ID</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Time</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Status</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Score</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Spread Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Spread Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">ML Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">ML Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Total O/U</th>
                  </tr>
                </thead>
                <tbody>
                  {nbaGames.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-800/50">
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">{game.id}</td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className="font-medium">{game.awayTeam}</span>
                        {game.awayTeamFull && game.awayTeamFull !== 'Away Team' && (
                          <span className="text-gray-500 ml-1">({game.awayTeamFull})</span>
                        )}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className="font-medium">{game.homeTeam}</span>
                        {game.homeTeamFull && game.homeTeamFull !== 'Home Team' && (
                          <span className="text-gray-500 ml-1">({game.homeTeamFull})</span>
                        )}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">{game.time}</td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          game.isLive ? 'bg-green-600' : 
                          game.isCompleted ? 'bg-gray-600' : 
                          'bg-blue-600'
                        }`}>
                          {game.status || 'UNPLAYED'}
                        </span>
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        {game.awayScore}-{game.homeScore}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.spread?.away?.point} ({game.lines?.spread?.away?.odds})
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.spread?.home?.point} ({game.lines?.spread?.home?.odds})
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.moneyline?.away > 0 ? '+' : ''}{game.lines?.moneyline?.away}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.moneyline?.home > 0 ? '+' : ''}{game.lines?.moneyline?.home}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.total?.over?.point} / {game.lines?.total?.under?.point}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium mb-4"
          >
            {showRaw ? 'Hide' : 'Show'} Raw JSON
          </button>
          
          {showRaw && rawData && (
            <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-xs text-gray-300">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}