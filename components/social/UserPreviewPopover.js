import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import UserAvatar from '../UserAvatar';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';

// Cartoon site-wide profile preview. Renders as a floating card via
// portal, anchored next to the trigger element when possible (chat
// avatar, username chip, leaderboard row) and falling back to centered
// modal-style placement otherwise. Goal: let users peek at a player and
// take quick social actions (View Profile, DM, Add Friend) WITHOUT
// hijacking their current page.
const CARD_W = 320;
const CARD_MARGIN = 12;

function clampPosition(anchorRect, cardW, cardH) {
  if (typeof window === 'undefined') return { top: 80, left: 80 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!anchorRect) {
    return {
      top: Math.max(CARD_MARGIN, (vh - cardH) / 2),
      left: Math.max(CARD_MARGIN, (vw - cardW) / 2),
    };
  }
  // Try below anchor first; if it overflows, place above; if neither
  // fits comfortably, vertically center.
  let top;
  const spaceBelow = vh - anchorRect.bottom - CARD_MARGIN;
  const spaceAbove = anchorRect.top - CARD_MARGIN;
  if (spaceBelow >= cardH || spaceBelow >= spaceAbove) {
    top = Math.min(
      vh - cardH - CARD_MARGIN,
      anchorRect.bottom + 8,
    );
  } else {
    top = Math.max(CARD_MARGIN, anchorRect.top - cardH - 8);
  }
  // Horizontally align to the anchor's left, then clamp to viewport.
  let left = anchorRect.left;
  if (left + cardW + CARD_MARGIN > vw) left = vw - cardW - CARD_MARGIN;
  if (left < CARD_MARGIN) left = CARD_MARGIN;
  return { top: Math.max(CARD_MARGIN, top), left };
}

