import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';

export default function NotificationsDropdown({ open, onClose, anchorRef }) {
  const ctx = useNotifications();
  const router = useRouter();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const { battleInvites = [], friendRequests = [], unreadMessages = [], counts } = ctx;
  const total = counts?.total || 0;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-24px)] bg-[#0d0d0d] border border-gray-700 rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{ top: '100%' }}
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="text-white font-bold text-sm">Notifications</div>
        <div className="text-gray-400 text-xs">{total} pending</div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {total === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            You're all caught up.
          </div>
        )}

        {battleInvites.map((it) => (
          <InviteRow key={`invite-${it.id}`} item={it} ctx={ctx} router={router} onClose={onClose} />
        ))}
        {friendRequests.map((it) => (
          <FriendRow key={`friend-${it.id}`} item={it} ctx={ctx} onClose={onClose} />
        ))}
        {unreadMessages.map((it) => (
          <MessageRow key={`message-${it.id}`} item={it} router={router} onClose={onClose} />
        ))}
      </div>

      <button
        onClick={() => { onClose(); router.push('/social'); }}
        className="block w-full text-center py-2.5 text-sm font-semibold text-blue-400 hover:bg-[#1a1a1a] border-t border-gray-800"
      >
        View all
      </button>
    </div>
  );
}

function Avatar({ sender }) {
  const initial = (sender?.username || '?')[0]?.toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
      {sender?.avatar ? (
        <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
      ) : (
        <span className="text-xs font-bold text-white">{initial}</span>
      )}
    </div>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(null);
  const wrap = async (label, fn) => {
    setBusy(label);
    try { await fn(); } finally { setBusy(null); }
  };
  return [busy, wrap];
}

function InviteRow({ item, ctx, router, onClose }) {
  const [busy, wrap] = useBusy();
  const sender = item.sender || {};
  const buyIn = parseFloat(item.buyIn) || 0;
  const duration = item.duration;
  return (
    <div className="px-4 py-3 border-b border-gray-800/60 hover:bg-[#141414]">
      <div className="flex items-center gap-3">
        <Avatar sender={sender} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {sender.username || 'Someone'} challenges you
          </div>
          <div className="text-gray-400 text-xs">
            ${buyIn} buy-in · ${buyIn * 2} pot{duration ? ` · ${duration}h` : ''}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          disabled={!!busy}
          onClick={() => wrap('accept', async () => {
            const data = await ctx.acceptInvite(item.id);
            onClose();
            if (data) router.push('/?battleStarted=true');
          })}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
        >{busy === 'accept' ? '...' : 'Accept'}</button>
        <button
          disabled={!!busy}
          onClick={() => wrap('decline', async () => { await ctx.declineInvite(item.id); })}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
        >{busy === 'decline' ? '...' : 'Decline'}</button>
      </div>
    </div>
  );
}

function FriendRow({ item, ctx, onClose }) {
  const [busy, wrap] = useBusy();
  const sender = item.sender || {};
  return (
    <div className="px-4 py-3 border-b border-gray-800/60 hover:bg-[#141414]">
      <div className="flex items-center gap-3">
        <Avatar sender={sender} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {sender.username || 'Someone'} wants to be friends
          </div>
          <div className="text-gray-400 text-xs">Friend request</div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          disabled={!!busy}
          onClick={() => wrap('accept', async () => { await ctx.acceptFriend(item.id); })}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg disabled:opacity-50"
        >{busy === 'accept' ? '...' : 'Accept'}</button>
        <button
          disabled={!!busy}
          onClick={() => wrap('decline', async () => { await ctx.declineFriend(item.id); })}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium py-1.5 rounded-lg disabled:opacity-50"
        >{busy === 'decline' ? '...' : 'Decline'}</button>
      </div>
    </div>
  );
}

function MessageRow({ item, router, onClose }) {
  const sender = item.sender || {};
  const preview = item.preview || '';
  return (
    <div className="px-4 py-3 border-b border-gray-800/60 hover:bg-[#141414]">
      <div className="flex items-center gap-3">
        <Avatar sender={sender} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">{sender.username || 'Someone'}</div>
          <div className="text-gray-400 text-xs truncate">{preview}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            onClose();
            const name = encodeURIComponent(sender.username || 'User');
            router.push(`/social?chat=${sender.id}&name=${name}`);
          }}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 rounded-lg"
        >Reply</button>
      </div>
    </div>
  );
}
