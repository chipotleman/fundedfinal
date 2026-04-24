import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import { isUserOnline } from '../components/ActiveStatus';
import UserAvatar, { UserNameLink } from '../components/UserAvatar';
import { formatMoney } from '../utils/formatMoney';
import { NOTIF_TYPES, TypeChip, getResultStyle } from '../components/notifications/notificationTypeStyles';

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

const cardBg = '#0a0a0a';
const cardBorder = 'rgba(59,130,246,0.22)';
const textPrimary = '#ffffff';
const textSecondary = '#9ca3af';

function SectionHeader({ type, title }) {
  const style = NOTIF_TYPES[type];
  const accent = style?.accent || textSecondary;
  return (
    <div
      className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold"
      style={{ color: accent }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
      />
      {title}
    </div>
  );
}

function TypedRow({ type, time, avatar, children, accentOverride }) {
  const style = NOTIF_TYPES[type];
  const accent = accentOverride || style?.accent || '#3b82f6';
  return (
    <div
      className="px-4 py-3 flex items-start gap-3"
      style={{
        borderTop: `1px solid ${cardBorder}`,
        borderLeft: `3px solid ${accent}`,
        backgroundColor: `${accent}08`,
      }}
    >
      {avatar}
      <div className="flex-1 min-w-0">{children}</div>
      {time && (
        <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: textSecondary }}>
          {time}
        </span>
      )}
    </div>
  );
}

const FILTER_STORAGE_KEY = 'piks:notificationsFilter';

