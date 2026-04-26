import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useSession } from 'next-auth/react';

const INVITE_EXPIRY_HOURS = 24;

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

  // Esc-to-dismiss — wired to window so it fires regardless of which
  // element currently holds focus when the modal opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        ctx.dismissIncomingInvite?.(invite.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, invite?.id, ctx]);

  if (!isOpen) return null;

  const cardBg = '#0d0d0d';
  const cardBorder = '#1a1a1a';
  const textPrimary = '#fff';
  const textSecondary = '#9ca3af';
  const textMuted = '#6b7280';
  const elevatedBg = '#111';

  const sender = invite.sender || {};
  const buyIn = parseFloat(invite.buyIn) || 0;
  const pot = buyIn * 2;
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
      ctx.dismissIncomingInvite?.(invite.id);
      if (data) {
        router.push('/?battleStarted=true');
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
      onClick={close}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iim-title"
        className="rounded-2xl max-w-md w-full max-h-[88vh] overflow-hidden flex flex-col iim-slide-in my-auto"
        style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
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
          @keyframes iimPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); transform: scale(1); }
            50% { box-shadow: 0 0 0 10px rgba(34,197,94,0), 0 0 32px rgba(34,197,94,0.45); transform: scale(1.04); }
          }
          @keyframes iimShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes iimDots {
            0%, 20% { opacity: 0.2; }
            50% { opacity: 1; }
            80%, 100% { opacity: 0.2; }
          }
          .iim-slide-in { animation: iimSlideIn 0.25s ease-out; }
          .iim-bounce-in { animation: iimBounceIn 0.4s ease-out; }
          .iim-fade-in { animation: iimSlideIn 0.3s ease-out; }
          .iim-pulse-avatar { animation: iimPulse 1.8s ease-in-out infinite; border-radius: 9999px; }
          .iim-shimmer {
            background: linear-gradient(90deg, rgba(34,197,94,0) 0%, rgba(34,197,94,0.55) 50%, rgba(34,197,94,0) 100%);
            background-size: 200% 100%;
            animation: iimShimmer 1.6s linear infinite;
          }
          .iim-dot { display: inline-block; animation: iimDots 1.4s infinite; }
          .iim-dot:nth-child(2) { animation-delay: 0.2s; }
          .iim-dot:nth-child(3) { animation-delay: 0.4s; }
        `}</style>

        <div className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="iim-title" className="text-lg font-bold" style={{ color: textPrimary }}>Play a Friend</h2>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>Someone challenged you to a 1v1 battle</p>
            </div>
            <button
              aria-label="Close"
              onClick={close}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: elevatedBg }}
            >
              <svg className="w-4 h-4" style={{ color: textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 pt-2 text-center iim-fade-in">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: textMuted }}>
            Incoming Challenge
          </div>

          <div className="flex items-center justify-center gap-2 mb-4 iim-bounce-in">
            <div className="flex flex-col items-center" style={{ width: 96 }}>
              <div className="iim-pulse-avatar rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                <div className="rounded-full" style={{ background: cardBg, padding: 2 }}>
                  <UserAvatar
                    user={{ id: sender.id, username: sender.username, avatar: sender.avatar, frameId: sender.equippedFrame }}
                    size={72}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs font-bold truncate max-w-[88px]" style={{ color: textPrimary }}>
                {sender.username || 'A friend'}
              </div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: '#22c55e' }}>Ready</div>
            </div>

            <div className="flex flex-col items-center px-1">
              <div className="text-2xl font-black italic" style={{ color: textPrimary, textShadow: '0 0 12px rgba(255,255,255,0.25)' }}>VS</div>
            </div>

            <div className="flex flex-col items-center" style={{ width: 96 }}>
              <div className="rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg,#22c55e,#3b82f6)' }}>
                <div className="rounded-full" style={{ background: cardBg, padding: 2 }}>
                  <UserAvatar user={currentUser} size={72} />
                </div>
              </div>
              <div className="mt-2 text-xs font-bold truncate max-w-[88px]" style={{ color: textPrimary }}>
                {currentUser?.username || 'You'}
              </div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                Your move<span className="iim-dot">.</span><span className="iim-dot">.</span><span className="iim-dot">.</span>
              </div>
            </div>
          </div>

          <h3 className="font-bold text-base" style={{ color: textPrimary }}>
            ${buyIn} buy-in · ${pot} pot{invite.duration ? ` · ${invite.duration}h` : ''}
          </h3>

          <div className="mt-4 rounded-xl p-3 text-left space-y-2" style={{ backgroundColor: elevatedBg, border: `1px solid ${cardBorder}` }}>
            <div className="flex items-start gap-2">
              <span className="text-sm leading-none mt-0.5">⚔️</span>
              <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                Accept to drop straight into the match.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm leading-none mt-0.5">👋</span>
              <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                Decline to pass on this challenge.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm leading-none mt-0.5">⏳</span>
              <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                You can also close this and respond later from the bell.
              </p>
            </div>
          </div>

          {!expired ? (
            <div className="mt-4">
              <div className="w-full rounded-full h-1.5 mb-2 overflow-hidden" style={{ backgroundColor: elevatedBg }}>
                <div className="iim-shimmer h-1.5 rounded-full" style={{ width: `${progressPct}%`, background: '#22c55e' }}></div>
              </div>
              <p className="text-xs" style={{ color: textMuted }}>Invite expires in {formatCountdown(remainingSec)}</p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-yellow-400 text-sm">This invite has expired.</p>
            </div>
          )}

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-xs iim-fade-in">{error}</div>
          )}

          {!expired ? (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAccept}
                disabled={!!busy}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {busy === 'accept' ? '...' : 'Accept'}
              </button>
              <button
                onClick={handleDecline}
                disabled={!!busy}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {busy === 'decline' ? '...' : 'Decline'}
              </button>
            </div>
          ) : (
            <button
              onClick={close}
              className="mt-4 w-full font-semibold text-sm py-3 rounded-xl transition-colors"
              style={{ backgroundColor: elevatedBg, color: textPrimary, border: `1px solid ${cardBorder}` }}
            >
              Close
            </button>
          )}

          <button
            onClick={close}
            className="mt-2 w-full font-medium text-xs py-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: 'transparent', color: textMuted, border: `1px solid ${cardBorder}` }}
          >
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
}
