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
// Colors are the canonical social-battle-flow identity (see the
// --sbf-* tokens in styles/globals.css): RUSH amber, ORIGINAL blue,
// TOURNAMENT violet — applied consistently across every invite surface.
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
    color: '#8b5cf6',
    tagline: '3-day grind for a massive bankroll',
    durationLabel: '3-day battle',
  },
};

function modeMetaFor(n) {
  return MODE_META[n] || MODE_META.original;
}

// Parse a hex color to {r,g,b} so we can build mode-tinted rings, glows,
// and fills inline without a second source of truth for the palette.
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full || '3b82f6', 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
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

  // Mode-tinted helpers — one accent (the mode color) used for the ring,
  // hairline glows, and the progress meter. Everything else stays calm.
  const rgb = hexToRgb(mode.color);
  const tint = (a) => `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;

  return (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iim-title"
        className="iim-card relative w-full max-w-[400px] max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-[22px] my-auto"
        style={{
          backgroundColor: 'var(--sbf-surface, #0d0d0d)',
          border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px ${tint(0.14)}, 0 28px 64px rgba(0,0,0,0.62)`,
        }}
      >
        <style jsx>{`
          @keyframes iimCardIn {
            0% { opacity: 0; transform: translateY(14px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes iimRise {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes iimSheen {
            0% { transform: translateX(-130%) skewX(-18deg); }
            100% { transform: translateX(230%) skewX(-18deg); }
          }
          @keyframes iimDots {
            0%, 20% { opacity: 0.25; }
            50% { opacity: 1; }
            80%, 100% { opacity: 0.25; }
          }
          .iim-card { animation: iimCardIn 0.26s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .iim-rise { animation: iimRise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .iim-accept { position: relative; overflow: hidden; transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease; }
          .iim-accept:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #064e3b, 0 6px 16px rgba(16,185,129,0.32); }
          .iim-accept::after {
            content: '';
            position: absolute; top: 0; left: 0; width: 40%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent);
            animation: iimSheen 2.6s ease-in-out infinite;
            pointer-events: none;
          }
          .iim-press { transition: transform 0.12s ease, filter 0.12s ease, background-color 0.15s ease; }
          .iim-press:active:not(:disabled) { transform: translateY(1px); }
          .iim-dot { display: inline-block; animation: iimDots 1.4s infinite; }
          .iim-dot:nth-child(2) { animation-delay: 0.2s; }
          .iim-dot:nth-child(3) { animation-delay: 0.4s; }
          @media (prefers-reduced-motion: reduce) {
            .iim-card, .iim-rise { animation: none; }
            .iim-accept::after { animation: none; opacity: 0; }
            .iim-dot { animation: none; opacity: 0.8; }
          }
        `}</style>

        {/* Mode-colored top accent — premium identity line, not a glow. */}
        <div
          aria-hidden="true"
          style={{ height: 3, background: `linear-gradient(90deg, transparent, ${mode.color}, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <div
              className="text-[10px] font-extrabold uppercase"
              style={{ color: mode.color, letterSpacing: '0.22em' }}
            >
              Incoming Challenge
            </div>
            <h2 id="iim-title" className="mt-1 text-[17px] font-extrabold leading-tight text-white truncate">
              {sender.username || 'A friend'}
              <span className="font-semibold" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}> wants to battle</span>
            </h2>
          </div>
          <button
            aria-label="Close"
            onClick={close}
            className="iim-press shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--sbf-surface-2, #141414)', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))' }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--sbf-text-dim, #a1a1aa)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode + duration — one clean market chip, the headline answer to
            "what kind of game?". Replaces the old loud tri-band. */}
        <div className="px-5">
          <div
            className="iim-rise flex items-center gap-3 rounded-2xl px-3 py-2.5"
            style={{ background: 'var(--sbf-surface-2, #141414)', border: `1px solid ${tint(0.5)}` }}
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ width: 38, height: 38, background: tint(0.16), border: `1px solid ${tint(0.55)}`, fontSize: 20 }}
              aria-hidden="true"
            >
              {mode.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: mode.color }}>{mode.label}</span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--sbf-text-dim, #a1a1aa)', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))' }}
                >
                  {durationLabel}
                </span>
              </div>
              <div className="text-[11px] mt-0.5 leading-snug truncate" style={{ color: 'var(--sbf-text-dim, #a1a1aa)' }}>
                {mode.tagline}
              </div>
            </div>
          </div>
        </div>

        {/* VS hero — clean avatars, mode-ringed challenger vs accent-ringed you. */}
        <div className="iim-rise flex items-center justify-center gap-4 px-5 pt-4 pb-1">
          <div className="flex flex-col items-center" style={{ width: 96 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{ width: 76, height: 76, border: `2.5px solid ${mode.color}`, boxShadow: `0 0 0 4px ${tint(0.14)}` }}
            >
              <UserAvatar
                user={{ id: sender.id, username: sender.username, avatar: sender.avatar, frameId: sender.equippedFrame }}
                size={70}
              />
            </div>
            <div className="mt-2 text-[12px] font-bold text-white truncate max-w-[92px]">{sender.username || 'A friend'}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--sbf-win, #22c55e)' }}>Ready</div>
          </div>

          <div className="flex flex-col items-center px-1">
            <div className="text-2xl font-black italic" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>VS</div>
          </div>

          <div className="flex flex-col items-center" style={{ width: 96 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{ width: 76, height: 76, border: '2.5px solid var(--sbf-accent, #3b82f6)', boxShadow: '0 0 0 4px rgba(59,130,246,0.14)' }}
            >
              <UserAvatar user={currentUser} size={70} />
            </div>
            <div className="mt-2 text-[12px] font-bold text-white truncate max-w-[92px]">{currentUser?.username || 'You'}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--sbf-accent, #3b82f6)' }}>
              Your move<span className="iim-dot">.</span><span className="iim-dot">.</span><span className="iim-dot">.</span>
            </div>
          </div>
        </div>

        {/* Stakes — sportsbook-clean tabular readout (buy-in · pot). */}
        <div className="px-5 pt-3">
          <div
            className="flex items-stretch rounded-2xl overflow-hidden"
            style={{ background: 'var(--sbf-surface-2, #141414)', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))' }}
          >
            <div className="flex-1 px-3 py-2.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>
                {isBeta ? 'Entry' : 'Buy-In'}
              </div>
              <div className="text-[15px] font-black tabular-nums mt-0.5" style={{ color: 'var(--sbf-text, #fafafa)' }}>{buyInLabel}</div>
            </div>
            <div style={{ width: 1, background: 'var(--sbf-hairline, rgba(255,255,255,0.08))' }} aria-hidden="true" />
            <div className="flex-1 px-3 py-2.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>Payout</div>
              <div className="text-[15px] font-black tabular-nums mt-0.5" style={{ color: 'var(--sbf-money, #facc15)' }}>{potLabel}</div>
            </div>
          </div>
        </div>

        {/* Incentive strip — calm, single muted row (content preserved). */}
        <div className="px-5 pt-3">
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sbf-text-dim, #a1a1aa)' }}>
            <span className="inline-flex items-center gap-1"><span aria-hidden="true">⚔️</span> Instant battle</span>
            <span aria-hidden="true" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>·</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden="true">⭐</span> +50 XP</span>
            <span aria-hidden="true" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>·</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden="true">🎯</span> Streak</span>
          </div>
        </div>

        {/* Expiry meter — slim, mode-colored. */}
        <div className="px-5 pt-3">
          {!expired ? (
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] whitespace-nowrap" style={{ color: 'var(--sbf-text-mute, #6b7280)' }}>
                Expires in
              </span>
              <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: mode.color, transition: 'width 0.9s linear' }} />
              </div>
              <span className="text-[11px] font-extrabold tabular-nums whitespace-nowrap text-white">{formatCountdown(remainingSec)}</span>
            </div>
          ) : (
            <p className="text-center text-sm font-bold" style={{ color: 'var(--sbf-money, #facc15)' }}>This invite has expired.</p>
          )}
        </div>

        {error && (
          <div
            className="mx-5 mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-center"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        {/* CTAs */}
        <div className="px-5 pt-4 pb-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
          {!expired ? (
            <>
              <button
                onClick={handleAccept}
                disabled={!!busy}
                className="iim-accept w-full py-3.5 rounded-2xl font-black text-[15px] uppercase flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                  border: '1px solid rgba(0,0,0,0.4)',
                  color: '#fff',
                  letterSpacing: '0.06em',
                  boxShadow: '0 4px 0 #064e3b, 0 10px 24px rgba(16,185,129,0.30)',
                }}
              >
                {busy === 'accept' ? (
                  <span className="relative z-10">Joining…</span>
                ) : (
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <span aria-hidden="true">⚔️</span> Accept &amp; Battle
                  </span>
                )}
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <button
                  onClick={handleDecline}
                  disabled={!!busy}
                  className="iim-press py-2.5 rounded-xl font-bold text-[13px] uppercase tracking-wide disabled:opacity-60"
                  style={{ background: 'var(--sbf-surface-2, #141414)', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))', color: 'var(--sbf-text-dim, #a1a1aa)' }}
                >
                  {busy === 'decline' ? '…' : 'Decline'}
                </button>
                <button
                  onClick={close}
                  disabled={!!busy}
                  className="iim-press py-2.5 rounded-xl font-bold text-[13px] uppercase tracking-wide disabled:opacity-60"
                  style={{ background: 'transparent', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))', color: 'var(--sbf-text-mute, #6b7280)' }}
                >
                  Decide later
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={close}
              className="iim-press w-full py-3 rounded-xl font-bold text-[13px] uppercase tracking-wide"
              style={{ background: 'var(--sbf-surface-2, #141414)', border: '1px solid var(--sbf-hairline, rgba(255,255,255,0.08))', color: 'var(--sbf-text, #fafafa)' }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
