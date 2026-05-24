import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useBetSlip } from '../../contexts/BetSlipContext';
import { useGames } from '../../contexts/GamesContext';
import OddsHistoryChart from '../../components/game/OddsHistoryChart';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { leavePage } from '../../utils/leavePage';

export default function GameDetail() {
  const router = useRouter();
  const { id, demo } = router.query;
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Popular');
  const { betSlip, addToBetSlip, isBetInSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { getPossession, possessionConnected, apiGames, inplayEvents } = useGames();
  const { formatOdds: formatOddsPref } = useUserPreferences();
  
  const possession = useMemo(() => {
    if (!id) return null;
    return getPossession(id);
  }, [id, getPossession]);

  const betTabs = ['Popular', 'Live SGP', 'Spread', 'Total', 'Moneyline'];

  useEffect(() => {
    if (!id) return;

    const findGameInContext = () => {
      // Dashboard prefixes inplay game IDs with "inplay_", so check for that pattern
      const isInplayId = id.startsWith('inplay_');
      const originalEventId = isInplayId ? id.replace(/^inplay_/, '') : id;
      
      // Check inplayEvents using the original event ID (without prefix)
      if (inplayEvents && inplayEvents[originalEventId]) {
        const event = inplayEvents[originalEventId];
        // Transform to display format (matching dashboard logic)
        const transformedGame = transformInplayEventToGame(event, id);
        setGame(transformedGame);
        setLoading(false);
        return true;
      }
      
      // Check apiGames
      if (apiGames && apiGames.length > 0) {
        const foundGame = apiGames.find(g => String(g.id) === String(id));
        if (foundGame) {
          setGame(foundGame);
          setLoading(false);
          return true;
        }
      }
      return false;
    };
    
    // Helper to transform inplay event to game display format
    const transformInplayEventToGame = (event, gameId) => {
      const homeTeam = event.homeTeam || 'Home';
      const awayTeam = event.awayTeam || 'Away';
      let homeScore = event.homeScore ?? 0;
      let awayScore = event.awayScore ?? 0;
      
      if (homeScore === 0 && awayScore === 0 && event.stats) {
        const totalStat = Object.values(event.stats).find(s => s.name === 'T');
        if (totalStat) {
          homeScore = parseInt(totalStat.home) || 0;
          awayScore = parseInt(totalStat.away) || 0;
        }
      }
      
      const odds = event.odds || {};
      const lines = {
        moneyline: {
          home: odds.moneyline?.home || null,
          away: odds.moneyline?.away || null
        },
        spread: odds.spread ? {
          home: { point: odds.spread.home, odds: -110 },
          away: { point: odds.spread.away, odds: -110 }
        } : {},
        total: odds.total ? {
          over: { point: odds.total.line, odds: -110 },
          under: { point: odds.total.line, odds: -110 }
        } : {}
      };
      
      return {
        id: gameId,
        sport: event.sport,
        sportName: event.league || event.sport,
        homeTeam: homeTeam.substring(0, 20),
        awayTeam: awayTeam.substring(0, 20),
        homeTeamFull: homeTeam,
        awayTeamFull: awayTeam,
        homeScore,
        awayScore,
        time: 'LIVE',
        isLive: true,
        status: 'IN_PROGRESS',
        period: event.period || event.quarter || '',
        lines,
        odds: event.odds
      };
    };

    if (findGameInContext()) {
      return;
    }

    console.log('[GameDetail] Not found in context, fetching from API...');
    const fetchGame = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          console.log('[GameDetail] API returned', data.games?.length || 0, 'games');
          const foundGame = data.games?.find(g => String(g.id) === String(id));
          if (foundGame) {
            console.log('[GameDetail] Found in API response');
          } else {
            console.log('[GameDetail] Not found in API response');
          }
          setGame(foundGame);
        }
      } catch (error) {
        console.error('Error fetching game:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id, apiGames, inplayEvents]);
  
  useEffect(() => {
    if (!id || !game) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          const foundGame = data.games?.find(g => String(g.id) === String(id));
          if (foundGame) {
            setGame(foundGame);
          }
        }
      } catch (error) {
        console.error('Error refreshing game:', error);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [id, game]);

  const formatOdds = (odds) => {
    if (odds === null || odds === undefined) return odds;
    return formatOddsPref(odds);
  };

  const formatSpread = (point) => {
    if (point === null || point === undefined) return '-';
    const num = parseFloat(point);
    if (isNaN(num)) return point;
    return num > 0 ? `+${num}` : num.toString();
  };

  const formatTotal = (point, type) => {
    if (point === null || point === undefined) return '-';
    const prefix = type === 'over' ? 'O' : 'U';
    return `${prefix} ${point}`;
  };

  const handleAddToBetSlip = (betType, odds, selection) => {
    if (!game) return;
    addToBetSlip(game, betType, odds, selection);
  };

  const checkBetInSlip = (betType, selection) => {
    if (!game) return false;
    return isBetInSlip(game, betType, selection);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="text-xl mb-4">Game not found</p>
        <button 
          onClick={() => leavePage({ router, fallbackHref: '/dashboard' })}
          className="bg-green-600 px-6 py-3 rounded-lg font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const lines = game.lines || {};
  const moneyline = lines.moneyline || { home: 0, away: 0 };
  const spread = lines.spread || { 
    home: { point: 0, odds: 0 }, 
    away: { point: 0, odds: 0 } 
  };
  const total = lines.total || { 
    over: { point: 0, odds: 0 }, 
    under: { point: 0, odds: 0 } 
  };
  const hasLines = game.lines && moneyline.home !== 0;

  const isLive = game.isLive || game.status === 'IN_PROGRESS';
  const isFinal = game.isCompleted || game.status === 'FINAL';
  const betsForThisGame = betSlip.filter(b => String(b.gameId) === String(game.id));

  return (
    <>
      <Head>
        <title>{game.awayTeamFull} vs {game.homeTeamFull} | Piks</title>
      </Head>

      <div className="min-h-screen bg-black text-white pb-32">
        <div className="sticky top-0 z-50 bg-black border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => leavePage({ router, fallbackHref: '/dashboard' })}
              className="p-2 -ml-2 rounded-full hover:bg-[#111]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <div className="font-semibold">{game.sportName}</div>
              <div className="text-xs text-gray-400">Game Details</div>
            </div>
            <button className="p-2 -mr-2 rounded-full hover:bg-[#111]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Kalshi-style minimal header — just the sport breadcrumb, the
            two teams with scores, and a LIVE / time pill. All the legacy
            live-updates panel, Stream Live / Hide Tracker / Stats buttons,
            and possession highlights were removed per the request to make
            this page feel like Kalshi: the odds chart is the main event. */}
        <div className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
          <div className="px-4 pt-4 pb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              {game.sportName || game.sport || 'Sports'}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold truncate text-white">{game.awayTeamFull || game.awayTeam}</span>
                  <span className="text-2xl font-black tabular-nums" style={{ color: '#fb923c' }}>
                    {isLive || isFinal ? (possession?.awayScore ?? game.scores?.away?.total ?? game.awayScore ?? 0) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold truncate text-white">{game.homeTeamFull || game.homeTeam}</span>
                  <span className="text-2xl font-black tabular-nums" style={{ color: '#3b82f6' }}>
                    {isLive || isFinal ? (possession?.homeScore ?? game.scores?.home?.total ?? game.homeScore ?? 0) : '—'}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                {isFinal ? (
                  <span className="text-gray-400 text-[11px] font-black uppercase tracking-wider">Final</span>
                ) : isLive ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                    style={{
                      background: 'rgba(239,68,68,0.18)',
                      border: '1.5px solid rgba(239,68,68,0.55)',
                      color: '#fca5a5',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400 font-semibold">{game.time || 'TBD'}</span>
                )}
                {isLive && game.quarter && (
                  <span className="text-[10px] text-gray-500 font-bold tabular-nums">{game.quarter}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Kalshi-style live odds chart — the main view of the page.
            Plots de-vigged implied win probability over time for the home
            (blue) and away (orange) teams. The component synthesizes a
            small jitter tick every 3 seconds so the line visibly moves
            like public money is shifting, then snaps back to the real
            odds whenever the server snapshot refreshes. */}
        {hasLines && (
          <div className="px-4 pt-4">
            <OddsHistoryChart
              gameId={game.id}
              homeTeam={game.homeTeam || game.homeTeamFull}
              awayTeam={game.awayTeam || game.awayTeamFull}
              liveOdds={{ home: moneyline.home, away: moneyline.away }}
            />
          </div>
        )}

        <div className="sticky top-[57px] z-40 bg-black border-b border-[#1a1a1a]">
          <div className="flex overflow-x-auto scrollbar-hide">
            {betTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'text-white border-blue-500' 
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {(activeTab === 'Popular' || activeTab === 'Moneyline') && (
            <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <span className="font-semibold">Moneyline</span>
                <span className="text-xs text-gray-500 bg-[#111] px-2 py-1 rounded">SGP</span>
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500 mb-2">Wager is graded on the result after regulation.</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.away, game.awayTeamFull || game.awayTeam)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('moneyline', game.awayTeamFull || game.awayTeam)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.awayTeamFull || game.awayTeam}</div>
                    <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.awayTeamFull || game.awayTeam) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(moneyline.away) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.home, game.homeTeamFull || game.homeTeam)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('moneyline', game.homeTeamFull || game.homeTeam)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.homeTeamFull || game.homeTeam}</div>
                    <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.homeTeamFull || game.homeTeam) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(moneyline.home) : '-'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'Popular' || activeTab === 'Spread') && (
            <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <span className="font-semibold">Spread</span>
                <span className="text-xs text-gray-500 bg-[#111] px-2 py-1 rounded">SGP</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddToBetSlip('spread', spread.away, `${game.awayTeamFull || game.awayTeam} ${spread.away.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('spread', `${game.awayTeamFull || game.awayTeam} ${spread.away.point}`)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.awayTeamFull || game.awayTeam}</div>
                    <div className="text-lg font-bold text-white">{hasLines ? formatSpread(spread.away.point) : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('spread', `${game.awayTeamFull || game.awayTeam} ${spread.away.point}`) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(spread.away.odds) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('spread', spread.home, `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('spread', `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.homeTeamFull || game.homeTeam}</div>
                    <div className="text-lg font-bold text-white">{hasLines ? formatSpread(spread.home.point) : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('spread', `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(spread.home.odds) : '-'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'Popular' || activeTab === 'Total') && (
            <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                <span className="font-semibold">Total Points</span>
                <span className="text-xs text-gray-500 bg-[#111] px-2 py-1 rounded">SGP</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddToBetSlip('total', total.over, `Over ${total.over.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('total', `Over ${total.over.point}`)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">Over</div>
                    <div className="text-lg font-bold text-white">{hasLines ? total.over.point : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('total', `Over ${total.over.point}`) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(total.over.odds) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('total', `Under ${total.under.point}`)
                        ? 'bg-blue-600 border-2 border-blue-500'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">Under</div>
                    <div className="text-lg font-bold text-white">{hasLines ? total.under.point : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('total', `Under ${total.under.point}`) ? 'text-white' : 'text-blue-400'}`}>
                      {hasLines ? formatOdds(total.under.odds) : '-'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Live SGP' && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎯</div>
              <p className="text-gray-400">Same Game Parlay options available during live games</p>
            </div>
          )}

          <div className="text-center text-gray-500 text-xs py-4">
            <p>Odds provided by {spread.away?.source || 'FanDuel'}</p>
          </div>
        </div>

        {betSlip.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#1a1a1a] p-4 z-40">
            <button
              onClick={() => router.push(demo ? '/demo-dashboard' : '/dashboard')}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              <span>View Bet Slip</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{betSlip.length}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
