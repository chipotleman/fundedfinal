import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useNotifications } from '../../contexts/NotificationsContext';
import UserAvatar from '../UserAvatar';

// Mirror of pages/api/messages/conversations.js `buildLastMessagePreview`.
// Shared-item messages stash a JSON payload in `content`; we render a
// friendly one-liner instead of dumping the raw JSON. This client-side
// fallback covers SSE-pushed messages that arrive before the next
// conversations refresh.
function formatLastMessagePreview(last) {
  if (!last) return '';
  if (last.preview && !last.preview.startsWith('{"v"')) return last.preview;
  if (last.messageType === 'voice') return '🎤 Voice message';
  if (
    last.messageType === 'shared_battle' ||
    last.messageType === 'shared_post' ||
    last.messageType === 'shared_result'
  ) {
    let note = '';
    try {
      const parsed = JSON.parse(last.content || '');
      if (parsed && typeof parsed.note === 'string') note = parsed.note.trim();
    } catch (_e) {}
    const label =
      last.messageType === 'shared_battle' ? '⚔️ Shared a live battle'
      : last.messageType === 'shared_result' ? '🏆 Shared a battle result'
      : '📣 Shared a post';
    return note ? `${label}: ${note.slice(0, 100)}` : label;
  }
  return last.preview || last.content || '';
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
      <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '120ms' }} />
      <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

function SkeletonRow() {
  return (
    <div
      className="w-full flex items-center gap-3 px-3 py-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div
        className="rounded-full flex-shrink-0 animate-pulse"
        style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.06)' }}
      />
      <div className="flex-1 min-w-0 space-y-2">
        <div
          className="h-3 rounded animate-pulse"
          style={{ width: '40%', backgroundColor: 'rgba(255,255,255,0.08)' }}
        />
        <div
          className="h-2.5 rounded animate-pulse"
          style={{ width: '75%', backgroundColor: 'rgba(255,255,255,0.05)' }}
        />
      </div>
    </div>
  );
}

export default function MessagesDropdown({ open, onClose, anchorRef, onSelectConversation }) {
  const router = useRouter();
  const ctx = useNotifications();
  const ref = useRef(null);
  const {
    conversations,
    conversationsLoaded,
    conversationsError,
    refreshConversations,
  } = ctx;

  const liveUnreadIds = useMemo(() => {
    const s = new Set();
    (ctx.unreadMessages || []).forEach((m) => {
      if (m.sender?.id) s.add(m.sender.id);
    });
    return s;
  }, [ctx.unreadMessages]);

  // Stale-while-revalidate: silently refresh in the background each open
  // without flipping a loading flag, so cached rows stay on screen.
  useEffect(() => {
    if (!open) return;
    refreshConversations?.();
  }, [open, refreshConversations]);

  // Close on outside click / Escape. Use `click` (not `mousedown`) so the
  // original tap target — e.g. a Link or button — receives its click first.
  // On iOS Safari, closing this dropdown during `mousedown` can change the
  // layout (the fixed dropdown unmounts) and cause the subsequent `click`
  // on the link to be dropped, which manifests as a "stuck" page where
  // taps no longer navigate.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
      // Defensive: if the click target was removed from the document
      // between the click event and this handler running (e.g. a row
      // unmounted on the React re-render after an in-popup action),
      // treat it as an in-dropdown action and skip close.
      if (typeof document !== 'undefined' && !document.contains(e.target)) return;
      onClose?.();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    // Close on window scroll. Internal dropdown scrolling lives in an
    // overflow-y container so it doesn't bubble to the window. The startY
    // snapshot avoids closing on the same scroll position the dropdown
    // opened at.
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
  const showSkeleton = !conversationsLoaded && sorted.length === 0 && !conversationsError;
  const showError = conversationsLoaded && !!conversationsError && sorted.length === 0;
  const showEmpty = conversationsLoaded && !conversationsError && sorted.length === 0;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Messages"
      className="fixed left-1/2 -translate-x-1/2 top-[var(--top-nav-height,70px)] sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full mt-2 w-[calc(100vw-16px)] max-w-sm sm:w-96 sm:max-w-[calc(100vw-24px)] bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{
        maxHeight: '70vh',
        boxShadow: '0 0 0 1px rgba(59,130,246,0.10), 0 18px 48px -12px rgba(59,130,246,0.35)',
      }}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between gap-2">
        <span className="font-bold text-sm tracking-wide text-white">
          Messages
        </span>
        {total > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-blue-300"
            style={{
              backgroundColor: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
            }}
          >
            {total} unread
          </span>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 96px)' }}>
        {showSkeleton && (
          <div aria-hidden="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}
        {showError && (
          <div className="px-4 py-8 text-center text-red-400 text-sm">{conversationsError}</div>
        )}
        {showEmpty && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No conversations yet.
          </div>
        )}
        {sorted.map((c) => {
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
                if (onSelectConversation) {
                  onSelectConversation(f);
                } else {
                  router.push(`/messenger?chat=${f.id}`);
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-blue-400/5 relative"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                backgroundColor: unread ? 'rgba(59,130,246,0.06)' : 'transparent',
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
                    <span
                      className="text-[10px] text-gray-500 flex-shrink-0"
                      suppressHydrationWarning
                    >
                      {timeAgo(last.createdAt)}
                    </span>
                  )}
                  {unread && (c.unreadCount > 0 ? (
                    <span
                      className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-500 text-white flex-shrink-0 flex items-center justify-center"
                      style={{ boxShadow: '0 0 8px rgba(59,130,246,0.65)' }}
                    >
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"
                      style={{ boxShadow: '0 0 8px rgba(59,130,246,0.85)' }}
                    />
                  ))}
                </div>
                <div
                  className={`text-[11px] truncate ${unread ? 'font-semibold text-white' : 'text-gray-400'}`}
                >
                  {isTyping ? (
                    <span className="text-blue-300 italic inline-flex items-center">
                      typing<TypingDots />
                    </span>
                  ) : last ? (
                    `${last.fromMe ? 'You: ' : ''}${formatLastMessagePreview(last)}`
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
          className="w-full text-center text-xs font-bold py-3 text-blue-300 hover:text-blue-200 hover:bg-blue-400/5 transition-colors"
        >
          View all
        </button>
      </div>
    </div>
  );
}
