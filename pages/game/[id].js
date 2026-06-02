import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useBetSlip } from '../../contexts/BetSlipContext';
import { useGames } from '../../contexts/GamesContext';
import OddsHistoryChart from '../../components/game/OddsHistoryChart';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { leavePage } from '../../utils/leavePage';
import TeamLogo from '../../components/TeamLogo';
import { getTeamColor, inkFor } from '../../utils/teamColors';

export default function GameDetail() {
  const router = useRouter();
  const { id, demo } = router.query;
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Popular');
  // Sync latch so a double-tap on the back button in the same tick
  // can't schedule two navigations.
  const leavingRef = useRef(false);

  // Prefetch the dashboard so router.back() lands on cached
  // SSR JSON instead of round-tripping /_next/data. Pages-router
  // router.prefetch fetches both the JS chunk and the page data
  // in current Next.js, so this turns the back nav into a
  // near-instant client transition.
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/dashboard');
  }, [router]);

  const handleBack = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // We used to flip a `leaving` state that swapped the entire
    // page for a spinner here to give "instant" feedback. The
    // spinner felt worse than the old delay because users saw
    // the loading pinwheel even though the destination was
    // already cached by the prefetch effect below — so the page
    // would briefly flash to a spinner before landing on the
    // dashboard. The prefetch alone keeps the back snappy, and
    // letting the current page stay on screen until the router
    // commits the next route looks much cleaner.
    // Defer to the next tick so React flushes any in-flight
    // state before we ask the router to navigate.
    // When a page deep-links into the game with `?from=/path` (e.g. the
    // My Piks pick rows / Battle Insights "Open Game"), prefer returning
    // there. router.back() still wins when there's genuine in-app history
    // (it preserves scroll); the `from` target only kicks in as the
    // fallback when this page was a fresh/hard load (history idx 0), so
    // the user lands back where they came from instead of the dashboard.
    // Guard against open-redirects by requiring a single leading slash.
    const fromParam = router.query.from;
    const from = typeof fromParam === 'string' && fromParam.startsWith('/') && !fromParam.startsWith('//')
      ? fromParam
      : null;
    setTimeout(() => {
      leavePage({ router, fallbackHref: from || '/dashboard' });
    }, 0);
  };
  const { betSlip, addToBetSlip, isBetInSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { getPossession, possessionConnected, apiGames, inplayEvents } = useGames();
  const { formatOdds: formatOddsPref } = useUserPreferences();
  
  const possession = useMemo(() => {
    if (!id) return null;
    return getPossession(id);
  }, [id, getPossession]);

  const betTabs = ['Popular', 'Live SGP', 'Spread', 'Total', 'Moneyline'];
  const desktopBetTabs = ['Popular', 'Live SGP', 'Spread', 'Total', 'Moneyline', 'Player Props', 'Game Props'];

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
        odds: event.odds,
        // Preserve raw event payload + stats so Box Score / Gamecast
        // modals can render the per-period breakdown the Goalserve
        // feed already gives us.
        stats: event.stats,
        events: event.events || event.commentary || null,
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
      <div className="game-detail-page min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-detail-page min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="text-xl mb-4">Game not found</p>
        <button 
          onClick={handleBack}
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

  // Theme the page after the home team. `homeColor` drives the LIVE pill,
  // the selected-bet highlight, and the View Bet Slip button. Exposed as CSS
  // vars on the page wrapper so Tailwind arbitrary-value classes (and the
  // desktop sub-components) can pick up the dynamic color without prop drilling.
  const homeName = game.homeTeamFull || game.homeTeam;
  const homeColor = getTeamColor(homeName) || '#3b82f6';
  const homeInk = inkFor(homeColor);

  return (
    <>
      <Head>
        <title>{game.awayTeamFull} vs {game.homeTeamFull} | Piks</title>
      </Head>

      <div
        className="game-detail-page min-h-screen bg-black text-white pb-32"
        style={{ '--home-color': homeColor, '--home-bg': `${homeColor}26`, '--home-ink': homeInk }}
      >
        <DesktopGameDetail
          game={game}
          possession={possession}
          isLive={isLive}
          isFinal={isFinal}
          hasLines={hasLines}
          moneyline={moneyline}
          spread={spread}
          total={total}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          betTabs={desktopBetTabs}
          formatOdds={formatOdds}
          formatSpread={formatSpread}
          handleAddToBetSlip={handleAddToBetSlip}
          checkBetInSlip={checkBetInSlip}
          betsForThisGame={betsForThisGame}
          playerProps={Array.isArray(game.playerProps) ? game.playerProps : []}
          globalBetSlipOpen={showBetSlip}
          onBack={handleBack}
          onOpenAllPicks={() => setShowBetSlip(true)}
        />

        <div className="sticky top-0 z-50 bg-black border-b border-[#1a1a1a] md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={handleBack}
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
        <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] md:hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
              {game.sportName || game.sport || 'Sports'}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogoBadge name={game.awayTeamFull || game.awayTeam} sport={game.sport} accent="orange" size={28} />
                    <span className="text-lg font-bold truncate text-white">{game.awayTeamFull || game.awayTeam}</span>
                  </div>
                  <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--team-neutral, #ffffff)' }}>
                    {isLive || isFinal ? (possession?.awayScore ?? game.scores?.away?.total ?? game.awayScore ?? 0) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogoBadge name={game.homeTeamFull || game.homeTeam} sport={game.sport} accent="blue" size={28} />
                    <span className="text-lg font-bold truncate text-white">{game.homeTeamFull || game.homeTeam}</span>
                  </div>
                  <span className="text-2xl font-black tabular-nums" style={{ color: '#ffffff' }}>
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
                      background: `${homeColor}2e`,
                      border: `1.5px solid ${homeColor}8c`,
                      color: homeColor,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: homeColor }} />
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
          <div className="px-4 pt-4 md:hidden">
            <OddsHistoryChart
              gameId={game.id}
              homeTeam={game.homeTeam || game.homeTeamFull}
              awayTeam={game.awayTeam || game.awayTeamFull}
              homeTeamFull={game.homeTeamFull || game.homeTeam}
              awayTeamFull={game.awayTeamFull || game.awayTeam}
              sport={game.sport}
              liveOdds={{ home: moneyline.home, away: moneyline.away }}
              commenceTime={game.commenceTime || game.startTime || game.startsAt || null}
              isLive={isLive}
              isFinal={isFinal}
            />
          </div>
        )}

        <div className="sticky top-[57px] z-40 bg-black border-b border-[#1a1a1a] md:hidden">
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

        <div className="px-4 py-4 space-y-4 md:hidden">
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
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.awayTeamFull || game.awayTeam}</div>
                    <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.awayTeamFull || game.awayTeam) ? 'text-white' : 'text-white'}`}>
                      {hasLines ? formatOdds(moneyline.away) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.home, game.homeTeamFull || game.homeTeam)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('moneyline', game.homeTeamFull || game.homeTeam)
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.homeTeamFull || game.homeTeam}</div>
                    <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.homeTeamFull || game.homeTeam) ? 'text-white' : 'text-white'}`}>
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
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.awayTeamFull || game.awayTeam}</div>
                    <div className="text-lg font-bold text-white">{hasLines ? formatSpread(spread.away.point) : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('spread', `${game.awayTeamFull || game.awayTeam} ${spread.away.point}`) ? 'text-white' : 'text-white'}`}>
                      {hasLines ? formatOdds(spread.away.odds) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('spread', spread.home, `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('spread', `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`)
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">{game.homeTeamFull || game.homeTeam}</div>
                    <div className="text-lg font-bold text-white">{hasLines ? formatSpread(spread.home.point) : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('spread', `${game.homeTeamFull || game.homeTeam} ${spread.home.point}`) ? 'text-white' : 'text-white'}`}>
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
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">Over</div>
                    <div className="text-lg font-bold text-white">{hasLines ? total.over.point : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('total', `Over ${total.over.point}`) ? 'text-white' : 'text-white'}`}>
                      {hasLines ? formatOdds(total.over.odds) : '-'}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under.point}`)}
                    disabled={!hasLines}
                    className={`rounded-lg p-3 text-center transition-all ${
                      !hasLines ? 'opacity-50 cursor-not-allowed' :
                      checkBetInSlip('total', `Under ${total.under.point}`)
                        ? 'bg-[var(--home-bg)] border-2 border-[var(--home-color)]'
                        : 'bg-[#1a1a1a] border border-[#1a1a1a] hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm text-gray-400 mb-1">Under</div>
                    <div className="text-lg font-bold text-white">{hasLines ? total.under.point : '-'}</div>
                    <div className={`text-sm ${checkBetInSlip('total', `Under ${total.under.point}`) ? 'text-white' : 'text-white'}`}>
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
          <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#1a1a1a] p-4 z-40 md:hidden">
            <button
              onClick={() => router.push(demo ? '/demo-dashboard' : '/dashboard')}
              className="w-full bg-[var(--home-color)] text-[var(--home-ink)] font-bold py-4 rounded-xl flex items-center justify-center gap-2"
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

// --- Desktop (lg+) dashboard-style layout ---------------------------
// Renders only on lg breakpoints and above via `hidden md:block`.
// Mobile and tablet (<lg) continue to use the existing single-column
// layout above unchanged. Reuses the same handlers and bet-slip data
// so adding picks here flows into the global bet slip exactly as it
// does on mobile.

function TeamLogoBadge({ name, sport, accent = 'orange', size = 64 }) {
  return <TeamLogo name={name} sport={sport} accent={accent} size={size} />;
}

function DesktopMarketCard({ title, children }) {
  // `h-full` makes the card stretch to fill its grid row, and the
  // inner flex column lets the children area (`flex-1`) expand so
  // every card in a row ends up the same height even when one
  // market (e.g. Moneyline) has fewer rows than another (Spread /
  // Total Points each have a sub line under the team name).
  return (
    <div className="bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
        <span className="text-sm font-bold text-white tracking-wide">{title}</span>
        <span className="text-[10px] font-bold text-gray-500 bg-[#161616] px-2 py-1 rounded uppercase tracking-wider">SGP</span>
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col justify-start">{children}</div>
    </div>
  );
}

function DesktopOptionButton({ active, disabled, label, value, sub, onClick, accent = 'blue' }) {
  // Selection highlight is themed after the home team via the `--home-color` /
  // `--home-bg` CSS vars set on the desktop page wrapper (falls back to the
  // app blue). The odds numbers themselves stay white for readability.
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl px-4 py-3 flex items-center justify-between transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-[#141414] border border-[#1a1a1a]'
          : active
            ? 'border-2 text-white'
            : 'bg-[#141414] border border-[#1a1a1a] hover:border-gray-600'
      }`}
      style={active && !disabled ? { background: 'var(--home-bg, rgba(59,130,246,0.15))', borderColor: 'var(--home-color, #3b82f6)' } : undefined}
    >
      <div className="flex flex-col items-start">
        <span className="text-sm font-semibold text-gray-200">{label}</span>
        {/* Always render the sub line (with a non-breaking space when
            absent) so every option row has the same height. Without
            this, Moneyline rows are shorter than Spread / Total rows
            and the three market cards in the Popular grid end up
            visually unequal. */}
        <span className="text-xs text-gray-500 mt-0.5 leading-4">
          {sub != null ? sub : '\u00a0'}
        </span>
      </div>
      <span
        className="text-lg font-extrabold tabular-nums"
        style={{ color: '#ffffff' }}
      >
        {value}
      </span>
    </button>
  );
}

function DesktopGameDetail({
  game,
  possession,
  isLive,
  isFinal,
  hasLines,
  moneyline,
  spread,
  total,
  activeTab,
  setActiveTab,
  betTabs,
  formatOdds,
  formatSpread,
  handleAddToBetSlip,
  checkBetInSlip,
  betsForThisGame,
  playerProps = [],
  globalBetSlipOpen = false,
  onBack,
  onOpenAllPicks,
}) {
  const awayName = game.awayTeamFull || game.awayTeam;
  const homeName = game.homeTeamFull || game.homeTeam;
  const homeColor = getTeamColor(homeName) || '#3b82f6';
  const homeInk = inkFor(homeColor);
  const awayScore = isLive || isFinal
    ? (possession?.awayScore ?? game.scores?.away?.total ?? game.awayScore ?? 0)
    : '—';
  const homeScore = isLive || isFinal
    ? (possession?.homeScore ?? game.scores?.home?.total ?? game.homeScore ?? 0)
    : '—';

  const awayPeriods = game.scores?.away?.periods || [];
  const homePeriods = game.scores?.home?.periods || [];
  const periodCount = Math.max(awayPeriods.length, homePeriods.length);
  const periodLabel = (game.sport === 'nhl' || game.sport === 'hockey') ? 'P' : 'Q';

  // Box Score / Gamecast overlay state. `null` = nothing open.
  const [activeOverlay, setActiveOverlay] = useState(null);

  // Build the per-period score line from whichever source the game
  // object happens to carry. Goalserve inplay events expose stats as
  // an object keyed by index where each entry has {name, home, away}
  // — 'name' is the period label ('1','2',...,'T') for MLB innings
  // or ('Q1','Q2',...) for NBA/NFL. Fall back to the API `scores`
  // shape (homePeriods/awayPeriods arrays) when stats isn't present.
  const periodRows = useMemo(() => {
    if (game?.stats && typeof game.stats === 'object') {
      const entries = Object.values(game.stats).filter(
        (s) => s && s.name && s.name !== 'T' && s.name !== 'ITeam'
      );
      if (entries.length) {
        return entries.map((s) => ({
          label: String(s.name),
          home: s.home ?? '-',
          away: s.away ?? '-',
        }));
      }
    }
    if (awayPeriods.length || homePeriods.length) {
      const max = Math.max(awayPeriods.length, homePeriods.length);
      return Array.from({ length: max }, (_, i) => ({
        label: `${periodLabel}${i + 1}`,
        home: homePeriods[i] ?? '-',
        away: awayPeriods[i] ?? '-',
      }));
    }
    return [];
  }, [game?.stats, awayPeriods, homePeriods, periodLabel]);

  // Lightweight commentary feed for Gamecast — Goalserve passes
  // `events`/`commentary` arrays on some sports. Normalize to a
  // simple {time, text} list if present.
  const commentaryItems = useMemo(() => {
    const raw = game?.events;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .slice(-25)
      .reverse()
      .map((e, i) => ({
        key: e.id || `${i}-${e.minute || e.time || ''}`,
        time: e.minute || e.time || e.period || '',
        text: e.description || e.comment || e.text || e.type || '',
      }))
      .filter((e) => e.text);
  }, [game?.events]);

  return (
    <div
      className="hidden md:block"
      style={{ '--home-color': homeColor, '--home-bg': `${homeColor}26`, '--home-ink': homeInk }}
    >
      <div className="max-w-[1400px] mx-auto px-6 xl:px-10 py-4">
        {/* Top breadcrumb / back */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
              {game.sportName || game.sport || 'Sports'}
            </span>
            <span className="text-gray-700">/</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Game Detail</span>
          </button>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">
              {game.sportName || game.sport || 'Sports'}{game.season ? ` · ${game.season}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveOverlay('boxscore')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#141414] border border-[#1f1f1f] text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
              >
                Box Score
              </button>
              <button
                type="button"
                onClick={() => setActiveOverlay('gamecast')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#141414] border border-[#1f1f1f] text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
              >
                Gamecast
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8">
            {/* Away */}
            <div className="flex items-center gap-4">
              <TeamLogoBadge name={awayName} sport={game.sport} accent="orange" size={52} />
              <div className="min-w-0">
                <div className="text-xl font-black text-white truncate">{awayName}</div>
                <div className="text-xs text-gray-500 font-semibold">{game.awayRecord || 'Away'}</div>
              </div>
            </div>

            {/* Center scoreboard */}
            <div className="text-center min-w-[260px]">
              <div className="flex items-center justify-center gap-5">
                <div className="text-4xl xl:text-5xl font-black tabular-nums" style={{ color: 'var(--team-neutral, #ffffff)' }}>{awayScore}</div>
                <div className="text-3xl font-bold text-gray-700">—</div>
                <div className="text-4xl xl:text-5xl font-black tabular-nums" style={{ color: '#ffffff' }}>{homeScore}</div>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                {isFinal ? (
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Final</span>
                ) : isLive ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                      style={{ background: `${homeColor}2e`, border: `1.5px solid ${homeColor}8c`, color: homeColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: homeColor }} />
                      Live
                    </span>
                    {game.quarter && (
                      <span className="text-[11px] font-bold text-gray-400 tabular-nums">{game.quarter}</span>
                    )}
                    {game.period && !game.quarter && (
                      <span className="text-[11px] font-bold text-gray-400 tabular-nums">{game.period}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{game.time || 'TBD'}</span>
                )}
              </div>
            </div>

            {/* Home */}
            <div className="flex items-center gap-4 justify-end">
              <div className="min-w-0 text-right">
                <div className="text-xl font-black text-white truncate">{homeName}</div>
                <div className="text-xs text-gray-500 font-semibold">{game.homeRecord || 'Home'}</div>
              </div>
              <TeamLogoBadge name={homeName} sport={game.sport} accent="blue" size={52} />
            </div>
          </div>

          {/* Venue subline */}
          {(game.venue || game.location) && (
            <div className="text-center text-xs text-gray-500 font-semibold mt-4">
              {[game.venue, game.location].filter(Boolean).join(' · ')}
            </div>
          )}

          {/* Quarter-by-quarter strip (only when data exists) */}
          {periodCount > 0 && (
            <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
              <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: `120px repeat(${periodCount + 1}, minmax(0, 1fr))` }}>
                <div />
                {Array.from({ length: periodCount }).map((_, i) => (
                  <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-500">{periodLabel}{i + 1}</div>
                ))}
                <div className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">T</div>
                <div className="text-sm font-bold truncate" style={{ color: 'var(--team-neutral, #ffffff)' }}>{awayName}</div>
                {Array.from({ length: periodCount }).map((_, i) => (
                  <div key={i} className="text-center text-sm font-bold text-gray-300 tabular-nums">{awayPeriods[i] ?? '—'}</div>
                ))}
                <div className="text-center text-sm font-black text-white tabular-nums">{awayScore}</div>
                <div className="text-sm font-bold truncate" style={{ color: '#ffffff' }}>{homeName}</div>
                {Array.from({ length: periodCount }).map((_, i) => (
                  <div key={i} className="text-center text-sm font-bold text-gray-300 tabular-nums">{homePeriods[i] ?? '—'}</div>
                ))}
                <div className="text-center text-sm font-black text-white tabular-nums">{homeScore}</div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column shell — single column at md (sidebar collapses
            under the markets), two columns at lg+ with sticky sidebar. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* Main column */}
          <div className="min-w-0 space-y-4">
            {hasLines && (
              <OddsHistoryChart
                gameId={game.id}
                homeTeam={game.homeTeam || game.homeTeamFull}
                awayTeam={game.awayTeam || game.awayTeamFull}
                homeTeamFull={game.homeTeamFull || game.homeTeam}
                awayTeamFull={game.awayTeamFull || game.awayTeam}
                sport={game.sport}
                liveOdds={{ home: moneyline.home, away: moneyline.away }}
                commenceTime={game.commenceTime || game.startTime || game.startsAt || null}
                isLive={isLive}
                isFinal={isFinal}
              />
            )}

            {/* Underline tab row */}
            <div className="border-b border-[#1a1a1a]">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {betTabs.map((tab) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors ${
                        active ? 'text-white' : 'text-gray-500 hover:text-gray-200'
                      }`}
                    >
                      {tab}
                      {active && <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-blue-500 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Markets grid — 2-up at md (intermediate), 3-up at lg+ */}
            {activeTab === 'Popular' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <DesktopMarketCard title="Moneyline">
                  <DesktopOptionButton
                    accent="orange"
                    disabled={!hasLines}
                    active={checkBetInSlip('moneyline', awayName)}
                    label={awayName}
                    value={hasLines ? formatOdds(moneyline.away) : '-'}
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.away, awayName)}
                  />
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('moneyline', homeName)}
                    label={homeName}
                    value={hasLines ? formatOdds(moneyline.home) : '-'}
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.home, homeName)}
                  />
                </DesktopMarketCard>

                <DesktopMarketCard title="Spread">
                  <DesktopOptionButton
                    accent="orange"
                    disabled={!hasLines}
                    active={checkBetInSlip('spread', `${awayName} ${spread.away?.point}`)}
                    label={awayName}
                    sub={hasLines ? formatSpread(spread.away?.point) : null}
                    value={hasLines ? formatOdds(spread.away?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('spread', spread.away, `${awayName} ${spread.away?.point}`)}
                  />
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('spread', `${homeName} ${spread.home?.point}`)}
                    label={homeName}
                    sub={hasLines ? formatSpread(spread.home?.point) : null}
                    value={hasLines ? formatOdds(spread.home?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('spread', spread.home, `${homeName} ${spread.home?.point}`)}
                  />
                </DesktopMarketCard>

                <DesktopMarketCard title="Total Points">
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('total', `Over ${total.over?.point}`)}
                    label="Over"
                    sub={hasLines ? total.over?.point : null}
                    value={hasLines ? formatOdds(total.over?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('total', total.over, `Over ${total.over?.point}`)}
                  />
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('total', `Under ${total.under?.point}`)}
                    label="Under"
                    sub={hasLines ? total.under?.point : null}
                    value={hasLines ? formatOdds(total.under?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under?.point}`)}
                  />
                </DesktopMarketCard>
              </div>
            )}

            {activeTab === 'Moneyline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DesktopMarketCard title={`Moneyline · ${awayName}`}>
                  <DesktopOptionButton
                    accent="orange"
                    disabled={!hasLines}
                    active={checkBetInSlip('moneyline', awayName)}
                    label={awayName}
                    value={hasLines ? formatOdds(moneyline.away) : '-'}
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.away, awayName)}
                  />
                </DesktopMarketCard>
                <DesktopMarketCard title={`Moneyline · ${homeName}`}>
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('moneyline', homeName)}
                    label={homeName}
                    value={hasLines ? formatOdds(moneyline.home) : '-'}
                    onClick={() => handleAddToBetSlip('moneyline', moneyline.home, homeName)}
                  />
                </DesktopMarketCard>
              </div>
            )}

            {activeTab === 'Spread' && (
              <DesktopMarketCard title="Spread">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DesktopOptionButton
                    accent="orange"
                    disabled={!hasLines}
                    active={checkBetInSlip('spread', `${awayName} ${spread.away?.point}`)}
                    label={awayName}
                    sub={hasLines ? formatSpread(spread.away?.point) : null}
                    value={hasLines ? formatOdds(spread.away?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('spread', spread.away, `${awayName} ${spread.away?.point}`)}
                  />
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('spread', `${homeName} ${spread.home?.point}`)}
                    label={homeName}
                    sub={hasLines ? formatSpread(spread.home?.point) : null}
                    value={hasLines ? formatOdds(spread.home?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('spread', spread.home, `${homeName} ${spread.home?.point}`)}
                  />
                </div>
              </DesktopMarketCard>
            )}

            {activeTab === 'Total' && (
              <DesktopMarketCard title="Total Points">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('total', `Over ${total.over?.point}`)}
                    label="Over"
                    sub={hasLines ? total.over?.point : null}
                    value={hasLines ? formatOdds(total.over?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('total', total.over, `Over ${total.over?.point}`)}
                  />
                  <DesktopOptionButton
                    accent="blue"
                    disabled={!hasLines}
                    active={checkBetInSlip('total', `Under ${total.under?.point}`)}
                    label="Under"
                    sub={hasLines ? total.under?.point : null}
                    value={hasLines ? formatOdds(total.under?.odds) : '-'}
                    onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under?.point}`)}
                  />
                </div>
              </DesktopMarketCard>
            )}

            {activeTab === 'Live SGP' && (
              <div className="text-center py-16 bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a]">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-gray-400">Same Game Parlay options available during live games</p>
              </div>
            )}

            {activeTab === 'Player Props' && (
              playerProps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playerProps.map((p, i) => (
                    <DesktopMarketCard key={`pp-${i}`} title={`${p.player} · ${p.market}`}>
                      <DesktopOptionButton accent="blue" disabled label={`Over ${p.line ?? ''}`} value={p.over != null ? formatOdds(p.over) : '-'} />
                      <DesktopOptionButton accent="orange" disabled label={`Under ${p.line ?? ''}`} value={p.under != null ? formatOdds(p.under) : '-'} />
                    </DesktopMarketCard>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a]">
                  <div className="text-4xl mb-3">👤</div>
                  <p className="text-gray-400">Player props will appear here once available for this game.</p>
                </div>
              )
            )}

            {activeTab === 'Game Props' && (
              <div className="text-center py-16 bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a]">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-gray-400">Game props will appear here once available for this game.</p>
              </div>
            )}

            {/* Featured Player Props row — rendered under Popular markets
                when prop data is available. Gracefully hidden otherwise. */}
            {activeTab === 'Popular' && playerProps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Featured Player Props</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Player Props')}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300"
                  >
                    See all →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {playerProps.slice(0, 6).map((p, i) => (
                    <div key={`fp-${i}`} className="bg-[#0f0f0f] rounded-xl border border-[#1a1a1a] p-3">
                      <div className="text-sm font-bold text-white truncate">{p.player}</div>
                      <div className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">{p.market}{p.line != null ? ` · ${p.line}` : ''}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-[#141414] rounded-lg px-2 py-1.5 text-center">
                          <div className="text-[10px] text-gray-500 font-bold">O</div>
                          <div className="text-sm font-extrabold text-blue-400 tabular-nums">{p.over != null ? formatOdds(p.over) : '-'}</div>
                        </div>
                        <div className="bg-[#141414] rounded-lg px-2 py-1.5 text-center">
                          <div className="text-[10px] text-gray-500 font-bold">U</div>
                          <div className="text-sm font-extrabold text-orange-400 tabular-nums">{p.under != null ? formatOdds(p.under) : '-'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-gray-600 text-xs py-2">
              Odds provided by {spread.away?.source || 'FanDuel'}
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* When the docked global bet slip is open it already shows
                the full picks editor, so we hide the in-page My Picks
                card to avoid a duplicated panel. The Game Info card
                below still renders. */}
            {!globalBetSlipOpen && (
            <div className="bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                <span className="text-sm font-bold text-white">My Picks</span>
                <span className="text-[11px] font-bold text-gray-400 bg-[#161616] px-2 py-1 rounded-full tabular-nums">
                  {betsForThisGame.length}
                </span>
              </div>
              {betsForThisGame.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="text-xs text-gray-500">Tap any line to add your first pick.</div>
                </div>
              ) : (
                <div className="divide-y divide-[#161616]">
                  {betsForThisGame.slice(0, 5).map((bet) => {
                    const stake = Number(bet.stake || 0);
                    const oddsVal = typeof bet.odds === 'object' ? (bet.odds.odds ?? bet.odds.value ?? 0) : bet.odds;
                    const odds = Number(oddsVal) || 0;
                    const decimal = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
                    const toWin = stake > 0 ? (stake * decimal - stake) : 0;
                    return (
                      <div key={bet.id} className="px-5 py-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white truncate">{bet.selection || bet.team || '—'}</span>
                          <span className="font-extrabold text-blue-400 tabular-nums">{formatOdds(odds)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-gray-500">
                          <span className="uppercase tracking-wider text-[10px] font-bold">{bet.betType || 'Pick'}</span>
                          <span className="tabular-nums">
                            {stake > 0 ? `$${stake.toFixed(0)} → $${toWin.toFixed(0)}` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-[#1a1a1a]">
                <button
                  type="button"
                  onClick={onOpenAllPicks}
                  disabled={betsForThisGame.length === 0}
                  className={`w-full text-center text-xs font-bold py-2 rounded-lg transition-transform active:scale-[0.98] ${
                    betsForThisGame.length === 0
                      ? 'bg-[#141414] text-gray-600 cursor-not-allowed'
                      : ''
                  }`}
                  style={
                    betsForThisGame.length === 0
                      ? undefined
                      : { background: homeColor, color: homeInk }
                  }
                >
                  View All Picks
                </button>
              </div>
            </div>
            )}

            <div className="bg-[#0f0f0f] rounded-2xl border border-[#1a1a1a] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1a1a1a]">
                <span className="text-sm font-bold text-white">Game Info</span>
              </div>
              <dl className="px-5 py-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Time</dt>
                  <dd className="text-white font-semibold">{game.time || (isFinal ? 'Final' : 'TBD')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Venue</dt>
                  <dd className="text-white font-semibold truncate ml-3">{game.venue || '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Location</dt>
                  <dd className="text-white font-semibold truncate ml-3">{game.location || '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">TV</dt>
                  <dd className="text-white font-semibold truncate ml-3">{game.tv || '—'}</dd>
                </div>
              </dl>
              <div className="px-5 py-3 border-t border-[#1a1a1a]">
                <button
                  type="button"
                  className="w-full text-center text-xs font-bold py-2 rounded-lg bg-[#141414] border border-[#1f1f1f] text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                >
                  View Matchup
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Box Score / Gamecast overlay */}
      {activeOverlay && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          onClick={() => setActiveOverlay(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  {game.sportName || game.sport || 'Sports'}
                </div>
                <div className="text-lg font-black text-white">
                  {activeOverlay === 'boxscore' ? 'Box Score' : 'Gamecast'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOverlay(null)}
                className="w-9 h-9 rounded-lg bg-[#141414] border border-[#1f1f1f] text-gray-400 hover:text-white hover:border-gray-600 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {activeOverlay === 'boxscore' ? (
                periodRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                          <th className="text-left py-2 pr-3">Team</th>
                          {periodRows.map((p) => (
                            <th key={p.label} className="px-2 py-2 text-center w-10">{p.label}</th>
                          ))}
                          <th className="px-2 py-2 text-center w-12 text-white">T</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-[#1a1a1a]">
                          <td className="py-3 pr-3 font-bold text-white truncate">{awayName}</td>
                          {periodRows.map((p) => (
                            <td key={`a-${p.label}`} className="px-2 py-3 text-center text-gray-300 font-semibold">{p.away}</td>
                          ))}
                          <td className="px-2 py-3 text-center font-black text-orange-400">{awayScore}</td>
                        </tr>
                        <tr className="border-t border-[#1a1a1a]">
                          <td className="py-3 pr-3 font-bold text-white truncate">{homeName}</td>
                          {periodRows.map((p) => (
                            <td key={`h-${p.label}`} className="px-2 py-3 text-center text-gray-300 font-semibold">{p.home}</td>
                          ))}
                          <td className="px-2 py-3 text-center font-black text-blue-400">{homeScore}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Per-period box score isn't available for this game yet.
                    {isLive ? ' Check back once the feed catches up.' : ''}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400 mb-1">Away</div>
                      <div className="text-white font-bold truncate">{awayName}</div>
                      <div className="text-3xl font-black text-orange-400 mt-1">{awayScore}</div>
                    </div>
                    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400 mb-1">Home</div>
                      <div className="text-white font-bold truncate">{homeName}</div>
                      <div className="text-3xl font-black text-blue-400 mt-1">{homeScore}</div>
                    </div>
                  </div>
                  <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-4 flex items-center justify-between text-sm">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.18em]">Status</span>
                    <span className="text-white font-bold">
                      {isLive ? `LIVE${game.period ? ` · ${game.period}` : ''}` : isFinal ? 'Final' : (game.time || 'Scheduled')}
                    </span>
                  </div>
                  {commentaryItems.length > 0 ? (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-2">Play-by-play</div>
                      <ul className="space-y-2">
                        {commentaryItems.map((c) => (
                          <li key={c.key} className="bg-[#141414] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-gray-300 flex gap-3">
                            {c.time && (
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 shrink-0">{c.time}</span>
                            )}
                            <span className="flex-1">{c.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      Live play-by-play isn't available for this game yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
