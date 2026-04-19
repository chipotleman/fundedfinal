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
  const pollingIntervalRef = useRef(null);
  const currentIntervalRef = useRef(12000);

  useEffect(() => {
    fetchGames();
    fetchHistoricalPulls();
    pollingIntervalRef.current = setInterval(fetchGames, 12000);
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, []);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games?debug=true');
      if (res.ok) {
        const data = await res.json();
        setGames([...(data.games || [])]);
        setCreditStatus(data.creditStatus);
        const recommendedInterval = data.polling?.recommendedInterval || 60000;
        if (recommendedInterval !== currentIntervalRef.current) {
          currentIntervalRef.current = recommendedInterval;
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = setInterval(fetchGames, recommendedInterval);
        }
      }
    } catch (error) { console.error('Failed to fetch games:', error); }
    finally { setLoading(false); }
  };

  const fetchHistoricalPulls = async () => {
    try {
      const res = await fetch('/api/admin-panel/odds-history?action=list');
      if (res.ok) { const data = await res.json(); setHistoricalPulls(data.pulls || []); }
    } catch (error) { console.error('Failed to fetch historical pulls:', error); }
  };

  const saveCurrentPull = async () => {
    if (games.length === 0) return;
    setSavingPull(true);
    try {
      const res = await fetch('/api/admin-panel/odds-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', games, creditUsed: creditStatus?.used || 0 }),
      });
      if (res.ok) { fetchHistoricalPulls(); alert('Current odds saved successfully!'); }
    } catch (error) { console.error('Failed to save pull:', error); alert('Failed to save odds data'); }
    finally { setSavingPull(false); }
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
        a.href = url; a.download = `odds_pull_${selectedPullId}.xlsx`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); a.remove();
      }
    } catch (error) { console.error('Failed to download:', error); alert('Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const filteredGames = games.filter(game => sportFilter === 'all' || game.sportName === sportFilter);
  const sports = [...new Set(games.map(g => g.sportName))];
  const formatOdds = (odds) => odds == null ? '-' : odds > 0 ? `+${odds}` : odds;
  const getBookmakers = (game) => game.allBookmakerOdds ? Object.keys(game.allBookmakerOdds).sort() : [];
  const formatPullDate = (dateStr) => new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <AdminLayout title="Games & Odds" requiredPermission="games">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Games & Odds</h1>
        <p className="text-gray-400">View games and compare odds across bookmakers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass-card p-5 relative overflow-hidden border-2 border-green-500/50">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-green-500/20 rounded-full blur-2xl"></div>
          <div className="relative flex items-center gap-3 mb-3">
            <span className="px-2 py-1 bg-green-600 text-white font-bold rounded text-xs">ACTIVE</span>
            <span className="text-lg font-bold text-green-300">Goalserve API</span>
          </div>
          <p className="text-green-200 text-sm">All odds from goalserve.com. Primary bookmaker: bet365</p>
          <div className="mt-2 text-xs text-green-400 space-y-0.5">
            <div>Cache: 30 seconds | Features: Odds, live scores, play-by-play</div>
          </div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-gray-500/20 rounded-full blur-2xl"></div>
          <div className="relative flex items-center gap-3 mb-3">
            <span className="px-2 py-1 bg-gray-600 text-white font-bold rounded text-xs">BACKUP</span>
            <span className="text-lg font-bold text-gray-400">The Odds API</span>
          </div>
          <p className="text-gray-400 text-sm">US bookmaker odds (FanDuel, DraftKings). Available as backup.</p>
        </div>
      </div>

      <div className="glass-card p-5 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Historical Odds Downloads</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm text-gray-400 mb-2">Select Historical Pull</label>
            <select value={selectedPullId} onChange={(e) => setSelectedPullId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
              <option value="">-- Select a pull to download --</option>
              {historicalPulls.map(pull => <option key={pull.id} value={pull.id}>{formatPullDate(pull.pulledAt)} - {pull.gamesCount} games</option>)}
            </select>
          </div>
          <button onClick={downloadPull} disabled={!selectedPullId || downloading} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl transition-all flex items-center gap-2 font-medium">
            {downloading ? <><span className="animate-spin">⏳</span> Downloading...</> : <>📥 Download Excel</>}
          </button>
          <button onClick={saveCurrentPull} disabled={games.length === 0 || savingPull} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl transition-all flex items-center gap-2 font-medium">
            {savingPull ? <><span className="animate-spin">⏳</span> Saving...</> : <>💾 Save Current Pull</>}
          </button>
        </div>
        {historicalPulls.length === 0 && <p className="text-gray-500 text-sm mt-3">No historical pulls saved yet.</p>}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
          <option value="all">All Sports</option>
          {sports.map(sport => <option key={sport} value={sport}>{sport}</option>)}
        </select>
        <button onClick={fetchGames} className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all flex items-center gap-2 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div><p className="text-gray-400 mt-4">Loading games...</p></div>
        ) : filteredGames.length === 0 ? (
          <div className="p-12 text-center"><svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg><p className="text-gray-500">No games found for today</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Sport</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Matchup</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Bookmakers</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredGames.map((game) => (
                  <tr key={game.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4"><span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/30">{game.sportName}</span></td>
                    <td className="px-4 py-4 text-white font-medium">{game.awayTeam} @ {game.homeTeam}</td>
                    <td className="px-4 py-4 text-gray-300">{game.time}</td>
                    <td className="px-4 py-4"><span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium border border-green-500/30">{game.lines?.spread?.home?.source || 'bet365'}</span></td>
                    <td className="px-4 py-4 text-center text-gray-300">{getBookmakers(game).length}</td>
                    <td className="px-4 py-4 text-center"><button onClick={() => setSelectedGame(game)} className="px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/30">View Odds</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedGame && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="glass-card w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedGame.awayTeamFull || selectedGame.awayTeam} @ {selectedGame.homeTeamFull || selectedGame.homeTeam}</h2>
                <p className="text-gray-400">{selectedGame.sportName} - {selectedGame.time}</p>
              </div>
              <button onClick={() => setSelectedGame(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-5 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Current Display Odds</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-sm mb-2">Spread</div>
                    <div className="text-white font-bold text-lg">{selectedGame.lines?.spread?.away?.point} ({formatOdds(selectedGame.lines?.spread?.away?.odds)})</div>
                    <div className="text-gray-500 text-xs mt-1">{selectedGame.lines?.spread?.away?.source}</div>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-sm mb-2">Moneyline</div>
                    <div className="text-white font-bold text-lg">Away: {formatOdds(selectedGame.lines?.moneyline?.away)} / Home: {formatOdds(selectedGame.lines?.moneyline?.home)}</div>
                    <div className="text-gray-500 text-xs mt-1">{selectedGame.lines?.moneyline?.awaySource}</div>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-gray-400 text-sm mb-2">Total</div>
                    <div className="text-white font-bold text-lg">{selectedGame.lines?.total?.over?.point} ({formatOdds(selectedGame.lines?.total?.over?.odds)})</div>
                    <div className="text-gray-500 text-xs mt-1">{selectedGame.lines?.total?.over?.source}</div>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-4">Bookmaker Comparison</h3>
              <div className="overflow-x-auto bg-white/5 rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">Bookmaker</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">Spread Away</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">Spread Home</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">ML Away</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">ML Home</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">Over</th>
                      <th className="px-4 py-3 text-center text-gray-400 font-medium">Under</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {getBookmakers(selectedGame).map((bm) => {
                      const odds = selectedGame.allBookmakerOdds[bm];
                      return (
                        <tr key={bm} className="hover:bg-white/5">
                          <td className="px-4 py-3 text-white font-medium">{bm}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{odds?.spread?.away?.point} ({formatOdds(odds?.spread?.away?.odds)})</td>
                          <td className="px-4 py-3 text-center text-gray-300">{odds?.spread?.home?.point} ({formatOdds(odds?.spread?.home?.odds)})</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatOdds(odds?.moneyline?.away)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatOdds(odds?.moneyline?.home)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{odds?.total?.over?.point} ({formatOdds(odds?.total?.over?.odds)})</td>
                          <td className="px-4 py-3 text-center text-gray-300">{odds?.total?.under?.point} ({formatOdds(odds?.total?.under?.odds)})</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {getBookmakers(selectedGame).length === 0 && <div className="text-center py-8 text-gray-500">No bookmaker odds available</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
