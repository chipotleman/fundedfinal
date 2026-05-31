import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import haptic from '../../utils/haptics';
import UserAvatar from '../UserAvatar';
import { CartoonChipStyles } from './CartoonChip';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import { useGames } from '../../contexts/GamesContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';
import RushFlow from './rush/RushFlow';
import { FindingOpponent, OpponentFound, MatchConfirmed } from './matchflow/MatchFlowScreens';
import { useBetaMode } from '../../contexts/SiteConfigContext';

// Rush in-popup flow constants. The modal carries the user all the way
// from "MATCH FOUND" → live-game voting → ready check → 3-2-1 countdown →
// the actual 6-question gameplay → result, so the experience feels like
// a single trivia-crack-style ritual instead of a page swap. The
// /battle/rush/[id] routed page still exists as a fallback for
// refresh / back / deep-link, but the popup is the primary surface.
const RUSH_VOTE_GAME_LIMIT = 3;
const RUSH_FOUND_TO_VOTE_DELAY_MS = 1400;
const RUSH_COUNTDOWN_TICK_MS = 800;
const RUSH_GO_DURATION_MS = 600;
const RUSH_STATE_POLL_MS = 750;
// How long the result slide stays visible before we route the user
// back to /battle (where the result popup picks up via SSE plumbing).
const RUSH_RESULT_AUTO_EXIT_MS = 12000;

const GAME_MODE_OPTIONS = [
  {
    id: 'rush',
    label: 'RUSH',
    icon: '⚡',
    tagline: 'FAST · INTENSE',
    description: 'Pick 6 props from a live game',
    coins: 10000,
    durationMinutes: 180,
    durationType: 'rush',
    color: '#10b981',
  },
  {
    id: 'original',
    label: 'ORIGINAL',
    icon: '🏆',
    tagline: 'BALANCED · COMPETITIVE',
    description: 'Highest balance after all games end wins',
    coins: 10000,
    durationMinutes: 1440,
    durationType: 'original',
    recommended: true,
    color: '#3b82f6',
  },
  {
    id: 'tournament',
    label: 'TOURNAMENT',
    icon: '👑',
    tagline: 'BIG STAKES · BIGGER WINS',
    description: '3-day battle with a massive bankroll',
    coins: 100000,
    durationMinutes: 4320,
    durationType: 'tournament',
    color: '#f97316',
  },
];

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];

const FAKE_NAMES = [
  'ShadowBet', 'CryptoKing', 'LuckyDraw', 'BetMaster', 'SharpShooter',
  'OddsWizard', 'ClutchPlay', 'BigStack', 'IceVeins', 'MoneyLine',
  'ParlayCash', 'UnderdogX', 'GoldRush', 'NitroPickz', 'AceHigh',
];

const FAKE_RECORDS = [
  '12-3', '8-5', '15-7', '10-4', '6-2', '20-9', '9-6', '14-3', '11-8', '7-1',
  '18-5', '13-6', '5-3', '16-4', '22-10',
];

const TIPS = [
  'Diversify your picks across different sports',
  'Best players win about 60% of their battles',
  "Don't chase losses — stick to your strategy",
  'Higher-odds picks = higher potential payout',
  'Parlays are risky but can swing a battle fast',
  'Check injury reports before locking in picks',
  'Underdogs hit more often than you think',
  'Bankroll management is key to winning long-term',
  'Watch line movement for sharp money signals',
  'Live betting can turn a losing battle around',
];

function MatchFoundContent({
  isBeta,
  buyIn,
  potSize,
  payout,
  gameMode,
  selectedMode,
  userName,
  userAvatar,
  userProfile,
  matchedOpponent,
  matchedAvatar,
  th,
  onContinue,
  onCancel,
}) {
  // Two-phase premium flow that matches the mockup:
  //   phase 'found'     → OpponentFound (accept / decline + auto-accept timer)
  //   phase 'confirmed' → MatchConfirmed (green check + 3-2-1) → onContinue()
  // Rush keeps its own behavior (loading state, parent drives the advance).
  const isRush = gameMode === 'rush';
  const ACCEPT_SECONDS = 8;
  const [phase, setPhase] = useState('found');
  const [secondsLeft, setSecondsLeft] = useState(ACCEPT_SECONDS);
  const [count, setCount] = useState(3);
  const acceptedRef = useRef(false);
  const firedRef = useRef(false);

  const stake = isBeta ? (Number(buyIn) || 10000) : (Number(buyIn) || 0);

  const you = {
    id: userProfile?.id,
    name: userName,
    avatar: userAvatar,
    battleWins: userProfile?.battleWins,
  };
  const opp = {
    id: matchedOpponent?.id,
    name: matchedOpponent?.username || 'Opponent',
    avatar: matchedAvatar,
    battleWins: matchedOpponent?.battleWins,
  };

  const accept = () => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    setPhase('confirmed');
  };
  const decline = () => {
    acceptedRef.current = true;
    onCancel?.();
  };

  // Accept-window countdown (non-rush). On expiry, auto-accept into 3-2-1.
  useEffect(() => {
    if (isRush || phase !== 'found') return undefined;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); accept(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRush, phase]);

  // Confirmed 3-2-1 countdown, then hand off to the game (once).
  useEffect(() => {
    if (phase !== 'confirmed') return undefined;
    if (count <= 0) {
      if (!firedRef.current) { firedRef.current = true; try { onContinue(); } catch (_) {} }
      return undefined;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(id);
  }, [phase, count, onContinue]);

  if (phase === 'confirmed') {
    return (
      <MatchConfirmed
        you={you}
        opp={opp}
        balance={stake}
        stake={stake}
        count={count > 0 ? count : 1}
        label={isRush ? 'Loading live games…' : 'Getting your game ready…'}
      />
    );
  }

  return (
    <OpponentFound
      you={you}
      opp={opp}
      balance={stake}
      stake={stake}
      secondsLeft={isRush ? undefined : secondsLeft}
      onAccept={isRush ? undefined : accept}
      onDecline={isRush ? undefined : decline}
      loading={isRush}
      loadingLabel="Loading live games…"
    />
  );
}

