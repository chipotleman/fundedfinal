import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatSeenAgo } from '../utils/relativeTime';
import ActiveStatus, { isUserOnline } from '../components/ActiveStatus';

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
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full bg-gray-700 flex items-center justify-center overflow-hidden w-full h-full"
      >
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

function NotificationsFeed({ ctx, router, isDarkMode, onOpenChat }) {
  const battleInvites = ctx.battleInvites || [];
  const friendRequests = ctx.friendRequests || [];
  const unreadMessages = ctx.unreadMessages || [];
  const [busyId, setBusyId] = useState(null);

  // Group unread messages by sender so each conversation is one feed item.
  const messageGroups = useMemo(() => {
    const map = new Map();
    for (const m of unreadMessages) {
      const sid = m.sender?.id;
      if (!sid) continue;
      const existing = map.get(sid);
      if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
        map.set(sid, { ...m, count: (existing?.count || 0) + 1 });
      } else {
        existing.count = (existing.count || 0) + 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [unreadMessages]);

  const wrap = async (id, fn) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const totalNew =
    battleInvites.length + friendRequests.length + messageGroups.length;
  const empty = totalNew === 0;

  const cardBg = isDarkMode ? '#0a0a0a' : '#ffffff';
  const cardBorder = isDarkMode ? '#1a1a1a' : '#e5e7eb';
  const textPrimary = isDarkMode ? '#ffffff' : '#111111';
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <span className="text-sm font-bold" style={{ color: textPrimary }}>
          Notifications
        </span>
        <span className="text-xs" style={{ color: textSecondary }}>
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
          {battleInvites.map(inv => {
            const buyIn = parseFloat(inv.buyIn) || 0;
            return (
              <div
                key={inv.id}
                className="px-4 py-3 flex items-start gap-3"
                style={{ borderTop: `1px solid ${cardBorder}` }}
              >
                <Avatar user={inv.sender} />
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
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >Accept</button>
                    <button
                      disabled={busyId === inv.id}
                      onClick={() => wrap(inv.id, () => ctx.declineInvite(inv.id))}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
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

      {messageGroups.length > 0 && (
        <div>
          <div
            className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: textSecondary }}
          >
            Messages
          </div>
          {messageGroups.map(m => (
            <button
              key={`msg-${m.sender.id}`}
              onClick={() => onOpenChat?.(m.sender.id)}
              className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors"
              style={{ borderTop: `1px solid ${cardBorder}` }}
            >
              <Avatar user={m.sender} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  {m.sender?.username || 'Someone'}
                  {m.count > 1 && (
                    <span
                      className="ml-2 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white"
                    >{m.count}</span>
                  )}
                </div>
                <div className="text-xs truncate" style={{ color: textSecondary }}>
                  {m.content || 'New message'}
                </div>
              </div>
              <span className="text-[10px] flex-shrink-0 mt-1" style={{ color: textSecondary }}>
                {timeAgo(m.createdAt)}
              </span>
            </button>
          ))}
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
          {friendRequests.map(fr => (
            <div
              key={fr.id}
              className="px-4 py-3 flex items-start gap-3"
              style={{ borderTop: `1px solid ${cardBorder}` }}
            >
              <Avatar user={fr.sender} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  {fr.sender?.username || 'Someone'} wants to be friends
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, () => ctx.acceptFriend(fr.id))}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >Accept</button>
                  <button
                    disabled={busyId === fr.id}
                    onClick={() => wrap(fr.id, () => ctx.declineFriend(fr.id))}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
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

function ConversationThread({ friend, ctx, myId, isDarkMode }) {
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const threadEndRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const inputRef = useRef(null);
  const isTyping = !!friend?.id && ctx.typingSenderIds?.has?.(friend.id);

  // Suppress message toast for the open conversation.
  useEffect(() => {
    if (!friend?.id) return undefined;
    const key = `message:${friend.id}`;
    ctx.setSuppress?.(key, true);
    return () => ctx.setSuppress?.(key, false);
  }, [friend?.id, ctx]);

  useEffect(() => {
    if (!friend?.id) return undefined;
    let cancelled = false;
    let timer = null;

    const fetchThread = async ({ initial }) => {
      if (initial) { setLoading(true); setLoadError(null); }
      try {
        const res = await fetch(`/api/messages?friendId=${friend.id}`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled && initial) {
            setLoadError(res.status === 403 ? 'You can only message friends.' : 'Could not load messages.');
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const next = data.messages || [];
        setThread((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const incomingFromFriend = next.some(
            (m) => !prevIds.has(m.id) && m.senderId === friend.id
          );
          if (incomingFromFriend) ctx.clearTyping?.(friend.id);
          return next;
        });
      } catch {
        if (!cancelled && initial) setLoadError('Could not load messages.');
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    fetchThread({ initial: true });
    timer = setInterval(() => fetchThread({ initial: false }), 5000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchThread({ initial: false });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [friend?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [thread]);

  useEffect(() => {
    setReply('');
    setSendError(null);
    inputRef.current?.focus();
  }, [friend?.id]);

  const handleReplyChange = (e) => {
    const v = e.target.value;
    setReply(v);
    if (!friend?.id || !v.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    ctx.notifyTyping?.(friend.id);
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = reply.trim();
    if (!text || !friend?.id || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: friend.id, content: text }),
      });
      if (!res.ok) {
        setSendError(res.status === 403 ? 'You can only message friends.' : 'Could not send.');
        return;
      }
      const data = await res.json();
      if (data?.message) setThread((prev) => [...prev, data.message]);
      setReply('');
      ctx.refresh?.();
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  const cardBorder = isDarkMode ? '#1a1a1a' : '#e5e7eb';
  const textPrimary = isDarkMode ? '#ffffff' : '#111111';
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280';
  const inputBg = isDarkMode ? '#111' : '#f3f4f6';

  let lastOutgoingIdx = -1;
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].senderId === myId) { lastOutgoingIdx = i; break; }
  }
  const showSeen = lastOutgoingIdx >= 0 && thread[lastOutgoingIdx].read;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <Avatar user={friend} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
            {friend.username || 'Player'}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <ActiveStatus
              isOnline={friend.isOnline}
              lastSeenAt={friend.lastSeenAt}
              size="xs"
            />
            {(friend.battleWins != null || friend.battleLosses != null) && (
              <span className="text-[10px]" style={{ color: textSecondary }}>
                · {friend.battleWins || 0}W - {friend.battleLosses || 0}L
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {loading && (
          <div className="text-center text-xs py-6" style={{ color: textSecondary }}>Loading…</div>
        )}
        {!loading && loadError && (
          <div className="text-center text-xs py-6 text-red-400">{loadError}</div>
        )}
        {!loading && !loadError && thread.length === 0 && (
          <div className="text-center text-xs py-6" style={{ color: textSecondary }}>
            No messages yet. Say hi!
          </div>
        )}
        {!loading && !loadError && thread.map((m, idx) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.senderId === myId ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                m.senderId === myId
                  ? 'bg-emerald-600 text-white rounded-br-sm'
                  : 'bg-gray-700 text-white rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
            {showSeen && idx === lastOutgoingIdx && (
              <p className="text-[10px] mt-0.5 mr-0.5" style={{ color: textSecondary }}>
                {thread[lastOutgoingIdx].readAt
                  ? `Seen ${formatSeenAgo(thread[lastOutgoingIdx].readAt)}`
                  : 'Seen'}
              </p>
            )}
          </div>
        ))}
        <div ref={threadEndRef} />
      </div>

      <div className="h-5 px-4 flex-shrink-0" aria-live="polite">
        {isTyping && (
          <div className="flex items-center gap-1.5 text-[11px] italic" style={{ color: textSecondary }}>
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
            <span>{friend.username || 'Friend'} is typing…</span>
          </div>
        )}
      </div>

      {!loadError && (
        <form onSubmit={handleSend} className="p-3 flex-shrink-0" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={reply}
              onChange={handleReplyChange}
              placeholder="Write a message…"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              style={{ backgroundColor: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
              maxLength={1000}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
          {sendError && (
            <div className="text-red-400 text-[11px] mt-1">{sendError}</div>
          )}
        </form>
      )}
    </div>
  );
}

function MessagesPanel({ selectedId, onSelect, ctx, myId, isDarkMode }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const unreadIds = useMemo(() => {
    const s = new Set();
    (ctx.unreadMessages || []).forEach(m => { if (m.sender?.id) s.add(m.sender.id); });
    return s;
  }, [ctx.unreadMessages]);

  const previewBySender = useMemo(() => {
    const m = new Map();
    (ctx.unreadMessages || []).forEach(u => {
      if (u.sender?.id) m.set(u.sender.id, u.preview || '');
    });
    return m;
  }, [ctx.unreadMessages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/friends', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFriends(data.friends || []);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? friends.filter(f => (f.username || '').toLowerCase().includes(q))
      : friends;
    return [...filtered].sort((a, b) => {
      const au = unreadIds.has(a.id) ? 1 : 0;
      const bu = unreadIds.has(b.id) ? 1 : 0;
      if (au !== bu) return bu - au;
      return (a.username || '').localeCompare(b.username || '');
    });
  }, [friends, query, unreadIds]);

  const selectedFriend = useMemo(
    () => friends.find(f => f.id === selectedId) || null,
    [friends, selectedId]
  );

  const cardBg = isDarkMode ? '#0a0a0a' : '#ffffff';
  const cardBorder = isDarkMode ? '#1a1a1a' : '#e5e7eb';
  const textPrimary = isDarkMode ? '#ffffff' : '#111111';
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280';
  const inputBg = isDarkMode ? '#111' : '#f3f4f6';
  const rowHover = isDarkMode ? '#111111' : '#f9fafb';
  const rowSelected = isDarkMode ? '#16181c' : '#eff6ff';

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col md:flex-row"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, minHeight: 520 }}
    >
      <div
        className={`md:w-72 flex-shrink-0 flex flex-col ${selectedFriend ? 'hidden md:flex' : 'flex'}`}
        style={{ borderRight: `1px solid ${cardBorder}` }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <div className="text-sm font-bold mb-2" style={{ color: textPrimary }}>Messages</div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            style={{ backgroundColor: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
          />
        </div>
        <div className="overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 480 }}>
          {loading && (
            <div className="text-center text-xs py-6" style={{ color: textSecondary }}>Loading…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center text-xs py-8 px-4" style={{ color: textSecondary }}>
              {query ? 'No matches.' : 'No friends yet. Add friends to start messaging.'}
            </div>
          )}
          {!loading && sorted.map(f => {
            const isSelected = selectedId === f.id;
            const unread = unreadIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? rowSelected : 'transparent',
                  borderBottom: `1px solid ${cardBorder}`,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = rowHover; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Avatar
                  user={f}
                  size={36}
                  isOnline={f.isOnline ?? isUserOnline(f.lastSeenAt)}
                  onlineDotBorderColor={isSelected ? rowSelected : cardBg}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm truncate ${unread ? 'font-bold' : 'font-medium'}`}
                      style={{ color: textPrimary }}
                    >
                      {f.username || 'Player'}
                    </span>
                    {unread && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: textSecondary }}>
                    {previewBySender.get(f.id) || `${f.battleWins || 0}W-${f.battleLosses || 0}L`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${selectedFriend ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedFriend ? (
          <>
            <div className="md:hidden px-3 pt-2">
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to messages
              </button>
            </div>
            <ConversationThread
              key={selectedFriend.id}
              friend={selectedFriend}
              ctx={ctx}
              myId={myId}
              isDarkMode={isDarkMode}
            />
          </>
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center"
            style={{ color: textSecondary, minHeight: 320 }}
          >
            Select a friend to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();
  const { isDarkMode } = useTheme();

  const [mobileTab, setMobileTab] = useState('notifications');
  const [selectedId, setSelectedId] = useState(null);

  const myId = session?.user?.id;
  const isAuthed = status === 'authenticated';
  const unreadCount = ctx.counts?.unreadMessages || 0;
  const notifCount =
    (ctx.counts?.battleInvites || 0) + (ctx.counts?.friendRequests || 0);

  // Read ?chat=<id> on mount/route change to preselect a conversation.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (chatId && typeof chatId === 'string') {
      setSelectedId(chatId);
      setMobileTab('messages');
      router.replace('/notifications', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.chat]);

  // Mark only the actively-opened conversation as read. Other unread
  // conversations remain bolded in the DM list and badged in the bell until
  // the user explicitly opens them — matching FB/IG behaviour.
  useEffect(() => {
    if (!isAuthed || !selectedId) return;
    const hasUnread = (ctx.unreadMessages || []).some(m => m.sender?.id === selectedId);
    if (hasUnread) {
      ctx.markMessagesRead([selectedId]);
    }
  }, [isAuthed, selectedId, ctx.unreadMessages?.length]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    if (id) setMobileTab('messages');
  }, []);

  const bg = isDarkMode ? '#000000' : '#f3f4f6';
  const textPrimary = isDarkMode ? '#ffffff' : '#111111';
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280';

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
            Battle invites, friend requests, and direct messages all live here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
      <TopNavbar />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: textPrimary }}>
          Notifications
        </h1>

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2 mb-4">
          {[
            { key: 'notifications', label: 'Notifications', count: notifCount },
            { key: 'messages', label: 'Messages', count: unreadCount },
          ].map(tab => {
            const active = mobileTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileTab(tab.key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold relative"
                style={{
                  backgroundColor: active ? '#10b981' : (isDarkMode ? '#0a0a0a' : '#ffffff'),
                  color: active ? '#ffffff' : textPrimary,
                  border: `1px solid ${active ? '#10b981' : (isDarkMode ? '#1a1a1a' : '#e5e7eb')}`,
                }}
              >
                {tab.label}
                {tab.count > 0 && !active && (
                  <span className="absolute top-1 right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1">
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop two-column / mobile tabbed */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className={`md:col-span-2 ${mobileTab === 'notifications' ? 'block' : 'hidden'} md:block`}>
            <NotificationsFeed ctx={ctx} router={router} isDarkMode={isDarkMode} onOpenChat={handleSelect} />
          </div>
          <div className={`md:col-span-3 ${mobileTab === 'messages' ? 'block' : 'hidden'} md:block`}>
            <MessagesPanel
              selectedId={selectedId}
              onSelect={handleSelect}
              ctx={ctx}
              myId={myId}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
