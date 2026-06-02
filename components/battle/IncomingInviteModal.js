import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useMatchup } from '../../contexts/MatchupContext';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import { useSession } from 'next-auth/react';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { OpponentFound, FlowCard, FlowButton } from './matchflow/MatchFlowScreens';

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
  const { refresh: refreshMatchup } = useMatchup();
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
  // Beta uses Clash Coins (compact); live mode uses the buy-in amount.
  const buyInLabel = isBeta ? `${compactCoins(buyIn)} Clash Coins` : `$${buyIn} Buy-In`;
  const potLabel = isBeta ? `Win 👑 ${compactCoins(Math.round(pot * 0.9))}` : `Win $${pot} Pot`;
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
        // Kick MatchupContext to re-fetch /api/matchups/current right now so
        // `hasActiveMatchup` hydrates before we land on /?battleStarted=true.
        // Without this the acceptor reaches the dashboard with no active
        // matchup yet, so the "How It Works" walkthrough is stuck on its
        // loading skeleton (it only renders once hasActiveMatchup && matchup
        // are true) — which is why only the inviter saw the walkthrough.
        try { refreshMatchup && refreshMatchup(); } catch (_) {}
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

  // ── Premium match-flow presentation (shared look with Quick Match) ──
  // 'you' = the current user, 'opp' = the challenger who sent the invite.
  // Only the presentation is restyled here — handleAccept / handleDecline /
  // close / navigateToBattleStart all remain exactly as defined above.
  const youPlayer = {
    id: currentUser?.id,
    name: currentUser?.username || 'You',
    avatar: currentUser?.avatar,
  };
  const oppPlayer = {
    id: sender.id,
    name: sender.username || 'A friend',
    avatar: sender.avatar,
    battleWins: sender.battleWins,
  };

  return (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iim-title"
        className="relative w-full max-w-[400px] max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-[22px] my-auto"
        style={{
          backgroundColor: '#070a14',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.14), 0 28px 64px rgba(0,0,0,0.62)',
        }}
      >
        <button
          aria-label="Close"
          onClick={close}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {expired ? (
          <FlowCard balance={buyIn} balanceLabel={buyInLabel}>
            <div className="px-6 pt-8 pb-8 text-center">
              <span aria-hidden="true" style={{ fontSize: 26 }}>⌛</span>
              <h2 id="iim-title" className="mt-1 font-black italic uppercase leading-[0.95]" style={{ fontSize: 'clamp(24px,7vw,34px)', color: '#facc15' }}>
                Invite Expired
              </h2>
              <p className="mt-2 text-[12px]" style={{ color: '#94a3b8' }}>
                {sender.username || 'This challenger'}’s invite is no longer available.
              </p>
              <div className="mt-6 max-w-[280px] mx-auto">
                <FlowButton color="dark" onClick={close}>Close</FlowButton>
              </div>
            </div>
          </FlowCard>
        ) : (
          <>
            <h2 id="iim-title" className="sr-only">
              {sender.username || 'A friend'} wants to battle
            </h2>
            <OpponentFound
              you={youPlayer}
              opp={oppPlayer}
              balance={buyIn}
              balanceLabel={buyInLabel}
              stake={buyIn}
              onAccept={handleAccept}
              onDecline={handleDecline}
              acceptLabel="Accept & Battle"
              loading={busy === 'accept'}
              loadingLabel="Joining…"
            />
            {error && (
              <div className="px-6 pb-5 -mt-2">
                <div
                  className="rounded-xl px-3 py-2.5 text-xs font-semibold text-center"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
                >
                  {error}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
