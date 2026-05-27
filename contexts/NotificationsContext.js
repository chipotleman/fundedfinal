import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getBattleStreamClient } from '../lib/battleStreamClient';

const NotificationsContext = createContext(null);
const SEEN_KEY = 'piks_notif_seen_v1';
// Persistent (localStorage) cache of achievement ids whose unlock celebration
// has already been shown in this browser FOR A SPECIFIC USER. Scoped by
// userId so a second account on the same device still gets to celebrate
// badges they personally just earned. Survives reloads and works in tandem
// with the server-side `celebratedAt` flag so a celebration is never
// replayed across refreshes / SSE reconnects / multiple tabs.
const ACHV_CELEBRATED_KEY_PREFIX = 'piks_achv_celebrated_v1:';
const MAX_SEEN = 250;
const MAX_CELEBRATED = 100;
const POLL_MS = 7000;
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

function celebratedKey(userId) {
  return userId ? `${ACHV_CELEBRATED_KEY_PREFIX}${userId}` : null;
}
function readCelebrated(userId) {
  if (typeof window === 'undefined') return new Set();
  const key = celebratedKey(userId);
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}
function writeCelebrated(userId, set) {
  if (typeof window === 'undefined') return;
  const key = celebratedKey(userId);
  if (!key) return;
  try {
    const arr = [...set].slice(-MAX_CELEBRATED);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

const EMPTY = {
  battleInvites: [],
  outgoingBattleInvites: [],
  friendRequests: [],
  unreadMessages: [],
  gameResults: [],
  pendingRematches: [],
  // Likes / comments on the user's own social posts. Surfaced on the bell
  // and as pink toasts so they're visually distinct from battle activity.
  socialActivity: [],
  // Lingering "you've earned new badges you haven't seen yet" signal,
  // independent of the pop-up celebration queue. Drives the small unread
  // dot on the Profile tab + Achievements section header until the user
  // actually opens the section (see markAchievementsViewed below).
  unviewedAchievementCount: 0,
  counts: { battleInvites: 0, friendRequests: 0, unreadMessages: 0, gameResults: 0, pendingRematches: 0, socialActivity: 0, total: 0 },
};

const TYPING_TTL_MS = 4000;

export function NotificationsProvider({ children }) {
  const { data: session, status } = useSession();
  const [data, setData] = useState(EMPTY);
  const [toasts, setToasts] = useState([]);
  // Queue of incoming 1v1 battle invites to surface as a full-screen modal
  // (replacing the small corner invite toast). FIFO — only the head is shown.
  const [incomingInvites, setIncomingInvites] = useState([]);
  // In-memory set of invite ids that have already been surfaced (or
  // dismissed) in this session, so we don't pop the modal twice for the
  // same invite (e.g. SSE event followed by a refresh catch-up).
  const incomingInviteSeenRef = useRef(new Set());
  // Queue of achievements to celebrate with the full-screen unlock overlay.
  // FIFO — only the head is shown. Each unlock auto-promotes to a quieter
  // toast confirmation after the overlay dismisses (see
  // dismissAchievementUnlock below).
  const [achievementUnlocks, setAchievementUnlocks] = useState([]);
  // In-memory set of achievement ids already queued for the overlay this
  // session so a duplicate SSE event doesn't celebrate the same unlock
  // twice (e.g. reconnect catch-up). Seeded (and re-seeded) per-user from
  // localStorage in the auth-state effect below — left empty here because
  // the user id isn't known at construction time.
  const achievementUnlockSeenRef = useRef(new Set());
  // Tracks which userId the current achievementUnlockSeenRef belongs to so
  // we can detect account switches and reload the per-user cache.
  const achievementUnlockUserIdRef = useRef(null);
  const [typingSenderIds, setTypingSenderIds] = useState(() => new Set());
  const [conversations, setConversations] = useState([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationsError, setConversationsError] = useState(null);
  const conversationsInflightRef = useRef(null);
  const typingTimersRef = useRef(new Map());
  const seenRef = useRef(readSeen());
  const suppressRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  // Tracks outgoing pending invites by id so we can detect when one ends
  // (declined / expired) without the sender's waiting screen being open and
  // surface a global toast + dispatch the same piks:invite:ended event.
  const outgoingInvitesRef = useRef(new Map());
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

  const addIncomingInvite = useCallback((invite) => {
    if (!invite?.id) return;
    if (incomingInviteSeenRef.current.has(invite.id)) return;
    incomingInviteSeenRef.current.add(invite.id);
    setIncomingInvites((prev) => {
      if (prev.some((i) => i.id === invite.id)) return prev;
      return [...prev, invite];
    });
  }, []);

  const dismissIncomingInvite = useCallback((id) => {
    if (!id) return;
    // Mark seen so a subsequent refresh doesn't immediately re-surface it;
    // the user can still respond from the bell.
    incomingInviteSeenRef.current.add(id);
    setIncomingInvites((prev) => prev.filter((i) => i.id !== id));
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

  const enqueueAchievementUnlock = useCallback((achievement) => {
    if (!achievement?.id) return;
    if (achievementUnlockSeenRef.current.has(achievement.id)) return;
    achievementUnlockSeenRef.current.add(achievement.id);
    setAchievementUnlocks((prev) => {
      if (prev.some((a) => a.id === achievement.id)) return prev;
      return [...prev, achievement];
    });
  }, []);

  const dismissAchievementUnlock = useCallback((id) => {
    if (!id) return;
    let dismissed = null;
    setAchievementUnlocks((prev) => {
      const next = prev.filter((a) => {
        if (a.id === id) {
          dismissed = a;
          return false;
        }
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
    if (!dismissed) return;
    // Persist client-side so a hard refresh during the same session won't
    // re-celebrate the same badge while the server flag is in-flight.
    // Scoped by userId so dismissals on this account don't suppress
    // celebrations for a different account on the same browser.
    achievementUnlockSeenRef.current.add(id);
    writeCelebrated(achievementUnlockUserIdRef.current, achievementUnlockSeenRef.current);
    // Server flag — flips profile.achievements[].celebratedAt so the catch-up
    // path in /api/notifications stops returning this id, even on another
    // device or after a long gap.
    if (typeof window !== 'undefined') {
      fetch('/api/me/achievements/celebrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ achievementIds: [id] }),
      }).catch(() => {});
    }
    // Promote the celebrated unlock to a quieter toast confirmation so users
    // who looked away still have a persistent reminder of what they earned.
    enqueueToast({
      id: `achievement:${dismissed.id}`,
      type: 'achievement',
      payload: dismissed,
    });
  }, [enqueueToast]);

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
      const outgoingBattleInvites = json.outgoingBattleInvites || [];
      const friendRequests = json.friendRequests || [];
      const unreadMessages = json.unreadMessages || [];
      const gameResults = json.gameResults || [];
      const pendingRematches = json.pendingRematches || [];
      const socialActivity = json.socialActivity || [];
      const pendingAchievementUnlocks = Array.isArray(json.pendingAchievementUnlocks)
        ? json.pendingAchievementUnlocks
        : [];
      const unviewedAchievementCount = Number.isFinite(json.unviewedAchievementCount)
        ? Math.max(0, Math.floor(json.unviewedAchievementCount))
        : 0;
      const counts = {
        battleInvites: battleInvites.length,
        friendRequests: friendRequests.length,
        unreadMessages: unreadMessages.length,
        gameResults: gameResults.length,
        pendingRematches: pendingRematches.length,
        socialActivity: socialActivity.length,
        total: battleInvites.length + friendRequests.length + unreadMessages.length + gameResults.length + pendingRematches.length + socialActivity.length,
      };
      setData({ battleInvites, outgoingBattleInvites, friendRequests, unreadMessages, gameResults, pendingRematches, socialActivity, unviewedAchievementCount, counts });

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

      // Detect outgoing invites that ended (declined / expired) since the
      // previous refresh. We compare the current pending set against the
      // tracked one — anything that disappeared has reached a terminal
      // status. Fetch the invite to learn which terminal status it hit so we
      // can show an accurate toast and fire piks:invite:ended for any open
      // conversation header. Skip on the initial load — only the receiver
      // would have been seen them then anyway.
      const previousOutgoing = outgoingInvitesRef.current;
      const currentOutgoingMap = new Map();
      for (const inv of outgoingBattleInvites) {
        currentOutgoingMap.set(inv.id, inv);
      }
      if (!isInitial) {
        for (const [id, prev] of previousOutgoing) {
          if (currentOutgoingMap.has(id)) continue;
          // Avoid double-handling the same ended invite across refreshes.
          if (seenRef.current.has(`invite_ended:${id}`)) continue;
          (async () => {
            try {
              const r = await fetch(`/api/battles/invite/${id}`);
              if (!r.ok) return;
              const j = await r.json();
              const status = j?.invite?.status;
              if (status !== 'declined' && status !== 'expired' && status !== 'cancelled') return;
              const receiver = prev.receiver || {};
              // IMPORTANT: enqueue the toast BEFORE dispatching the
              // window event. The global `piks:invite:ended` listener
              // installed below pre-marks `invite_ended:${id}` as seen
              // (so PlayFriendModal's own self-fire doesn't double-pop
              // a toast). If we dispatched first, the central detection
              // would suppress its OWN toast — which is the case where
              // PlayFriendModal is closed and the global toast is the
              // user's only signal that the invite was declined.
              enqueueToast({
                id: `invite_ended:${id}`,
                type: 'invite_ended',
                sender: receiver,
                payload: { reason: status, inviteId: id },
              });
              if (typeof window !== 'undefined' && receiver.id) {
                window.dispatchEvent(new CustomEvent('piks:invite:ended', {
                  detail: {
                    otherUserId: receiver.id,
                    otherUsername: receiver.username || null,
                    reason: status,
                    inviteId: id,
                  },
                }));
              }
            } catch {}
          })();
        }
      }
      outgoingInvitesRef.current = currentOutgoingMap;

      // Auto-close any open incoming-invite modal whose invite is no longer
      // pending on the server (cancelled, declined elsewhere, or expired).
      const pendingInviteIds = new Set(battleInvites.map((it) => it.id));
      setIncomingInvites((prev) => prev.filter((inv) => pendingInviteIds.has(inv.id)));

      if (isInitial) {
        // Mark current pending items as seen so we don't pop modals/toasts
        // for invites that already existed before the page loaded.
        // EXCEPTION: brand-new invites (created within the last 20s) are
        // most likely a friend who just hit "Invite" on us — we want the
        // full-screen modal to pop INSTANTLY for those, even if the
        // /api/notifications response beat the SSE push in to the client.
        // Without this carve-out, a race between SSE delivery and the
        // initial-load fetch could swallow the modal entirely and leave
        // the recipient seeing only the bell badge.
        const FRESH_INVITE_WINDOW_MS = 20 * 1000;
        const nowTs = Date.now();
        for (const it of battleInvites) {
          seenRef.current.add(`invite:${it.id}`);
          const created = it.createdAt ? new Date(it.createdAt).getTime() : 0;
          const isFresh = created && (nowTs - created) < FRESH_INVITE_WINDOW_MS;
          if (isFresh) {
            // Surface the modal for invites that arrived during this
            // page load. addIncomingInvite is idempotent via its own
            // seenRef, so a follow-up SSE push won't double-pop it.
            addIncomingInvite(it);
          } else {
            incomingInviteSeenRef.current.add(it.id);
          }
        }
        for (const it of friendRequests) seenRef.current.add(`friend:${it.id}`);
        for (const it of unreadMessages) seenRef.current.add(`message:${it.id}`);
        for (const it of pendingRematches) seenRef.current.add(`rematch:${it.matchupId}`);
        for (const it of socialActivity) seenRef.current.add(`social:${it.id}`);
        writeSeen(seenRef.current);
      } else {
        // Catch-up path for the full-screen invite modal: if a pending
        // invite arrived that we haven't surfaced yet (e.g. SSE was briefly
        // disconnected), push it into the modal queue now. The corner
        // invite toast is no longer used — the modal replaces it.
        for (const it of battleInvites) {
          seenRef.current.add(`invite:${it.id}`);
          addIncomingInvite(it);
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
        // Social activity (likes / comments) — surfaced as pink-accented
        // toasts that route to /battle on tap. Distinct from battle/friend
        // toasts so users who care less about social can mute them at a
        // glance via the dedicated push category.
        for (const it of socialActivity) {
          enqueueToast({
            id: `social:${it.id}`,
            type: it.type === 'comment' ? 'social_comment' : 'social_like',
            sender: it.actor,
            payload: it,
            suppressKey: 'social_activity',
          });
        }
      }

      // Surface any uncelebrated achievement unlocks the server is still
      // tracking. Runs on both initial load and subsequent refreshes so a
      // brand-new badge earned mid-session via a direct page action (e.g.
      // /api/profiles GET retroactive grant) doesn't get missed if the SSE
      // event was lost. enqueueAchievementUnlock dedupes by id and ignores
      // any badge already in the localStorage seen-set.
      for (const ach of pendingAchievementUnlocks) {
        if (ach && ach.id) enqueueAchievementUnlock(ach);
      }
    } catch {}
  }, [isAuthed, enqueueToast, addIncomingInvite, enqueueAchievementUnlock]);

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
      outgoingInvitesRef.current = new Map();
      setIncomingInvites([]);
      incomingInviteSeenRef.current = new Set();
      setAchievementUnlocks([]);
      // Drop the in-memory cache when signed out. Per-user localStorage
      // entries are preserved (each keyed by userId) so a re-login on the
      // same browser still recognises previously celebrated badges for
      // THAT account, while a different account starts with a fresh set.
      achievementUnlockSeenRef.current = new Set();
      achievementUnlockUserIdRef.current = null;
      return;
    }
    // Re-seed the celebration cache from the per-user localStorage entry
    // whenever the authenticated userId changes (login, account switch).
    const currentUserId = session?.user?.id || null;
    if (achievementUnlockUserIdRef.current !== currentUserId) {
      achievementUnlockSeenRef.current = readCelebrated(currentUserId);
      achievementUnlockUserIdRef.current = currentUserId;
    }
    refresh();
    refreshConversations();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthed, refresh, refreshConversations, session?.user?.id]);

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
      } else if (ev.type === 'notification:message_deleted') {
        // Sender unsent a message. Re-broadcast so any open thread can
        // drop the bubble immediately; also refresh the inbox so the
        // last-message preview row updates if the deleted message was
        // the most recent one in that conversation.
        if (ev.messageId && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('piks:message:deleted', {
              detail: {
                messageId: ev.messageId,
                senderId: ev.senderId,
                receiverId: ev.receiverId,
              },
            })
          );
        }
        refresh();
        refreshConversations();
      } else if (ev.type === 'notification:invite') {
        // Rich invite payload — surface the full-screen modal instantly
        // without waiting on a /api/notifications round-trip.
        if (ev.invite?.id) {
          addIncomingInvite(ev.invite);
        }
        // Still refresh so the bell count and battleInvites list stay
        // accurate (and so we can catch up if the SSE payload was
        // stripped down for any reason).
        refresh();
      } else if (ev.type === 'notification:refresh' || ev.type.startsWith('notification:')) {
        refresh();
      } else if (ev.type === 'achievement:earned' && ev.achievement?.id) {
        // Surface the full-screen unlock celebration. The overlay component
        // promotes it to a quieter toast confirmation when dismissed, so the
        // existing achievement toast still appears — just after the
        // celebratory moment, not concurrently.
        enqueueAchievementUnlock(ev.achievement);
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
    // Window focus is a more reliable catch-up trigger than visibilitychange
    // on iOS Safari and some Android browsers, which throttle/suspend SSE
    // while the tab is backgrounded. Firing both keeps invites near-instant
    // when the user returns to the tab.
    const handleFocus = () => {
      client.reconnectNow();
      refresh();
    };
    window.addEventListener('focus', handleFocus);

    // The waiting-screen modal (PlayFriendModal) handles its own
    // decline/expire/cancel feedback. When it dispatches piks:invite:ended,
    // pre-mark the invite id so our outgoing watcher won't fire a duplicate
    // global toast on the next refresh.
    const handleInviteEndedFromModal = (e) => {
      const id = e?.detail?.inviteId;
      if (!id) return;
      seenRef.current.add(`invite_ended:${id}`);
      writeSeen(seenRef.current);
      if (outgoingInvitesRef.current.has(id)) {
        outgoingInvitesRef.current.delete(id);
      }
    };
    window.addEventListener('piks:invite:ended', handleInviteEndedFromModal);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('piks:invite:ended', handleInviteEndedFromModal);
    };
  }, [isAuthed, refresh, markTyping, enqueueToast, enqueueAchievementUnlock, addIncomingInvite, session?.user?.id]);

  // Auto-dismiss toasts after their duration. Toasts flagged `persistent`
  // (currently the voice-note send-failure toast, which carries a Try-again
  // action the user may need a beat to read and tap) opt out and stay on
  // screen until they're explicitly dismissed or removed by their owner.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts
      .filter((t) => !t.persistent)
      .map(t => {
        const remaining = Math.max(500, TOAST_DURATION_MS - (Date.now() - t.createdAt));
        return setTimeout(() => dismissToast(t.id), remaining);
      });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  const setSuppress = useCallback((key, active, options) => {
    if (!key) return;
    if (active) {
      suppressRef.current.add(key);
      // Drop any visible toasts for this surface immediately, EXCEPT
      // the one that triggered the suppression (if the caller passed
      // its own toast id). Without this exclusion, expanding the
      // inline reply on a message toast would suppress and unmount
      // the very toast hosting the composer.
      const keepId = options?.excludeToastId;
      setToasts(prev => prev.filter(t => t.suppressKey !== key || (keepId && t.id === keepId)));
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
            (prev.counts.pendingRematches || 0) +
            (prev.counts.socialActivity || 0),
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
            (prev.counts.pendingRematches || 0) +
            (prev.counts.socialActivity || 0),
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

  const declineRematch = useCallback(async (matchupId) => {
    if (!matchupId) return;
    // Optimistically remove the rematch row from local state so the bell
    // updates immediately even before the server responds.
    setData(prev => {
      const remaining = (prev.pendingRematches || []).filter(r => r.matchupId !== matchupId);
      if (remaining.length === (prev.pendingRematches || []).length) return prev;
      return {
        ...prev,
        pendingRematches: remaining,
        counts: {
          ...prev.counts,
          pendingRematches: remaining.length,
          total:
            prev.counts.battleInvites +
            prev.counts.friendRequests +
            prev.counts.unreadMessages +
            (prev.counts.gameResults || 0) +
            remaining.length +
            (prev.counts.socialActivity || 0),
        },
      };
    });
    try {
      const res = await fetch(`/api/matchups/${encodeURIComponent(matchupId)}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'decline' }),
      });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }, [refresh]);

  // Optimistically zero the unread-achievements counter and tell the server
  // to flip every currently-unviewed entry's `viewedAt` flag. Called by the
  // profile page once the Achievements section actually scrolls into view
  // (NOT when the celebration popup is dismissed). Idempotent server-side,
  // so a stray double-fire is safe.
  const markAchievementsViewed = useCallback(async () => {
    if (!isAuthed) return;
    let hadUnviewed = false;
    setData((prev) => {
      if (!prev.unviewedAchievementCount) return prev;
      hadUnviewed = true;
      return { ...prev, unviewedAchievementCount: 0 };
    });
    if (!hadUnviewed) return;
    try {
      const res = await fetch('/api/me/achievements/view', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        // Server rejected — re-sync so the dot reflects the truth.
        refresh();
      }
    } catch {
      refresh();
    }
  }, [isAuthed, refresh]);

  // Mark one or more social activity entries (likes / comments on this
  // user's posts) as read. Optimistically removes them from local state so
  // the bell + dropdown clear instantly, then POSTs to the server. On
  // failure we re-sync from the API so the UI reflects ground truth.
  const ackSocial = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (list.length === 0) return;
    const idSet = new Set(list);
    setData((prev) => {
      const remaining = (prev.socialActivity || []).filter((s) => !idSet.has(s.id));
      if (remaining.length === (prev.socialActivity || []).length) return prev;
      return {
        ...prev,
        socialActivity: remaining,
        counts: {
          ...prev.counts,
          socialActivity: remaining.length,
          total:
            prev.counts.battleInvites +
            prev.counts.friendRequests +
            prev.counts.unreadMessages +
            (prev.counts.gameResults || 0) +
            (prev.counts.pendingRematches || 0) +
            remaining.length,
        },
      };
    });
    try {
      const res = await fetch('/api/notifications/social-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: list }),
      });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }, [refresh]);

  const ackAllSocial = useCallback(async () => {
    setData((prev) => {
      if ((prev.socialActivity || []).length === 0) return prev;
      return {
        ...prev,
        socialActivity: [],
        counts: {
          ...prev.counts,
          socialActivity: 0,
          total:
            prev.counts.battleInvites +
            prev.counts.friendRequests +
            prev.counts.unreadMessages +
            (prev.counts.gameResults || 0) +
            (prev.counts.pendingRematches || 0),
        },
      };
    });
    try {
      const res = await fetch('/api/notifications/social-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) refresh();
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
    enqueueToast,
    incomingInvites,
    currentIncomingInvite: incomingInvites[0] || null,
    dismissIncomingInvite,
    achievementUnlocks,
    currentAchievementUnlock: achievementUnlocks[0] || null,
    dismissAchievementUnlock,
    refresh,
    setSuppress,
    acceptInvite,
    declineInvite,
    acceptFriend,
    declineFriend,
    declineRematch,
    ackGameResult,
    ackSocial,
    ackAllSocial,
    markMessagesRead,
    markAchievementsViewed,
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
      enqueueToast: () => {},
      incomingInvites: [],
      currentIncomingInvite: null,
      dismissIncomingInvite: () => {},
      achievementUnlocks: [],
      currentAchievementUnlock: null,
      dismissAchievementUnlock: () => {},
      refresh: () => {},
      setSuppress: () => {},
      acceptInvite: async () => {},
      declineInvite: async () => {},
      acceptFriend: async () => {},
      declineFriend: async () => {},
      declineRematch: async () => {},
      ackSocial: async () => {},
      ackAllSocial: async () => {},
      markMessagesRead: async () => 0,
      markAchievementsViewed: async () => {},
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
