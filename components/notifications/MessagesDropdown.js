import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';
import UserAvatar from '../UserAvatar';

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

function Avatar({ user, size = 36 }) {
  return (
    <UserAvatar
      avatar={user?.avatar}
      username={user?.username}
      frameId={user?.equippedFrame}
      size={size}
      bgColor="#374151"
    />
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '120ms' }} />
      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

export default function MessagesDropdown({ open, onClose, anchorRef }) {
  const router = useRouter();
  const ctx = useNotifications();
  const ref = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const liveUnreadIds = useMemo(() => {
    const s = new Set();
    (ctx.unreadMessages || []).forEach((m) => {
      if (m.sender?.id) s.add(m.sender.id);
    });
    return s;
  }, [ctx.unreadMessages]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/conversations', { credentials: 'include' });
      if (!res.ok) {
        setError('Could not load messages.');
        return;
      }
      const data = await res.json();
      setConversations(data.conversations || []);
      setError(null);
    } catch {
      setError('Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchConversations();
  }, [open, fetchConversations]);

  // Refetch when unread set changes (new message arrives) so previews stay fresh.
  const unreadKey = useMemo(
    () => Array.from(liveUnreadIds).sort().join(','),
    [liveUnreadIds]
  );
  useEffect(() => {
    if (!open) return;
    fetchConversations();
  }, [unreadKey, open, fetchConversations]);

  // Close on outside click / Escape
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

  const sorted = useMemo(() => {
    // Show only conversations that have at least one message in the dropdown.
    const withHistory = (conversations || []).filter((c) => !!c.lastMessage);
    return [...withHistory].sort((a, b) => {
      const au = (a.lastMessage?.unread || liveUnreadIds.has(a.friend.id)) ? 1 : 0;
      const bu = (b.lastMessage?.unread || liveUnreadIds.has(b.friend.id)) ? 1 : 0;
      if (au !== bu) return bu - au;
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });
  }, [conversations, liveUnreadIds]);

  if (!open) return null;

  const total = liveUnreadIds.size;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Messages"
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
          Messages
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-300"
            style={{
              backgroundColor: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
            }}
          >
            {total} unread
          </span>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 96px)' }}>
        {loading && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">Loading…</div>
        )}
        {!loading && error && (
          <div className="px-4 py-8 text-center text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No conversations yet.
          </div>
        )}
        {!loading && !error && sorted.map((c) => {
          const f = c.friend;
          const last = c.lastMessage;
          const unread = last?.unread || liveUnreadIds.has(f.id);
          const isTyping = ctx.typingSenderIds?.has?.(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onClose?.();
                router.push(`/messenger?chat=${f.id}`);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-emerald-400/5 relative"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                backgroundColor: unread ? 'rgba(16,185,129,0.06)' : 'transparent',
              }}
            >
              <Avatar user={f} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm truncate flex-1 min-w-0 text-white ${unread ? 'font-bold' : 'font-medium'}`}
                  >
                    {f.username || 'Player'}
                  </span>
                  {last?.createdAt && (
                    <span className="text-[10px] text-gray-500 flex-shrink-0">
                      {timeAgo(last.createdAt)}
                    </span>
                  )}
                  {unread && (c.unreadCount > 0 ? (
                    <span
                      className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-500 text-white flex-shrink-0 flex items-center justify-center"
                      style={{ boxShadow: '0 0 8px rgba(52,211,153,0.65)' }}
                    >
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
                      style={{ boxShadow: '0 0 8px rgba(52,211,153,0.85)' }}
                    />
                  ))}
                </div>
                <div
                  className={`text-[11px] truncate ${unread ? 'font-semibold text-white' : 'text-gray-400'}`}
                >
                  {isTyping ? (
                    <span className="text-emerald-300 italic inline-flex items-center">
                      typing<TypingDots />
                    </span>
                  ) : last ? (
                    `${last.fromMe ? 'You: ' : ''}${last.preview || last.content || ''}`
                  ) : (
                    'Say hi!'
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={() => { onClose?.(); router.push('/messenger'); }}
          className="w-full text-center text-xs font-bold py-3 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-400/5 transition-colors"
        >
          View all
        </button>
      </div>
    </div>
  );
}
