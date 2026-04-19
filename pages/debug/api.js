import { useState, useEffect } from 'react';
import Head from 'next/head';

const SPORTS = [
  { key: 'basketball_nba', name: 'NBA' },
  { key: 'americanfootball_nfl', name: 'NFL' },
  { key: 'basketball_ncaab', name: 'NCAAB' },
  { key: 'americanfootball_ncaaf', name: 'NCAAF' },
  { key: 'baseball_mlb', name: 'MLB' },
  { key: 'icehockey_nhl', name: 'NHL' }
];

export default function APIDebug() {
  const [games, setGames] = useState([]);
  const [bySport, setBySport] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [creditStatus, setCreditStatus] = useState(null);
  const [selectedSport, setSelectedSport] = useState('all');
  const [apiStatus, setApiStatus] = useState({
    endpoint: { status: 'pending', message: 'Checking...' },
    games: { status: 'pending', message: 'Checking...' },
    credits: { status: 'pending', message: 'Checking...' },
    spreads: { status: 'pending', message: 'Checking...' },
    moneylines: { status: 'pending', message: 'Checking...' },
    totals: { status: 'pending', message: 'Checking...' },
    teamNames: { status: 'pending', message: 'Checking...' },
    gameTimes: { status: 'pending', message: 'Checking...' },
  });

  const analyzeData = (allGames, responseOk, credit) => {
    const newStatus = {};
    
    newStatus.endpoint = responseOk 
      ? { status: 'success', message: 'The Odds API responding (200 OK)' }
      : { status: 'error', message: 'Games API request failed' };
    
    newStatus.games = allGames.length > 0
      ? { status: 'success', message: `${allGames.length} games loaded across all sports` }
      : { status: 'warning', message: 'No games returned' };
    
    if (credit) {
      const percentUsed = credit.percentUsed || 0;
      if (percentUsed >= 90) {
        newStatus.credits = { status: 'error', message: `${credit.used}/${credit.budget} daily credits (${percentUsed}%)` };
      } else if (percentUsed >= 70) {
        newStatus.credits = { status: 'warning', message: `${credit.used}/${credit.budget} daily credits (${percentUsed}%)` };
      } else {
        newStatus.credits = { status: 'success', message: `${credit.used}/${credit.budget} daily credits (${percentUsed}%)` };
      }
    }
    
    const gamesWithSpreads = allGames.filter(g => 
      g.lines?.spread?.away?.point && g.lines?.spread?.away?.point !== '+0'
    );
    newStatus.spreads = gamesWithSpreads.length > 0
      ? { status: 'success', message: `${gamesWithSpreads.length}/${allGames.length} games have spread data` }
      : { status: 'warning', message: 'No spread data (using defaults)' };
    
    const gamesWithML = allGames.filter(g => 
      g.lines?.moneyline?.away && g.lines?.moneyline?.away !== 150
    );
    newStatus.moneylines = gamesWithML.length > 0
      ? { status: 'success', message: `${gamesWithML.length}/${allGames.length} games have moneyline data` }
      : { status: 'warning', message: 'No moneyline data (using defaults)' };
    
    const gamesWithTotals = allGames.filter(g => 
      g.lines?.total?.over?.point && g.lines?.total?.over?.point !== 'O 220.5'
    );
    newStatus.totals = gamesWithTotals.length > 0
      ? { status: 'success', message: `${gamesWithTotals.length}/${allGames.length} games have totals data` }
      : { status: 'warning', message: 'No totals data (using defaults)' };
    
    const gamesWithTeamNames = allGames.filter(g => 
      g.awayTeamFull && g.awayTeamFull !== 'Away Team'
    );
    newStatus.teamNames = gamesWithTeamNames.length > 0
      ? { status: 'success', message: `${gamesWithTeamNames.length}/${allGames.length} games have full team names` }
      : { status: 'warning', message: 'Full team names not available' };
    
    const gamesWithTimes = allGames.filter(g => g.time && g.time !== '');
    newStatus.gameTimes = gamesWithTimes.length > 0
      ? { status: 'success', message: `${gamesWithTimes.length}/${allGames.length} games have scheduled times` }
      : { status: 'warning', message: 'Game times not available' };
    
    setApiStatus(newStatus);
  };

  const fetchData = async (refresh = false) => {
    setLoading(true);
    setApiStatus({
      endpoint: { status: 'pending', message: 'Checking...' },
      games: { status: 'pending', message: 'Checking...' },
      credits: { status: 'pending', message: 'Checking...' },
      spreads: { status: 'pending', message: 'Checking...' },
      moneylines: { status: 'pending', message: 'Checking...' },
      totals: { status: 'pending', message: 'Checking...' },
      teamNames: { status: 'pending', message: 'Checking...' },
      gameTimes: { status: 'pending', message: 'Checking...' },
    });
    
    try {
      const url = `/api/games?debug=true${refresh ? '&refresh=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      const allGames = data.games || [];
      setGames(allGames);
      setBySport(data.bySport || {});
      setCreditStatus(data.creditStatus);
      setRawData(data);
      setLastUpdated(new Date().toLocaleString());
      setError(null);
      analyzeData(allGames, response.ok, data.creditStatus);
    } catch (err) {
      setError(err.message);
      setApiStatus({
        endpoint: { status: 'error', message: `Failed: ${err.message}` },
        games: { status: 'error', message: 'Could not fetch' },
        credits: { status: 'error', message: 'Could not fetch' },
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

  const filteredGames = selectedSport === 'all' 
    ? games 
    : games.filter(g => g.sport === selectedSport);

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
              onClick={() => fetchData(false)}
              disabled={loading}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Check Cache'}
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Force Refresh (uses credits)
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {creditStatus && (
          <div className={`rounded-lg p-4 mb-6 border ${
            creditStatus.percentUsed >= 90 ? 'bg-red-900/30 border-red-500' :
            creditStatus.percentUsed >= 70 ? 'bg-yellow-900/30 border-yellow-500' :
            'bg-green-900/30 border-green-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${
                  creditStatus.percentUsed >= 90 ? 'text-red-400' :
                  creditStatus.percentUsed >= 70 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {creditStatus.percentUsed >= 90 ? '⚠' : creditStatus.percentUsed >= 70 ? '⚡' : '✓'}
                </span>
                <div>
                  <div className="font-semibold">Daily Credit Budget</div>
                  <div className="text-sm text-gray-300">
                    {creditStatus.used} / {creditStatus.budget} credits used today ({creditStatus.percentUsed}%)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{creditStatus.remaining}</div>
                <div className="text-xs text-gray-400">remaining</div>
              </div>
            </div>
            <div className="mt-3 bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  creditStatus.percentUsed >= 90 ? 'bg-red-500' :
                  creditStatus.percentUsed >= 70 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(creditStatus.percentUsed, 100)}%` }}
              />
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

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Sports Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {SPORTS.map(sport => {
              const sportData = bySport[sport.key] || { count: 0, fromCache: true };
              return (
                <div 
                  key={sport.key} 
                  className={`rounded-lg p-3 cursor-pointer transition-all ${
                    selectedSport === sport.key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedSport(selectedSport === sport.key ? 'all' : sport.key)}
                >
                  <div className="text-lg font-bold">{sport.name}</div>
                  <div className="text-2xl font-bold">{sportData.count}</div>
                  <div className="text-xs text-gray-400">
                    {sportData.fromCache ? '(cached)' : '(fresh)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {selectedSport === 'all' ? 'All Games' : SPORTS.find(s => s.key === selectedSport)?.name} 
              {' '}({filteredGames.length} games)
            </h2>
            {selectedSport !== 'all' && (
              <button 
                onClick={() => setSelectedSport('all')}
                className="text-sm text-gray-400 hover:text-white"
              >
                Show all sports
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : filteredGames.length === 0 ? (
            <div className="text-gray-400">No games available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Sport</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Time</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Spread Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Spread Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">ML Away</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">ML Home</th>
                    <th className="border border-gray-700 px-3 py-2 text-left text-xs">Total O/U</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.slice(0, 50).map((game) => (
                    <tr key={game.id} className="hover:bg-gray-800/50">
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className="bg-gray-700 px-2 py-0.5 rounded">{game.sportName}</span>
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className="font-medium">{game.awayTeam}</span>
                        <span className="text-gray-500 ml-1 text-[10px]">({game.awayTeamFull})</span>
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">
                        <span className="font-medium">{game.homeTeam}</span>
                        <span className="text-gray-500 ml-1 text-[10px]">({game.homeTeamFull})</span>
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs">{game.time}</td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.spread?.away?.point} ({game.lines?.spread?.away?.odds})
                        {game.lines?.spread?.away?.source && game.lines?.spread?.away?.source !== 'default' && (
                          <span className="text-gray-500 text-[9px] block">{game.lines?.spread?.away?.source}</span>
                        )}
                      </td>
                      <td className="border border-gray-700 px-3 py-2 text-xs font-mono">
                        {game.lines?.spread?.home?.point} ({game.lines?.spread?.home?.odds})
                        {game.lines?.spread?.home?.source && game.lines?.spread?.home?.source !== 'default' && (
                          <span className="text-gray-500 text-[9px] block">{game.lines?.spread?.home?.source}</span>
                        )}
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
              {filteredGames.length > 50 && (
                <p className="text-gray-500 text-sm mt-2">Showing first 50 of {filteredGames.length} games</p>
              )}
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
