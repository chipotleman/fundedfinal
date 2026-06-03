import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import CoinRain from '../CoinRain';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../UserAvatar';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { MatchWin } from './matchflow/MatchFlowScreens';

function useCountUp(target, duration = 1000, shouldStart = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!shouldStart) return;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, shouldStart]);

  return value;
}

function PlayerBlock({
  username,
  avatar,
  frameId,
  userId,
  score,
  isWinner,
  isLoser,
  isTie,
  rematchStatus,
  side,
  reactions = [],
}) {
  const ringColor = isWinner ? '#facc15' : isLoser ? '#ef4444' : '#06b6d4';
  const ringGlow = isWinner
    ? '0 0 0 4px rgba(250,204,21,0.25), 0 0 30px rgba(250,204,21,0.55)'
    : isLoser
    ? '0 0 0 3px rgba(239,68,68,0.18), 0 0 20px rgba(239,68,68,0.35)'
    : '0 0 0 3px rgba(6,182,212,0.18), 0 0 18px rgba(6,182,212,0.35)';
  const sizePx = isWinner ? 96 : 76;

  const initial = (username || (side === 'left' ? 'Y' : 'O'))[0]?.toUpperCase() || '?';
  const status = rematchStatus || 'pending';

  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="relative" style={{ width: sizePx, height: sizePx }}>
        {reactions.map((r) => (
          <div
            key={r.id}
            className="mr-reaction-float pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 z-10 flex items-center justify-center"
            style={{ maxWidth: 220 }}
          >
            {r.emoji && (
              <span className="text-3xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>{r.emoji}</span>
            )}
            {r.text && (
              <span
                className="ml-1 inline-block text-xs font-black px-2 py-1 rounded-2xl text-white align-middle break-words"
                style={{
                  background: 'rgba(15,23,42,0.85)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  maxWidth: 200,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >{r.text}</span>
            )}
          </div>
        ))}
        {avatar ? (
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: sizePx,
              height: sizePx,
              border: `3px solid ${ringColor}`,
              boxShadow: ringGlow,
              background: '#111',
            }}
          >
            <UserAvatar
              user={userId ? { id: userId, username, avatar } : undefined}
              avatar={avatar}
              username={username}
              frameId={frameId || null}
              size={sizePx - 6}
              bgColor="#111"
            />
          </div>
        ) : (
          <div
            className="rounded-full overflow-hidden flex items-center justify-center"
            style={{
              width: sizePx,
              height: sizePx,
              border: `3px solid ${ringColor}`,
              boxShadow: ringGlow,
              background: '#111',
            }}
          >
            <span className={`font-black text-white/80 ${isWinner ? 'text-3xl' : 'text-2xl'}`}>{initial}</span>
          </div>
        )}
        {isWinner && (
          <div
            className="absolute left-1/2 -top-5 -translate-x-1/2 text-2xl"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(250,204,21,0.65))' }}
            aria-label="Winner"
          >
            👑
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 max-w-[140px]">
        <span
          className={`truncate text-sm font-bold ${
            isWinner ? 'text-yellow-300' : isLoser ? 'text-red-300' : 'text-cyan-200'
          }`}
          title={username || ''}
        >
          {username || (side === 'left' ? 'You' : 'Opponent')}
        </span>
        {status === 'accepted' && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/90 text-white text-[10px] font-black"
            title="Wants a rematch"
            aria-label="Wants a rematch"
          >✓</span>
        )}
        {status === 'declined' && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/90 text-white text-[10px] font-black"
            title="Declined rematch"
            aria-label="Declined rematch"
          >✕</span>
        )}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 leading-none mt-1">Score</div>
      <div className={`text-base font-black tabular-nums leading-tight ${
        isWinner ? 'text-yellow-300' : isLoser ? 'text-red-300' : 'text-white'
      }`}>
        {formatMoney(score, 0)} <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">pts</span>
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ['👍', '🔥', '😂', '🎯', '👏'];
const REACTION_TEXTS = ['GG', 'Nice!', 'Close one', 'WP'];
const REACTION_TTL_MS = 1800;

