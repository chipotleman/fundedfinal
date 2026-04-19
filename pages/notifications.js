import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import { isUserOnline } from '../components/ActiveStatus';
import MessagesPanel from '../components/messages/MessagesPanel';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function Avatar({ user, size = 40, isOnline = false, onlineDotBorderColor = '#0a0a0a' }) {
  const initial = (user?.username || user?.name || '?')[0]?.toUpperCase();
  const dotSize = Math.max(8, Math.round(size * 0.26));
  const dotBorder = Math.max(1, Math.round(size * 0.05));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="rounded-full bg-gray-700 flex items-center justify-center overflow-hidden w-full h-full">
        {user?.avatar ? (
          <img src={user.avatar} className="w-full h-full object-cover" alt="" />
        ) : (
          <span className="text-sm font-bold text-white">{initial}</span>
        )}
      </div>
      {isOnline && (
        <span
          aria-label="Active now"
          title="Active now"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: '9999px',
            background: '#22c55e',
            border: `${dotBorder}px solid ${onlineDotBorderColor}`,
            boxSizing: 'border-box',
            boxShadow: '0 0 6px rgba(34,197,94,0.5)',
          }}
        />
      )}
    </div>
  );
}

function NotificationsFeed({ ctx, router }) {
  const battleInvites = ctx.battleInvites || [];
  const friendRequests = ctx.friendRequests || [];
  const [busyId, setBusyId] = useState(null);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const totalNew = battleInvites.length + friendRequests.length;
  const empty = totalNew === 0;

  const cardBg = '#0a0a0a';
  const cardBorder = 'rgba(16,185,129,0.22)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const accent = '#34d399';
  const cardShadow = '0 0 0 1px rgba(16,185,129,0.08), 0 8px 32px -8px rgba(16,185,129,0.18)';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <span
          className="text-sm font-bold tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Notifications
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: accent,
            backgroundColor: 'rgba(16,185,129,0.10)',
            border: `1px solid rgba(16,185,129,0.25)`,
          }}
        >
          {totalNew} new
        </span>
      </div>

      {empty && (
        <div className="px-4 py-12 text-center text-sm" style={{ color: textSecondary }}>
          You're all caught up.
        </div>
      )}

      {battleInvites.length > 0 && (
        <div>
          <div
            className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: textSecondary }}
          >
            Battle Invites
          </div>
          {battleInvites.map((inv) => {
            const buyIn = parseFloat(inv.buyIn) || 0;
            return (
              <div
                key={inv.id}
                className="px-4 py-3 flex items-start gap-3"
                style={{ borderTop: `1px solid ${cardBorder}` }}
              >
                <Avatar user={inv.sender} isOnline={inv.sender?.isOnline ?? isUserOnline(inv.sender?.lastSeenAt)} onlineDotBorderColor={cardBg} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                    {inv.sender?.username || 'Someone'} challenged you
                  </div>
                  <div className="text-xs" style={{ color: textSecondary }}>
                    ${buyIn} buy-in · ${buyIn * 2} pot{inv.duration ? ` · ${inv.duration}h` : ''}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, async () => {
                        const data = await ctx.acceptInvite(inv.id);
                        if (data) router.push('/?battleStarted=true');
                      })}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-shadow"
                      style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
                    >Accept</button>
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, () => ctx.declineInvite(inv.id))}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                    >Decline</button>
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: textSecondary }}>
                  {timeAgo(inv.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {friendRequests.length > 0 && (
        <div>
          <div
            className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: textSecondary }}
          >
            Friend Requests
          </div>
          {friendRequests.map((fr) => (
            <div
              key={fr.id}
              className="px-4 py-3 flex items-start gap-3"
              style={{ borderTop: `1px solid ${cardBorder}` }}
            >
              <Avatar user={fr.sender} isOnline={fr.sender?.isOnline ?? isUserOnline(fr.sender?.lastSeenAt)} onlineDotBorderColor={cardBg} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  {fr.sender?.username || 'Someone'} wants to be friends
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, () => ctx.acceptFriend(fr.id))}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
                  >Accept</button>
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, () => ctx.declineFriend(fr.id))}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                  >Decline</button>
                </div>
              </div>
              <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: textSecondary }}>
                {timeAgo(fr.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();

  const [selectedId, setSelectedId] = useState(null);

  const myId = session?.user?.id;
  const isAuthed = status === 'authenticated';
  const unreadCount = ctx.counts?.unreadMessages || 0;

  // ?chat=<id> deep link → forward to /messenger so the dedicated experience
  // takes the user straight into the conversation.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (chatId && typeof chatId === 'string') {
      router.replace(`/messenger?chat=${chatId}`);
    }
  }, [router.isReady, router.query.chat]);

  useEffect(() => {
    if (!isAuthed || !selectedId) return;
    const hasUnread = (ctx.unreadMessages || []).some((m) => m.sender?.id === selectedId);
    if (hasUnread) {
      ctx.markMessagesRead([selectedId]);
    }
  }, [isAuthed, selectedId, ctx.unreadMessages?.length]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const bg = '#000000';
  const pageBg = 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(16,185,129,0.10), transparent 70%), radial-gradient(ellipse 60% 35% at 100% 100%, rgba(34,211,238,0.06), transparent 70%), #000000';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';

  if (status === 'loading') {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar />
        <div className="max-w-md mx-auto mt-20 px-4 text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: textPrimary }}>
            Sign in to see notifications
          </h1>
          <p className="text-sm" style={{ color: textSecondary }}>
            Battle invites and friend requests live here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: '100vh' }}>
      <TopNavbar />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <h1
          className="text-xl sm:text-2xl font-bold mb-4 tracking-tight"
          style={{
            background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Notifications
        </h1>

        {/* Desktop: alerts main (left) + messages side container (right).
            Mobile: alerts on top, messages stacked below in their own
            clearly-labeled container. Each panel scrolls independently. */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <NotificationsFeed ctx={ctx} router={router} />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2 md:hidden">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                Messages {unreadCount > 0 && (
                  <span className="ml-1 text-emerald-400">({unreadCount})</span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => router.push('/messenger')}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Open messenger →
              </button>
            </div>
            <MessagesPanel
              selectedId={selectedId}
              onSelect={handleSelect}
              ctx={ctx}
              myId={myId}
              minHeight={520}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
