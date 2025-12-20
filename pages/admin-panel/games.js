import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [sportFilter, setSportFilter] = useState('all');
  const [creditStatus, setCreditStatus] = useState(null);
  const [historicalPulls, setHistoricalPulls] = useState([]);
  const [selectedPullId, setSelectedPullId] = useState('');
  const [savingPull, setSavingPull] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Adaptive polling
  const pollingIntervalRef = useRef(null);
  const currentIntervalRef = useRef(12000);

  useEffect(() => {
    fetchGames();
    fetchHistoricalPulls();
    
    // Start with 12 second polling, will adjust based on server response
    pollingIntervalRef.current = setInterval(fetchGames, 12000);
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games?debug=true');
      if (res.ok) {
        const data = await res.json();
        setGames([...(data.games || [])]);
        setCreditStatus(data.creditStatus);
        
        // Adaptive polling - adjust interval based on server recommendation
        const recommendedInterval = data.polling?.recommendedInterval || 60000;
        if (recommendedInterval !== currentIntervalRef.current) {
          console.log(`[ADMIN] Adjusting polling: ${currentIntervalRef.current}ms -> ${recommendedInterval}ms`);
          currentIntervalRef.current = recommendedInterval;
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          pollingIntervalRef.current = setInterval(fetchGames, recommendedInterval);
        }
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalPulls = async () => {
    try {
      const res = await fetch('/api/admin-panel/odds-history?action=list');
      if (res.ok) {
        const data = await res.json();
        setHistoricalPulls(data.pulls || []);
      }
    } catch (error) {
      console.error('Failed to fetch historical pulls:', error);
    }
  };

  const saveCurrentPull = async () => {
    if (games.length === 0) return;
    setSavingPull(true);
    try {
      const res = await fetch('/api/admin-panel/odds-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          games: games,
          creditUsed: creditStatus?.used || 0,
        }),
      });
      if (res.ok) {
        fetchHistoricalPulls();
        alert('Current odds saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save pull:', error);
      alert('Failed to save odds data');
    } finally {
      setSavingPull(false);
    }
  };

  const downloadPull = async () => {
    if (!selectedPullId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin-panel/odds-history?action=download&pullId=${selectedPullId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `odds_pull_${selectedPullId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Failed to download:', error);
      alert('Failed to download Excel file');
    } finally {
      setDownloading(false);
    }
  };

  const filteredGames = games.filter(game => {
    if (sportFilter === 'all') return true;
    return game.sportName === sportFilter;
  });

  const sports = [...new Set(games.map(g => g.sportName))];

  const formatOdds = (odds) => {
    if (odds == null) return '-';
    return odds > 0 ? `+${odds}` : odds;
  };

  const formatSpread = (point) => {
    if (point == null) return '-';
    return point > 0 ? `+${point}` : point;
  };

  const getBookmakers = (game) => {
    if (!game.allBookmakerOdds) return [];
    return Object.keys(game.allBookmakerOdds).sort();
  };

  const formatPullDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <AdminLayout title="Games & Odds">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Games & Odds Management</h1>
        <p className="text-gray-400 mt-1">View all games and compare odds across bookmakers</p>
        {creditStatus && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">API Credits Used Today</span>
              <span className="text-white font-bold">{creditStatus.used} / {creditStatus.budget}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${creditStatus.percentUsed > 90 ? 'bg-red-500' : creditStatus.percentUsed > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${creditStatus.percentUsed}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Historical Odds Downloads</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm text-gray-400 mb-1">Select Historical Pull</label>
            <select
              value={selectedPullId}
              onChange={(e) => setSelectedPullId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select a pull to download --</option>
              {historicalPulls.map(pull => (
                <option key={pull.id} value={pull.id}>
                  {formatPullDate(pull.pulledAt)} - {pull.gamesCount} games
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={downloadPull}
            disabled={!selectedPullId || downloading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
          >
            {downloading ? (
              <>
                <span className="animate-spin">⏳</span> Downloading...
              </>
            ) : (
              <>📥 Download Excel</>
            )}
          </button>
          <button
            onClick={saveCurrentPull}
            disabled={games.length === 0 || savingPull}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
          >
            {savingPull ? (
              <>
                <span className="animate-spin">⏳</span> Saving...
              </>
            ) : (
              <>💾 Save Current Pull</>
            )}
          </button>
        </div>
        {historicalPulls.length === 0 && (
          <p className="text-gray-500 text-sm mt-2">No historical pulls saved yet. Click "Save Current Pull" to save the current odds data.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Sports</option>
          {sports.map(sport => (
            <option key={sport} value={sport}>{sport}</option>
          ))}
        </select>
        <button
          onClick={fetchGames}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
        >
          Refresh Games
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading games...</p>
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Sport</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Matchup</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Time</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Spread Source</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">ML Source</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Total Source</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Bookmakers</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredGames.map((game) => (
                <tr key={game.id} className="hover:bg-gray-700/20 transition">
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                      {game.sportName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    {game.awayTeam} @ {game.homeTeam}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{game.time}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${game.lines?.spread?.home?.source === 'FanDuel' ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                      {game.lines?.spread?.home?.source || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${game.lines?.moneyline?.homeSource === 'FanDuel' ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                      {game.lines?.moneyline?.homeSource || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${game.lines?.total?.over?.source === 'FanDuel' ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
                      {game.lines?.total?.over?.source || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {getBookmakers(game).length}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedGame(game)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                    >
                      View Odds
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredGames.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No games found for today
            </div>
          )}
        </div>
      )}

      {selectedGame && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedGame.awayTeamFull} @ {selectedGame.homeTeamFull}
                </h2>
                <p className="text-gray-400">{selectedGame.sportName} - {selectedGame.time}</p>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">Current Display Odds (from priority bookmaker)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-700/30 rounded">
                    <div className="text-gray-400 text-sm mb-1">Spread</div>
                    <div className="text-white font-bold">
                      {selectedGame.lines?.spread?.away?.point} ({formatOdds(selectedGame.lines?.spread?.away?.odds)})
                    </div>
                    <div className="text-gray-500 text-xs">{selectedGame.lines?.spread?.away?.source}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700/30 rounded">
                    <div className="text-gray-400 text-sm mb-1">Moneyline</div>
                    <div className="text-white font-bold">
                      Away: {formatOdds(selectedGame.lines?.moneyline?.away)} / Home: {formatOdds(selectedGame.lines?.moneyline?.home)}
                    </div>
                    <div className="text-gray-500 text-xs">{selectedGame.lines?.moneyline?.awaySource}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700/30 rounded">
                    <div className="text-gray-400 text-sm mb-1">Total</div>
                    <div className="text-white font-bold">
                      {selectedGame.lines?.total?.over?.point} ({formatOdds(selectedGame.lines?.total?.over?.odds)})
                    </div>
                    <div className="text-gray-500 text-xs">{selectedGame.lines?.total?.over?.source}</div>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">All Bookmaker Odds Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium sticky left-0 bg-gray-800">Bookmaker</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium" colSpan="2">Spread Away</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium" colSpan="2">Spread Home</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium">ML Away</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium">ML Home</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium" colSpan="2">Over</th>
                      <th className="px-3 py-2 text-center text-gray-400 font-medium" colSpan="2">Under</th>
                    </tr>
                    <tr className="text-xs text-gray-500">
                      <th className="px-3 py-1 sticky left-0 bg-gray-800"></th>
                      <th className="px-3 py-1">Point</th>
                      <th className="px-3 py-1">Odds</th>
                      <th className="px-3 py-1">Point</th>
                      <th className="px-3 py-1">Odds</th>
                      <th className="px-3 py-1">Odds</th>
                      <th className="px-3 py-1">Odds</th>
                      <th className="px-3 py-1">Point</th>
                      <th className="px-3 py-1">Odds</th>
                      <th className="px-3 py-1">Point</th>
                      <th className="px-3 py-1">Odds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {getBookmakers(selectedGame).map((bookmaker) => {
                      const odds = selectedGame.allBookmakerOdds[bookmaker];
                      const isFanDuel = bookmaker === 'FanDuel';
                      return (
                        <tr key={bookmaker} className={`${isFanDuel ? 'bg-green-900/20' : 'hover:bg-gray-700/20'}`}>
                          <td className={`px-3 py-2 font-medium sticky left-0 ${isFanDuel ? 'bg-green-900/40 text-green-400' : 'bg-gray-900 text-white'}`}>
                            {bookmaker}
                            {isFanDuel && <span className="ml-2 text-xs bg-green-600 px-1 rounded">Primary</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatSpread(odds?.spreads?.away?.point)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.spreads?.away?.odds)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatSpread(odds?.spreads?.home?.point)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.spreads?.home?.odds)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.moneyline?.away)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.moneyline?.home)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{odds?.totals?.over?.point || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.totals?.over?.odds)}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{odds?.totals?.under?.point || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{formatOdds(odds?.totals?.under?.odds)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {getBookmakers(selectedGame).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No bookmaker odds data available for this game
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