const FILTERS = [
  { key: 'all', label: 'All', accent: '#3b82f6' },
  { key: 'invite', label: 'Invites', accent: NOTIF_TYPES.invite.accent },
  { key: 'rematch', label: 'Rematches', accent: NOTIF_TYPES.rematch.accent },
  { key: 'result', label: 'Results', accent: NOTIF_TYPES.result_won.accent },
  { key: 'friend', label: 'Friends', accent: NOTIF_TYPES.friend_request.accent },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function FilterPills({ active, onChange, counts }) {
  return (
    <div
      className="-mx-3 sm:mx-0 mb-3 px-3 sm:px-0 overflow-x-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex items-center gap-2 min-w-max">
        {FILTERS.map((f) => {
          const isActive = active === f.key;
          const count = counts[f.key] ?? 0;
          const { r, g, b } = hexToRgb(f.accent);
          const bg = isActive
            ? `rgba(${r},${g},${b},0.16)`
            : 'rgba(255,255,255,0.03)';
          const border = isActive
            ? `rgba(${r},${g},${b},0.55)`
            : 'rgba(255,255,255,0.08)';
          const color = isActive ? f.accent : '#9ca3af';
          const shadow = isActive
            ? `0 0 12px rgba(${r},${g},${b},0.28)`
            : 'none';
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onChange(f.key)}
              aria-pressed={isActive}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
              style={{
                color,
                backgroundColor: bg,
                border: `1px solid ${border}`,
                boxShadow: shadow,
              }}
            >
              <span>{f.label}</span>
              {count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    color: isActive ? '#000' : color,
                    backgroundColor: isActive
                      ? f.accent
                      : `rgba(${r},${g},${b},0.12)`,
                    border: isActive
                      ? `1px solid ${f.accent}`
                      : `1px solid rgba(${r},${g},${b},0.35)`,
                    minWidth: 18,
                    lineHeight: 1,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsFeed({ ctx, router, filter }) {
  const allBattleInvites = ctx.battleInvites || [];
  const allFriendRequests = ctx.friendRequests || [];
  const allGameResults = ctx.gameResults || [];
  const allPendingRematches = ctx.pendingRematches || [];
  const [busyId, setBusyId] = useState(null);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const showInvite = filter === 'all' || filter === 'invite';
  const showRematch = filter === 'all' || filter === 'rematch';
  const showResult = filter === 'all' || filter === 'result';
  const showFriend = filter === 'all' || filter === 'friend';

  const battleInvites = showInvite ? allBattleInvites : [];
  const pendingRematches = showRematch ? allPendingRematches : [];
  const gameResults = showResult ? allGameResults : [];
  const friendRequests = showFriend ? allFriendRequests : [];

  const totalNew =
    battleInvites.length +
    friendRequests.length +
    gameResults.length +
    pendingRematches.length;
  const empty = totalNew === 0;

  const accent = '#3b82f6';
  const cardShadow =
    '0 0 0 1px rgba(59,130,246,0.08), 0 8px 32px -8px rgba(59,130,246,0.18)';

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
          {filter === 'all'
            ? "You're all caught up."
            : 'Nothing here for this filter.'}
        </div>
      )}

      {battleInvites.length > 0 && (
        <div>
          <SectionHeader type="invite" title="Battle Invites" />
          {battleInvites.map((inv) => {
            const buyIn = parseFloat(inv.buyIn) || 0;
            return (
              <TypedRow
                key={inv.id}
                type="invite"
                time={timeAgo(inv.createdAt)}
                avatar={
                  <Avatar
                    user={inv.sender}
                    isOnline={inv.sender?.isOnline ?? isUserOnline(inv.sender?.lastSeenAt)}
                    onlineDotBorderColor={cardBg}
                  />
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeChip type="invite" />
                </div>
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
              </TypedRow>
            );
          })}
        </div>
      )}

      {pendingRematches.length > 0 && (
        <div>
          <SectionHeader type="rematch" title="Rematch Requests" />
          {pendingRematches.map((rm) => (
            <TypedRow
              key={`rematch:${rm.matchupId}`}
              type="rematch"
              time={timeAgo(rm.requestedAt)}
              avatar={<Avatar user={rm.opponent} onlineDotBorderColor={cardBg} />}
            >
              <div className="flex items-center gap-2 mb-1">
                <TypeChip type="rematch" />
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                <UserNameLink user={rm.opponent} fallback="Opponent" /> wants a rematch
              </div>
              <div className="text-xs" style={{ color: textSecondary }}>
                Tap view to accept or decline
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  disabled={busyId === rm.matchupId}
                  onClick={() => wrap(rm.matchupId, async () => {
                    router.push(`/battle?result=${encodeURIComponent(rm.matchupId)}&rematch=1`);
                  })}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
                >View</button>
                <button
                  disabled={busyId === rm.matchupId}
                  onClick={() => wrap(rm.matchupId, () => ctx.declineRematch(rm.matchupId))}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                >Decline</button>
              </div>
            </TypedRow>
          ))}
        </div>
      )}

      {gameResults.length > 0 && (
        <div>
          <SectionHeader type="result_won" title="Results" />
          {gameResults.map((r) => {
            const resultStyle = getResultStyle(r.outcome);
            const resultType = r.outcome === 'won'
              ? 'result_won'
              : r.outcome === 'lost'
              ? 'result_lost'
              : 'result_push';
            const pnl = Number.isFinite(r.pnl) ? r.pnl : 0;
            const amount = Math.abs(pnl);
            let label;
            if (r.outcome === 'won') {
              label = amount > 0 ? `Won $${formatMoney(amount)}` : 'Won';
            } else if (r.outcome === 'lost') {
              label = amount > 0 ? `Lost $${formatMoney(amount)}` : 'Lost';
            } else {
              label = 'Push';
            }
            return (
              <TypedRow
                key={`result:${r.id}`}
                type={resultType}
                accentOverride={resultStyle.accent}
                time={timeAgo(r.endedAt)}
                avatar={<Avatar user={r.opponent} onlineDotBorderColor={cardBg} />}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeChip type={resultType} />
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  <span style={{ color: resultStyle.accent }}>{label}</span>
                  {' vs '}
                  <UserNameLink user={r.opponent} fallback="Opponent" />
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
              </TypedRow>
            );
          })}
        </div>
      )}

      {friendRequests.length > 0 && (
        <div>
          <SectionHeader type="friend_request" title="Friend Requests" />
          {friendRequests.map((fr) => (
            <TypedRow
              key={fr.id}
              type="friend_request"
              time={timeAgo(fr.createdAt)}
              avatar={
                <Avatar
                  user={fr.sender}
                  isOnline={fr.sender?.isOnline ?? isUserOnline(fr.sender?.lastSeenAt)}
                  onlineDotBorderColor={cardBg}
                />
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <TypeChip type="friend_request" />
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                <UserNameLink user={fr.sender} fallback="Someone" /> wants to be friends
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  disabled={busyId === fr.id}
                  onClick={() => wrap(fr.id, () => ctx.acceptFriend(fr.id))}
                  className="bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ boxShadow: '0 0 12px rgba(168,85,247,0.45)' }}
                >Accept</button>
                <button
                  disabled={busyId === fr.id}
                  onClick={() => wrap(fr.id, () => ctx.declineFriend(fr.id))}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                >Decline</button>
              </div>
            </TypedRow>
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
  const [filter, setFilterState] = useState('all');

  const isAuthed = status === 'authenticated';

  // Restore the user's last-selected filter from sessionStorage so it sticks
  // while they navigate away and come back within the same session.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (saved && FILTERS.some((f) => f.key === saved)) {
        setFilterState(saved);
      }
    } catch {}
  }, []);

  const setFilter = (next) => {
    setFilterState(next);
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.setItem(FILTER_STORAGE_KEY, next); } catch {}
    }
  };

  const counts = {
    all:
      (ctx.battleInvites?.length || 0) +
      (ctx.pendingRematches?.length || 0) +
      (ctx.gameResults?.length || 0) +
      (ctx.friendRequests?.length || 0),
    invite: ctx.battleInvites?.length || 0,
    rematch: ctx.pendingRematches?.length || 0,
    result: ctx.gameResults?.length || 0,
    friend: ctx.friendRequests?.length || 0,
  };

  // Defensive: mirror the messenger page — proactively release any leftover
  // body / html scroll-lock styles a previous modal may have left behind.
  // Without this, navigating to /notifications while a modal was tearing
  // down can leave `body { overflow: hidden }` in place, which on iOS Safari
  // manifests as top-nav taps no longer navigating until a hard refresh.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const b = document.body.style;
    b.overflow = '';
    b.position = '';
    b.top = '';
    b.left = '';
    b.right = '';
    b.width = '';
    b.height = '';
    b.overscrollBehavior = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
  }, []);

  // ?chat=<id> deep link → forward to /messenger.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (chatId && typeof chatId === 'string') {
      router.replace(`/messenger?chat=${chatId}`);
    }
  }, [router.isReady, router.query.chat]);

  const bg = '#000000';

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
        <FilterPills active={filter} onChange={setFilter} counts={counts} />
        <NotificationsFeed ctx={ctx} router={router} filter={filter} />
      </div>
    </div>
  );
}
