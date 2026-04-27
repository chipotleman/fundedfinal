import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import TapSurface from '../components/TapSurface';
import LiveGameTimer from '../components/LiveGameTimer';
import DepositMatchContainer from '../components/DepositMatchContainer';
import TrendingBetContainer from '../components/TrendingBetContainer';
import DepositMatchAppliedBanner from '../components/DepositMatchAppliedBanner';
import CasinoDepositMatchContainer from '../components/CasinoDepositMatchContainer';
import FireBattleContainer from '../components/FireBattleContainer';
import PoolContainer from '../components/PoolContainer';
import ReferralBonusContainer from '../components/ReferralBonusContainer';
import MostSharedBadgeContainer from '../components/MostSharedBadgeContainer';
import PromoCarousel from '../components/PromoCarousel';
import { DEFAULT_PROMO_SLOTS, normalizePromoSlots } from '../lib/promoSlots';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import LiveBattlesSection from '../components/battle/LiveBattlesSection';
import Footer from '../components/Footer';
import { readLastBuyIn, fetchLastBuyIn } from '../utils/lastBattleBuyIn';
import { inferLeague } from '../lib/leagueInference';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';
import { useGoalserveLive } from '../hooks/useGoalserveLive';
import useModalScrollLock from '../hooks/useModalScrollLock';
import useLeadChangeCue from '../hooks/useLeadChangeCue';

