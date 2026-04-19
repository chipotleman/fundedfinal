import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { formatSeenAgo } from '../../utils/relativeTime';
import ActiveStatus, { isUserOnline } from '../ActiveStatus';

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
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="rounded-full bg-gray-700 flex items-center justify-center overflow-hidden w-full h-full">
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

// Scroll only the inner chat container — never call scrollIntoView, which can
// scroll the outer page if the chat body isn't itself the nearest scrollable
// ancestor. This fixes the long-standing scroll-hijack bug.
function scrollToBottom(scrollEl) {
  if (!scrollEl) return;
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

function ConversationThread({ friend, ctx, myId }) {
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const scrollRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const lastTypingFriendRef = useRef(null);
  const inputRef = useRef(null);
  const isTyping = !!friend?.id && ctx.typingSenderIds?.has?.(friend.id);

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
    if (!friend?.id || typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const m = e?.detail;
      if (!m || !m.id) return;
      const fromFriend = m.senderId === friend.id && (myId == null || m.receiverId === myId);
      const fromMeToFriend = myId != null && m.senderId === myId && m.receiverId === friend.id;
      if (!fromFriend && !fromMeToFriend) return;
      setThread((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (fromFriend) ctx.clearTyping?.(friend.id);
    };
    window.addEventListener('piks:message:new', handler);
    return () => window.removeEventListener('piks:message:new', handler);
  }, [friend?.id, myId, ctx]);

  // Scroll the *inner* container only. Never use scrollIntoView (which can
  // scroll the outer page when the chat body isn't the nearest scrollable
  // ancestor or fits within the viewport).
  useEffect(() => {
    scrollToBottom(scrollRef.current);
  }, [thread, loading]);

  useEffect(() => {
    // If we were broadcasting typing in a previous chat, send a stop ping so
    // the previous friend's open thread clears their indicator immediately
    // instead of waiting for the TTL to expire.
    const prevTypingFriend = lastTypingFriendRef.current;
    if (prevTypingFriend && prevTypingFriend !== friend?.id) {
      ctx.notifyStoppedTyping?.(prevTypingFriend);
    }
    lastTypingSentRef.current = 0;
    lastTypingFriendRef.current = null;
    setReply('');
    setSendError(null);
    inputRef.current?.focus();
  }, [friend?.id]);

  // On unmount (navigating away from the messenger entirely, closing the
  // panel, etc.) make sure we tell the friend we stopped typing so their
  // indicator doesn't linger for the full TTL. ctxRef avoids re-running
  // the cleanup on every context value identity change.
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  useEffect(() => {
    return () => {
      const f = lastTypingFriendRef.current;
      if (f) {
        ctxRef.current?.notifyStoppedTyping?.(f);
        lastTypingFriendRef.current = null;
      }
    };
  }, []);

  const handleReplyChange = (e) => {
    const v = e.target.value;
    const prev = reply;
    setReply(v);
    if (!friend?.id) return;
    // Clearing the input after typing — proactively tell the friend we
    // stopped so their indicator clears immediately rather than after TTL.
    if (!v.trim()) {
      if (prev.trim() && lastTypingFriendRef.current === friend.id) {
        ctx.notifyStoppedTyping?.(friend.id);
        lastTypingFriendRef.current = null;
        lastTypingSentRef.current = 0;
      }
      return;
    }
    const now = Date.now();
    // Throttle to once every 2 s. The receiver TTL is 4 s, so each ping
    // refreshes well before the indicator would expire mid-typing.
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    lastTypingFriendRef.current = friend.id;
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
      if (data?.message) {
        setThread((prev) => [...prev, data.message]);
        if (typeof window !== 'undefined') {
          const m = data.message;
          window.dispatchEvent(
            new CustomEvent('piks:message:new', {
              detail: {
                id: m.id,
                senderId: m.senderId,
                receiverId: m.receiverId,
                content: m.content,
                createdAt:
                  m.createdAt instanceof Date
                    ? m.createdAt.toISOString()
                    : m.createdAt,
              },
            })
          );
        }
      }
      setReply('');
      // Sending implicitly ends the typing session — tell the friend so their
      // indicator clears the moment our message lands, not 4 s later. Also
      // reset the throttle so a follow-up message broadcasts on first stroke.
      if (lastTypingFriendRef.current === friend.id) {
        ctx.notifyStoppedTyping?.(friend.id);
        lastTypingFriendRef.current = null;
      }
      lastTypingSentRef.current = 0;
      ctx.refresh?.();
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  const cardBorder = 'rgba(16,185,129,0.18)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const inputBg = '#0d1310';

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
        <Avatar
          user={friend}
          isOnline={friend?.isOnline ?? isUserOnline(friend?.lastSeenAt)}
          onlineDotBorderColor={'#0a0a0a'}
        />
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

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2 min-h-0"
      >
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
                  ? 'bg-emerald-500 text-white rounded-br-sm'
                  : 'text-white rounded-bl-sm'
              }`}
              style={
                m.senderId === myId
                  ? { boxShadow: '0 0 14px rgba(16,185,129,0.35)' }
                  : { backgroundColor: '#161b18', border: '1px solid rgba(16,185,129,0.18)' }
              }
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
      </div>

      <div className="h-5 px-4 flex-shrink-0" aria-live="polite">
        {isTyping && (
          <div className="flex items-center gap-1.5 text-[11px] italic text-emerald-300">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '240ms' }} />
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
              className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${cardBorder}`,
                color: textPrimary,
                boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.05)',
              }}
              maxLength={1000}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-shadow"
              style={{
                boxShadow: !reply.trim() || sending
                  ? 'none'
                  : '0 0 14px rgba(16,185,129,0.5)',
              }}
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

