import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ProfileCacheContext = createContext(null);

export function useProfileCache() {
  const ctx = useContext(ProfileCacheContext);
  if (!ctx) {
    throw new Error('useProfileCache must be used within a ProfileCacheProvider');
  }
  return ctx;
}

export function useProfileCacheOptional() {
  return useContext(ProfileCacheContext);
}

const PROFILE_TTL_MS = 60 * 1000;
const HISTORY_TTL_MS = 60 * 1000;
const FRIEND_TTL_MS = 30 * 1000;

function mergeProfile(prev, next) {
  if (!prev) return { ...next };
  const merged = { ...prev };
  Object.keys(next || {}).forEach((k) => {
    const v = next[k];
    if (v === undefined || v === null) return;
    merged[k] = v;
  });
  return merged;
}

export function ProfileCacheProvider({ children }) {
  const [profiles, setProfiles] = useState({});
  const [histories, setHistories] = useState({});
  const [friendStatuses, setFriendStatuses] = useState({});
  const inflight = useRef({ profile: {}, history: {}, friend: {} });

  const seedProfile = useCallback((id, partial) => {
    if (!id || !partial) return;
    setProfiles((cur) => {
      const existing = cur[id]?.data;
      const merged = mergeProfile(existing, partial);
      return {
        ...cur,
        [id]: {
          data: merged,
          fetchedAt: cur[id]?.fetchedAt || 0,
          notFound: false,
        },
      };
    });
  }, []);

  const setProfileData = useCallback((id, data, opts = {}) => {
    if (!id) return;
    setProfiles((cur) => ({
      ...cur,
      [id]: {
        data: opts.replace ? data : mergeProfile(cur[id]?.data, data),
        fetchedAt: Date.now(),
        notFound: false,
      },
    }));
  }, []);

  const markProfileNotFound = useCallback((id) => {
    if (!id) return;
    setProfiles((cur) => ({
      ...cur,
      [id]: {
        data: cur[id]?.data || null,
        fetchedAt: Date.now(),
        notFound: true,
      },
    }));
  }, []);

  const setHistoryData = useCallback((id, battles, stats) => {
    if (!id) return;
    setHistories((cur) => ({
      ...cur,
      [id]: { battles: battles || [], stats: stats || null, fetchedAt: Date.now() },
    }));
  }, []);

  const setFriendStatusData = useCallback((id, status, requestId) => {
    if (!id) return;
    setFriendStatuses((cur) => ({
      ...cur,
      [id]: { status, requestId: requestId || null, fetchedAt: Date.now() },
    }));
  }, []);

  const getProfile = useCallback((id) => profiles[id] || null, [profiles]);
  const getHistory = useCallback((id) => histories[id] || null, [histories]);
  const getFriendStatus = useCallback((id) => friendStatuses[id] || null, [friendStatuses]);

  const fetchProfileInBackground = useCallback(
    async (id, { force = false } = {}) => {
      if (!id) return;
      const entry = profiles[id];
      const fresh = entry && !entry.notFound && Date.now() - entry.fetchedAt < PROFILE_TTL_MS;
      if (!force && fresh) return;
      if (inflight.current.profile[id]) return inflight.current.profile[id];
      const p = (async () => {
        try {
          const res = await fetch(`/api/profiles/${id}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setProfileData(id, data);
          } else if (res.status === 404) {
            markProfileNotFound(id);
          }
        } catch (e) {
          // swallow — caller can retry
        } finally {
          delete inflight.current.profile[id];
        }
      })();
      inflight.current.profile[id] = p;
      return p;
    },
    [profiles, setProfileData, markProfileNotFound]
  );

  const fetchHistoryInBackground = useCallback(
    async (id, { force = false } = {}) => {
      if (!id) return;
      const entry = histories[id];
      const fresh = entry && Date.now() - entry.fetchedAt < HISTORY_TTL_MS;
      if (!force && fresh) return;
      if (inflight.current.history[id]) return inflight.current.history[id];
      const p = (async () => {
        try {
          const res = await fetch(`/api/profiles/battle-history?userId=${id}`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            setHistoryData(id, data.battles, data.stats);
          }
        } catch {
          /* ignore */
        } finally {
          delete inflight.current.history[id];
        }
      })();
      inflight.current.history[id] = p;
      return p;
    },
    [histories, setHistoryData]
  );

  const fetchFriendStatusInBackground = useCallback(
    async (id, { force = false } = {}) => {
      if (!id) return;
      const entry = friendStatuses[id];
      const fresh = entry && Date.now() - entry.fetchedAt < FRIEND_TTL_MS;
      if (!force && fresh) return;
      if (inflight.current.friend[id]) return inflight.current.friend[id];
      const p = (async () => {
        try {
          const res = await fetch('/api/friends', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const isFriend = data.friends?.some((f) => f.id === id);
            if (isFriend) {
              setFriendStatusData(id, 'friends', null);
              return;
            }
          }
          const reqRes = await fetch('/api/friends/requests', { credentials: 'include' });
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            const hasPendingFromThem = reqData.requests?.some((r) => r.sender?.id === id);
            if (hasPendingFromThem) {
              setFriendStatusData(id, 'pending_received', null);
              return;
            }
          }
          const sentRes = await fetch('/api/friends/sent', { credentials: 'include' });
          if (sentRes.ok) {
            const sentData = await sentRes.json();
            const sent = sentData.requests?.find((r) => r.receiver?.id === id);
            if (sent) {
              setFriendStatusData(id, 'pending_sent', sent.id);
              return;
            }
          }
          setFriendStatusData(id, 'none', null);
        } catch {
          /* ignore */
        } finally {
          delete inflight.current.friend[id];
        }
      })();
      inflight.current.friend[id] = p;
      return p;
    },
    [friendStatuses, setFriendStatusData]
  );

  const prefetchProfile = useCallback(
    (id, seed) => {
      if (!id) return;
      if (seed) seedProfile(id, seed);
      fetchProfileInBackground(id);
      fetchHistoryInBackground(id);
    },
    [seedProfile, fetchProfileInBackground, fetchHistoryInBackground]
  );

  const value = useMemo(
    () => ({
      getProfile,
      getHistory,
      getFriendStatus,
      seedProfile,
      setProfileData,
      markProfileNotFound,
      setHistoryData,
      setFriendStatusData,
      fetchProfileInBackground,
      fetchHistoryInBackground,
      fetchFriendStatusInBackground,
      prefetchProfile,
    }),
    [
      getProfile,
      getHistory,
      getFriendStatus,
      seedProfile,
      setProfileData,
      markProfileNotFound,
      setHistoryData,
      setFriendStatusData,
      fetchProfileInBackground,
      fetchHistoryInBackground,
      fetchFriendStatusInBackground,
      prefetchProfile,
    ]
  );

  return (
    <ProfileCacheContext.Provider value={value}>{children}</ProfileCacheContext.Provider>
  );
}
