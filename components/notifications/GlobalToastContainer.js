import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';

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
  const initial = (sender?.username || '?')[0]?.toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
      {sender?.avatar ? (
        <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
      ) : (
        <span className="text-sm font-bold text-white">{initial}</span>
      )}
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

  if (toast.type === 'invite') {
    const buyIn = parseFloat(toast.payload?.buyIn) || 0;
    const duration = toast.payload?.duration;
    return (
      <div
        className="bg-gradient-to-r from-blue-900/95 to-blue-800/95 border border-blue-500/50 rounded-xl p-3"
        style={baseStyle}
      >
        <div className="flex items-center gap-3">
          <Avatar sender={sender} />
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">
              {sender.username || 'Someone'} challenges you!
            </div>
            <div className="text-gray-300 text-xs">
              ${buyIn} buy-in · ${buyIn * 2} pot{duration ? ` · ${duration}h` : ''}
            </div>
          </div>
          <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            disabled={!!busy}
            onClick={() => wrap('accept', async () => {
              const data = await ctx.acceptInvite(toast.payload.id);
              ctx.dismissToast(toast.id);
              if (data) {
                router.push('/?battleStarted=true');
              }
            })}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'accept' ? '...' : 'Accept'}</button>
          <button
            disabled={!!busy}
            onClick={() => wrap('decline', async () => {
              await ctx.declineInvite(toast.payload.id);
              ctx.dismissToast(toast.id);
            })}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'decline' ? '...' : 'Decline'}</button>
        </div>
      </div>
    );
  }

  if (toast.type === 'friend_request') {
    return (
      <div
        className="bg-gradient-to-r from-purple-900/95 to-purple-800/95 border border-purple-500/50 rounded-xl p-3"
        style={baseStyle}
      >
        <div className="flex items-center gap-3">
          <Avatar sender={sender} />
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">
              {sender.username || 'Someone'} wants to be friends
            </div>
            <div className="text-gray-300 text-xs">Friend request</div>
          </div>
          <CloseBtn onClick={() => ctx.dismissToast(toast.id)} />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            disabled={!!busy}
            onClick={() => wrap('accept', async () => {
              await ctx.acceptFriend(toast.payload.id);
              ctx.dismissToast(toast.id);
            })}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'accept' ? '...' : 'Accept'}</button>
          <button
            disabled={!!busy}
            onClick={() => wrap('decline', async () => {
              await ctx.declineFriend(toast.payload.id);
              ctx.dismissToast(toast.id);
            })}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
          >{busy === 'decline' ? '...' : 'Decline'}</button>
        </div>
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

  if (toast.type === 'message') {
    const preview = toast.payload?.preview || '';
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
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              ctx.dismissToast(toast.id);
              router.push(`/notifications?chat=${sender.id}`);
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 rounded-lg"
          >Reply</button>
        </div>
      </div>
    );
  }

  return null;
}
