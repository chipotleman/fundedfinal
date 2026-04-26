import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';
import UserAvatar from '../UserAvatar';
import FriendRequestCard from './FriendRequestCard';

export default function GlobalToastContainer() {
  const ctx = useNotifications();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  const toasts = ctx?.toasts || [];
  if (toasts.length === 0) return null;

  return ReactDOM.createPortal(
    <div
      data-toast-stack="true"
      className="fixed z-[80] flex flex-col gap-2 pointer-events-none toast-stack"
      style={{
        top: 'calc(var(--top-nav-height, 70px) + 12px)',
        left: 12,
        right: 12,
        maxWidth: 360,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} ctx={ctx} router={router} />
        </div>
      ))}
      <style>{`
        @keyframes notifSlideIn {
          from { transform: translateY(-120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          .toast-stack {
            margin-left: auto !important;
            margin-right: 0 !important;
          }
          @keyframes notifSlideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

function Avatar({ sender }) {
  return (
    <div className="flex-shrink-0">
      <UserAvatar
        user={{ id: sender?.id, username: sender?.username, avatar: sender?.avatar }}
        frameId={sender?.equippedFrame}
        size={40}
      />
    </div>
  );
}

function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-gray-400 hover:text-white text-xl leading-none px-1"
      aria-label="Dismiss"
    >×</button>
  );
}

function Toast({ toast, ctx, router }) {
  const [busy, setBusy] = useState(null);
  const sender = toast.sender || {};
  const baseStyle = {
    animation: 'notifSlideIn 0.3s ease-out',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
  };

  const wrap = async (label, fn) => {
    setBusy(label);
    try { await fn(); } finally { setBusy(null); }
  };

  // Incoming 1v1 battle invites are now surfaced via the full-screen
  // IncomingInviteModal mounted globally in _app.js — see task #264.
  // Explicitly bail out so any legacy invite toast that slips through
  // is silently swallowed instead of rendering an empty wrapper.
  if (toast.type === 'invite') return null;

  if (toast.type === 'friend_request') {
    return (
      <div style={baseStyle}>
        <FriendRequestCard
          sender={sender}
          context={toast.payload?.context}
          busy={!!busy}
          compact
          onAccept={() => wrap('accept', async () => {
            await ctx.acceptFriend(toast.payload.id);
            ctx.dismissToast(toast.id);
          })}
          onDecline={() => wrap('decline', async () => {
            await ctx.declineFriend(toast.payload.id);
            ctx.dismissToast(toast.id);
          })}
          onDismiss={() => ctx.dismissToast(toast.id)}
        />
      </div>
    );
  }

  if (toast.type === 'achievement') {
    const ach = toast.payload || {};
    return (
      <div
        className="bg-gradient-to-r from-yellow-900/95 to-amber-800/95 border border-yellow-500/60 rounded-xl p-3"
        style={baseStyle}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-400/50 flex items-center justify-center flex-shrink-0 text-2xl">
            {ach.icon || '🏆'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-yellow-200 text-[10px] uppercase tracking-wider font-bold">
              Achievement Unlocked
            </div>
            <div className="text-white text-sm font-bold truncate">
              {ach.name || 'New badge'}
            </div>
            {ach.description ? (
              <div className="text-yellow-100/80 text-xs truncate">{ach.description}</div>
            ) : null}
          </div>
          <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
        </div>
      </div>
    );
  }

  if (toast.type === 'invite_ended') {
    const reason = toast.payload?.reason;
    const name = sender.username || 'Your friend';
    let title;
    let subtitle;
    if (reason === 'declined') {
      title = `${name} declined your battle invite`;
      subtitle = 'They passed on this one.';
    } else if (reason === 'cancelled') {
      title = 'Battle invite cancelled';
      subtitle = `Your invite to ${name} was cancelled.`;
    } else {
      title = 'Your battle invite expired';
      subtitle = `${name} didn\u2019t respond in time.`;
    }
    return (
      <div
        className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 border border-slate-500/50 rounded-xl p-3"
        style={baseStyle}
      >
        <div className="flex items-center gap-3">
          <Avatar sender={sender} />
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">{title}</div>
            <div className="text-gray-300 text-xs">{subtitle}</div>
          </div>
          <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
        </div>
      </div>
    );
  }

  if (toast.type === 'message') {
    return (
      <MessageToast toast={toast} ctx={ctx} router={router} baseStyle={baseStyle} />
    );
  }

  if (toast.type === 'rematch') {
    const matchupId = toast.payload?.matchupId;
    return (
      <div
        className="bg-gradient-to-r from-emerald-900/95 to-teal-800/95 border border-emerald-500/50 rounded-xl p-3"
        style={baseStyle}
      >
        <div className="flex items-center gap-3">
          <Avatar sender={sender} />
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">
              {sender.username || 'Opponent'} wants a rematch
            </div>
            <div className="text-gray-300 text-xs truncate">
              Tap view to accept or decline
            </div>
          </div>
          <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            disabled={!!busy || !matchupId}
            onClick={() => wrap('view', async () => {
              ctx.dismissToast(toast.id);
              if (matchupId) {
                router.push(`/battle?result=${encodeURIComponent(matchupId)}&rematch=1`);
              }
            })}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'view' ? '…' : 'View'}</button>
          <button
            disabled={!!busy || !matchupId}
            onClick={() => wrap('decline', async () => {
              ctx.dismissToast(toast.id);
              if (matchupId) await ctx.declineRematch(matchupId);
            })}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'decline' ? '…' : 'Decline'}</button>
        </div>
      </div>
    );
  }

  return null;
}

function MessageToast({ toast, ctx, router, baseStyle }) {
  const sender = toast.sender || {};
  const preview = toast.payload?.preview || '';
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(false);
  const inputElRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const wasTypingRef = useRef(false);

  useEffect(() => {
    if (expanded) inputElRef.current?.focus();
  }, [expanded]);

  // If the toast unmounts (auto-dismiss, manual dismiss, collapse) while the
  // user was mid-composition, tell the friend we stopped typing so their
  // indicator clears immediately instead of lingering for the full TTL.
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  useEffect(() => {
    return () => {
      if (wasTypingRef.current && sender.id) {
        ctxRef.current?.notifyStoppedTyping?.(sender.id);
        wasTypingRef.current = false;
      }
    };
  }, [sender.id]);

  // Suppress further toasts for this conversation while expanded so a fast
  // back-and-forth doesn't stack new toasts on top of the open reply.
  useEffect(() => {
    if (!expanded || !sender.id) return undefined;
    const key = `message:${sender.id}`;
    ctx.setSuppress?.(key, true);
    return () => ctx.setSuppress?.(key, false);
  }, [expanded, sender.id, ctx]);

  const handleChange = (e) => {
    const v = e.target.value;
    const prev = reply;
    setReply(v);
    if (!sender.id) return;
    if (!v.trim()) {
      if (prev.trim() && wasTypingRef.current) {
        ctx.notifyStoppedTyping?.(sender.id);
        wasTypingRef.current = false;
        lastTypingSentRef.current = 0;
      }
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    wasTypingRef.current = true;
    ctx.notifyTyping?.(sender.id);
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = reply.trim();
    if (!text || !sender.id || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: sender.id, content: text }),
      });
      if (!res.ok) {
        setSendError(res.status === 403 ? 'You can only message friends.' : 'Could not send.');
        return;
      }
      // Mark this conversation read so the bell badge clears.
      ctx.markMessagesRead?.([sender.id]);
      setReply('');
      // Sending ends the typing session — tell the friend immediately so
      // their indicator clears instead of lingering for the full TTL.
      if (wasTypingRef.current) {
        ctx.notifyStoppedTyping?.(sender.id);
        wasTypingRef.current = false;
      }
      lastTypingSentRef.current = 0;
      setSent(true);
      setTimeout(() => ctx.dismissToast(toast.id), 1200);
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="bg-gradient-to-r from-emerald-900/95 to-emerald-800/95 border border-emerald-500/50 rounded-xl p-3"
      style={baseStyle}
    >
      <div className="flex items-center gap-3">
        <Avatar sender={sender} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">{sender.username || 'Someone'}</div>
          <div className="text-gray-300 text-xs truncate">{preview}</div>
        </div>
        <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
      </div>

      {!expanded && !sent && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              setExpanded(true);
              if (sender.id) ctx.markMessagesRead?.([sender.id]);
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 rounded-lg"
          >Reply</button>
          <button
            onClick={() => {
              ctx.dismissToast(toast.id);
              router.push(`/notifications?chat=${sender.id}`);
            }}
            className="px-3 bg-emerald-900/60 hover:bg-emerald-900/80 text-emerald-100 text-xs font-medium py-1.5 rounded-lg"
            title="Open full chat"
          >Open</button>
        </div>
      )}

      {expanded && !sent && (
        <form onSubmit={handleSend} className="mt-2">
          <div className="flex gap-2">
            <input
              ref={inputElRef}
              type="text"
              value={reply}
              onChange={handleChange}
              placeholder="Reply…"
              className="flex-1 min-w-0 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-300 placeholder-emerald-200/60"
              maxLength={1000}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
            >{sending ? '…' : 'Send'}</button>
          </div>
          {sendError && (
            <div className="text-red-300 text-[11px] mt-1">{sendError}</div>
          )}
        </form>
      )}

      {sent && (
        <div className="mt-2 text-emerald-200 text-xs font-semibold">
          Reply sent ✓
        </div>
      )}
    </div>
  );
}
