import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getBattleStreamClient } from '../lib/battleStreamClient';

const NotificationsContext = createContext(null);
const SEEN_KEY = 'piks_notif_seen_v1';
const MAX_SEEN = 250;
const POLL_MS = 25000;
const TOAST_DURATION_MS = 9000;

function readSeen() {
  if (typeof window === 'undefined') return new Set();
  try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function writeSeen(set) {
  if (typeof window === 'undefined') return;
  try {
    const arr = [...set].slice(-MAX_SEEN);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

const EMPTY = {
  battleInvites: [],
  friendRequests: [],
  unreadMessages: [],
  gameResults: [],
  pendingRematches: [],
  counts: { battleInvites: 0, friendRequests: 0, unreadMessages: 0, gameResults: 0, pendingRematches: 0, total: 0 },
};

const TYPING_TTL_MS = 4000;

export function NotificationsProvider({ children }) {
  const { data: session, status } = useSession();
  const [data, setData] = useState(EMPTY);
  const [toasts, setToasts] = useState([]);
  const [typingSenderIds, setTypingSenderIds] = useState(() => new Set());
  const [conversations, setConversations] = useState([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);
  const conversationsInflightRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const seenRef = useRef(readSeen());
  const suppressRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  const isAuthed = status === 'authenticated' && !!session?.user?.id;

  const clearTyping = useCallback((sid) => {
    if (!sid) return;
    const t = typingTimersRef.current.get(sid);
    if (t) {
      clearTimeout(t);
      typingTimersRef.current.delete(sid);
    }
    setTypingSenderIds((prev) => {
      if (!prev.has(sid)) return prev;
      const next = new Set(prev);
      next.delete(sid);
      return next;
    });
  }, []);

  const markTyping = useCallback((sid) => {
    if (!sid) return;
    const existing = typingTimersRef.current.get(sid);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => clearTyping(sid), TYPING_TTL_MS);
    typingTimersRef.current.set(sid, timer);
    setTypingSenderIds((prev) => {
      if (prev.has(sid)) return prev;
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
  }, [clearTyping]);

  const notifyTyping = useCallback(async (receiverId) => {
    if (!isAuthed || !receiverId) return;
    try {
      await fetch('/api/messages/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId }),
      });
    } catch {}
  }, [isAuthed]);

  const notifyStoppedTyping = useCallback(async (receiverId) => {
    if (!isAuthed || !receiverId) return;
    try {
      await fetch('/api/messages/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId, stop: true }),
      });
    } catch {}
  }, [isAuthed]);

  const isSuppressed = useCallback((key) => {
    if (!key) return false;
    for (const k of suppressRef.current) {
      if (key === k) return true;
    }
    return false;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const enqueueToast = useCallback((toast) => {
    if (!toast?.id) return;
    if (seenRef.current.has(toast.id)) return;
    seenRef.current.add(toast.id);
    writeSeen(seenRef.current);
    if (isSuppressed(toast.suppressKey)) return;
    setToasts(prev => {
      if (prev.some(t => t.id === toast.id)) return prev;
      return [...prev, { ...toast, createdAt: Date.now() }];
    });
  }, [isSuppressed]);

  const refreshConversations = useCallback(async () => {
    if (!isAuthed) return;
    if (conversationsInflightRef.current) return conversationsInflightRef.current;
    const promise = (async () => {
      try {
        const res = await fetch('/api/messages/conversations', { credentials: 'include' });
        if (!res.ok) {
          setConversationsError('Could not load messages.');
          return;
        }
        const json = await res.json();
        setConversations(json.conversations || []);
        setConversationsError(null);
      } catch {
        setConversationsError('Could not load messages.');
      } finally {
        setConversationsLoaded(true);
        conversationsInflightRef.current = null;
      }
    })();
    conversationsInflightRef.current = promise;
    return promise;
  }, [isAuthed]);

  const refresh = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const json = await res.json();
      const battleInvites = json.battleInvites || [];
      const friendRequests = json.friendRequests || [];
      const unreadMessages = json.unreadMessages || [];
      const gameResults = json.gameResults || [];
      const pendingRematches = json.pendingRematches || [];
      const counts = {
        battleInvites: battleInvites.length,
        friendRequests: friendRequests.length,
        unreadMessages: unreadMessages.length,
        gameResults: gameResults.length,
        pendingRematches: pendingRematches.length,
        total: battleInvites.length + friendRequests.length + unreadMessages.length + gameResults.length + pendingRematches.length,
      };
      setData({ battleInvites, friendRequests, unreadMessages, gameResults, pendingRematches, counts });

      // Catch-up path: if the API found a recent forfeit win that the SSE push
      // may have missed, dispatch it so MatchupContext can surface the modal.
      // The persistent matchups.forfeitAcknowledgedAt flag prevents duplicates —
      // the API only returns recentForfeitWin while the flag is unset.
      if (json.recentForfeitWin?.matchupId && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('piks:forfeit:win', { detail: json.recentForfeitWin })
        );
      }

      const isInitial = initialLoadRef.current;
      initialLoadRef.current = false;

      if (isInitial) {
        for (const it of battleInvites) seenRef.current.add(`invite:${it.id}`);
        for (const it of friendRequests) seenRef.current.add(`friend:${it.id}`);
        for (const it of unreadMessages) seenRef.current.add(`message:${it.id}`);
        for (const it of pendingRematches) seenRef.current.add(`rematch:${it.matchupId}`);
        writeSeen(seenRef.current);
      } else {
        for (const it of battleInvites) {
          enqueueToast({
            id: `invite:${it.id}`,
            type: 'invite',
            sender: it.sender,
            payload: it,
            suppressKey: 'battle_invites',
          });
        }
        for (const it of friendRequests) {
          enqueueToast({
            id: `friend:${it.id}`,
            type: 'friend_request',
            sender: it.sender,
            payload: it,
            suppressKey: 'friend_requests',
          });
        }
        for (const it of unreadMessages) {
          enqueueToast({
            id: `message:${it.id}`,
            type: 'message',
            sender: it.sender,
            payload: it,
            suppressKey: `message:${it.sender?.id}`,
          });
        }
        for (const it of pendingRematches) {
          enqueueToast({
            id: `rematch:${it.matchupId}`,
            type: 'rematch',
            sender: it.opponent,
            payload: it,
          });
        }
      }
    } catch {}
  }, [isAuthed, enqueueToast]);

  useEffect(() => {
    if (!isAuthed) {
      initialLoadRef.current = true;
      setData(EMPTY);
      setToasts([]);
      for (const t of typingTimersRef.current.values()) clearTimeout(t);
      typingTimersRef.current.clear();
      setTypingSenderIds(new Set());
      setConversations([]);
      setConversationsLoaded(false);
      setConversationsError(null);
      conversationsInflightRef.current = null;
      return;
    }
    refresh();
    refreshConversations();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthed, refresh, refreshConversations]);

  // Refresh conversation cache whenever the unread-message set changes so the
  // dropdown always has fresh previews ready before the user opens it.
  const unreadMessageKey = data.unreadMessages
    .map((m) => `${m.sender?.id || ''}:${m.id || ''}`)
    .sort()
    .join(',');
  useEffect(() => {
    if (!isAuthed) return;
    if (!unreadMessageKey) return;
    refreshConversations();
  }, [isAuthed, unreadMessageKey, refreshConversations]);

  // SSE listener — uses the shared SSE singleton so only ONE EventSource
  // connection is open per tab (shared with MatchupContext).
  useEffect(() => {
    if (!isAuthed || typeof window === 'undefined') return;

    const client = getBattleStreamClient();
    if (!client) return;

    const userId = session?.user?.id;

    const handleEvent = (ev) => {
      if (!ev?.type) return;
      // SSE re-established after a drop — immediately refresh so any missed
      // notification (including a forfeit win) is caught without waiting for
      // the 25-second poll interval.
      if (ev.type === 'piks:reconnected') {
        refresh();
        return;
      }
      if (ev.type === 'notification:typing') {
        if (ev.senderId) {
          if (ev.stop) clearTyping(ev.senderId);
          else markTyping(ev.senderId);
        }
      } else if (ev.type === 'notification:forfeit') {
        // Second independent push path for forfeit wins.  Dispatch a window
        // event so MatchupContext can surface the modal without a round-trip,
        // even if its own SSE handler was briefly in a reconnect window.
        if (userId && ev.winnerId === userId && ev.matchupId) {
          window.dispatchEvent(new CustomEvent('piks:forfeit:win', { detail: ev }));
        }
        refresh();
      } else if (ev.type === 'notification:rematch') {
        // Opponent accepted a rematch — show a toast immediately so the user
        // sees it even when their result popup is closed. We still call
        // refresh() below so the bell list (pendingRematches) updates too.
        if (ev.matchupId) {
          enqueueToast({
            id: `rematch:${ev.matchupId}`,
            type: 'rematch',
            sender: ev.sender || null,
            payload: { matchupId: ev.matchupId, opponent: ev.sender || null },
          });
        }
        refresh();
      } else if (ev.type === 'notification:message') {
        // Re-broadcast the message payload as a window event so the
        // messages list can bump the row instantly without refetching.
        if (ev.message && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('piks:message:new', { detail: ev.message })
          );
        }
        // Still refresh so the unread badge / unread set stay accurate
        // (no-op for outgoing messages from the sender's own session).
        refresh();
        refreshConversations();
      } else if (ev.type === 'notification:refresh' || ev.type.startsWith('notification:')) {
        refresh();
      } else if (ev.type === 'achievement:earned' && ev.achievement?.id) {
        enqueueToast({
          id: `achievement:${ev.achievement.id}`,
          type: 'achievement',
          payload: ev.achievement,
        });
      }
    };

    const unsubscribe = client.subscribe(handleEvent);

    // Catch-up: immediately reconnect and refresh notifications when the tab
    // becomes active so a missed push resolves in ~1 s, not after the 25 s poll.
    const handleVisibility = () => {
      if (!document.hidden) {
        client.reconnectNow();
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthed, refresh, markTyping, enqueueToast, session?.user?.id]);

  // Auto-dismiss toasts after their duration
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map(t => {
      const remaining = Math.max(500, TOAST_DURATION_MS - (Date.now() - t.createdAt));
      return setTimeout(() => dismissToast(t.id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  const setSuppress = useCallback((key, active) => {
    if (!key) return;
    if (active) {
      suppressRef.current.add(key);
      // Drop any visible toasts for this surface immediately.
      setToasts(prev => prev.filter(t => t.suppressKey !== key));
    } else {
      suppressRef.current.delete(key);
    }
  }, []);

  const acceptInvite = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/battles/invite/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = res.ok ? await res.json() : null;
      refresh();
      return data;
    } catch { return null; }
  }, [refresh]);

  const declineInvite = useCallback(async (id) => {
    try {
      await fetch(`/api/battles/invite/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
    } catch {}
    refresh();
  }, [refresh]);

  const acceptFriend = useCallback(async (id) => {
    try {
      await fetch(`/api/friends/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
    } catch {}
    refresh();
  }, [refresh]);

  const markMessagesRead = useCallback(async (senderIds) => {
    if (!isAuthed) return 0;
    // Optimistically clear unread messages locally so the badge updates instantly.
    setData(prev => {
      const filterFn = Array.isArray(senderIds) && senderIds.length > 0
        ? (m) => !senderIds.includes(m.sender?.id)
        : () => false;
      const remaining = prev.unreadMessages.filter(filterFn);
      if (remaining.length === prev.unreadMessages.length) return prev;
      return {
        ...prev,
        unreadMessages: remaining,
        counts: {
          ...prev.counts,
          unreadMessages: remaining.length,
          total:
            prev.counts.battleInvites +
            prev.counts.friendRequests +
            remaining.length +
            (prev.counts.gameResults || 0) +
            (prev.counts.pendingRematches || 0),
        },
      };
    });
    try {
      const res = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderIds: Array.isArray(senderIds) ? senderIds : undefined,
        }),
      });
      if (!res.ok) {
        refresh();
        return 0;
      }
      const json = await res.json();
      return json?.marked || 0;
    } catch {
      refresh();
      return 0;
    }
  }, [isAuthed, refresh]);

  const ackGameResult = useCallback(async (matchupId) => {
    if (!matchupId) return;
    // Optimistically remove the result from local state.
    setData(prev => {
      const remaining = (prev.gameResults || []).filter(r => r.matchupId !== matchupId);
      if (remaining.length === (prev.gameResults || []).length) return prev;
      return {
        ...prev,
        gameResults: remaining,
        counts: {
          ...prev.counts,
          gameResults: remaining.length,
          total:
            prev.counts.battleInvites +
            prev.counts.friendRequests +
            prev.counts.unreadMessages +
            remaining.length +
            (prev.counts.pendingRematches || 0),
        },
      };
    });
    try {
      const res = await fetch('/api/notifications/result-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchupId }),
      });
      if (!res.ok) {
        // Server rejected the ack — re-sync so the list reflects the truth.
        refresh();
      }
    } catch {
      refresh();
    }
  }, [refresh]);

  const declineFriend = useCallback(async (id) => {
    try {
      await fetch(`/api/friends/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
    } catch {}
    refresh();
  }, [refresh]);

  const value = {
    ...data,
    toasts,
    dismissToast,
    refresh,
    setSuppress,
    acceptInvite,
    declineInvite,
    acceptFriend,
    declineFriend,
    ackGameResult,
    markMessagesRead,
    typingSenderIds,
    notifyTyping,
    notifyStoppedTyping,
    clearTyping,
    conversations,
    conversationsLoaded,
    conversationsError,
    refreshConversations,
  };

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      ...EMPTY,
      toasts: [],
      dismissToast: () => {},
      refresh: () => {},
      setSuppress: () => {},
      acceptInvite: async () => {},
      declineInvite: async () => {},
      acceptFriend: async () => {},
      declineFriend: async () => {},
      markMessagesRead: async () => 0,
      typingSenderIds: new Set(),
      notifyTyping: async () => {},
      notifyStoppedTyping: async () => {},
      clearTyping: () => {},
      conversations: [],
      conversationsLoaded: false,
      conversationsError: null,
      refreshConversations: async () => {},
    };
  }
  return ctx;
}
