import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import { navigateToBattleStart } from '../lib/battleStartNavigation';
import { isUserOnline } from '../components/ActiveStatus';
import UserAvatar, { UserNameLink } from '../components/UserAvatar';
import { formatMoney } from '../utils/formatMoney';
import { NOTIF_TYPES, TypeChip, getResultStyle } from '../components/notifications/notificationTypeStyles';
import FriendRequestCard from '../components/notifications/FriendRequestCard';
import { useBetaMode } from '../contexts/SiteConfigContext';

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

// Canonical social-battle-flow mode identity (matches the invite popup,
// Play-a-Friend modal, notifications dropdown, and the --sbf-* tokens):
// RUSH amber, ORIGINAL blue, TOURNAMENT violet.
const MODE_DISPLAY = {
  rush: { label: 'Rush', color: '#fb923c' },
  original: { label: 'Original', color: '#3b82f6' },
  tournament: { label: 'Tournament', color: '#8b5cf6' },
};
function modeDisplay(m) {
  return MODE_DISPLAY[m] || MODE_DISPLAY.original;
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
        <span
          className="text-[10px] flex-shrink-0 mt-1"
          style={{ color: textSecondary }}
          suppressHydrationWarning
        >
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
  // Pink "Social" pill — distinct from every battle/friend/result accent
  // so users can either focus on social activity or filter it out
  // entirely. Matches the toast + bell row colour.
  { key: 'social', label: 'Social', accent: NOTIF_TYPES.social_like.accent },
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

// Per-filter copy for the bulk-clear action. `destructive` types (decline)
// require a confirmation step; safe types (dismiss-only) execute immediately.
const BULK_ACTIONS = {
  all: { label: 'Clear all', confirmTitle: 'Clear all notifications?', destructive: true },
  invite: { label: 'Decline all', confirmTitle: 'Decline every battle invite?', destructive: true },
  rematch: { label: 'Decline all', confirmTitle: 'Decline every rematch request?', destructive: true },
  result: { label: 'Dismiss all', confirmTitle: null, destructive: false },
  friend: { label: 'Decline all', confirmTitle: 'Decline every friend request?', destructive: true },
  social: { label: 'Dismiss all', confirmTitle: null, destructive: false },
};

function NotificationsFeed({ ctx, router, filter }) {
  const isBeta = useBetaMode();
  const allBattleInvites = ctx.battleInvites || [];
  const allFriendRequests = ctx.friendRequests || [];
  const allGameResults = ctx.gameResults || [];
  const allPendingRematches = ctx.pendingRematches || [];
  const allSocialActivity = ctx.socialActivity || [];
  const [busyId, setBusyId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const showInvite = filter === 'all' || filter === 'invite';
  const showRematch = filter === 'all' || filter === 'rematch';
  const showResult = filter === 'all' || filter === 'result';
  const showFriend = filter === 'all' || filter === 'friend';
  const showSocial = filter === 'all' || filter === 'social';

  const battleInvites = showInvite ? allBattleInvites : [];
  const pendingRematches = showRematch ? allPendingRematches : [];
  const gameResults = showResult ? allGameResults : [];
  const friendRequests = showFriend ? allFriendRequests : [];
  const socialActivity = showSocial ? allSocialActivity : [];

  const totalNew =
    battleInvites.length +
    friendRequests.length +
    gameResults.length +
    pendingRematches.length +
    socialActivity.length;
  const empty = totalNew === 0;

  // Hide the confirmation strip if the user changes filter or the visible
  // set empties out from underneath it.
  useEffect(() => {
    if (empty && confirmOpen) setConfirmOpen(false);
  }, [empty, confirmOpen]);
  useEffect(() => {
    setConfirmOpen(false);
  }, [filter]);

  const runBulkClear = async () => {
    setBulkBusy(true);
    try {
      const tasks = [];
      // Use the existing per-item helpers so optimistic state updates and
      // server semantics stay identical to single-item actions.
      for (const inv of battleInvites) tasks.push(ctx.declineInvite(inv.id));
      for (const fr of friendRequests) tasks.push(ctx.declineFriend(fr.id));
      for (const rm of pendingRematches) tasks.push(ctx.declineRematch(rm.matchupId));
      for (const r of gameResults) tasks.push(ctx.ackGameResult(r.matchupId));
      // Social: a single ackAllSocial call clears every visible social row
      // server-side in one round-trip (vs. one POST per row). Only used
      // when the social filter is active OR we're on All — in both cases
      // every visible social item is meant to clear.
      if (socialActivity.length > 0) {
        tasks.push(ctx.ackAllSocial?.());
      }
      await Promise.allSettled(tasks);
    } finally {
      setBulkBusy(false);
      setConfirmOpen(false);
    }
  };

  const bulkAction = BULK_ACTIONS[filter] || BULK_ACTIONS.all;
  const showBulkButton = !empty && !confirmOpen;

  const handleBulkClick = () => {
    if (bulkAction.destructive) {
      setConfirmOpen(true);
    } else {
      runBulkClear();
    }
  };

  const accent = '#3b82f6';
  const cardShadow =
    '0 0 0 1px rgba(59,130,246,0.08), 0 8px 32px -8px rgba(59,130,246,0.18)';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <span className="text-sm font-bold tracking-wide" style={{ color: '#3b82f6' }}>
          Notifications
        </span>
        <div className="flex items-center gap-2">
          {showBulkButton && (
            <button
              type="button"
              onClick={handleBulkClick}
              disabled={bulkBusy}
              aria-label={`${bulkAction.label} (${totalNew})`}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap disabled:opacity-50 transition-colors"
              style={{
                color: '#e5e7eb',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              {bulkBusy ? 'Working…' : bulkAction.label}
            </button>
          )}
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
      </div>

      {confirmOpen && (
        <div
          className="px-4 py-3 flex items-start gap-3 flex-wrap"
          style={{
            backgroundColor: 'rgba(239,68,68,0.06)',
            borderBottom: `1px solid ${cardBorder}`,
          }}
          role="alertdialog"
          aria-label={bulkAction.confirmTitle || 'Confirm'}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: textPrimary }}>
              {bulkAction.confirmTitle}
            </div>
            <div className="text-xs mt-0.5" style={{ color: textSecondary }}>
              This will clear {totalNew} {totalNew === 1 ? 'item' : 'items'} and can&apos;t be undone.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={bulkBusy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runBulkClear}
              disabled={bulkBusy}
              className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 text-white"
              style={{
                backgroundColor: '#ef4444',
                boxShadow: '0 0 12px rgba(239,68,68,0.45)',
              }}
            >
              {bulkBusy ? 'Clearing…' : `Yes, ${bulkAction.label.toLowerCase()}`}
            </button>
          </div>
        </div>
      )}

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
            const md = modeDisplay(inv.gameMode);
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
                  <span
                    className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                    style={{ color: md.color, background: `${md.color}1f`, border: `1px solid ${md.color}59` }}
                  >
                    {md.label}
                  </span>
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  <UserNameLink user={inv.sender} fallback="Someone" /> challenged you
                </div>
                <div className="text-xs" style={{ color: textSecondary }}>
                  {isBeta
                    ? `${formatMoney(buyIn, 0)} coin buy-in · ${formatMoney(buyIn * 2, 0)} coin pot`
                    : `$${buyIn} buy-in · $${buyIn * 2} pot`}{inv.duration ? ` · ${inv.duration}h` : ''}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === inv.id}
                    onClick={() => wrap(inv.id, async () => {
                      const data = await ctx.acceptInvite(inv.id);
                      if (data?.ok && data.matchup) navigateToBattleStart(router, data.matchup);
                    })}
                    className="text-white text-xs font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: 'linear-gradient(180deg,#3b82f6,#4f46e5)', boxShadow: '0 2px 10px rgba(59,130,246,0.28)' }}
                  >Accept</button>
                  <button
                    disabled={busyId === inv.id}
                    onClick={() => wrap(inv.id, () => ctx.declineInvite(inv.id))}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 text-gray-300"
                    style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
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
              label = amount > 0 ? (isBeta ? `Won ${formatMoney(amount)} coins` : `Won $${formatMoney(amount)}`) : 'Won';
            } else if (r.outcome === 'lost') {
              label = amount > 0 ? (isBeta ? `Lost ${formatMoney(amount)} coins` : `Lost $${formatMoney(amount)}`) : 'Lost';
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
          <div
            className="px-3 sm:px-4 pt-1 pb-3 flex flex-col gap-2.5"
            style={{ borderTop: `1px solid ${cardBorder}` }}
          >
            {friendRequests.map((fr) => (
              <FriendRequestCard
                key={fr.id}
                sender={fr.sender}
                context={fr.context}
                time={timeAgo(fr.createdAt)}
                busy={busyId === fr.id}
                onAccept={() => wrap(fr.id, () => ctx.acceptFriend(fr.id))}
                onDecline={() => wrap(fr.id, () => ctx.declineFriend(fr.id))}
              />
            ))}
          </div>
        </div>
      )}

      {socialActivity.length > 0 && (
        <div>
          <SectionHeader type="social_like" title="Social Activity" />
          {socialActivity.map((s) => {
            const isComment = s.type === 'comment';
            const rowType = isComment ? 'social_comment' : 'social_like';
            return (
              <TypedRow
                key={`social:${s.id}`}
                type={rowType}
                time={timeAgo(s.createdAt)}
                avatar={<Avatar user={s.actor} onlineDotBorderColor={cardBg} />}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeChip type={rowType} />
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  <UserNameLink user={s.actor} fallback="Someone" />{' '}
                  {isComment ? 'commented on your post' : 'liked your post'}
                </div>
                {(isComment ? s.commentPreview : s.postPreview) && (
                  <div className="text-xs truncate" style={{ color: textSecondary }}>
                    {isComment ? s.commentPreview : s.postPreview}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === s.id}
                    onClick={() => wrap(s.id, async () => {
                      router.push('/battle');
                      ctx.ackSocial?.([s.id]);
                    })}
                    className="text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{
                      backgroundColor: '#ec4899',
                      boxShadow: '0 0 12px rgba(236,72,153,0.45)',
                    }}
                  >View</button>
                  <button
                    disabled={busyId === s.id}
                    onClick={() => wrap(s.id, () => ctx.ackSocial?.([s.id]))}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10"
                  >Dismiss</button>
                </div>
              </TypedRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const isBeta = useBetaMode();
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();
  const [filter, setFilterState] = useState('all');
  // Tracks whether the user has manually changed the filter in this session.
  // Used to discard a late-arriving server fetch that would otherwise
  // clobber a fresh local choice (race between initial GET and a quick tap).
  const userChangedFilterRef = useRef(false);

  const isAuthed = status === 'authenticated';

  // Restore the user's last-selected filter from localStorage so it sticks
  // across browser sessions (closing the tab/browser still preserves it).
  // We also fall back to any value previously stored in sessionStorage so
  // users mid-session don't lose their selection on the upgrade. For
  // signed-in users this is just the initial guess — the server-side
  // account preference (fetched below) takes precedence and overwrites it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      let saved = null;
      try { saved = window.localStorage.getItem(FILTER_STORAGE_KEY); } catch {}
      if (!saved) {
        try { saved = window.sessionStorage.getItem(FILTER_STORAGE_KEY); } catch {}
      }
      if (saved && FILTERS.some((f) => f.key === saved)) {
        setFilterState(saved);
      }
    } catch {}
  }, []);

  // For signed-in users, fetch the per-account preference and prefer it
  // over the locally cached value so the chosen filter follows them across
  // devices. We only apply the server value if it's a known filter key.
  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (!res.ok) return;
        const data = await res.json();
        const serverFilter = data?.settings?.notificationsFilter;
        if (cancelled) return;
        // If the user already changed the filter while this fetch was in
        // flight, their fresh choice takes precedence — discard the server
        // value to avoid a flicker / clobber.
        if (userChangedFilterRef.current) return;
        if (serverFilter && FILTERS.some((f) => f.key === serverFilter)) {
          setFilterState(serverFilter);
          // Mirror to localStorage so the next visit on this device renders
          // the right pill instantly without waiting on the network.
          if (typeof window !== 'undefined') {
            try { window.localStorage.setItem(FILTER_STORAGE_KEY, serverFilter); } catch {}
          }
        }
      } catch {
        // Network errors fall through silently — we keep the localStorage
        // / default value rather than blocking the page.
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthed]);

  const setFilter = (next) => {
    userChangedFilterRef.current = true;
    setFilterState(next);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(FILTER_STORAGE_KEY, next); } catch {}
      // Keep sessionStorage in sync (and clear stale values) so the two
      // stores don't disagree if some other code path still reads it.
      try { window.sessionStorage.setItem(FILTER_STORAGE_KEY, next); } catch {}
    }
    // Write through to the per-account preference so the choice follows
    // the user to other devices. Anonymous users keep using localStorage
    // only. We only fire-and-forget — the optimistic state update above
    // already reflects the change in the UI.
    if (isAuthed) {
      fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationsFilter: next }),
      }).catch(() => {});
    }
  };

  const counts = {
    all:
      (ctx.battleInvites?.length || 0) +
      (ctx.pendingRematches?.length || 0) +
      (ctx.gameResults?.length || 0) +
      (ctx.friendRequests?.length || 0) +
      (ctx.socialActivity?.length || 0),
    invite: ctx.battleInvites?.length || 0,
    rematch: ctx.pendingRematches?.length || 0,
    result: ctx.gameResults?.length || 0,
    friend: ctx.friendRequests?.length || 0,
    social: ctx.socialActivity?.length || 0,
  };

  // The shared top-nav click-trap watchdog is installed globally in
  // pages/_app.js (GlobalClickTrapWatchdog) for every non-chromeless
  // route, so we no longer install a /notifications-specific copy here.
  // See utils/topNavClickTrapWatchdog.js for the detection rules.

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