export default function UserPreviewPopover({ seedUser, anchorRect, onClose, onRequestMessage }) {
  const router = useRouter();
  const { data: session } = useSession();
  const myId = session?.user?.id;
  // Optional: warm the profile cache so /profile/[id] renders instantly
  // when the popover's View Profile button is tapped. Mirrors the
  // prefetch behavior that previously lived in goToProfile on /battle.
  const profileCache = useProfileCacheOptional();

  // Seed `friendStatus` to 'self' synchronously when the clicked user is
  // the viewer — without this the popover flashed the Add-Friend /
  // Message CTAs for one render until /api/users/:id/preview came back
  // and told us friendStatus='self'.
  const seedIsSelf = !!myId && !!seedUser?.id && seedUser.id === myId;
  const [user, setUser] = useState({
    id: seedUser?.id,
    username: seedUser?.username || 'Player',
    avatar: seedUser?.avatar || null,
    bio: null,
    battleWins: seedUser?.battleWins ?? null,
    battleLosses: seedUser?.battleLosses ?? null,
    winRate: null,
    isOnline: !!seedUser?.isOnline,
    friendStatus: seedIsSelf ? 'self' : 'none',
    canMessage: false,
  });
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState('');

  const cardRef = useRef(null);
  const [pos, setPos] = useState(() => clampPosition(anchorRect, CARD_W, 360));

  // Esc / outside click to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reposition once we know the actual rendered card height (esp. after
  // the bio/stats settle in) so we never clip off-screen.
  useEffect(() => {
    if (!cardRef.current) return;
    const h = cardRef.current.offsetHeight || 360;
    setPos(clampPosition(anchorRect, CARD_W, h));
  }, [anchorRect, user.bio, loading]);

  // Re-clamp on window resize/orientation change.
  useEffect(() => {
    const onResize = () => {
      const h = cardRef.current?.offsetHeight || 360;
      setPos(clampPosition(anchorRect, CARD_W, h));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [anchorRect]);

  // Fetch the full preview payload (relationship, bio, stats).
  useEffect(() => {
    let cancelled = false;
    if (!seedUser?.id) return undefined;
    setLoading(true);
    fetch(`/api/users/${seedUser.id}/preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        setUser((prev) => ({ ...prev, ...data.user }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [seedUser?.id]);

  const handleAddFriend = async () => {
    if (actionPending || !user.id || user.friendStatus === 'self') return;
    setActionPending(true);
    setActionError('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Self-heal: the server is the source of truth. If it rejects
        // because a relationship already exists (e.g. the preview fetch
        // 404'd and we fell back to a seeded 'none'), flip the UI to the
        // correct state instead of showing an error + a stale "Add
        // Friend" button the user can keep mashing.
        const msg = (data?.error || '').toLowerCase();
        if (msg.includes('already friends')) {
          setUser((prev) => ({ ...prev, friendStatus: 'friends', canMessage: true }));
          return;
        }
        if (msg.includes('already pending') || msg.includes('request already')) {
          setUser((prev) => ({ ...prev, friendStatus: 'pending_outgoing' }));
          return;
        }
        setActionError(data?.error || 'Could not send request');
        return;
      }
      // Optimistically reflect the new status — server may have
      // accepted (incoming pending) or just queued the outgoing one.
      const newStatus = data.status === 'accepted' ? 'friends' : 'pending_outgoing';
      setUser((prev) => ({
        ...prev,
        friendStatus: newStatus,
        canMessage: newStatus === 'friends' ? true : prev.canMessage,
      }));
    } catch (_e) {
      setActionError('Network error');
    } finally {
      setActionPending(false);
    }
  };

  const handleViewProfile = () => {
    if (profileCache && user.id) {
      profileCache.prefetchProfile(user.id, {
        id: user.id,
        username: user.username,
        avatar: user.avatar ?? null,
      });
    }
    onClose?.();
    router.push(`/profile/${user.id}`);
  };

  const handleSendDM = () => {
    if (!user.canMessage) return;
    // Hand off to the provider, which closes this popover and mounts
    // MessagePopup at the same z-layer (avoids the DM modal being
    // trapped behind this card's backdrop).
    onRequestMessage?.({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
    });
  };

  const isSelf = user.friendStatus === 'self';
  const initial = (user.username || '?').charAt(0).toUpperCase();

  // Friend-status CTA config — single source of truth so the button
  // label/color/disabled state can't drift between renders.
  const friendCta = useMemo(() => {
    switch (user.friendStatus) {
      case 'friends':
        return { label: '✓ Friends', disabled: true, tone: 'emerald' };
      case 'pending_outgoing':
        return { label: 'Request Sent', disabled: true, tone: 'cyan' };
      case 'pending_incoming':
        return { label: 'Accept Request', disabled: false, tone: 'emerald' };
      case 'self':
        return null;
      default:
        return { label: '+ Add Friend', disabled: false, tone: 'blue' };
    }
  }, [user.friendStatus]);

  const toneStyles = {
    blue:    'linear-gradient(180deg,#3b82f6,#1d4ed8)',
    emerald: 'linear-gradient(180deg,#10b981,#047857)',
    cyan:    'linear-gradient(180deg,#06b6d4,#0e7490)',
    orange:  'linear-gradient(180deg,#fb923c,#c2410c)',
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes upPopBackdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes upPopCard {
          0%   { opacity: 0; transform: translateY(6px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        data-allow-fixed-overlay="true"
        className="fixed inset-0 z-[90]"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'upPopBackdrop 0.16s ease-out',
        }}
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${user.username} profile preview`}
          onClick={(e) => e.stopPropagation()}
          className="absolute rounded-2xl text-white"
          style={{
            top: pos.top,
            left: pos.left,
            width: CARD_W,
            maxWidth: 'calc(100vw - 24px)',
            background: 'linear-gradient(180deg,#0f0f0f,#070707)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 6px 0 #0a0a0a, 0 18px 60px rgba(0,0,0,0.6)',
            animation: 'upPopCard 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Header — avatar + name + W/L + presence */}
          <div className="p-4 flex items-start gap-3">
            <button
              type="button"
              onClick={handleViewProfile}
              className="flex-shrink-0 rounded-full p-0.5 relative"
              style={{
                background: user.isOnline
                  ? 'linear-gradient(135deg,#10b981,#3b82f6)'
                  : '#1a1a1a',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
              }}
              aria-label={`View ${user.username}'s full profile`}
            >
              <div
                className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-black"
                style={{
                  background: user.avatar ? `url(${user.avatar}) center/cover` : '#1f2937',
                  border: '2px solid #0a0a0a',
                }}
              >
                {!user.avatar && (
                  <UserAvatar
                    user={{ id: user.id, username: user.username, avatar: user.avatar }}
                    size={56}
                  />
                )}
              </div>
              {user.isOnline && (
                <span
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full"
                  style={{
                    background: '#10b981',
                    border: '2px solid #0a0a0a',
                    boxShadow: '0 0 8px #10b981',
                  }}
                  aria-label="Online"
                />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleViewProfile}
                className="block text-left w-full"
              >
                <div className="text-white font-black text-base truncate leading-tight">
                  {user.username}
                </div>
                <div className="text-[11px] uppercase font-extrabold tracking-wider mt-0.5" style={{ color: user.isOnline ? '#10b981' : '#9ca3af' }}>
                  {user.isOnline ? 'Online now' : 'Offline'}
                </div>
              </button>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold"
                  style={{
                    background: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    border: '1.5px solid rgba(59,130,246,0.4)',
                  }}
                >
                  {user.battleWins ?? 0}W
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#f87171',
                    border: '1.5px solid rgba(239,68,68,0.35)',
                  }}
                >
                  {user.battleLosses ?? 0}L
                </span>
                {user.winRate !== null && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold"
                    style={{
                      background: 'rgba(251,146,60,0.14)',
                      color: '#fdba74',
                      border: '1.5px solid rgba(251,146,60,0.35)',
                    }}
                  >
                    {user.winRate}% WR
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Bio */}
          {user.bio ? (
            <div
              className="mx-4 mb-3 rounded-xl px-3 py-2 text-[12px] text-gray-300 leading-snug"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
            >
              {user.bio.length > 160 ? `${user.bio.slice(0, 160)}…` : user.bio}
            </div>
          ) : null}

          {/* Actions */}
          <div className="px-4 pb-4 space-y-2">
            {!isSelf && friendCta && (
              <button
                type="button"
                onClick={handleAddFriend}
                disabled={friendCta.disabled || actionPending || loading || !myId}
                className="w-full py-2.5 rounded-xl font-extrabold text-white uppercase text-[12px] disabled:opacity-60 transition-transform active:scale-[0.98]"
                style={{
                  background: toneStyles[friendCta.tone],
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 3px 0 #0a0a0a',
                  letterSpacing: '0.12em',
                }}
              >
                {actionPending ? 'Working…' : friendCta.label}
              </button>
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={handleSendDM}
                disabled={!user.canMessage || !myId}
                title={user.canMessage ? 'Send a direct message' : 'Add as friend to message'}
                className="w-full py-2.5 rounded-xl font-extrabold text-white uppercase text-[12px] disabled:opacity-50 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 3px 0 #0a0a0a',
                  letterSpacing: '0.12em',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Send Message
              </button>
            )}
            <button
              type="button"
              onClick={handleViewProfile}
              className="w-full py-2.5 rounded-xl font-extrabold text-white uppercase text-[12px] transition-transform active:scale-[0.98]"
              style={{
                background: 'linear-gradient(180deg,#fb923c,#c2410c)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
                letterSpacing: '0.12em',
              }}
            >
              View Full Profile →
            </button>
            {actionError && (
              <div className="text-[11px] text-red-400 text-center">{actionError}</div>
            )}
            {!myId && (
              <div className="text-[10px] text-gray-500 text-center">Sign in to interact</div>
            )}
            {loading && !user.bio && user.friendStatus === 'none' && (
              <div className="text-[10px] text-gray-600 text-center" aria-hidden="true">·</div>
            )}
          </div>
        </div>
      </div>

    </>,
    document.body,
  );
}