export default function MatchResult({
  matchup,
  currentUserId,
  resultData,
  rematchState,
  reactionQueue,
  onSendReaction,
  opponent: opponentOverride,
  onRematchAccept,
  onRematchDecline,
  onClose,
  highlight = false,
  highlightRematch = false,
}) {
  const isBeta = useBetaMode();
  const router = useRouter();
  const [showStats, setShowStats] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myReactions, setMyReactions] = useState([]);
  const [oppReactions, setOppReactions] = useState([]);
  const [customText, setCustomText] = useState('');
  const [customSending, setCustomSending] = useState(false);
  const [customError, setCustomError] = useState('');
  // Brief, non-blocking hint shown near the reaction strip when a canned tap
  // can't be sent (e.g., 429 burst limit, network/server error). Auto-clears.
  const [reactionHint, setReactionHint] = useState('');
  const reactionHintTimerRef = useRef(null);
  // Client-side token bucket so a normal "tap-tap-tap" feels instant. Mirrors
  // the server's bucket — generous burst, modest sustained rate. We still
  // try the network call and surface 429s when the server's bucket is the
  // tighter constraint (e.g., a second device tapping at the same time).
  const tokenBucketRef = useRef({ tokens: 6, last: 0 });
  const TOKEN_CAPACITY = 6;
  const TOKEN_REFILL_MS = 350;
  const lastCustomSendRef = useRef(0);
  const declineFiredRef = useRef(false);

  const isCompleted = matchup && matchup.status === 'completed';
  const isUser1 = matchup?.user1Id === currentUserId;

  // Score = play-money final balance. Cash P&L is computed from pot/payout.
  const startingBalance = parseFloat(matchup?.startingBalance) || 0;
  const myFinalBalance = parseFloat(
    isUser1 ? matchup?.user1FinalBalance : matchup?.user2FinalBalance
  ) || startingBalance;
  const opponentFinalBalance = parseFloat(
    isUser1 ? matchup?.user2FinalBalance : matchup?.user1FinalBalance
  ) || startingBalance;

  const isWinner = isCompleted && matchup?.winnerId === currentUserId;
  const isTie = matchup?.winnerType === 'tie';
  const isLoser = isCompleted && !isWinner && !isTie;

  // Cash P&L — prefer server-supplied value, otherwise compute from potSize / winnerPayout.
  const potSize = Number(resultData?.potSize ?? matchup?.potSize ?? 0) || 0;
  const winnerPayoutRaw = Number(resultData?.winnerPayout ?? matchup?.winnerPayout ?? 0) || 0;
  const cashBuyIn = Number(resultData?.cashBuyIn ?? (potSize / 2)) || 0;
  let computedCashPnl = 0;
  if (isCompleted) {
    if (isTie) computedCashPnl = -(cashBuyIn * 0.1);
    else if (isWinner) computedCashPnl = winnerPayoutRaw - cashBuyIn;
    else computedCashPnl = -cashBuyIn;
  }
  const cashPnl = Number(resultData?.cashPnl) || computedCashPnl;
  const prizeWon = isWinner ? winnerPayoutRaw : 0;

  const myPendingCount = Number(
    isUser1 ? matchup?.pendingCountUser1 : matchup?.pendingCountUser2
  ) || Number(matchup?.myPendingCount) || 0;
  const opponentPendingCount = Number(
    isUser1 ? matchup?.pendingCountUser2 : matchup?.pendingCountUser1
  ) || Number(matchup?.opponentPendingCount) || 0;
  const totalPendingCount = myPendingCount + opponentPendingCount;

  const myProfile = resultData?.myProfile;
  const opponentProfile = opponentOverride || resultData?.opponent || matchup?.opponent;
  const opponentName = opponentProfile?.username || opponentProfile?.displayName || 'Opponent';
  const opponentAvatar = opponentProfile?.avatar || null;
  const opponentFrameId = opponentProfile?.equippedFrame || opponentProfile?.frameId || null;
  const opponentId = opponentProfile?.id || (isUser1 ? matchup?.user2Id : matchup?.user1Id) || null;
  const myName = myProfile?.username || 'You';
  const myAvatar = myProfile?.avatar || null;
  const myFrameId = myProfile?.equippedFrame || myProfile?.frameId || null;

  const isFakeOpponent = !!(matchup?.isFakeOpponent || resultData?.isFakeOpponent);

  // Derive per-side rematch status
  const myRematchStatus = rematchState
    ? (isUser1 ? rematchState.user1Rematch : rematchState.user2Rematch)
    : 'pending';
  const oppRematchStatus = rematchState
    ? (isUser1 ? rematchState.user2Rematch : rematchState.user1Rematch)
    : 'pending';

  useEffect(() => {
    if (!isCompleted) return;
    setShowTitle(false);
    setShowStats(false);
    setShowConfetti(false);
    const t1 = setTimeout(() => setShowTitle(true), 30);
    const t2 = setTimeout(() => setShowStats(true), 250);
    const t3 = setTimeout(() => { if (isWinner) setShowConfetti(true); }, 80);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isCompleted, isWinner, matchup?.id]);

  const animatedFinal = useCountUp(myFinalBalance, 1000, showStats);
  const animatedOpp = useCountUp(opponentFinalBalance, 1000, showStats);
  const animatedCashPnl = useCountUp(Math.abs(cashPnl), 1000, showStats);
  const animatedPrize = useCountUp(prizeWon, 1100, showStats);

  const handleShare = useCallback(async () => {
    const text = isBeta
      ? `I just won ${formatMoney(prizeWon)} coins on Piks! 🏆🔥`
      : `I just won $${formatMoney(prizeWon)} on Piks! 🏆🔥`;
    const id = matchup?.id;

    let url = null;
    if (id && typeof window !== 'undefined') {
      try {
        const u = new URL('/bet-history', window.location.origin);
        u.searchParams.set('battle', id);
        url = u.toString();
      } catch (_) {
        url = null;
      }
    }

    if (url && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Piks', text, url });
        return;
      } catch (_) {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    const payload = url ? `${text} ${url}` : text;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }, [prizeWon, matchup?.id]);

  // Per-reaction expiry timers. Each reaction owns its own timer so rapid-fire
  // reactions all expire independently and don't get cancelled when a newer
  // one arrives. Keyed by reaction id.
  const reactionTimersRef = useRef(new Map());
  // Tracks every reaction id we've already shown (whether via optimistic
  // local render or via the live-stream queue). The sender adds the id
  // optimistically the moment they tap; when the live-stream echo arrives
  // moments later carrying the same id, this set causes us to skip it so
  // the same emoji never double-renders.
  const processedIdsRef = useRef(new Set());

  const scheduleReactionExpiry = useCallback((id, fromMe) => {
    if (reactionTimersRef.current.has(id)) return;
    const setter = fromMe ? setMyReactions : setOppReactions;
    const t = setTimeout(() => {
      setter((prev) => prev.filter((r) => r.id !== id));
      reactionTimersRef.current.delete(id);
    }, REACTION_TTL_MS);
    reactionTimersRef.current.set(id, t);
  }, []);

  // Reset reaction state whenever the popup switches to a different matchup
  // so previous-battle reactions never leak into the next result popup.
  // The client-side token bucket is also reset so a fresh battle gets a
  // full burst budget — mirrors the server's per-matchup bucket scope.
  useEffect(() => {
    processedIdsRef.current = new Set();
    setMyReactions([]);
    setOppReactions([]);
    for (const t of reactionTimersRef.current.values()) clearTimeout(t);
    reactionTimersRef.current.clear();
    if (reactionHintTimerRef.current) {
      clearTimeout(reactionHintTimerRef.current);
      reactionHintTimerRef.current = null;
    }
    setReactionHint('');
    tokenBucketRef.current = { tokens: TOKEN_CAPACITY, last: 0 };
  }, [matchup?.id]);

  // Drain the live-stream reaction queue. Each new id is routed to the
  // sender's or the opponent's avatar exactly once; ids we've already
  // rendered (via optimistic local taps) are skipped so the echo doesn't
  // double-show. Note: any reaction that arrived during a live-stream
  // disconnect is NOT replayed by the stream client today — see the file
  // header in `lib/battleStreamClient.js`. For the sender that gap is
  // covered by the optimistic-render path below; for the opponent, taps
  // sent while the stream is unhealthy may not be visible. This is
  // documented and acceptable per task #271 step 6.
  useEffect(() => {
    if (!Array.isArray(reactionQueue) || reactionQueue.length === 0) return;
    for (const r of reactionQueue) {
      if (!r || !r.id) continue;
      if (processedIdsRef.current.has(r.id)) continue;
      processedIdsRef.current.add(r.id);
      const fromMe = r.fromUserId === currentUserId;
      const item = { id: r.id, emoji: r.emoji || null, text: r.text || null };
      const setter = fromMe ? setMyReactions : setOppReactions;
      setter((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
      scheduleReactionExpiry(item.id, fromMe);
    }
  }, [reactionQueue, currentUserId, scheduleReactionExpiry]);

  useEffect(() => () => {
    for (const t of reactionTimersRef.current.values()) clearTimeout(t);
    reactionTimersRef.current.clear();
    if (reactionHintTimerRef.current) clearTimeout(reactionHintTimerRef.current);
  }, []);

  const showReactionHint = useCallback((message) => {
    setReactionHint(message);
    if (reactionHintTimerRef.current) clearTimeout(reactionHintTimerRef.current);
    reactionHintTimerRef.current = setTimeout(() => {
      setReactionHint('');
      reactionHintTimerRef.current = null;
    }, 1500);
  }, []);

  const sendReaction = useCallback(async (payload) => {
    // Refill the local token bucket and consume one. The bucket allows a
    // generous burst (TOKEN_CAPACITY) before throttling, so normal "spam
    // five hearts" behaviour just works without any silently-dropped taps.
    const now = Date.now();
    const bucket = tokenBucketRef.current;
    if (bucket.last === 0) bucket.last = now;
    const elapsed = Math.max(0, now - bucket.last);
    bucket.tokens = Math.min(TOKEN_CAPACITY, bucket.tokens + elapsed / TOKEN_REFILL_MS);
    bucket.last = now;
    if (bucket.tokens < 1) {
      showReactionHint('Slow down');
      return;
    }
    bucket.tokens -= 1;

    // Optimistically render the sender's reaction immediately rather than
    // waiting for the SSE echo. We generate a stable client id, mark it
    // processed, then send it to the server which will use the same id in
    // its echo so the queue-driven path will dedupe.
    const clientId = `c-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id: clientId,
      emoji: payload?.emoji || null,
      text: payload?.text || null,
    };
    processedIdsRef.current.add(clientId);
    setMyReactions((prev) => [...prev, item]);
    scheduleReactionExpiry(clientId, true);

    let result = null;
    try {
      result = await onSendReaction?.({ ...payload, clientId });
    } catch {
      result = { error: 'Network error' };
    }
    if (result && result.error) {
      // Roll back the optimistic render and surface a brief hint.
      const t = reactionTimersRef.current.get(clientId);
      if (t) {
        clearTimeout(t);
        reactionTimersRef.current.delete(clientId);
      }
      processedIdsRef.current.delete(clientId);
      setMyReactions((prev) => prev.filter((x) => x.id !== clientId));
      const errStr = typeof result.error === 'string' ? result.error : '';
      let hint = "Couldn't send";
      if (result.status === 429 || /too fast|slow/i.test(errStr)) hint = 'Slow down';
      else if (/network/i.test(errStr)) hint = 'Offline?';
      showReactionHint(hint);
    }
  }, [onSendReaction, scheduleReactionExpiry, showReactionHint]);

  const sendCustomMessage = useCallback(async () => {
    const trimmed = customText.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastCustomSendRef.current < 2500) {
      setCustomError('Slow down a moment.');
      return;
    }
    lastCustomSendRef.current = now;
    setCustomSending(true);
    setCustomError('');
    try {
      const r = await onSendReaction?.({ customText: trimmed });
      if (r && r.error) {
        // Preserve the draft so the user can edit/retry.
        setCustomError(typeof r.error === 'string' ? r.error : 'Could not send');
      } else {
        setCustomText('');
      }
    } catch {
      setCustomError('Could not send');
    } finally {
      setCustomSending(false);
    }
  }, [customText, onSendReaction]);

  const handleClose = useCallback(() => {
    // Treat closing without accepting as an implicit decline so the
    // opponent's view shows an X next to this user's name.
    if (
      !declineFiredRef.current &&
      !isFakeOpponent &&
      myRematchStatus === 'pending' &&
      typeof onRematchDecline === 'function'
    ) {
      declineFiredRef.current = true;
      try { onRematchDecline(); } catch {}
    }
    onClose?.();
  }, [isFakeOpponent, myRematchStatus, onRematchDecline, onClose]);

  // Open the full, shareable Battle Summary page for this matchup. Falls back
  // to simply closing the modal if we somehow don't have a matchup id.
  const handleSummary = useCallback(() => {
    const mid = matchup?.id;
    if (!mid) { handleClose(); return; }
    try { router.push(`/battle/summary/${encodeURIComponent(mid)}`); } catch (_e) {}
  }, [matchup?.id, router, handleClose]);

  if (!isCompleted) return null;

  const confettiColors = ['#3b82f6', '#10b981', '#06b6d4', '#f97316', '#fbbf24', '#22d3ee'];
  const rematchAcceptedByMe = myRematchStatus === 'accepted';
  const oppDeclined = oppRematchStatus === 'declined';
  const rematchDisabled = isFakeOpponent || oppDeclined;

  let rematchLabel = 'Rematch';
  if (rematchAcceptedByMe && oppRematchStatus === 'pending') rematchLabel = 'Waiting for opponent…';
  else if (rematchAcceptedByMe && oppRematchStatus === 'accepted') rematchLabel = 'Starting rematch…';
  else if (oppDeclined) rematchLabel = 'Opponent declined';
  else if (isFakeOpponent) rematchLabel = 'Find new match';

  // Player objects + outcome mapping for the premium match-flow screens.
  const outcome = isWinner ? 'win' : isTie ? 'tie' : 'lose';
  const youPlayer = { id: currentUserId, name: myName, username: myName, avatar: myAvatar };
  const oppPlayer = { id: opponentId, name: opponentName, username: opponentName, avatar: opponentAvatar };
  // Preserve the per-side rematch intent (previously shown as ✓/✕ badges) as
  // a status line under the rematch panel.
  let rematchStatusText = '';
  if (!isFakeOpponent) {
    if (oppRematchStatus === 'accepted') rematchStatusText = `${opponentName} wants a rematch`;
    else if (oppRematchStatus === 'declined') rematchStatusText = `${opponentName} declined the rematch`;
  }

  return (
    <>
      <style>{`
        @keyframes mr-confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes mr-trophy-bounce {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes mr-title-slam {
          0% { transform: scale(2.4); opacity: 0; }
          60% { transform: scale(0.92); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mr-defeat-fade {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes mr-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-8px); }
          20% { transform: translateX(8px); }
          30% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          50% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes mr-stats-slide {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes mr-golden-glow {
          0%, 100% { text-shadow: 0 0 10px rgba(251,191,36,0.5), 0 0 30px rgba(251,191,36,0.3); }
          50% { text-shadow: 0 0 20px rgba(251,191,36,0.8), 0 0 50px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.3); }
        }
        @keyframes mr-pot-flow {
          0% { transform: translateX(0); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(${isWinner ? '-' : '+'}60px); opacity: 0; }
        }
        @keyframes mr-vignette-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .mr-confetti-piece {
          position: fixed;
          width: 8px;
          height: 8px;
          top: -10px;
          z-index: 60;
          animation: mr-confetti-fall linear forwards;
        }
        .mr-trophy { animation: mr-trophy-bounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .mr-title-win { animation: mr-title-slam 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, mr-golden-glow 2s ease-in-out infinite; }
        .mr-title-lose { animation: mr-defeat-fade 0.6s ease-out forwards; }
        .mr-title-tie { animation: mr-title-slam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .mr-shake { animation: mr-shake 0.5s ease-out; }
        .mr-stats-card { animation: mr-stats-slide 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes mr-result-highlight-anim {
          0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
          25% { box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.55), 0 0 28px rgba(6, 182, 212, 0.5); }
          75% { box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.35); }
        }
        .mr-result-highlight {
          animation: mr-stats-slide 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     mr-result-highlight-anim 1.4s ease-in-out 0.5s 2;
        }
        @keyframes mr-reaction-float-anim {
          0% { transform: translate(-50%, 10px) scale(0.6); opacity: 0; }
          15% { transform: translate(-50%, -4px) scale(1.15); opacity: 1; }
          70% { transform: translate(-50%, -38px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -64px) scale(0.9); opacity: 0; }
        }
        .mr-reaction-float {
          animation: mr-reaction-float-anim 1.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes mr-chip-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .mr-chip:active { animation: mr-chip-pop 0.18s ease-out; }
        .mr-red-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 51;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(220,38,38,0.3) 100%);
          animation: mr-vignette-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {showConfetti && isWinner && Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="mr-confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: confettiColors[i % confettiColors.length],
            animationDuration: `${2 + Math.random() * 2}s`,
            animationDelay: `${Math.random() * 1.5}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 6}px`,
          }}
        />
      ))}

      {isWinner && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 110 }}>
          <CoinRain trigger={showConfetti} />
        </div>
      )}

      {!isWinner && !isTie && <div className="mr-red-vignette" />}

      <div
        data-allow-fixed-overlay="true"
        className={`fixed inset-0 backdrop-blur-md z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto ${!isWinner && !isTie ? 'mr-shake' : ''}`}
        style={{ background: 'rgba(0,0,0,0.9)', overscrollBehavior: 'contain' }}
        onClick={handleClose}
      >
        <div
          className="max-w-md w-full text-center my-auto"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Win / lose / draw outcome splash — premium match-flow screen */}
          <div className="mb-5 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <MatchWin
              outcome={outcome}
              you={youPlayer}
              opp={oppPlayer}
              balance={myFinalBalance}
              prize={prizeWon}
              onPrimary={isWinner ? handleShare : handleSummary}
              primaryLabel={isWinner ? (copied ? 'Copied!' : 'Share Win') : 'Summary'}
              secondary={isWinner ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="py-2 rounded-lg text-sm font-bold text-gray-300 hover:text-white transition-colors"
                    style={{ border: '1px solid #2a2a2a', background: 'rgba(255,255,255,0.03)' }}
                  >
                    Exit
                  </button>
                  <button
                    type="button"
                    onClick={handleSummary}
                    className="py-2 rounded-lg text-sm font-bold text-white transition-colors"
                    style={{ border: '1px solid rgba(34,211,238,0.45)', background: 'rgba(34,211,238,0.12)' }}
                  >
                    Summary
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-3 w-full py-2 text-sm font-bold text-gray-300 hover:text-white transition-colors"
                >
                  Exit
                </button>
              )}
            />
          </div>

          {showStats && (
            <div
              className={`mr-stats-card rounded-xl p-4 mb-5 space-y-3 ${highlight ? 'mr-result-highlight' : ''}`}
              style={{
                background: '#0d0d0d',
                border: `1px solid ${highlight ? 'rgba(6, 182, 212, 0.55)' : '#1a1a1a'}`,
              }}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Buy-in</span>
                <span className="font-medium text-white">${formatMoney(cashBuyIn)}</span>
              </div>
              {isWinner && prizeWon > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Prize Won</span>
                  <span className="text-emerald-400 font-bold text-lg">${formatMoney(animatedPrize)}</span>
                </div>
              )}
              {totalPendingCount > 0 && (
                <div
                  className="px-3 py-2 rounded-lg flex items-start gap-2"
                  style={{
                    background: 'rgba(234,179,8,0.10)',
                    border: '1px solid rgba(234,179,8,0.45)',
                  }}
                >
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div className="flex-1 text-left">
                    <div className="text-yellow-400 text-[11px] font-bold uppercase tracking-wide leading-tight">
                      {totalPendingCount} {totalPendingCount === 1 ? 'pik' : 'piks'} did not grade in time
                    </div>
                    <div className="text-[11px] mt-0.5 leading-snug text-gray-300">
                      {(() => {
                        const parts = [];
                        if (myPendingCount > 0) parts.push(`${myPendingCount} of yours`);
                        if (opponentPendingCount > 0) parts.push(`${opponentPendingCount} of opponent's`);
                        const who = parts.join(' and ');
                        return `${who} ${totalPendingCount === 1 ? 'was' : 'were'} forfeited toward this battle's score.`;
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {showStats && !isFakeOpponent && (
            <div
              className="mr-stats-card mb-3 rounded-xl px-3 py-2"
              style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
            >
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => sendReaction({ emoji: e })}
                    className="mr-chip text-xl leading-none px-2 py-1.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                    aria-label={`Send ${e} reaction`}
                  >
                    {e}
                  </button>
                ))}
                <div className="w-px h-6 bg-white/10 mx-1" />
                {REACTION_TEXTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => sendReaction({ text: t })}
                    className="mr-chip text-xs font-bold text-gray-200 px-2.5 py-1.5 rounded-full hover:bg-white/5 active:bg-white/10 transition-colors"
                    style={{ border: '1px solid #2a2a2a' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {reactionHint && (
                <div
                  className="mt-1 text-[11px] text-amber-300/90 text-center select-none"
                  role="status"
                  aria-live="polite"
                >
                  {reactionHint}
                </div>
              )}
              <form
                className="mt-2 flex items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); sendCustomMessage(); }}
              >
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => { setCustomText(e.target.value); if (customError) setCustomError(''); }}
                  maxLength={60}
                  placeholder="Say something…"
                  aria-label="Send a custom message"
                  className="flex-1 min-w-0 text-sm text-white placeholder-gray-500 bg-black/40 rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  style={{ border: '1px solid #2a2a2a' }}
                />
                <span className="text-[10px] tabular-nums text-gray-500 select-none w-8 text-right">
                  {Math.max(0, 60 - customText.length)}
                </span>
                <button
                  type="submit"
                  disabled={customSending || !customText.trim()}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                    customSending || !customText.trim()
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-cyan-500 text-black hover:bg-cyan-400'
                  }`}
                >
                  Send
                </button>
              </form>
              {customError && (
                <div className="mt-1 text-[11px] text-red-400 text-left px-1">{customError}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
