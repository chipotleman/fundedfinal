import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

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
  counts: { battleInvites: 0, friendRequests: 0, unreadMessages: 0, total: 0 },
};

export function NotificationsProvider({ children }) {
  const { data: session, status } = useSession();
  const [data, setData] = useState(EMPTY);
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(readSeen());
  const suppressRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  const isAuthed = status === 'authenticated' && !!session?.user?.id;

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

  const refresh = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const json = await res.json();
      const battleInvites = json.battleInvites || [];
      const friendRequests = json.friendRequests || [];
      const unreadMessages = json.unreadMessages || [];
      const counts = {
        battleInvites: battleInvites.length,
        friendRequests: friendRequests.length,
        unreadMessages: unreadMessages.length,
        total: battleInvites.length + friendRequests.length + unreadMessages.length,
      };
      setData({ battleInvites, friendRequests, unreadMessages, counts });

      const isInitial = initialLoadRef.current;
      initialLoadRef.current = false;

      if (isInitial) {
        for (const it of battleInvites) seenRef.current.add(`invite:${it.id}`);
        for (const it of friendRequests) seenRef.current.add(`friend:${it.id}`);
        for (const it of unreadMessages) seenRef.current.add(`message:${it.id}`);
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
      }
    } catch {}
  }, [isAuthed, enqueueToast]);

  useEffect(() => {
    if (!isAuthed) {
      initialLoadRef.current = true;
      setData(EMPTY);
      setToasts([]);
      return;
    }
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthed, refresh]);

  // SSE listener — extends the existing battle stream with notification events.
  useEffect(() => {
    if (!isAuthed || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let es = null;
    let timer = null;
    let closed = false;
    const connect = () => {
      try { es = new EventSource('/api/battles/stream'); } catch { return; }
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (!ev?.type) return;
          if (ev.type === 'notification:refresh' || ev.type.startsWith('notification:')) {
            refresh();
          }
        } catch {}
      };
      es.onerror = () => {
        if (closed) return;
        try { es && es.close(); } catch {}
        es = null;
        timer = setTimeout(() => { if (!closed) connect(); }, 4000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      try { es && es.close(); } catch {}
    };
  }, [isAuthed, refresh]);

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
          total: prev.counts.battleInvites + prev.counts.friendRequests + remaining.length,
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
    markMessagesRead,
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
    };
  }
  return ctx;
}