function NotFriendsCard({ userId, onFriendAdded }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setProfile(null);
    setRequestStatus(null);
    setSendError(null);
    (async () => {
      try {
        const res = await fetch(`/api/profiles/${userId}`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setLoadError(res.status === 404 ? 'User not found.' : 'Could not load user.');
          return;
        }
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setLoadError('Could not load user.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleAdd = async () => {
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (/already friends/i.test(data?.error || '')) {
          onFriendAdded?.();
          return;
        }
        setSendError(data?.error || 'Could not send friend request.');
        return;
      }
      const status = data?.status === 'accepted' ? 'accepted' : 'pending';
      setRequestStatus(status);
      if (status === 'accepted') onFriendAdded?.();
    } catch {
      setSendError('Could not send friend request.');
    } finally {
      setSending(false);
    }
  };

  const cardBorder = 'rgba(16,185,129,0.18)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const cardBg = '#0a0a0a';
  const innerBg = '#0d1310';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${cardBorder}` }}
      >
        <Avatar
          user={profile || {}}
          isOnline={profile?.isOnline ?? isUserOnline(profile?.lastSeenAt)}
          onlineDotBorderColor={cardBg}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
            {loading ? 'Loading…' : (profile?.username || 'Player')}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-8 min-h-0">
        {loading ? (
          <div className="text-xs" style={{ color: textSecondary }}>Loading…</div>
        ) : loadError ? (
          <div className="text-xs text-red-400 text-center">{loadError}</div>
        ) : (
          <div
            className="w-full max-w-sm rounded-xl p-5 text-center"
            style={{ backgroundColor: innerBg, border: `1px solid ${cardBorder}` }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>
              You're not friends yet
            </div>
            <p className="text-xs mb-4" style={{ color: textSecondary }}>
              You can only message friends — send {profile?.username || 'this player'} a friend request first.
            </p>
            {requestStatus === 'pending' && (
              <div className="text-xs mb-3" style={{ color: textSecondary }}>
                Friend request sent. You'll be able to message them once they accept.
              </div>
            )}
            {requestStatus === 'accepted' && (
              <div className="text-xs mb-3 text-emerald-400">You're now friends!</div>
            )}
            {!requestStatus && (
              <button
                type="button"
                onClick={handleAdd}
                disabled={sending}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {sending ? 'Sending…' : 'Add friend'}
              </button>
            )}
            {sendError && (
              <div className="text-red-400 text-[11px] mt-2">{sendError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function applyIncomingMessage(prev, msg, myId, selectedId) {
  if (!msg || !myId) return prev;
  const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
  if (!otherId) return prev;
  const idx = prev.findIndex((c) => c.friend?.id === otherId);
  if (idx === -1) return null;
  const target = prev[idx];
  const existingTs = target.lastMessage?.createdAt
    ? new Date(target.lastMessage.createdAt).getTime()
    : 0;
  const incomingTs = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
  if (incomingTs < existingTs) return prev;
  const fromMe = msg.senderId === myId;
  const next = prev.slice();
  next[idx] = {
    ...target,
    lastMessage: {
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: msg.content,
      preview: (msg.content || '').slice(0, 120),
      createdAt:
        typeof msg.createdAt === 'string'
          ? msg.createdAt
          : new Date(incomingTs).toISOString(),
      fromMe,
      unread: !fromMe && otherId !== selectedId,
    },
  };
  return next;
}

export default function MessagesPanel({
  selectedId,
  onSelect,
  ctx,
  myId,
  variant = 'card', // 'card' | 'fullpage'
  minHeight = 520,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [friendsError, setFriendsError] = useState(false);

  const liveUnreadIds = useMemo(() => {
    const s = new Set();
    (ctx.unreadMessages || []).forEach((m) => { if (m.sender?.id) s.add(m.sender.id); });
    return s;
  }, [ctx.unreadMessages]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/conversations', { credentials: 'include' });
      if (!res.ok) {
        setFriendsError(true);
        return;
      }
      const data = await res.json();
      setConversations(data.conversations || []);
      setFriendsError(false);
    } catch {
      setFriendsError(true);
    } finally { setLoading(false); }
  }, []);

  const loadFriends = fetchConversations;

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const unreadKey = useMemo(
    () => Array.from(liveUnreadIds).sort().join(','),
    [liveUnreadIds]
  );
  useEffect(() => {
    if (loading) return;
    fetchConversations();
  }, [unreadKey, selectedId, fetchConversations]);

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const myIdRef = useRef(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const seenMessageIdsRef = useRef(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const msg = e?.detail;
      if (!msg) return;
      if (msg.id) {
        if (seenMessageIdsRef.current.has(msg.id)) return;
        seenMessageIdsRef.current.add(msg.id);
        if (seenMessageIdsRef.current.size > 200) {
          const arr = Array.from(seenMessageIdsRef.current);
          seenMessageIdsRef.current = new Set(arr.slice(-100));
        }
      }
      const next = applyIncomingMessage(
        conversationsRef.current,
        msg,
        myIdRef.current,
        selectedIdRef.current
      );
      if (next === null) {
        fetchConversations();
        return;
      }
      if (next !== conversationsRef.current) setConversations(next);
    };
    window.addEventListener('piks:message:new', handler);
    return () => window.removeEventListener('piks:message:new', handler);
  }, [fetchConversations]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => (c.friend?.username || '').toLowerCase().includes(q))
      : conversations;
    return [...filtered].sort((a, b) => {
      const au = (a.lastMessage?.unread || liveUnreadIds.has(a.friend.id)) ? 1 : 0;
      const bu = (b.lastMessage?.unread || liveUnreadIds.has(b.friend.id)) ? 1 : 0;
      if (au !== bu) return bu - au;

      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (at !== bt) return bt - at;

      return (a.friend?.username || '').localeCompare(b.friend?.username || '');
    });
  }, [conversations, query, liveUnreadIds]);

  const selectedFriend = useMemo(
    () => conversations.find((c) => c.friend?.id === selectedId)?.friend || null,
    [conversations, selectedId]
  );

  const cardBg = '#0a0a0a';
  const cardBorder = 'rgba(16,185,129,0.22)';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const inputBg = '#0d1310';
  const rowHover = 'rgba(16,185,129,0.06)';
  const rowSelected = 'rgba(16,185,129,0.12)';
  const cardShadow = '0 0 0 1px rgba(16,185,129,0.08), 0 8px 32px -8px rgba(16,185,129,0.18)';

  const isFullpage = variant === 'fullpage';
  const containerStyle = isFullpage
    ? { backgroundColor: cardBg, border: `1px solid ${cardBorder}`, height: '100%', boxShadow: cardShadow }
    : { backgroundColor: cardBg, border: `1px solid ${cardBorder}`, minHeight, boxShadow: cardShadow };

  const sidebarMaxHeight = isFullpage ? undefined : 480;

  return (
    <div
      className={`rounded-2xl overflow-hidden flex flex-col md:flex-row ${isFullpage ? 'h-full' : ''}`}
      style={containerStyle}
    >
      <div
        className={`md:w-72 flex-shrink-0 flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}
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
        <div
          className="overflow-y-auto flex-1 min-h-0"
          style={sidebarMaxHeight ? { maxHeight: sidebarMaxHeight } : undefined}
        >
          {loading && (
            <div className="text-center text-xs py-6" style={{ color: textSecondary }}>Loading…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center text-xs py-8 px-4" style={{ color: textSecondary }}>
              {query ? 'No matches.' : 'No friends yet. Add friends to start messaging.'}
            </div>
          )}
          {!loading && sorted.map((c) => {
            const f = c.friend;
            const last = c.lastMessage;
            const isSelected = selectedId === f.id;
            const unread = (last?.unread || liveUnreadIds.has(f.id)) && !isSelected;
            const isTyping = ctx.typingSenderIds?.has?.(f.id);
            const previewText = last
              ? `${last.fromMe ? 'You: ' : ''}${last.preview || last.content || ''}`
              : `${f.battleWins || 0}W-${f.battleLosses || 0}L`;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors relative"
                style={{
                  backgroundColor: isSelected ? rowSelected : 'transparent',
                  borderBottom: `1px solid ${cardBorder}`,
                  borderLeft: isSelected ? '2px solid #34d399' : '2px solid transparent',
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
                      className={`text-sm truncate flex-1 min-w-0 ${unread ? 'font-bold' : 'font-medium'}`}
                      style={{ color: textPrimary }}
                    >
                      {f.username || 'Player'}
                    </span>
                    {last?.createdAt && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: textSecondary }}>
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
                    className={`text-[11px] truncate ${unread ? 'font-semibold' : ''}`}
                    style={{ color: unread ? textPrimary : textSecondary }}
                  >
                    {isTyping ? (
                      <span className="text-emerald-300 italic">typing…</span>
                    ) : (
                      previewText
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${selectedId ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedId && (
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
        )}
        {selectedFriend ? (
          <ConversationThread
            key={selectedFriend.id}
            friend={selectedFriend}
            ctx={ctx}
            myId={myId}
          />
        ) : selectedId && !loading && !friendsError ? (
          <NotFriendsCard
            key={selectedId}
            userId={selectedId}
            onFriendAdded={loadFriends}
          />
        ) : selectedId && friendsError ? (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center text-red-400"
            style={{ minHeight: 320 }}
          >
            Could not load your friends list. Please try again.
          </div>
        ) : selectedId ? (
          <div
            className="flex-1 flex items-center justify-center text-sm px-6 text-center"
            style={{ color: textSecondary, minHeight: 320 }}
          >
            Loading…
          </div>
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
