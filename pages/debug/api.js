import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function APIDebug() {
  const [nbaGames, setNbaGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    endpoint: { status: 'pending', message: 'Checking...' },
    games: { status: 'pending', message: 'Checking...' },
    oddsEndpoint: { status: 'pending', message: 'Checking...' },
    spreads: { status: 'pending', message: 'Checking...' },
    moneylines: { status: 'pending', message: 'Checking...' },
    totals: { status: 'pending', message: 'Checking...' },
    teamNames: { status: 'pending', message: 'Checking...' },
    gameTimes: { status: 'pending', message: 'Checking...' },
  });
  const [apiTier, setApiTier] = useState(null);

  const analyzeData = (games, responseOk, debugInfo) => {
    const newStatus = {};
    
    newStatus.endpoint = responseOk 
      ? { status: 'success', message: 'Games API responding (200 OK)' }
      : { status: 'error', message: 'Games API request failed' };
    
    newStatus.games = games.length > 0
      ? { status: 'success', message: `${games.length} games loaded` }
      : { status: 'warning', message: 'No games returned' };
    
    const oddsStatus = debugInfo?.oddsStatus;
    if (oddsStatus?.code === 200) {
      newStatus.oddsEndpoint = { status: 'success', message: 'Odds API responding (200 OK)' };
    } else if (oddsStatus?.code === 403) {
      newStatus.oddsEndpoint = { status: 'error', message: '403 Forbidden - CORE tier. Upgrade to PRO required.' };
    } else if (oddsStatus?.code) {
      newStatus.oddsEndpoint = { status: 'error', message: `HTTP ${oddsStatus.code}: ${oddsStatus.message}` };
    } else {
      newStatus.oddsEndpoint = { status: 'warning', message: 'Odds endpoint not checked' };
    }
    
    if (debugInfo?.apiTier) {
      setApiTier(debugInfo.apiTier);
    }
    
    const gamesWithSpreads = games.filter(g => 
      g.lines?.spread?.away?.point && g.lines?.spread?.away?.point !== '+0'
    );
    newStatus.spreads = gamesWithSpreads.length > 0
      ? { status: 'success', message: `${gamesWithSpreads.length}/${games.length} games have spread data` }
      : { status: 'warning', message: 'No spread data (using defaults)' };
    
    const gamesWithML = games.filter(g => 
      g.lines?.moneyline?.away && g.lines?.moneyline?.away !== 150
    );
    newStatus.moneylines = gamesWithML.length > 0
      ? { status: 'success', message: `${gamesWithML.length}/${games.length} games have moneyline data` }
      : { status: 'warning', message: 'No moneyline data (using defaults)' };
    
    const gamesWithTotals = games.filter(g => 
      g.lines?.total?.over?.point && g.lines?.total?.over?.point !== 'O 220.5'
    );
    newStatus.totals = gamesWithTotals.length > 0
      ? { status: 'success', message: `${gamesWithTotals.length}/${games.length} games have totals data` }
      : { status: 'warning', message: 'No totals data (using defaults)' };
    
    const gamesWithTeamNames = games.filter(g => 
      g.awayTeamFull && g.awayTeamFull !== 'Away Team'
    );
    newStatus.teamNames = gamesWithTeamNames.length > 0
      ? { status: 'success', message: `${gamesWithTeamNames.length}/${games.length} games have full team names` }
      : { status: 'warning', message: 'Full team names not available' };
    
    const gamesWithTimes = games.filter(g => g.time && g.time !== '');
    newStatus.gameTimes = gamesWithTimes.length > 0
      ? { status: 'success', message: `${gamesWithTimes.length}/${games.length} games have scheduled times` }
      : { status: 'warning', message: 'Game times not available' };
    
    setApiStatus(newStatus);
  };

  const fetchData = async () => {
    setLoading(true);
    setApiTier(null);
    setApiStatus({
      endpoint: { status: 'pending', message: 'Checking...' },
      games: { status: 'pending', message: 'Checking...' },
      oddsEndpoint: { status: 'pending', message: 'Checking...' },
      spreads: { status: 'pending', message: 'Checking...' },
      moneylines: { status: 'pending', message: 'Checking...' },
      totals: { status: 'pending', message: 'Checking...' },
      teamNames: { status: 'pending', message: 'Checking...' },
      gameTimes: { status: 'pending', message: 'Checking...' },
    });
    
    try {
      const response = await fetch('/api/games/nba?upcoming=true&debug=true');
      const data = await response.json();
      const games = data.games || [];
      setNbaGames(games);
      setRawData(data);
      setLastUpdated(new Date().toLocaleString());
      setError(null);
      analyzeData(games, response.ok, data.debugInfo);
    } catch (err) {
      setError(err.message);
      setApiStatus({
        endpoint: { status: 'error', message: `Failed: ${err.message}` },
        games: { status: 'error', message: 'Could not fetch' },
        oddsEndpoint: { status: 'error', message: 'Could not fetch' },
        spreads: { status: 'error', message: 'Could not fetch' },
        moneylines: { status: 'error', message: 'Could not fetch' },
        totals: { status: 'error', message: 'Could not fetch' },
        teamNames: { status: 'error', message: 'Could not fetch' },
        gameTimes: { status: 'error', message: 'Could not fetch' },
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const StatusBadge = ({ status }) => {
    const colors = {
      success: 'bg-green-600 text-white',
      warning: 'bg-yellow-600 text-black',
      error: 'bg-red-600 text-white',
      pending: 'bg-gray-600 text-white animate-pulse',
    };
    const icons = {
      success: '✓',
      warning: '⚠',
      error: '✗',
      pending: '...',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold ${colors[status]}`}>
        {icons[status]}
      </span>
    );
  };

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
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {apiTier && (
          <div className={`rounded-lg p-4 mb-6 border ${
            apiTier.includes('PRO') ? 'bg-green-900/30 border-green-500' : 'bg-yellow-900/30 border-yellow-500'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`text-2xl ${apiTier.includes('PRO') ? 'text-green-400' : 'text-yellow-400'}`}>
                {apiTier.includes('PRO') ? '✓' : '⚠'}
              </span>
              <div>
                <div className="font-semibold">MySportsFeeds API Tier</div>
                <div className={`text-sm ${apiTier.includes('PRO') ? 'text-green-300' : 'text-yellow-300'}`}>
                  {apiTier}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">API Status Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(apiStatus).map(([key, value]) => (
              <div key={key} className="bg-gray-700/50 rounded-lg p-3 flex items-center gap-3">
                <StatusBadge status={value.status} />
                <div>
                  <div className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-xs text-gray-400">{value.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">NBA Games ({nbaGames.length} games)</h2>
          
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : nbaGames.length === 0 ? (
            <div className="text-gray-400">No games available</div>
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
            <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-xs text-gray-300 max-h-96 overflow-y-auto">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}