import { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useBetSlip } from '../contexts/BetSlipContext';
import TeamLogo, { SelectionLogos } from './TeamLogo';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import ShareableBetSlip from './ShareableBetSlip';
import PiksBetCard from './PiksBetCard';
import BalanceExplainerModal from './BalanceExplainerModal';
import CoinRain from './CoinRain';
import haptic from '../utils/haptics';
import { formatMoney } from '../utils/formatMoney';
import { calculatePayout, americanToDecimal } from '../utils/odds';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import { releaseBodyScrollLock } from '../hooks/useGlobalScrollLockRecovery';

// Capitalize league identifiers like (w) -> (W), (m) -> (M)
const capitalizeLeagueId = (text) => {
  if (!text) return text;
  return text.replace(/\(([wm])\)/gi, (match, letter) => `(${letter.toUpperCase()})`);
};

export default function BetSlip({ bankroll: profileBankroll, onClose, isOpen, onBetPlaced }) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const { betSlip: bets, removeBet, updateStake, clearBetSlip, setShowBetSlip } = useBetSlip();
  const { apiGames, inplayEvents } = useGames();
  const {
    hasActiveMatchup,
    myBalance: matchupBalance,
    myLiveBalance,
    opponent: matchupOpponent,
    opponentBalance,
    opponentLiveBalance,
    matchupData,
    refresh: refreshMatchup,
  } = useMatchup();

  const bankroll = hasActiveMatchup && matchupBalance != null ? matchupBalance : 0;
  const betsReadOnly = isLoggedIn && !hasActiveMatchup;

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const c = isLight ? {
    panelBg: '#ffffff',
    innerSurface: '#f0ebe1',
    cardSurface: '#ffffff',
    bodyText: '#0f172a',
    mutedText: '#64748b',
    faintText: '#94a3b8',
    divider: 'rgba(15,23,42,0.10)',
    posGreen: '#059669',
    coinGlyph: '#0f172a',
  } : {
    panelBg: '#000000',
    innerSurface: '#1a1a1a',
    cardSurface: 'linear-gradient(180deg, #111827 0%, #0a0f1c 100%)',
    bodyText: '#ffffff',
    mutedText: '#9ca3af',
    faintText: '#6b7280',
    divider: 'rgba(55, 65, 81, 0.5)',
    posGreen: '#34d399',
    coinGlyph: '#ffffff',
  };

  useEffect(() => {
    if (isOpen && refreshMatchup) {
      refreshMatchup();
    }
  }, [isOpen]);

  // The "battle view" is wherever the user actively interacts with the
  // matchup: the dashboard (where the live battle card and bet slip
  // appear) and the /battle page itself. If the user navigates away
  // from these, the head-to-head balance row should disappear too.
  const isBattleView = (path) => path === '/' || path === '/battle' || path?.startsWith('/battle');

  // Sticky head-to-head balances: keep the opponent balance row visible
  // even after the battle settles, until the user closes the bet slip
  // OR leaves the battle view.
  // - While a 1v1 is active: live mark-to-market values track odds movement.
  // - When the battle just completed (status transition or matchup
  //   deactivates): freeze the last known balances as the final result.
  // - If there is no head-to-head context AND we never captured a settled
  //   snapshot, fall back to the single-balance UI immediately.
  const [showCoinsExplainer, setShowCoinsExplainer] = useState(false);
  const [stickyMatchup, setStickyMatchup] = useState(null);
  // Track the last live snapshot we saw while the matchup was active so
  // that when it deactivates we can freeze it as the settled result even
  // if the matchup record disappears from context entirely.
  const lastActiveSnapshotRef = useRef(null);
  const prevHadActiveMatchupRef = useRef(false);
  const receiptTimerRef = useRef(null);

  // Clear sticky head-to-head state on any navigation away from the
  // battle view. We listen for routeChangeStart so the bet slip header
  // updates immediately when the user navigates.
  useEffect(() => {
    if (!router?.events) return;
    const handler = (url) => {
      const path = (url || '').split('?')[0];
      if (!isBattleView(path)) {
        setStickyMatchup(null);
      }
    };
    router.events.on('routeChangeStart', handler);
    return () => router.events.off('routeChangeStart', handler);
  }, [router]);

  useEffect(() => {
    return () => {
      if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setStickyMatchup(null);
      lastActiveSnapshotRef.current = null;
      prevHadActiveMatchupRef.current = false;
      return;
    }
    if (!isBattleView(router?.pathname)) {
      setStickyMatchup(null);
      lastActiveSnapshotRef.current = null;
      prevHadActiveMatchupRef.current = false;
      return;
    }

    // While the matchup is active, continuously stash the latest live
    // snapshot so we can freeze it as the final settled view the moment
    // the matchup deactivates — even if the matchup record disappears
    // from context before a 'completed' status ever arrives.
    if (hasActiveMatchup && matchupOpponent) {
      const myShown = myLiveBalance != null ? myLiveBalance : matchupBalance;
      const oppShown = opponentLiveBalance != null ? opponentLiveBalance : opponentBalance;
      const snapshot = {
        opponent: matchupOpponent,
        myBalance: myShown,
        opponentBalance: oppShown,
      };
      lastActiveSnapshotRef.current = snapshot;
      prevHadActiveMatchupRef.current = true;
      setStickyMatchup({ ...snapshot, settled: false });
      return;
    }

    // Explicit completion signal: prefer the settled balances exposed
    // in the matchup payload over the last live values when available.
    if (matchupOpponent && matchupData?.status === 'completed') {
      setStickyMatchup(prev => ({
        opponent: matchupOpponent,
        myBalance: matchupBalance != null ? matchupBalance : (prev?.myBalance ?? lastActiveSnapshotRef.current?.myBalance ?? null),
        opponentBalance: opponentBalance != null ? opponentBalance : (prev?.opponentBalance ?? lastActiveSnapshotRef.current?.opponentBalance ?? null),
        settled: true,
      }));
      prevHadActiveMatchupRef.current = false;
      return;
    }

    // Matchup just deactivated (active -> none/completed) without an
    // explicit completed payload reaching us. Freeze the last known
    // active snapshot as the settled result so the dual-balance row
    // stays visible until the user closes the slip or leaves the view.
    if (prevHadActiveMatchupRef.current && lastActiveSnapshotRef.current) {
      setStickyMatchup({ ...lastActiveSnapshotRef.current, settled: true });
      prevHadActiveMatchupRef.current = false;
      return;
    }

    // No head-to-head context and no settled snapshot to retain.
    setStickyMatchup(prev => (prev?.settled ? prev : null));
  }, [
    isOpen,
    hasActiveMatchup,
    matchupOpponent?.id,
    matchupOpponent?.username,
    matchupBalance,
    myLiveBalance,
    opponentBalance,
    opponentLiveBalance,
    matchupData?.status,
    router?.pathname,
  ]);

  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');
  const [parlayStake, setParlayStake] = useState(0);
  const [stakeDrafts, setStakeDrafts] = useState({});
  const [parlayStakeDraft, setParlayStakeDraft] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWinningBet, setSelectedWinningBet] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [showPikPlacedBadge, setShowPikPlacedBadge] = useState(false);
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedBets, setExpandedBets] = useState({});
  const [swipeStates, setSwipeStates] = useState({});
  const swipeRefs = useRef({});

  // Build live scores map from GamesContext (same source as dashboard)
  const liveScores = useMemo(() => {
    const scoresMap = {};
    
    // Normalize team names for matching (remove special chars, lowercase)
    const normalizeTeam = (name) => {
      if (!name) return '';
      return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    // Helper to add game data with multiple key variations
    const addGameKeys = (game, scoreData) => {
      if (game.id) scoresMap[game.id] = scoreData;
      if (game.gameId) scoresMap[game.gameId] = scoreData;
      
      // Matchup keys with full names
      if (game.awayTeamFull && game.homeTeamFull) {
        const fullMatchup = `${game.awayTeamFull} @ ${game.homeTeamFull}`;
        scoresMap[fullMatchup] = scoreData;
        scoresMap[fullMatchup.toLowerCase()] = scoreData;
        // Normalized key
        const normalizedFull = `${normalizeTeam(game.awayTeamFull)}@${normalizeTeam(game.homeTeamFull)}`;
        scoresMap[normalizedFull] = scoreData;
      }
      
      // Matchup keys with abbreviations
      if (game.awayTeam && game.homeTeam) {
        const abbrMatchup = `${game.awayTeam} @ ${game.homeTeam}`;
        scoresMap[abbrMatchup] = scoreData;
        scoresMap[abbrMatchup.toLowerCase()] = scoreData;
        // Normalized key
        const normalizedAbbr = `${normalizeTeam(game.awayTeam)}@${normalizeTeam(game.homeTeam)}`;
        scoresMap[normalizedAbbr] = scoreData;
      }
    };
    
    // First, add all inplay events (real-time SSE data with live scores)
    Object.entries(inplayEvents || {}).forEach(([id, event]) => {
      const scoreData = {
        isLive: true,
        awayScore: event.awayScore ?? 0,
        homeScore: event.homeScore ?? 0,
        time: event.time || event.clock || ''
      };
      scoresMap[id] = scoreData;
      addGameKeys(event, scoreData);
    });
    
    // Then add API games (for games not in inplay but might have scores)
    (apiGames || []).forEach(game => {
      // Skip if we already have inplay data for this game
      if (scoresMap[game.id]) return;
      
      const scoreData = {
        isLive: game.isLive || game.status === 'IN_PROGRESS',
        awayScore: game.scores?.away?.total ?? game.awayScore ?? 0,
        homeScore: game.scores?.home?.total ?? game.homeScore ?? 0,
        time: game.time || game.formatted_time || ''
      };
      addGameKeys(game, scoreData);
    });
    
    return scoresMap;
  }, [apiGames, inplayEvents]);

  useEffect(() => {
    if (bets.length < 2 && betType === 'parlay') {
      setBetType('single');
    }
  }, [bets.length, betType]);

  const toggleBetExpanded = (id) => {
    setExpandedBets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Swipe-to-delete handlers - FanDuel style with two-step process.
  //
  // Removing a bet from the slip is a *local-only* action (it just
  // edits the in-memory BetSlipContext) — it does NOT submit, edit
  // odds, or otherwise touch a battle. Previously these handlers
  // bailed early when `betsReadOnly` was true, which is the state
  // the slip is in when the user is logged in but has no active
  // matchup ("Start a match to place piks" CTA shown). That meant
  // a user could add bets, decide not to start a match yet, and
  // then have NO way to clear the slip — no X button, no swipe,
  // even with only one bet present. Removing the readOnly guard
  // fixes that without enabling stake editing or bet placement,
  // both of which are still gated higher up the tree.
  const REVEAL_WIDTH = 100; // Width to reveal delete button
  const PARTIAL_THRESHOLD = 50; // Swipe past this to snap open
  const FULL_DELETE_THRESHOLD = 200; // Swipe past this to delete immediately

  const handleTouchStart = (betId, e) => {
    const touch = e.touches[0];
    const currentOffset = swipeStates[betId]?.offset || 0;
    swipeRefs.current[betId] = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialOffset: currentOffset,
      isSwiping: false,
      // Track the last "haptic zone" we were in so we can fire a
      // single tap as the finger crosses each snap threshold —
      // gives the gesture the tactile "click" users expect from
      // native swipe-to-delete affordances. Zones:
      //   0 = below PARTIAL_THRESHOLD
      //   1 = between PARTIAL and FULL
      //   2 = past FULL (will delete on release)
      lastHapticZone: currentOffset >= FULL_DELETE_THRESHOLD ? 2
        : currentOffset >= PARTIAL_THRESHOLD ? 1
        : 0,
    };
  };

  const handleTouchMove = (betId, e) => {
    if (!swipeRefs.current[betId]) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeRefs.current[betId].startX;
    const deltaY = Math.abs(touch.clientY - swipeRefs.current[betId].startY);

    // Only swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > deltaY) {
      swipeRefs.current[betId].isSwiping = true;
      const initialOffset = swipeRefs.current[betId].initialOffset || 0;
      // Calculate new offset (negative deltaX means swipe left = positive offset)
      let newOffset = initialOffset - deltaX;
      // Clamp between 0 and max swipe distance
      newOffset = Math.max(0, Math.min(newOffset, FULL_DELETE_THRESHOLD + 50));

      // Fire a tap haptic exactly once each time the user crosses
      // into a higher zone, so the swipe feels like it "snaps" past
      // each threshold. We deliberately do NOT fire on the way back
      // down — that would feel noisy.
      const zone = newOffset >= FULL_DELETE_THRESHOLD ? 2
        : newOffset >= PARTIAL_THRESHOLD ? 1
        : 0;
      if (zone > swipeRefs.current[betId].lastHapticZone) {
        haptic.tap();
        swipeRefs.current[betId].lastHapticZone = zone;
      } else if (zone < swipeRefs.current[betId].lastHapticZone) {
        // Reset downward without firing so the next upward crossing
        // re-triggers the click.
        swipeRefs.current[betId].lastHapticZone = zone;
      }

      setSwipeStates(prev => ({ ...prev, [betId]: { offset: newOffset, isOpen: prev[betId]?.isOpen || false } }));
    }
  };

  const handleTouchEnd = (betId) => {
    if (!swipeRefs.current[betId]) return;
    const state = swipeStates[betId] || { offset: 0, isOpen: false };
    const swipeAmount = state.offset;

    if (swipeAmount >= FULL_DELETE_THRESHOLD) {
      // Full swipe - delete immediately. Stronger haptic so the
      // user feels the "thunk" of the bet being yanked off the slip.
      haptic.success();
      setSwipeStates(prev => ({ ...prev, [betId]: { offset: FULL_DELETE_THRESHOLD + 50, isOpen: true } }));
      setTimeout(() => {
        removeBet(betId);
        setSwipeStates(prev => {
          const newState = { ...prev };
          delete newState[betId];
          return newState;
        });
      }, 150);
    } else if (swipeAmount >= PARTIAL_THRESHOLD) {
      // Partial swipe - snap open to reveal delete button
      setSwipeStates(prev => ({ ...prev, [betId]: { offset: REVEAL_WIDTH, isOpen: true } }));
    } else {
      // Not enough swipe - snap closed
      setSwipeStates(prev => ({ ...prev, [betId]: { offset: 0, isOpen: false } }));
    }
    delete swipeRefs.current[betId];
  };

  // Handle tap on delete button when revealed
  const handleDeleteTap = (betId) => {
    haptic.success();
    setSwipeStates(prev => ({ ...prev, [betId]: { offset: REVEAL_WIDTH + 50, isOpen: true } }));
    setTimeout(() => {
      removeBet(betId);
      setSwipeStates(prev => {
        const newState = { ...prev };
        delete newState[betId];
        return newState;
      });
    }, 150);
  };
  
  // Close any open swipe when tapping elsewhere
  const closeSwipe = (betId) => {
    if (swipeStates[betId]?.isOpen) {
      setSwipeStates(prev => ({ ...prev, [betId]: { offset: 0, isOpen: false } }));
    }
  };

  const calculateParlayOdds = () => {
    if (bets.length < 2) return null;
    let decimalOdds = 1;
    bets.forEach(bet => {
      const american = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
      const decimal = americanToDecimal(american) ?? 1;
      decimalOdds *= decimal;
    });
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Track scroll position to restore after bet slip closes
  const savedScrollRef = useRef(0);
  
  useEffect(() => {
    // DO NOT set body.style.overflow = 'hidden' - this breaks sticky positioning
    // The bet slip overlay (z-[98] backdrop) handles blocking background interaction
    if (isOpen) {
      // Save current scroll position
      savedScrollRef.current = window.scrollY || window.pageYOffset || 0;
    } else {
      // Reset transient overlays when bet slip closes to prevent stale UI.
      // IMPORTANT: do NOT reset showReceipt / currentReceipt here. The receipt
      // must stay open until the user explicitly dismisses it (X / backdrop),
      // even after clearBetSlip() flips isOpen to false post-placement.
      setShowPikPlacedBadge(false);
      setShowCoinRain(false);
      setShowShareModal(false);
      setSelectedWinningBet(null);
      
      // Restore scroll position and force refresh for sticky header
      const savedPos = savedScrollRef.current;
      requestAnimationFrame(() => {
        // Restore scroll position if we were scrolled down
        if (savedPos > 0) {
          window.scrollTo(0, savedPos);
        }
        // Always dispatch scroll event to refresh sticky positioning
        window.dispatchEvent(new Event('scroll'));
      });
    }
  }, [isOpen]);

  // Desktop "click outside / Escape to close" for the docked slip.
  // On md+ the slip is a side panel and the page stays visible/interactive,
  // so we close on outside pointerdown or Escape. Mobile (<md) is full-screen
  // so every target is inside the slip and these handlers are a no-op.
  // While an in-slip modal (coin explainer, share, receipt) is on top of the
  // panel, dismissals belong to that modal — kept in a ref so toggling those
  // modals doesn't re-attach the document listeners.
  const inSlipModalRef = useRef(false);
  useEffect(() => {
    inSlipModalRef.current = showCoinsExplainer || showShareModal || showReceipt;
  }, [showCoinsExplainer, showShareModal, showReceipt]);

  // Hold onClose in a ref so the parent's freshly-allocated arrow each
  // render doesn't churn the listener subscription below.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (typeof window === 'undefined') return undefined;

    const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
    const isInsideSlip = (node) =>
      node instanceof Element && !!node.closest('[data-betslip="true"]');

    const handlePointerDown = (e) => {
      if (!isDesktop()) return;
      if (inSlipModalRef.current) return;
      if (isInsideSlip(e.target)) return;
      onCloseRef.current?.();
    };

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (!isDesktop()) return;
      if (inSlipModalRef.current) return;
      onCloseRef.current?.();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const userChallenge = 'basic';
  const challengeMinBets = {
    'basic': 10,
    'premium': 25,
    'pro': 50,
    'elite': 100
  };

  const getMinBetAmount = () => challengeMinBets[userChallenge] || 10;
  const minBetAmount = getMinBetAmount();

  const sanitizeStakeInput = (raw) => {
    let cleaned = String(raw ?? '').replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    let [intPart, decPart] = cleaned.split('.');
    if (decPart !== undefined && decPart.length > 2) {
      decPart = decPart.slice(0, 2);
    }
    if (intPart && intPart.length > 1) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }
    if (decPart !== undefined) return `${intPart || '0'}.${decPart}`;
    return intPart || '';
  };

  const formatStakeDisplay = (rawString) => {
    if (!rawString) return '';
    const [intPart, decPart] = rawString.split('.');
    const formattedInt = intPart
      ? Number(intPart).toLocaleString('en-US')
      : '0';
    return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  };

  const restoreStakeCursor = (input, oldFormatted, newFormatted, cursorPos) => {
    const digitsBefore = (oldFormatted.slice(0, cursorPos).match(/[\d.]/g) || []).length;
    let newPos = 0;
    let seen = 0;
    while (newPos < newFormatted.length && seen < digitsBefore) {
      if (/[\d.]/.test(newFormatted[newPos])) seen++;
      newPos++;
    }
    requestAnimationFrame(() => {
      if (input && typeof input.setSelectionRange === 'function' && document.activeElement === input) {
        input.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleStakeInputChange = (betId, e) => {
    const input = e.target;
    const oldFormatted = input.value;
    const cursorPos = input.selectionStart ?? oldFormatted.length;
    const cleaned = sanitizeStakeInput(oldFormatted);
    const formatted = formatStakeDisplay(cleaned);
    setStakeDrafts(prev => ({ ...prev, [betId]: cleaned }));
    updateStake(betId, cleaned);
    restoreStakeCursor(input, oldFormatted, formatted, cursorPos);
  };

  const handleParlayStakeInputChange = (e) => {
    const input = e.target;
    const oldFormatted = input.value;
    const cursorPos = input.selectionStart ?? oldFormatted.length;
    const cleaned = sanitizeStakeInput(oldFormatted);
    const formatted = formatStakeDisplay(cleaned);
    setParlayStakeDraft(cleaned);
    setParlayStake(parseFloat(cleaned) || 0);
    restoreStakeCursor(input, oldFormatted, formatted, cursorPos);
  };

  const getStakeDisplayValue = (bet) => {
    const draft = stakeDrafts[bet.id];
    const stakeNum = bet.stake || 0;
    if (draft !== undefined && (parseFloat(draft) || 0) === stakeNum) {
      return formatStakeDisplay(draft);
    }
    return stakeNum ? formatStakeDisplay(String(stakeNum)) : '';
  };

  const getParlayStakeDisplayValue = () => {
    const stakeNum = parlayStake || 0;
    if (parlayStakeDraft !== '' && (parseFloat(parlayStakeDraft) || 0) === stakeNum) {
      return formatStakeDisplay(parlayStakeDraft);
    }
    return stakeNum ? formatStakeDisplay(String(stakeNum)) : '';
  };

  const totalStake = betType === 'parlay' ? parlayStake : bets.reduce((sum, bet) => sum + (bet.stake || 0), 0);

  const totalPayout = betType === 'parlay' && parlayStake > 0 
    ? (() => {
        const parlayDecimal = bets.reduce((acc, bet) => {
          const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
          const decimal = americanToDecimal(oddsValue) ?? 1;
          return acc * decimal;
        }, 1);
        return parlayStake * parlayDecimal;
      })()
    : bets.reduce((sum, bet) => sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0);

  const validateBets = () => {
    if (betType === 'parlay') {
      return {
        isValid: parlayStake >= minBetAmount,
        hasStakes: parlayStake > 0,
        belowMinimum: parlayStake > 0 && parlayStake < minBetAmount
      };
    } else {
      // For single bets, only validate bets that have stakes entered
      // Bets without stakes are allowed - they just won't be placed
      const betsWithStakes = bets.filter(bet => bet.stake > 0);
      const betsWithLowStakes = bets.filter(bet => bet.stake > 0 && bet.stake < minBetAmount);
      const validBetsWithStakes = betsWithStakes.filter(bet => bet.stake >= minBetAmount);
      return {
        isValid: betsWithLowStakes.length === 0 && validBetsWithStakes.length > 0,
        hasStakes: betsWithStakes.length > 0,
        belowMinimum: betsWithLowStakes.length > 0
      };
    }
  };

  const validation = validateBets();

  const placeBets = async () => {
    if (totalStake === 0 || totalStake > bankroll) return;
    setIsPlacing(true);

    try {
      // For single bets, only send bets that have valid stakes
      const betsToPlace = betType === 'single' 
        ? bets.filter(b => b.stake && parseFloat(b.stake) >= minBetAmount)
        : bets;
      
      if (betsToPlace.length === 0) {
        setIsPlacing(false);
        return;
      }

      const response = await fetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bets: betsToPlace,
          betType,
          parlayStake: betType === 'parlay' ? parlayStake : 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to place bets:', data.error);
        haptic.error();
        setIsPlacing(false);
        return;
      }

      // Trigger haptic feedback on successful bet placement
      haptic.success();

      if (data.newBankroll !== undefined) {
        const bankrollValue = Number(data.newBankroll);
        if (!isNaN(bankrollValue) && onBetPlaced) {
          onBetPlaced(bankrollValue);
        }
      }

      // Refresh matchup data so the points/matchup balance pill updates
      // with the new battle-coins balance and the opponent bets view
      // unlocks. The new balance returned by the place-bet API is the
      // matchup balance, NOT real cash, so it must flow through this
      // channel — not the `bankrollUpdated` event the cash pill listens
      // to.
      if (refreshMatchup) {
        refreshMatchup();
      }

      if (data.bets && data.bets.length > 0) {
        const placedBet = data.bets[0];
        if (betType === 'parlay' && parlayStake > 0) {
          setCurrentReceipt({
            id: placedBet.id,
            matchup: placedBet.matchupName || `${betsToPlace.length}-Leg Parlay`,
            selection: placedBet.selection,
            betType: 'parlay',
            odds: parseInt(placedBet.odds),
            stake: parseFloat(placedBet.stake),
            status: 'open',
            legs: betsToPlace.map(bet => ({
              selection: bet.selection,
              betType: bet.betType,
              odds: typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value : bet.odds,
              matchup: bet.matchup,
              gameId: bet.gameId,
              isLive: !!bet.isLive,
              homeTeam: bet.homeTeam,
              awayTeam: bet.awayTeam,
              homeTeamFull: bet.homeTeamFull,
              awayTeamFull: bet.awayTeamFull,
              homeScore: bet.homeScore || 0,
              awayScore: bet.awayScore || 0,
              gameStart: bet.gameStart,
              gameTime: bet.gameTime
            }))
          });
        } else {
          const firstBet = betsToPlace[0];
          const live = liveScores[firstBet.gameId] || liveScores[firstBet.matchup] || {};
          const currentAwayScore = live.awayScore ?? firstBet.awayScore;
          const currentHomeScore = live.homeScore ?? firstBet.homeScore;
          setCurrentReceipt({
            id: placedBet.id,
            gameId: firstBet.gameId,
            matchup: placedBet.matchupName || firstBet.matchup,
            selection: placedBet.selection,
            betType: firstBet.betType,
            odds: parseInt(placedBet.odds),
            stake: parseFloat(placedBet.stake),
            status: 'open',
            isLive: live.isLive || !!firstBet.isLive,
            awayTeam: firstBet.awayTeam,
            homeTeam: firstBet.homeTeam,
            awayTeamFull: firstBet.awayTeamFull,
            homeTeamFull: firstBet.homeTeamFull,
            awayScore: currentAwayScore,
            homeScore: currentHomeScore,
            currentAwayScore: currentAwayScore,
            currentHomeScore: currentHomeScore,
            gameStart: firstBet.gameStart,
            gameTime: live.time || firstBet.gameTime
          });
        }
        setShowReceipt(true);
        setShowPikPlacedBadge(true);
        
        // Hide "Pik Placed!" badge after 3 seconds
        setTimeout(() => {
          setShowPikPlacedBadge(false);
        }, 3000);

        // Auto-dismiss receipt after 10 seconds
        if (receiptTimerRef.current) clearTimeout(receiptTimerRef.current);
        receiptTimerRef.current = setTimeout(() => {
          setShowReceipt(false);
          setCurrentReceipt(null);
          setShowPikPlacedBadge(false);
          receiptTimerRef.current = null;
        }, 10000);
      }

      setShowCoinRain(true);

      setTimeout(() => {
        const winningBet = betsToPlace[0];
        if (winningBet && winningBet.stake > 0) {
          setSelectedWinningBet(winningBet);
        }
        
        // For single bets, only remove the bets that were placed (have stakes)
        // Keep bets without stakes in the slip
        if (betType === 'single' && bets.length > betsToPlace.length) {
          // Remove only the placed bets
          const placedBetIds = betsToPlace.map(b => b.id);
          placedBetIds.forEach(id => removeBet(id));
        } else {
          // Clear all bets (parlay or all single bets had stakes)
          clearBetSlip();
        }
        setIsPlacing(false);
      }, 500);
    } catch (error) {
      console.error('Error placing bets:', error);
      setIsPlacing(false);
    }
  };

  const { formatOdds: formatOddsPref } = useUserPreferences();
  const formatOdds = (odds) => {
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    return formatOddsPref(oddsValue);
  };

  if (!mounted) return null;

  const content = (
    <>
      <CoinRain trigger={showCoinRain} onComplete={() => setShowCoinRain(false)} />

      {/* Persistent logo - mounted only when bet slip is open. Fully detached
          when closed so this fixed-position layer cannot trap pointer events
          on top-nav buttons (the messenger / battle "click trap" bug — see
          task #324). `display: none` is belt-and-suspenders on top of
          pointer-events:none in case a UA promotes the layer to interactive. */}
      <div 
        data-betslip="true"
        className="fixed z-[100]"
        style={{ 
          top: 0,
          left: 0,
          right: 0,
          display: isOpen ? 'block' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: 'none'
        }}
      >
        <div 
          className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px]"
          style={{ pointerEvents: 'none' }}
        >
          <div className="px-3 h-[70px] flex items-center" style={{ pointerEvents: 'none' }}>
            <div className="flex items-center justify-between w-full min-h-[70px] relative" style={{ pointerEvents: 'none' }}>
              <div className="absolute left-[-35px] top-1/2 -translate-y-1/2" style={{ pointerEvents: 'none' }}>
                <img 
                  src="/pikslogotransparent.png" 
                  alt="Piks" 
                  className="h-[140px] w-auto brightness-100"
                  style={{
                    filter: 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
                    animation: 'logoRedYellowGlow 4s infinite ease-in-out',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Backdrop — mobile only. On desktop the slip docks as a true
              side panel and the page content shifts left by the panel
              width (see PageShellShifter / .page-content-shift in
              globals.css), so a full-viewport backdrop would block the
              shifted page that the user can now still see and interact
              with. Mobile keeps no backdrop because the slip already
              takes over the full viewport at <md. */}

          {/* Desktop focus blur — a light backdrop blur over the shifted
              page so attention lands on the slip while the page stays
              legible "through" the blur. Sits below the panel (z-[98] <
              z-[99]) so the slip itself stays sharp, and pointer-events:
              none keeps the still-visible shifted page interactive
              (matching the intentional no-blocking-backdrop behavior on
              desktop). Hidden on mobile where the slip is already
              fullscreen. */}
          <div
            data-betslip="true"
            className="hidden md:block fixed inset-0 z-[98]"
            style={{
              pointerEvents: 'none',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              backgroundColor: 'rgba(0,0,0,0.12)'
            }}
          />

          {/* Bet slip panel - uses overscroll-behavior to contain scroll within panel */}
          <div 
            data-betslip="true"
            className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] z-[99] flex flex-col" 
            style={{ 
              backgroundColor: c.panelBg,
              overscrollBehavior: 'contain'
            }}
            onTouchStart={() => {}}
          >
            {/* Header with Piks branding - matches TopNavbar structure */}
            <div className="px-3 h-[70px] flex items-center" style={{ borderBottomWidth: 1, borderColor: c.divider }}>
              <div className="flex items-center justify-between w-full min-h-[70px] relative">
                {/* Logo placeholder - actual logo is in persistent layer above */}
                <div className="absolute left-[-35px] top-1/2 -translate-y-1/2 w-[140px] h-[140px]"></div>
                <div className="flex items-center gap-2 ml-auto mt-[2px] flex-wrap justify-end">
                {isLoggedIn && hasActiveMatchup && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
                      border: '2px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                    }}
                  >
                    <span className="text-xs leading-none" style={{ color: '#ffffff' }}>⚔</span>
                    <span className="text-xs font-bold" style={{ color: '#ffffff' }}>{formatMoney(bankroll, 0)}</span>
                  </div>
                )}
                {/* Cartoon-themed pik count badge — chunky black border
                    + offset shadow matches the cards inside the slip,
                    so the header reads as part of the same design
                    language instead of a plain pill. */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                    border: '2px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                  }}
                >
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#bfdbfe' }}></div>
                  <span className="text-xs font-extrabold tracking-wide" style={{ color: '#ffffff' }}>{bets.length} PIK{bets.length !== 1 ? 'S' : ''}</span>
                </div>
                {/* Cartoon-themed close button — same chunky border /
                    offset-shadow press behavior as the X used on the
                    individual bet cards, so the whole slip reads as a
                    single cohesive cartoon UI. */}
                <button
                  onClick={() => { haptic.tap(); onClose(); }}
                  className="flex items-center justify-center pikslip-cartoon-x"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
                    border: '2px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                  }}
                  aria-label="Close Pik Slip"
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            {bets.length >= 2 && (
              <div className="px-4 py-3" style={{ borderBottomWidth: 1, borderColor: c.divider }}>
                <div className="flex rounded-lg p-1 relative" style={{ backgroundColor: isLight ? c.innerSurface : '#1a1a1a' }}>
                  <div 
                    className="absolute top-1 bottom-1 rounded-md transition-all duration-200 pointer-events-none"
                    style={{
                      backgroundColor: '#2563eb',
                      width: 'calc(50% - 4px)',
                      left: betType === 'single' ? '4px' : 'calc(50% + 0px)',
                      zIndex: 0,
                    }}
                  />
                  <div
                    role="tab"
                    tabIndex={0}
                    onClick={() => setBetType('single')}
                    onKeyDown={(e) => e.key === 'Enter' && setBetType('single')}
                    className="flex-1 py-2 text-sm font-bold rounded-md transition-all relative text-center cursor-pointer select-none"
                    style={{
                      color: betType === 'single' ? '#ffffff' : c.mutedText,
                      zIndex: 1,
                    }}
                  >
                    Straight
                  </div>
                  <div
                    role="tab"
                    tabIndex={0}
                    onClick={() => setBetType('parlay')}
                    onKeyDown={(e) => e.key === 'Enter' && setBetType('parlay')}
                    className="flex-1 py-2 text-sm font-bold rounded-md transition-all relative text-center cursor-pointer select-none"
                    style={{
                      color: betType === 'parlay' ? '#ffffff' : c.mutedText,
                      zIndex: 1,
                    }}
                  >
                    Parlay
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {bets.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4" style={{ color: c.faintText }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="font-medium text-lg mb-2" style={{ color: c.mutedText }}>Your bet slip is empty</p>
                  <p style={{ color: c.faintText }}>Click on odds to add picks</p>
                </div>
              ) : betType === 'parlay' && bets.length >= 2 ? (
                /* Compact Parlay View - All legs in one container */
                <div className="px-4 pt-2 pb-4">
                  {/* Compact Legs List with Swipe-to-Delete and Connecting Line */}
                  <div>
                    {bets.map((bet, index) => {
                      const isLive = bet.isLive || liveScores[bet.gameId]?.isLive || liveScores[bet.matchup]?.isLive;
                      const matchupDisplay = bet.matchup || (bet.awayTeam && bet.homeTeam ? `${bet.awayTeamFull || bet.awayTeam} v ${bet.homeTeamFull || bet.homeTeam}` : '');
                      const swipeState = swipeStates[bet.id] || { offset: 0, isOpen: false };
                      const swipeOffset = swipeState.offset;
                      const isFirst = index === 0;
                      const isLast = index === bets.length - 1;
                      
                      return (
                        <div key={bet.id} className="relative overflow-hidden">
                          {/* Delete area revealed on swipe — cartoon themed
                              to match the single-bet view. Rendered as a
                              semantic <button> so screen readers announce
                              it correctly and keyboard users can activate
                              it; touch/swipe handlers attach the same way
                              they did on the prior <div> wrapper. */}
                          <button
                            type="button"
                            onClick={() => {
                              // Only trigger delete if not currently swiping
                              if (!swipeRefs.current[bet.id]?.isSwiping) {
                                handleDeleteTap(bet.id);
                              }
                            }}
                            onTouchStart={(e) => handleTouchStart(bet.id, e)}
                            onTouchMove={(e) => handleTouchMove(bet.id, e)}
                            onTouchEnd={() => handleTouchEnd(bet.id)}
                            tabIndex={swipeOffset > 0 ? 0 : -1}
                            aria-hidden={swipeOffset > 0 ? undefined : true}
                            aria-label={`Delete ${bet.selection}`}
                            className="absolute inset-y-0 right-0 flex flex-col items-center justify-center cursor-pointer gap-1 p-0 m-0"
                            style={{
                              width: `${Math.max(swipeOffset, swipeState.isOpen ? REVEAL_WIDTH : 0)}px`,
                              opacity: swipeOffset > 0 ? 1 : 0,
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              touchAction: 'pan-x',
                              background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                              borderTop: '2.5px solid #0a0a0a',
                              borderBottom: '2.5px solid #0a0a0a',
                              borderLeft: 'none',
                              borderRight: 'none',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="text-white font-extrabold text-[10px] uppercase tracking-wider select-none" style={{ textShadow: '0 1px 0 #0a0a0a' }}>Delete</span>
                          </button>
                          
                          {/* Swipeable content - NO padding on row, padding goes inside content */}
                          <div 
                            className="flex relative"
                            style={{ 
                              transform: `translateX(-${swipeOffset}px)`, 
                              backgroundColor: c.panelBg,
                              transition: swipeRefs.current[bet.id] ? 'none' : 'transform 0.2s ease-out'
                            }}
                            onTouchStart={(e) => handleTouchStart(bet.id, e)}
                            onTouchMove={(e) => handleTouchMove(bet.id, e)}
                            onTouchEnd={() => handleTouchEnd(bet.id)}
                          >
                            {/* Connector column - full height, no padding.
                                Width must exceed the 18px circle (below) so
                                the row's overflow-hidden — needed for the
                                swipe-to-delete reveal — doesn't clip the
                                circle's left edge. */}
                            <div className="flex-shrink-0 flex flex-col items-center" style={{ width: '22px' }}>
                              {/* Top segment - connects from previous circle */}
                              <div 
                                className="flex-1 flex items-center justify-center"
                                style={{ width: '22px' }}
                              >
                                {!isFirst && (
                                  <div style={{ 
                                    width: '2px', 
                                    height: '100%',
                                    backgroundColor: 'rgba(107, 114, 128, 0.6)'
                                  }} />
                                )}
                              </div>
                              
                              {/* Red minus circle — always interactive. The
                                "remove from slip" action is local-only and
                                must work whether or not the user has an
                                active matchup, so we no longer swap in a
                                disabled placeholder when betsReadOnly is
                                true. Cartoon-themed: 2px black border +
                                offset shadow for the chunky pop look used
                                throughout the battle UI. */}
                              <button
                                onClick={() => { haptic.tap(); removeBet(bet.id); }}
                                className="flex-shrink-0 rounded-full flex items-center justify-center pikslip-cartoon-x"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  minWidth: '18px',
                                  minHeight: '18px',
                                  background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                                  border: '2px solid #0a0a0a',
                                  boxShadow: '0 2px 0 #0a0a0a',
                                }}
                                aria-label={`Remove ${bet.selection}`}
                              >
                                <svg style={{ width: '9px', height: '9px' }} fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {/* Bottom segment - connects to next circle */}
                              <div 
                                className="flex-1 flex items-center justify-center"
                                style={{ width: '22px' }}
                              >
                                {!isLast && (
                                  <div style={{ 
                                    width: '2px', 
                                    height: '100%',
                                    backgroundColor: 'rgba(107, 114, 128, 0.6)'
                                  }} />
                                )}
                              </div>
                            </div>
                            
                            {/* Content column - has the padding and spacing from circles and delete button */}
                            <div className="flex-1 flex items-center gap-3 py-3 pl-3 pr-4 min-w-0">
                              {/* Fixed-width logo slot: single picked-team logo for ML/spread, dual logos for totals */}
                              <SelectionLogos selection={bet.selection} bet={bet} size={20} />
                              {/* Leg Info */}
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm leading-tight" style={{ color: c.bodyText }}>{capitalizeLeagueId(bet.selection)}</div>
                                <div className="text-xs uppercase mt-0.5 whitespace-nowrap" style={{ color: c.faintText }}>{bet.betType || 'Spread'}</div>
                                {/* Live Badge + Matchup */}
                                <div className="flex items-center gap-1.5 mt-1">
                                  {isLive && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 rounded">LIVE</span>
                                  )}
                                  {matchupDisplay && (
                                    <span className="text-xs truncate" style={{ color: c.faintText }}>{capitalizeLeagueId(matchupDisplay)}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Odds with movement indicator */}
                              <div className="flex-shrink-0 flex items-center gap-1">
                                {bet.oddsMoved === 'down' && <span className="text-red-500 text-xs">▼</span>}
                                {bet.oddsMoved === 'up' && <span className="text-green-500 text-xs">▲</span>}
                                <span className={`font-bold text-sm ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : ''
                                }`} style={{ color: bet.oddsMoved === 'up' ? undefined : bet.oddsMoved === 'down' ? undefined : (c.bodyText) }}>
                                  {formatOdds(bet.odds)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Remove All Selections */}
                  {!betsReadOnly && (
                    <button 
                      onClick={() => clearBetSlip()}
                      className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 transition-colors border-t"
                      style={{ borderColor: c.divider }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-sm font-medium">Remove all selections</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Standard Single Bets View - Matching Reference Theme with Swipe-to-Delete */
                <div className="p-4 space-y-4">
                  {bets.map((bet) => {
                    const isExpanded = expandedBets[bet.id] !== false;
                    const isCollapsible = bets.length > 1;
                    const swipeState = swipeStates[bet.id] || { offset: 0, isOpen: false };
                    const swipeOffset = swipeState.offset;
                    
                    // Get live data
                    const normalizeTeam = (name) => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                    const fullMatchup = bet.awayTeamFull && bet.homeTeamFull ? `${bet.awayTeamFull} @ ${bet.homeTeamFull}` : null;
                    const abbrMatchup = bet.awayTeam && bet.homeTeam ? `${bet.awayTeam} @ ${bet.homeTeam}` : null;
                    const normalizedMatchup = bet.matchup ? `${normalizeTeam(bet.matchup.split(' @ ')[0])}@${normalizeTeam(bet.matchup.split(' @ ')[1])}` : null;
                    const live = liveScores[bet.gameId] || liveScores[bet.matchup] || liveScores[bet.matchup?.toLowerCase()] ||
                      (fullMatchup && liveScores[fullMatchup]) || (abbrMatchup && liveScores[abbrMatchup]) ||
                      (normalizedMatchup && liveScores[normalizedMatchup]) || {};
                    const isLive = live.isLive || bet.isLive;
                    const awayScore = live.awayScore ?? bet.awayScore ?? null;
                    const homeScore = live.homeScore ?? bet.homeScore ?? null;
                    const gameTime = live.time || bet.gameTime || 'Upcoming';
                    
                    return (
                      <div key={bet.id} className="relative rounded-xl overflow-hidden">
                        {/* Delete area revealed on swipe - cartoon-themed
                            red gradient with trash glyph + "Delete" label.
                            Border + offset shadow match the rest of the
                            cartoon UI so the reveal feels like part of
                            the same design language as the swipeable
                            card itself. */}
                        <button
                          type="button"
                          onClick={() => {
                            // Only trigger delete if not currently swiping
                            if (!swipeRefs.current[bet.id]?.isSwiping) {
                              handleDeleteTap(bet.id);
                            }
                          }}
                          onTouchStart={(e) => handleTouchStart(bet.id, e)}
                          onTouchMove={(e) => handleTouchMove(bet.id, e)}
                          onTouchEnd={() => handleTouchEnd(bet.id)}
                          tabIndex={swipeOffset > 0 ? 0 : -1}
                          aria-hidden={swipeOffset > 0 ? undefined : true}
                          aria-label={`Delete ${bet.selection}`}
                          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center rounded-r-xl cursor-pointer gap-1 p-0 m-0"
                          style={{
                            width: `${Math.max(swipeOffset, swipeState.isOpen ? REVEAL_WIDTH : 0)}px`,
                            opacity: swipeOffset > 0 ? 1 : 0,
                            WebkitTapHighlightColor: 'transparent',
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            touchAction: 'pan-x',
                            background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                            borderTop: '2.5px solid #0a0a0a',
                            borderRight: '2.5px solid #0a0a0a',
                            borderBottom: '2.5px solid #0a0a0a',
                            borderLeft: 'none',
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="text-white font-extrabold text-[11px] uppercase tracking-wider select-none" style={{ textShadow: '0 1px 0 #0a0a0a' }}>Delete</span>
                        </button>

                        {/* Swipeable card - cartoon themed: chunky 2.5px
                            black border + offset shadow that lifts the
                            card off the slip background, matching the
                            BattleModeChooser / PlayFriendModal language. */}
                        <div
                          className="rounded-xl relative pikslip-cartoon-card"
                          style={{
                            transform: `translateX(-${swipeOffset}px)`,
                            background: c.cardSurface,
                            border: '2.5px solid #0a0a0a',
                            boxShadow: '0 4px 0 #0a0a0a',
                            transition: swipeRefs.current[bet.id] ? 'none' : 'transform 0.2s ease-out'
                          }}
                          onTouchStart={(e) => handleTouchStart(bet.id, e)}
                          onTouchMove={(e) => handleTouchMove(bet.id, e)}
                          onTouchEnd={() => handleTouchEnd(bet.id)}
                        >
                          {/* Collapsible Header */}
                          <div 
                            className={`px-4 py-3 flex items-center justify-between ${isCollapsible ? 'cursor-pointer' : ''}`}
                            onClick={() => isCollapsible && toggleBetExpanded(bet.id)}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {/* Cartoon-themed remove button. Always
                                  rendered (no betsReadOnly gate) so the
                                  user can always clear a bet from the
                                  slip even before they've started a
                                  match. Mirrors the parlay-leg X button
                                  styling to keep the slip visually
                                  consistent across modes. */}
                              <button
                                onClick={(e) => { e.stopPropagation(); haptic.tap(); removeBet(bet.id); }}
                                className="flex-shrink-0 rounded-full flex items-center justify-center pikslip-cartoon-x"
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  minWidth: '20px',
                                  minHeight: '20px',
                                  background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                                  border: '2px solid #0a0a0a',
                                  boxShadow: '0 2px 0 #0a0a0a',
                                }}
                                aria-label={`Remove ${bet.selection}`}
                              >
                                <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {isCollapsible && (
                                <svg className="w-4 h-4 transition-transform flex-shrink-0" style={{ color: c.mutedText, transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                              <span className="text-xs font-bold uppercase text-blue-500 flex-shrink-0">{bet.betType || 'Spread'}</span>
                              {/* Show LIVE indicator when collapsed OR expanded */}
                              {isLive && (
                                <span className="flex items-center gap-1 flex-shrink-0 ml-1">
                                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                  <span className="text-red-500 text-[10px] font-bold">LIVE</span>
                                </span>
                              )}
                              {/* Show team when collapsed */}
                              {!isExpanded && (
                                <span className="text-xs truncate ml-1" style={{ color: c.mutedText }}>
                                  {capitalizeLeagueId(bet.selection)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center flex-shrink-0">
                              {/* Show odds when collapsed */}
                              {!isExpanded && (
                                <span className={`font-bold text-sm ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                }`}>
                                  {formatOdds(bet.odds)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Expandable Content */}
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              {/* Selection & Odds Row */}
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 flex items-start gap-2 min-w-0">
                                  <div className="mt-0.5">
                                    <SelectionLogos selection={bet.selection} bet={bet} size={22} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-lg leading-tight truncate" style={{ color: c.bodyText }}>{capitalizeLeagueId(bet.selection)}</div>
                                    <div className="text-xs uppercase mt-0.5 whitespace-nowrap" style={{ color: c.mutedText }}>{bet.betType}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {bet.oddsMoved === 'down' && <span className="text-red-500 text-sm">▼</span>}
                                  {bet.oddsMoved === 'up' && <span className="text-green-500 text-sm">▲</span>}
                                  <span className={`font-bold text-xl ${
                                    bet.oddsMoved === 'up' ? 'text-green-400' : 
                                    bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                  }`}>
                                    {formatOdds(bet.odds)}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Game Info Box - compact, LIVE is on header row */}
                              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: isLight ? c.innerSurface : 'rgba(30, 41, 59, 0.4)', borderWidth: 1, borderColor: isLight ? c.divider : 'rgba(55, 65, 81, 0.3)' }}>
                                <div className="space-y-0.5">
                                  {!isLive && gameTime && (
                                    <div className="flex justify-end">
                                      <span className="text-[10px]" style={{ color: c.mutedText }}>{gameTime}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <TeamLogo name={bet.awayTeamFull || bet.awayTeam || bet.matchup?.split(' @ ')[0]} sport={bet.sport || bet.sportName} size={18} />
                                      <span className="text-sm truncate" style={{ color: c.bodyText }}>{capitalizeLeagueId(bet.awayTeamFull || bet.awayTeam || bet.matchup?.split(' @ ')[0] || 'Away')}</span>
                                    </div>
                                    {awayScore !== null && <span className="font-bold text-sm flex-shrink-0 ml-2" style={{ color: c.bodyText }}>{awayScore}</span>}
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <TeamLogo name={bet.homeTeamFull || bet.homeTeam || bet.matchup?.split(' @ ')[1]} sport={bet.sport || bet.sportName} size={18} />
                                      <span className="text-sm truncate" style={{ color: c.bodyText }}>{capitalizeLeagueId(bet.homeTeamFull || bet.homeTeam || bet.matchup?.split(' @ ')[1] || 'Home')}</span>
                                    </div>
                                    {homeScore !== null && <span className="font-bold text-sm flex-shrink-0 ml-2" style={{ color: c.bodyText }}>{homeScore}</span>}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Stake Input */}
                              {betType === 'single' && (
                                <div className="flex items-center gap-3 mt-4">
                                  <div className="relative flex-1">
                                    <button
                                      type="button"
                                      onClick={() => setShowCoinsExplainer(true)}
                                      className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-orange-400/10 transition-colors"
                                      style={{ color: c.coinGlyph }}
                                      aria-label="What are Clash Coins?"
                                      title="Clash Coins — tap for details"
                                    >
                                      <span className="text-base leading-none">⚔</span>
                                    </button>
                                    {betsReadOnly ? (
                                      <div
                                        className="w-full pl-11 pr-3 py-3 rounded-lg text-base"
                                        style={{
                                          backgroundColor: isLight ? c.innerSurface : 'rgba(30, 41, 59, 0.4)',
                                          borderWidth: 1,
                                          borderColor: c.divider,
                                          color: c.mutedText
                                        }}
                                      >
                                        {bet.stake ? getStakeDisplayValue(bet) : '—'}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={getStakeDisplayValue(bet)}
                                        onChange={(e) => handleStakeInputChange(bet.id, e)}
                                        className="w-full pl-11 pr-3 py-3 rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        style={{ 
                                          backgroundColor: isLight ? c.innerSurface : 'rgba(30, 41, 59, 0.8)',
                                          borderWidth: 1,
                                          borderColor: c.divider,
                                          color: c.bodyText
                                        }}
                                        placeholder={`Min ${minBetAmount}`}
                                      />
                                    )}
                                  </div>
                                  <div className="text-right min-w-[70px]">
                                    <div className="text-[10px] uppercase tracking-wide" style={{ color: c.mutedText }}>To Win</div>
                                    <div className="font-bold text-lg flex items-center justify-end gap-1">
                                      <span className="leading-none" style={{ color: c.coinGlyph }}>⚔</span>
                                      <span style={{ color: c.bodyText }}>{bet.stake ? formatMoney(calculatePayout(bet.odds, bet.stake) - bet.stake, 0) : '0'}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Remove All Selections - show when more than one bet in straight mode */}
                  {bets.length > 1 && !betsReadOnly && (
                    <button 
                      onClick={() => clearBetSlip()}
                      className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 transition-colors border-t"
                      style={{ borderColor: c.divider }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-sm font-medium">Remove all selections</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {bets.length > 0 && (
              <div className="flex-shrink-0 p-4" style={{ borderTopWidth: 1, borderColor: c.divider, backgroundColor: c.panelBg }}>
                {/* Parlay Stake Input */}
                {betType === 'parlay' && bets.length >= 2 && !betsReadOnly && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <button
                          type="button"
                          onClick={() => setShowCoinsExplainer(true)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-orange-400/10 transition-colors"
                          style={{ color: c.coinGlyph }}
                          aria-label="What are Clash Coins?"
                          title="Clash Coins — tap for details"
                        >
                          <span className="text-base leading-none">⚔</span>
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getParlayStakeDisplayValue()}
                          onChange={handleParlayStakeInputChange}
                          className="w-full pl-11 pr-3 py-3 rounded-lg text-base focus:outline-none focus:border-blue-500"
                          style={{ backgroundColor: isLight ? c.innerSurface : '#1a1a1a', borderWidth: 1, borderColor: c.divider, color: c.bodyText }}
                          placeholder={`Min ${minBetAmount}`}
                        />
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-[10px] uppercase" style={{ color: c.mutedText }}>Parlay Win</div>
                        <div className="font-bold text-lg inline-flex items-center justify-end gap-1">
                          <span className="leading-none" style={{ color: c.coinGlyph }}>⚔</span>
                          <span className={isLight ? '' : 'text-green-400'} style={isLight ? { color: c.posGreen } : undefined}>{parlayStake ? formatMoney(totalPayout - parlayStake, 0) : '0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {isLoggedIn && !hasActiveMatchup ? (
                  <div className="rounded-lg p-4 mb-3 text-center" style={{ backgroundColor: isLight ? c.innerSurface : 'rgba(15, 23, 42, 0.5)', borderWidth: 1, borderColor: c.divider }}>
                    <p className="font-semibold text-base mb-1" style={{ color: c.bodyText }}>Start a match to place piks</p>
                    <p className="text-sm mb-4" style={{ color: c.mutedText }}>Piks are played with Clash Coins. You need an active battle to submit your selections.</p>
                    <button
                      type="button"
                      className="no-hover-effect"
                      onClick={() => {
                        // Tear down the bet slip's overlay state in the same
                        // tick as the route push so the next page mounts onto
                        // a clean document. Previously, leaving the slip's
                        // backdrop / a stale body lock in place caused the
                        // battle page to look frozen for 5–10 seconds while
                        // the click trap blocked every tap. We:
                        //   1. Close the slip via context (hides backdrop).
                        //   2. Release any body/html scroll locks left over
                        //      from sibling modals.
                        //   3. Restore window scroll position (the slip
                        //      effect at line 364 normally does this on the
                        //      next render, but navigation may unmount us
                        //      before that effect fires).
                        //   4. Push the route — do NOT await any network.
                        setShowBetSlip(false);
                        try { releaseBodyScrollLock(null); } catch (_e) {}
                        try {
                          if (savedScrollRef.current > 0 && typeof window !== 'undefined') {
                            window.scrollTo(0, savedScrollRef.current);
                          }
                        } catch (_e) {}
                        router.push('/battle');
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '14px 0',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        cursor: 'pointer',
                        border: 'none',
                        outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'none'
                      }}
                    >
                      Start a match
                    </button>
                  </div>
                ) : (
                <>
                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: isLight ? c.innerSurface : 'rgba(15, 23, 42, 0.5)' }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: c.mutedText }}>Total Pikked</span>
                    <span className="font-bold inline-flex items-center gap-1">
                      <span className="leading-none" style={{ color: c.coinGlyph }}>⚔</span>
                      <span style={{ color: c.bodyText }}>{formatMoney(totalStake, 0)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: c.mutedText }}>Potential Payout</span>
                    <span className="font-bold text-lg inline-flex items-center gap-1">
                      <span className="leading-none" style={{ color: c.coinGlyph }}>⚔</span>
                      <span className={isLight ? '' : 'text-green-400'} style={isLight ? { color: c.posGreen } : undefined}>{formatMoney(totalPayout, 0)}</span>
                    </span>
                  </div>
                </div>

                {isLoggedIn && totalStake > bankroll && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Insufficient balance: ⚔ {formatMoney(bankroll, 0)}</p>
                  </div>
                )}

                {isLoggedIn && validation.belowMinimum && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Minimum bet: ⚔ {minBetAmount}</p>
                  </div>
                )}

                {!isLoggedIn ? (
                  <button
                    type="button"
                    className="no-hover-effect"
                    onClick={() => {
                      localStorage.setItem('betslip_pending_login', JSON.stringify({ redirect: 'betslip', timestamp: Date.now() }));
                      setShowBetSlip(false);
                      window.dispatchEvent(new CustomEvent('openAuthPopup'));
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '16px 0',
                      borderRadius: '12px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                      border: 'none',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'none'
                    }}
                  >
                    Sign In to Place Piks
                  </button>
                ) : (() => {
                  // For straight bets, only count bets that have stakes entered
                  const betsWithStakes = betType === 'single' ? bets.filter(b => b.stake && parseFloat(b.stake) >= minBetAmount) : bets;
                  const placeBetCount = betType === 'single' ? betsWithStakes.length : bets.length;
                  const canPlace = validation.isValid && totalStake <= bankroll && !isPlacing && totalStake > 0 && placeBetCount > 0;
                  
                  return (
                    <button
                      type="button"
                      className="no-hover-effect"
                      onClick={() => {
                        console.log('Place button clicked', { canPlace, validation, totalStake, bankroll, isPlacing, placeBetCount });
                        if (canPlace) {
                          placeBets();
                        }
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '16px 0',
                        borderRadius: '12px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundColor: canPlace ? '#2563eb' : '#4b5563',
                        color: '#ffffff',
                        cursor: canPlace ? 'pointer' : 'not-allowed',
                        border: 'none',
                        outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'none'
                      }}
                    >
                      {isPlacing ? 'Placing...' : betType === 'parlay' ? `Place ${bets.length}-Leg Parlay` : `Place ${placeBetCount} Pik${placeBetCount !== 1 ? 's' : ''}`}
                    </button>
                  );
                })()}
                </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <ShareableBetSlip 
        bet={selectedWinningBet}
        isVisible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedWinningBet(null);
        }}
      />

      {showReceipt && currentReceipt && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={(e) => {
            // Guard against ghost-click from the tap that placed the bet
            const openedAt = e.currentTarget.dataset.openedAt;
            if (openedAt && Date.now() - parseInt(openedAt) < 1000) return;
            if (receiptTimerRef.current) { clearTimeout(receiptTimerRef.current); receiptTimerRef.current = null; }
            setShowReceipt(false);
            setCurrentReceipt(null);
            setShowPikPlacedBadge(false);
          }}
          ref={(el) => { if (el && !el.dataset.openedAt) el.dataset.openedAt = String(Date.now()); }}
        >
          <div 
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (receiptTimerRef.current) { clearTimeout(receiptTimerRef.current); receiptTimerRef.current = null; }
                setShowReceipt(false);
                setCurrentReceipt(null);
                setShowPikPlacedBadge(false);
              }}
              className="absolute -top-1 -right-1 z-10 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {showPikPlacedBadge && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-center animate-badge-fade pointer-events-none">
                <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-bold">Pik Placed!</span>
                </div>
              </div>
            )}
            <PiksBetCard 
              bet={currentReceipt}
              liveScores={liveScores}
              onCashOut={async (betId) => {
                try {
                  const response = await fetch('/api/bets/cashout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ betId: betId })
                  });
                  if (response.ok) {
                    const data = await response.json();
                    if (data.newBankroll !== undefined) {
                      if (onBetPlaced) onBetPlaced(data.newBankroll);
                      // Cashout returns the matchup (battle coins) balance,
                      // not real cash. Refresh the matchup context so the
                      // points pill updates without overwriting the real
                      // cash pill in the header.
                      if (refreshMatchup) refreshMatchup();
                    }
                    // Update the receipt to show cashed out status instead of closing
                    setCurrentReceipt(prev => ({
                      ...prev,
                      status: 'cashed_out',
                      profit: parseFloat(prev.stake) * -0.2
                    }));
                  }
                } catch (error) {
                  console.error('Cashout failed:', error);
                }
              }}
              onShare={() => {}}
            />
          </div>
          <style jsx>{`
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes badge-fade {
              0% { opacity: 1; }
              70% { opacity: 1; }
              100% { opacity: 0; }
            }
            .animate-fade-in {
              animation: fade-in 0.3s ease-out forwards;
            }
            .animate-badge-fade {
              animation: badge-fade 3s ease-out forwards;
            }
          `}</style>
        </div>
      )}

      <BalanceExplainerModal
        type="coins"
        isOpen={showCoinsExplainer}
        onClose={() => setShowCoinsExplainer(false)}
        coinsBalance={matchupBalance}
        matchup={matchupData?.matchup || null}
        opponent={matchupOpponent}
      />

          </>
  );

  return ReactDOM.createPortal(content, document.body);
}
