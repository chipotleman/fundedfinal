import { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../../components/TopNavbar';
import UserAvatar from '../../components/UserAvatar';
import AchievementBadge from '../../components/AchievementBadge';
import AchievementDetailModal from '../../components/AchievementDetailModal';
import ActiveStatus from '../../components/ActiveStatus';
import ProfileEditPanel from '../../components/ProfileEditPanel';
import MessagePopup from '../../components/messages/MessagePopup';
import MutualFriendsModal from '../../components/notifications/MutualFriendsModal';
import MutualFriendsStack from '../../components/notifications/MutualFriendsStack';
import PlayFriendModal from '../../components/battle/PlayFriendModal';
import { readLastBuyIn, fetchLastBuyIn } from '../../utils/lastBattleBuyIn';
import { useBetSlip } from '../../contexts/BetSlipContext';
import { useProfileCache } from '../../contexts/ProfileCacheContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { getFrameById } from '../../lib/profileFrames';
import { useTheme } from '../../contexts/ThemeContext';
import {
  trackBadgeShareProfileVisit,
  BADGE_SHARE_REF,
} from '../../lib/badgeShareTracking';

const EMPTY_PROFILE = {
  username: '',
  bio: '',
  avatar: null,
  bannerUrl: null,
  favoriteTeams: [],
  equippedFrame: null,
  isOnline: false,
  isFakeOpponent: true,
  frames: [],
};

export default function PublicProfile() {
  const cache = useProfileCache();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const pageBg = isLight ? '#f1f5f9' : '#000';
  const cardBg = isLight ? '#ffffff' : '#0d0d0d';
  const innerBg = isLight ? '#f1f5f9' : '#111';
  const hairline = isLight ? '#e2e8f0' : '#1a1a1a';
  const router = useRouter();
  const { id, badge: badgeQuery, highlight: highlightQuery } = router.query;
  const notificationsCtx = useNotifications();
  const { unviewedAchievementCount, markAchievementsViewed } = notificationsCtx;
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  // Track which ?badge=<id> we've auto-opened so closing the modal doesn't
  // immediately reopen it (and so navigating to a fresh badge link still
  // triggers the auto-open the next time around).
  const autoOpenedBadgeRef = useRef(null);
  const achievementsSectionRef = useRef(null);
  // Track which badge tile to briefly emphasise after arriving from the
  // unlock celebration (?highlight=<achievementId>). Cleared after the
  // pulse animation completes so subsequent renders behave normally.
  const [highlightedBadgeId, setHighlightedBadgeId] = useState(null);
  // Ref to the matching badge tile button so we can smooth-scroll it into
  // view once the achievements grid is rendered.
  const highlightedBadgeRef = useRef(null);
  // Guard so the highlight scroll/pulse only runs once per (profile,
  // achievement) pair — prevents the effect from re-firing after we strip
  // the query param or re-render.
  const triggeredHighlightRef = useRef(null);

  const cachedProfileEntry = id ? cache.getProfile(id) : null;
  const cachedHistoryEntry = id ? cache.getHistory(id) : null;
  const cachedFriendEntry = id ? cache.getFriendStatus(id) : null;

  const [profile, setProfile] = useState(cachedProfileEntry?.data || EMPTY_PROFILE);
  const [hasProfile, setHasProfile] = useState(!!cachedProfileEntry?.data);
  const [battleHistory, setBattleHistory] = useState(cachedHistoryEntry?.battles || []);
  const [battleStats, setBattleStats] = useState(cachedHistoryEntry?.stats || null);
  const [historyLoaded, setHistoryLoaded] = useState(!!cachedHistoryEntry);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [profileNotFound, setProfileNotFound] = useState(!!cachedProfileEntry?.notFound);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar: '',
    bannerUrl: '',
    favoriteTeams: [],
    equippedFrame: null,
  });
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });
  const [saving, setSaving] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [mutualFriendsCount, setMutualFriendsCount] = useState(0);
  const [mutualFriendsPreview, setMutualFriendsPreview] = useState([]);
  const [mutualFriendsOpen, setMutualFriendsOpen] = useState(false);
  const [showBattleInvite, setShowBattleInvite] = useState(false);
  const [lastBuyIn, setLastBuyIn] = useState(null);
  const { data: session } = useSession();
  const viewerId = session?.user?.id || null;
  useEffect(() => {
    if (!viewerId) { setLastBuyIn(null); return; }
    const cached = readLastBuyIn(viewerId);
    if (cached) setLastBuyIn(cached);
    let cancelled = false;
    fetchLastBuyIn(viewerId).then((fresh) => {
      if (!cancelled && fresh) setLastBuyIn(fresh);
    });
    return () => { cancelled = true; };
  }, [viewerId]);
  const refreshLastBuyIn = async () => {
    if (!viewerId) return;
    const fresh = await fetchLastBuyIn(viewerId);
    if (fresh) setLastBuyIn(fresh);
  };
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [inlineUsernameStatus, setInlineUsernameStatus] = useState({ checking: false, available: null, error: null });
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingInline, setSavingInline] = useState(null);
  const [inlineError, setInlineError] = useState(null);
  const avatarFileRef = useRef(null);
  const bannerFileRef = useRef(null);
  const badgeShareVisitFiredRef = useRef(null);
  
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  // Look up an outgoing pending battle invite to this profile so we can
  // mirror the friend-row / search-row "Invite pending" UX and avoid letting
  // the user fire a duplicate invite the server would reject. The
  // notifications context already fetches sent invites for the bell, so we
  // reuse that data here.
  const outgoingBattleInvites = notificationsCtx.outgoingBattleInvites || [];
  const pendingOutgoingInvite = id
    ? outgoingBattleInvites.find((inv) => {
        const rid = inv.receiver?.id || inv.receiverId;
        return rid != null && String(rid) === String(id);
      }) || null
    : null;

  // Sync local state from cache whenever the id changes or the cache updates.
  useEffect(() => {
    if (!id) return;
    const entry = cache.getProfile(id);
    if (entry?.data) {
      setProfile(entry.data);
      setHasProfile(true);
      setFormData({
        username: entry.data.username || '',
        bio: entry.data.bio || '',
        avatar: entry.data.avatar || '',
        bannerUrl: entry.data.bannerUrl || '',
        favoriteTeams: Array.isArray(entry.data.favoriteTeams)
          ? entry.data.favoriteTeams.map((t) => ({ league: t.league, teamId: t.teamId }))
          : [],
        equippedFrame: entry.data.equippedFrame || null,
      });
    }
    setProfileNotFound(!!entry?.notFound && !entry?.data);
    const hist = cache.getHistory(id);
    if (hist) {
      setBattleHistory(hist.battles || []);
      setBattleStats(hist.stats || null);
      setHistoryLoaded(true);
    }
    const fs = cache.getFriendStatus(id);
    if (fs) {
      setFriendStatus(fs.status);
      setFriendRequestId(fs.requestId || null);
    }
  }, [id, cache]);

  // Reset edit state when navigating to a different profile.
  useEffect(() => {
    if (!id) return;
    setEditingUsername(false);
    setEditingBio(false);
    setInlineError(null);
  }, [id]);

  // Reset the auto-open guard when the visited profile or shared badge
  // changes, so deep-links from social/chat unfurls always pop the modal
  // for the badge in the URL on first arrival.
  useEffect(() => {
    autoOpenedBadgeRef.current = null;
  }, [id, badgeQuery]);

  // Auto-open the AchievementDetailModal for the badge referenced in
  // /profile/<id>?badge=<achievementId>. We wait until the profile's
  // frames list has been loaded so the modal renders progress data,
  // and only fire once per (id, badge) pair so closing the modal
  // doesn't immediately reopen it.
  useEffect(() => {
    if (!id || !badgeQuery) return;
    const badgeId = Array.isArray(badgeQuery) ? badgeQuery[0] : badgeQuery;
    if (!badgeId) return;
    if (autoOpenedBadgeRef.current === badgeId) return;
    if (!Array.isArray(profile?.frames) || profile.frames.length === 0) return;

    const frame = profile.frames.find((f) => f && f.achievementId === badgeId);
    const progress = Array.isArray(profile.allAchievements)
      ? profile.allAchievements.find((a) => a && a.id === badgeId)
      : null;

    let detail = null;
    if (frame) {
      detail = {
        achievementId: frame.achievementId,
        name: frame.name,
        description: frame.description,
        rarity: frame.rarity,
        earned: !!frame.unlocked,
        earnedAt: progress?.earnedAt || null,
        progressText: progress?.progressText || '',
        progressLabel: progress?.progressLabel || '',
        progressPercent: progress
          ? progress.progressPercent
          : frame.unlocked
            ? 100
            : 0,
      };
    } else if (progress) {
      detail = {
        achievementId: progress.id,
        name: progress.name,
        description: progress.description,
        earned: !!progress.earned,
        earnedAt: progress.earnedAt || null,
        progressText: progress.progressText || '',
        progressLabel: progress.progressLabel || '',
        progressPercent: progress.progressPercent || 0,
      };
    }

    if (detail) {
      autoOpenedBadgeRef.current = badgeId;
      setSelectedAchievement(detail);
    }
  }, [id, badgeQuery, profile?.frames, profile?.allAchievements]);

  // Reset the highlight guard when the visited profile or highlight target
  // changes so re-arriving from another celebration still triggers the
  // scroll + pulse for the new badge.
  useEffect(() => {
    triggeredHighlightRef.current = null;
  }, [id, highlightQuery]);

  // When arriving from the unlock celebration with ?highlight=<achievementId>,
  // scroll the achievements grid into view, briefly pulse the matching badge
  // tile, then strip the param so back/forward and refresh don't re-trigger
  // the effect (task #422). We wait for the profile's frames to load so the
  // tile actually exists in the DOM before we try to scroll to it.
  useEffect(() => {
    if (!id || !router.isReady || !highlightQuery) return;
    const targetId = Array.isArray(highlightQuery) ? highlightQuery[0] : highlightQuery;
    if (!targetId) return;
    const guardKey = `${id}|${targetId}`;
    if (triggeredHighlightRef.current === guardKey) return;
    if (!Array.isArray(profile?.frames) || profile.frames.length === 0) return;
    // Only highlight badges that actually exist in this profile's grid —
    // otherwise the scroll would land somewhere arbitrary and the pulse
    // would never appear.
    const matchingFrame = profile.frames.find((f) => f && f.achievementId === targetId);
    if (!matchingFrame) return;

    triggeredHighlightRef.current = guardKey;
    setHighlightedBadgeId(targetId);

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Defer the scroll to the next frame so the tile (and its ref) is
    // mounted before we try to bring it on-screen.
    const rafId = typeof window !== 'undefined' && window.requestAnimationFrame
      ? window.requestAnimationFrame(() => {
          const node = highlightedBadgeRef.current;
          if (node && typeof node.scrollIntoView === 'function') {
            try {
              node.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'center',
              });
            } catch {
              node.scrollIntoView();
            }
          }
        })
      : null;

    // Clear the highlight after the pulse animation finishes so the tile
    // returns to its resting state. ~3s is long enough for two pulse loops
    // without overstaying its welcome.
    const clearTimer = setTimeout(() => {
      setHighlightedBadgeId((current) => (current === targetId ? null : current));
    }, 3000);

    // Strip the query param from the URL so back/forward navigation doesn't
    // re-trigger the highlight. shallow + scroll:false avoids fighting the
    // scrollIntoView we just kicked off.
    const cleanedQuery = { ...router.query };
    delete cleanedQuery.highlight;
    router.replace(
      { pathname: router.pathname, query: cleanedQuery },
      undefined,
      { shallow: true, scroll: false },
    );

    return () => {
      if (rafId != null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafId);
      }
      clearTimeout(clearTimer);
    };
  }, [id, router.isReady, highlightQuery, profile?.frames]);

  // Determine "isOwnProfile" from session — does not block render.
  useEffect(() => {
    setIsOwnProfile(!!session?.user?.id && session.user.id === id);
  }, [session, id]);

  // Track profile visits that originated from a shared badge link
  // (e.g. /profile/123?ref=badge_share&b=first_battle). We fire once per
  // (id + ref) pair, then strip the params from the URL so a refresh or
  // share-back doesn't double-count.
  useEffect(() => {
    if (!id || !router.isReady) return;
    const ref = router.query.ref;
    if (ref !== BADGE_SHARE_REF) return;
    const badge = router.query.b;
    const key = `${id}|${typeof badge === 'string' ? badge : ''}`;
    if (badgeShareVisitFiredRef.current === key) return;
    badgeShareVisitFiredRef.current = key;
    trackBadgeShareProfileVisit({
      profileId: id,
      achievementId: typeof badge === 'string' ? badge : null,
    });
    // Clean the URL so the analytics ping isn't repeated on refresh and the
    // tracking params don't leak into subsequent re-shares.
    const cleanedQuery = { ...router.query };
    delete cleanedQuery.ref;
    delete cleanedQuery.b;
    router.replace(
      { pathname: router.pathname, query: cleanedQuery },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [id, router.isReady, router.query.ref, router.query.b]);

  // Mark uncelebrated/unviewed achievements as viewed once the section is
  // actually visible on the user's own profile. This is what clears the
  // unread dot on the Profile tab + Achievements header — distinct from
  // dismissing the celebration popup, which only flips celebratedAt.
  // Using IntersectionObserver so simply landing on the page (e.g. above
  // the fold) doesn't count if the user never scrolled to the section.
  // Pre-feature badges have viewedAt === undefined and are excluded server
  // side, so the dot only fires for genuinely-new unlocks.
  useEffect(() => {
    if (!isOwnProfile) return;
    if (!unviewedAchievementCount) return;
    const node = achievementsSectionRef.current;
    if (!node) return;
    if (typeof window === 'undefined') return;

    // Some browsers / SSR shims don't expose IntersectionObserver — fall
    // back to firing once on mount so the dot still clears.
    if (typeof IntersectionObserver === 'undefined') {
      markAchievementsViewed?.();
      return;
    }

    let fired = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (fired) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fired = true;
            markAchievementsViewed?.();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOwnProfile, unviewedAchievementCount, markAchievementsViewed]);

  // Trigger background refresh on every navigation.
  useEffect(() => {
    if (!id) return;
    cache.fetchProfileInBackground(id, { force: true });
    cache.fetchHistoryInBackground(id, { force: true }).then(() => {
      setHistoryLoaded(true);
    });
    if (session?.user?.id && session.user.id !== id) {
      cache.fetchFriendStatusInBackground(id, { force: true });
    }
  }, [id, session, cache]);

  // Fetch the mutual-friends count + 3-avatar preview whenever a signed-in
  // viewer lands on someone else's profile so the "<N> mutual friends"
  // badge can render its avatar stack before the popup is opened. Uses the
  // lightweight countOnly mode so we don't pay for full presence /
  // "how do you know them" enrichment up front — the modal itself does
  // that fetch on open. A single round-trip backs both the count and the
  // preview so we don't double the cost of profile load. Hidden on own
  // profile and for signed-out viewers per the task spec.
  useEffect(() => {
    if (!id) return undefined;
    if (!session?.user?.id) {
      setMutualFriendsCount(0);
      setMutualFriendsPreview([]);
      return undefined;
    }
    if (session.user.id === id) {
      setMutualFriendsCount(0);
      setMutualFriendsPreview([]);
      return undefined;
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Clear immediately so a previous profile's count/preview never lingers
    // on the header while the new fetch is in flight (or if it ultimately
    // fails).
    setMutualFriendsCount(0);
    setMutualFriendsPreview([]);
    fetch(
      `/api/notifications/mutual-friends?userId=${encodeURIComponent(id)}&countOnly=1`,
      { credentials: 'same-origin', signal: ctrl?.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          setMutualFriendsCount(0);
          setMutualFriendsPreview([]);
          return;
        }
        const data = await res.json();
        const n = Number(data?.mutualFriendsCount) || 0;
        const preview = Array.isArray(data?.mutualFriendPreview)
          ? data.mutualFriendPreview
          : [];
        setMutualFriendsCount(n);
        setMutualFriendsPreview(preview);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // Silently swallow — the badge just won't render. Other surfaces
        // (search, live feed) still work without it.
        setMutualFriendsCount(0);
        setMutualFriendsPreview([]);
      });
    return () => {
      try { ctrl?.abort(); } catch (_e) {}
    };
  }, [id, session?.user?.id]);

  const fetchProfile = async () => {
    if (!id) return;
    await Promise.all([
      cache.fetchProfileInBackground(id, { force: true }),
      cache.fetchHistoryInBackground(id, { force: true }),
    ]);
    setHistoryLoaded(true);
  };

  const handleAddFriend = async () => {
    setFriendActionLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFriendStatus(data.status === 'accepted' ? 'friends' : 'pending_sent');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!friendRequestId) return;
    setFriendActionLoading(true);
    try {
      const res = await fetch(`/api/friends/${friendRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      if (res.ok) {
        setFriendStatus('none');
        setFriendRequestId(null);
      }
    } catch (error) {
      console.error('Error withdrawing friend request:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    setFriendActionLoading(true);
    try {
      await fetch(`/api/friends/${id}`, { method: 'DELETE', credentials: 'include' });
      setFriendStatus('none');
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, error: 'Username must be at least 3 characters' });
      return;
    }

    setUsernameStatus({ checking: true, available: null, error: null });

    try {
      const res = await fetch(`/api/profiles/check-username?username=${encodeURIComponent(username)}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.available) {
        setUsernameStatus({ checking: false, available: true, error: null });
      } else {
        setUsernameStatus({ checking: false, available: false, error: data.error || 'Username is taken' });
      }
    } catch (error) {
      setUsernameStatus({ checking: false, available: null, error: 'Failed to check username' });
    }
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, username: value });
    
    if (value !== profile?.username) {
      const timeoutId = setTimeout(() => checkUsername(value), 500);
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameStatus({ checking: false, available: true, error: null });
    }
  };

  const handleSave = async () => {
    if (usernameStatus.available === false) return;

    setSaving(true);
    try {
      const res = await fetch('/api/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setEditing(false);
        await fetchProfile();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, avatar: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const uploadFileToObjectStorage = async (file) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be smaller than 5MB');
    }
    const { uploadToBlob } = await import('../../utils/blobUpload');
    const { url } = await uploadToBlob(file, { kind: 'avatar' });
    return url;
  };

  const persistProfile = async (payload) => {
    const res = await fetch('/api/profiles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not save changes');
    }
    return res.json();
  };

  const handleInlineAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingInline('avatar');
    setInlineError(null);
    try {
      const path = await uploadFileToObjectStorage(file);
      await persistProfile({ avatar: path });
      setProfile((p) => ({ ...p, avatar: path }));
      setFormData((f) => ({ ...f, avatar: path }));
      cache.setProfileData(id, { avatar: path });
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const handleInlineBannerChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingInline('banner');
    setInlineError(null);
    try {
      const path = await uploadFileToObjectStorage(file);
      await persistProfile({ bannerUrl: path });
      setProfile((p) => ({ ...p, bannerUrl: path }));
      setFormData((f) => ({ ...f, bannerUrl: path }));
      cache.setProfileData(id, { bannerUrl: path });
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const startEditUsername = () => {
    setUsernameDraft(profile?.username || '');
    setInlineError(null);
    setInlineUsernameStatus({ checking: false, available: null, error: null });
    setEditingUsername(true);
  };

  useEffect(() => {
    if (!editingUsername) return;
    const next = usernameDraft.trim();
    if (next === (profile?.username || '')) {
      setInlineUsernameStatus({ checking: false, available: null, error: null });
      return;
    }
    if (next.length < 3) {
      setInlineUsernameStatus({ checking: false, available: false, error: 'Username must be at least 3 characters' });
      return;
    }
    if (next.length > 20) {
      setInlineUsernameStatus({ checking: false, available: false, error: 'Username must be 20 characters or less' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(next)) {
      setInlineUsernameStatus({ checking: false, available: false, error: 'Letters, numbers and underscores only' });
      return;
    }
    setInlineUsernameStatus({ checking: true, available: null, error: null });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles/check-username?username=${encodeURIComponent(next)}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.available) {
          setInlineUsernameStatus({ checking: false, available: true, error: null });
        } else {
          setInlineUsernameStatus({
            checking: false,
            available: false,
            error: data.error || 'Username is already taken',
          });
        }
      } catch {
        if (!cancelled) {
          setInlineUsernameStatus({ checking: false, available: null, error: 'Could not check availability' });
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [usernameDraft, editingUsername, profile?.username]);

  const saveUsername = async () => {
    const next = usernameDraft.trim();
    if (!next) {
      setInlineError('Username cannot be empty');
      return;
    }
    if (next === (profile?.username || '')) {
      setEditingUsername(false);
      return;
    }
    if (inlineUsernameStatus.available === false) {
      setInlineError(inlineUsernameStatus.error || 'Username is already taken');
      return;
    }
    setSavingInline('username');
    setInlineError(null);
    try {
      await persistProfile({ username: next });
      setProfile((p) => ({ ...p, username: next }));
      setFormData((f) => ({ ...f, username: next }));
      cache.setProfileData(id, { username: next });
      setEditingUsername(false);
      setInlineUsernameStatus({ checking: false, available: null, error: null });
    } catch (err) {
      setInlineError(err.message);
      setInlineUsernameStatus({ checking: false, available: false, error: err.message });
    } finally {
      setSavingInline(null);
    }
  };

  const startEditBio = () => {
    setBioDraft(profile?.bio || '');
    setInlineError(null);
    setEditingBio(true);
  };

  const saveBio = async () => {
    const next = bioDraft.trim();
    if (next === (profile?.bio || '')) {
      setEditingBio(false);
      return;
    }
    setSavingInline('bio');
    setInlineError(null);
    try {
      await persistProfile({ bio: next });
      setProfile((p) => ({ ...p, bio: next }));
      setFormData((f) => ({ ...f, bio: next }));
      cache.setProfileData(id, { bio: next });
      setEditingBio(false);
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'tie': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const winRate = battleStats && battleStats.totalBattles > 0 
    ? Math.round((battleStats.wins / battleStats.totalBattles) * 100) 
    : 0;

  // Filter + group battle history so the profile's battle list is
  // browsable instead of an endless flat scroll. Filter pills narrow
  // by outcome (or in-progress) and the remaining items are bucketed
  // into time-based sections (This Week / This Month / Earlier).
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return battleHistory;
    if (historyFilter === 'wins') return battleHistory.filter((b) => b.result === 'win');
    if (historyFilter === 'losses') return battleHistory.filter((b) => b.result === 'loss');
    if (historyFilter === 'active') return battleHistory.filter((b) => b.result === 'pending' || b.status !== 'completed');
    return battleHistory;
  }, [battleHistory, historyFilter]);

  const groupedHistory = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const buckets = {
      active: { key: 'active', label: 'In Progress', battles: [] },
      week: { key: 'week', label: 'This Week', battles: [] },
      month: { key: 'month', label: 'This Month', battles: [] },
      earlier: { key: 'earlier', label: 'Earlier', battles: [] },
    };
    for (const b of filteredHistory) {
      if (b.result === 'pending' || b.status !== 'completed') {
        buckets.active.battles.push(b);
        continue;
      }
      const ts = new Date(b.endsAt || b.createdAt || 0).getTime();
      const diff = now - ts;
      if (diff <= 7 * DAY) buckets.week.battles.push(b);
      else if (diff <= 30 * DAY) buckets.month.battles.push(b);
      else buckets.earlier.battles.push(b);
    }
    return [buckets.active, buckets.week, buckets.month, buckets.earlier].filter((g) => g.battles.length > 0);
  }, [filteredHistory]);

  const historyFilterPills = [
    { key: 'all', label: 'All', count: battleStats?.totalBattles ?? battleHistory.length },
    { key: 'wins', label: 'Wins', count: battleStats?.wins ?? 0 },
    { key: 'losses', label: 'Losses', count: battleStats?.losses ?? 0 },
    { key: 'active', label: 'Active', count: battleHistory.filter((b) => b.result === 'pending' || b.status !== 'completed').length },
  ];

  if (profileNotFound && !hasProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>Profile not found</h2>
          <Link href="/">
            <button className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg">
              Go to Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <TopNavbar 
        user={session?.user}
        bankroll={0}
        pnl={0}
        betSlipCount={betSlip?.length || 0}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      
      <div className="pt-16 pb-24 px-4 max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: cardBg, border: `1px solid ${hairline}`, boxShadow: 'none' }}>
          <div
            className={`relative w-full group ${isOwnProfile ? 'cursor-pointer' : ''}`}
            style={{
              height: '160px',
              background: profile.bannerUrl
                ? `url(${profile.bannerUrl}) center/cover`
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            }}
            onClick={isOwnProfile ? () => bannerFileRef.current?.click() : undefined}
            role={isOwnProfile ? 'button' : undefined}
            aria-label={isOwnProfile ? 'Change cover photo' : undefined}
          >
            {isOwnProfile && (
              <>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInlineBannerChange}
                />
                <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${profile.bannerUrl ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {savingInline === 'banner' ? 'Uploading...' : (profile.bannerUrl ? 'Change cover' : 'Add cover photo')}
                  </div>
                </div>
                {savingInline === 'banner' && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-[10px] font-semibold">
                    Saving...
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-6 sm:p-8 -mt-12 relative">
            {editing ? (
              <ProfileEditPanel
                profile={profile}
                formData={formData}
                setFormData={setFormData}
                usernameStatus={usernameStatus}
                onUsernameChange={handleUsernameChange}
                onSave={handleSave}
                onCancel={() => {
                  setEditing(false);
                  setFormData({
                    username: profile.username || '',
                    bio: profile.bio || '',
                    avatar: profile.avatar || '',
                    bannerUrl: profile.bannerUrl || '',
                    favoriteTeams: Array.isArray(profile.favoriteTeams)
                      ? profile.favoriteTeams.map((t) => ({ league: t.league, teamId: t.teamId }))
                      : [],
                    equippedFrame: profile.equippedFrame || null,
                  });
                }}
                saving={saving}
              />
            ) : (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              <div className="relative">
                <div
                  className={`rounded-full p-1 group relative ${isOwnProfile ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: cardBg,
                  }}
                  onClick={isOwnProfile ? () => avatarFileRef.current?.click() : undefined}
                  role={isOwnProfile ? 'button' : undefined}
                  aria-label={isOwnProfile ? 'Change profile picture' : undefined}
                >
                  {/* No `isOnline` dot here on purpose — the camera
                      badge sits in the bottom-right corner and was
                      overlapping the dot, AND the <ActiveStatus />
                      line right below the username already conveys
                      online state textually. Showing both is just
                      visual noise per user feedback. */}
                  <UserAvatar
                    user={{ id: profile.id || id, username: profile.username }}
                    avatar={profile.avatar}
                    username={profile.username}
                    frameId={profile.equippedFrame}
                    size={96}
                    bgColor={'#1a1a1a'}
                    textColor={'#fff'}
                  />
                  {isOwnProfile && (
                    <>
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleInlineAvatarChange}
                      />
                      <div className="absolute inset-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-[10px] font-semibold text-center px-1">
                          {savingInline === 'avatar' ? 'Saving...' : (profile.avatar ? 'Change' : 'Add photo')}
                        </span>
                      </div>
                      <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 border-2 border-[#0d0d0d] flex items-center justify-center pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
                {winRate >= 60 && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    TOP
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                <>
                  {editingUsername ? (
                    <div className="mb-1">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <input
                          type="text"
                          value={usernameDraft}
                          onChange={(e) => setUsernameDraft(e.target.value)}
                          autoFocus
                          maxLength={20}
                          className="rounded-lg px-3 py-1.5 text-xl font-bold focus:outline-none focus:border-blue-500"
                          style={{ backgroundColor: innerBg, border: `1px solid ${hairline}`, color: isLight ? '#0f172a' : '#ffffff' }}
                        />
                        <button
                          onClick={saveUsername}
                          disabled={
                            savingInline === 'username' ||
                            inlineUsernameStatus.checking ||
                            inlineUsernameStatus.available === false
                          }
                          className="bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                        >
                          {savingInline === 'username' ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingUsername(false);
                            setInlineError(null);
                            setInlineUsernameStatus({ checking: false, available: null, error: null });
                          }}
                          className="text-xs font-semibold py-1.5 px-3 rounded-lg"
                          style={{ backgroundColor: innerBg, border: `1px solid ${hairline}`, color: isLight ? '#475569' : '#9ca3af' }}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="mt-1 text-xs min-h-[16px] text-center md:text-left" aria-live="polite">
                        {inlineUsernameStatus.checking && (
                          <span className="text-gray-400">Checking availability…</span>
                        )}
                        {!inlineUsernameStatus.checking && inlineUsernameStatus.available === true && (
                          <span className="text-green-400">Username available</span>
                        )}
                        {!inlineUsernameStatus.checking && inlineUsernameStatus.error && (
                          <span className="text-red-400">{inlineUsernameStatus.error}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                      <h1 className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {profile.username || 'Anonymous'}
                      </h1>
                      {isOwnProfile && (
                        <button
                          onClick={startEditUsername}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                          aria-label="Edit username"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {!profile.isFakeOpponent && (
                    <div className="mb-2 flex justify-center md:justify-start">
                      <ActiveStatus
                        isOnline={profile.isOnline}
                        lastSeenAt={profile.lastSeenAt}
                        size="md"
                      />
                    </div>
                  )}
                  {editingBio ? (
                    <div className="mb-3">
                      <textarea
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        autoFocus
                        maxLength={200}
                        rows={3}
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        style={{ backgroundColor: innerBg, border: `1px solid ${hairline}`, color: isLight ? '#0f172a' : '#ffffff' }}
                        placeholder="Tell people about yourself..."
                      />
                      <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                        <button
                          onClick={saveBio}
                          disabled={savingInline === 'bio'}
                          className="bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                        >
                          {savingInline === 'bio' ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingBio(false); setInlineError(null); }}
                          className="text-xs font-semibold py-1.5 px-3 rounded-lg"
                          style={{ backgroundColor: innerBg, border: `1px solid ${hairline}`, color: isLight ? '#475569' : '#9ca3af' }}
                        >
                          Cancel
                        </button>
                        <span className="text-[10px] text-gray-500 ml-auto">{bioDraft.length}/200</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 mb-3 justify-center md:justify-start">
                      <p className="text-gray-500 text-sm">{profile.bio || (isOwnProfile ? 'Add a bio' : 'No bio yet')}</p>
                      {isOwnProfile && (
                        <button
                          onClick={startEditBio}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-1 mt-[-2px]"
                          aria-label="Edit bio"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {isOwnProfile && inlineError && (
                    <p className="text-red-400 text-xs mb-2">{inlineError}</p>
                  )}
                  {(() => {
                    const equipped = profile.equippedFrame ? getFrameById(profile.equippedFrame) : null;
                    if (!equipped) return null;
                    return (
                      <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
                        <span className="mr-1">{equipped.icon}</span>
                        Wearing <span style={{ color: isLight ? '#0f172a' : '#fff' }}>{equipped.name}</span>
                      </p>
                    );
                  })()}
                  {!isOwnProfile && session?.user?.id && mutualFriendsCount > 0 && (
                    <div className="flex justify-center md:justify-start mb-3">
                      {/*
                        Pill: avatar stack + count text. We can't nest the
                        per-avatar `<Link>`s inside an outer `<button>` (HTML
                        doesn't allow interactive descendants of buttons), so
                        the pill is a presentational `<div>` containing two
                        independent interactive children — the stack (each
                        avatar links to its profile, "+N" opens the popup)
                        and the count `<button>` (also opens the popup). When
                        no preview is available (cold load, or count===0
                        which is already filtered above) we fall back to the
                        people icon so the pill never renders empty.
                      */}
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: 'rgba(168,85,247,0.12)',
                          border: '1px solid rgba(168,85,247,0.45)',
                          color: '#e9d5ff',
                        }}
                      >
                        {mutualFriendsPreview.length > 0 ? (
                          <MutualFriendsStack
                            preview={mutualFriendsPreview}
                            size={18}
                            total={mutualFriendsCount}
                            onSeeAll={() => setMutualFriendsOpen(true)}
                          />
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        )}
                        <button
                          type="button"
                          onClick={() => setMutualFriendsOpen(true)}
                          className="rounded-full transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          style={{ color: 'inherit', background: 'transparent' }}
                          aria-label={`See ${mutualFriendsCount} mutual ${mutualFriendsCount === 1 ? 'friend' : 'friends'}`}
                        >
                          {mutualFriendsCount} mutual {mutualFriendsCount === 1 ? 'friend' : 'friends'}
                        </button>
                      </div>
                    </div>
                  )}
                  {Array.isArray(profile.favoriteTeams) && profile.favoriteTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center md:justify-start mb-3">
                      {profile.favoriteTeams.map((t) => (
                        <span
                          key={`${t.league}:${t.teamId}`}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: innerBg,
                            border: `1px solid ${hairline}`,
                            color: isLight ? '#334155' : '#e5e7eb',
                          }}
                        >
                          {t.logo ? (
                            <img src={t.logo} alt="" className="w-4 h-4 object-contain" />
                          ) : (
                            <span
                              className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[8px] font-bold"
                              style={{ backgroundColor: hairline }}
                            >
                              {t.teamId?.slice(0, 3)}
                            </span>
                          )}
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-500">{t.league}</span>
                        </span>
                      ))}
                    </div>
                  )}
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className={`font-medium py-1.5 px-4 rounded-lg transition-all text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}
                        style={{ backgroundColor: innerBg, border: `1px solid ${hairline}` }}
                      >
                        Edit Profile
                      </button>
                    )}
                    
                    {!isOwnProfile && session?.user && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setMessageOpen(true)}
                          aria-label="Message"
                          title="Message"
                          className="bg-[#1a1a1a] hover:bg-[#222] focus:bg-[#222] text-blue-400 hover:text-blue-300 font-semibold p-2 rounded-lg transition-all text-sm flex items-center justify-center border border-[#2a2a2a] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </button>
                        {friendStatus === 'none' && (
                          <button
                            onClick={handleAddFriend}
                            disabled={friendActionLoading}
                            className="bg-blue-600 disabled:opacity-40 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                          >
                            {friendActionLoading ? 'Sending...' : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Add Friend
                              </>
                            )}
                          </button>
                        )}
                        
                        {friendStatus === 'pending_sent' && (
                          <button
                            onClick={handleWithdrawRequest}
                            disabled={friendActionLoading}
                            className="bg-red-600/20 disabled:opacity-40 text-red-400 font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                          >
                            {friendActionLoading ? 'Cancelling...' : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel Friend Request
                              </>
                            )}
                          </button>
                        )}
                        
                        {friendStatus === 'pending_received' && (
                          <button
                            onClick={handleAddFriend}
                            disabled={friendActionLoading}
                            className="bg-green-600 disabled:opacity-40 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                          >
                            {friendActionLoading ? 'Accepting...' : 'Accept Request'}
                          </button>
                        )}
                        
                        {friendStatus === 'friends' && (
                          <>
                            {pendingOutgoingInvite ? (
                              /* When an invite to this user is already pending,
                                 mirror the friend-row / search-row UX: surface
                                 an "Invite pending" pill that jumps to the
                                 Invites tab on /battle and highlights the
                                 existing invite, instead of letting the user
                                 fire a duplicate the server would reject. */
                              <button
                                onClick={() => router.push(`/battle?invite=${pendingOutgoingInvite.id}`)}
                                className="inline-flex items-center gap-2 bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                title="View pending invite"
                              >
                                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                Invite Pending
                              </button>
                            ) : (
                              <button
                                onClick={() => setShowBattleInvite(true)}
                                className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Challenge to Battle
                              </button>
                            )}
                            <button
                              onClick={handleRemoveFriend}
                              disabled={friendActionLoading}
                              className="bg-red-600/20 text-red-400 font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                            >
                              {friendActionLoading ? '...' : 'Remove Friend'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                </>
              </div>
            </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${hairline}` }}>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${hairline}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Battles</p>
              <p className={`text-xl font-black mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{battleStats?.totalBattles || 0}</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${hairline}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Win Rate</p>
              <p className="text-xl font-black text-green-500 mt-1">{winRate}%</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${hairline}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Wins</p>
              <p className="text-xl font-black text-green-500 mt-1">{battleStats?.wins || 0}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Winnings</p>
              <p className="text-xl font-black text-green-500 mt-1">{formatCurrency(battleStats?.totalWinnings)}</p>
            </div>
          </div>
        </div>

        {Array.isArray(profile.frames) && profile.frames.length > 0 && (
          <div
            ref={achievementsSectionRef}
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${hairline}`,
              boxShadow: 'none',
            }}
          >
            {/* Pulse + glow used to emphasise the just-unlocked badge when
                arriving from the celebration's "View achievements" CTA
                (task #422). Honours prefers-reduced-motion by snapping to a
                static gold ring instead of looping the pulse. */}
            <style jsx>{`
              :global(.achv-highlight-pulse) {
                animation: achv-highlight-pulse 1.4s ease-out 2;
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.7),
                  0 0 22px rgba(250, 204, 21, 0.55);
              }
              @keyframes achv-highlight-pulse {
                0% {
                  box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0),
                    0 0 0 rgba(250, 204, 21, 0.0);
                  transform: scale(1);
                }
                30% {
                  box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.85),
                    0 0 32px rgba(250, 204, 21, 0.7);
                  transform: scale(1.03);
                }
                100% {
                  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.5),
                    0 0 18px rgba(250, 204, 21, 0.4);
                  transform: scale(1);
                }
              }
              @media (prefers-reduced-motion: reduce) {
                :global(.achv-highlight-pulse) {
                  animation: none;
                  transform: none;
                  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.85);
                }
              }
            `}</style>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span>Achievements</span>
                {isOwnProfile && unviewedAchievementCount > 0 && (
                  <span
                    className="inline-block w-2 h-2 bg-blue-500 rounded-full"
                    style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
                    aria-label={`${unviewedAchievementCount} new achievement${unviewedAchievementCount === 1 ? '' : 's'}`}
                    data-testid="achievements-section-unviewed-dot"
                  />
                )}
              </h2>
              <span className="text-xs text-gray-500">
                {profile.frames.filter((f) => f.unlocked).length} / {profile.frames.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {profile.frames.map((f) => {
                const isEquipped = profile.equippedFrame === f.id;
                const progress = Array.isArray(profile.allAchievements)
                  ? profile.allAchievements.find((a) => a && a.id === f.achievementId)
                  : null;
                const detail = {
                  achievementId: f.achievementId,
                  name: f.name,
                  description: f.description,
                  rarity: f.rarity,
                  earned: !!f.unlocked,
                  earnedAt: progress?.earnedAt || null,
                  progressText: progress?.progressText || '',
                  progressLabel: progress?.progressLabel || '',
                  progressPercent: progress
                    ? progress.progressPercent
                    : f.unlocked
                      ? 100
                      : 0,
                };
                const isHighlighted = highlightedBadgeId === f.achievementId;
                return (
                  <button
                    key={f.id}
                    ref={isHighlighted ? highlightedBadgeRef : null}
                    type="button"
                    onClick={() => setSelectedAchievement(detail)}
                    aria-label={`View details for ${f.name} ${f.unlocked ? '(unlocked)' : '(locked)'}`}
                    data-highlighted={isHighlighted ? 'true' : undefined}
                    className={`rounded-xl p-3 flex flex-col items-center text-center gap-2 text-left transition-colors hover:bg-blue-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isHighlighted ? 'achv-highlight-pulse' : ''
                    }`}
                    style={{
                      backgroundColor: innerBg,
                      border: `1px solid ${
                        isHighlighted
                          ? '#facc15'
                          : isEquipped
                            ? '#3b82f6'
                            : hairline
                      }`,
                    }}
                  >
                    <AchievementBadge
                      achievementId={f.achievementId}
                      earned={f.unlocked}
                      size={72}
                    />
                    <div className="min-w-0 w-full">
                      <div className={`text-xs font-bold truncate ${f.unlocked ? (isLight ? 'text-slate-900' : 'text-white') : 'text-gray-400'}`}>
                        {f.name}
                      </div>
                      <div className="text-[10px] text-gray-500 leading-snug line-clamp-2">
                        {f.unlocked ? f.description : `Locked · ${f.description}`}
                      </div>
                      {isEquipped && (
                        <div className="text-[10px] text-blue-400 font-semibold mt-0.5">Equipped</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-5" style={{ backgroundColor: cardBg, border: `1px solid ${hairline}`, boxShadow: 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Battle History</h2>
            {battleStats && battleStats.completedBattles > 0 && (
              <span className="text-[11px] font-semibold text-gray-500">
                <span className="text-green-400">{battleStats.wins}W</span>
                <span className="mx-1 text-gray-600">·</span>
                <span className="text-red-400">{battleStats.losses}L</span>
                {battleStats.ties > 0 && (
                  <>
                    <span className="mx-1 text-gray-600">·</span>
                    <span className="text-yellow-400">{battleStats.ties}T</span>
                  </>
                )}
                <span className="mx-1 text-gray-600">·</span>
                <span className={battleStats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {battleStats.netPnl >= 0 ? '+' : ''}{formatCurrency(battleStats.netPnl)}
                </span>
              </span>
            )}
          </div>

          {battleHistory.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {historyFilterPills.map((pill) => {
                const active = historyFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setHistoryFilter(pill.key)}
                    className="flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={{
                      backgroundColor: active ? 'rgba(59,130,246,0.15)' : innerBg,
                      border: `1px solid ${active ? 'rgba(59,130,246,0.55)' : hairline}`,
                      color: active ? '#60a5fa' : '#9ca3af',
                    }}
                  >
                    {pill.label}
                    <span className="ml-1.5 opacity-70">{pill.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!historyLoaded && battleHistory.length === 0 ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl p-3.5 animate-pulse"
                  style={{ backgroundColor: innerBg, border: `1px solid ${hairline}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full" style={{ backgroundColor: hairline }} />
                      <div className="space-y-1.5">
                        <div className="h-3 w-32 rounded" style={{ backgroundColor: hairline }} />
                        <div className="h-2.5 w-20 rounded" style={{ backgroundColor: hairline }} />
                      </div>
                    </div>
                    <div className="h-3 w-12 rounded" style={{ backgroundColor: hairline }} />
                  </div>
                </div>
              ))}
            </div>
          ) : battleHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No battle history yet</p>
          ) : groupedHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No battles match this filter</p>
          ) : (
            <div className="space-y-5">
              {groupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{group.label}</span>
                    <span className="text-[10px] font-semibold text-gray-600">{group.battles.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.battles.map((battle) => (
                      <div
                        key={battle.id}
                        className="rounded-xl p-3.5"
                        style={{ backgroundColor: innerBg, border: `1px solid ${hairline}` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: hairline }}>
                              {battle.opponent?.avatar ? (
                                <img src={battle.opponent.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>{battle.opponent?.username?.[0]?.toUpperCase() || '?'}</span>
                              )}
                            </div>
                            <div>
                              <p className={`font-semibold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                vs {battle.opponent?.username || battle.opponent?.displayName || 'Unknown'}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {battle.challengeType?.toUpperCase()} {battle.durationType && `\u00B7 ${battle.durationType.replace('_', ' ')}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-bold uppercase ${getResultColor(battle.result)}`}>
                              {battle.result === 'pending' ? 'In Progress' : battle.result}
                            </p>
                            {battle.result !== 'pending' && (
                              <p className={`text-sm font-bold ${battle.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {battle.pnl >= 0 ? '+' : ''}{formatCurrency(battle.pnl)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlayFriendModal
        isOpen={showBattleInvite}
        onClose={() => setShowBattleInvite(false)}
        friends={[]}
        initialBuyIn={lastBuyIn}
        lockedFriend={id ? {
          id,
          username: profile?.username,
          avatar: profile?.avatar,
          frameId: profile?.equippedFrame,
        } : null}
        currentUser={session?.user ? {
          id: session.user.id,
          username: session.user.name,
          avatar: session.user.image,
        } : null}
        onInviteSent={() => { try { notificationsCtx.refresh?.(); } catch {} refreshLastBuyIn(); }}
        onInviteCancelled={() => { try { notificationsCtx.refresh?.(); } catch {} }}
      />
      <MessagePopup
        isOpen={messageOpen}
        friend={messageOpen ? { id, username: profile?.username, avatar: profile?.avatar, frameId: profile?.equippedFrame } : null}
        ctx={notificationsCtx}
        myId={session?.user?.id}
        onClose={() => setMessageOpen(false)}
      />
      <AchievementDetailModal
        isOpen={!!selectedAchievement}
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
        canShare={isOwnProfile}
        viewerProfileId={id}
        viewerUsername={profile?.username}
      />
      <MutualFriendsModal
        isOpen={mutualFriendsOpen}
        onClose={() => setMutualFriendsOpen(false)}
        senderId={id}
        senderUsername={profile?.username}
        expectedCount={mutualFriendsCount}
      />
    </div>
  );
}

export async function getServerSideProps(context) {
  const { getProfilePreviewProps } = await import('../../lib/profile-preview');
  return getProfilePreviewProps(context);
}
