import { useState, useEffect, useRef, useMemo } from 'react';
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
    description: 'Pick 6 props from a live game',
    coins: 10000,
    durationMinutes: 180,
    durationType: 'rush',
    color: '#f59e0b',
  },
  {
    id: 'original',
    label: 'ORIGINAL',
    icon: '🏆',
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
    description: '3-day battle with a massive bankroll',
    coins: 100000,
    durationMinutes: 4320,
    durationType: 'tournament',
    color: '#10b981',
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

export default function QuickMatchModal({ isOpen, onClose, onBack, userId, onMatchFound, presetMatch = null }) {
  useModalScrollLock(isOpen);
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
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

  // Auto-advance from "MATCH FOUND" to the live-game vote slide for Rush.
  // Other modes (original / tournament) still show the Continue button.
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'found') return;
    if (gameMode !== 'rush') return;
    if (!matchedMatchup?.id) return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      setStep('rush-vote');
    }, RUSH_FOUND_TO_VOTE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isOpen, step, gameMode, matchedMatchup?.id]);

  // Poll + SSE the rush state for the matched matchup whenever we're in
  // any rush sub-step. Polling at 750ms keeps the deadline countdown
  // smooth; SSE delivers near-instant updates for the voting→playing
  // flip and the opponent's vote landing.
  useEffect(() => {
    if (!isOpen) return;
    const inRushFlow =
      step === 'rush-vote' ||
      step === 'rush-ready' ||
      step === 'rush-countdown' ||
      step === 'rush-playing' ||
      step === 'rush-completed';
    if (!inRushFlow) return;
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;

    let cancelled = false;
    const fetchRush = async () => {
      try {
        const res = await fetch(`/api/battles/rush/${matchupId}/state`);
        if (cancelled || !res.ok) return;
        const j = await res.json();
        if (!cancelled) setRushState(j.rush || null);
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

  // Tick once a second on the vote slide so the deadline ring stays in
  // sync without us having to lean on the polling response time.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    const t = setInterval(() => setVoteDeadlineTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  // Load the live-game list from the dedicated endpoint while voting.
  // We merge this with the dashboard's GamesContext stream below so
  // demo / simulated live games still show up here.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    let cancelled = false;
    fetch('/api/goalserve/live')
      .then(r => r.json())
      .then(j => { if (!cancelled) setServerLiveGames(j?.games || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step]);

  // Detect server-side voting resolution → advance to ready slide.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    if (
      rushState?.phase === 'ready_check' ||
      rushState?.phase === 'playing' ||
      rushState?.phase === 'completed'
    ) {
      setStep('rush-ready');
    }
  }, [step, rushState?.phase]);

  // Deadlock guard: if the vote deadline has passed and neither player
  // ever voted, the server-side resolveVotingIfReady() leaves phase as
  // 'voting' indefinitely (chosen vote is null, no question generation
  // possible). Without this guard the modal would spin forever waiting
  // for a phase flip that never comes. After a 4s grace past deadline
  // we hand off to the routed rush page where the full forfeit /
  // refund UX lives.
  useEffect(() => {
    if (step !== 'rush-vote') return;
    if (!rushState || rushState.phase !== 'voting') return;
    const deadline = rushState.voteDeadline ? new Date(rushState.voteDeadline).getTime() : null;
    if (!deadline) return;
    const matchupId = matchedMatchup?.id;
    if (!matchupId) return;
    const myVote = userId ? rushState.gameVotes?.[userId] : null;
    const opponentId = matchedOpponent?.id;
    const oppVote = opponentId ? rushState.gameVotes?.[opponentId] : null;
    // Only kick in when nobody voted — single-vote expiry is handled
    // server-side and will flip to 'playing' on the next state read.
    if (myVote || oppVote) return;
    const overdueBy = Date.now() - deadline;
    if (overdueBy <= 4000) return;
    onClose();
    router.push(`/battle/rush/${matchupId}`);
  }, [step, rushState, matchedMatchup?.id, matchedOpponent?.id, userId, voteDeadlineTick, onClose, router]);

  // Ready slide → 3-2-1 countdown. Both players have to tap "Ready"
  // (the bot is auto-readied server-side after 3s); the moment the
  // server flips phase to 'playing' we kick the countdown.
  useEffect(() => {
    if (step !== 'rush-ready') return;
    if (rushState?.phase === 'playing' || rushState?.phase === 'completed') {
      setCountdownNum(3);
      setStep('rush-countdown');
    }
  }, [step, rushState?.phase]);

  // 3-2-1-GO countdown ticker. After the GO! flash we transition to
  // the in-popup gameplay step (the routed /battle/rush/[id] page is
  // still available as a fallback for refresh / deep-link).
  useEffect(() => {
    if (step !== 'rush-countdown') return;
    if (countdownNum > 0) {
      const t = setTimeout(() => {
        if (cancelledRef.current) return;
        setCountdownNum(n => n - 1);
        haptic.tap?.();
      }, RUSH_COUNTDOWN_TICK_MS);
      return () => clearTimeout(t);
    }
    // countdownNum === 0 → show "GO!" briefly, then advance to the
    // in-popup playing slide.
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      const matchupId = matchedMatchup?.id;
      if (!matchupId) return;
      setStep('rush-playing');
    }, RUSH_GO_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countdownNum, matchedMatchup?.id]);

  // Reset the locally-picked answer whenever the question rolls over so
  // the "your pick" highlight doesn't bleed across questions.
  useEffect(() => {
    if (step !== 'rush-playing') return;
    const currQ = rushState?.questions?.[rushState?.currentQuestionIndex];
    if (currQ && currQ.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = currQ.id;
      setPickedAnswer(null);
    }
  }, [step, rushState?.questions, rushState?.currentQuestionIndex]);

  // Detect server-side completion → flip to result slide. We pick this
  // up from rushState.phase rather than waiting on the answer POST so
  // a deadline expiry on the final question still triggers the result.
  useEffect(() => {
    if (step !== 'rush-playing') return;
    if (rushState?.phase === 'completed') {
      setStep('rush-completed');
    }
  }, [step, rushState?.phase]);

  // Result slide auto-exits to /battle after a beat so the user lands
  // back where the result-popup SSE plumbing can take over.
  useEffect(() => {
    if (step !== 'rush-completed') return;
    const t = setTimeout(() => {
      if (cancelledRef.current) return;
      onClose();
      router.push('/battle');
    }, RUSH_RESULT_AUTO_EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
    serverLiveGames.forEach(push);
    if (Array.isArray(apiGames)) {
      apiGames.forEach((g) => { if (g && g.isLive) push(g); });
    }
    return out.slice(0, RUSH_VOTE_GAME_LIMIT);
  }, [serverLiveGames, apiGames]);

  const submitRushVote = async (game) => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || pendingVoteId) return;
    setPendingVoteId(String(game.id));
    setRushVoteError('');
    haptic.tap?.();
    try {
      const snapshot = {
        id: game.id,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        home_team: game.home_team,
        away_team: game.away_team,
        scores: game.scores,
        status: game.status,
        isLive: game.isLive,
      };
      const res = await fetch(`/api/battles/rush/${matchupId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: String(game.id), gameSnapshot: snapshot }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setRushVoteError(j.error || 'Failed to vote');
      } else {
        // Refetch immediately so the local state shows our vote without
        // waiting for the next 750ms poll tick.
        try {
          const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
          setRushState(j.rush || null);
        } catch {}
      }
    } catch (err) {
      setRushVoteError(err?.message || 'Network error');
    } finally {
      setPendingVoteId(null);
    }
  };

  const submitRushReady = async () => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || pendingReady) return;
    setPendingReady(true);
    setReadyError('');
    haptic.tap?.();
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // 409 = phase already past ready_check; harmless.
        if (res.status !== 409) setReadyError(j.error || 'Failed to ready up');
      }
      // Refetch immediately so the local state reflects our ready
      // without waiting for the next 750ms poll tick.
      try {
        const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
        setRushState(j.rush || null);
      } catch {}
    } catch (err) {
      setReadyError(err?.message || 'Network error');
    } finally {
      setPendingReady(false);
    }
  };

  const submitRushAnswer = async (questionId, answerKey) => {
    const matchupId = matchedMatchup?.id;
    if (!matchupId || submittingAnswer) return;
    setSubmittingAnswer(true);
    setPickedAnswer({ questionId, answerKey });
    haptic.tap?.();
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answerKey }),
      });
      if (!res.ok && res.status !== 409) {
        // 409 just means the server already advanced — not an error.
        // No-op; the next poll will resync.
      }
      try {
        const j = await fetch(`/api/battles/rush/${matchupId}/state`).then(r => r.json());
        setRushState(j.rush || null);
      } catch {}
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const isInRushFlow =
    step === 'rush-vote' ||
    step === 'rush-ready' ||
    step === 'rush-countdown' ||
    step === 'rush-playing' ||
    step === 'rush-completed';

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

  return (
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
          className="rounded-2xl max-w-md w-full overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 10px 40px rgba(0,0,0,0.6), 0 0 60px rgba(59,130,246,0.18)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {step === 'config' && (
            <>
              {/* Header — mirrors PlayFriendModal exactly so the two
                  popups read as one design system. The only thing
                  that changes between them is the title copy and the
                  "challenging" card below. */}
              <div className="px-5 pt-5 pb-0 flex-shrink-0">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {onBack && (
                      <button
                        aria-label="Back"
                        onClick={onBack}
                        className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#111', border: '2.5px solid #0a0a0a', boxShadow: '0 3px 0 #0a0a0a' }}
                      >
                        <svg className="w-4 h-4" style={{ color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    <div className="min-w-0">
                      <h2
                        id="qm-title"
                        className="font-black uppercase"
                        style={{
                          color: '#fff',
                          fontSize: '20px',
                          lineHeight: 1.05,
                          letterSpacing: '0.06em',
                          textShadow: '0 2px 0 #000',
                        }}
                      >
                        Quick Match
                      </h2>
                      <p
                        className="mt-1 font-extrabold uppercase"
                        style={{
                          color: '#60a5fa',
                          fontSize: '10px',
                          letterSpacing: '0.18em',
                        }}
                      >
                        Find a random opponent instantly
                      </p>
                    </div>
                  </div>
                  <button
                    aria-label="Close"
                    onClick={onClose}
                    className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#111', border: '2.5px solid #0a0a0a', boxShadow: '0 3px 0 #0a0a0a' }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
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
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg,rgba(251,146,60,0.14),rgba(251,146,60,0.04))',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(251,146,60,0.18)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'linear-gradient(180deg,#fb923c,#ea580c)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      color: '#fff',
                      fontSize: 18,
                    }}
                    aria-hidden="true"
                  >
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.2em]" style={{ color: '#fb923c' }}>Opponent</div>
                    <div className="text-sm font-extrabold truncate" style={{ color: '#fff' }}>Random Match</div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>We&apos;ll find you someone of similar skill.</div>
                  </div>
                </div>

                {/* Buy-in tiles — identical 5-button grid to PFM. */}
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

                {/* Game-mode rich tiles — the high-information layout
                    the user explicitly called out as the better one.
                    Identical to PlayFriendModal so both modals share
                    one mental model. */}
                <div>
                  <div className="flex items-baseline justify-between mb-2 gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Game Mode</label>
                    <span className="text-[10px]" style={{ color: '#6b7280' }}>Coins = starting bankroll</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const locked = mode.id === 'rush' && rushAvailable === false;
                      const isRush = mode.id === 'rush';
                      const rushLive = isRush && rushAvailable === true;
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
                          title={locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined}
                          className="msg-cartoon-btn flex flex-col items-center text-center px-1.5 py-2.5 rounded-2xl relative"
                          style={
                            selected
                              ? {
                                  background: `linear-gradient(180deg,${tint},#111)`,
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 16px ${glow}`,
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                              : {
                                  backgroundColor: '#111',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 3px 0 #0a0a0a',
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                          }
                        >
                          {mode.recommended && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                            >
                              Popular
                            </span>
                          )}
                          {rushLive && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
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
                          {locked && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          <span className="text-lg leading-none mb-1">{mode.icon}</span>
                          <span className="font-extrabold text-[11px] leading-tight uppercase tracking-wider" style={{ color: '#fff' }}>{mode.label}</span>
                          <span className="text-[8px] uppercase tracking-wider mt-1 leading-none" style={{ color: '#6b7280' }}>Start with</span>
                          <span className="font-extrabold text-[11px] mt-0.5" style={{ color: '#fff' }}>{mode.coins.toLocaleString()}</span>
                          <span className="text-[9px]" style={{ color: '#6b7280' }}>coins</span>
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
                          style={{ color: '#fbbf24', fontSize: '9px', letterSpacing: '0.18em' }}
                        >
                          Rush locked
                        </div>
                        Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                      </div>
                    </div>
                  )}
                  {selectedMode && (
                    <div
                      aria-live="polite"
                      className="mt-2 flex items-start gap-2 rounded-2xl px-3 py-2.5"
                      style={{
                        background: `linear-gradient(180deg, ${selectedMode.color}1f, ${selectedMode.color}0a)`,
                        border: '2.5px solid #0a0a0a',
                        boxShadow: `0 4px 0 #0a0a0a, 0 0 14px ${selectedMode.color}40`,
                      }}
                    >
                      <span className="text-sm leading-none mt-0.5" aria-hidden="true">{selectedMode.icon}</span>
                      <p className="text-[11px] leading-snug" style={{ color: '#9ca3af' }}>
                        <span className="font-extrabold uppercase tracking-wider" style={{ color: '#fff' }}>{selectedMode.label}:</span>{' '}
                        {selectedMode.description}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={startSearch}
                  className="msg-cartoon-btn w-full text-white font-extrabold uppercase tracking-wider py-3.5 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 5px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                    fontSize: 15,
                  }}
                >
                  Find Opponent
                </button>
              </div>
            </>
          )}

          {step === 'searching' && (() => {
            // Mode-themed searching container — every accent color
            // (banner, opponent glow, phase pill, payout card, loading
            // dots, footer timer) is derived from the selected mode so
            // the loader visually matches the mode the user picked.
            const modeColor = selectedMode?.color || '#3b82f6';
            const mHex = modeColor.replace('#', '');
            const mR = parseInt(mHex.substring(0, 2), 16);
            const mG = parseInt(mHex.substring(2, 4), 16);
            const mB = parseInt(mHex.substring(4, 6), 16);
            const modeGlow = `rgba(${mR},${mG},${mB},0.45)`;
            const modeTint = `rgba(${mR},${mG},${mB},0.18)`;
            const modeSoft = `rgba(${mR},${mG},${mB},0.06)`;
            const modeStrong = `rgba(${mR},${mG},${mB},0.65)`;

            // Phase derived from elapsed seconds so the user always
            // sees forward motion: scanning real players → expanding
            // the net → bringing in a challenger from the bot pool.
            // Aligns with the polling logic above (~16s real scan,
            // then bot fallback).
            let phase;
            if (searchTime < 8) {
              phase = { label: 'Scanning live players', dotColor: '#10b981' };
            } else if (searchTime < 15) {
              phase = { label: 'Expanding the net', dotColor: '#22d3ee' };
            } else {
              phase = { label: 'Bringing in a challenger', dotColor: '#fbbf24' };
            }

            return (
            <div className="relative overflow-hidden" style={{
              background: `radial-gradient(ellipse at top, ${modeSoft} 0%, transparent 60%)`,
            }}>
              {/* Cartoon mode banner — anchors the loader to the mode
                  and surfaces buy-in + max payout up top so there's
                  no negative space at the start of the popup. */}
              <div className="px-4 pt-4 pb-3">
                <div
                  className="rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
                  style={{
                    background: `linear-gradient(180deg, ${modeTint}, ${modeSoft})`,
                    border: '2.5px solid #0a0a0a',
                    boxShadow: `0 4px 0 #0a0a0a, 0 0 18px ${modeStrong}`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                      style={{
                        background: `linear-gradient(180deg, ${modeColor}, ${modeColor}cc)`,
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                      }}
                      aria-hidden="true"
                    >
                      {selectedMode?.icon}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-[9px] font-extrabold uppercase tracking-[0.2em] truncate"
                        style={{ color: modeColor }}
                      >
                        {selectedMode?.label} Match
                      </div>
                      <div className="text-white text-[11px] font-extrabold truncate">
                        ${buyIn} Buy-In · ${potSize} Pot
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex flex-col items-end px-2.5 py-1 rounded-xl flex-shrink-0"
                    style={{
                      background: '#0a0a0a',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    <span className="text-[8px] font-extrabold uppercase tracking-[0.18em]" style={{ color: '#9ca3af' }}>Win Up To</span>
                    <span className="text-white text-sm font-black leading-none">${payout}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 md:gap-8 relative px-4" style={{ minHeight: '220px' }}>
                <div className="flex flex-col items-center justify-center">
                  <div className="relative mb-2">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                      style={{
                        border: '3.5px solid #0a0a0a',
                        background: th.avatarBg1,
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.45), inset 0 0 0 2.5px #3b82f6',
                        animation: 'qm-user-glow 2s ease-in-out infinite',
                      }}
                    >
                      <UserAvatar
                        user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                        size={96}
                      />
                    </div>
                  </div>
                  <p
                    className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                    style={{
                      background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {userName}
                  </p>
                  <p className="text-blue-300 text-[10px] font-extrabold uppercase mt-1" style={{ letterSpacing: '0.16em' }}>Ready</p>
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 relative z-20">
                  <div className="relative">
                    <svg className="w-4 h-4 text-yellow-400 mb-1" viewBox="0 0 24 24" fill="currentColor" style={{
                      animation: 'qm-bolt-flicker 1.5s ease-in-out infinite',
                      filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))',
                    }}>
                      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                    </svg>

                    <div
                      className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                        animation: 'qm-vs-pulse 1.5s ease-in-out infinite',
                        textShadow: '0 0 20px rgba(250,204,21,0.4)',
                      }}
                    >
                      VS
                    </div>

                    <svg className="w-4 h-4 text-yellow-400 mt-1 mx-auto" viewBox="0 0 24 24" fill="currentColor" style={{
                      animation: 'qm-bolt-flicker 1.5s ease-in-out infinite 0.5s',
                      filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))',
                    }}>
                      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="relative mb-2" style={{ perspective: '400px' }}>
                    <div
                      className="absolute -inset-3 rounded-full"
                      style={{
                        border: `1px solid ${modeGlow}`,
                        animation: 'qm-ring-spin 3s linear infinite',
                      }}
                    />
                    <div
                      className="absolute -inset-3 rounded-full"
                      style={{
                        background: `conic-gradient(from 0deg, transparent 0deg, ${modeStrong} 40deg, transparent 80deg)`,
                        animation: 'qm-ring-spin 2s linear infinite',
                      }}
                    />

                    <div
                      key={currentAvatarIdx}
                      style={{
                        animation: avatarFlip ? 'qm-avatar-flip-out 0.25s ease-in forwards' : 'qm-avatar-flip-in 0.25s ease-out forwards',
                      }}
                    >
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg2,
                          boxShadow: `0 3px 0 #0a0a0a, 0 0 22px ${modeGlow}, inset 0 0 0 2.5px ${modeColor}`,
                        }}
                      >
                        {currentAvatar ? (
                          <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl md:text-3xl" style={{ color: modeColor, opacity: 0.6 }}>?</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentName ? (
                    <div key={currentName} style={{ animation: 'qm-name-slide 0.3s ease-out' }} className="flex flex-col items-center">
                      <p
                        className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                        style={{
                          background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                          border: '2.5px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {currentName}
                      </p>
                      <p className="text-[10px] font-extrabold mt-1" style={{ color: modeColor, letterSpacing: '0.1em' }}>({currentRecord})</p>
                    </div>
                  ) : (
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                      }}
                    >
                      Searching…
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: modeColor,
                          animation: 'qm-bolt-flicker 1s ease-in-out infinite',
                          animationDelay: `${i * 0.25}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase status pill — gives the user feedback that the
                  matchmaker is doing something specific (vs. a generic
                  spinner) and visibly progresses through phases so the
                  wait feels short. */}
              <div className="px-4 pt-2 pb-1 flex justify-center">
                <div
                  key={phase.label}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg,#111,#0a0a0a)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 3px 0 #0a0a0a',
                    animation: 'qm-tip-fade-in 0.3s ease-out',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: phase.dotColor,
                      boxShadow: `0 0 8px ${phase.dotColor}`,
                      animation: 'qm-bolt-flicker 0.9s ease-in-out infinite',
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-white text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em' }}>
                    {phase.label}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-3 pt-1">
                <div className="flex items-center gap-2 min-h-[36px]">
                  <svg className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p
                    className="text-gray-500 text-[11px] leading-snug flex-1 transition-opacity duration-300"
                    style={{
                      opacity: tipFade ? 0 : 1,
                      animation: tipFade ? 'none' : 'qm-tip-fade-in 0.3s ease-out',
                    }}
                  >
                    {TIPS[tipIndex]}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg,#0d0d0d,#0a0a0a)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: modeColor }}
                  />
                  <span
                    className="text-[11px] font-extrabold font-mono"
                    style={{
                      color: modeColor,
                      animation: 'qm-timer-tick 1s ease-in-out infinite',
                    }}
                  >
                    {searchTime}s
                  </span>
                </div>
                <button
                  onClick={cancelSearch}
                  className="msg-cartoon-btn px-4 py-2 text-white rounded-xl text-[11px] font-extrabold uppercase"
                  style={{
                    background: 'linear-gradient(180deg,#374151,#1f2937)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                    letterSpacing: '0.14em',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
            );
          })()}

          {step === 'found' && (
            <div className="relative overflow-hidden" style={{
              background: 'transparent',
            }}>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center bottom, rgba(250,204,21,0.10) 0%, transparent 65%)',
                }}
              />

              <div className="relative z-10">
                <div className="pt-5 pb-2 text-center">
                  <h3
                    className="text-xl md:text-2xl font-black mb-1 inline-block px-3 py-1 rounded-xl"
                    style={{
                      color: '#fff',
                      background: 'linear-gradient(180deg,#10b981,#059669)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 3px 0 #0a0a0a',
                      letterSpacing: '0.16em',
                      animation: 'qm-matched-slam 0.6s ease-out forwards 0.2s',
                      opacity: 0,
                      transform: 'scale(0.3)',
                    }}
                  >
                    MATCH FOUND
                  </h3>
                  <p className="text-gray-400 text-[11px] font-bold uppercase mt-2" style={{ letterSpacing: '0.14em' }}>Your opponent is ready</p>
                </div>

                <div className="flex items-center justify-center gap-4 md:gap-8 py-5 px-4">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg1,
                          boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.45), inset 0 0 0 2.5px #3b82f6',
                        }}
                      >
                        <UserAvatar
                          user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                          size={96}
                        />
                      </div>
                    </div>
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {userName}
                    </p>
                    <p className="text-[10px] text-blue-300 font-extrabold uppercase mt-1" style={{ letterSpacing: '0.18em' }}>YOU</p>
                  </div>

                  <div className="flex flex-col items-center relative z-20">
                    <div
                      className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                      }}
                    >
                      VS
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                      <div
                        className="absolute rounded-full border-2 border-emerald-500/40"
                        style={{ animation: 'qm-found-ring-expand 1.2s ease-out forwards', top: '-8px', left: '-8px', right: '-8px', bottom: '-8px' }}
                      />

                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg2,
                          boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(239,68,68,0.45), inset 0 0 0 2.5px #ef4444',
                          animation: 'qm-avatar-lock 0.6s ease-out forwards',
                        }}
                      >
                        <UserAvatar
                          user={{
                            id: matchedOpponent?.id,
                            username: matchedOpponent?.username || 'Opponent',
                            avatar: matchedAvatar,
                          }}
                          size={96}
                        />
                      </div>
                    </div>
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {matchedOpponent?.username || 'Opponent'}
                    </p>
                    <p className="text-[10px] text-red-300 font-extrabold uppercase mt-1" style={{ letterSpacing: '0.18em' }}>OPP</p>
                  </div>
                </div>

                <div
                  className="mx-4 mb-4 rounded-2xl p-3 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(180deg,#111,#0a0a0a)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 3px 0 #0a0a0a',
                  }}
                >
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Mode</div>
                    <div className="text-white font-extrabold text-sm flex items-center gap-1 mt-0.5">
                      <span>{selectedMode?.icon}</span>
                      <span>{selectedMode?.label}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Pot</div>
                    <div className="text-white font-extrabold text-sm mt-0.5">${potSize}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Win</div>
                    <div className="font-extrabold text-sm mt-0.5" style={{
                      background: 'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>${payout}</div>
                  </div>
                </div>

                <div className="px-4 pb-5">
                  {gameMode === 'rush' ? (
                    // Rush auto-advances into the live-game vote slide
                    // ~1.4s after MATCH FOUND lands. Show a short hint
                    // here so the user knows the popup is about to flip
                    // them into the vote, not just sitting idle.
                    <div
                      className="w-full py-3.5 rounded-2xl text-center font-extrabold text-white uppercase flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 4px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                        fontSize: 13,
                      }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: '#fbbf24', boxShadow: '0 0 10px #fbbf24', animation: 'qm-bolt-flicker 0.9s ease-in-out infinite' }}
                      />
                      <span style={{ color: '#fbbf24' }}>Loading live games…</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleContinue}
                      className="msg-cartoon-btn w-full py-3.5 rounded-2xl font-extrabold text-white uppercase"
                      style={{
                        background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 4px 0 #0a0a0a, 0 0 20px rgba(59,130,246,0.35)',
                        letterSpacing: '0.14em',
                        fontSize: 14,
                      }}
                    >
                      Continue to Battle
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'rush-vote' && (
            <RushVoteSlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              userName={userName}
              userAvatar={userAvatar}
              userProfileId={userProfile?.id}
              matchupId={matchedMatchup?.id}
              liveGames={liveGamesForVote}
              pendingVoteId={pendingVoteId}
              onVote={submitRushVote}
              onClose={handleClose}
              error={rushVoteError}
            />
          )}

          {step === 'rush-ready' && (
            <RushReadySlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              pendingReady={pendingReady}
              onReady={submitRushReady}
              onClose={handleClose}
              error={readyError}
            />
          )}

          {step === 'rush-countdown' && (
            <RushCountdownSlide num={countdownNum} />
          )}

          {step === 'rush-playing' && (
            <RushPlayingSlide
              rushState={rushState}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              pickedAnswer={pickedAnswer}
              submittingAnswer={submittingAnswer}
              onAnswer={submitRushAnswer}
              onOpenFullView={handleClose}
            />
          )}

          {step === 'rush-completed' && (
            <RushCompletedSlide
              rushState={rushState}
              matchup={matchedMatchup}
              userId={session?.user?.id}
              opponent={matchedOpponent}
              onExit={() => {
                onClose();
                router.push('/battle');
              }}
            />
          )}
        </div>
        </div>
      </div>
    </>
  );
}

// ===========================================================================
// Rush in-popup sub-slides
//
// Three small presentational components that render the cartoon-themed
// vote → rules → countdown ritual inside QuickMatchModal. They share the
// same design language (2.5px black borders, 4px hard shadow, blue=YOU /
// orange=OPP color split) so the whole flow reads as one continuous
// trivia-crack-style sequence rather than four disconnected screens.
// ===========================================================================

const SELF_COLOR = '#3b82f6';
const SELF_COLOR_DEEP = '#1d4ed8';
const OPP_COLOR = '#fb923c';
const OPP_COLOR_DEEP = '#c2410c';

function RushVoteSlide({
  rushState,
  userId,
  opponent,
  liveGames,
  pendingVoteId,
  onVote,
  onClose,
  error,
}) {
  const myVote = userId ? rushState?.gameVotes?.[userId] : null;
  const opponentId = opponent?.id;
  const oppVote = opponentId ? rushState?.gameVotes?.[opponentId] : null;
  const bothVoted = !!myVote && !!oppVote;
  const sameGame = bothVoted && String(myVote?.gameId) === String(oppVote?.gameId);

  // Live deadline countdown — rushState.voteDeadline is ISO from the
  // server; we render seconds-remaining based on Date.now() so it
  // ticks even between polls.
  const deadline = rushState?.voteDeadline ? new Date(rushState.voteDeadline).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remaining = deadline ? Math.max(0, deadline - now) : null;
  const remainingSec = remaining != null ? Math.ceil(remaining / 1000) : null;
  const urgent = remainingSec != null && remainingSec <= 5;

  const noLive = liveGames.length === 0;

  return (
    <div className="relative">
      <style>{`
        @keyframes rvCardIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rvBadgePop {
          0% { transform: scale(0); }
          60% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes rvUrgentPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes rvBoltSwing {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(8deg) scale(1.1); }
        }
        .rv-card { animation: rvCardIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        .rv-card:nth-child(1) { animation-delay: 30ms; }
        .rv-card:nth-child(2) { animation-delay: 90ms; }
        .rv-card:nth-child(3) { animation-delay: 150ms; }
        .rv-badge { animation: rvBadgePop 280ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rv-bolt { animation: rvBoltSwing 1.4s ease-in-out infinite; display: inline-block; transform-origin: center; }
        .rv-urgent { animation: rvUrgentPulse 0.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rv-card, .rv-badge, .rv-bolt, .rv-urgent { animation: none !important; }
        }
      `}</style>

      {/* Header — mirrors the 'config' header so the popup keeps its
          visual identity through the flow. Close button hands off to
          /battle/rush/[id] (handled by parent's handleClose). */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <span className="rv-bolt" aria-hidden="true" style={{ fontSize: 22 }}>⚡</span>
            <div className="min-w-0">
              <h2 className="font-black uppercase text-white" style={{ fontSize: 18, lineHeight: 1.05, letterSpacing: '0.06em', textShadow: '0 2px 0 #000' }}>
                Pick a Game
              </h2>
              <p className="mt-0.5 font-extrabold uppercase" style={{ color: '#fbbf24', fontSize: 9, letterSpacing: '0.18em' }}>
                Both vote — host wins ties
              </p>
            </div>
          </div>
          {remainingSec != null && (
            <div
              className={`text-base font-black tabular-nums px-3 py-1.5 rounded-full ${urgent ? 'rv-urgent' : ''}`}
              style={{
                background: urgent ? 'linear-gradient(180deg,#ef4444,#b91c1c)' : 'linear-gradient(180deg,#fbbf24,#d97706)',
                color: '#0a0a0a',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
              aria-label={`${remainingSec} seconds to vote`}
            >
              {remainingSec}s
            </div>
          )}
        </div>

        {/* Player vote-status pills in their identity colors, so it's
            unmistakable which check belongs to whom on a card below. */}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              background: myVote ? `linear-gradient(180deg,${SELF_COLOR},${SELF_COLOR_DEEP})` : 'rgba(255,255,255,0.05)',
              color: myVote ? '#fff' : '#9ca3af',
              border: '2.5px solid #0a0a0a',
              boxShadow: myVote ? `0 2px 0 #0a0a0a, 0 0 12px ${SELF_COLOR}66` : '0 2px 0 #0a0a0a',
            }}
          >
            <span style={{ fontSize: 11 }}>{myVote ? '✓' : '○'}</span>
            <span>You</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              background: oppVote ? `linear-gradient(180deg,${OPP_COLOR},${OPP_COLOR_DEEP})` : 'rgba(255,255,255,0.05)',
              color: oppVote ? '#fff' : '#9ca3af',
              border: '2.5px solid #0a0a0a',
              boxShadow: oppVote ? `0 2px 0 #0a0a0a, 0 0 12px ${OPP_COLOR}66` : '0 2px 0 #0a0a0a',
            }}
          >
            <span style={{ fontSize: 11 }}>{oppVote ? '✓' : '○'}</span>
            <span>Opp</span>
          </span>
          {bothVoted && (
            <span
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: sameGame
                  ? 'linear-gradient(180deg,#10b981,#047857)'
                  : 'linear-gradient(180deg,#fb923c,#c2410c)',
                color: '#fff',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              {sameGame ? 'Locked!' : 'Host wins'}
            </span>
          )}
        </div>
      </div>

      {/* Cards. We cap to 3 cartoon-themed live game cards — each shows
          the away/home matchup, the live score in big type, and any
          checkmark badges in the picker's identity color so the user
          sees instantly whether the two of you agree. */}
      <div className="px-5 pb-2 space-y-2.5">
        {noLive && (
          <div
            className="rounded-2xl p-4 text-center"
            style={{
              background: 'linear-gradient(180deg,rgba(239,68,68,0.16),rgba(239,68,68,0.04))',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a',
            }}
          >
            <div className="text-2xl mb-1" aria-hidden="true">⚡</div>
            <div className="text-white font-extrabold text-sm mb-1">No live games right now</div>
            <div className="text-[11px] text-gray-400 leading-snug">
              Rush props come from a live game. Hang tight for tip-off — voting auto-resolves at the timer.
            </div>
          </div>
        )}

        {liveGames.map((g) => {
          const gid = String(g.id);
          const iPicked = String(myVote?.gameId) === gid;
          const oppPicked = String(oppVote?.gameId) === gid;
          const isPending = pendingVoteId === gid;
          const disabled = !!myVote || !!pendingVoteId;
          return (
            <RushVoteCard
              key={`${g.sport_key}::${gid}`}
              game={g}
              iPicked={iPicked}
              oppPicked={oppPicked}
              disabled={disabled}
              loading={isPending}
              onPick={() => onVote(g)}
            />
          );
        })}
      </div>

      {error && (
        <div className="px-5 pb-2 text-[11px] text-red-300 text-center">{error}</div>
      )}

      {bothVoted && (
        <div className="px-5 pb-2">
          <div
            className="rounded-2xl px-3 py-2.5 text-center"
            style={{
              background: 'linear-gradient(180deg,rgba(16,185,129,0.18),rgba(16,185,129,0.04))',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-300">
              {sameGame ? 'Both locked the same game!' : 'Both locked in — host\u2019s pick wins'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Generating 6 props…</div>
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
        <div className="text-[10px] text-gray-600 font-mono">
          {liveGames.length} live · max {RUSH_VOTE_GAME_LIMIT}
        </div>
      </div>
    </div>
  );
}

function RushVoteCard({ game, iPicked, oppPicked, disabled, loading, onPick }) {
  const home = game.home_team;
  const away = game.away_team;
  const hs = game?.scores?.home?.total ?? 0;
  const as = game?.scores?.away?.total ?? 0;
  const someonePicked = iPicked || oppPicked;

  // Selected card glow blends the picker colors when both picked it,
  // otherwise uses just the picker's color so the difference between
  // "we agree" and "we disagree" is impossible to miss.
  let glow = 'none';
  let borderInset = 'transparent';
  if (iPicked && oppPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${SELF_COLOR}99, 0 0 22px ${OPP_COLOR}99`;
    borderInset = `linear-gradient(135deg, ${SELF_COLOR}, ${OPP_COLOR})`;
  } else if (iPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${SELF_COLOR}99`;
    borderInset = SELF_COLOR;
  } else if (oppPicked) {
    glow = `0 4px 0 #0a0a0a, 0 0 22px ${OPP_COLOR}99`;
    borderInset = OPP_COLOR;
  } else {
    glow = '0 4px 0 #0a0a0a';
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onPick}
      className="rv-card w-full text-left rounded-2xl px-3.5 py-3 transition-transform active:scale-[0.98]"
      style={{
        background: someonePicked
          ? 'linear-gradient(180deg,#1a1a1a,#0a0a0a)'
          : 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: '2.5px solid #0a0a0a',
        boxShadow: glow,
        opacity: disabled && !someonePicked ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
    >
      {/* Inner accent ring — gives selected cards a colored "second
          border" without fighting the cartoon black outer border. */}
      {someonePicked && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: typeof borderInset === 'string' && borderInset.startsWith('linear')
              ? borderInset
              : undefined,
            backgroundColor: typeof borderInset === 'string' && !borderInset.startsWith('linear') ? borderInset : undefined,
            padding: 2,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3 relative">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md"
              style={{
                background: 'linear-gradient(180deg,#fbbf24,#d97706)',
                color: '#1a0a00',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              {game.sport_title || 'LIVE'}
            </span>
            {game.isLive && (
              <span
                className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                style={{
                  background: 'linear-gradient(180deg,#ef4444,#b91c1c)',
                  color: '#fff',
                  border: '2px solid #0a0a0a',
                  boxShadow: '0 2px 0 #0a0a0a',
                }}
              >
                <span
                  style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 0 6px #fff',
                  }}
                />
                LIVE
              </span>
            )}
          </div>
          <div className="text-white font-extrabold text-[13px] truncate" style={{ letterSpacing: '0.01em' }}>
            {away}
          </div>
          <div className="text-gray-500 text-[10px] my-0.5 font-bold uppercase tracking-wider">vs</div>
          <div className="text-white font-extrabold text-[13px] truncate" style={{ letterSpacing: '0.01em' }}>
            {home}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 font-mono">
            {game.formatted_time || game.status || 'In progress'}
          </div>
        </div>

        {/* Big cartoon-style score block */}
        <div
          className="flex flex-col items-center justify-center px-3 py-2 rounded-xl shrink-0"
          style={{
            background: 'linear-gradient(180deg,#0c1a35,#050a15)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 3px 0 #0a0a0a',
            minWidth: 64,
          }}
        >
          <div className="text-white font-black text-2xl tabular-nums leading-none">{as}</div>
          <div className="text-gray-600 font-black text-[10px] my-0.5">—</div>
          <div className="text-white font-black text-2xl tabular-nums leading-none">{hs}</div>
        </div>
      </div>

      {/* Picker-colored checkmark badges — stacked when both players
          chose the same game so the agree/disagree state is visible
          at a glance. */}
      {(iPicked || oppPicked) && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {iPicked && (
            <div
              className="rv-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: `linear-gradient(180deg,${SELF_COLOR},${SELF_COLOR_DEEP})`,
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              <span style={{ fontSize: 11 }}>✓</span>
              <span>You</span>
            </div>
          )}
          {oppPicked && (
            <div
              className="rv-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: `linear-gradient(180deg,${OPP_COLOR},${OPP_COLOR_DEEP})`,
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
            >
              <span style={{ fontSize: 11 }}>✓</span>
              <span>Opp</span>
            </div>
          )}
          {loading && (
            <div className="ml-auto text-[10px] text-gray-400 font-bold">Sending…</div>
          )}
        </div>
      )}
    </button>
  );
}

function RushReadySlide({ rushState, userId, opponent, pendingReady, onReady, onClose, error }) {
  const opponentId = opponent?.id;
  const myReady = userId ? !!rushState?.readyVotes?.[userId] : false;
  const oppReady = opponentId ? !!rushState?.readyVotes?.[opponentId] : false;

  const rules = [
    { icon: '🏀', label: '6 quick props', sub: 'sealed at the buzzer' },
    { icon: '⏱️', label: '15s per question', sub: 'tap fast — clock runs hot' },
    { icon: '🎯', label: 'Most correct wins', sub: 'tiebreak: fastest answers' },
  ];

  return (
    <div className="relative">
      <style>{`
        @keyframes rrSlamIn {
          0% { opacity: 0; transform: scale(0.7) translateY(20px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rrRowIn {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes rrBoltSwing {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(8deg) scale(1.15); }
        }
        @keyframes rrReadyPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 0 #0a0a0a, 0 0 22px rgba(16,185,129,0.45); }
          50% { transform: scale(1.04); box-shadow: 0 4px 0 #0a0a0a, 0 0 32px rgba(16,185,129,0.7); }
        }
        @keyframes rrCheckPop {
          0% { transform: scale(0); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .rr-title { animation: rrSlamIn 360ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rr-row { animation: rrRowIn 320ms cubic-bezier(0.22,1,0.36,1) both; }
        .rr-row:nth-child(1) { animation-delay: 160ms; }
        .rr-row:nth-child(2) { animation-delay: 240ms; }
        .rr-row:nth-child(3) { animation-delay: 320ms; }
        .rr-bolt { animation: rrBoltSwing 1.2s ease-in-out infinite; display: inline-block; }
        .rr-ready-btn { animation: rrReadyPulse 1.4s ease-in-out infinite; }
        .rr-check-pop { animation: rrCheckPop 320ms cubic-bezier(0.34,1.56,0.64,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .rr-title, .rr-row, .rr-bolt, .rr-ready-btn, .rr-check-pop { animation: none !important; }
        }
      `}</style>

      <div className="px-6 pt-6 pb-2 text-center">
        <div className="rr-title inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{
            background: `linear-gradient(180deg,#fbbf24,#d97706)`,
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 0 22px rgba(251,191,36,0.45)',
          }}
        >
          <span className="rr-bolt" aria-hidden="true" style={{ fontSize: 22 }}>⚡</span>
          <h2 className="font-black uppercase" style={{ color: '#1a0a00', fontSize: 20, letterSpacing: '0.08em' }}>
            How Rush Works
          </h2>
        </div>
      </div>

      <div className="px-5 pt-2 pb-3 space-y-2">
        {rules.map((r, i) => (
          <div
            key={i}
            className="rr-row flex items-center gap-3 p-2.5 rounded-2xl"
            style={{
              background: 'linear-gradient(180deg,#141414,#0a0a0a)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(180deg,#0c1a35,#050a15)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
                fontSize: 20,
              }}
              aria-hidden="true"
            >
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-extrabold text-sm">{r.label}</div>
              <div className="text-gray-500 text-[11px] mt-0.5">{r.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ready status + button */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ReadyBadge label="YOU" ready={myReady} color={SELF_COLOR} colorDeep={SELF_COLOR_DEEP} />
          <ReadyBadge
            label={(opponent?.username || 'OPP').toUpperCase()}
            ready={oppReady}
            color={OPP_COLOR}
            colorDeep={OPP_COLOR_DEEP}
          />
        </div>

        <button
          type="button"
          disabled={myReady || pendingReady}
          onClick={onReady}
          className={`w-full py-3.5 rounded-2xl font-black uppercase text-white transition-transform active:scale-95 ${
            myReady || pendingReady ? '' : 'rr-ready-btn'
          }`}
          style={{
            background: myReady
              ? 'linear-gradient(180deg,#10b981,#047857)'
              : 'linear-gradient(180deg,#10b981,#059669)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a',
            letterSpacing: '0.14em',
            fontSize: 15,
            opacity: pendingReady && !myReady ? 0.7 : 1,
            cursor: myReady ? 'default' : pendingReady ? 'wait' : 'pointer',
          }}
        >
          {myReady
            ? oppReady
              ? "Both ready — let's go!"
              : 'Waiting for opponent…'
            : pendingReady
              ? 'Locking in…'
              : "I'm Ready"}
        </button>

        {error && (
          <div className="mt-2 text-[11px] text-red-300 text-center">{error}</div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
          Ready up to start
        </div>
      </div>
    </div>
  );
}

function ReadyBadge({ label, ready, color, colorDeep }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: ready
          ? `linear-gradient(180deg, ${color}33, ${colorDeep}33)`
          : 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: ready ? `2.5px solid ${color}` : '2.5px solid #0a0a0a',
        boxShadow: ready ? `0 3px 0 #0a0a0a, 0 0 14px ${color}55` : '0 3px 0 #0a0a0a',
        transition: 'all 200ms ease',
      }}
    >
      <div
        className={ready ? 'rr-check-pop' : ''}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: ready ? color : 'rgba(255,255,255,0.06)',
          border: ready ? '2px solid #0a0a0a' : '2px solid rgba(255,255,255,0.12)',
          color: '#0a0a0a',
          fontSize: 13,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {ready ? '✓' : ''}
      </div>
      <div className="min-w-0">
        <div
          className="font-black uppercase truncate"
          style={{ color: ready ? color : 'rgba(229,231,235,0.7)', fontSize: 11, letterSpacing: '0.1em' }}
        >
          {label}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ready ? '#86efac' : 'rgba(156,163,175,0.7)' }}>
          {ready ? 'Ready' : 'Waiting…'}
        </div>
      </div>
    </div>
  );
}

function RushPlayingSlide({ rushState, userId, opponent, pickedAnswer, submittingAnswer, onAnswer, onOpenFullView }) {
  const opponentId = opponent?.id;
  const idx = rushState?.currentQuestionIndex ?? 0;
  const total = rushState?.numQuestions || rushState?.questions?.length || 6;
  const question = rushState?.questions?.[idx];
  const questionDurationMs = rushState?.questionDurationMs || 15000;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const deadline = rushState?.questionDeadline ? new Date(rushState.questionDeadline).getTime() : null;
  const remaining = deadline ? Math.max(0, deadline - now) : questionDurationMs;
  const remainingPct = Math.max(0, Math.min(100, (remaining / questionDurationMs) * 100));
  const remainingSec = Math.ceil(remaining / 1000);
  const urgent = remaining < 5000;
  const timeOut = remaining <= 0;

  const myAnswers = rushState?.answers?.[userId] || {};
  const oppAnswers = opponentId ? (rushState?.answers?.[opponentId] || {}) : {};
  const myAnswerForCurrent = question ? myAnswers[question.id] : null;
  const oppAnswerForCurrent = question ? oppAnswers[question.id] : null;

  const myCorrectSoFar = useMemo(
    () => Object.values(myAnswers).filter(a => a?.correct).length,
    [myAnswers]
  );
  const oppCorrectSoFar = useMemo(
    () => Object.values(oppAnswers).filter(a => a?.correct).length,
    [oppAnswers]
  );

  const lockedKey = pickedAnswer?.questionId === question?.id
    ? pickedAnswer.answerKey
    : myAnswerForCurrent?.key;
  const locked = !!myAnswerForCurrent || timeOut || submittingAnswer;

  if (!question) {
    return (
      <div className="px-6 py-12 text-center text-gray-400 text-sm">Loading question…</div>
    );
  }

  return (
    <div className="relative">
      <style>{`
        @keyframes rpQuestionIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rpOptionIn {
          0% { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes rpUrgentPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .rp-question { animation: rpQuestionIn 280ms cubic-bezier(0.22,1,0.36,1) both; }
        .rp-option { animation: rpOptionIn 240ms cubic-bezier(0.22,1,0.36,1) both; }
        .rp-option:nth-child(1) { animation-delay: 60ms; }
        .rp-option:nth-child(2) { animation-delay: 110ms; }
        .rp-option:nth-child(3) { animation-delay: 160ms; }
        .rp-option:nth-child(4) { animation-delay: 210ms; }
        .rp-urgent { animation: rpUrgentPulse 0.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rp-question, .rp-option, .rp-urgent { animation: none !important; }
        }
      `}</style>

      {/* Header — progress dots + Q-of-N */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 6,
                  borderRadius: 999,
                  background: i < idx ? '#fb923c' : i === idx ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.1)',
                  border: i === idx ? '1px solid rgba(251,146,60,0.6)' : 'none',
                  transition: 'background 150ms ease',
                }}
              />
            ))}
          </div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
            Q{idx + 1}/{total}
          </div>
        </div>

        {/* Live score row */}
        <div className="grid grid-cols-2 gap-2">
          <ScoreChip label="YOU" correct={myCorrectSoFar} answered={!!myAnswerForCurrent} color={SELF_COLOR} />
          <ScoreChip
            label={(opponent?.username || 'OPP').toUpperCase()}
            correct={oppCorrectSoFar}
            answered={!!oppAnswerForCurrent}
            color={OPP_COLOR}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="px-5 pb-3">
        <div
          key={question.id}
          className="rp-question rounded-2xl p-4"
          style={{
            background: 'linear-gradient(180deg,#0c1a35,#050a15)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          {/* Timer row */}
          <div className="flex items-center justify-between mb-3">
            <div
              className={`text-3xl font-black tabular-nums ${urgent ? 'rp-urgent' : ''}`}
              style={{
                color: urgent ? '#ef4444' : '#fb923c',
                textShadow: urgent ? '0 0 12px rgba(239,68,68,0.6)' : '0 0 10px rgba(251,146,60,0.5)',
              }}
            >
              {remainingSec}s
            </div>
            <div
              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style={{
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              ⚡ Rush
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              style={{
                width: `${remainingPct}%`,
                height: '100%',
                background: urgent
                  ? 'linear-gradient(90deg,#ef4444,#f59e0b)'
                  : 'linear-gradient(90deg,#fb923c,#facc15)',
                transition: 'width 100ms linear',
              }}
            />
          </div>

          {/* Prompt */}
          <div className="text-base md:text-lg font-extrabold text-white text-center mb-4 leading-snug">
            {question.prompt}
          </div>

          {/* Options */}
          <div className="space-y-2">
            {question.options?.map((opt) => {
              const isPicked = lockedKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={locked}
                  onClick={() => onAnswer(question.id, opt.key)}
                  className="rp-option w-full text-left px-4 py-3 rounded-xl font-extrabold transition-all"
                  style={{
                    background: isPicked
                      ? `linear-gradient(180deg, ${SELF_COLOR}33, ${SELF_COLOR_DEEP}33)`
                      : 'linear-gradient(180deg,#10203d,#0a1428)',
                    border: isPicked ? `2.5px solid ${SELF_COLOR}` : '2.5px solid #0a0a0a',
                    boxShadow: isPicked
                      ? `0 3px 0 #0a0a0a, 0 0 14px ${SELF_COLOR}55`
                      : '0 3px 0 #0a0a0a',
                    color: isPicked ? '#dbeafe' : 'white',
                    fontSize: 14,
                    cursor: locked && !isPicked ? 'not-allowed' : locked ? 'default' : 'pointer',
                    opacity: locked && !isPicked ? 0.55 : 1,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {!myAnswerForCurrent && timeOut && (
            <div className="mt-3 text-center text-[11px] text-red-300 font-bold">
              Time's up — moving on…
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 text-center">
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline underline-offset-2"
        >
          Open full match view
        </button>
      </div>
    </div>
  );
}

function ScoreChip({ label, correct, answered, color }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{
        background: 'linear-gradient(180deg,#141414,#0a0a0a)',
        border: '2.5px solid #0a0a0a',
        boxShadow: '0 2px 0 #0a0a0a',
      }}
    >
      <div className="min-w-0">
        <div
          className="font-black uppercase truncate"
          style={{ color, fontSize: 10, letterSpacing: '0.1em' }}
        >
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
          {answered ? 'Locked in' : 'Picking…'}
        </div>
      </div>
      <div className="text-xl font-black tabular-nums text-white">
        {correct}
      </div>
    </div>
  );
}

function RushCompletedSlide({ rushState, matchup, userId, opponent, onExit }) {
  const opponentId = opponent?.id;
  const myScore = rushState?.scores?.[userId] || { correct: 0, totalTimeMs: 0 };
  const oppScore = (opponentId && rushState?.scores?.[opponentId]) || { correct: 0, totalTimeMs: 0 };
  const winnerType = rushState?.winnerType;
  const isWinner = rushState?.winnerUserId === userId;
  const isTie = winnerType === 'tie';
  const total = rushState?.numQuestions || rushState?.questions?.length || 6;
  const winnerPayout = matchup?.winnerPayout ? parseFloat(matchup.winnerPayout) : 0;

  const headline = isTie ? "It's a Tie" : isWinner ? 'You Won!' : 'You Lost';
  const headlineColor = isTie ? '#06b6d4' : isWinner ? '#facc15' : '#ef4444';
  const subline = isTie
    ? 'Stake refunded to both players'
    : isWinner
      ? `+$${winnerPayout.toFixed(2)} to your bankroll`
      : 'Better luck next round';

  return (
    <div className="relative">
      <style>{`
        @keyframes rcoSlam {
          0% { opacity: 0; transform: scale(0.6) rotate(-6deg); }
          60% { opacity: 1; transform: scale(1.1) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes rcoCardIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .rco-headline { animation: rcoSlam 460ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rco-card { animation: rcoCardIn 360ms cubic-bezier(0.22,1,0.36,1) both; }
        .rco-card:nth-child(1) { animation-delay: 200ms; }
        .rco-card:nth-child(2) { animation-delay: 280ms; }
        @media (prefers-reduced-motion: reduce) {
          .rco-headline, .rco-card { animation: none !important; }
        }
      `}</style>

      <div className="px-6 pt-7 pb-3 text-center">
        <div
          className="rco-headline inline-block font-black"
          style={{
            color: headlineColor,
            fontSize: 38,
            letterSpacing: '0.02em',
            textShadow: `0 4px 0 #0a0a0a, 0 0 28px ${headlineColor}88`,
          }}
        >
          {headline}
        </div>
        <div className="mt-2 text-xs font-bold text-gray-300">{subline}</div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-2 gap-2">
        <div
          className="rco-card rounded-2xl p-4 text-center"
          style={{
            background: `linear-gradient(180deg, ${SELF_COLOR}22, ${SELF_COLOR_DEEP}22)`,
            border: `2.5px solid ${SELF_COLOR}`,
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-1"
            style={{ color: SELF_COLOR }}
          >
            You
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {myScore.correct}
            <span className="text-sm text-gray-500">/{total}</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {Math.round(myScore.totalTimeMs / 100) / 10}s total
          </div>
        </div>
        <div
          className="rco-card rounded-2xl p-4 text-center"
          style={{
            background: `linear-gradient(180deg, ${OPP_COLOR}22, ${OPP_COLOR_DEEP}22)`,
            border: `2.5px solid ${OPP_COLOR}`,
            boxShadow: '0 3px 0 #0a0a0a',
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-1 truncate"
            style={{ color: OPP_COLOR }}
          >
            {opponent?.username || 'Opponent'}
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {oppScore.correct}
            <span className="text-sm text-gray-500">/{total}</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            {Math.round(oppScore.totalTimeMs / 100) / 10}s total
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onExit}
          className="w-full py-3.5 rounded-2xl font-black uppercase text-white transition-transform active:scale-95"
          style={{
            background: 'linear-gradient(180deg,#fb923c,#c2410c)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 0 22px rgba(251,146,60,0.4)',
            letterSpacing: '0.14em',
            fontSize: 14,
          }}
        >
          Back to Battle
        </button>
      </div>
    </div>
  );
}

function RushCountdownSlide({ num }) {
  // num: 3, 2, 1, then 0 (rendered as "GO!"). Each tick is its own
  // mount/unmount so the slam-in animation re-fires every second.
  const isGo = num === 0;
  const display = isGo ? 'GO!' : String(num);
  const accent = isGo ? '#10b981' : num === 1 ? '#ef4444' : num === 2 ? '#fbbf24' : SELF_COLOR;

  return (
    <div className="relative">
      <style>{`
        @keyframes rcSlam {
          0% { opacity: 0; transform: scale(0.2) rotate(-12deg); filter: blur(8px); }
          50% { opacity: 1; transform: scale(1.25) rotate(6deg); filter: blur(0); }
          80% { transform: scale(0.92) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
        }
        @keyframes rcRing {
          0% { opacity: 0.7; transform: scale(0.6); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes rcGoFlash {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .rc-num { animation: rcSlam 360ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .rc-ring { animation: rcRing 700ms ease-out both; }
        .rc-go-glow { animation: rcGoFlash 0.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rc-num, .rc-ring, .rc-go-glow { animation: none !important; }
        }
      `}</style>

      <div className="py-12 px-6 flex flex-col items-center justify-center" style={{ minHeight: 320 }}>
        <p className="text-[11px] text-gray-400 font-extrabold uppercase tracking-widest mb-6">
          {isGo ? 'Lock in!' : 'Get ready'}
        </p>
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          {/* Expanding ring on each tick */}
          <div
            key={`ring-${num}`}
            className="rc-ring absolute inset-0 rounded-full"
            style={{
              border: `4px solid ${accent}`,
              boxShadow: `0 0 32px ${accent}`,
            }}
            aria-hidden="true"
          />
          {/* Glow disc behind the digit */}
          <div
            className={isGo ? 'rc-go-glow absolute inset-6 rounded-full' : 'absolute inset-6 rounded-full'}
            style={{
              background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
            }}
            aria-hidden="true"
          />
          {/* Big slam digit */}
          <div
            key={`num-${num}`}
            className="rc-num font-black tabular-nums select-none"
            style={{
              fontSize: isGo ? 84 : 132,
              lineHeight: 1,
              color: '#fff',
              textShadow: `0 4px 0 #0a0a0a, 0 0 28px ${accent}, 0 0 60px ${accent}88`,
              letterSpacing: isGo ? '0.04em' : 0,
            }}
          >
            {display}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest mt-8">
          {isGo ? 'Loading match…' : 'Rush · 6 props · 15s each'}
        </p>
      </div>
    </div>
  );
}