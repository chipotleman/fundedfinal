import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import TapSurface from '../components/TapSurface';
import TeamLogo from '../components/TeamLogo';
import LiveGameTimer from '../components/LiveGameTimer';
import DepositMatchContainer from '../components/DepositMatchContainer';
import TrendingBetContainer from '../components/TrendingBetContainer';
import DepositMatchAppliedBanner from '../components/DepositMatchAppliedBanner';
import CasinoDepositMatchContainer from '../components/CasinoDepositMatchContainer';
import FireBattleContainer from '../components/FireBattleContainer';
import PoolContainer from '../components/PoolContainer';
import ReferralBonusContainer from '../components/ReferralBonusContainer';
import MostSharedBadgeContainer from '../components/MostSharedBadgeContainer';
import RushExplainerContainer from '../components/RushExplainerContainer';
import PickBattlesContainer from '../components/PickBattlesContainer';
import BetaChallengeContainer from '../components/BetaChallengeContainer';
import PremiumDiscordContainer from '../components/PremiumDiscordContainer';
import FreePickContainer from '../components/FreePickContainer';
import TopCappersContainer from '../components/TopCappersContainer';
import PromoCarousel from '../components/PromoCarousel';
import { DEFAULT_PROMO_SLOTS, normalizePromoSlots } from '../lib/promoSlots';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import LiveBattlesSection from '../components/battle/LiveBattlesSection';
import DesktopRightRail from '../components/desktop/DesktopRightRail';
import DesktopScrollRow from '../components/desktop/DesktopScrollRow';
import Footer from '../components/Footer';
import { readLastBuyIn, fetchLastBuyIn } from '../utils/lastBattleBuyIn';
import { inferLeague } from '../lib/leagueInference';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useBetaMode } from '../contexts/SiteConfigContext';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import haptic from '../utils/haptics';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';
import { useGoalserveLive } from '../hooks/useGoalserveLive';
import useModalScrollLock from '../hooks/useModalScrollLock';
import useLeadChangeCue from '../hooks/useLeadChangeCue';

// Tiny inline strip showing the recent score-gap trajectory for a close-games
// card. Renders a small SVG sparkline plus a "Gap N" label tinted by trend
// (green = closing, orange = widening, gray = stable). Always reserves the
// same vertical space so newly arriving history can't shift the card layout.
function GapHistoryStrip({ history, currentGap }) {
  // Always render at the same height + with a "MONEYLINE" label on the
  // left so the row never reads as empty space. When there's enough
  // score-gap history to draw a trend, the tiny line chart and gap
  // delta render on the right; otherwise it's just the label, which
  // also makes it crystal-clear which bet type the two odds buttons
  // below are placing.
  const RESERVED_HEIGHT = 18;
  const points = Array.isArray(history) ? history : [];
  const hasUsable = points.length >= 2;

  const moneylineLabel = (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: '#6b7280', letterSpacing: '0.08em' }}
    >
      Moneyline
    </span>
  );

  if (!hasUsable) {
    return (
      <div
        className="mb-2 flex items-center justify-center"
        style={{ height: RESERVED_HEIGHT }}
      >
        {moneylineLabel}
      </div>
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
      className="mb-2 flex items-center justify-center gap-2"
      style={{ height: RESERVED_HEIGHT }}
      title={`Recent score gaps: ${points.join(' → ')}`}
    >
      {moneylineLabel}
      <div className="flex items-center gap-1.5">
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
    </div>
  );
}

