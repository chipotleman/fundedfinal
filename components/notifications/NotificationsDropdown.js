import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
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
  const [expandedMessageIds, setExpandedMessageIds] = useState(() => new Set());
  const messageCacheRef = useRef(new Map());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFriend, setComposeFriend] = useState(null);

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

  // Reset per-open state when the dropdown closes.
  useEffect(() => {
    if (!open) {
      setExpandedMessageIds(new Set());
      messageCacheRef.current = new Map();
      setComposeOpen(false);
      setComposeFriend(null);
    }
  }, [open]);

  // Cache message rows by sender id so the Messages section stays visible
  // for the lifetime of this open — even after `markMessagesRead` clears
  // them from `unreadMessages` — so the user can still expand and reply.
  unreadMessages.forEach((m) => {
    if (m?.sender?.id) messageCacheRef.current.set(m.sender.id, m);
  });

  const displayedMessages = (() => {
    const rows = [];
    const seen = new Set();
    for (const m of unreadMessages) {
      const sid = m?.sender?.id;
      if (sid) seen.add(sid);
      rows.push(m);
    }
    if (open) {
      for (const [sid, m] of messageCacheRef.current.entries()) {
        if (!seen.has(sid)) rows.push(m);
      }
    }
    return rows;
  })();

  const visibleTotal =
    battleInvites.length + friendRequests.length + displayedMessages.length;

  const toggleExpanded = (sid) => {
    if (!sid) return;
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const collapseExpanded = (sid) => {
    if (!sid) return;
    setExpandedMessageIds((prev) => {
      if (!prev.has(sid)) return prev;
      const next = new Set(prev);
      next.delete(sid);
      return next;
    });
  };

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
      className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl z-[70] overflow-hidden"
      style={{ maxHeight: '70vh', top: '100%' }}
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between gap-2">
        <span className="text-white font-bold text-sm">Notifications</span>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-gray-400">{total} new</span>
          )}
          <button
            type="button"
            onClick={() => {
              setComposeOpen((v) => !v);
              setComposeFriend(null);
            }}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            aria-expanded={composeOpen}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New message
          </button>
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 96px)' }}>
        {composeOpen && (
          <ComposeNew
            friend={composeFriend}
            onSelectFriend={setComposeFriend}
            onCancel={() => { setComposeOpen(false); setComposeFriend(null); }}
            onSent={() => {
              setComposeOpen(false);
              setComposeFriend(null);
              ctx.refresh?.();
            }}
          />
        )}

        {!composeOpen && visibleTotal === 0 && (
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

        {displayedMessages.length > 0 && (
          <Section title="Messages">
            {displayedMessages.map(m => (
              <MessageItem
                key={m.sender?.id || m.id}
                item={m}
                ctx={ctx}
                router={router}
                onClose={onClose}
                expanded={expandedMessageIds.has(m.sender?.id)}
                onToggle={() => toggleExpanded(m.sender?.id)}
                onCollapse={() => collapseExpanded(m.sender?.id)}
              />
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

function ComposeNew({ friend, onSelectFriend, onCancel, onSent }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (friend) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/friends', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setLoadError('Could not load friends.');
          return;
        }
        const data = await res.json();
        if (!cancelled) setFriends(data.friends || []);
      } catch {
        if (!cancelled) setLoadError('Could not load friends.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friend]);

  useEffect(() => {
    if (friend) inputRef.current?.focus();
  }, [friend]);

  const filtered = friends.filter(f =>
    !query.trim() || (f.username || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = content.trim();
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
      onSent?.();
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
          {friend ? `To ${friend.username || 'friend'}` : 'New message'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      {!friend && (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="w-full px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
          />
          <div className="mt-2 max-h-48 overflow-y-auto">
            {loading && (
              <div className="text-gray-500 text-xs text-center py-3">Loading…</div>
            )}
            {!loading && loadError && (
              <div className="text-red-400 text-xs text-center py-3">{loadError}</div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <div className="text-gray-500 text-xs text-center py-3">
                {friends.length === 0 ? 'No friends yet.' : 'No matches.'}
              </div>
            )}
            {!loading && !loadError && filtered.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectFriend?.(f)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1a1a1a] text-left"
              >
                <Avatar sender={f} size={28} />
                <span className="text-white text-xs font-medium truncate">
                  {f.username || 'Player'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {friend && (
        <form onSubmit={handleSend}>
          <div className="flex items-center gap-2 mb-2">
            <Avatar sender={friend} size={28} />
            <span className="text-white text-xs font-semibold truncate flex-1">
              {friend.username || 'Player'}
            </span>
            <button
              type="button"
              onClick={() => onSelectFriend?.(null)}
              className="text-[11px] text-gray-400 hover:text-white"
            >
              Change
            </button>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a message…"
              className="flex-1 min-w-0 px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
              maxLength={1000}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!content.trim() || sending}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
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

function MessageItem({ item, ctx, router, onClose, expanded, onToggle, onCollapse }) {
  const sender = item.sender || {};
  const preview = item.preview || '';
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const threadEndRef = useRef(null);
  const threadScrollRef = useRef(null);
  const inputRef = useRef(null);
  const atBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);

  // Suppress duplicate toast notifications for this conversation while open.
  useEffect(() => {
    if (!expanded || !sender.id) return undefined;
    const key = `message:${sender.id}`;
    ctx.setSuppress?.(key, true);
    return () => ctx.setSuppress?.(key, false);
  }, [expanded, sender.id, ctx]);

  // Load + live-refresh the recent thread while expanded.
  useEffect(() => {
    if (!expanded || !sender.id) return;
    let cancelled = false;
    let timer = null;

    const fetchThread = async ({ initial }) => {
      if (initial) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const res = await fetch(`/api/messages?friendId=${sender.id}`, { credentials: 'include' });
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
          const prevLast = prev[prev.length - 1]?.id;
          const nextLast = next[next.length - 1]?.id;
          if (prev.length === next.length && prevLast === nextLast) return prev;
          const prevIds = new Set(prev.map((m) => m.id));
          const incomingFromFriend = next.some(
            (m) => !prevIds.has(m.id) && m.senderId === sender.id
          );
          if (!initial && incomingFromFriend && !atBottomRef.current) {
            setHasNew(true);
          }
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
  }, [expanded, sender.id]);

  // Reset live-state when collapsed or sender changes.
  useEffect(() => {
    if (!expanded) {
      setHasNew(false);
      setAtBottom(true);
      atBottomRef.current = true;
      lastMessageIdRef.current = null;
    }
  }, [expanded, sender.id]);

  // Auto-scroll on first open and when the user is already at the bottom.
  useEffect(() => {
    if (!expanded) return;
    const lastId = thread[thread.length - 1]?.id || null;
    const isFirst = lastMessageIdRef.current === null;
    const changed = lastId !== lastMessageIdRef.current;
    lastMessageIdRef.current = lastId;
    if (isFirst) {
      threadEndRef.current?.scrollIntoView({ block: 'nearest' });
      inputRef.current?.focus();
      setHasNew(false);
      return;
    }
    if (changed && atBottomRef.current) {
      threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setHasNew(false);
    }
  }, [expanded, thread]);

  const handleScroll = () => {
    const el = threadScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < 24;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near && hasNew) setHasNew(false);
  };

  const jumpToLatest = () => {
    const el = threadScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    atBottomRef.current = true;
    setAtBottom(true);
    setHasNew(false);
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = reply.trim();
    if (!text || !sender.id || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: sender.id, content: text }),
      });
      if (!res.ok) {
        setSendError('Could not send.');
        return;
      }
      const data = await res.json();
      if (data?.message) setThread((prev) => [...prev, data.message]);
      setReply('');
      // Collapse and refresh so this thread is cleared from the dropdown.
      onCollapse?.();
      ctx.refresh?.();
    } catch {
      setSendError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <Row sender={sender} time={item.createdAt}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">
                {sender.username || 'Someone'}
              </div>
              <div className="text-gray-400 text-xs truncate">{preview}</div>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 mt-0.5 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </Row>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <div className="relative">
          <div
            ref={threadScrollRef}
            onScroll={handleScroll}
            className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-2 max-h-48 overflow-y-auto space-y-1.5"
          >
            {loading && (
              <div className="text-gray-500 text-xs text-center py-3">Loading…</div>
            )}
            {!loading && loadError && (
              <div className="text-red-400 text-xs text-center py-3">{loadError}</div>
            )}
            {!loading && !loadError && thread.length === 0 && (
              <div className="text-gray-500 text-xs text-center py-3">No messages yet. Say hi!</div>
            )}
            {!loading && !loadError && thread.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderId === myId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-2.5 py-1.5 rounded-2xl text-xs leading-snug break-words ${
                    m.senderId === myId
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : 'bg-gray-700 text-white rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>
          {hasNew && !atBottom && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute left-1/2 -translate-x-1/2 bottom-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-lg"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              New messages
            </button>
          )}
          </div>

          {!loadError && (
            <form onSubmit={handleSend} className="mt-2">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply…"
                  className="flex-1 min-w-0 px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  maxLength={1000}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
              {sendError && (
                <div className="text-red-400 text-[11px] mt-1">{sendError}</div>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  const name = encodeURIComponent(sender.username || 'User');
                  router.push(`/social?chat=${sender.id}&name=${name}`);
                }}
                className="mt-1.5 text-[11px] text-blue-400 hover:text-blue-300"
              >
                Open full chat →
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
