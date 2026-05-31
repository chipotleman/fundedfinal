import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';
import { useNotifications } from '../../contexts/NotificationsContext';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import { useSession } from 'next-auth/react';
import { useBetaMode } from '../../contexts/SiteConfigContext';

const INVITE_EXPIRY_HOURS = 24;

// Game-mode metadata. Mirrors the entries used by QuickMatchModal so
// the invite popup speaks the same language as the matchmaker. Each
// mode carries a label, a cartoon icon, a color, a short tagline that
// makes the mode feel like a *thing*, and a duration label so the
// receiver instantly knows what they're being challenged to.
const MODE_META = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    color: '#fb923c',
    tagline: '6 quick props from one live game',
    durationLabel: 'Live · ~3 min',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    color: '#3b82f6',
    tagline: 'Highest balance after the games end wins',
    durationLabel: 'Day battle',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    color: '#10b981',
    tagline: '3-day grind for a massive bankroll',
    durationLabel: '3-day battle',
  },
};

function modeMetaFor(n) {
  return MODE_META[n] || MODE_META.original;
}

function compactCoins(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 ? 1 : 0)}K`;
  return String(v);
}

function UserAvatar({ user, size = 36 }) {
  return <SharedUserAvatar user={user} size={size} />;
}

function formatCountdown(seconds) {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function IncomingInviteModal() {
  const router = useRouter();
  const { data: session } = useSession();
  const isBeta = useBetaMode();
  const ctx = useNotifications();
  const invite = ctx.currentIncomingInvite || null;
  const isOpen = !!invite;

  useModalScrollLock(isOpen);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setBusy(null);
      setError('');
      return undefined;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isOpen, invite?.id]);

  if (!isOpen) return null;

  const sender = invite.sender || {};
  // The invite payload carries the mode as `gameMode` (SSE push in
  // pages/api/battles/invite.js and the battle_invites column). The legacy
  // `n` key never existed on this object, so reading it made every popup
  // fall back to ORIGINAL. Prefer gameMode; keep `n` as a defensive fallback.
  const mode = modeMetaFor(invite.gameMode || invite.n);
  const buyIn = parseFloat(invite.buyIn) || 0;
  const pot = buyIn * 2;
  // Beta uses coins (compact), live mode uses dollars.
  const buyInLabel = isBeta ? `${compactCoins(buyIn)} Coins` : `$${buyIn} Buy-In`;
  const potLabel = isBeta ? `Win ${compactCoins(Math.round(pot * 0.9))}` : `Win $${pot} Pot`;
  // Prefer the mode's natural duration label; fall back to the
  // server-provided hours if the mode is unknown.
  const durationLabel = mode.durationLabel || (invite.duration ? `${invite.duration}h battle` : 'Battle');
  const expiresAtMs = invite.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
  const remainingSec = expiresAtMs ? Math.max(0, Math.floor((expiresAtMs - now) / 1000)) : 0;
  const expired = expiresAtMs > 0 && remainingSec === 0;
  const totalSec = INVITE_EXPIRY_HOURS * 3600;
  const progressPct = Math.min(100, Math.max(0, (remainingSec / totalSec) * 100));

  const currentUser = session?.user
    ? {
        id: session.user.id,
        username: session.user.username || session.user.name,
        avatar: session.user.image || session.user.avatar,
        frameId: session.user.equippedFrame,
      }
    : { username: 'You' };

  const close = () => {
    ctx.dismissIncomingInvite?.(invite.id);
  };

  const handleAccept = async () => {
    if (busy) return;
    setBusy('accept');
    setError('');
    try {
      const data = await ctx.acceptInvite(invite.id);
      if (data?.ok && data.matchup) {
        ctx.dismissIncomingInvite?.(invite.id);
        navigateToBattleStart(router, data.matchup);
      } else {
        // Accept failed (expired / opponent already in a battle / already
        // handled). Keep the popup open and show why instead of dismissing
        // into a dead end.
        setError(data?.error || 'Could not accept. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    if (busy) return;
    setBusy('decline');
    setError('');
    try {
      await ctx.declineInvite(invite.id);
      ctx.dismissIncomingInvite?.(invite.id);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iim-title"
        className="rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto iim-slide-in my-auto"
        style={{
          backgroundColor: '#0d0d0d',
          border: '2.5px solid #0a0a0a',
          boxShadow: '0 8px 0 #0a0a0a, 0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style jsx>{`
          @keyframes iimSlideIn {
            from { transform: translateY(20px) scale(0.96); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes iimBounceIn {
            0% { transform: scale(0.85); opacity: 0; }
            60% { transform: scale(1.04); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes iimSlamLeft {
            0% { transform: translateX(-40px) scale(0.9); opacity: 0; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes iimSlamRight {
            0% { transform: translateX(40px) scale(0.9); opacity: 0; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes iimAcceptPulse {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @keyframes iimDots {
            0%, 20% { opacity: 0.2; }
            50% { opacity: 1; }
            80%, 100% { opacity: 0.2; }
          }
          .iim-slide-in { animation: iimSlideIn 0.25s ease-out; }
          .iim-bounce-in { animation: iimBounceIn 0.4s ease-out; }
          .iim-slam-left { animation: iimSlamLeft 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
          .iim-slam-right { animation: iimSlamRight 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
          .iim-accept-pulse { animation: iimAcceptPulse 1.4s ease-in-out infinite; }
          .iim-dot { display: inline-block; animation: iimDots 1.4s infinite; }
          .iim-dot:nth-child(2) { animation-delay: 0.2s; }
          .iim-dot:nth-child(3) { animation-delay: 0.4s; }
        `}</style>

        {/* Header bar — compact title + close. The mode badge sits in
            its own band below so the title isn't fighting the badge for
            attention. */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2 id="iim-title" className="text-lg font-black text-white" style={{ letterSpacing: '0.02em' }}>
              Battle Challenge!
            </h2>
            <p className="text-xs mt-0.5 text-gray-400">
              <span className="font-bold text-white">{sender.username || 'A friend'}</span> just challenged you
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1a1a1a', border: '2px solid #0a0a0a' }}
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode banner — the headline answer to "what kind of game?".
            Uses the mode's signature color as a solid border + tinted
            background so it reads like a sticker, not a glow. */}
        <div className="px-5 pb-3">
          <div
            className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: '#0f1424',
              border: `2.5px solid ${mode.color}`,
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                background: mode.color,
                border: '2px solid #0a0a0a',
                fontSize: 24,
              }}
              aria-hidden="true"
            >
              {mode.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[10px] font-extrabold uppercase"
                style={{ color: mode.color, letterSpacing: '0.18em' }}
              >
                {mode.label} MODE
              </div>
              <div className="text-white text-xs font-semibold mt-0.5 leading-snug">
                {mode.tagline}
              </div>
            </div>
            <div
              className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase whitespace-nowrap"
              style={{
                background: '#1a1a1a',
                color: '#fff',
                border: '2px solid #0a0a0a',
                letterSpacing: '0.08em',
              }}
            >
              {durationLabel}
            </div>
          </div>
        </div>

        {/* Avatars + VS */}
        <div className="flex items-center justify-center gap-3 md:gap-5 px-5 pb-2 iim-bounce-in">
          {/* Sender (challenger) */}
          <div className="flex flex-col items-center iim-slam-left" style={{ width: 100 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 80, height: 80,
                border: '3px solid #fb923c',
                background: '#1a0d05',
              }}
            >
              <UserAvatar
                user={{ id: sender.id, username: sender.username, avatar: sender.avatar, frameId: sender.equippedFrame }}
                size={72}
              />
            </div>
            <div className="mt-2 text-xs font-extrabold text-white truncate max-w-[96px]">
              {sender.username || 'A friend'}
            </div>
            <div
              className="mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
              style={{
                background: '#10b981',
                color: '#fff',
                border: '2px solid #047857',
                letterSpacing: '0.12em',
              }}
            >
              Ready
            </div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center px-1">
            <div
              className="text-3xl md:text-4xl font-black italic"
              style={{ color: '#facc15', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              VS
            </div>
          </div>

          {/* You */}
          <div className="flex flex-col items-center iim-slam-right" style={{ width: 100 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 80, height: 80,
                border: '3px solid #3b82f6',
                background: '#0a1124',
              }}
            >
              <UserAvatar user={currentUser} size={72} />
            </div>
            <div className="mt-2 text-xs font-extrabold text-white truncate max-w-[96px]">
              {currentUser?.username || 'You'}
            </div>
            <div
              className="mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
              style={{
                background: '#facc15',
                color: '#0a0a0a',
                border: '2px solid #ca8a04',
                letterSpacing: '0.12em',
              }}
            >
              Your move<span className="iim-dot">.</span><span className="iim-dot">.</span><span className="iim-dot">.</span>
            </div>
          </div>
        </div>

        {/* Stakes pill — coins + pot in the cartoon style. The most
            important answer to "what am I playing for?" */}
        <div className="px-5 py-3">
          <div
            className="mx-auto rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 whitespace-nowrap"
            style={{
              background: '#0f1424',
              border: '2px solid #3b82f6',
              maxWidth: 380,
            }}
          >
            <span style={{ fontSize: 22 }} aria-hidden="true">🏆</span>
            <span className="text-white font-extrabold text-sm md:text-base" style={{ letterSpacing: '0.02em' }}>
              <span style={{ color: '#facc15' }}>{buyInLabel}</span>
              <span className="text-gray-400 mx-1.5">·</span>
              <span style={{ color: '#facc15' }}>{potLabel}</span>
            </span>
            <span style={{ fontSize: 22 }} aria-hidden="true">🪙</span>
          </div>
        </div>

        {/* Incentive strip — three short reasons to tap Accept. Replaces
            the old "Accept to drop straight into the match" rules block
            with a more energetic, reward-flavored read. */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#1a0b0b', border: '2px solid #ef4444' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">⚔️</span>
              <div className="text-[8.5px] font-extrabold uppercase text-red-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                Instant Battle
              </div>
            </div>
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#1a1505', border: '2px solid #facc15' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">⭐</span>
              <div className="text-[8.5px] font-extrabold uppercase text-yellow-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                +50 XP Bonus
              </div>
            </div>
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#052016', border: '2px solid #10b981' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">🎯</span>
              <div className="text-[8.5px] font-extrabold uppercase text-emerald-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                Counts to Streak
              </div>
            </div>
          </div>
        </div>

        {/* Expiry meter */}
        <div className="px-5 pb-3">
          {!expired ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 whitespace-nowrap" style={{ letterSpacing: '0.12em' }}>
                Expires in
              </span>
              <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: '#1a1a1a', border: '1.5px solid #0a0a0a' }}>
                <div className="h-full" style={{ width: `${progressPct}%`, background: '#10b981' }}></div>
              </div>
              <span className="text-[11px] font-extrabold text-white whitespace-nowrap">
                {formatCountdown(remainingSec)}
              </span>
            </div>
          ) : (
            <p className="text-yellow-400 text-sm text-center font-bold">This invite has expired.</p>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 bg-red-500/10 border-2 border-red-500/40 rounded-xl p-2.5 text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* CTAs */}
        <div className="px-5 pb-5">
          {!expired ? (
            <>
              <button
                onClick={handleAccept}
                disabled={!!busy}
                className="iim-accept-pulse no-hover-effect w-full py-4 rounded-2xl font-black text-lg uppercase flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  background: '#10b981',
                  border: '2.5px solid #047857',
                  color: '#fff',
                  letterSpacing: '0.08em',
                  boxShadow: '0 4px 0 #064e3b',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {busy === 'accept' ? (
                  <>Loading…</>
                ) : (
                  <>
                    <span aria-hidden="true">⚔️</span>
                    Accept &amp; Battle
                  </>
                )}
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={handleDecline}
                  disabled={!!busy}
                  className="no-hover-effect py-3 rounded-xl font-extrabold text-sm uppercase disabled:opacity-60"
                  style={{
                    background: '#1a1a1a',
                    border: '2px solid #0a0a0a',
                    color: '#9ca3af',
                    letterSpacing: '0.08em',
                  }}
                >
                  {busy === 'decline' ? '...' : 'Decline'}
                </button>
                <button
                  onClick={close}
                  disabled={!!busy}
                  className="no-hover-effect py-3 rounded-xl font-extrabold text-sm uppercase disabled:opacity-60"
                  style={{
                    background: 'transparent',
                    border: '2px solid #1a1a1a',
                    color: '#6b7280',
                    letterSpacing: '0.08em',
                  }}
                >
                  Decide later
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={close}
              className="no-hover-effect w-full py-3 rounded-xl font-extrabold text-sm uppercase"
              style={{
                background: '#1a1a1a',
                border: '2px solid #0a0a0a',
                color: '#fff',
                letterSpacing: '0.08em',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