// Skeleton placeholder card that mirrors the structure of a real game
// card on the dashboard. Used when we have no games to show yet (true
// cold start with no cache and no SSR data) so the surface always has
// shape and never flashes a spinner or "No Games Available" copy while
// the first fetch is in flight.
function GameCardSkeleton() {
  const cellBg = '#111';
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a', boxShadow: 'none' }}
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-12 rounded" style={{ backgroundColor: '#1a1a1a' }} />
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="h-4 w-32 rounded" style={{ backgroundColor: '#1a1a1a' }} />
            <div className="h-4 w-6 rounded" style={{ backgroundColor: '#1a1a1a' }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded" style={{ backgroundColor: '#1a1a1a' }} />
            <div className="h-4 w-6 rounded" style={{ backgroundColor: '#1a1a1a' }} />
          </div>
        </div>
        <div>
          <div className="flex gap-1.5 mb-1">
            {[0, 1, 2].map(i => (
              <div key={`hdr-${i}`} className="flex-1 h-2.5 rounded" style={{ backgroundColor: '#1a1a1a', opacity: 0.6 }} />
            ))}
          </div>
          <div className="flex gap-1.5 mb-1.5">
            {[0, 1, 2].map(i => (
              <div key={`row-a-${i}`} className="flex-1 rounded-md" style={{ height: 30, backgroundColor: cellBg }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={`row-h-${i}`} className="flex-1 rounded-md" style={{ height: 30, backgroundColor: cellBg }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isBeta = useBetaMode();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const { apiGames: contextApiGames, inplayEvents: contextInplayEvents, loading: gamesLoading, hasFetchedOnce: gamesHasFetchedOnce, error: gamesError, lastUpdated, isDemoMode } = useGames();
  const { matchup, opponent, myProfile, hasActiveMatchup, isWaiting, isQueued, queueEntry, timeRemaining, refresh: refreshMatchup, myBalance: matchupMyBalance, opponentBalance: matchupOppBalance, myLiveBalance, opponentLiveBalance, myUnrealizedPnl, opponentUnrealizedPnl } = useMatchup();
  const [selectedSport, setSelectedSport] = useState('Live');
  const [showBattleWalkthrough, setShowBattleWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const [walkthroughDontShowAgain, setWalkthroughDontShowAgain] = useState(false);
  // True when the user arrived here straight from the QuickMatchModal
  // "MATCH READY" splash — that splash already showed the matched
  // celebration, so the walkthrough opens on step 1 ("How it works")
  // and the Back button can't return to the redundant step 0.
  const [walkthroughSkipIntro, setWalkthroughSkipIntro] = useState(false);
  const closeWalkthrough = () => {
    if (walkthroughDontShowAgain && typeof window !== 'undefined') {
      try { window.localStorage.setItem('piks_battle_walkthrough_dismissed', '1'); } catch (_) {}
    }
    setShowBattleWalkthrough(false);
    setWalkthroughDismissed(true);
    setWalkthroughStep(0);
    setWalkthroughSkipIntro(false);
  };
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);
  const [promoSlots, setPromoSlots] = useState(() =>
    DEFAULT_PROMO_SLOTS.map((s) => ({ ...s })),
  );
  // Master switch for the whole promo row — when an admin turns it off the
  // carousel is removed entirely and the page below shifts up. Defaults to
  // OFF so the row stays hidden until an admin explicitly enables it (and so
  // it never flashes on before the /api/promo-slots fetch resolves).
  const [promoRowEnabled, setPromoRowEnabled] = useState(false);

  const battleStartedRetryRef = useRef(null);
  // Guards the battleStarted effect so it initializes the walkthrough
  // (step + skip-intro flag consumption) exactly once per query cycle —
  // the effect also re-runs when `hasActiveMatchup` flips, and without
  // this guard that re-run would reset the step back to 0 and re-show
  // the intro the splash already covered.
  const battleStartedHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/promo-slots')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.slots) setPromoSlots(normalizePromoSlots(data.slots));
        if (typeof data.rowEnabled === 'boolean') setPromoRowEnabled(data.rowEnabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const promoSlides = useMemo(() => {
    const renderers = {
      // Temporarily hidden per product request — return null so even
      // stored promo-slot configs that still reference these types are
      // dropped at render time (the slot loop filters out null nodes).
      reload_match: () => null,
      trending: () => <TrendingBetContainer />,
      deposit_match_applied: () => <DepositMatchAppliedBanner />,
      casino_match: () => <CasinoDepositMatchContainer />,
      fire_battle: () => <FireBattleContainer />,
      pool: () => <PoolContainer />,
      referral: () => <ReferralBonusContainer />,
      most_shared_badge: () => <MostSharedBadgeContainer />,
      beta_challenge: () => <BetaChallengeContainer />,
      rush_explainer: () => null,
      pick_battles: () => <PickBattlesContainer />,
      premium_discord: () => <PremiumDiscordContainer />,
      free_pick: () => null,
      top_cappers: () => <TopCappersContainer />,
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
    if (router.query.battleStarted !== 'true') {
      // Query cleared — reset the guard so the next battleStarted cycle
      // re-initializes the walkthrough from scratch.
      battleStartedHandledRef.current = false;
      return;
    }

    // This effect also re-runs when `hasActiveMatchup` flips. On those
    // re-runs only finish the URL cleanup once the matchup has hydrated —
    // never re-initialize the walkthrough step (that would undo the
    // skip-intro and flash step 0 back in).
    if (battleStartedHandledRef.current) {
      if (hasActiveMatchup) {
        router.replace('/', undefined, { shallow: true });
        if (battleStartedRetryRef.current) {
          clearInterval(battleStartedRetryRef.current);
          battleStartedRetryRef.current = null;
        }
      }
      return;
    }
    battleStartedHandledRef.current = true;

    // Always consume the one-shot "came from MATCH READY splash" flag
    // FIRST — even if we bail on don't-show-again below — so it can never
    // leak into a later, unrelated battleStarted cycle.
    let cameFromSplash = false;
    if (typeof window !== 'undefined') {
      try {
        cameFromSplash = window.sessionStorage.getItem('piks_battle_intro_seen') === '1';
        if (cameFromSplash) window.sessionStorage.removeItem('piks_battle_intro_seen');
      } catch (_) {}
    }

    // Respect the user's "Don't show this again" preference — clear the
    // query string and bail before the walkthrough overlay ever renders.
    if (typeof window !== 'undefined' && window.localStorage.getItem('piks_battle_walkthrough_dismissed') === '1') {
      router.replace('/', undefined, { shallow: true });
      return;
    }

    // Open the educational "How It Works" walkthrough right after the
    // battle starts. When the user came straight from the QuickMatchModal
    // "MATCH READY" splash, that splash already played the "You're Matched!"
    // celebration — so skip the redundant intro (step 0, the duplicate
    // match popup we removed) and open directly on step 1 ("How it works").
    // Otherwise (rare non-modal battleStarted navigation) start at step 0.
    // The walkthrough renders a loading skeleton internally until the
    // matchup payload finishes hydrating, so the dashboard never flashes.
    window.scrollTo({ top: 0, behavior: 'auto' });
    setWalkthroughSkipIntro(cameFromSplash);
    setWalkthroughStep(cameFromSplash ? 1 : 0);
    setShowBattleWalkthrough(true);

    if (hasActiveMatchup) {
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
      const sortedLive = sortChronologically(liveGames);
      // Live tab should never appear empty when there are still games to
      // show — fall back to upcoming so the surface stays populated even
      // during quiet moments between live games.
      if (sortedLive.length > 0) return sortedLive;
      return sortChronologically(upcomingGames);
    }
    
    const sportLiveGames = filterBySport(liveGames, selectedSport);
    const sportUpcomingGames = filterBySport(upcomingGames, selectedSport);
    return sortChronologically([...sportLiveGames, ...sportUpcomingGames]);
  }, [selectedSport, categorizedGames, sportMappings]);

  // True when the Live tab is showing the upcoming-games fallback because
  // there are no live games at the moment. Used to swap the section header
  // so we don't claim "Live Now" while rendering scheduled games.
  const isLiveTabFallbackToUpcoming = useMemo(() => {
    if (selectedSport !== 'Live') return false;
    if (games.length === 0) return false;
    return !games.some(g => g.isLive || g.status === 'IN_PROGRESS');
  }, [selectedSport, games]);

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
    haptic.tap();
    setSelectedSport(sport);
  };

  // Condensed-header engagement on the home page.
  //
  // A sentinel placed just above the inline sport-pill row tells us when
  // those pills have scrolled above the top of the viewport. Only then
  // does the condensed sticky bar mount — so the bar always reveals
  // with its sport pills already inside it (no empty/black intermediate
  // state when the user is between the main nav and the pills row).
  //
  // The observer uses IntersectionObserver (root: null) so the engaged
  // state re-fires on every scroll-up-then-down pass — a previous
  // direct scroll handler worked once on iOS Safari and then got stuck.
  // The sentinel is wired through a state variable + callback ref so
  // that if its DOM node remounts (route transition back, conditional
  // re-mount) the observer rebinds against the fresh node. A plain
  // `useRef` would not trigger that re-bind.
  const [sportsSentinelNode, setSportsSentinelNode] = useState(null);
  const setSportRowSentinelRef = useCallback((node) => {
    setSportsSentinelNode(node || null);
  }, []);
  const [sportsRowPassed, setSportsRowPassed] = useState(false);

  useEffect(() => {
    if (!sportsSentinelNode) return undefined;
    // Sync the engaged state from the sentinel's current position. Reading
    // `getBoundingClientRect().top < 0` is the same predicate the observer
    // uses, so calling this from either the observer callback or a scroll
    // listener produces identical results — no direction tracking, no
    // "stuck once" state machine.
    const syncFromRect = () => {
      const rect = sportsSentinelNode.getBoundingClientRect();
      const above = rect.top < 0;
      setSportsRowPassed((prev) => (prev === above ? prev : above));
    };

    let observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          setSportsRowPassed((prev) => (prev === above ? prev : above));
        },
        { root: null, threshold: 0 }
      );
      observer.observe(sportsSentinelNode);
    }

    // iOS Safari fallback: the IntersectionObserver can stay silent across
    // an address-bar collapse / expand or after a momentum-scroll lands
    // exactly on the threshold, leaving the bar stuck mounted/unmounted.
    // A passive scroll/resize listener re-checks the sentinel position
    // directly so the engaged state always tracks reality on every frame
    // the user is scrolling. The state setter short-circuits when the
    // value hasn't changed, so React only re-renders on the actual flip.
    const handleScroll = () => {
      // requestAnimationFrame keeps the math off the scroll event thread
      // on slower devices while still being well under one frame.
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(syncFromRect);
      } else {
        syncFromRect();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    window.addEventListener('orientationchange', handleScroll);
    // Initial sync in case we mounted mid-scroll (browser scroll restoration).
    syncFromRect();

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('orientationchange', handleScroll);
    };
  }, [sportsSentinelNode]);

  // Reusable sport-pill row. Rendered inline at the top of the page AND
  // inside the condensed sticky header — both share the same selectedSport
  // state so picking a sport in either updates both immediately.
  //
  // For the condensed bar we bundle leagues that share the same emoji
  // (e.g., NFL + NCAAF, NBA + NCAAB + Euro Basketball, NHL + Int'l
  // Hockey) into a single pill so the icon row doesn't show duplicate
  // 🏈/🏀/🏒. Tapping a bundled pill cycles through the leagues inside
  // it, so both leagues remain reachable from the condensed bar.
  const renderSportPills = (variant = 'inline') => {
    const isCondensed = variant === 'condensed';
    // When the Pik Slip is empty in the condensed sticky header, the
    // bet-slip button is hidden and the pills row owns the full width
    // — spread them evenly so the bar doesn't look lopsided. As soon
    // as the user adds a pick, the bet-slip button mounts on the right
    // and we collapse back to the natural left-packed layout.
    const spreadEvenly = isCondensed && (betSlip?.length || 0) === 0;
    // Match the inline pill sizing in the condensed bar too — earlier
    // we shrank them, but that made the condensed row look mismatched
    // against the desktop top-nav icons that sit alongside the pills.
    const pillPadding = '10px 16px';
    const pillFontSize = '14px';
    const iconSize = '16px';

    // Build the per-variant list of pill sources. For the inline row
    // each league is its own pill; for the condensed bar we collapse
    // by emoji into bundles, preserving the original sport order so
    // the first-occurrence league becomes the bundle's default tap.
    let pillSources;
    if (isCondensed) {
      const byIcon = new Map();
      const groups = [];
      for (const sport of sports) {
        const icon = getSportIcon(sport);
        const existing = byIcon.get(icon);
        if (existing) {
          existing.sports.push(sport);
        } else {
          const group = { icon, sports: [sport] };
          byIcon.set(icon, group);
          groups.push(group);
        }
      }
      pillSources = groups.map((g) => ({
        key: g.icon,
        icon: g.icon,
        sports: g.sports,
      }));
    } else {
      pillSources = sports.map((sport) => ({
        key: sport,
        icon: getSportIcon(sport),
        sports: [sport],
      }));
    }

    return (
      <div
        className={`flex items-center overflow-x-auto scrollbar-hide ${spreadEvenly ? 'justify-between gap-1.5 w-full' : 'space-x-2'} ${isCondensed ? '' : 'pb-1'}`}
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
        {pillSources.map((pill) => {
          // For inline pills `pill.sports` always has length 1 so this
          // collapses back to the original single-league behavior.
          const isActive = pill.sports.includes(selectedSport);
          const isBundle = pill.sports.length > 1;
          const handleTap = () => {
            if (!isBundle) {
              handleSportClick(pill.sports[0]);
              return;
            }
            // Bundled (condensed) pill: cycle through the leagues so
            // both NBA + NCAAB (etc.) remain reachable from the bar.
            if (!isActive) {
              handleSportClick(pill.sports[0]);
              return;
            }
            const idx = pill.sports.indexOf(selectedSport);
            const next = pill.sports[(idx + 1) % pill.sports.length];
            handleSportClick(next);
          };
          const labelList = pill.sports.map(getSportLabel).join(' / ');
          // Total available games (live + upcoming) across every
          // league inside this pill. Used as the badge value on the
          // condensed bar so the small superscript number reflects
          // *games* rather than *leagues* (per user feedback). We
          // walk the full categorized lists and de-dupe by id so
          // bundles don't double-count games that somehow appear in
          // both buckets.
          const liveList = categorizedGames.liveGames || [];
          const upcomingList = categorizedGames.upcomingGames || [];
          const validNamesUpper = new Set(
            pill.sports.flatMap((s) => (sportMappings[s] || [s]).map((n) => n.toUpperCase()))
          );
          const seenIds = new Set();
          let gameCount = 0;
          for (const g of [...liveList, ...upcomingList]) {
            const nameUpper = (g.sportName || '').toUpperCase();
            if (!validNamesUpper.has(nameUpper)) continue;
            const id = g.id ?? `${g.sportName}-${g.startTime}-${g.homeTeam}-${g.awayTeam}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            gameCount += 1;
          }
          // On desktop the condensed bar has plenty of room, so we
          // expand condensed pills to look like inline pills (full
          // label + inline count) and hide the cramped absolute
          // game-count badge. On mobile they stay emoji-only with the
          // floating superscript count.
          const condensedClass = isCondensed
            ? 'gap-0 md:gap-2 px-2.5 py-[5px] md:px-4 md:py-2.5 text-[12px] md:text-[14px] preserve-active-ring'
            : 'preserve-active-ring';
          return (
            <TapSurface
              key={pill.key}
              onTap={handleTap}
              isActive={isActive}
              activeColor={'#1a1a1a'}
              inactiveColor="transparent"
              activeTextColor={'#ffffff'}
              inactiveTextColor={'#9ca3af'}
              aria-label={labelList}
              title={isCondensed ? labelList : undefined}
              className={condensedClass}
              style={{
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...(isCondensed
                  ? {}
                  : {
                      gap: '8px',
                      padding: pillPadding,
                      fontSize: pillFontSize,
                    }),
                borderRadius: '9999px',
                fontWeight: '500',
                borderWidth: '1px',
                borderStyle: 'solid',
                // Colored active outline (per user feedback): when a
                // sport pill is selected it now gets a blue ring +
                // soft glow instead of the previous near-invisible
                // gray border. We use box-shadow for the ring so the
                // pill width doesn't shift when active vs. inactive.
                borderColor: isActive ? '#3b82f6' : '#1f2937',
                boxShadow: 'none',
                transition: 'box-shadow 140ms ease-out, border-color 140ms ease-out',
              }}
            >
              <span style={{ fontSize: isCondensed ? '18px' : iconSize, lineHeight: 1 }}>{pill.icon}</span>
              {!isCondensed && <span>{getSportLabel(pill.sports[0])}</span>}
              {isCondensed && (
                // Desktop-only inline label (+ count) for condensed
                // pills. On mobile this stays hidden and the absolute
                // game-count badge below provides the at-a-glance
                // count instead.
                <span className="hidden md:inline">
                  {getSportLabel(pill.sports[0])}
                  {gameCount > 0 ? ` (${gameCount})` : ''}
                </span>
              )}
              {isCondensed && gameCount > 0 && (
                // Game-count badge — was previously the *league*
                // count (only shown on bundled pills). Per user
                // feedback we now show the live + upcoming game
                // total for this pill on every condensed pill that
                // has at least one game. Absolutely positioned so
                // it doesn't change the pill's hit area or layout.
                // Hidden on desktop (md+) where the inline label
                // above already includes the count.
                <span
                  aria-hidden="true"
                  className="md:hidden"
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    borderRadius: 9999,
                    backgroundColor: isActive ? '#3b82f6' : '#1f2937',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: '14px',
                    textAlign: 'center',
                    border: '1.5px solid #000000',
                    pointerEvents: 'none',
                  }}
                >
                  {gameCount}
                </span>
              )}
            </TapSurface>
          );
        })}
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
        sportsRowPassed={sportsRowPassed}
        renderCondensedSportPills={() => renderSportPills('condensed')}
      />

      <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 lg:flex lg:gap-8 lg:max-w-[1600px] lg:mx-auto">
        <div className="lg:flex-1 lg:min-w-0">
        {/* Carousel→pills gap halved per user feedback: was
            `mb-2 sm:mb-4` + `py-2` (16px mobile / 24px sm+), now
            `mb-1 sm:mb-2` + `py-1` (8px mobile / 12px sm+).
            Negative horizontal margin breaks the carousel out of the
            outer page padding so it runs edge-to-edge across the
            viewport — partial-card peeks should bleed off the screen,
            not stop short with a visible side gutter. */}
        {promoRowEnabled && (
          <div className="mb-1 sm:mb-2 -mx-4 sm:-mx-6 lg:mx-0">
            <PromoCarousel slides={promoSlides} />
          </div>
        )}

        {/* Sentinel: placed immediately above the inline sport-choice row.
            When this scrolls above the top of the viewport the condensed
            sticky header mounts with its sport pills already in place. */}
        <div
          ref={setSportRowSentinelRef}
          aria-hidden="true"
          style={{ height: 1, width: '100%', pointerEvents: 'none' }}
        />

        <div
          className="piks-sports-pills-row -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 py-1 mb-3"
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
            // Forwarded so the YouVsCard active layout can render
            // per-player balance + PnL on desktop (preserving the
            // information density of the old hero-arena header).
            myBalance: matchupMyBalance,
            opponentBalance: matchupOppBalance,
            myLiveBalance,
            opponentLiveBalance,
            myUnrealizedPnl,
            opponentUnrealizedPnl,
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
          // Edge-to-edge scroll row: negative margin cancels the
          // outer page padding so the row runs to the viewport
          // edges; inner left padding keeps the first card aligned
          // with the "Close Games" header above. Right side bleeds
          // so the trailing card peeks off-screen.
          <DesktopScrollRow innerClassName="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-4 sm:-mx-6 lg:mx-0 pl-4 sm:pl-6 lg:pl-0 pr-2">
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
                  className={`flex-shrink-0 w-[260px] rounded-xl overflow-hidden flex flex-col piks-game-card ${pulseClass}`}
                  style={{
                    backgroundColor: '#0d0d0d',
                    border: `1px solid ${accentBorder}`,
                    boxShadow: accentShadow,
                    transition: 'border-color 250ms ease, box-shadow 250ms ease',
                  }}
                >
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5" style={{ minHeight: '20px' }}>
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
                      className="mb-2 cursor-pointer -mx-1.5 px-1.5 py-0.5 rounded-lg transition-colors"
                      onClick={() => router.push(`/game/${game.id}`)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2 min-w-0" style={{ maxWidth: '190px' }}>
                          <TeamLogo name={game.awayTeamFull || game.awayTeam} sport={game.sport} sportName={game.sportName} league={game.league} size={18} />
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff' }}>{game.awayTeamFull || game.awayTeam}</span>
                        </div>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0" style={{ maxWidth: '190px' }}>
                          <TeamLogo name={game.homeTeamFull || game.homeTeam} sport={game.sport} sportName={game.sportName} league={game.league} size={18} />
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff' }}>{game.homeTeamFull || game.homeTeam}</span>
                        </div>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.home?.total || 0}</span>}
                      </div>
                    </div>
                    <div className="mt-auto">
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
                </div>
              );
            })}
          </DesktopScrollRow>
          )}
        </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                {selectedSport === 'Live'
                  ? (isLiveTabFallbackToUpcoming ? 'Upcoming' : 'Live Now')
                  : getSportLabel(selectedSport)}
              </h2>
              {selectedSport === 'Live' && !isLiveTabFallbackToUpcoming && (
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {games.length > 0 ? (
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
                    className="rounded-xl overflow-hidden piks-game-card" 
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
                          <div className="flex items-center gap-2 min-w-0" style={{ maxWidth: 'calc(100% - 40px)' }}>
                            <TeamLogo name={game.awayTeamFull || game.awayTeam} sport={game.sport} sportName={game.sportName} league={game.league} size={20} />
                            <span className="font-medium text-sm truncate" style={{ color: '#ffffff' }}>{game.awayTeamFull || game.awayTeam}</span>
                          </div>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-sm tabular-nums flex-shrink-0 ml-2" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>
                          ) : (
                            <span className="text-gray-600 text-sm flex-shrink-0 ml-2">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0" style={{ maxWidth: 'calc(100% - 40px)' }}>
                            <TeamLogo name={game.homeTeamFull || game.homeTeam} sport={game.sport} sportName={game.sportName} league={game.league} size={20} />
                            <span className="font-medium text-sm truncate" style={{ color: '#ffffff' }}>{game.homeTeamFull || game.homeTeam}</span>
                          </div>
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
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                {/* Single-value ML — flex-centered both axes
                                    so the odds sit in the middle of the cell
                                    while still matching spread/total height
                                    via flex sibling stretching. */}
                                <div style={{ fontWeight: '600', fontSize: '12px', lineHeight: 1.5, color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#fff' : '#3b82f6' }}>
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
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                {/* See away ML — flex-centered single value. */}
                                <div style={{ fontWeight: '600', fontSize: '12px', lineHeight: 1.5, color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#fff' : '#3b82f6' }}>
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
            ) : !gamesHasFetchedOnce ? (
              // Cold start with no SSR data and no cached games yet — render
              // skeleton cards that mirror the real card layout so the
              // dashboard always shows *something* instead of a blank flash
              // or a spinner. Once the first fetch resolves we'll either
              // have games (handled above) or fall through to the empty
              // state below.
              <>
                {[0, 1, 2, 3].map(i => (
                  <GameCardSkeleton key={`skeleton-${i}`} />
                ))}
              </>
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
        <aside className="hidden lg:block lg:w-[330px] lg:flex-shrink-0">
          <DesktopRightRail isLoggedIn={!!user} />
        </aside>
      </div>

      <Footer />

      {showBattleWalkthrough && !(hasActiveMatchup && matchup) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <div
            className="w-full max-w-[380px] rounded-2xl overflow-hidden flex flex-col items-center justify-center py-12 relative"
            style={{
              background: 'linear-gradient(180deg, #0b1830 0%, #061022 55%, #03070f 100%)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 8px 0 #0a0a0a, 0 0 60px rgba(6,182,212,0.35), inset 0 0 0 1.5px rgba(6,182,212,0.55)',
            }}
          >
            <div className="w-12 h-12 rounded-full mb-3" style={{
              border: '3px solid rgba(6,182,212,0.25)',
              borderTopColor: '#06b6d4',
              animation: 'wtSpin 0.9s linear infinite',
            }} />
            <p className="text-white text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: '#7dd3fc' }}>Loading your battle…</p>
            <style>{`@keyframes wtSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
      {showBattleWalkthrough && hasActiveMatchup && matchup && (() => {
        // Cartoon-themed battle walkthrough — visually matches the
        // QuickMatchModal "MATCH FOUND" reference (yellow/orange title
        // with bolts, blue-bordered info pill, avatars with colored
        // rings, big yellow CTA, hover gated). All 3 steps share the
        // same shell so the walkthrough feels like one cohesive
        // cartoon flow instead of a plain dark utility popup.
        const myName = myProfile?.username || user?.username || user?.name || 'You';
        const oppName = opponent?.username || 'Opponent';
        const myAvatarUrl = myProfile?.avatar || user?.avatar;
        const modeLabel = matchup.durationMinutes <= 200 ? 'RUSH' : matchup.durationMinutes <= 1500 ? 'ORIGINAL' : 'TOURNAMENT';
        const potDollars = (() => {
          const payout = parseFloat(matchup.winnerPayout);
          if (payout > 0) return payout;
          const gross = parseFloat(matchup.potSize || matchup.startingBalance * 2 || 20000);
          const fee = parseFloat(matchup.platformFee);
          return fee > 0 ? gross - fee : gross - gross * 0.10;
        })();
        const compact = (n) => {
          const v = Number(n || 0);
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
          if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 ? 1 : 0)}K`;
          return String(v);
        };
        const potLabel = isBeta ? `${compact(potDollars)} Coins` : `$${potDollars.toLocaleString()}`;
        const startingBalance = parseFloat(matchup.startingBalance || 10000);
        const startingLabel = isBeta ? `${compact(startingBalance)} coins` : `$${startingBalance.toLocaleString()}`;
        const timeLabel = (() => {
          if (timeRemaining == null) return 'Starting';
          // Pick deadline (midnight ET for day battles) passed — matchup
          // stays active until the last picked game grades.
          if (timeRemaining <= 0) return 'Settling';
          const m = Math.floor(timeRemaining / 60000);
          const h = Math.floor(m / 60);
          const d = Math.floor(h / 24);
          if (d > 0) return `${d}d ${h % 24}h`;
          if (h > 0) return `${h}h ${m % 60}m`;
          return `${m}m`;
        })();
        const ctaLabel = walkthroughStep === 0 ? 'How Does It Work?' : walkthroughStep === 1 ? 'Got It, Any Tips?' : 'Start Picking';
        const Bolt = ({ size = 24, delay = 0 }) => (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{
            filter: 'drop-shadow(0 2px 0 #0a0a0a)',
            animation: `wtBolt 0.9s ease-in-out ${delay}s infinite`,
          }}>
            <path d="M13 2L3 14h7l-2 8 11-13h-7l3-7z" fill="#facc15" stroke="#0a0a0a" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        );
        return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <style>{`
            @keyframes wtSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes wtFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes wtBolt { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.92); } }
            @keyframes wtTitleBounce { 0% { transform: scale(0.6) rotate(-6deg); opacity: 0; } 60% { transform: scale(1.08) rotate(2deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
            @keyframes wtCtaThrob { 0%,100% { transform: translateY(0); box-shadow: 0 6px 0 #0a0a0a; } 50% { transform: translateY(-2px); box-shadow: 0 8px 0 #0a0a0a; } }
            @media (hover: hover) { .wt-back-btn:hover { background: linear-gradient(180deg,#262626,#171717) !important; } }
          `}</style>
          <div
            className="w-full max-w-[380px] rounded-2xl overflow-hidden flex flex-col relative"
            style={{
              background: '#0b1322',
              border: walkthroughStep === 0 ? '3px solid #fb923c' : '3px solid #06b6d4',
              boxShadow: '0 8px 0 #0a0a0a',
              animation: 'wtSlideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
              maxHeight: 'calc(100dvh - 2rem)',
            }}
          >
            {/* Arcade corner brackets — orange on the celebratory "You're
                Matched!" step, cyan on info steps. No glow, just chunky
                black borders for max readability. */}
            {['tl','tr','bl','br'].map(pos => {
              const base = { position: 'absolute', width: 20, height: 20, pointerEvents: 'none', zIndex: 3 };
              const isStep0 = walkthroughStep === 0;
              const stroke = isStep0 ? '2.5px solid #fb923c' : '2.5px solid #06b6d4';
              const glow = {};
              const map = {
                tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke, borderTopLeftRadius: 8 },
                tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke, borderTopRightRadius: 8 },
                bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke, borderBottomLeftRadius: 8 },
                br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke, borderBottomRightRadius: 8 },
              };
              return <span key={pos} aria-hidden="true" style={{ ...base, ...map[pos], ...glow }} />;
            })}
            {/* Top bar — progress dots + skip */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0 relative" style={{ zIndex: 4 }}>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{
                    width: walkthroughStep === i ? '28px' : '10px',
                    background: walkthroughStep >= i ? '#06b6d4' : '#1a1a1a',
                    border: '1.5px solid #0a0a0a',
                  }} />
                ))}
              </div>
              <button onClick={closeWalkthrough} className="text-gray-500 text-xs font-bold uppercase tracking-wider" style={{ letterSpacing: '0.14em' }}>Skip</button>
            </div>

            <div key={walkthroughStep} className="flex-1 overflow-y-auto min-h-0" style={{ animation: 'wtFadeIn 0.3s ease-out' }}>
              {walkthroughStep === 0 && (
                <>
                  {/* Arcade-style stacked "YOU'RE / MATCHED!" hero — yellow
                      fill with chunky black stroke + multi-layer orange
                      neon glow, flanked by gold lightning bolts. Matches
                      the celebratory mockup the user provided. */}
                  <div className="px-5 pt-4 pb-2 text-center relative">
                    <div className="flex items-center justify-center gap-3">
                      <span aria-hidden="true" style={{
                        fontSize: 36,
                        lineHeight: 1,
                        color: '#facc15',
                        filter: 'drop-shadow(0 2px 0 #0a0a0a)',
                        animation: 'wtBolt 0.9s ease-in-out 0s infinite',
                      }}>⚡</span>
                      <h2
                        className="font-black uppercase text-center"
                        style={{
                          color: '#facc15',
                          fontSize: 'clamp(38px, 11vw, 54px)',
                          lineHeight: 0.88,
                          letterSpacing: '0.02em',
                          fontStyle: 'italic',
                          WebkitTextStroke: '2px #0a0a0a',
                          textShadow: '0 4px 0 #0a0a0a',
                          margin: 0,
                          animation: 'wtTitleBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
                          fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
                        }}
                      >
                        <span style={{ display: 'block' }}>You&apos;re</span>
                        <span style={{ display: 'block' }}>Matched!</span>
                      </h2>
                      <span aria-hidden="true" style={{
                        fontSize: 36,
                        lineHeight: 1,
                        color: '#facc15',
                        filter: 'drop-shadow(0 2px 0 #0a0a0a)',
                        animation: 'wtBolt 0.9s ease-in-out 0.15s infinite',
                      }}>⚡</span>
                    </div>
                    {/* Green BATTLE STARTED pill — moved below the title
                        per mockup, with star accents and chunky border. */}
                    <div className="flex justify-center mt-3">
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full" style={{
                        background: '#10b981',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}>
                        <span aria-hidden="true" style={{ color: '#facc15', fontSize: 11, lineHeight: 1 }}>★</span>
                        <span className="text-white text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.45)' }}>Battle Started</span>
                        <span aria-hidden="true" style={{ color: '#facc15', fontSize: 11, lineHeight: 1 }}>★</span>
                      </div>
                    </div>
                  </div>

                  {/* Mode / Pot / Time pill — long rounded capsule with
                      trophy + clock + coin icons inline, matching the
                      mockup's information bar. */}
                  <div className="px-3 sm:px-5 pb-3">
                    <div className="mx-auto rounded-full px-2.5 sm:px-3.5 py-2 flex items-center justify-center flex-wrap gap-x-2 gap-y-1" style={{
                      background: '#0a0e1c',
                      border: '2.5px solid #fb923c',
                      boxShadow: '0 4px 0 #0a0a0a',
                    }}>
                      <span style={{ fontSize: 16 }} aria-hidden="true">🏆</span>
                      <span className="text-white font-black text-[12px] uppercase" style={{ letterSpacing: '0.08em' }}>
                        {modeLabel}
                      </span>
                      <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>·</span>
                      <span className="text-white font-black text-[12px] uppercase" style={{ letterSpacing: '0.06em' }}>
                        Win <span style={{ color: '#facc15' }}>{potLabel}</span>
                      </span>
                      <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>·</span>
                      <span aria-hidden="true" style={{ fontSize: 14 }}>⏱</span>
                      <span className="text-white font-black text-[12px] uppercase" style={{ color: '#facc15', letterSpacing: '0.06em' }}>{timeLabel}</span>
                      <span style={{ fontSize: 16 }} aria-hidden="true">🪙</span>
                    </div>
                  </div>

                  {/* Avatars with crown on the host (you) + big neon ring
                      borders + name pills + RANK badges below, with a
                      yellow VS in the middle and a record pill underneath. */}
                  <div className="flex items-start justify-center gap-2 sm:gap-3 px-3 sm:px-5 pb-3" style={{ position: 'relative' }}>
                    <div className="flex flex-col items-center flex-shrink min-w-0" style={{ flexBasis: 110, maxWidth: 110 }}>
                      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginBottom: 2, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }}>👑</span>
                      <div className="w-[68px] h-[68px] rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{
                        background: '#0a0a0a',
                        border: '4px solid #3b82f6',
                        boxShadow: '0 0 0 2.5px #0a0a0a, 0 4px 0 #0a0a0a',
                      }}>
                        {myAvatarUrl ? (
                          <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-lg text-white">{myName[0]?.toUpperCase() || 'P'}</span>
                        )}
                      </div>
                      <p className="text-white text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
                        background: '#0d0d0d',
                        border: '2.5px solid #3b82f6',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.06em',
                      }}>{myName}</p>
                      <p className="text-white text-[8.5px] font-black uppercase mt-1 px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{
                        background: '#fb923c',
                        border: '2px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                      }}>
                        <span aria-hidden="true" style={{ color: '#facc15', fontSize: 8 }}>★</span>
                        Rank: Pro
                      </p>
                    </div>

                    <div className="flex flex-col items-center flex-shrink-0 self-center" style={{ minWidth: 56 }}>
                      <div className="text-3xl font-black italic" style={{
                        color: '#facc15',
                        fontFamily: 'Impact, "Arial Black", sans-serif',
                        WebkitTextStroke: '1.5px #0a0a0a',
                        textShadow: '0 3px 0 #0a0a0a',
                        letterSpacing: '0.04em',
                      }}>VS</div>
                      <p className="text-white text-[9px] font-black mt-1.5 px-2 py-0.5 rounded-md" style={{
                        background: '#0a0e1c',
                        border: '2px solid #06b6d4',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.08em',
                        color: '#7dd3fc',
                      }}>(0-0)</p>
                    </div>

                    <div className="flex flex-col items-center flex-shrink min-w-0" style={{ flexBasis: 110, maxWidth: 110 }}>
                      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginBottom: 2, opacity: 0 }}>👑</span>
                      <div className="w-[68px] h-[68px] rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{
                        background: '#0a0a0a',
                        border: '4px solid #fb923c',
                        boxShadow: '0 0 0 2.5px #0a0a0a, 0 4px 0 #0a0a0a',
                      }}>
                        {opponent?.avatar ? (
                          <img src={opponent.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-lg text-white">{oppName[0]?.toUpperCase() || 'O'}</span>
                        )}
                      </div>
                      <p className="text-white text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
                        background: '#0d0d0d',
                        border: '2.5px solid #fb923c',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.06em',
                      }}>{oppName}</p>
                      <p className="text-white text-[8.5px] font-black uppercase mt-1 px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{
                        background: '#3b82f6',
                        border: '2px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                      }}>
                        <span aria-hidden="true" style={{ color: '#7dd3fc', fontSize: 8 }}>◆</span>
                        Rank: Rookie
                      </p>
                    </div>
                  </div>

                  {/* Three colored stat tiles — Win Streak / Bonus XP /
                      Daily Challenge — cartoon style with thick black
                      borders + hard shadows + colored backgrounds. */}
                  <div className="grid grid-cols-3 gap-1.5 px-4 pb-3">
                    {[
                      { icon: '🔥', label: 'Win Streak', value: 'On Fire', bg: '#fb923c', borderColor: '#fb923c' },
                      { icon: '⭐', label: 'Bonus XP', value: '+50 XP', bg: '#facc15', borderColor: '#facc15' },
                      { icon: '🎯', label: 'Daily Goal', value: 'In Progress', bg: '#10b981', borderColor: '#10b981' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl px-1.5 py-1.5 flex flex-col items-center text-center" style={{
                        background: '#0a0e1c',
                        border: `2.5px solid ${s.borderColor}`,
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}>
                        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }}>{s.icon}</span>
                        <span className="text-white text-[8px] font-black uppercase mt-1" style={{ letterSpacing: '0.14em', opacity: 0.7 }}>{s.label}</span>
                        <span className="text-[10px] font-black uppercase mt-0.5 px-1.5 py-0.5 rounded-md w-full truncate" style={{
                          background: s.bg,
                          border: '1.5px solid #0a0a0a',
                          letterSpacing: '0.06em',
                          color: '#0a0a0a',
                          textShadow: '0 1px 0 rgba(255,255,255,0.25)',
                        }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {walkthroughStep === 1 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4 relative">
                    <div className="flex items-center justify-center gap-2.5">
                      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                      <h2
                        className="font-black uppercase text-center"
                        style={{
                          fontSize: 'clamp(28px, 8vw, 38px)',
                          lineHeight: 0.92,
                          letterSpacing: '0.015em',
                          fontStyle: 'italic',
                          color: '#ffffff',
                          WebkitTextStroke: '1.5px #0a0a0a',
                          textShadow: '0 3px 0 #0a0a0a',
                          whiteSpace: 'nowrap',
                          margin: 0,
                          animation: 'wtTitleBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                          fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
                        }}
                      >
                        How It Works
                      </h2>
                      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span aria-hidden="true" style={{ flex: 1, height: 2, background: '#06b6d4' }} />
                      <p className="font-black uppercase whitespace-nowrap text-center" style={{ color: '#7dd3fc', fontSize: 10, letterSpacing: '0.24em', margin: 0 }}>
                        Three Simple Steps To Win
                      </p>
                      <span aria-hidden="true" style={{ flex: 1, height: 2, background: '#06b6d4' }} />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { n: 1, color: '#3b82f6', icon: '🎯', title: 'Place Your Picks', desc: 'Browse games below and add bets to your slip — spreads, moneylines, or totals.' },
                      { n: 2, color: '#10b981', icon: '📈', title: 'Grow Your Balance', desc: `You both start with ${startingLabel}. Winning picks grow your bankroll.` },
                      { n: 3, color: '#fb923c', icon: '🏆', title: 'Highest Balance Wins', desc: 'When time runs out, the player with the higher balance takes the pot.' },
                    ].map((s) => (
                      <div key={s.n} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{
                        background: '#0a0e1c',
                        border: `2.5px solid ${s.color}`,
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          background: s.color,
                          border: '2px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                        }}>
                          <span className="text-white text-sm font-black" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>{s.n}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-extrabold flex items-center gap-1.5"><span aria-hidden="true">{s.icon}</span>{s.title}</p>
                          <p className="text-gray-300 text-[11px] mt-0.5 leading-snug">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {walkthroughStep === 2 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4 relative">
                    <div className="flex items-center justify-center gap-2.5">
                      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                      <h2
                        className="font-black uppercase text-center"
                        style={{
                          fontSize: 'clamp(28px, 8vw, 38px)',
                          lineHeight: 0.92,
                          letterSpacing: '0.015em',
                          fontStyle: 'italic',
                          color: '#ffffff',
                          WebkitTextStroke: '1.5px #0a0a0a',
                          textShadow: '0 3px 0 #0a0a0a',
                          whiteSpace: 'nowrap',
                          margin: 0,
                          animation: 'wtTitleBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                          fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
                        }}
                      >
                        Tips To Win
                      </h2>
                      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span aria-hidden="true" style={{ flex: 1, height: 2, background: '#06b6d4' }} />
                      <p className="font-black uppercase whitespace-nowrap text-center" style={{ color: '#7dd3fc', fontSize: 10, letterSpacing: '0.24em', margin: 0 }}>
                        Quick Strategy Guide
                      </p>
                      <span aria-hidden="true" style={{ flex: 1, height: 2, background: '#06b6d4' }} />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { color: '#3b82f6', icon: '📊', title: 'Track the Banner', desc: 'Your battle status bar at the top shows both balances and time left in real-time.' },
                      { color: '#fb923c', icon: '🔒', title: 'Hidden Bets', desc: "Your opponent can't see your picks until you've placed at least one bet — and vice versa." },
                      { color: '#10b981', icon: '⚡', title: 'Manage Risk', desc: "Don't go all-in early. Spread your bets across games to build a steady lead." },
                    ].map((t) => (
                      <div key={t.title} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{
                        background: '#0a0e1c',
                        border: `2.5px solid ${t.color}`,
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          background: t.color,
                          border: '2px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                          fontSize: 16,
                        }} aria-hidden="true">{t.icon}</div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-extrabold">{t.title}</p>
                          <p className="text-gray-300 text-[11px] mt-0.5 leading-snug">{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA — big yellow cartoon button + Back */}
            <div className="px-5 pb-5 pt-2 flex-shrink-0 flex gap-2 items-stretch">
              {walkthroughStep > (walkthroughSkipIntro ? 1 : 0) && (
                <button
                  onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                  className="wt-back-btn py-3 px-4 rounded-2xl text-xs font-extrabold uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                    color: '#e5e7eb',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a',
                    letterSpacing: '0.12em',
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (walkthroughStep < 2) {
                    setWalkthroughStep(walkthroughStep + 1);
                  } else {
                    closeWalkthrough();
                  }
                }}
                className="flex-1 rounded-2xl font-black uppercase flex flex-col items-stretch justify-center relative overflow-hidden p-0 text-white"
                style={
                  walkthroughStep === 0
                    ? {
                        background: 'linear-gradient(180deg,#fde047 0%,#f97316 60%,#ea580c 100%)',
                        border: '3px solid #0a0a0a',
                        boxShadow: '0 5px 0 #0a0a0a',
                        color: '#0a0a0a',
                        textShadow: '0 2px 0 rgba(255,255,255,0.35)',
                        letterSpacing: '0.06em',
                        fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
                      }
                    : {
                        background: '#3b82f6',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 4px 0 #0a0a0a',
                        textShadow: '0 1px 0 rgba(0,0,0,0.45)',
                        letterSpacing: '0.06em',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }
                }
              >
                {walkthroughStep === 0 ? (
                  <span className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5">
                    <span aria-hidden="true" style={{ fontSize: 24, color: '#0a0a0a' }}>«</span>
                    <span style={{ fontSize: 22, fontStyle: 'italic', letterSpacing: '0.05em' }}>Let&apos;s Go!</span>
                    <span aria-hidden="true" style={{ fontSize: 24, color: '#0a0a0a' }}>»</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
                    <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 26, height: 26, background: '#050a18', border: '2px solid #06b6d4', color: '#7dd3fc', fontSize: 13 }}>»</span>
                    <span style={{ fontSize: 14 }}>{ctaLabel}</span>
                    <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 26, height: 26, background: '#050a18', border: '2px solid #06b6d4', color: '#7dd3fc', fontSize: 13 }}>«</span>
                  </span>
                )}
              </button>
            </div>
            {walkthroughStep === 0 && (
              <div className="px-5 pb-2 pt-0 flex items-center justify-center gap-1.5">
                <span aria-hidden="true" style={{ fontSize: 11, color: '#facc15', filter: 'drop-shadow(0 1px 0 #0a0a0a)' }}>🔒</span>
                <span className="text-white text-[10px] font-black uppercase" style={{ letterSpacing: '0.18em', textShadow: '0 1px 0 rgba(0,0,0,0.6)' }}>
                  Battle Locked In
                </span>
                <span className="text-gray-300 text-[10px] font-semibold normal-case" style={{ letterSpacing: '0.04em' }}>
                  · Both players are ready
                </span>
              </div>
            )}
            {/* "Don't show this again" preference — persisted in
                localStorage by closeWalkthrough(). */}
            <label
              className="flex items-center justify-center gap-2 px-5 pb-4 pt-0 cursor-pointer select-none"
              style={{ letterSpacing: '0.1em' }}
            >
              <span
                role="checkbox"
                aria-checked={walkthroughDontShowAgain}
                tabIndex={0}
                onClick={() => setWalkthroughDontShowAgain(v => !v)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setWalkthroughDontShowAgain(v => !v); } }}
                className="inline-flex items-center justify-center rounded"
                style={{
                  width: 16, height: 16,
                  background: walkthroughDontShowAgain ? '#06b6d4' : '#0a0f1c',
                  border: '2px solid #06b6d4',
                  boxShadow: 'none',
                }}
              >
                {walkthroughDontShowAgain && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </span>
              <input
                type="checkbox"
                checked={walkthroughDontShowAgain}
                onChange={(e) => setWalkthroughDontShowAgain(e.target.checked)}
                className="sr-only"
              />
              <span className="text-[10.5px] font-extrabold uppercase" style={{ color: walkthroughDontShowAgain ? '#7dd3fc' : '#94a3b8' }}>
                Don&apos;t show this again
              </span>
            </label>
          </div>
        </div>
        );
      })()}

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
