import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import UserAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { cacheBattleResult } from '../../utils/battleResultCache';
import { NOTIF_TYPES, NotifIcon, getResultStyle } from './notificationTypeStyles';
import FriendRequestCard from './FriendRequestCard';

function Avatar({ sender, size = 36 }) {
  return (
    <UserAvatar
      avatar={sender?.avatar}
      username={sender?.username}
      frameId={sender?.equippedFrame}
      size={size}
      bgColor="#374151"
    />
  );
}

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

// Notifications dropdown — alerts only (battle invites, friend requests, and
// any future game-result alerts). Messages have moved to MessagesDropdown.
export default function NotificationsDropdown({ open, onClose, anchorRef }) {
  const router = useRouter();
  const ctx = useNotifications();
  const ref = useRef(null);
  const [busyId, setBusyId] = useState(null);

  const battleInvites = ctx.battleInvites || [];
  const friendRequests = ctx.friendRequests || [];
  const gameResults = ctx.gameResults || [];
  const pendingRematches = ctx.pendingRematches || [];
  const total = battleInvites.length + friendRequests.length + gameResults.length + pendingRematches.length;

  useEffect(() => {
    if (!open) return;
    // Use `click` (not `mousedown`) so the original tap target — e.g. a Link
    // or button — receives its click first. On iOS Safari, closing this
    // dropdown during `mousedown` can change the layout (the fixed dropdown
    // unmounts) and cause the subsequent `click` on the link to be dropped,
    // which manifests as a "stuck" page where taps no longer navigate.
    const handleClick = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
      // Defensive: if the click target was removed from the document
      // between the click event and this handler running (e.g. the user
      // clicked Dismiss inside a row, the row unmounted on the React
      // re-render, and the bubbled document-level click now sees a
      // detached node), treat it as an in-dropdown action and skip
      // close. Without this, dismissing/acking a row inside the popup
      // would also dismiss the popup itself.
      if (typeof document !== 'undefined' && !document.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    // Close on window scroll. Internal dropdown scrolling lives in an
    // overflow-y container, so it does not bubble to the window — only
    // the page scrolling underneath fires this listener. We snapshot the
    // open scrollY so the listener that attaches *because* of the open
    // tap doesn't immediately fire if a render-time scroll adjustment
    // happens.
    const startY = typeof window !== 'undefined' ? window.scrollY : 0;
    const handleScroll = () => {
      if (Math.abs((window.scrollY || 0) - startY) > 4) onClose?.();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [open, onClose, anchorRef]);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="fixed left-1/2 -translate-x-1/2 top-[var(--top-nav-height,70px)] sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full mt-2 w-[calc(100vw-16px)] max-w-sm sm:w-96 sm:max-w-[calc(100vw-24px)] bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{
        maxHeight: '70vh',
        boxShadow: '0 0 0 1px rgba(59,130,246,0.10), 0 18px 48px -12px rgba(59,130,246,0.35)',
      }}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between gap-2">
        <span className="font-bold text-sm tracking-wide text-white">
          Notifications
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-blue-300"
            style={{
              backgroundColor: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
            }}
          >
            {total} new
          </span>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 96px)' }}>
        {total === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            You're all caught up.
          </div>
        )}

        {battleInvites.length > 0 && (
          <Section type="invite" title="Battle Invites">
            {battleInvites.map((inv) => {
              const buyIn = parseFloat(inv.buyIn) || 0;
              return (
                <Row key={inv.id} type="invite" sender={inv.sender} time={inv.createdAt}>
                  <div className="text-white text-sm font-semibold truncate">
                    {inv.sender?.username || 'Someone'} challenged you
                  </div>
                  <div className="text-gray-400 text-xs">
                    ${buyIn} buy-in · ${buyIn * 2} pot{inv.duration ? ` · ${inv.duration}h` : ''}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, async () => {
                        const data = await ctx.acceptInvite(inv.id);
                        onClose?.();
                        if (data) navigateToBattleStart(router, data.matchup);
                      })}
                      className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                      style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
                    >Accept</button>
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, async () => { await ctx.declineInvite(inv.id); })}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                    >Decline</button>
                  </div>
                </Row>
              );
            })}
          </Section>
        )}

        {pendingRematches.length > 0 && (
          <Section type="rematch" title="Rematch Requests">
            {pendingRematches.map((rm) => (
              <Row key={rm.id} type="rematch" sender={rm.opponent} time={rm.requestedAt}>
                <div className="text-white text-sm font-semibold truncate">
                  {rm.opponent?.username || 'Opponent'} wants a rematch
                </div>
                <div className="text-gray-400 text-xs">
                  Tap view to accept or decline
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === rm.id}
                    onClick={() => wrap(rm.id, async () => {
                      onClose?.();
                      router.push(`/battle?result=${encodeURIComponent(rm.matchupId)}&rematch=1`);
                    })}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                    style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
                  >View</button>
                  <button
                    disabled={busyId === rm.id}
                    onClick={() => wrap(rm.id, async () => { await ctx.declineRematch(rm.matchupId); })}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                  >Decline</button>
                </div>
              </Row>
            ))}
          </Section>
        )}

        {gameResults.length > 0 && (
          <Section type="result_won" title="Results">
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
                <Row
                  key={`result:${r.id}`}
                  type={resultType}
                  sender={r.opponent}
                  time={r.endedAt}
                >
                  <div className="text-white text-sm font-semibold truncate">
                    <span style={{ color: resultStyle.accent }}>{label}</span>
                    {' vs '}
                    {r.opponent?.username || 'Opponent'}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => wrap(r.id, async () => {
                        // Hand off the payload so /battle can open the popup
                        // instantly without waiting for a history fetch.
                        cacheBattleResult(r.matchupId, r);
                        onClose?.();
                        router.push(`/battle?result=${encodeURIComponent(r.matchupId)}`);
                        // Ack after navigation so the popup is rendered first.
                        ctx.ackGameResult(r.matchupId);
                      })}
                      className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                      style={{ boxShadow: '0 0 12px rgba(59,130,246,0.45)' }}
                    >View</button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => wrap(r.id, async () => { await ctx.ackGameResult(r.matchupId); })}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                    >Dismiss</button>
                  </div>
                </Row>
              );
            })}
          </Section>
        )}

        {friendRequests.length > 0 && (
          <Section type="friend_request" title="Friend Requests">
            <div className="px-3 pb-2 pt-1 flex flex-col gap-2">
              {friendRequests.map((fr) => (
                <FriendRequestCard
                  key={fr.id}
                  sender={fr.sender}
                  context={fr.context}
                  time={timeAgo(fr.createdAt)}
                  busy={busyId === fr.id}
                  compact
                  onAccept={() => wrap(fr.id, async () => { await ctx.acceptFriend(fr.id); })}
                  onDecline={() => wrap(fr.id, async () => { await ctx.declineFriend(fr.id); })}
                  onProfileNavigate={onClose}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={() => { onClose?.(); router.push('/notifications'); }}
          className="w-full text-center text-xs font-bold py-3 text-blue-300 hover:text-blue-200 hover:bg-blue-400/5 transition-colors"
        >
          View all
        </button>
      </div>
    </div>
  );
}

function Section({ type, title, children }) {
  const style = NOTIF_TYPES[type];
  const accent = style?.accent || '#9ca3af';
  return (
    <div>
      <div
        className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold"
        style={{ color: accent }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
        />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ type, sender, time, children }) {
  const style = NOTIF_TYPES[type];
  const accent = style?.accent || '#3b82f6';
  return (
    <div
      className="px-4 py-2.5 hover:bg-[#111111] flex items-start gap-3 relative"
      style={{
        borderLeft: `3px solid ${accent}`,
        backgroundColor: `${accent}0A`,
      }}
    >
      <div className="relative flex-shrink-0">
        <Avatar sender={sender} />
        {style && (
          <span
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full"
            style={{
              width: 16,
              height: 16,
              backgroundColor: '#0a0a0a',
              border: `1px solid ${accent}`,
              color: accent,
            }}
            title={style.label}
          >
            <NotifIcon name={style.icon} size={9} color={accent} strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {style && (
          <div
            className="text-[9px] uppercase tracking-wider font-bold mb-0.5"
            style={{ color: accent }}
          >
            {style.label}
          </div>
        )}
        {children}
      </div>
      {time && (
        <span
          className="text-[10px] text-gray-500 mt-1 flex-shrink-0"
          suppressHydrationWarning
        >
          {timeAgo(time)}
        </span>
      )}
    </div>
  );
}