// Tiny inline strip showing the recent score-gap trajectory for a close-games
// card. Renders a small SVG sparkline plus a "Gap N" label tinted by trend
// (green = closing, orange = widening, gray = stable). Always reserves the
// same vertical space so newly arriving history can't shift the card layout.
function GapHistoryStrip({ history, currentGap }) {
  const RESERVED_HEIGHT = 18;
  const points = Array.isArray(history) ? history : [];
  const hasUsable = points.length >= 2;

  if (!hasUsable) {
    return (
      <div
        className="mb-2"
        style={{ height: RESERVED_HEIGHT }}
        aria-hidden="true"
      />
    );
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const trend = last < prev ? 'closer' : last > prev ? 'wider' : 'stable';
  const color = trend === 'closer' ? '#10b981' : trend === 'wider' ? '#f97316' : '#9ca3af';
  const arrow = trend === 'closer' ? '▾' : trend === 'wider' ? '▴' : '·';

  const w = 56;
  const h = 12;
  const maxVal = Math.max(...points, 1);
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((v, i) => {
    const x = i * stepX;
    // Larger gap sits higher on the chart so a downward slope reads as
    // "getting closer" — the same direction as good news for these cards.
    const y = h - (v / maxVal) * h;
    return { x, y };
  });
  const polyPoints = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const displayGap = typeof currentGap === 'number' ? currentGap : last;

  return (
    <div
      className="mb-2 flex items-center gap-1.5"
      style={{ height: RESERVED_HEIGHT }}
      title={`Recent score gaps: ${points.join(' → ')}`}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 -1 ${w} ${h + 2}`}
        style={{ overflow: 'visible', flexShrink: 0 }}
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyPoints}
        />
        {coords.map((p, i) => {
          const isLast = i === coords.length - 1;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLast ? 1.8 : 1.1}
              fill={color}
            />
          );
        })}
      </svg>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>
        {arrow} Gap {displayGap}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const { apiGames: contextApiGames, inplayEvents: contextInplayEvents, loading: gamesLoading, error: gamesError, lastUpdated, isDemoMode } = useGames();
  const { matchup, opponent, myProfile, hasActiveMatchup, isWaiting, isQueued, queueEntry, timeRemaining, refresh: refreshMatchup } = useMatchup();
  const [selectedSport, setSelectedSport] = useState('Live');
  const [showBattleWalkthrough, setShowBattleWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);
  const [promoSlots, setPromoSlots] = useState(() =>
    DEFAULT_PROMO_SLOTS.map((s) => ({ ...s })),
  );

  const battleStartedRetryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/promo-slots')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.slots) return;
        setPromoSlots(normalizePromoSlots(data.slots));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const promoSlides = useMemo(() => {
    const renderers = {
      reload_match: () => <DepositMatchContainer />,
      trending: () => <TrendingBetContainer />,
      deposit_match_applied: () => <DepositMatchAppliedBanner />,
      casino_match: () => <CasinoDepositMatchContainer />,
      fire_battle: () => <FireBattleContainer />,
      pool: () => <PoolContainer />,
      referral: () => <ReferralBonusContainer />,
      most_shared_badge: () => <MostSharedBadgeContainer />,
      empty: () => null,
    };
    return promoSlots
      .map((slot, i) => {
        if (!slot.enabled) return null;
        const render = renderers[slot.containerType];
        if (!render) return null;
        const node = render();
        if (!node) return null;
        return {
          key: `${i}-${slot.containerType}`,
          node,
          slotIndex: i,
          containerType: slot.containerType,
        };
      })
      .filter(Boolean);
  }, [promoSlots]);

  useModalScrollLock(showBattleWalkthrough, { restoreScroll: true });

  useEffect(() => {
    if (router.query.battleStarted !== 'true') return;
    
    if (hasActiveMatchup) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      setShowBattleWalkthrough(true);
      router.replace('/', undefined, { shallow: true });
      if (battleStartedRetryRef.current) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
      }
      return;
    }

    refreshMatchup();
    let retryCount = 0;
    battleStartedRetryRef.current = setInterval(() => {
      retryCount++;
      refreshMatchup();
      if (retryCount >= 10) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
        router.replace('/', undefined, { shallow: true });
      }
    }, 1000);

    return () => {
      if (battleStartedRetryRef.current) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
      }
    };
  }, [router.query.battleStarted, hasActiveMatchup]);

  // Note: games/allGames are derived at render time via useMemo for SSR compatibility
  // These state setters are kept for legacy compatibility but initial values come from SSR
  const [gamesState, setGames] = useState([]);
  const [allGamesState, setAllGames] = useState([]);
  const [loading, setLoading] = useState(false);
  // Start as null so the visible balance (and the Play Now confirm step's
  // balance pill, gated by its `hasBalance` guard) doesn't flash a bogus
  // placeholder before the real profile fetch resolves.
  const [bankroll, setBankroll] = useState(null);
  const [pnl, setPnl] = useState(0);
  // Friends list + remembered last buy-in for the in-card Play Friend
  // modal that the "Choose Battle Mode" chooser opens directly from
  // the home page's Your Battle card. Fetched lazily for signed-in
  // users only — guests never see the chooser flow that needs them.
  const [friendsList, setFriendsList] = useState([]);
  const [lastBuyIn, setLastBuyIn] = useState(null);
  // Profile snapshot used as `currentUser` for the in-card Play Friend
  // modal. We keep a small mirror of the same `/api/profiles/:id`
  // response that already powers the bankroll display so the modal
  // gets username/avatar/equipped frame without an extra fetch.
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [expandedGames, setExpandedGames] = useState({});
  const scrollPositionRef = useRef(0);
  const isFrozenRef = useRef(false);

  // Scroll position restoration for iOS/iPad app switching
  // Uses localStorage (not sessionStorage) because iOS kills the page and clears sessionStorage
  useEffect(() => {
    const SCROLL_KEY = 'piks_dashboard_scroll';
    const SCROLL_TIME_KEY = 'piks_dashboard_scroll_time';
    const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes max age for saved position
    
    const saveScrollPosition = () => {
      const pos = window.scrollY || window.pageYOffset || 0;
      scrollPositionRef.current = pos;
      try {
        localStorage.setItem(SCROLL_KEY, String(pos));
        localStorage.setItem(SCROLL_TIME_KEY, String(Date.now()));
      } catch (e) {}
    };

    const getSavedScrollPosition = () => {
      try {
        const savedPos = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
        const savedTime = parseInt(localStorage.getItem(SCROLL_TIME_KEY) || '0', 10);
        // Only use saved position if it's recent enough
        if (savedPos > 0 && Date.now() - savedTime < MAX_AGE_MS) {
          return savedPos;
        }
      } catch (e) {}
      return 0;
    };

    const clearSavedScroll = () => {
      try {
        localStorage.removeItem(SCROLL_KEY);
        localStorage.removeItem(SCROLL_TIME_KEY);
      } catch (e) {}
    };

    // Restore scroll position immediately on mount
    const restoreScrollPosition = () => {
      const savedPos = getSavedScrollPosition();
      if (savedPos > 0) {
        scrollPositionRef.current = savedPos;
        window.scrollTo(0, savedPos);
        // Multiple attempts for iOS reliability
        requestAnimationFrame(() => window.scrollTo(0, savedPos));
        setTimeout(() => window.scrollTo(0, savedPos), 50);
        setTimeout(() => window.scrollTo(0, savedPos), 100);
        setTimeout(() => window.scrollTo(0, savedPos), 200);
      }
    };

    // Restore on mount
    restoreScrollPosition();

    // Track scroll continuously
    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 100);
    };

    // Save immediately before page hides (iOS may kill page right after)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      } else if (document.visibilityState === 'visible') {
        restoreScrollPosition();
      }
    };

    const handlePageHide = () => {
      saveScrollPosition();
    };

    const handlePageShow = (e) => {
      restoreScrollPosition();
    };

    // Window focus/blur for additional iOS coverage
    const handleBlur = () => saveScrollPosition();
    const handleFocus = () => restoreScrollPosition();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            // Use a null check (not truthiness) so a real $0 balance still
            // clears the placeholder loading state for users who actually
            // have nothing in their account.
            if (profile?.bankroll != null) {
              setBankroll(parseFloat(profile.bankroll));
            }
            if (profile?.pnl != null) {
              setPnl(parseFloat(profile.pnl));
            }
            // Cache username/avatar/frame so the in-card Play Friend
            // modal can render the current user without a second fetch.
            // The endpoint sometimes wraps under `profile` and sometimes
            // returns the row directly — handle both shapes.
            const p = profile?.profile || profile;
            if (p) {
              setProfileSnapshot({
                id: user.id,
                username: p.username || user.username || user.name,
                avatar: p.avatar ?? null,
                frameId: p.equippedFrame || null,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // Friends list — needed by the in-card Play Friend modal that the
  // Your Battle card's chooser opens directly. Bounded with a short
  // timeout so a slow/hung endpoint can't strand the chooser flow.
  const fetchFriendsList = useCallback(async () => {
    if (!user?.id) {
      setFriendsList([]);
      return;
    }
    if (typeof AbortController === 'undefined') {
      try {
        const res = await fetch('/api/friends');
        if (!res.ok) return;
        const data = await res.json();
        setFriendsList(data.friends || []);
      } catch {}
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 8000);
    try {
      const res = await fetch('/api/friends', { signal: controller.signal });
      if (!res.ok) return;
      const data = await res.json();
      setFriendsList(data.friends || []);
    } catch {} finally {
      clearTimeout(timer);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFriendsList();
  }, [fetchFriendsList]);

  // Hydrate the remembered buy-in once we know who the user is so the
  // in-card Play Friend modal opens with the same defaults the friend-
  // row shortcut would use. Mirrors the `refreshLastBuyIn` flow on
  // /battle: seed from the local cache for an instant render, then
  // refresh from the server so the value follows them across devices.
  const refreshLastBuyIn = useCallback(async () => {
    if (!user?.id) {
      setLastBuyIn(null);
      return;
    }
    const cached = readLastBuyIn(user.id);
    if (cached) setLastBuyIn(cached);
    const fresh = await fetchLastBuyIn(user.id);
    setLastBuyIn(fresh);
  }, [user?.id]);

  useEffect(() => {
    refreshLastBuyIn();
  }, [refreshLastBuyIn]);

  const toggleGameExpanded = (gameId) => {
    setExpandedGames(prev => ({ ...prev, [gameId]: !prev[gameId] }));
  };

  const handleBetSlipClick = () => {
    setShowBetSlip(!showBetSlip);
  };

  const sports = ['NBA', 'NFL', 'NCAAB', 'NCAAF', 'MLB', 'NHL', 'Euro Basketball', "Int'l Hockey"];

  // Helper to get short team name for buttons, avoiding ambiguous names
  const getShortTeamName = (teamName, otherTeamName) => {
    // Remove trailing parenthetical suffixes like "(W)"
    const cleanName = (teamName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    const cleanOther = (otherTeamName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    
    const parts = cleanName.split(' ');
    const otherParts = cleanOther.split(' ');
    
    // If only one word, return it
    if (parts.length === 1) return cleanName;
    
    // Get last word of both teams to check for ambiguity
    const lastWord = parts[parts.length - 1];
    const otherLastWord = otherParts[otherParts.length - 1];
    
    // If both teams have the same last word (e.g., both "U23"), must use 2 words to differentiate
    if (lastWord === otherLastWord) {
      return parts.length >= 2 ? parts.slice(-2).join(' ') : cleanName;
    }
    
    // For 2-word names that are short enough, use both (e.g., "Morgan State")
    if (parts.length === 2) {
      const twoWords = parts.join(' ');
      // If combined is <= 12 chars, use both words
      if (twoWords.length <= 12) return twoWords;
    }
    
    // Otherwise just use the last word to avoid cutoff
    return lastWord;
  };

  const baseGamesRef = useRef({});
  const betSlipRef = useRef(betSlip);
  
  useEffect(() => {
    betSlipRef.current = betSlip;
  }, [betSlip]);

  // Use games from context (preloaded on app start)
  const apiGames = contextApiGames || [];
  const inplayEvents = contextInplayEvents || {};
  
  // Also get SSE data from hook for real-time updates
  const { liveScores, liveOdds, events: hookInplayEvents, isConnected: liveConnected } = useGoalserveLive({ autoConnect: true });
  
  // Merge context inplay events with hook inplay events (hook may have fresher data)
  const mergedInplayEvents = useMemo(() => {
    const merged = { ...inplayEvents };
    if (hookInplayEvents) {
      Object.entries(hookInplayEvents).forEach(([id, event]) => {
        merged[id] = event;
      });
    }
    return merged;
  }, [inplayEvents, hookInplayEvents]);

  // SEPARATED DATA SOURCES - No more merging!
  // Live tab uses ONLY inplay SSE data (fastest, real-time)
  // Upcoming tab uses ONLY REST API data (scheduled games)
  
  // Convert inplay events to game format for Live tab
  // FILTER: Only include games that have odds (otherwise show locked/unusable cards)
  const liveGamesFromInplay = useMemo(() => {
    return Object.values(mergedInplayEvents || {})
    .filter(event => {
      // Only show games that have at least some odds data
      const hasOdds = event.odds && (
        event.odds.moneyline?.home || 
        event.odds.moneyline?.away || 
        event.odds.spread?.home || 
        event.odds.total?.line
      );
      return hasOdds;
    })
    .map(event => {
      const homeTeam = event.homeTeam || event.stats?.[0]?.home || 'Home';
      const awayTeam = event.awayTeam || event.stats?.[0]?.away || 'Away';
      
      let homeScore = event.homeScore ?? 0;
      let awayScore = event.awayScore ?? 0;
      
      if (homeScore === 0 && awayScore === 0 && event.stats) {
        const totalStat = Object.values(event.stats).find(s => s.name === 'T');
        if (totalStat) {
          homeScore = parseInt(totalStat.home) || 0;
          awayScore = parseInt(totalStat.away) || 0;
        }
      }
      
      const sportIcons = {
        basketball: '🏀',
        hockey: '🏒',
        soccer: '⚽',
        amfootball: '🏈',
        baseball: '⚾',
        esports: '🎮'
      };
      const sportIcon = sportIcons[event.sport] || '🏆';
      const leagueName = event.league || inferLeague(homeTeam, awayTeam, event.sport);
      
      return {
        id: `inplay_${event.id}`,
        gameId: `inplay_${event.id}`,
        sport: event.sport,
        sportName: leagueName,
        league: leagueName,
        sportIcon: sportIcon,
        homeTeam: homeTeam.substring(0, 20),
        awayTeam: awayTeam.substring(0, 20),
        homeTeamFull: homeTeam,
        awayTeamFull: awayTeam,
        time: 'LIVE',
        commenceTime: new Date().toISOString(),
        status: 'IN_PROGRESS',
        isLive: true,
        isInplay: true,
        displayClock: event.displayClock,
        elapsedTime: event.elapsedTime,
        period: event.period,
        stateCode: event.stateCode,
        comments: event.comments || [],
        scores: {
          home: { total: homeScore },
          away: { total: awayScore }
        },
        lines: event.odds && Object.keys(event.odds).length > 0 ? {
          moneyline: {
            home: event.odds.moneyline?.home || null,
            away: event.odds.moneyline?.away || null
          },
          spread: {
            home: event.odds.spread?.home ? 
              { point: parseFloat(event.odds.spread.home.line) || 0, odds: parseFloat(event.odds.spread.home.odds) || -110 } 
              : null,
            away: event.odds.spread?.away ? 
              { point: parseFloat(event.odds.spread.away.line) || 0, odds: parseFloat(event.odds.spread.away.odds) || -110 } 
              : null
          },
          total: {
            over: (event.odds.total?.line !== undefined && event.odds.total?.line !== null) ? 
              { point: parseFloat(event.odds.total.line) || 0, odds: parseFloat(event.odds.total.over) || -110 } 
              : null,
            under: (event.odds.total?.line !== undefined && event.odds.total?.line !== null) ? 
              { point: parseFloat(event.odds.total.line) || 0, odds: parseFloat(event.odds.total.under) || -110 } 
              : null
          }
        } : null,
        dataSource: 'Goalserve Inplay'
      };
    });
  }, [mergedInplayEvents]);
  
  // Helper to normalize team names for matching
  const normalizeTeamName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/state$/, 'st')
      .replace(/university$/, '');
  };
  
  // Get upcoming games from REST API (exclude any that are live in inplay or completed)
  const upcomingGamesFromApi = useMemo(() => {
    const result = apiGames
      .map(game => ({ ...game, league: game.league || game.sportName }))
      .filter(game => {
        // Exclude games that are already showing in inplay (live games from SSE)
        const isInInplay = liveGamesFromInplay.some(inplay => {
          const home1 = normalizeTeamName(game.homeTeamFull || game.homeTeam);
          const away1 = normalizeTeamName(game.awayTeamFull || game.awayTeam);
          const home2 = normalizeTeamName(inplay.homeTeamFull || inplay.homeTeam);
          const away2 = normalizeTeamName(inplay.awayTeamFull || inplay.awayTeam);
          return (home1 === home2 && away1 === away2) || (home1 === away2 && away1 === home2);
        });
        const isSimLive = isDemoMode && game.isSimulated && game.isLive;
        return !isInInplay && !game.isCompleted && !isSimLive;
      });
    return result;
  }, [apiGames, liveGamesFromInplay, isDemoMode]);
  
  // Combined for backward compatibility with existing code
  const gamesWithLiveData = useMemo(() => {
    return [...liveGamesFromInplay, ...upcomingGamesFromApi];
  }, [liveGamesFromInplay, upcomingGamesFromApi]);

  // Pool of simulated demo games split into live vs starting-soon buckets.
  // Real Goalserve inplay data always takes precedence over this pool.
  const simulatedDemoPool = useMemo(() => {
    if (!isDemoMode) return { live: [], startingSoon: [] };
    const now = Date.now();
    const live = [];
    const startingSoon = [];
    apiGames.forEach(g => {
      if (!g.isSimulated || g.isCompleted) return;
      if (g.isLive) {
        live.push(g);
        return;
      }
      const startMs = g.startTime ? new Date(g.startTime).getTime() : 0;
      const minutesUntilStart = (startMs - now) / (60 * 1000);
      if (minutesUntilStart > 0 && minutesUntilStart < 240) {
        startingSoon.push(g);
      }
    });
    startingSoon.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return { live, startingSoon };
  }, [apiGames, isDemoMode]);

  const categorizedGames = useMemo(() => {
    // Real-data path: real inplay games take precedence; demo top-up does not kick in.
    if (!isDemoMode || liveGamesFromInplay.length > 0) {
      return {
        liveGames: liveGamesFromInplay,
        upcomingGames: upcomingGamesFromApi,
        recentlyCompletedGames: []
      };
    }

    // Demo mode without real inplay data: top up the live list with starting-soon
    // games so the Live pill, FEATURED carousel, and LIVE NOW section are never empty.
    const TARGET_MIN_LIVE = 8;
    const liveIds = new Set(simulatedDemoPool.live.map(g => g.id));
    const promoted = [];
    for (const g of simulatedDemoPool.startingSoon) {
      if (simulatedDemoPool.live.length + promoted.length >= TARGET_MIN_LIVE) break;
      if (!liveIds.has(g.id)) promoted.push(g);
    }
    const promotedIds = new Set(promoted.map(g => g.id));

    return {
      liveGames: [...simulatedDemoPool.live, ...promoted],
      upcomingGames: upcomingGamesFromApi.filter(g => !promotedIds.has(g.id)),
      recentlyCompletedGames: []
    };
  }, [liveGamesFromInplay, upcomingGamesFromApi, isDemoMode, simulatedDemoPool]);

  const closeGames = useMemo(() => {
    const closeThresholds = {
      soccer: 1,
      hockey: 1,
      baseball: 2,
      esports: 1,
      basketball: 6,
      amfootball: 7,
    };
    const defaultThreshold = 3;

    return categorizedGames.liveGames
      .map(game => {
        const isLive = game.isLive || game.status === 'IN_PROGRESS';
        if (!isLive) return null;
        const homeScore = game.scores?.home?.total;
        const awayScore = game.scores?.away?.total;
        if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;
        const diff = Math.abs(homeScore - awayScore);
        const threshold = closeThresholds[game.sport] ?? defaultThreshold;
        if (diff > threshold) return null;
        return { game, diff };
      })
      .filter(Boolean)
      .sort((a, b) => a.diff - b.diff)
      .map(({ game, diff }) => ({ ...game, _scoreGap: diff }));
  }, [categorizedGames.liveGames]);

  // Track which close games just got tighter than they were on the previous tick,
  // and which ones flipped which side is leading. We compare each game's current
  // score gap and current leader to the previously-seen ones and flag any change
  // so the card can briefly highlight without shifting layout.
  const prevGapsRef = useRef(new Map());
  const prevLeadersRef = useRef(new Map());
  // Last score key seen per game (e.g. "5-3") so we only append to the gap
  // history when the underlying score actually changes, not every render.
  const prevScoreKeysRef = useRef(new Map());
  const [tightenedGames, setTightenedGames] = useState({});
  const [leadChangedGames, setLeadChangedGames] = useState({});
  // Rolling per-game history of recent score gaps, used to render the tiny
  // momentum sparkline on each card. Capped to GAP_HISTORY_LEN entries.
  const [gapHistories, setGapHistories] = useState({});
  const HIGHLIGHT_MS = 5000;
  const GAP_HISTORY_LEN = 6;

  useEffect(() => {
    const newlyTightened = {};
    const newlyLeadChanged = {};
    const historyAppends = {};
    const seenIds = new Set();
    closeGames.forEach((game) => {
      seenIds.add(game.id);
      const currentDiff = game._scoreGap;
      const homeScore = game.scores?.home?.total;
      const awayScore = game.scores?.away?.total;

      if (typeof currentDiff === 'number') {
        const prevDiff = prevGapsRef.current.get(game.id);
        if (typeof prevDiff === 'number' && currentDiff < prevDiff) {
          newlyTightened[game.id] = Date.now();
        }
        prevGapsRef.current.set(game.id, currentDiff);
      }

      // Append to the gap history only when the score line actually changes
      // (so identity-only re-renders don't flood the strip with duplicates).
      if (typeof homeScore === 'number' && typeof awayScore === 'number' && typeof currentDiff === 'number') {
        const scoreKey = `${homeScore}-${awayScore}`;
        const prevScoreKey = prevScoreKeysRef.current.get(game.id);
        if (scoreKey !== prevScoreKey) {
          historyAppends[game.id] = currentDiff;
          prevScoreKeysRef.current.set(game.id, scoreKey);
        }
      }

      let currentLeader = null;
      if (typeof homeScore === 'number' && typeof awayScore === 'number') {
        if (homeScore > awayScore) currentLeader = 'home';
        else if (awayScore > homeScore) currentLeader = 'away';
      }
      const prevLeader = prevLeadersRef.current.get(game.id);
      if (currentLeader && prevLeader && currentLeader !== prevLeader) {
        newlyLeadChanged[game.id] = Date.now();
      }
      // Only persist a known leader so transient ties don't erase the prior side.
      if (currentLeader) prevLeadersRef.current.set(game.id, currentLeader);
    });
    // Drop any tracked games no longer in the rail so the maps can't grow unbounded
    for (const id of Array.from(prevGapsRef.current.keys())) {
      if (!seenIds.has(id)) prevGapsRef.current.delete(id);
    }
    for (const id of Array.from(prevLeadersRef.current.keys())) {
      if (!seenIds.has(id)) prevLeadersRef.current.delete(id);
    }
    for (const id of Array.from(prevScoreKeysRef.current.keys())) {
      if (!seenIds.has(id)) prevScoreKeysRef.current.delete(id);
    }
    if (Object.keys(newlyTightened).length > 0) {
      setTightenedGames((prev) => ({ ...prev, ...newlyTightened }));
    }
    if (Object.keys(newlyLeadChanged).length > 0) {
      setLeadChangedGames((prev) => ({ ...prev, ...newlyLeadChanged }));
    }
    setGapHistories((prev) => {
      const appendIds = Object.keys(historyAppends);
      // Determine which games dropped out so we can prune their history.
      const stale = [];
      for (const id of Object.keys(prev)) {
        if (!seenIds.has(id)) stale.push(id);
      }
      if (appendIds.length === 0 && stale.length === 0) return prev;
      const next = { ...prev };
      for (const id of stale) delete next[id];
      for (const id of appendIds) {
        const existing = next[id] || [];
        const updated = [...existing, historyAppends[id]];
        if (updated.length > GAP_HISTORY_LEN) {
          updated.splice(0, updated.length - GAP_HISTORY_LEN);
        }
        next[id] = updated;
      }
      return next;
    });
  }, [closeGames]);

  // Clear the tightened highlight after a short window so it never lingers.
  useEffect(() => {
    const ids = Object.keys(tightenedGames);
    if (ids.length === 0) return;
    const now = Date.now();
    const earliest = Math.min(...Object.values(tightenedGames));
    const remaining = Math.max(0, HIGHLIGHT_MS - (now - earliest));
    const timer = setTimeout(() => {
      const cutoff = Date.now() - HIGHLIGHT_MS;
      setTightenedGames((prev) => {
        let changed = false;
        const next = {};
        for (const [id, ts] of Object.entries(prev)) {
          if (ts > cutoff) next[id] = ts;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, remaining + 50);
    return () => clearTimeout(timer);
  }, [tightenedGames]);

  // Trigger a brief haptic / audio cue whenever a tracked game flips its
  // leader, so users not staring at the rail still feel the moment.
  useLeadChangeCue(leadChangedGames);

  // Clear the lead-change highlight after the same short window.
  useEffect(() => {
    const ids = Object.keys(leadChangedGames);
    if (ids.length === 0) return;
    const now = Date.now();
    const earliest = Math.min(...Object.values(leadChangedGames));
    const remaining = Math.max(0, HIGHLIGHT_MS - (now - earliest));
    const timer = setTimeout(() => {
      const cutoff = Date.now() - HIGHLIGHT_MS;
      setLeadChangedGames((prev) => {
        let changed = false;
        const next = {};
        for (const [id, ts] of Object.entries(prev)) {
          if (ts > cutoff) next[id] = ts;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, remaining + 50);
    return () => clearTimeout(timer);
  }, [leadChangedGames]);

  // Sport filter mappings
  // NBA/NCAAB and NHL/Int'l Hockey are kept disjoint: the generic 'BASKETBALL'
  // and 'HOCKEY' fallbacks (used for real Goalserve games whose teams don't
  // match a specific league, and for Int'l Hockey demo games) only fall under
  // Euro Basketball / Int'l Hockey, never under NBA, NCAAB, or NHL.
  const sportMappings = useMemo(() => ({
    'NBA': ['NBA'],
    'NCAAB': ['NCAAB', "WOMEN'S NCAAB"],
    'NFL': ['NFL', 'FOOTBALL'],
    'NCAAF': ['NCAAF', 'FOOTBALL'],
    'MLB': ['MLB', 'BASEBALL', 'COLLEGE BASEBALL'],
    'NHL': ['NHL'],
    'Euro Basketball': ['EUROLEAGUE', 'TURKEY BASKETBALL', 'ITALY BASKETBALL', 'GREECE BASKETBALL', 'SPAIN BASKETBALL', 'FRANCE BASKETBALL', 'GERMANY BASKETBALL', 'EUROPEAN BASKETBALL', 'BASKETBALL'],
    "Int'l Hockey": ['HOCKEY']
  }), []);

  // CRITICAL FOR SSR: Derive games at render time (not in useEffect)
  // This ensures games are in the HTML during server render
  const allGames = useMemo(() => gamesWithLiveData, [gamesWithLiveData]);
  
  const games = useMemo(() => {
    const liveGames = [...categorizedGames.liveGames, ...(categorizedGames.recentlyCompletedGames || [])];
    const upcomingGames = categorizedGames.upcomingGames || [];
    
    const filterBySport = (gamesToFilter, sport) => {
      const validSportNames = sportMappings[sport] || [sport];
      return gamesToFilter.filter(g => {
        const sportNameUpper = (g.sportName || '').toUpperCase();
        return validSportNames.some(name => sportNameUpper === name.toUpperCase());
      });
    };
    
    const sortChronologically = (gamesToSort) => {
      return [...gamesToSort].sort((a, b) => {
        const isLiveA = a.isLive || a.status === 'IN_PROGRESS';
        const isLiveB = b.isLive || b.status === 'IN_PROGRESS';
        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
      });
    };
    
    if (selectedSport === 'Live') {
      return sortChronologically(liveGames);
    }
    
    const sportLiveGames = filterBySport(liveGames, selectedSport);
    const sportUpcomingGames = filterBySport(upcomingGames, selectedSport);
    return sortChronologically([...sportLiveGames, ...sportUpcomingGames]);
  }, [selectedSport, categorizedGames, sportMappings]);

  // Legacy effect to update state for components that depend on it
  useEffect(() => {
    setAllGames(allGames);
    setGames(games);
    setLoading(false);
  }, [allGames, games]);


  const { formatOdds } = useUserPreferences();

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

  const OddsDisplay = ({ odds, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    return (
      <div className={`text-sm font-bold ${baseClass}`}>
        {formatOdds(odds)}
      </div>
    );
  };

  const getSportIcon = (sport) => {
    const icons = {
      'NFL': '🏈',
      'NCAAF': '🏈',
      'NBA': '🏀', 
      'NCAAB': '🏀',
      'MLB': '⚾',
      'NHL': '🏒',
      'Soccer': '⚽',
      'Euro Basketball': '🏀',
      "Int'l Hockey": '🏒'
    };
    return icons[sport] || '🏆';
  };

  const getSportLabel = (sport) => {
    const labels = {
      'NFL': 'Football',
      'NCAAF': 'College Football',
      'NBA': 'Basketball',
      'NCAAB': 'College Basketball',
      'MLB': 'Baseball',
      'NHL': 'Hockey'
    };
    return labels[sport] || sport;
  };

  const handleSportClick = (sport) => {
    setSelectedSport(sport);
  };

  // Two-stage condensed-header engagement on the home page.
  //
  // Stage 1 (`headerPassed`): a sentinel placed immediately below the main
  // top nav (logo / balance / notifications) tells us when that header has
  // scrolled out of view. As soon as it does, the slim condensed bar
  // mounts at the top of the viewport so balance / notifications / slip
  // stay reachable.
  //
  // Stage 2 (`sportsRowPassed`): a second sentinel placed just above the
  // inline sport-pill row tells us when those pills have also scrolled
  // away. Once that fires the condensed bar reveals its sport-pills slot.
  //
  // Both observers use IntersectionObserver (root: null) so the engaged
  // state re-fires on every scroll-up-then-down pass — a previous direct
  // scroll handler worked once on iOS Safari and then got stuck. Each
  // sentinel is wired through a state variable + callback ref so that if
  // its DOM node remounts (route transition back, conditional re-mount)
  // the observer rebinds against the fresh node. A plain `useRef` would
  // not trigger that re-bind.
  const [headerSentinelNode, setHeaderSentinelNode] = useState(null);
  const setHeaderSentinelRef = useCallback((node) => {
    setHeaderSentinelNode(node || null);
  }, []);
  const [sportsSentinelNode, setSportsSentinelNode] = useState(null);
  const setSportRowSentinelRef = useCallback((node) => {
    setSportsSentinelNode(node || null);
  }, []);
  const [headerPassed, setHeaderPassed] = useState(false);
  const [sportsRowPassed, setSportsRowPassed] = useState(false);

  useEffect(() => {
    if (!headerSentinelNode || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setHeaderPassed((prev) => (prev === above ? prev : above));
      },
      { root: null, threshold: 0 }
    );
    observer.observe(headerSentinelNode);
    return () => {
      observer.disconnect();
    };
  }, [headerSentinelNode]);

  useEffect(() => {
    if (!sportsSentinelNode || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Engage only when the sentinel has scrolled ABOVE the top edge —
        // i.e. it's no longer intersecting AND its rect is above the
        // viewport. That way scrolling back up past the sentinel
        // disengages, and the next downward pass re-engages cleanly.
        const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setSportsRowPassed((prev) => (prev === above ? prev : above));
      },
      { root: null, threshold: 0 }
    );
    observer.observe(sportsSentinelNode);
    return () => {
      observer.disconnect();
    };
  }, [sportsSentinelNode]);

  // Reusable sport-pill row. Rendered inline at the top of the page AND
  // inside the condensed sticky header — both share the same selectedSport
  // state so picking a sport in either updates both immediately.
  const renderSportPills = (variant = 'inline') => {
    const isCondensed = variant === 'condensed';
    const pillPadding = isCondensed ? '6px 12px' : '10px 16px';
    const pillFontSize = isCondensed ? '12px' : '14px';
    const iconSize = isCondensed ? '13px' : '16px';
    return (
      <div
        className={`flex items-center space-x-2 overflow-x-auto scrollbar-hide ${isCondensed ? '' : 'pb-1'}`}
        style={isCondensed ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {isDemoMode && !isCondensed && (
          <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider">Demo</span>
          </div>
        )}
        <TapSurface
          onTap={() => handleSportClick('Live')}
          isActive={selectedSport === 'Live'}
          activeColor="#dc2626"
          inactiveColor="transparent"
          activeTextColor="#ffffff"
          inactiveTextColor={'#9ca3af'}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: pillPadding,
            borderRadius: '9999px',
            fontSize: pillFontSize,
            fontWeight: '600',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: selectedSport === 'Live' ? '#dc2626' : ('#1f2937')
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: selectedSport === 'Live' ? '#ffffff' : (categorizedGames.liveGames.length > 0 ? '#ef4444' : '#6b7280')
            }}
          ></span>
          <span>Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}</span>
        </TapSurface>
        {sports.map((sport) => (
          <TapSurface
            key={sport}
            onTap={() => handleSportClick(sport)}
            isActive={selectedSport === sport}
            activeColor={'#1a1a1a'}
            inactiveColor="transparent"
            activeTextColor={'#ffffff'}
            inactiveTextColor={'#9ca3af'}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: pillPadding,
              borderRadius: '9999px',
              fontSize: pillFontSize,
              fontWeight: '500',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: selectedSport === sport ? ('#4b5563') : ('#1f2937')
            }}
          >
            <span style={{ fontSize: iconSize }}>{getSportIcon(sport)}</span>
            <span>{getSportLabel(sport)}</span>
          </TapSurface>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={handleBetSlipClick}
        pinned={false}
        headerPassed={headerPassed}
        sportsRowPassed={sportsRowPassed}
        renderCondensedSportPills={() => renderSportPills('condensed')}
      />

      {/* Sentinel: placed immediately below the main top nav. When this
          scrolls above the top of the viewport the condensed sticky bar
          mounts (stage 1 — balance / notifications / slip), even before
          the inline sport row leaves view. */}
      <div
        ref={setHeaderSentinelRef}
        aria-hidden="true"
        style={{ height: 1, width: '100%', pointerEvents: 'none' }}
      />

      <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16">
        <div className="mb-2 sm:mb-4">
          <PromoCarousel slides={promoSlides} />
        </div>

        {/* Sentinel: placed immediately above the inline sport-choice row.
            When this scrolls above the top of the viewport the condensed
            sticky header reveals its sport-pill slot (stage 2). */}
        <div
          ref={setSportRowSentinelRef}
          aria-hidden="true"
          style={{ height: 1, width: '100%', pointerEvents: 'none' }}
        />

        <div
          className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-3"
          style={{ backgroundColor: '#000000' }}
        >
          {renderSportPills('inline')}
        </div>

        <LiveBattlesSection
          compact
          currentUserId={user?.id}
          balance={bankroll}
          youVsState={{
            status: hasActiveMatchup
              ? 'active'
              : isWaiting
                ? 'waiting'
                : isQueued
                  ? 'queued'
                  : 'idle',
            myProfile: myProfile || (user ? { id: user.id, username: user.username || user.name, avatar: user.avatar } : null),
            opponent: opponent || null,
            matchup: matchup || null,
            queueEntry: queueEntry || null,
            timeRemaining: timeRemaining,
          }}
          onYouVsClick={() => router.push('/battle')}
          // Wire the in-card chooser modals so Challenge Friend /
          // Private Match open inline (no jump to /battle). The
          // `currentUser` prop is what gates this — without a signed-in
          // profile the chooser falls back to its legacy router
          // hand-off inside YouVsCard.
          friends={friendsList}
          lastBuyIn={lastBuyIn}
          currentUser={profileSnapshot || (user ? { id: user.id, username: user.username || user.name, avatar: user.avatar } : null)}
          onPlayFriendInviteSent={() => {
            // Refresh both: the friends list (its activeMatchupId
            // markers may have changed) and the remembered buy-in
            // (PlayFriendModal writes a new value when an invite is
            // sent). Mirrors /battle's `onInviteSent` behavior.
            fetchFriendsList();
            refreshLastBuyIn();
            refreshMatchup();
          }}
          onPlayFriendInviteCancelled={() => {
            fetchFriendsList();
            refreshMatchup();
          }}
          onPrivateMatchJoined={() => {
            // Once a private match has its second player, hand off to
            // /battle so the user lands in the same lobby/active-
            // battle destination /battle uses today (the matchup is
            // surfaced there from the global MatchupContext).
            refreshMatchup();
            router.push('/battle');
          }}
        />

        {categorizedGames.liveGames.some(g => g.isLive || g.status === 'IN_PROGRESS') && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Close Games</h2>
          </div>
          {closeGames.length === 0 ? (
            <div
              className="rounded-lg px-3 py-2.5"
              style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
            >
              <p className="text-xs" style={{ color: '#6b7280' }}>
                No nail-biters right now — check back soon.
              </p>
            </div>
          ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {closeGames.map((game) => {
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              const isTightened = !!tightenedGames[game.id];
              const isLeadChange = !!leadChangedGames[game.id];
              const hasHighlight = isTightened || isLeadChange;
              // Lead change is the more dramatic event, so its accent wins on the
              // border + glow when both pills are active simultaneously.
              const accentBorder = isLeadChange ? '#f97316' : (isTightened ? '#10b981' : '#1a1a1a');
              const accentShadow = isLeadChange
                ? '0 0 18px rgba(249, 115, 22, 0.40)'
                : (isTightened ? '0 0 18px rgba(16, 185, 129, 0.35)' : 'none');
              const pulseClass = isLeadChange
                ? 'close-game-lead-change'
                : (isTightened ? 'close-game-tightened' : '');
              return (
                <div 
                  key={game.id} 
                  className={`flex-shrink-0 w-[260px] rounded-xl overflow-hidden ${pulseClass}`}
                  style={{
                    backgroundColor: '#0d0d0d',
                    border: `1px solid ${accentBorder}`,
                    boxShadow: accentShadow,
                    transition: 'border-color 250ms ease, box-shadow 250ms ease',
                  }}
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-2 mb-2.5" style={{ minHeight: '22px' }}>
                      <span className="text-gray-500 text-[11px] font-medium truncate" style={{ minWidth: 0 }}>{game.sportName}</span>
                      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                        {isLeadChange && (
                          <div
                            className="flex items-center px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'rgba(249, 115, 22, 0.15)',
                              border: '1px solid rgba(249, 115, 22, 0.45)',
                            }}
                          >
                            <span className="text-orange-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Lead change</span>
                          </div>
                        )}
                        {isTightened && (
                          <div
                            className="flex items-center px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.45)',
                            }}
                          >
                            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{isLeadChange ? 'Closer' : 'Just got closer'}</span>
                          </div>
                        )}
                        {!hasHighlight && isLive && (
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-500 text-[11px] font-semibold">LIVE</span>
                          </div>
                        )}
                        {!hasHighlight && !isLive && (
                          <span className="text-gray-500 text-[11px]">{game.time || 'TBD'}</span>
                        )}
                      </div>
                    </div>
                    <div 
                      className="mb-3 cursor-pointer -mx-1.5 px-1.5 py-1 rounded-lg transition-colors"
                      onClick={() => router.push(`/game/${game.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: '170px' }}>{game.awayTeamFull || game.awayTeam}</span>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: '170px' }}>{game.homeTeamFull || game.homeTeam}</span>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.home?.total || 0}</span>}
                      </div>
                    </div>
                    <GapHistoryStrip history={gapHistories[game.id]} currentGap={game._scoreGap} />
                    <div className="flex gap-1.5">
                      {game.lines?.moneyline?.away ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                          activeColor="#2563eb"
                          inactiveColor={'#141414'}
                          style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : ('#222')}` }}
                        >
                          <div style={{ fontSize: '10px', marginBottom: '1px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTeamName(game.awayTeamFull || game.awayTeam, game.homeTeamFull || game.homeTeam)}</div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.away)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', backgroundColor: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      )}
                      {game.lines?.moneyline?.home ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                          activeColor="#2563eb"
                          inactiveColor={'#141414'}
                          style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : ('#222')}` }}
                        >
                          <div style={{ fontSize: '10px', marginBottom: '1px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTeamName(game.homeTeamFull || game.homeTeam, game.awayTeamFull || game.awayTeam)}</div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.home)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', backgroundColor: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{selectedSport === 'Live' ? 'Live Now' : getSportLabel(selectedSport)}</h2>
              {selectedSport === 'Live' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>}
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm" style={{ color: '#6b7280' }}>Loading games...</p>
              </div>
            ) : games.length > 0 ? (
              games.map(game => {
                const sport = game.sportName || 'NBA';
                const isExpanded = expandedGames[game.id];
                const isLive = game.isLive || game.status === 'IN_PROGRESS';
                const isFinal = game.isCompleted || game.status === 'FINAL';
                const hasAnyLines = game.lines && (game.lines.moneyline || game.lines.spread || game.lines.total);
                const linesLocked = game.linesLocked || isFinal || !hasAnyLines;
                
                return (
                  <div 
                    key={game.id} 
                    className="rounded-xl overflow-hidden" 
                    style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}
                  >
                    <div className="px-3.5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[11px] font-medium">{game.league || sport}</span>
                          {game.isSimulated && (
                            <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">DEMO</span>
                          )}
                          {isFinal ? (
                            <span className="text-gray-500 text-[11px] font-semibold">FINAL</span>
                          ) : isLive ? (
                            <LiveGameTimer 
                              elapsedTime={game.elapsedTime || game.displayClock}
                              period={game.period || game.quarter}
                              sport={game.sport || sport}
                              stateCode={game.stateCode}
                            />
                          ) : (
                            <span className="text-gray-500 text-[11px] font-medium">{game.time || 'TBD'}</span>
                          )}
                        </div>
                      </div>
                      
                      <div 
                        className="mb-3 cursor-pointer -mx-1.5 px-1.5 py-0.5 rounded-lg transition-colors"
                        onClick={() => router.push(`/game/${game.id}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: 'calc(100% - 40px)' }}>{game.awayTeamFull || game.awayTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-sm tabular-nums flex-shrink-0 ml-2" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>
                          ) : (
                            <span className="text-gray-600 text-sm flex-shrink-0 ml-2">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: 'calc(100% - 40px)' }}>{game.homeTeamFull || game.homeTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-sm tabular-nums flex-shrink-0 ml-2" style={{ color: '#ffffff' }}>{game.scores?.home?.total || 0}</span>
                          ) : (
                            <span className="text-gray-600 text-sm flex-shrink-0 ml-2">-</span>
                          )}
                        </div>
                      </div>


                      {linesLocked ? (
                        <div>
                          <div className="flex gap-1.5 mb-1">
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Spread</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>ML</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Total</div>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            {[0,1,2].map(i => (
                              <div key={`lock-a-${i}`} className="flex-1 rounded-lg flex items-center justify-center" style={{ padding: '6px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            {[0,1,2].map(i => (
                              <div key={`lock-h-${i}`} className="flex-1 rounded-lg flex items-center justify-center" style={{ padding: '6px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex gap-1.5 mb-1">
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Spread</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>ML</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Total</div>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            {game.lines?.spread?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#fff' : ('#d1d5db') }}>{formatSpread(game.lines.spread.away.point)}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.away.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.away)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.over ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                                isActive={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#fff' : ('#d1d5db') }}>{formatTotal(game.lines.total.over.point, 'over')}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.over.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {game.lines?.spread?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#fff' : ('#d1d5db') }}>{formatSpread(game.lines.spread.home.point)}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.home.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.home)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.under ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                                isActive={isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#fff' : ('#d1d5db') }}>{formatTotal(game.lines.total.under.point, 'under')}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.under.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10">
                <div className="rounded-xl p-6 max-w-sm mx-auto" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#ffffff' }}>No Games Available</p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>Check back later for {selectedSport} games.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {showBattleWalkthrough && hasActiveMatchup && matchup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <style>{`
            @keyframes wtSlideUp {
              from { opacity: 0; transform: translateY(30px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes wtPulse {
              0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
              50% { box-shadow: 0 0 40px rgba(59,130,246,0.5); }
            }
            @keyframes wtFadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div 
            className="w-full max-w-[380px] rounded-2xl overflow-hidden flex flex-col"
            style={{ 
              background: 'linear-gradient(180deg, #0a1628 0%, #0d0d0d 100%)',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              animation: 'wtSlideUp 0.4s ease-out, wtPulse 3s ease-in-out infinite',
              boxShadow: 'none',
              maxHeight: 'calc(100dvh - 2rem)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: walkthroughStep === i ? '24px' : '8px', backgroundColor: walkthroughStep >= i ? '#3b82f6' : ('#333') }}></div>
                ))}
              </div>
              <button onClick={() => { setShowBattleWalkthrough(false); setWalkthroughDismissed(true); setWalkthroughStep(0); }} className="text-gray-600 text-xs">Skip</button>
            </div>

            <div key={walkthroughStep} className="flex-1 overflow-y-auto min-h-0" style={{ animation: 'wtFadeIn 0.3s ease-out' }}>
              {walkthroughStep === 0 && (
                <>
                  <div className="px-5 pt-2 pb-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs font-bold uppercase tracking-wider">Battle Started</span>
                    </div>
                    <h2 className={`text-xl font-bold mb-1 ${'text-white'}`}>You're Matched!</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>You've been paired for a 1v1 battle.</p>
                  </div>
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #3b82f6' }}>
                          {(myProfile?.avatar || user?.avatar) ? (
                            <img src={myProfile?.avatar || user?.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-bold text-lg ${'text-white'}`}>{(myProfile?.username || user?.username || user?.name || '')[0]?.toUpperCase() || 'P'}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate max-w-[90px] ${'text-white'}`}>{myProfile?.username || user?.username || user?.name || ''}</p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <span className="text-2xl font-black text-blue-400">VS</span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #06b6d4' }}>
                          {opponent?.avatar ? (
                            <img src={opponent.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-bold text-lg ${'text-white'}`}>{(opponent?.username || 'O')[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate max-w-[90px] ${'text-white'}`}>{opponent?.username || 'Opponent'}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Mode</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>{matchup.durationMinutes <= 200 ? 'RUSH' : matchup.durationMinutes <= 1500 ? 'ORIGINAL' : 'TOURNAMENT'}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Pot</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>${(() => {
                          const payout = parseFloat(matchup.winnerPayout);
                          if (payout > 0) return payout.toLocaleString();
                          const gross = parseFloat(matchup.potSize || matchup.startingBalance * 2 || 20000);
                          const fee = parseFloat(matchup.platformFee);
                          const net = fee > 0 ? gross - fee : gross - gross * 0.10;
                          return net.toLocaleString();
                        })()}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Time</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>
                          {timeRemaining ? (() => {
                            const m = Math.floor(timeRemaining / 60000);
                            const h = Math.floor(m / 60);
                            const d = Math.floor(h / 24);
                            if (d > 0) return `${d}d ${h % 24}h`;
                            if (h > 0) return `${h}h ${m % 60}m`;
                            return `${m}m`;
                          })() : 'Starting'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {walkthroughStep === 1 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <h2 className={`text-lg font-bold mb-1 ${'text-white'}`}>How It Works</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>Three simple steps to win</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-xs font-bold">1</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Place Your Picks</p>
                        <p className="text-gray-500 text-xs">Browse games below and add bets to your slip. Pick spreads, moneylines, or totals.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-400 text-xs font-bold">2</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Grow Your Balance</p>
                        <p className="text-gray-500 text-xs">You both start with ${parseFloat(matchup.startingBalance || 10000).toLocaleString()}. Winning picks grow your bankroll.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-orange-400 text-xs font-bold">3</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Highest Balance Wins</p>
                        <p className="text-gray-500 text-xs">When time runs out, the player with the higher balance takes 90% of the pot.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 2 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">💡</span>
                    </div>
                    <h2 className={`text-lg font-bold mb-1 ${'text-white'}`}>Tips to Win</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>Quick strategy guide</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">📊</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Track the Banner</p>
                        <p className="text-gray-500 text-xs">Your battle status bar at the top shows both balances and time left in real-time.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">🔒</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Hidden Bets</p>
                        <p className="text-gray-500 text-xs">Your opponent can't see your picks until you've placed at least one bet — and vice versa.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">⚡</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Manage Risk</p>
                        <p className="text-gray-500 text-xs">Don't go all-in early. Spread your bets across games to build a steady lead.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex-shrink-0 flex gap-2">
              {walkthroughStep > 0 && (
                <button
                  onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                  className="py-3 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb', border: '1px solid #333' }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (walkthroughStep < 2) {
                    setWalkthroughStep(walkthroughStep + 1);
                  } else {
                    setShowBattleWalkthrough(false);
                    setWalkthroughDismissed(true);
                    setWalkthroughStep(0);
                  }
                }}
                className="btn-lift flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              >
                {walkthroughStep === 0 ? 'How Does It Work?' : walkthroughStep === 1 ? 'Got It, Any Tips?' : 'Start Picking'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        @media (hover: none) and (pointer: coarse) {
          button:hover {
            background-color: inherit !important;
            border-color: inherit !important;
            transform: none !important;
          }
        }
      `}</style>

      <ForfeitConfirmedModal
        isOpen={!!forfeitConfirmation}
        onClose={() => setForfeitConfirmation(null)}
        opponent={forfeitConfirmation?.opponent}
        payout={forfeitConfirmation?.payout}
        totalPot={forfeitConfirmation?.totalPot}
      />
    </div>
  );
}

// Server-side rendering for ZERO delay game loading
// Serve cached data instantly - never block on cache warming
export async function getServerSideProps() {
  try {
    const { getInplayService } = require('../lib/goalserve-inplay');
    const { getScheduledGamesForSSR } = require('../lib/goalserve-autostart');
    
    const service = getInplayService();
    
    // Get whatever is cached RIGHT NOW - no waiting
    const events = service.getEventsForSSR();
    const scheduledGames = getScheduledGamesForSSR();
    
    console.log(`[Dashboard SSR] Serving ${events.length} live + ${scheduledGames.length} scheduled (instant)`);
    
    return {
      props: {
        initialInplayEvents: events,
        initialApiGames: scheduledGames,
      },
    };
  } catch (error) {
    console.error('[Dashboard SSR] Error:', error);
    return {
      props: {
        initialInplayEvents: [],
        initialApiGames: [],
      },
    };
  }
}
