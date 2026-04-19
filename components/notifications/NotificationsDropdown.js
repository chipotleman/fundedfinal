import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';
import UserAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { cacheBattleResult } from '../../utils/battleResultCache';

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
  const total = battleInvites.length + friendRequests.length + gameResults.length;

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
      onClose?.();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
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
      className="fixed left-1/2 -translate-x-1/2 top-[var(--top-nav-height,70px)] sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full mt-2 w-[calc(100vw-16px)] max-w-sm sm:w-96 sm:max-w-[calc(100vw-24px)] bg-[#0a0a0a] border border-[#10b981]/30 rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{
        maxHeight: '70vh',
        boxShadow: '0 0 0 1px rgba(16,185,129,0.10), 0 18px 48px -12px rgba(16,185,129,0.35)',
      }}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between gap-2">
        <span
          className="font-bold text-sm tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Notifications
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-300"
            style={{
              backgroundColor: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
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
          <Section title="Battle Invites">
            {battleInvites.map((inv) => {
              const buyIn = parseFloat(inv.buyIn) || 0;
              return (
                <Row key={inv.id} sender={inv.sender} time={inv.createdAt}>
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
                        if (data) router.push('/?battleStarted=true');
                      })}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                      style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
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

        {gameResults.length > 0 && (
          <Section title="Results">
            {gameResults.map((r) => {
              const accent = r.outcome === 'won' ? '#34d399' : r.outcome === 'lost' ? '#f87171' : '#facc15';
              const label = r.outcome === 'won' ? 'Won' : r.outcome === 'lost' ? 'Lost' : 'Graded';
              const pnl = Number.isFinite(r.pnl) ? r.pnl : 0;
              const pnlText = `${pnl >= 0 ? '+' : '−'}$${formatMoney(Math.abs(pnl))}`;
              return (
                <Row key={`result:${r.id}`} sender={r.opponent} time={r.endedAt}>
                  <div className="text-white text-sm font-semibold truncate">
                    <span style={{ color: accent }}>{label}</span>
                    {' vs '}
                    {r.opponent?.username || 'Opponent'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {r.outcome === 'won' && r.winnerPayout > 0
                      ? `Payout $${formatMoney(r.winnerPayout)}`
                      : `P/L ${pnlText}`}
                    {r.buyIn > 0 ? ` · $${formatMoney(r.buyIn)} buy-in` : ''}
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
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                      style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
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
          <Section title="Friend Requests">
            {friendRequests.map((fr) => (
              <Row key={fr.id} sender={fr.sender} time={fr.createdAt}>
                <div className="text-white text-sm font-semibold truncate">
                  {fr.sender?.username || 'Someone'} wants to be friends
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, async () => { await ctx.acceptFriend(fr.id); })}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                    style={{ boxShadow: '0 0 12px rgba(16,185,129,0.45)' }}
                  >Accept</button>
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, async () => { await ctx.declineFriend(fr.id); })}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                  >Decline</button>
                </div>
              </Row>
            ))}
          </Section>
        )}
      </div>

      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={() => { onClose?.(); router.push('/notifications'); }}
          className="w-full text-center text-xs font-bold py-3 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/5 transition-colors"
        >
          View all
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ sender, time, children }) {
  return (
    <div className="px-4 py-2.5 hover:bg-[#111111] flex items-start gap-3">
      <Avatar sender={sender} />
      <div className="flex-1 min-w-0">{children}</div>
      {time && (
        <span className="text-[10px] text-gray-500 mt-1 flex-shrink-0">{timeAgo(time)}</span>
      )}
    </div>
  );
}
