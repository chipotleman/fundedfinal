import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';

function Avatar({ sender, size = 36 }) {
  const initial = (sender?.username || '?')[0]?.toUpperCase();
  return (
    <div
      className="rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {sender?.avatar ? (
        <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
      ) : (
        <span className="text-sm font-bold text-white">{initial}</span>
      )}
    </div>
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

export default function NotificationsDropdown({ open, onClose, anchorRef }) {
  const router = useRouter();
  const ctx = useNotifications();
  const ref = useRef(null);
  const [busyId, setBusyId] = useState(null);
  const markedRef = useRef(false);

  const battleInvites = ctx.battleInvites || [];
  const friendRequests = ctx.friendRequests || [];
  const unreadMessages = ctx.unreadMessages || [];
  const total = (ctx.counts?.total) || 0;

  // When the dropdown opens, mark unread messages as read so the badge
  // clears even if the user doesn't navigate to /social. Battle invites
  // and friend requests intentionally still require explicit accept/decline.
  useEffect(() => {
    if (!open) {
      markedRef.current = false;
      return;
    }
    if (markedRef.current) return;
    if (unreadMessages.length === 0) return;
    markedRef.current = true;
    const senderIds = unreadMessages
      .map(m => m.sender?.id)
      .filter(Boolean);
    if (senderIds.length > 0) {
      ctx.markMessagesRead(senderIds);
    }
  }, [open, unreadMessages, ctx]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{ maxHeight: '70vh', top: '100%' }}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <span className="text-white font-bold text-sm">Notifications</span>
        {total > 0 && (
          <span className="text-xs text-gray-400">{total} new</span>
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
            {battleInvites.map(inv => {
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
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                    >Accept</button>
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, async () => {
                        await ctx.declineInvite(inv.id);
                      })}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                    >Decline</button>
                  </div>
                </Row>
              );
            })}
          </Section>
        )}

        {friendRequests.length > 0 && (
          <Section title="Friend Requests">
            {friendRequests.map(fr => (
              <Row key={fr.id} sender={fr.sender} time={fr.createdAt}>
                <div className="text-white text-sm font-semibold truncate">
                  {fr.sender?.username || 'Someone'} wants to be friends
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, async () => {
                      await ctx.acceptFriend(fr.id);
                    })}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
                  >Accept</button>
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, async () => {
                      await ctx.declineFriend(fr.id);
                    })}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
                  >Decline</button>
                </div>
              </Row>
            ))}
          </Section>
        )}

        {unreadMessages.length > 0 && (
          <Section title="Messages">
            {unreadMessages.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  onClose?.();
                  const name = encodeURIComponent(m.sender?.username || 'User');
                  router.push(`/social?chat=${m.sender?.id}&name=${name}`);
                }}
                className="w-full text-left"
              >
                <Row sender={m.sender} time={m.createdAt}>
                  <div className="text-white text-sm font-semibold truncate">
                    {m.sender?.username || 'Someone'}
                  </div>
                  <div className="text-gray-400 text-xs truncate">{m.preview}</div>
                </Row>
              </button>
            ))}
          </Section>
        )}
      </div>

      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={() => { onClose?.(); router.push('/social'); }}
          className="w-full text-center text-xs font-semibold text-gray-300 hover:text-white py-3"
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