export default function QuickMatchModal({ isOpen, onClose, onBack, userId, onMatchFound, presetMatch = null }) {
  useModalScrollLock(isOpen);
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  // Beta mode: force every match to ORIGINAL with no real-money buy-in.
  // The visual chooser still renders, but RUSH / TOURNAMENT are faded
  // and uninteractive, the buy-in row is hidden, and a beta notice is
  // shown in its place. Server enforces the same constraints.
  const isBeta = useBetaMode();
  useEffect(() => {
    if (isBeta) {
      setGameMode('original');
      setBuyIn(0);
    }
  }, [isBeta]);
  // Rush requires a live game — lock the chip when none are available.
  // We deliberately do NOT auto-downgrade rush → original here: doing so
  // silently turned a user's intended Rush match into a 24-hour Original
  // bet-balance battle whenever live games briefly disappeared. Instead
  // we keep the user's selection and block at submit time below with a
  // visible error so they can pick a different mode (or wait for a
  // live game) intentionally.
  const rushAvailable = useRushAvailability(isOpen);
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [currentAvatarIdx, setCurrentAvatarIdx] = useState(0);
  const [avatarFlip, setAvatarFlip] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [currentRecord, setCurrentRecord] = useState('');
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const [matchedMatchup, setMatchedMatchup] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(false);
  // Rush in-popup flow state
  const [rushState, setRushState] = useState(null);
  // Full /state response (matchup w/ player profiles + rush view) used by
  // the new best-of-3 RushFlow rendered in the single 'rush-active' step.
  const [rushApi, setRushApi] = useState(null);
  const [rushBusy, setRushBusy] = useState(false);
  const [rushRematchWaiting, setRushRematchWaiting] = useState(false);
  const [serverLiveGames, setServerLiveGames] = useState([]);
  const [rushVoteError, setRushVoteError] = useState('');
  const [pendingVoteId, setPendingVoteId] = useState(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [voteDeadlineTick, setVoteDeadlineTick] = useState(0);
  const [pendingReady, setPendingReady] = useState(false);
  const [readyError, setReadyError] = useState('');
  const [pickedAnswer, setPickedAnswer] = useState(null); // { questionId, answerKey }
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const lastQuestionIdRef = useRef(null);
  const games = useGames();
  const apiGames = games?.apiGames;
  const { data: session } = useSession();
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const avatarCycleRef = useRef(null);
  const flipTimeoutRef = useRef(null);
  const tipCycleRef = useRef(null);
  const tipFadeTimeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanupAllTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    if (tipCycleRef.current) clearInterval(tipCycleRef.current);
    if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
    intervalRef.current = null;
    pollRef.current = null;
    avatarCycleRef.current = null;
    flipTimeoutRef.current = null;
    tipCycleRef.current = null;
    tipFadeTimeoutRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      // When opened with a pre-resolved match, jump directly to the
      // "found" step so the modal acts as a hand-off popup for an
      // externally-driven matchmaking flow (e.g. the in-card search on
      // the homepage YouVsCard) without ever showing config/searching.
      if (presetMatch?.matchup) {
        cleanupAllTimers();
        setStep('found');
        setMatchedOpponent(presetMatch.opponent || null);
        setMatchedMatchup(presetMatch.matchup);
        if (typeof presetMatch.buyIn === 'number') setBuyIn(presetMatch.buyIn);
        if (typeof presetMatch.gameMode === 'string') setGameMode(presetMatch.gameMode);
        setError('');
      }
      fetch('/api/admin/battle-avatars')
        .then(r => r.json())
        .then(data => {
          if (data.avatars && data.avatars.length > 0) {
            setAvatars(data.avatars);
          }
        })
        .catch(() => {});
    }
    if (!isOpen) {
      cancelledRef.current = true;
      cleanupAllTimers();
      setStep('config');
      setSearchTime(0);
      setError('');
      setAvatarFlip(false);
      setCurrentAvatarIdx(0);
      setCurrentName('');
      setCurrentRecord('');
      setMatchedOpponent(null);
      setMatchedMatchup(null);
      setTipIndex(0);
      // Reset rush in-popup flow state so a fresh open doesn't carry
      // stale vote/state from a previous match into the next session.
      setRushState(null);
      setServerLiveGames([]);
      setRushVoteError('');
      setPendingVoteId(null);
      setCountdownNum(3);
      setPendingReady(false);
      setReadyError('');
      setPickedAnswer(null);
      setSubmittingAnswer(false);
      lastQuestionIdRef.current = null;
    }
    return () => { cleanupAllTimers(); };
    // `presetMatch` is included so a fresh hand-off (new opponent +
    // matchup pushed in while the modal is already mounted-but-closed
    // or even open) re-seeds the `found` step instead of being missed
    // until the next open/close cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetMatch]);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setUserProfile(data.profile || data);
        })
        .catch(() => {});
    }
  }, [isOpen, session?.user?.id]);

  useEffect(() => {
    if (step === 'searching') {
      setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
      setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);

      avatarCycleRef.current = setInterval(() => {
        setAvatarFlip(true);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
          setCurrentAvatarIdx(prev => {
            const pool = avatars.length > 0 ? avatars.length : 1;
            return (prev + 1 + Math.floor(Math.random() * Math.max(pool - 1, 1))) % pool;
          });
          setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
          setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);
          setAvatarFlip(false);
        }, 250);
      }, 1000);

      tipCycleRef.current = setInterval(() => {
        setTipFade(true);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
        tipFadeTimeoutRef.current = setTimeout(() => {
          setTipIndex(prev => (prev + 1) % TIPS.length);
          setTipFade(false);
        }, 300);
      }, 4000);

      return () => {
        if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        if (tipCycleRef.current) clearInterval(tipCycleRef.current);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
      };
    }
  }, [step, avatars]);

  // ========================================================================
  // Rush in-popup flow effects
  //
  // These power the trivia-crack-style ritual the user goes through when
  // a Rush match is found: brief "MATCH FOUND" beat → live-game vote →
  // rules slide → 3-2-1 countdown → handoff to /battle/rush/[id] for the
  // question gameplay. We poll the same /api/battles/rush/[id]/state
  // endpoint the routed page uses (and subscribe to its SSE channel) so
  // the modal stays in lock-step with the server-authoritative state
  // machine — votes, deadline expiry, and the voting→playing flip all
  // come from the same source of truth.
  // ========================================================================

  // Auto-advance from "MATCH FOUND" into the single 'rush-active' step for
  // Rush. RushFlow then renders the correct screen (accept → confirmed →
  // picking → live → round_result → completed) off the polled state. Other
  // modes (original / tournament) still show the "Continue to Battle" button.
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'found') return;
    if (gameMode !== 'rush') return;
    if (!matchedMatchup?.id) return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      setStep('rush-active');
    }, RUSH_FOUND_TO_VOTE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isOpen, step, gameMode, matchedMatchup?.id]);

  // Poll + SSE the server-authoritative rush state for the whole match
  // while we're in 'rush-active'. Polling at 750ms keeps countdowns smooth;
  // SSE delivers near-instant phase flips. We store the full response so
  // RushFlow gets the matchup (with player profiles) and the rush view.
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'rush-active') return;
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;

    let cancelled = false;
    const fetchRush = async () => {
      try {
        const res = await fetch(`/api/battles/rush/${matchupId}/state`);
        if (cancelled || !res.ok) return;
        const j = await res.json();
        if (!cancelled) {
          setRushApi(j || null);
          setRushState(j?.rush || null);
        }
      } catch {}
    };
    fetchRush();
    const t = setInterval(fetchRush, RUSH_STATE_POLL_MS);

    let unsub = null;
    try {
      const client = getBattleStreamClient();
      if (client) {
        unsub = client.subscribe((ev) => {
          if (!ev) return;
          if (ev.type === 'matchup:rush:update' && ev.matchupId === matchupId) fetchRush();
          else if (ev.type === 'matchup:rematch' && ev.matchupId === matchupId && ev.rematchMatchupId) {
            enterRushRematch(ev.rematchMatchupId);
          }
          else if (ev.type === 'piks:reconnected') fetchRush();
        });
      }
    } catch {}

    return () => {
      cancelled = true;
      clearInterval(t);
      if (unsub) { try { unsub(); } catch {} }
    };
  }, [isOpen, step, matchedMatchup?.id]);

  // Stale-accept / cancellation escape: the server flips the rush phase to
  // 'cancelled' when an opponent never accepts. RushFlow shows a "stake is
  // safe" card and calls onExit; this also routes out if the user lingers.
  useEffect(() => {
    if (step !== 'rush-active') return;
    if (rushState?.phase !== 'cancelled') return;
    if (cancelledRef.current) return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      onClose();
      router.push('/battle?rushCancelled=1');
    }, 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rushState?.phase]);

  // Live games for the vote slide. Merge server list + GamesContext
  // (mirrors the routed rush page's logic) so demo / simulated live
  // games surface here too. Cap at RUSH_VOTE_GAME_LIMIT so the slide
  // stays a snappy 3-card pick rather than a long scroll.
  const liveGamesForVote = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (g) => {
      if (!g) return;
      const key = `${g.sport_key || ''}::${g.id ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(g);
    };
    // Pull from GamesContext FIRST so the rush vote slide shows the
    // exact same live games (in the same order) the user is already
    // seeing on the dashboard. The server list is a backstop in case
    // GamesContext hasn't hydrated yet.
    if (Array.isArray(apiGames)) {
      apiGames.forEach((g) => { if (g && g.isLive) push(g); });
    }
    serverLiveGames.forEach(push);
    return out.slice(0, RUSH_VOTE_GAME_LIMIT);
  }, [serverLiveGames, apiGames]);

  // --- Rush actions (best-of-3). Each POSTs to the server-authoritative
  // endpoint then refetches immediately so the UI doesn't wait on the poll.
  const rushPost = async (action, body) => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;
    setRushBusy(true);
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
      });
      await res.json().catch(() => ({}));
      try {
        const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
        setRushApi(j || null);
        setRushState(j?.rush || null);
      } catch {}
    } catch {} finally {
      setRushBusy(false);
    }
  };

  const submitRushAccept = () => { haptic.tap?.(); return rushPost('accept'); };
  const submitRushPick = (optionKey) => { haptic.tap?.(); return rushPost('pick', { optionKey }); };
  const submitRushContinue = () => { haptic.tap?.(); return rushPost('continue'); };

  // Re-enter the in-popup rush flow on a freshly-created matchup id (used
  // after a rematch handshake resolves). The /state poll keyed on
  // matchedMatchup.id picks up the new match and drives RushFlow.
  const enterRushRematch = (newMatchupId) => {
    if (!newMatchupId) return;
    setRushRematchWaiting(false);
    setRushApi(null);
    setRushState(null);
    setMatchedMatchup({ id: newMatchupId, durationType: 'rush' });
    setGameMode('rush');
    setStep('rush-active');
  };

  // "New Opponent": spin up a fresh rush matchup via matchmaking and
  // re-enter the in-popup flow at 'found' (which auto-advances to
  // 'rush-active'). Falls back to the routed page if no instant match.
  const startRushNewOpponent = async (stake) => {
    setRushBusy(true);
    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameMode: 'rush', buyIn: stake }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.matched && j?.matchup?.id) {
        setRushApi(null);
        setRushState(null);
        setMatchedOpponent(j.opponent || null);
        setMatchedMatchup(j.matchup);
        if (typeof stake === 'number') setBuyIn(stake);
        setGameMode('rush');
        setStep('found');
      } else {
        onClose();
        router.push('/battle?quickmatch=rush');
      }
    } catch {
      onClose();
      router.push('/battle');
    } finally {
      setRushBusy(false);
    }
  };

  // "Rematch": same opponent. Real opponents use the two-sided accept
  // handshake — a new matchup is created only once BOTH players accept.
  // Bots have no second party, so fall back to a fresh match immediately.
  const startRushRematch = async (stake) => {
    const m = rushApi?.matchup;
    if (!m || m.isFakeOpponent) return startRushNewOpponent(stake);
    setRushBusy(true);
    try {
      const res = await fetch(`/api/matchups/${m.id}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'accept' }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.rematchMatchupId) {
        enterRushRematch(j.rematchMatchupId);
      } else {
        // Opponent hasn't accepted yet — wait for the matchup:rematch SSE.
        setRushRematchWaiting(true);
      }
    } catch {
      /* keep the rematch screen up so the user can retry */
    } finally {
      setRushBusy(false);
    }
  };

  const isInRushFlow = step === 'rush-active';

  // Closing the modal mid-rush would orphan the user in an active
  // matchup. Instead, hand them off to the routed gameplay page so
  // they can finish (or forfeit) from there.
  const handleClose = () => {
    if (isInRushFlow && matchedMatchup?.id) {
      onClose();
      router.push(`/battle/rush/${matchedMatchup.id}`);
      return;
    }
    onClose();
  };

  const handleMatchFound = (opponent, matchup) => {
    if (cancelledRef.current) return;
    cleanupAllTimers();
    if (!matchup) {
      setError('Matchmaking timed out. Please try again.');
      setStep('config');
      return;
    }
    if (opponent) setMatchedOpponent(opponent);
    setMatchedMatchup(matchup);
    setStep('found');
  };

  const handleContinue = () => {
    // The MATCH READY splash already served as the "you're matched"
    // celebration, so flag the dashboard walkthrough to skip its
    // redundant first "You're Matched!" step and open straight on the
    // "How it works" step. One-shot — consumed by the dashboard effect.
    // RUSH routes to /battle/rush/[id] and never hits the walkthrough,
    // so only set it for the original/tournament (dashboard) path.
    if (typeof window !== 'undefined' && matchedMatchup?.durationType !== 'rush') {
      try { window.sessionStorage.setItem('piks_battle_intro_seen', '1'); } catch (_) {}
    }
    onClose();
    if (onMatchFound && matchedMatchup) onMatchFound(matchedMatchup, matchedOpponent);
    else navigateToBattleStart(router, matchedMatchup);
  };

  const startSearch = async () => {
    // Hard guard: if the user has Rush selected but no live games are
    // available right now, abort with a visible error instead of letting
    // the queue silently start an Original-mode battle.
    if (gameMode === 'rush' && rushAvailable === false) {
      setError('Rush needs a live game in progress. Pick another mode or try again when one tips off.');
      haptic.warning && haptic.warning();
      return;
    }

    cancelledRef.current = false;
    setStep('searching');
    setSearchTime(0);
    setError('');

    intervalRef.current = setInterval(() => {
      setSearchTime(t => t + 1);
    }, 1000);

    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn, gameMode }),
      });
      if (cancelledRef.current) return;
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Matchmaking failed');
        setStep('config');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const data = await res.json();

      if (data.matched) {
        handleMatchFound(data.opponent, data.matchup);
      } else {
        pollForMatch();
      }
    } catch {
      if (cancelledRef.current) return;
      setError('Failed to start matchmaking');
      setStep('config');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const pollForMatch = () => {
    let attempts = 0;
    const poll = async () => {
      if (cancelledRef.current) return;
      attempts++;
      try {
        const res = await fetch('/api/matchups/current');
        if (cancelledRef.current) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active' || data.status === 'matched') {
          if (data.matchup) {
            handleMatchFound(data.opponent, data.matchup);
            return;
          }
        }
      } catch {}

      if (cancelledRef.current) return;

      // Scan real eligible players for ~16s (8 polls × 2s) before
      // handing off to the bot pool. Combined with the initial 2s
      // wait this keeps total wait under 20s as designed.
      if (attempts < 8) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          if (cancelledRef.current) return;
          const fakeData = fakeRes.ok ? await fakeRes.json() : null;
          handleMatchFound(fakeData?.opponent, fakeData?.matchup);
        } catch {
          if (cancelledRef.current) return;
          setError('Matchmaking timed out. Please try again.');
          setStep('config');
          cleanupAllTimers();
        }
      }
    };
    pollRef.current = setTimeout(poll, 2000);
  };

  const cancelSearch = async () => {
    cancelledRef.current = true;
    cleanupAllTimers();
    try {
      await fetch('/api/battles/matchmaking', { method: 'DELETE' });
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    setStep('config');
    setSearchTime(0);
  };

  if (!isOpen) return null;

  const potSize = buyIn * 2;
  const payout = potSize * 0.9;
  const currentAvatar = avatars.length > 0 ? avatars[currentAvatarIdx % avatars.length] : null;
  const userName = userProfile?.username || session?.user?.name || 'You';
  const userAvatar = userProfile?.avatar || null;
  const selectedMode = GAME_MODE_OPTIONS.find(m => m.id === gameMode);
  const matchedAvatar = matchedOpponent?.avatar || currentAvatar || null;

  const th = {
    overlay: 'bg-black/85',
    cardBg: '#0d0d0d',
    cardBorder: '#1a1a1a',
    headerText: 'text-white',
    subText: 'text-gray-400',
    labelText: 'text-gray-400',
    btnBg: '#111',
    btnBorder: '#1a1a1a',
    btnText: 'text-gray-300',
    modeText: 'text-white',
    modeDesc: 'text-gray-500',
    modeBtnBg: '#111',
    infoBg: '#111',
    infoBorder: '#1a1a1a',
    infoLabel: 'text-gray-400',
    infoValue: 'text-white',
    avatarBg1: '#0c1a35',
    avatarBg2: '#1a0a00',
    nameText: 'text-white',
    cancelText: 'text-gray-300',
    closeBtn: 'text-gray-400 hover:text-white',
    fallbackText: 'text-white/60',
  };

  // Portal the entire modal to <body> so its `fixed inset-0` overlay
  // always covers the viewport. Without this, callers that mount the
  // modal inside a CSS-transformed/filtered/contained ancestor (e.g.
  // YouVsCard inside the dashboard's LiveBattlesSection) would have
  // the overlay clipped to that ancestor's containing block, making
  // the popup appear to "fill the card" instead of opening as a real
  // modal. Every other battle modal (BattleModeChooser,
  // PlayFriendModal, PrivateMatchModal, PreMatchPopup) already does
  // this — bringing QuickMatchModal in line.
  if (typeof window === 'undefined' || !document?.body) {
    return null;
  }

  const modalContent = (
    <>
      {/* Ensure the shared cartoon-chip keyframes are present even when
          the modal opens from a page that doesn't render
          LiveBattlesSection. Safe to render alongside the LiveBattles
          copy — duplicate @keyframes are idempotent. */}
      <CartoonChipStyles />
      <style>{`
        @keyframes qm-pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.15; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes qm-avatar-flip-in {
          0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes qm-avatar-flip-out {
          0% { transform: rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: rotateY(-90deg) scale(0.8); opacity: 0; }
        }
        @keyframes qm-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes qm-bolt-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes qm-sparkle-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes qm-ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes qm-matched-slam {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes qm-green-flash {
          0% { opacity: 0; }
          25% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes qm-avatar-lock {
          0% { transform: scale(1.2); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px 8px rgba(16, 185, 129, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 15px 4px rgba(16, 185, 129, 0.2); }
        }
        @keyframes qm-found-ring-expand {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes qm-tip-fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes qm-user-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.4); }
          50% { box-shadow: 0 0 30px rgba(59,130,246,0.6); }
        }
        @keyframes qm-opp-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(251,146,60,0.4); }
          50% { box-shadow: 0 0 30px rgba(251,146,60,0.6); }
        }
        @keyframes qm-timer-tick {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes qm-name-slide {
          0% { transform: translateX(15px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes qm-topo-shift {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        /* Gamified amplifiers (cartoon dial-up) */
        @keyframes qm-streak {
          0%   { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
          20%  { opacity: 0.85; }
          80%  { opacity: 0.85; }
          100% { transform: translateX(120%) skewX(-20deg); opacity: 0; }
        }
        @keyframes qm-spark-twinkle {
          0%, 100% { transform: scale(0.4) rotate(0deg); opacity: 0; }
          50%      { transform: scale(1) rotate(180deg);  opacity: 1; }
        }
        @keyframes qm-orbit {
          from { transform: rotate(0deg) translateX(48px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(48px) rotate(-360deg); }
        }
        @keyframes qm-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes qm-banner-bounce {
          0%   { transform: translateY(-30px) scale(0.6) rotate(-4deg); opacity: 0; }
          55%  { transform: translateY(8px)   scale(1.08) rotate(2deg);  opacity: 1; }
          75%  { transform: translateY(-4px)  scale(0.96) rotate(-1deg); }
          100% { transform: translateY(0)     scale(1)    rotate(0deg);  opacity: 1; }
        }
        @keyframes qm-found-flash {
          0%   { opacity: 0; }
          20%  { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes qm-shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-3px, 1px); }
          20% { transform: translate(3px, -1px); }
          30% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          50% { transform: translate(-2px, 1px); }
          60% { transform: translate(2px, 1px); }
          70% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
          90% { transform: translate(-1px, 0); }
        }
        @keyframes qm-slam-from-left {
          0%   { transform: translateX(-260px) rotate(-18deg) scale(0.6); opacity: 0; }
          70%  { transform: translateX(14px)   rotate(6deg)   scale(1.08); opacity: 1; }
          100% { transform: translateX(0)      rotate(0deg)   scale(1);   opacity: 1; }
        }
        @keyframes qm-slam-from-right {
          0%   { transform: translateX(260px) rotate(18deg)  scale(0.6); opacity: 0; }
          70%  { transform: translateX(-14px) rotate(-6deg)  scale(1.08); opacity: 1; }
          100% { transform: translateX(0)     rotate(0deg)   scale(1);   opacity: 1; }
        }
        @keyframes qm-impact-burst {
          0%   { transform: scale(0); opacity: 0; }
          25%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes qm-impact-line {
          0%   { transform: scaleX(0); opacity: 0; }
          30%  { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1.3); opacity: 0; }
        }
        @keyframes qm-vs-explode {
          0%   { transform: scale(0.2) rotate(-30deg); opacity: 0; }
          55%  { transform: scale(1.6) rotate(8deg);   opacity: 1; }
          75%  { transform: scale(0.92) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes qm-confetti-fall {
          0%   { transform: translate3d(0, -40px, 0) rotate(0deg);    opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--qm-x, 0px), 320px, 0) rotate(720deg); opacity: 0; }
        }
        @keyframes qm-cta-throb {
          0%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 4px 0 #0a0a0a, 0 0 20px rgba(59,130,246,0.45);
          }
          50% {
            transform: translateY(-2px) scale(1.025);
            box-shadow: 0 6px 0 #0a0a0a, 0 0 36px rgba(59,130,246,0.85);
          }
        }
        @keyframes qm-pot-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qm-amp, .qm-amp * { animation: none !important; }
        }
      `}</style>
      <div data-allow-fixed-overlay="true" className={`fixed inset-0 ${th.overlay} backdrop-blur-sm z-50 overflow-y-auto`} onClick={() => {
        // 'found' is a hard pause — clicks outside don't dismiss it.
        // The new rush sub-steps are also non-dismissable on backdrop
        // click since the user is already in an active matchup; the
        // explicit close button (which routes to /battle/rush/[id])
        // remains the only way out.
        if (step === 'found' || isInRushFlow) return;
        if (step === 'searching') { cancelSearch(); }
        onClose();
      }}>
        {/* Inner wrapper handles centering. We use min-h-full + flex so that
            when the modal is shorter than the viewport it stays vertically
            centered, but when the modal is TALLER than the viewport (very
            common on iPhone with the iOS browser chrome eating ~150px of
            vertical space) the wrapper grows with the content and the
            outer overlay scrolls naturally. Without this split the classic
            `items-center` flexbox bug clips the top of the modal and makes
            the header unreachable on small viewports. */}
        <div className="min-h-full flex items-center justify-center p-4">
        <div
          className={`qm-frame w-full overflow-hidden relative max-w-md`}
          style={{
            background: 'linear-gradient(180deg, #0b1830 0%, #061022 55%, #03070f 100%)',
            border: '2.5px solid #0a0a0a',
            borderRadius: 22,
            boxShadow:
              '0 4px 0 #0a0a0a, 0 10px 60px rgba(0,0,0,0.7), 0 0 90px rgba(6,182,212,0.25), inset 0 0 0 1.5px rgba(6,182,212,0.55), inset 0 0 30px rgba(6,182,212,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Cyan corner brackets — give the modal a "gaming HUD" frame. */}
          {['tl','tr','bl','br'].map(pos => {
            const base = { position: 'absolute', width: 22, height: 22, pointerEvents: 'none', zIndex: 3 };
            const stroke = '2.5px solid #06b6d4';
            const glow = { filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' };
            const map = {
              tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke, borderTopLeftRadius: 8 },
              tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke, borderTopRightRadius: 8 },
              bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke, borderBottomLeftRadius: 8 },
              br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke, borderBottomRightRadius: 8 },
            };
            return <span key={pos} aria-hidden="true" style={{ ...base, ...map[pos], ...glow }} />;
          })}
          {step === 'config' && (
            <>
              {/* Header — mirrors PlayFriendModal exactly so the two
                  popups read as one design system. The only thing
                  that changes between them is the title copy and the
                  "challenging" card below. */}
              <div className="px-5 pt-7 pb-0 flex-shrink-0 relative">
                {/* Floating close button — sits in the top-right HUD
                    corner instead of competing with the centered title. */}
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center absolute"
                  style={{ top: 18, right: 18, backgroundColor: '#0a0f1c', border: '2px solid #06b6d4', boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(6,182,212,0.6)', zIndex: 5 }}
                >
                  <svg className="w-4 h-4" style={{ color: '#7dd3fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button
                  aria-label="Back"
                  onClick={onBack || onClose}
                  className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center absolute"
                  style={{ top: 18, left: 18, backgroundColor: '#0a0f1c', border: '2px solid #06b6d4', boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(6,182,212,0.6)', zIndex: 5 }}
                >
                  <svg className="w-4 h-4" style={{ color: '#7dd3fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {/* Centered hero title — full-width "QUICK MATCH" with
                    decorative lightning bolts flanking it on both sides.
                    Padded horizontally so the title never slides under
                    the back / close HUD buttons. */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 mt-1 px-12 sm:px-14">
                  <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                  <h2
                    id="qm-title"
                    className="font-black uppercase text-center"
                    style={{
                      fontSize: 'clamp(28px, 8vw, 44px)',
                      lineHeight: 0.92,
                      letterSpacing: '0.01em',
                      fontStyle: 'italic',
                      WebkitTextStroke: '1.5px #0a0a0a',
                      textShadow: '0 3px 0 #0a0a0a, 0 0 38px rgba(6,182,212,0.75), 0 0 18px rgba(255,255,255,0.45)',
                      background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    Quick Match
                  </h2>
                  <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1, color: '#facc15', filter: 'drop-shadow(0 2px 0 #0a0a0a)' }}>⚡</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                  <p
                    className="font-black uppercase whitespace-nowrap text-center"
                    style={{
                      color: '#7dd3fc',
                      fontSize: '11px',
                      letterSpacing: '0.22em',
                      textShadow: '0 0 10px rgba(6,182,212,0.7)',
                      margin: 0,
                    }}
                  >
                    Instant Matchmaking · Real Competition
                  </p>
                  <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(270deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
                </div>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {error && (
                  <div
                    className="rounded-2xl px-3 py-2.5 text-xs leading-snug"
                    style={{
                      background: 'linear-gradient(180deg, rgba(248,113,113,0.16), rgba(248,113,113,0.06))',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 4px 0 #0a0a0a',
                      color: '#fecaca',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* "Random opponent" card — visual analogue of the
                    "CHALLENGING {friend}" card in PlayFriendModal so
                    the layout is identical, but the eyebrow + label
                    explain that matchmaking will pick a stranger
                    instead of expecting the user to pick someone. */}
                {/* Opponent "Random Match — we'll find you someone of
                    similar skill" row removed — read as a technical
                    matchmaker disclaimer instead of a gamified prompt.
                    The mode tiles + Find Opponent CTA below already
                    communicate "tap to draw a stranger". */}

                {/* Buy-in tiles — hidden during beta (ranking-only, no $). */}
                {isBeta ? (
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 18px rgba(16,185,129,0.35)',
                      }}
                    >
                      <span className="text-sm leading-none" aria-hidden="true">🛡️</span>
                      <span
                        className="font-black uppercase"
                        style={{ color: '#34d399', fontSize: 10, letterSpacing: '0.22em' }}
                      >
                        Beta · Ranking Enabled
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: '#94a3b8', lineHeight: 1.4 }}>
                      Climb the leaderboard. Prove you're the best.
                    </p>
                  </div>
                ) : (
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider mb-2 block" style={{ color: '#6b7280' }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => {
                      const selected = buyIn === amount;
                      return (
                        <button
                          key={amount}
                          onClick={() => setBuyIn(amount)}
                          className="msg-cartoon-btn py-2 rounded-xl text-sm font-extrabold"
                          style={
                            selected
                              ? {
                                  background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                  color: '#fff',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.45)',
                                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                }
                              : {
                                  backgroundColor: '#111',
                                  color: '#9ca3af',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 3px 0 #0a0a0a',
                                }
                          }
                        >
                          ${amount}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Game-mode rich tiles — the high-information layout
                    the user explicitly called out as the better one.
                    Identical to PlayFriendModal so both modals share
                    one mental model. */}
                <div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.45))' }} />
                    <span
                      className="font-black uppercase whitespace-nowrap"
                      style={{
                        color: '#bfdbfe',
                        fontSize: 10,
                        letterSpacing: '0.28em',
                        textShadow: '0 0 10px rgba(59,130,246,0.4)',
                      }}
                    >
                      ◆ Choose Your Game Mode ◆
                    </span>
                    <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(96,165,250,0.45))' }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const betaLocked = isBeta && mode.id !== 'original';
                      const locked = betaLocked || (mode.id === 'rush' && rushAvailable === false);
                      const isRush = mode.id === 'rush';
                      const rushLive = !betaLocked && isRush && rushAvailable === true;
                      const hex = (mode.color || '#3b82f6').replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16);
                      const g = parseInt(hex.substring(2, 4), 16);
                      const b = parseInt(hex.substring(4, 6), 16);
                      const glow = `rgba(${r},${g},${b},0.45)`;
                      const tint = `rgba(${r},${g},${b},0.18)`;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => { if (!locked) setGameMode(mode.id); }}
                          aria-disabled={locked || undefined}
                          aria-pressed={selected}
                          title={betaLocked ? 'Available after the public beta — Original is the only mode during beta.' : (locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined)}
                          className={`msg-cartoon-btn flex flex-col items-center text-center px-1.5 pt-6 rounded-2xl relative overflow-hidden ${betaLocked ? 'pb-7' : 'pb-2.5'}`}
                          style={
                            betaLocked
                              ? {
                                  background: `linear-gradient(180deg, ${tint} 0%, rgba(${r},${g},${b},0.06) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${glow}`,
                                  cursor: 'not-allowed',
                                  minHeight: 132,
                                }
                              : selected
                              ? {
                                  background: `linear-gradient(180deg, rgba(${r},${g},${b},0.32) 0%, rgba(${r},${g},${b},0.08) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 26px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.06)`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                              : {
                                  background: `linear-gradient(180deg, ${tint} 0%, rgba(${r},${g},${b},0.05) 100%), #0a0a0a`,
                                  border: `2.5px solid ${mode.color}`,
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${glow}`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                          }
                        >
                          {betaLocked && (
                            <>
                              {/* Dark veil + heavy desaturation so the
                                  tile reads as inactive at a glance,
                                  without losing its mode-color identity
                                  completely. */}
                              <span
                                aria-hidden="true"
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background:
                                    'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)',
                                  backdropFilter: 'grayscale(0.5)',
                                  WebkitBackdropFilter: 'grayscale(0.5)',
                                  borderRadius: 'inherit',
                                  zIndex: 1,
                                }}
                              />
                              {/* Full-width yellow "🔒 COMING SOON" footer
                                  bar — unmistakable inactivity signal
                                  spanning the entire bottom edge of the
                                  tile, with reserved tile padding so
                                  the icon/label/coins still sit above
                                  the bar instead of overlapping it. */}
                              <span
                                aria-hidden="true"
                                className="absolute left-0 right-0 bottom-0 inline-flex items-center justify-center gap-1 pointer-events-none font-black uppercase select-none"
                                style={{
                                  fontSize: 9,
                                  letterSpacing: '0.18em',
                                  color: '#0a0a0a',
                                  background: 'linear-gradient(180deg,#fde047,#facc15)',
                                  borderTop: '2px solid #0a0a0a',
                                  padding: '4px 4px 5px',
                                  lineHeight: 1,
                                  zIndex: 4,
                                  whiteSpace: 'nowrap',
                                  textShadow: 'none',
                                }}
                              >
                                <span style={{ fontSize: 10 }}>🔒</span>
                                Coming Soon
                              </span>
                            </>
                          )}
                          {mode.recommended && (
                            // Sit the Popular badge *inside* the tile
                            // (top: 6) rather than overflowing above
                            // it. The parent button uses
                            // overflow-hidden to clip the betaLocked
                            // dark veil to the rounded corners, which
                            // was also clipping a `-top-2` badge and
                            // cutting it off at the modal's top edge.
                            <span
                              className="absolute left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                            >
                              Popular
                            </span>
                          )}
                          {rushLive && (
                            <span
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                              aria-hidden="true"
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  backgroundColor: '#fff',
                                  boxShadow: '0 0 6px rgba(255,255,255,0.95)',
                                }}
                              />
                              Live
                            </span>
                          )}
                          {/* Non-beta lock pill (e.g. Rush has no live
                              game). The beta-locked case now uses the
                              full-tile blackout + COMING SOON watermark
                              instead of a top pill that overlapped the
                              "Popular" badge on the neighboring tile. */}
                          {locked && !betaLocked && (
                            <span
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                                zIndex: 2,
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          {/* Internal radial color glow — gives each tile
                              the "trading card" look from the mockup. */}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(ellipse at 50% 38%, ${glow} 0%, transparent 60%)`,
                              borderRadius: 'inherit',
                              opacity: betaLocked ? 0.55 : 0.9,
                            }}
                          />
                          {/* Mode-specific themed backdrop. Each tile gets
                              its own decorative pattern so RUSH feels like
                              electric speed, ORIGINAL like a balanced
                              trophy stage, and TOURNAMENT like a royal
                              crown arena. */}
                          {mode.id === 'rush' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.9 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'repeating-linear-gradient(115deg, rgba(16,185,129,0.18) 0 6px, transparent 6px 16px)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 8, left: 6, fontSize: 16, opacity: 0.55, color: '#fde047', filter: 'drop-shadow(0 1px 0 #0a0a0a)' }}>⚡</span>
                              <span style={{ position: 'absolute', bottom: 30, right: 6, fontSize: 14, opacity: 0.5, color: '#fde047', filter: 'drop-shadow(0 1px 0 #0a0a0a)', transform: 'rotate(18deg)' }}>⚡</span>
                            </span>
                          )}
                          {mode.id === 'original' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.85 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.22) 0%, transparent 55%)',
                                }}
                              />
                              <span
                                className="absolute"
                                style={{
                                  top: 14, left: '50%', transform: 'translateX(-50%)',
                                  width: 56, height: 26, borderRadius: '50%',
                                  background: 'radial-gradient(ellipse, rgba(250,204,21,0.45), transparent 70%)',
                                  filter: 'blur(2px)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 10, left: 8, fontSize: 9, color: '#facc15', opacity: 0.7 }}>★</span>
                              <span style={{ position: 'absolute', top: 10, right: 8, fontSize: 9, color: '#facc15', opacity: 0.7 }}>★</span>
                            </span>
                          )}
                          {mode.id === 'tournament' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 pointer-events-none overflow-hidden"
                              style={{ borderRadius: 'inherit', opacity: betaLocked ? 0.3 : 0.9 }}
                            >
                              <span
                                className="absolute inset-0"
                                style={{
                                  background:
                                    'repeating-linear-gradient(180deg, rgba(249,115,22,0.14) 0 3px, transparent 3px 9px)',
                                }}
                              />
                              <span
                                className="absolute"
                                style={{
                                  inset: 0,
                                  background:
                                    'radial-gradient(circle at 50% 28%, rgba(250,204,21,0.35) 0%, transparent 45%)',
                                }}
                              />
                              <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 9, color: '#fde047', opacity: 0.8 }}>♦</span>
                              <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, color: '#fde047', opacity: 0.8 }}>♦</span>
                              <span style={{ position: 'absolute', bottom: 28, left: 8, fontSize: 9, color: '#fb923c', opacity: 0.7 }}>♛</span>
                              <span style={{ position: 'absolute', bottom: 28, right: 8, fontSize: 9, color: '#fb923c', opacity: 0.7 }}>♛</span>
                            </span>
                          )}
                          <span
                            className="leading-none mb-2 relative"
                            style={{
                              fontSize: 38,
                              filter: `drop-shadow(0 0 14px ${glow}) drop-shadow(0 2px 0 #000)`,
                              animation: mode.id === 'rush'
                                ? 'qm-bolt-flicker 1.4s ease-in-out infinite'
                                : mode.id === 'tournament'
                                ? 'qm-banner-bounce 0.9s cubic-bezier(0.34,1.56,0.64,1)'
                                : undefined,
                            }}
                          >
                            {mode.icon}
                          </span>
                          <span className="font-black text-[13px] leading-tight uppercase tracking-wider relative" style={{ color: '#fff', textShadow: '0 1px 0 #000' }}>{mode.label}</span>
                          {mode.tagline && (
                            <span
                              className="text-[8px] font-extrabold uppercase mt-1 leading-none relative"
                              style={{ color: '#e2e8f0', letterSpacing: '0.16em', opacity: 0.9 }}
                            >
                              {mode.tagline}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 mt-2 relative">
                            <span className="font-black text-[15px] leading-none" style={{ color: '#fff', textShadow: '0 1px 0 #000' }}>{mode.coins.toLocaleString()}</span>
                            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1, filter: 'drop-shadow(0 0 6px #fbbf24)' }}>🪙</span>
                          </span>
                          <span className="text-[8px] uppercase tracking-[0.18em] mt-0.5 leading-none font-bold relative" style={{ color: '#94a3b8' }}>coins</span>
                          {selected && !betaLocked && (
                            <span
                              aria-hidden="true"
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center justify-center rounded-full"
                              style={{
                                bottom: -10,
                                width: 22,
                                height: 22,
                                background: 'linear-gradient(180deg,#06b6d4,#0891b2)',
                                border: '2.5px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a, 0 0 14px rgba(6,182,212,0.9)',
                                zIndex: 3,
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {rushAvailable === false && (
                    <div
                      className="mt-2 rounded-2xl px-3 py-2.5 text-[11px] leading-snug flex items-start gap-2"
                      style={{
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                        color: '#fde68a',
                      }}
                      aria-live="polite"
                    >
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">⚡</span>
                      <div>
                        <div
                          className="font-extrabold uppercase mb-0.5"
                          style={{ color: '#ffffff', fontSize: '9px', letterSpacing: '0.18em' }}
                        >
                          Rush locked
                        </div>
                        Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                      </div>
                    </div>
                  )}
                  {selectedMode && (
                    <p
                      aria-live="polite"
                      className="mt-3 text-center text-[10.5px] leading-snug"
                      style={{ color: '#94a3b8', letterSpacing: '0.04em' }}
                    >
                      <span className="font-black uppercase" style={{ color: selectedMode.color, letterSpacing: '0.16em', textShadow: `0 0 8px ${selectedMode.color}66` }}>
                        {selectedMode.label}
                      </span>
                      <span className="mx-1.5 text-gray-600">·</span>
                      <span style={{ color: '#cbd5e1' }}>{selectedMode.description}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={startSearch}
                  className="msg-cartoon-btn w-full text-white font-black uppercase rounded-2xl flex flex-col items-stretch justify-center relative overflow-hidden p-0"
                  style={{
                    background: 'linear-gradient(180deg,#3b82f6 0%,#1d4ed8 100%)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 5px 0 #0a0a0a, 0 0 32px rgba(6,182,212,0.55), inset 0 0 0 1.5px rgba(6,182,212,0.55)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  }}
                >
                  <span className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5">
                    <span
                      aria-hidden="true"
                      className="qm-cta-chev inline-flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: 'linear-gradient(180deg,#0e1b3a,#050a18)',
                        border: '2px solid #06b6d4',
                        boxShadow: '0 0 12px rgba(6,182,212,0.7), inset 0 0 6px rgba(6,182,212,0.3)',
                        color: '#7dd3fc',
                        fontSize: 15,
                      }}
                    >»</span>
                    <span style={{ fontSize: 19, letterSpacing: '0.06em' }}>Find Opponent</span>
                    <span
                      aria-hidden="true"
                      className="qm-cta-chev inline-flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 30,
                        height: 30,
                        background: 'linear-gradient(180deg,#0e1b3a,#050a18)',
                        border: '2px solid #06b6d4',
                        boxShadow: '0 0 12px rgba(6,182,212,0.7), inset 0 0 6px rgba(6,182,212,0.3)',
                        color: '#7dd3fc',
                        fontSize: 15,
                      }}
                    >«</span>
                  </span>
                  <span
                    className="block text-center"
                    style={{
                      background: 'linear-gradient(180deg,#050a18,#020611)',
                      borderTop: '1.5px solid rgba(6,182,212,0.35)',
                      padding: '6px 0 7px',
                      fontSize: 10,
                      letterSpacing: '0.32em',
                      color: '#7dd3fc',
                      textShadow: '0 0 8px rgba(6,182,212,0.6)',
                    }}
                  >
                    Play Now · Win Big
                  </span>
                </button>
                <style jsx>{`
                  @keyframes qmCtaChev {
                    0%, 100% { transform: translateX(0); opacity: 0.9; }
                    50% { transform: translateX(3px); opacity: 1; }
                  }
                  .qm-cta-chev:first-child { animation: qmCtaChev 1.2s ease-in-out infinite; }
                  .qm-cta-chev:last-child { animation: qmCtaChev 1.2s ease-in-out infinite reverse; }
                `}</style>
              </div>
            </>
          )}

          {step === 'searching' && (
            <FindingOpponent
              you={{ id: userProfile?.id, name: userName, avatar: userAvatar, battleWins: userProfile?.battleWins }}
              balance={isBeta ? (Number(buyIn) || 10000) : (Number(buyIn) || 0)}
              onCancel={cancelSearch}
            />
          )}

          {step === 'found' && (
            <MatchFoundContent
              isBeta={isBeta}
              buyIn={buyIn}
              potSize={potSize}
              payout={payout}
              gameMode={gameMode}
              selectedMode={selectedMode}
              userName={userName}
              userAvatar={userAvatar}
              userProfile={userProfile}
              matchedOpponent={matchedOpponent}
              matchedAvatar={matchedAvatar}
              th={th}
              onContinue={handleContinue}
              onCancel={handleClose}
            />
          )}

          {step === 'rush-active' && rushApi?.rush && rushApi?.matchup && (
            <div className="w-full px-3 py-4 flex justify-center">
              <RushFlow
                rush={rushApi.rush}
                matchup={rushApi.matchup}
                userId={session?.user?.id}
                busy={rushBusy}
                onAccept={submitRushAccept}
                onDecline={handleClose}
                onPick={submitRushPick}
                onContinue={submitRushContinue}
                onViewResults={() => {}}
                rematchWaiting={rushRematchWaiting}
                onRematch={(stake) => startRushRematch(stake)}
                onNewOpponent={() => startRushNewOpponent(parseFloat(rushApi?.matchup?.startingBalance) || 10000)}
                onHome={() => { onClose(); router.push('/battle'); }}
                onExit={() => { onClose(); router.push('/battle'); }}
                onBack={handleClose}
              />
            </div>
          )}

          {step === 'rush-active' && !(rushApi?.rush && rushApi?.matchup) && (
            <div className="w-full px-6 py-16 text-center text-gray-500 text-sm">Loading match…</div>
          )}
        </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
