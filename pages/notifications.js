import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import { isUserOnline } from '../components/ActiveStatus';
import UserAvatar, { UserNameLink } from '../components/UserAvatar';

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

function Avatar(props) {
  return <UserAvatar {...props} link />;
}

function NotificationsFeed({ ctx, router }) {
  const battleInvites = ctx.battleInvites || [];
  const friendRequests = ctx.friendRequests || [];
  const gameResults = ctx.gameResults || [];
  const [busyId, setBusyId] = useState(null);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const totalNew = battleInvites.length + friendRequests.length + gameResults.length;
  const empty = totalNew === 0;

  const cardBg = '#0a0a0a';
  const cardBorder = 'rgba(59,130,246,0.22)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const accent = '#3b82f6';
  const cardShadow = '0 0 0 1px rgba(59,130,246,0.08), 0 8px 32px -8px rgba(59,130,246,0.18)';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <span className="text-sm font-bold tracking-wide" style={{ color: '#3b82f6' }}>
          Notifications
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: accent,
            backgroundColor: 'rgba(59,130,246,0.10)',
            border: `1px solid rgba(59,130,246,0.25)`,
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
                    <UserNameLink user={inv.sender} fallback="Someone" /> challenged you
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
                      className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-shadow"
                      style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
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

      {gameResults.length > 0 && (
        <div>
          <div
            className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: textSecondary }}
          >
            Results
          </div>
          {gameResults.map((r) => {
            const accent = r.outcome === 'won' ? '#3b82f6' : r.outcome === 'lost' ? '#f87171' : '#facc15';
            const label = r.outcome === 'won' ? 'Won' : r.outcome === 'lost' ? 'Lost' : 'Graded';
            const pnl = Number.isFinite(r.pnl) ? r.pnl : 0;
            const pnlText = `${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(2)}`;
            return (
              <div
                key={`result:${r.id}`}
                className="px-4 py-3 flex items-start gap-3"
                style={{ borderTop: `1px solid ${cardBorder}` }}
              >
                <Avatar user={r.opponent} onlineDotBorderColor={cardBg} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                    <span style={{ color: accent }}>{label}</span>
                    {' vs '}
                    <UserNameLink user={r.opponent} fallback="Opponent" />
                  </div>
                  <div className="text-xs" style={{ color: textSecondary }}>
                    {r.outcome === 'won' && r.winnerPayout > 0
                      ? `Payout $${r.winnerPayout.toFixed(2)}`
                      : `P/L ${pnlText}`}
                    {r.buyIn > 0 ? ` · $${r.buyIn} buy-in` : ''}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => wrap(r.id, async () => {
                        await ctx.ackGameResult(r.matchupId);
                        router.push(`/battle?result=${encodeURIComponent(r.matchupId)}`);
                      })}
                      className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                      style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
                    >View</button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => wrap(r.id, () => ctx.ackGameResult(r.matchupId))}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                    >Dismiss</button>
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: textSecondary }}>
                  {timeAgo(r.endedAt)}
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
                  <UserNameLink user={fr.sender} fallback="Someone" /> wants to be friends
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, () => ctx.acceptFriend(fr.id))}
                    className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
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

  const isAuthed = status === 'authenticated';

  // ?chat=<id> deep link → forward to /messenger.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (chatId && typeof chatId === 'string') {
      router.replace(`/messenger?chat=${chatId}`);
    }
  }, [router.isReady, router.query.chat]);

  const bg = '#000000';
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
    <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
      <TopNavbar />
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 tracking-tight" style={{ color: '#3b82f6' }}>
          Notifications
        </h1>
        <NotificationsFeed ctx={ctx} router={router} />
      </div>
    </div>
  );
}
