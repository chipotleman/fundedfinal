import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import FramedAvatar from '../components/UserAvatar';
import QuickMatchModal from '../components/battle/QuickMatchModal';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import PrivateMatchModal from '../components/battle/PrivateMatchModal';
import BattleModeChooser from '../components/battle/BattleModeChooser';
import ActiveBattleBlocker from '../components/battle/ActiveBattleBlocker';
import InviteToast from '../components/battle/InviteToast';
import MatchHistoryModal from '../components/battle/MatchHistoryModal';
import MatchLobby from '../components/battle/MatchLobby';
import MatchResult from '../components/battle/MatchResult';
import SocialFeedPage from '../components/social/SocialFeedPage';
import ForfeitModal from '../components/battle/ForfeitModal';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import ConnectionBadge from '../components/battle/ConnectionBadge';
import { useMatchup } from '../contexts/MatchupContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useBetaMode } from '../contexts/SiteConfigContext';
import MessagePopup from '../components/messages/MessagePopup';
import { useProfileCache } from '../contexts/ProfileCacheContext';
import { formatMoney } from '../utils/formatMoney';
import { formatLastSeen } from '../utils/relativeTime';
import { readBattleResult, clearBattleResult } from '../utils/battleResultCache';
import { readLastBuyIn, fetchLastBuyIn, saveLastBuyIn } from '../utils/lastBattleBuyIn';
import { getBattleStreamClient } from '../lib/battleStreamClient';
import { navigateToBattleStart, shouldShowMatchLobbyForMode } from '../lib/battleStartNavigation';

function UserAvatar({ user, size = 'md' }) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-white">{user?.username?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
  );
}

// In-page ChatModal removed — messaging now lives on /notifications.

// Compact labels/badges for the remembered game mode shown on the friend-row
// quick-invite shortcut. Original is the default mode, so its badge is
// suppressed to keep the button compact.
const QUICK_MODE_LABELS = { rush: 'Rush', original: 'Original', tournament: 'Tournament' };
const QUICK_MODE_BADGES = { rush: 'R', tournament: 'T' };

export default function BattlePage() {
  const isBeta = useBetaMode();
  const router = useRouter();
  // Rush mode is a dedicated 6-question mini-game with its own gameplay
  // page at /battle/rush/[id]. The original/tournament modes drop the
  // user back on the dashboard (`/?battleStarted=true`) where they place
  // bets that resolve the matchup. The shared helper in lib/battle-
  // StartNavigation picks the right destination so every "battle started"
  // navigation across the whole app stays consistent — see that file for
  // the full list of call sites.
  const navigateAfterBattleStart = useCallback((matchup) => {
    navigateToBattleStart(router, matchup);
  }, [router]);
  // Shared "battle just started — enter it" gate. Kept in one place so
  // the 4 entry points below (invite-refresh, SSE matchup:start, manual
  // accept-invite handler, QuickMatchModal onMatchFound) can't drift on
  // timing again. RUSH skips MatchLobby entirely and routes immediately
  // — the rush page itself is the synchronized multiplayer lobby (vote
  // → ready_check → playing), so both players land on the SAME screen
  // at the SAME time. ORIGINAL/TOURNAMENT keep the 2.5s MatchLobby
  // celebration since that IS their only lobby. The optional
  // `setLobby` callback lets a caller pre-set its local lobby state
  // (some sites need that for the non-rush branch).
  const enterMatchupAfterStart = useCallback((matchup, opts = {}) => {
    if (!matchup) return;
    if (!shouldShowMatchLobbyForMode(matchup)) {
      navigateToBattleStart(router, matchup);
      return;
    }
    if (typeof opts.setLobby === 'function') opts.setLobby(matchup);
    setTimeout(() => navigateToBattleStart(router, matchup), 2500);
  }, [router]);
  const { data: session, status } = useSession();
  const { matchup: globalMatchup, matchupData: globalMatchupData, hasActiveMatchup: globalHasActive, isWaiting: globalIsWaiting, hasAnyMatchup: globalHasAny, refresh: refreshGlobalMatchup } = useMatchup();
  const profileCache = useProfileCache();

  const goToProfile = useCallback((user) => {
    const id = user?.id || user;
    if (!id) return;
    const seed = (user && typeof user === 'object') ? {
      id,
      username: user.username || user.name,
      avatar: user.avatar ?? null,
    } : null;
    profileCache.prefetchProfile(id, seed);
    router.push(`/profile/${id}`);
  }, [profileCache, router]);

  const [profile, setProfile] = useState(null);
  // Cached NextAuth user from localStorage (`current_user`). The TopNavbar
  // writes the session here for instant rendering and treats its presence as
  // "logged in"; we mirror that so the feed's guest gating stays consistent
  // with the nav — otherwise a logged-in user (nav shows their avatar) gets
  // the "Sign up to share" guest state while `useSession()` is still
  // loading / slow to resolve. Starts null on SSR + first client render to
  // avoid a hydration mismatch, then hydrates in the effect below.
  const [storedUser, setStoredUser] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('current_user');
      setStoredUser(raw ? JSON.parse(raw) : null);
    } catch {
      setStoredUser(null);
    }
  }, [status]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState({ received: [], sent: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentHighlights, setRecentHighlights] = useState([]);
  const [activeMatchup, setActiveMatchup] = useState(null);
  const [matchupData, setMatchupData] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  // Per-section fetch status for the six initial fetches in fetchData.
  // Values: undefined (not yet attempted / in flight), 'ok' (loaded), 'failed'
  // (errored or timed out), 'retrying' (a manual retry is in flight). The
  // visible empty states for friends/invites/requests use this to surface a
  // soft "couldn't load — tap to retry" hint per section so a single hung
  // endpoint doesn't leave the user staring at an unexplained empty list.
  const [sectionStatus, setSectionStatus] = useState({});

  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  // Only true when PlayFriendModal was opened from the BattleModeChooser, so the
  // back arrow (return to chooser) shows only for that flow — not for deep-link
  // (?play=), auth-resume, or quick-invite fallback openings.
  const [playFriendFromChooser, setPlayFriendFromChooser] = useState(false);
  const [playFriendInitial, setPlayFriendInitial] = useState(null);
  // When the friend-row "Battle" shortcut succeeds we open PlayFriendModal
  // pre-set into its waiting/sent overlay instead of just toasting. Set to
  // { id, friend, buyIn, gameMode } and cleared on modal close.
  const [playFriendSentInvite, setPlayFriendSentInvite] = useState(null);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  // Shows the "Finish your fight first" blocker when the user tries to start
  // a Quick or Private Match while already in a live battle.
  const [showBattleBlocker, setShowBattleBlocker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
  const [showLobby, setShowLobby] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [rematchState, setRematchState] = useState(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);
  const [showBattleOptions, setShowBattleOptions] = useState(false);
  const [focusLiveBattleId, setFocusLiveBattleId] = useState(null);
  const [highlightInviteId, setHighlightInviteId] = useState(null);
  const [highlightResult, setHighlightResult] = useState(false);
  const [highlightRematch, setHighlightRematch] = useState(false);
  const inviteRowRef = useRef(null);
  const [quickInviteFor, setQuickInviteFor] = useState(null);
  const [quickToast, setQuickToast] = useState(null);
  const quickToastTimerRef = useRef(null);
  // Remembered buy-in + game mode for the current user. Surfaced on the
  // friend-row lightning shortcut so users can see what the next quick
  // invite will fire off before they tap. Updated after any quick invite
  // and after the PlayFriendModal closes (which may have written a new
  // value during a normal invite flow).
  const [lastBuyIn, setLastBuyIn] = useState(null);

  const [socialTab, setSocialTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const notificationsCtx = useNotifications();
  const { setSuppress } = notificationsCtx;
  const [messageFriend, setMessageFriend] = useState(null);
  const openMessagePopup = useCallback((friend) => {
    if (!friend?.id) return;
    setMessageFriend(friend);
  }, []);
  const closeMessagePopup = useCallback(() => setMessageFriend(null), []);
  // Treat a cached `current_user` as logged-in too (matches TopNavbar), so the
  // social feed never shows guest CTAs to a signed-in user mid session-load.
  const isGuest = status !== 'authenticated' && !storedUser;
  const userId = session?.user?.id || storedUser?.id || null;
  const debounceRef = useRef(null);

  useEffect(() => {
    setSuppress('battle_invites', true);
    setSuppress('friend_requests', true);
    return () => {
      setSuppress('battle_invites', false);
      setSuppress('friend_requests', false);
    };
  }, [setSuppress]);

  // Bound each initial fetch with a sane timeout so a slow or hung
  // endpoint can never strand the user on a non-interactive shell. The
  // page UI does not actually gate on `loading` — it always renders the
  // top nav, lobby entry points, and close affordances — so the worst a
  // failed/timed-out fetch can do is leave one section empty, which the
  // user can retry by navigating back.
  const fetchWithTimeout = useCallback((url, ms = 8000) => {
    if (typeof AbortController === 'undefined') return fetch(url);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(); } catch (_e) {}
    }, ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }, []);

  // Each of the six initial fetches is split into its own runner so a single
  // failed/timed-out section can be retried in isolation from the inline
  // retry hint without re-triggering the other five. `fetchSection` flips
  // `sectionStatus[key]` to 'ok' or 'failed' depending on the outcome, and
  // marks 'retrying' while a manual retry is in flight so the hint can show
  // a spinner instead of the tap-to-retry copy.
  //
  // To absorb transient blips (brief network hiccups, cold-start timeouts)
  // without making the user tap the hint, the initial (non-manual) path
  // silently retries one extra time after a ~1.5s backoff before flipping
  // the section to 'failed'. Manual retries from the hint stay single-shot
  // so a tap still feels immediate.
  const fetchSection = useCallback(async (key, { isRetry = false } = {}) => {
    if (!userId) return;
    if (isRetry) {
      setSectionStatus(prev => ({ ...prev, [key]: 'retrying' }));
    }
    const markOk = () => setSectionStatus(prev => (prev[key] === 'ok' ? prev : { ...prev, [key]: 'ok' }));
    const markFailed = () => setSectionStatus(prev => (prev[key] === 'failed' ? prev : { ...prev, [key]: 'failed' }));

    // Run one fetch attempt for `key`. Returns true on success (and applies
    // the section's state + markOk), false on any failure. The caller
    // decides whether to retry or mark the section as failed.
    const attempt = async () => {
      try {
        switch (key) {
          case 'profile': {
            const res = await fetchWithTimeout(`/api/profiles/${userId}`);
            if (!res.ok) return false;
            const data = await res.json();
            setProfile(data.profile || data);
            markOk();
            return true;
          }
          case 'friends': {
            const res = await fetchWithTimeout('/api/friends');
            if (!res.ok) return false;
            const data = await res.json();
            setFriends(data.friends || []);
            markOk();
            return true;
          }
          case 'invites': {
            const res = await fetchWithTimeout('/api/battles/invite');
            if (!res.ok) return false;
            const data = await res.json();
            setInvites(data);
            markOk();
            return true;
          }
          case 'history': {
            const res = await fetchWithTimeout('/api/battles/history?limit=5');
            if (!res.ok) return false;
            const data = await res.json();
            setRecentMatches(data.matches || []);
            markOk();
            return true;
          }
          case 'matchup': {
            const res = await fetchWithTimeout('/api/matchups/current');
            if (!res.ok) return false;
            const data = await res.json();
            if (data.matchup && (data.matchup.status === 'active' || data.matchup.status === 'matched' || data.matchup.status === 'waiting')) {
              setActiveMatchup(data.matchup);
              setMatchupData(data);
            }
            markOk();
            return true;
          }
          case 'requests': {
            const res = await fetchWithTimeout('/api/friends/requests');
            if (!res.ok) return false;
            const data = await res.json();
            setFriendRequests(data.requests || []);
            markOk();
            return true;
          }
          default:
            return true;
        }
      } catch (_e) {
        return false;
      }
    };

    if (await attempt()) return;
    // Manual retries from the inline hint keep their existing single-shot
    // behavior so the tap feels immediate.
    if (isRetry) { markFailed(); return; }
    // Silent auto-retry after a short backoff to absorb transient failures
    // before the user ever sees the retry hint. Mark the section as
    // 'reconnecting' so the render path can show a subtle pulsing dot
    // during the wait — without the failure copy — so the moment feels
    // intentional instead of stuck. `attempt()` will overwrite this back
    // to 'ok' on success; a final failure flips it to 'failed' below.
    setSectionStatus(prev => (prev[key] === 'reconnecting' ? prev : { ...prev, [key]: 'reconnecting' }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (await attempt()) return;
    markFailed();
  }, [userId, fetchWithTimeout]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      await Promise.allSettled([
        fetchSection('profile'),
        fetchSection('friends'),
        fetchSection('invites'),
        fetchSection('history'),
        fetchSection('matchup'),
        fetchSection('requests'),
      ]);
    } catch (err) {
      console.error('Error fetching battle data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchSection]);

  const retrySection = useCallback((key) => {
    fetchSection(key, { isRetry: true });
  }, [fetchSection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hydrate the remembered buy-in once we know who the user is. Seeds from
  // the local cache for an instant render (no flicker on slow networks),
  // then refreshes from the server so the value follows the user across
  // devices and sessions.
  const refreshLastBuyIn = useCallback(async () => {
    if (!userId) {
      setLastBuyIn(null);
      return;
    }
    const cached = readLastBuyIn(userId);
    if (cached) setLastBuyIn(cached);
    if (isGuest) return;
    const fresh = await fetchLastBuyIn(userId);
    setLastBuyIn(fresh);
  }, [userId, isGuest]);

  useEffect(() => {
    refreshLastBuyIn();
  }, [refreshLastBuyIn]);

  // Recent-winners strip. Pushed in real time by the shared SSE singleton:
  // server-side publishers (`publishMatchupStart` / `publishMatchupEnd` in
  // `lib/battle-events.js`) emit a lightweight `highlights:refresh` global
  // event whenever any battle starts or completes, and the SSE stream fans
  // it out to every connected client. We refetch on those pushes (with a
  // short debounce so a burst at battle-end is coalesced) instead of
  // polling on a 30s timer. While SSE is unhealthy — including the public
  // unauthenticated view, where `/api/battles/stream` 401s and the shared
  // client emits `piks:disconnected` — a fallback poll keeps the strip
  // populated on a slower cadence so we don't hammer the endpoint when
  // SSE is doing its job.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let debounce = null;
    let fallback = null;
    let fallbackGrace = null;
    const limit = isGuest ? 5 : 3;

    const load = async () => {
      try {
        const res = await fetch(`/api/battles/recent?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRecentHighlights(Array.isArray(data.battles) ? data.battles : []);
      } catch {}
    };

    // Coalesce bursts (e.g. matchup:end immediately followed by another
    // start when both sides accept a rematch handshake within a tick).
    const scheduleLoad = () => {
      if (debounce || cancelled) return;
      debounce = setTimeout(() => {
        debounce = null;
        load();
      }, 750);
    };

    const FALLBACK_GRACE_MS = 5000;
    const FALLBACK_INTERVAL_MS = 30000;

    const stopFallback = () => {
      if (fallbackGrace) { clearTimeout(fallbackGrace); fallbackGrace = null; }
      if (fallback) { clearInterval(fallback); fallback = null; }
    };

    const startFallback = () => {
      if (fallback || fallbackGrace || cancelled) return;
      fallbackGrace = setTimeout(() => {
        fallbackGrace = null;
        if (cancelled) return;
        load();
        fallback = setInterval(load, FALLBACK_INTERVAL_MS);
      }, FALLBACK_GRACE_MS);
    };

    // Initial fetch — render the strip ASAP regardless of SSE health.
    load();

    const client = getBattleStreamClient();
    let unsubscribe = null;
    let watchdog = null;

    if (client) {
      unsubscribe = client.subscribe((ev) => {
        if (!ev || !ev.type) return;
        if (ev.type === 'highlights:refresh') {
          scheduleLoad();
          return;
        }
        if (ev.type === 'piks:disconnected') {
          startFallback();
          return;
        }
        if (ev.type === 'piks:reconnected' || ev.type === 'connected') {
          stopFallback();
          // Reconnect catch-up — pick up anything that ended during the
          // outage without waiting on the next push.
          load();
        }
      });

      // Late-mount safety: if the stream singleton was already in a known
      // state by the time we subscribed, react to it now (the lifecycle
      // events that established that state won't replay).
      if (typeof client.getState === 'function') {
        const initial = client.getState();
        if (initial === 'disconnected') startFallback();
      }

      // Watchdog: if SSE never reaches `connected` (auth wall for guests,
      // network failure, etc.), engage the fallback poll so the strip
      // doesn't go indefinitely stale waiting on push.
      watchdog = setTimeout(() => {
        const s = typeof client.getState === 'function' ? client.getState() : null;
        if (s !== 'connected') startFallback();
      }, 10000);
    } else {
      // No EventSource available at all (very old browser / SSR fallback)
      // — just poll on the slow cadence.
      startFallback();
    }

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (watchdog) clearTimeout(watchdog);
      stopFallback();
      if (unsubscribe) unsubscribe();
    };
  }, [isGuest]);

  useEffect(() => {
    if (globalMatchup && globalHasAny) {
      setActiveMatchup(globalMatchup);
      if (globalMatchupData) setMatchupData(globalMatchupData);
    } else if (!globalHasAny && !globalIsWaiting && activeMatchup) {
      setActiveMatchup(null);
      setMatchupData(null);
    }
  }, [globalMatchup, globalHasAny, globalIsWaiting, globalMatchupData]);

  // Refs used by the SSE lifecycle subscribers below. Reading the latest
  // invites and active matchup via refs keeps those subscribe effects from
  // re-binding on every state change.
  //   - `invitesRef`        : consumed by the SSE invite-refresh listener
  //                           to detect a sent→accepted transition.
  //   - `activeMatchupRef`  : consumed by the SSE `matchup:end` handler to
  //                           confirm the ending matchup is the one this
  //                           page currently shows as active.
  // The previous fixed-cadence safety-net polls (invites/matchup-current
  // and waiting-status) were removed in favour of the existing SSE pushes
  // (`matchup:start`, `matchup:end`, `notification:invite/refresh`). The
  // shared SSE singleton's `piks:disconnected` lifecycle event drives the
  // fallback poll inside MatchupContext, which keeps state fresh while
  // the stream is unhealthy.
  const invitesRef = useRef(invites);
  const activeMatchupRef = useRef(activeMatchup);
  // Always-current mirror of `globalHasActive` so the once-registered resume
  // listeners and the query-param entry effect can read the live value
  // without re-subscribing on every matchup change (avoids stale closures).
  const globalHasActiveRef = useRef(globalHasActive);
  useEffect(() => { invitesRef.current = invites; }, [invites]);
  useEffect(() => { activeMatchupRef.current = activeMatchup; }, [activeMatchup]);
  useEffect(() => { globalHasActiveRef.current = globalHasActive; }, [globalHasActive]);

  // ?play=<friendId> opens the PlayFriendModal with that friend pre-selected.
  useEffect(() => {
    if (!router.isReady) return;
    const playId = router.query.play;
    if (!playId) return;
    const id = Array.isArray(playId) ? playId[0] : playId;
    const friend = friends.find(f => String(f.id) === String(id));
    setPlayFriendInitial(friend || { id });
    setShowPlayFriend(true);
    const cleaned = { ...router.query };
    delete cleaned.play;
    router.replace({ pathname: '/battle', query: cleaned }, undefined, { shallow: true });
  }, [router.isReady, router.query.play, friends]);

  // ?openChooser=1 / ?openPlayFriend=1 / ?openPrivateMatch=1 are entry points
  // from the home page "Your Battle" featured card. The home card opens the
  // mode chooser inline for signed-in users, but routes signed-out users (and
  // the Challenge Friend / Private Match picks) here so we can reuse the
  // page's auth gate, friends list, and lobby/active-battle hand-off.
  // Auth handling is inlined (instead of calling `requireAuth`) so the
  // effect's deps are explicit — no stale-closure risk on first render.
  useEffect(() => {
    if (!router.isReady) return;
    const openChooser = router.query.openChooser;
    const openPlayFriend = router.query.openPlayFriend;
    const openPrivateMatch = router.query.openPrivateMatch;
    if (!openChooser && !openPlayFriend && !openPrivateMatch) return;
    const gate = (openSetter, pendingAction) => {
      if (isGuest) {
        if (typeof window !== 'undefined') window.__pendingAuthAction = pendingAction;
        window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signin', pendingAction } }));
        return;
      }
      openSetter(true);
    };
    if (openChooser) {
      gate(setShowBattleOptions, 'resumeBattleOptions');
    } else if (openPlayFriend) {
      gate(setShowPlayFriend, 'resumePlayFriend');
    } else if (openPrivateMatch) {
      if (isGuest) {
        gate(setShowPrivateMatch, 'resumePrivateMatch');
      } else if (globalHasActiveRef.current) {
        setShowBattleBlocker(true);
      } else {
        setShowPrivateMatch(true);
      }
    }
    const cleaned = { ...router.query };
    delete cleaned.openChooser;
    delete cleaned.openPlayFriend;
    delete cleaned.openPrivateMatch;
    router.replace({ pathname: '/battle', query: cleaned }, undefined, { shallow: true });
  }, [router.isReady, router.query.openChooser, router.query.openPlayFriend, router.query.openPrivateMatch, isGuest, router]);

  // ?chat=<id> on /battle is a legacy entry point — forward it to /notifications.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (!chatId) return;
    const chatName = router.query.name;
    const target = chatName
      ? `/notifications?chat=${chatId}&name=${encodeURIComponent(Array.isArray(chatName) ? chatName[0] : chatName)}`
      : `/notifications?chat=${chatId}`;
    router.replace(target);
  }, [router.isReady, router.query.chat, router.query.name]);

  // Push notification deep links: /battle?invite=<id>, ?forfeit=<matchupId>,
  // ?result=<matchupId>, ?live=<matchupId>. Open the relevant view, then strip
  // the query param so a refresh doesn't re-trigger it.
  // Build a synthetic matchup-shaped object from a notification/history
  // payload so MatchResult can render instantly before the full /api fetch
  // returns. Only the fields MatchResult reads are required.
  const openResultFromPayload = useCallback((resultId, payload) => {
    if (!payload || !resultId) return;
    const isFake = !!payload.isFakeOpponent;
    const myScore = Number(payload.myScore ?? payload.startingBalance ?? 0);
    const oppScore = Number(payload.opponentScore ?? payload.startingBalance ?? 0);
    const synthetic = {
      id: resultId,
      status: 'completed',
      user1Id: userId,
      user2Id: payload.opponent?.id || null,
      user1FinalBalance: myScore,
      user2FinalBalance: oppScore,
      startingBalance: Number(payload.startingBalance ?? 0),
      potSize: Number(payload.potSize ?? 0),
      winnerPayout: Number(payload.winnerPayout ?? 0),
      winnerType: payload.winnerType || null,
      winnerId: payload.winnerId || (payload.outcome === 'won' ? userId : null),
      isFakeOpponent: isFake,
    };
    setShowResult(synthetic);
    setResultData({
      opponent: payload.opponent || null,
      myProfile: payload.myProfile || (profile ? {
        username: profile.username,
        avatar: profile.avatar,
        equippedFrame: profile.equippedFrame,
      } : null),
      cashBuyIn: Number(payload.buyIn ?? 0),
      cashPnl: Number(payload.pnl ?? 0),
      potSize: Number(payload.potSize ?? 0),
      winnerPayout: Number(payload.winnerPayout ?? 0),
      myScore,
      opponentScore: oppScore,
      isFakeOpponent: isFake,
    });
    setRematchState(null);
  }, [userId, profile]);

  const loadResultDetails = useCallback(async (resultId) => {
    if (!resultId) return;
    try {
      const res = await fetch(`/api/matchups/${resultId}`);
      if (!res.ok) return;
      const data = await res.json();
      const m = data.matchup;
      if (!m || m.status !== 'completed') return;
      setShowResult(prev => {
        const merged = { ...(prev || {}), ...m, status: 'completed' };
        return merged;
      });
      setResultData({
        opponent: data.opponent,
        myProfile: profile ? {
          username: profile.username,
          avatar: profile.avatar,
          equippedFrame: profile.equippedFrame,
        } : null,
        cashBuyIn: Number(data.cashBuyIn ?? 0),
        cashPnl: Number(data.cashPnl ?? 0),
        potSize: Number(data.potSize ?? 0),
        winnerPayout: Number(data.winnerPayout ?? 0),
        myScore: Number(data.myScore ?? 0),
        opponentScore: Number(data.opponentScore ?? 0),
        isFakeOpponent: !!m.isFakeOpponent,
      });
      if (data.rematchState) setRematchState(data.rematchState);
    } catch {}
  }, [profile]);

  const callRematch = useCallback(async (resultId, action) => {
    if (!resultId) return null;
    try {
      const res = await fetch(`/api/matchups/${resultId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const handleRematchAccept = useCallback(async () => {
    if (!showResult?.id) return;
    // Optimistic: mark my side accepted instantly.
    const isUser1 = showResult.user1Id === userId;
    setRematchState(prev => ({
      user1Rematch: isUser1 ? 'accepted' : (prev?.user1Rematch || 'pending'),
      user2Rematch: !isUser1 ? 'accepted' : (prev?.user2Rematch || 'pending'),
      rematchMatchupId: prev?.rematchMatchupId || null,
    }));
    const next = await callRematch(showResult.id, 'accept');
    if (next) setRematchState(next);
  }, [showResult, userId, callRematch]);

  const handleRematchDecline = useCallback(() => {
    if (!showResult?.id) return;
    callRematch(showResult.id, 'decline');
  }, [showResult, callRematch]);

  const closeResultPopup = useCallback(() => {
    if (showResult?.id) clearBattleResult(showResult.id);
    setShowResult(null);
    setResultData(null);
    setRematchState(null);
    setReactionQueue([]);
  }, [showResult]);

  // Append-only queue of received reactions. We can't use a single state slot
  // because two reactions arriving in the same React batch (e.g., two rapid
  // taps from the opponent over SSE) would have the second `set` call
  // overwrite the first before the popup's effect ran, silently dropping
  // earlier reactions. The popup processes new entries by id and renders
  // each one independently. Capped to keep memory bounded; in practice
  // reactions auto-expire from the popup in <2s anyway.
  const [reactionQueue, setReactionQueue] = useState([]);

  // Drain the queue when the visible matchup changes (closed popup, rematch
  // transition, etc.) so a new battle's popup never replays the previous
  // battle's reactions.
  useEffect(() => {
    setReactionQueue([]);
  }, [showResult?.id]);

  const handleSendReaction = useCallback(async (payload) => {
    if (!showResult?.id) return null;
    if (showResult?.isFakeOpponent || resultData?.isFakeOpponent) return null;
    try {
      const res = await fetch(`/api/matchups/${showResult.id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { error: data?.error || 'Failed', status: res.status };
      return data;
    } catch {
      return { error: 'Network error' };
    }
  }, [showResult, resultData]);

  // SSE listener for two-sided rematch handshake updates.
  useEffect(() => {
    if (!showResult?.id || isGuest || typeof window === 'undefined') return;
    const client = getBattleStreamClient();
    if (!client) return;
    const matchupId = showResult.id;

    const unsubscribe = client.subscribe((ev) => {
      if (!ev || ev.matchupId !== matchupId) return;
      if (ev.type === 'matchup:rematch') {
        setRematchState({
          user1Rematch: ev.user1Rematch,
          user2Rematch: ev.user2Rematch,
          rematchMatchupId: ev.rematchMatchupId || null,
        });
      } else if (ev.type === 'matchup:reaction') {
        if (!ev.id) return;
        setReactionQueue((prev) => {
          if (prev.some((r) => r.id === ev.id)) return prev;
          const next = prev.concat({
            id: ev.id,
            fromUserId: ev.fromUserId,
            emoji: ev.emoji || null,
            text: ev.text || null,
          });
          // Keep memory bounded — reactions are short-lived, the popup
          // expires each entry independently, and we only need recent
          // history so the consumer can dedupe its echo.
          return next.length > 100 ? next.slice(-100) : next;
        });
      }
    });
    return () => unsubscribe();
  }, [showResult?.id, isGuest]);

  // SSE listener for friend-invite state changes — keeps the per-friend
  // "Invite pending" badge / disabled quick-invite button in sync within
  // ~1 s when the receiver accepts/declines, the sender cancels from
  // another tab, or an outgoing invite expires server-side.
  //
  // We also drive the "outgoing invite was just accepted → auto-show
  // the lobby" transition here, using `invitesRef` to compare against
  // the previous snapshot before we overwrite invites with the fresh
  // payload. (`invitesRef` is declared once earlier, alongside the SSE
  // ref setup.)
  useEffect(() => {
    if (!userId || isGuest || typeof window === 'undefined') return;
    const client = getBattleStreamClient();
    if (!client) return;

    let cancelled = false;
    let timer = null;

    const refreshInvites = async () => {
      try {
        const [inviteRes, matchupRes] = await Promise.all([
          fetch('/api/battles/invite'),
          fetch('/api/matchups/current'),
        ]);

        let matchData = null;
        if (matchupRes.ok) matchData = await matchupRes.json().catch(() => null);

        if (inviteRes.ok) {
          const data = await inviteRes.json().catch(() => null);
          if (data && !cancelled) {
            const hadPendingSent = invitesRef.current?.sent?.length > 0;
            const hasPendingSent = data.sent?.length > 0;
            setInvites(data);

            if (hadPendingSent && !hasPendingSent && matchData?.matchup) {
              const ms = matchData.matchup.status;
              if (ms === 'active' || ms === 'matched') {
                setActiveMatchup(matchData.matchup);
                setMatchupData(matchData);
                refreshGlobalMatchup();
                enterMatchupAfterStart(matchData.matchup, { setLobby: setShowLobby });
              }
            }
          }
        }
      } catch {}
    };

    // Coalesce bursts of events (e.g. accept publishes to both users) so
    // we don't fire the same fetch twice in quick succession.
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshInvites();
      }, 200);
    };

    const unsubscribe = client.subscribe((ev) => {
      if (!ev || !ev.type) return;
      if (
        ev.type === 'notification:invite' ||
        ev.type === 'notification:refresh' ||
        ev.type === 'piks:reconnected'
      ) {
        // `matchup:start` is intentionally NOT included here — the
        // dedicated lifecycle listener below (handleMatchupStart) opens
        // the lobby directly. Invite-list refresh still happens through
        // `notification:refresh` which is published from the same accept
        // handler that fires `matchup:start`.
        scheduleRefresh();
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [userId, isGuest, refreshGlobalMatchup, router]);

  // SSE listener for explicit matchup lifecycle events. The publishers in
  // lib/battle-events.js fire `matchup:start` whenever a new matchup is
  // created (invite accepted, queue matched) and `matchup:end` whenever a
  // matchup transitions to completed (winner declared, expired, forfeit).
  // This is the sole driver for the lobby and result popup transitions on
  // /battle — there is no longer a fixed-cadence safety poll. SSE drops
  // are covered by MatchupContext's fallback poll, which engages on the
  // shared client's `piks:disconnected` lifecycle event.
  //
  // The invite-refresh listener above intentionally does NOT also act on
  // `matchup:start` so we don't issue duplicate /api/matchups/current
  // fetches when the accept handler bursts both events together.
  // (`activeMatchupRef` is declared once earlier alongside `invitesRef`.)
  const showResultRef = useRef(showResult);
  useEffect(() => { showResultRef.current = showResult; }, [showResult]);
  // If a `matchup:start` arrives while the user is still looking at the
  // result popup from a previous battle, we don't want to clobber that UI
  // mid-read. We stash the id here and replay the lobby-open logic the
  // moment the popup is dismissed (drained by the effect further below).
  // Without this, the SSE event would be silently dropped — the old
  // long-interval safety poll used to catch this case.
  const pendingStartRef = useRef(null);

  // Open the lobby for a freshly-started matchup. Shared between the SSE
  // `matchup:start` handler and the deferred-start drain effect so the
  // two paths can't drift.
  const openLobbyForStart = useCallback(async (matchupId) => {
    try {
      const res = await fetch('/api/matchups/current');
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const m = data?.matchup;
      if (!m || m.id !== matchupId) return;
      if (m.status !== 'active' && m.status !== 'matched') return;
      setActiveMatchup(m);
      setMatchupData(data);
      refreshGlobalMatchup();
      enterMatchupAfterStart(m, { setLobby: setShowLobby });
    } catch {}
  }, [refreshGlobalMatchup, enterMatchupAfterStart]);
  const openLobbyForStartRef = useRef(openLobbyForStart);
  useEffect(() => { openLobbyForStartRef.current = openLobbyForStart; }, [openLobbyForStart]);

  // Drain any deferred `matchup:start` once the result popup is dismissed.
  // Only fires on the truthy→falsy transition so it doesn't run on every
  // unrelated render.
  useEffect(() => {
    if (showResult) return;
    const pendingId = pendingStartRef.current;
    if (!pendingId) return;
    pendingStartRef.current = null;
    openLobbyForStartRef.current && openLobbyForStartRef.current(pendingId);
  }, [showResult]);

  useEffect(() => {
    if (!userId || isGuest || typeof window === 'undefined') return;
    const client = getBattleStreamClient();
    if (!client) return;

    let cancelled = false;

    const handleMatchupStart = (matchupId) => {
      // If the user is mid-read on a result popup, defer the lobby
      // transition until they dismiss it. The drain effect above will
      // replay it. Without this, the event would be silently dropped
      // now that the long-interval safety poll is gone.
      if (showResultRef.current) {
        pendingStartRef.current = matchupId;
        return;
      }
      openLobbyForStartRef.current && openLobbyForStartRef.current(matchupId);
    };

    const handleMatchupEnd = async (ev) => {
      const cur = activeMatchupRef.current;
      if (!cur || cur.id !== ev.matchupId) return;
      if (cur.status !== 'active' && cur.status !== 'matched') return;
      try {
        const histRes = await fetch('/api/battles/history?limit=1');
        if (!histRes.ok || cancelled) return;
        const histData = await histRes.json().catch(() => null);
        const lastMatch = histData?.matches?.[0];
        if (!lastMatch || lastMatch.id !== cur.id) return;
        setActiveMatchup(null);
        setShowResult({
          ...cur,
          ...lastMatch,
          status: 'completed',
          winnerId: lastMatch.winnerId || lastMatch.winner_id,
          user1FinalBalance: lastMatch.user1FinalBalance || lastMatch.user1_final_balance || cur.user1Balance,
          user2FinalBalance: lastMatch.user2FinalBalance || lastMatch.user2_final_balance || cur.user2Balance,
        });
        loadResultDetails(lastMatch.id);
        fetchData();
      } catch {}
    };

    const unsubscribe = client.subscribe((ev) => {
      if (!ev || !ev.type || !ev.matchupId) return;
      if (ev.type === 'matchup:start') {
        handleMatchupStart(ev.matchupId);
      } else if (ev.type === 'matchup:end') {
        handleMatchupEnd(ev);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, isGuest, loadResultDetails, fetchData]);

  // When both sides accept and a new matchup is created, navigate both users
  // straight into the new battle.
  useEffect(() => {
    const newId = rematchState?.rematchMatchupId;
    if (!newId) return;
    if (showResult?.id) clearBattleResult(showResult.id);
    setShowResult(null);
    setResultData(null);
    setRematchState(null);
    refreshGlobalMatchup();
    // The rematch path always re-creates a matchup of the SAME mode as
    // the original, so the rush-aware nav helper handles routing here too.
    // When the rematch payload is missing entirely, the helper still falls
    // back to the dashboard, keeping the original-mode default.
    const newMatchup = rematchState?.rematchMatchup || (showResult?.durationType === 'rush' ? { id: rematchState?.rematchMatchupId, durationType: 'rush' } : null);
    // Rush has zero tolerance for entry skew — both peers receive the
    // same `rematchMatchupId` via SSE and must hit the voting screen on
    // the same tick. Skip the 400ms result-dismiss pause for rush so
    // there's no chance of one side getting there first if the other
    // is mid-render. Non-rush keeps the brief pause for UX continuity.
    if (newMatchup?.durationType === 'rush') {
      navigateAfterBattleStart(newMatchup);
    } else {
      setTimeout(() => {
        navigateAfterBattleStart(newMatchup);
      }, 400);
    }
  }, [rematchState?.rematchMatchupId, rematchState?.rematchMatchup, showResult?.durationType, navigateAfterBattleStart, router, refreshGlobalMatchup]);

  const consumedDeepLinkRef = useRef(null);
  useEffect(() => {
    if (!router.isReady) return;
    if (isGuest) return;
    const { invite, forfeit, result, live, rematch } = router.query;
    const inviteId = Array.isArray(invite) ? invite[0] : invite;
    const forfeitId = Array.isArray(forfeit) ? forfeit[0] : forfeit;
    const resultId = Array.isArray(result) ? result[0] : result;
    const liveId = Array.isArray(live) ? live[0] : live;
    const rematchFlag = Array.isArray(rematch) ? rematch[0] : rematch;
    const key = inviteId
      ? `invite:${inviteId}`
      : forfeitId
      ? `forfeit:${forfeitId}`
      : resultId
      ? `result:${resultId}`
      : liveId
      ? `live:${liveId}`
      : null;
    if (!key) return;
    if (consumedDeepLinkRef.current === key) return;
    consumedDeepLinkRef.current = key;

    (async () => {
      if (inviteId) {
        // Surface the Invites tab so the user can act on the challenge.
        setSocialTab('invites');
        setSocialExpanded(true);
        // Briefly highlight the targeted invite so the user can spot it.
        setHighlightInviteId(inviteId);
        setTimeout(() => setHighlightInviteId(prev => (prev === inviteId ? null : prev)), 3500);
        // Refresh invites so the deep-linked one is present even if it
        // arrived after the initial fetch.
        fetchData();
      } else if (forfeitId) {
        // The ForfeitConfirmedModal is rendered globally from MatchupContext
        // based on `recentForfeit` returned by /api/matchups/current. Just
        // make sure that data is fresh.
        refreshGlobalMatchup();
      } else if (resultId) {
        // Instant open: use the cached payload from the notifications dropdown
        // (or the locally-typed `gameResults` row) so the popup appears with
        // no perceptible delay. Then fetch the authoritative data in the
        // background to fill in rematch state and confirm cash P&L.
        const cached = readBattleResult(resultId);
        if (cached) {
          openResultFromPayload(resultId, cached);
        }
        setHighlightResult(true);
        setTimeout(() => setHighlightResult(false), 3500);
        if (rematchFlag) {
          // Came in from a "Opponent wants a rematch" notification — keep the
          // rematch CTA visually highlighted until the user acts on it.
          setHighlightRematch(true);
          setTimeout(() => setHighlightRematch(false), 6000);
        }
        loadResultDetails(resultId);
      }
      if (liveId) {
        // LiveBattlesSection focuses the matching battle via focusBattleId.
        setFocusLiveBattleId(liveId);
        // Auto-clear focus so the highlight effect fades after a couple seconds.
        setTimeout(() => setFocusLiveBattleId(prev => (prev === liveId ? null : prev)), 3500);
      }

      // Clear the consumed query param so a refresh doesn't re-trigger.
      const cleaned = { ...router.query };
      delete cleaned.invite;
      delete cleaned.forfeit;
      delete cleaned.result;
      delete cleaned.live;
      delete cleaned.rematch;
      router.replace({ pathname: router.pathname, query: cleaned }, undefined, { shallow: true });
    })();
  }, [router.isReady, router.query.invite, router.query.forfeit, router.query.result, router.query.live, router.query.rematch, isGuest, fetchData, refreshGlobalMatchup]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (res.ok) { const data = await res.json(); setSearchResults(data.users || []); }
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }, []);

  const handleAddFriend = async (targetUserId) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: targetUserId }),
      });
      if (res.ok) setSearchResults(prev => prev.filter(u => u.id !== targetUserId));
    } catch {}
  };

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) fetchData();
    } catch {}
  };

  const handleDeclineFriendRequest = async (requestId) => {
    try {
      await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject' }),
      });
      fetchData();
    } catch {}
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      const res = await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        const data = await res.json();
        let lobbyMatchup = null;
        if (data.matchup) {
          lobbyMatchup = data.matchup;
        } else if (data.matchupId) {
          const matchRes = await fetch(`/api/matchups/${data.matchupId}`);
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            lobbyMatchup = matchData.matchup || matchData;
          } else {
            router.push('/');
          }
        }
        fetchData();
        refreshGlobalMatchup();
        // RUSH: navigate immediately so both players land on the rush
        // voting screen together. ORIGINAL/TOURNAMENT: brief MatchLobby
        // celebration before routing to the dashboard.
        enterMatchupAfterStart(lobbyMatchup, { setLobby: setShowLobby });
      }
    } catch {}
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      fetchData();
    } catch {}
  };

  const showQuickToast = useCallback((message, type = 'success') => {
    if (quickToastTimerRef.current) clearTimeout(quickToastTimerRef.current);
    setQuickToast({ id: Date.now(), message, type });
    quickToastTimerRef.current = setTimeout(() => setQuickToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (quickToastTimerRef.current) clearTimeout(quickToastTimerRef.current);
  }, []);

  // One-tap "send last buy-in" invite triggered from the friend row's
  // lightning shortcut. Falls back to opening the full Play Friend modal
  // when the user has no remembered buy-in yet.
  const handleQuickInvite = useCallback(async (friend) => {
    if (!friend?.id) return false;
    if (isGuest) {
      requireAuth(() => {});
      return false;
    }
    if (globalHasActive) {
      showQuickToast("You're already in a battle — finish it first.", 'error');
      return false;
    }
    // Prefer the freshly-hydrated value (which already reflects the
    // cross-device server copy when available) and only fall back to the
    // local cache if state hasn't caught up yet.
    const last = lastBuyIn || readLastBuyIn(userId);
    if (!last) {
      // No remembered buy-in — open the modal so the user can pick one.
      setPlayFriendInitial(friend);
      setShowPlayFriend(true);
      return false;
    }
    if (quickInviteFor) return false;
    setQuickInviteFor(friend.id);
    try {
      const res = await fetch('/api/battles/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: friend.id, buyIn: last.buyIn, gameMode: last.gameMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Stale buy-in or any rejection — fall back to the modal so the
        // user can adjust and retry without losing their tap.
        setPlayFriendInitial(friend);
        setShowPlayFriend(true);
        if (data?.error) showQuickToast(data.error, 'error');
        return false;
      }
      // Refresh the remembered values (mode may have been normalised
      // server-side) and persist to the user's profile so the shortcut
      // stays in sync on every device.
      await saveLastBuyIn(userId, { buyIn: last.buyIn, gameMode: last.gameMode });
      refreshLastBuyIn();
      // Open PlayFriendModal directly into its cartoon "waiting for
      // friend to accept" overlay so the sender gets the same popup as
      // when the invite is sent from inside the modal — including the
      // countdown and Cancel Invite button. Previously this path only
      // showed a toast and the user had no way to cancel from here.
      const inviteId = data?.invite?.id || null;
      if (inviteId) {
        setPlayFriendSentInvite({
          id: inviteId,
          friend,
          buyIn: Number(last.buyIn),
          gameMode: last.gameMode,
        });
        setShowPlayFriend(true);
      } else {
        showQuickToast(`Invite sent to ${friend.username || 'friend'} · ${isBeta ? `${formatMoney(last.buyIn, 0)} Clash Coins buy-in` : `$${last.buyIn} buy-in`}`);
      }
      fetchData();
      return true;
    } catch {
      showQuickToast('Could not send invite. Try again.', 'error');
      return false;
    } finally {
      setQuickInviteFor(null);
    }
  }, [isGuest, globalHasActive, userId, quickInviteFor, lastBuyIn, fetchData, showQuickToast, refreshLastBuyIn]);

  const handleCancelInvite = async (inviteId) => {
    try {
      await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      fetchData();
    } catch {}
  };

  // Optional `pendingAction` lets a caller resume into a specific
  // post-auth destination (e.g. the deep links from the home page
  // "Your Battle" card). Defaults to the chooser so existing call
  // sites keep their current behavior.
  const requireAuth = (callback, pendingAction = 'resumeBattleOptions') => {
    if (isGuest) {
      if (typeof window !== 'undefined') window.__pendingAuthAction = pendingAction;
      window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signin', pendingAction } }));
      return;
    }
    callback();
  };

  useEffect(() => {
    const handleResumeOptions = () => setShowBattleOptions(true);
    const handleResumePlayFriend = () => setShowPlayFriend(true);
    const handleResumePrivateMatch = () => {
      if (globalHasActiveRef.current) setShowBattleBlocker(true);
      else setShowPrivateMatch(true);
    };
    window.addEventListener('resumeBattleOptions', handleResumeOptions);
    window.addEventListener('resumePlayFriend', handleResumePlayFriend);
    window.addEventListener('resumePrivateMatch', handleResumePrivateMatch);
    return () => {
      window.removeEventListener('resumeBattleOptions', handleResumeOptions);
      window.removeEventListener('resumePlayFriend', handleResumePlayFriend);
      window.removeEventListener('resumePrivateMatch', handleResumePrivateMatch);
    };
  }, []);

  // Scroll the highlighted invite row into view once it renders.
  useEffect(() => {
    if (!highlightInviteId) return;
    const t = setTimeout(() => {
      try {
        inviteRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }, 100);
    return () => clearTimeout(t);
  }, [highlightInviteId, socialTab, socialExpanded, invites.received?.length, invites.sent?.length]);

  const totalBattles = (profile?.battleWins || 0) + (profile?.battleLosses || 0);
  const winRate = totalBattles > 0 ? Math.round(((profile?.battleWins || 0) / totalBattles) * 100) : 0;

  const handleBattleOptionClick = (setter) => {
    setShowBattleOptions(false);
    requireAuth(() => setter(true));
  };

  // Quick Match must be mutually exclusive with an outstanding 1v1
  // commitment: you can't matchmake into a random opponent while you're
  // already in a battle, or while you have a challenge invite still
  // pending with a friend (accepting it would create a second matchup).
  // Being mid-battle shows the same "Finish your fight first" blocker that
  // Play a Friend uses, so all three entry points behave identically.
  const openQuickMatch = () => {
    requireAuth(() => {
      if (globalHasActive) {
        setShowBattleBlocker(true);
        return;
      }
      if ((invites.sent || []).length > 0) {
        showQuickToast('You have a pending challenge — cancel it before a Quick Match.', 'error');
        return;
      }
      setShowQuickMatch(true);
    });
  };

  // Private Match also creates a fresh matchup, so it carries the exact
  // same mid-battle guard as Quick Match — otherwise "Generate Code" would
  // silently spin up a second matchup while a fight is still live.
  const openPrivateMatch = () => {
    requireAuth(() => {
      if (globalHasActive) {
        setShowBattleBlocker(true);
        return;
      }
      if ((invites.sent || []).length > 0) {
        showQuickToast('You have a pending challenge — cancel it before a Private Match.', 'error');
        return;
      }
      setShowPrivateMatch(true);
    }, 'resumePrivateMatch');
  };

  const friendIds = new Set(friends.map(f => f.id));
  const requestCount = friendRequests.length;
  const inviteCount = invites.received?.length || 0;
  const onlineFriendCount = friends.filter(f => f.isOnline).length;

  // Map of receiver userId -> pending outgoing invite. Lets friend rows and
  // search-result rows show a "pending" indicator and disable the
  // quick-invite shortcut so the user can't fire duplicate invites that the
  // server would reject. Keyed by user id (not friend id) since search
  // results aren't necessarily friends.
  const pendingInviteByUserId = new Map();
  (invites.sent || []).forEach(inv => {
    const rid = inv.receiverId || inv.receiver?.id;
    if (rid && !pendingInviteByUserId.has(rid)) pendingInviteByUserId.set(rid, inv);
  });

  const openPendingInvite = useCallback((inviteId) => {
    if (!inviteId) return;
    setSocialTab('invites');
    setSocialExpanded(true);
    setHighlightInviteId(inviteId);
    setTimeout(() => setHighlightInviteId(prev => (prev === inviteId ? null : prev)), 3500);
  }, []);

  const cardBg = '#0d0d0d';
  const cardBorder = '#1a1a1a';
  const cardShadow = 'none';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';
  const inputBg = '#111';

  // Inline soft-retry hint shown inside a section that failed or timed out
  // during the initial fetch. Sized to mirror the existing empty-state copy
  // (`text-center py-6`) so swapping between empty/failed/loaded states does
  // not visibly shift the surrounding layout. Tapping the hint re-runs only
  // the affected fetch via `retrySection`.
  const RetryHint = ({ sectionKey }) => {
    const status = sectionStatus[sectionKey];
    const isRetrying = status === 'retrying';
    const isReconnecting = status === 'reconnecting';
    // While the section is in its silent auto-retry window, swap the
    // failure copy for a subtle pulsing dot + "Reconnecting…" label so
    // the wait feels intentional. No tap target — the retry is happening
    // automatically — and no error styling, since this isn't (yet) a
    // failure. If the retry succeeds the section flips to 'ok' and this
    // disappears; if it fails the manual hint takes over.
    if (isReconnecting) {
      return (
        <div className="text-center py-6" role="status" aria-live="polite">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: textSecondary }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'currentColor' }}
              aria-hidden="true"
            />
            Reconnecting…
          </span>
        </div>
      );
    }
    return (
      <div className="text-center py-6">
        <button
          type="button"
          onClick={() => retrySection(sectionKey)}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-60"
          style={{ color: textSecondary }}
          aria-label="Retry loading this section"
        >
          {isRetrying ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8" />
              </svg>
              Retrying…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Couldn&apos;t load this — tap to retry
            </>
          )}
        </button>
      </div>
    );
  };

  const SocialSection = () => (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}>
      {socialTab === 'search' && (
        <div className="p-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            style={{ backgroundColor: inputBg, border: `1px solid ${cardBorder}`, color: textPrimary }}
          />
        </div>
      )}

      <div className="flex gap-1 p-1.5" style={{ borderBottom: `1px solid ${cardBorder}` }}>
        {[
          { key: 'friends', label: 'Friends', count: 0 },
          { key: 'requests', label: 'Requests', count: requestCount },
          { key: 'invites', label: 'Invites', count: inviteCount },
          { key: 'search', label: 'Find', count: 0 },
        ].map(tab => {
          const active = socialTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSocialTab(tab.key)}
              className="relative flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all"
              style={{
                color: active ? '#fff' : textSecondary,
                background: active ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : 'transparent',
                boxShadow: active ? '0 2px 8px rgba(59,130,246,0.35)' : 'none',
              }}
            >
              <span className="inline-flex items-center gap-1.5 justify-center">
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold"
                    style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#ef4444',
                      color: '#fff',
                    }}
                  >
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {socialTab === 'friends' && (
          friends.length === 0 ? (
            (sectionStatus.friends === 'failed' || sectionStatus.friends === 'retrying' || sectionStatus.friends === 'reconnecting') ? (
              <RetryHint sectionKey="friends" />
            ) : (
              <div className="text-center py-6">
                <p className="text-sm mb-2" style={{ color: textSecondary }}>No friends yet</p>
                <button onClick={() => setSocialTab('search')} className="text-blue-400 text-xs font-medium">Find players</button>
              </div>
            )
          ) : (
            <div className="divide-y" style={{ borderColor: cardBorder }}>
              {friends.map(friend => {
                const lastSeenLabel = !friend.isOnline && friend.lastSeenAt != null ? formatLastSeen(friend.lastSeenAt) : '';
                const pendingInvite = pendingInviteByUserId.get(friend.id);
                const hasPendingInvite = !!pendingInvite;
                return (
                <div key={friend.id} className="flex items-center gap-3 px-3 py-3 group transition-colors hover:bg-white/[0.02]">
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => goToProfile(friend)}>
                    <FramedAvatar
                      user={friend}
                      size={44}
                      isOnline={friend.isOnline}
                      onlineDotBorderColor={cardBg}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate cursor-pointer" style={{ color: textPrimary }} onClick={() => goToProfile(friend)}>
                      {friend.username}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.49L12 14.77 7.06 17.39 8 11.9 4 8l5.61-1.16L12 2z" /></svg>
                        {friend.battleWins || 0}W · {friend.battleLosses || 0}L
                      </span>
                      {hasPendingInvite ? (
                        <button
                          type="button"
                          onClick={() => openPendingInvite(pendingInvite.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
                          title="View pending invite"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                          Invite pending
                        </button>
                      ) : friend.isOnline ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/15 text-green-300 border border-green-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Online
                        </span>
                      ) : lastSeenLabel ? (
                        <span className="text-[10px]" style={{ color: textSecondary }}>{lastSeenLabel}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Mobile: icon-only message */}
                    <button
                      onClick={() => openMessagePopup(friend)}
                      className="sm:hidden p-2 rounded-lg transition-colors bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-300 border border-blue-500/20"
                      title="Message"
                      aria-label="Message"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                    {/* Desktop: text message button */}
                    <button
                      onClick={() => openMessagePopup(friend)}
                      className="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-300 border border-blue-500/20"
                    >
                      Message
                    </button>
                    {/* Quick invite: re-send last buy-in with one tap.
                        When an invite to this friend is already pending, we
                        disable it so the user doesn't fire a duplicate the
                        server would reject. The button surfaces the
                        remembered buy-in (and a tiny mode hint for non-default
                        modes) so power users know exactly what they're firing
                        off. When nothing is remembered yet, a small "Pick"
                        label tells them the first tap will open the picker. */}
                    <button
                      onClick={() => handleQuickInvite(friend)}
                      disabled={quickInviteFor === friend.id || hasPendingInvite}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all bg-yellow-500/10 hover:bg-yellow-500/20 active:bg-yellow-500/30 text-yellow-300 border border-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-yellow-500/10"
                      title={
                        hasPendingInvite
                          ? 'Invite already pending'
                          : lastBuyIn
                          ? `Quick invite — ${isBeta ? `${formatMoney(lastBuyIn.buyIn, 0)} Clash Coins` : `$${lastBuyIn.buyIn}`} ${QUICK_MODE_LABELS[lastBuyIn.gameMode] || 'Original'}`
                          : 'Quick invite — pick a buy-in (opens the full picker)'
                      }
                      aria-label={
                        hasPendingInvite
                          ? `Invite to ${friend.username || 'friend'} already pending`
                          : lastBuyIn
                          ? `Quick invite ${friend.username || 'friend'} with ${isBeta ? `${formatMoney(lastBuyIn.buyIn, 0)} Clash Coins` : `$${lastBuyIn.buyIn}`} ${QUICK_MODE_LABELS[lastBuyIn.gameMode] || 'Original'} buy-in`
                          : `Quick invite ${friend.username || 'friend'} — opens picker to set a buy-in`
                      }
                    >
                      {quickInviteFor === friend.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8" /></svg>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          {lastBuyIn ? (
                            <span className="text-[10px] font-bold leading-none whitespace-nowrap">
                              {isBeta ? formatMoney(lastBuyIn.buyIn, 0) : `$${lastBuyIn.buyIn}`}
                              {lastBuyIn.gameMode && lastBuyIn.gameMode !== 'original' && (
                                <span className="ml-0.5 opacity-70">{QUICK_MODE_BADGES[lastBuyIn.gameMode] || ''}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold leading-none opacity-70">Pick</span>
                          )}
                        </>
                      )}
                    </button>
                    {/* Play button. When an invite is already pending, we
                        repurpose this CTA to jump to the Invites tab so the
                        user can review or cancel it instead of triggering a
                        duplicate that the server would reject. */}
                    {hasPendingInvite ? (
                      <button
                        onClick={() => openPendingInvite(pendingInvite.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.03] active:scale-[0.97] bg-orange-500/15 text-orange-300 border border-orange-500/30"
                        title="View pending invite"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Pending
                      </button>
                    ) : (
                      <button
                        onClick={() => { setPlayFriendInitial(friend); setShowPlayFriend(true); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 2px 8px rgba(124,58,237,0.35)' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Play
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}

        {socialTab === 'requests' && (
          requestCount === 0 ? (
            (sectionStatus.requests === 'failed' || sectionStatus.requests === 'retrying' || sectionStatus.requests === 'reconnecting') ? (
              <RetryHint sectionKey="requests" />
            ) : (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: textSecondary }}>No pending requests</p>
              </div>
            )
          ) : (
            <div className="divide-y" style={{ borderColor: cardBorder }}>
              {friendRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 px-3 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => goToProfile(req.sender)}>
                    <FramedAvatar user={req.sender} size={40} onlineDotBorderColor={cardBg} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate cursor-pointer" style={{ color: textPrimary }} onClick={() => goToProfile(req.sender)}>{req.sender?.username}</div>
                    <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Wants to be friends
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptFriendRequest(req.id)}
                      className="px-2.5 py-1.5 text-white text-[10px] font-bold rounded-md transition hover:scale-[1.03] active:scale-[0.97]"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
                    >Accept</button>
                    <button
                      onClick={() => handleDeclineFriendRequest(req.id)}
                      className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold rounded-md transition"
                    >Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {socialTab === 'invites' && (
          (invites.received?.length === 0 && invites.sent?.length === 0) ? (
            (sectionStatus.invites === 'failed' || sectionStatus.invites === 'retrying' || sectionStatus.invites === 'reconnecting') ? (
              <RetryHint sectionKey="invites" />
            ) : (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: textSecondary }}>No pending battle invites</p>
              </div>
            )
          ) : (
            <div className="divide-y" style={{ borderColor: cardBorder }}>
              {(invites.received || []).map(invite => (
                <div
                  key={invite.id}
                  ref={invite.id === highlightInviteId ? inviteRowRef : null}
                  className={`px-3 py-3 bg-gradient-to-r from-blue-900/25 via-purple-900/10 to-transparent transition-all duration-500 ${invite.id === highlightInviteId ? 'invite-row-highlight' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-shrink-0">
                      <FramedAvatar user={invite.sender} size={40} onlineDotBorderColor={cardBg} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: textPrimary }}>{invite.sender?.username} <span className="text-blue-300">challenged you!</span></div>
                      <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1" /></svg>
                        {isBeta
                          ? `${formatMoney(invite.buyIn, 0)} Clash Coins buy-in · ${formatMoney(parseFloat(invite.buyIn) * 2, 0)} Crowns pot`
                          : `$${invite.buyIn} buy-in · $${parseFloat(invite.buyIn) * 2} pot`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAcceptInvite(invite.id)} className="flex-1 py-1.5 text-white text-[11px] font-bold rounded-md transition hover:scale-[1.01] active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>Accept</button>
                    <button onClick={() => handleDeclineInvite(invite.id)} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] font-bold rounded-md transition">Decline</button>
                  </div>
                </div>
              ))}
              {(invites.sent || []).map(invite => (
                <div
                  key={invite.id}
                  ref={invite.id === highlightInviteId ? inviteRowRef : null}
                  className={`flex items-center gap-3 px-3 py-3 transition-all duration-500 ${invite.id === highlightInviteId ? 'invite-row-highlight' : ''}`}
                >
                  <div className="flex-shrink-0">
                    <FramedAvatar user={invite.receiver} size={36} onlineDotBorderColor={cardBg} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: textPrimary }}>{invite.receiver?.username || 'User'}</div>
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      Pending response
                    </span>
                  </div>
                  <button onClick={() => handleCancelInvite(invite.id)} className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition flex-shrink-0">Cancel</button>
                </div>
              ))}
              {(invites.recentlyClosed || []).map(invite => {
                const statusStyles = invite.status === 'accepted'
                  ? { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-300', label: 'Accepted' }
                  : invite.status === 'expired'
                    ? { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-300', label: 'Expired' }
                    : invite.status === 'declined'
                      ? { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300', label: 'Declined' }
                      : { bg: 'bg-gray-500/15', border: 'border-gray-500/30', text: 'text-gray-300', label: invite.status };
                return (
                  <div key={invite.id} className="flex items-center gap-3 px-3 py-3 opacity-80">
                    <div className="flex-shrink-0">
                      <FramedAvatar user={invite.receiver} size={36} onlineDotBorderColor={cardBg} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: textPrimary }}>{invite.receiver?.username || 'User'}</div>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${statusStyles.bg} ${statusStyles.border} ${statusStyles.text}`}>
                      {statusStyles.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {socialTab === 'search' && (
          searchQuery.length < 2 ? (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: textSecondary }}>Type to search for players</p>
            </div>
          ) : searching ? (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: textSecondary }}>No players found</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: cardBorder }}>
              {searchResults.map(user => {
                const pendingInvite = pendingInviteByUserId.get(user.id);
                const hasPendingInvite = !!pendingInvite;
                return (
                <div key={user.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" style={{ backgroundColor: '#374151' }} onClick={() => goToProfile(user)}>
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold" style={{ color: textPrimary }}>{user.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate cursor-pointer" style={{ color: textPrimary }} onClick={() => goToProfile(user)}>{user.username}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: textSecondary }}>{user.battleWins || 0}W-{user.battleLosses || 0}L</span>
                      {hasPendingInvite && (
                        <button
                          type="button"
                          onClick={() => openPendingInvite(pendingInvite.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
                          title="View pending invite"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                          Invite pending
                        </button>
                      )}
                    </div>
                  </div>
                  {userId !== user.id && (
                    friendIds.has(user.id) ? (
                      <button onClick={() => openMessagePopup(friends.find(f => f.id === user.id) || user)} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded-md">Message</button>
                    ) : (
                      <button onClick={() => handleAddFriend(user.id)} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold rounded-md transition">Add</button>
                    )
                  )}
                </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <style jsx global>{`
        @keyframes inviteRowHighlightAnim {
          0%, 100% { background-color: rgba(59, 130, 246, 0); box-shadow: inset 0 0 0 0 rgba(59, 130, 246, 0); }
          25% { background-color: rgba(59, 130, 246, 0.18); box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.55); }
          75% { background-color: rgba(59, 130, 246, 0.10); box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.35); }
        }
        .invite-row-highlight {
          animation: inviteRowHighlightAnim 1.4s ease-in-out 2;
        }
        @keyframes liveBattleHighlightAnim {
          0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
          25% { box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.55), 0 0 24px rgba(6, 182, 212, 0.45); }
          75% { box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.3), 0 0 18px rgba(6, 182, 212, 0.3); }
        }
        .live-battle-highlight {
          animation: liveBattleHighlightAnim 1.4s ease-in-out 2;
        }
      `}</style>
      <TopNavbar />

      {showLobby && (
        <MatchLobby
          matchup={showLobby}
          currentUser={session?.user}
          opponent={matchupData?.opponent || globalMatchupData?.opponent}
          myProfile={matchupData?.myProfile || globalMatchupData?.myProfile}
          onDismiss={() => setShowLobby(null)}
        />
      )}

      {showResult && (
        <MatchResult
          matchup={showResult}
          currentUserId={userId}
          resultData={resultData}
          rematchState={rematchState}
          reactionQueue={reactionQueue}
          onSendReaction={handleSendReaction}
          opponent={resultData?.opponent}
          highlight={highlightResult}
          highlightRematch={highlightRematch}
          onRematchAccept={
            (showResult?.isFakeOpponent || resultData?.isFakeOpponent)
              ? () => { closeResultPopup(); setShowQuickMatch(true); }
              : handleRematchAccept
          }
          onRematchDecline={handleRematchDecline}
          onClose={closeResultPopup}
        />
      )}

      <ForfeitModal
        isOpen={showForfeitModal && !!activeMatchup}
        matchup={activeMatchup}
        onCancel={() => setShowForfeitModal(false)}
        onConfirm={async () => {
          const res = await fetch('/api/battles/forfeit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchupId: activeMatchup?.id }),
          });
          if (res.ok) {
            const data = await res.json();
            setShowForfeitModal(false);
            setForfeitConfirmation({
              opponent: matchupData?.opponent,
              payout: data.matchup?.winnerPayout,
              totalPot: data.matchup?.totalPot,
            });
            setActiveMatchup(null);
            refreshGlobalMatchup();
            fetchData();
          }
        }}
      />

      <ForfeitConfirmedModal
        isOpen={!!forfeitConfirmation}
        opponent={forfeitConfirmation?.opponent}
        payout={forfeitConfirmation?.payout}
        totalPot={forfeitConfirmation?.totalPot}
        onClose={() => setForfeitConfirmation(null)}
      />

      <MatchHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      <div className={`pt-4 ${!isGuest ? 'pb-[calc(env(safe-area-inset-bottom,0px)+72px)] lg:pb-0' : ''}`}>
        <div className="max-w-5xl xl:max-w-[1320px] mx-auto px-4">

          {!isGuest && invites.received?.length > 0 && (
            <div className="mb-4 space-y-2">
              {invites.received.map(invite => (
                <InviteToast
                  key={invite.id}
                  invite={invite}
                  onAccept={handleAcceptInvite}
                  onDecline={handleDeclineInvite}
                  highlight={invite.id === highlightInviteId}
                />
              ))}
            </div>
          )}

          {/* Stable empty slot for the active matchup section. The matchup
              card itself only mounts when an active matchup exists, so a
              failed/timed-out fetch would otherwise look identical to "you
              have no active battle right now". When the matchup fetch is in
              the failed/retrying state and we have nothing to show, surface
              the same soft retry hint used by friends/requests/invites so the
              user can try again without a full page reload. */}
          {!isGuest && !activeMatchup && (sectionStatus.matchup === 'failed' || sectionStatus.matchup === 'retrying' || sectionStatus.matchup === 'reconnecting') && (
            <div className="mb-4 rounded-xl overflow-hidden" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6b7280' }}></div>
                  <span className="text-sm font-semibold" style={{ color: textPrimary }}>Active Battle</span>
                </div>
              </div>
              <RetryHint sectionKey="matchup" />
            </div>
          )}

          {activeMatchup && activeMatchup.status === 'waiting' && (
            <div className="mb-4 rounded-xl overflow-hidden" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'rgba(249,115,22,0.2)'}`, boxShadow: cardShadow }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold" style={{ color: textPrimary }}>Waiting for Opponent</span>
                </div>
                <span className="text-gray-500 text-xs font-medium">
                  {activeMatchup.matchType === 'private' ? 'Private' : activeMatchup.matchType === 'friend' ? 'Friend' : 'Quick'}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="flex gap-5 mb-3">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Buy-In</p>
                    <p className="font-semibold text-sm" style={{ color: textPrimary }}>⚔ {formatMoney(activeMatchup.startingBalance || 0, 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Duration</p>
                    <p className="font-semibold text-sm" style={{ color: textPrimary }}>
                      {activeMatchup.durationMinutes >= 1440
                        ? `${Math.floor(activeMatchup.durationMinutes / 1440)}d`
                        : activeMatchup.durationMinutes >= 60
                        ? `${Math.floor(activeMatchup.durationMinutes / 60)}h`
                        : `${activeMatchup.durationMinutes}m`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Pot</p>
                    <p className="font-semibold text-sm" style={{ color: textPrimary }}>👑 {formatMoney(activeMatchup.potSize || activeMatchup.startingBalance * 2 || 0, 0)}</p>
                  </div>
                </div>
                {activeMatchup.privateCode && (
                  <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
                    <p className="text-gray-500 text-xs text-center mb-1.5">Share this code</p>
                    <div className="text-xl font-mono font-bold text-center tracking-[0.3em] mb-2" style={{ color: textPrimary }}>
                      {activeMatchup.privateCode}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeMatchup.privateCode);
                        const btn = document.getElementById('copy-code-btn');
                        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000); }
                      }}
                      id="copy-code-btn"
                      className="w-full font-medium py-2 rounded-lg transition-colors text-sm"
                      style={{ backgroundColor: '#1a1a1a', color: textPrimary, border: `1px solid ${cardBorder}` }}
                    >
                      Copy Code
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-500 text-xs">Searching...</span>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Cancel this match?')) {
                        fetch('/api/battles/private', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'cancel' }),
                        })
                          .then(r => r.json())
                          .then(data => { if (data.success) { setActiveMatchup(null); fetchData(); } })
                          .catch(() => {});
                      }
                    }}
                    className="text-gray-500 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active-battle banner removed — the user explicitly asked
              that the Social page be purely social (live battles + posts
              + comments). The full hero VS card already lives on the
              dashboard, and the live battle itself still appears as a
              post in the feed below, so a separate "you're in a battle"
              banner here is redundant noise. */}
          {false && activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched') && (() => {
            const startBal = parseFloat(activeMatchup.startingBalance || 0);
            const myBal = matchupData?.myBalance ?? startBal;
            const oppBal = matchupData?.opponentBalance ?? startBal;
            const opp = matchupData?.opponent;
            const oppName = opp?.username || opp?.displayName || 'Opponent';
            const oppAvatar = opp?.avatar;
            const oppFrameId = opp?.equippedFrame;
            const endsAt = activeMatchup.endsAt;
            const timeLeft = endsAt ? Math.max(0, new Date(endsAt).getTime() - Date.now()) : null;
            const winning = myBal > oppBal;
            const losing = myBal < oppBal;
            const formatTime = (ms) => {
              if (!ms || ms <= 0) return 'Ended';
              const s = Math.floor(ms / 1000);
              const m = Math.floor(s / 60);
              const h = Math.floor(m / 60);
              const d = Math.floor(h / 24);
              if (d > 0) return `${d}d ${h % 24}h left`;
              if (h > 0) return `${h}h ${m % 60}m left`;
              if (m > 0) return `${m}m left`;
              return `${s}s left`;
            };

            return (
              <div
                className="mb-4 rounded-xl overflow-hidden cursor-pointer flex items-center gap-3 px-3 py-2.5 max-w-[1080px] mx-auto"
                style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(34,197,94,0.25)' }}
                onClick={() => router.push('/')}
                role="button"
                aria-label="You're in a live battle — go to dashboard"
              >
                <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Live battle</span>
                </span>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FramedAvatar
                    avatar={oppAvatar}
                    username={oppName}
                    frameId={oppFrameId}
                    size={28}
                    bgColor="#1a1a1a"
                    isOnline={!!opp?.isOnline && opp?.isReal !== false}
                    onlineDotBorderColor="#0d0d0d"
                  />
                  <div className="min-w-0 text-[12px] truncate" style={{ color: textPrimary }}>
                    vs <span className="font-semibold">{oppName}</span>
                    <span className={`ml-2 font-semibold ${winning ? 'text-green-400' : losing ? 'text-red-400' : 'text-gray-400'}`}>
                      ${formatMoney(myBal, 0)} – ${formatMoney(oppBal, 0)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: textSecondary }}>{formatTime(timeLeft)}</span>
                <span className="text-blue-400 text-[11px] font-semibold flex-shrink-0 hidden sm:inline">Go to Dashboard →</span>
              </div>
            );
          })()}

          {/* DEAD CODE BELOW — left in place to avoid renumbering during this
              redesign pass; the remaining IIFE branches are guarded by an
              always-false condition so the bundler tree-shakes them. */}

          {/* The new feed lives here. We pass through all the state and
              handlers it needs as one props bag so the component stays a dumb
              renderer and the page keeps owning data + side effects. */}
          <SocialFeedPage
            data={{
              currentUser: (profile || storedUser) ? {
                id: userId,
                username: profile?.username || storedUser?.username || session?.user?.name || storedUser?.name,
                avatar: profile?.avatar ?? storedUser?.avatar ?? storedUser?.image ?? null,
                frameId: profile?.equippedFrame ?? storedUser?.equippedFrame,
              } : null,
              isGuest,
              activeMatchup,
              recentMatches,
              recentHighlights,
              friends,
              invites,
              friendRequests,
              onStartBattle: () => requireAuth(() => setShowBattleOptions(true)),
              onPickQuickMatch: openQuickMatch,
              onPickPlayFriend: () => requireAuth(() => setShowPlayFriend(true), 'resumePlayFriend'),
              onPickPrivateMatch: openPrivateMatch,
              onAcceptInvite: handleAcceptInvite,
              onDeclineInvite: handleDeclineInvite,
              onAcceptFriendRequest: handleAcceptFriendRequest,
              onDeclineFriendRequest: handleDeclineFriendRequest,
              onChallengeFriend: handleQuickInvite,
              onShowHistory: () => setShowHistory(true),
            }}
          />

          {/* Live battles are now fully integrated into SocialFeedPage above
              as LiveBattlePost cards — interleaved chronologically with user
              posts by startsAt, with Spectate + Chat actions on every card,
              the LIVE NOW stories rail up top, and consistent arcade theming.
              The separate LiveBattlesSection row used to live here but it
              broke the social theme (no chat/spectate styling, dark "Watch"
              link buttons) and duplicated battles already in the feed, so
              it's been removed per the "one unified social feed" request. */}

          {/* Old dual-column layout below is dead code, gated false so the
              bundler short-circuits it and JSX renders nothing. Kept in place
              briefly to avoid a giant noisy diff during this redesign. */}
        </div>
      </div>

      {showBattleBlocker && (
        <ActiveBattleBlocker onClose={() => setShowBattleBlocker(false)} />
      )}

      <BattleModeChooser
        isOpen={showBattleOptions}
        onClose={() => setShowBattleOptions(false)}
        onPickQuickMatch={() => { setShowBattleOptions(false); openQuickMatch(); }}
        onPickChallengeFriend={() => { setPlayFriendFromChooser(true); handleBattleOptionClick(setShowPlayFriend); }}
        onPickPrivateMatch={() => { setShowBattleOptions(false); openPrivateMatch(); }}
        currentUser={{ id: userId, username: profile?.username, avatar: profile?.avatar }}
      />

      <QuickMatchModal
        isOpen={showQuickMatch}
        onClose={() => setShowQuickMatch(false)}
        onBack={() => { setShowQuickMatch(false); setShowBattleOptions(true); }}
        userId={userId}
        onMatchFound={(matchup, opponent) => {
          setShowQuickMatch(false);
          if (matchup) {
            if (opponent) {
              setMatchupData(prev => ({ ...(prev || {}), opponent }));
            }
            refreshGlobalMatchup();
          }
          enterMatchupAfterStart(matchup, { setLobby: setShowLobby });
        }}
      />

      <PlayFriendModal
        isOpen={showPlayFriend}
        onClose={() => { setShowPlayFriend(false); setPlayFriendFromChooser(false); setPlayFriendInitial(null); setPlayFriendSentInvite(null); refreshLastBuyIn(); }}
        onBack={playFriendFromChooser ? () => { setShowPlayFriend(false); setPlayFriendFromChooser(false); setPlayFriendInitial(null); setPlayFriendSentInvite(null); setShowBattleOptions(true); } : undefined}
        friends={friends}
        initialFriend={playFriendInitial}
        initialBuyIn={lastBuyIn}
        initialSentInvite={playFriendSentInvite}
        currentUser={profile ? { id: userId, username: profile.username, avatar: profile.avatar, frameId: profile.equippedFrame } : (session?.user ? { id: userId, username: session.user.name, avatar: session.user.image } : null)}
        onInviteSent={() => { fetchData(); refreshLastBuyIn(); }}
        onInviteCancelled={() => { setPlayFriendSentInvite(null); fetchData(); }}
        onSwitchToPrivate={() => { setShowPlayFriend(false); setPlayFriendFromChooser(false); setPlayFriendInitial(null); setPlayFriendSentInvite(null); setShowPrivateMatch(true); }}
        onOpenMessage={(friend) => { setShowPlayFriend(false); setPlayFriendFromChooser(false); setPlayFriendInitial(null); setPlayFriendSentInvite(null); openMessagePopup(friend); }}
      />

      <MessagePopup
        isOpen={!!messageFriend}
        friend={messageFriend}
        ctx={notificationsCtx}
        myId={userId}
        onClose={closeMessagePopup}
      />

      <PrivateMatchModal
        isOpen={showPrivateMatch}
        onClose={() => setShowPrivateMatch(false)}
        userId={userId}
        onMatchJoined={(matchup) => {
          setShowPrivateMatch(false);
          if (matchup) setActiveMatchup(matchup);
          fetchData();
        }}
      />

      {quickToast && (
        <div
          key={quickToast.id}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 z-[90] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg pointer-events-none quick-invite-toast"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            backgroundColor: quickToast.type === 'error' ? 'rgba(127, 29, 29, 0.95)' : 'rgba(15, 23, 42, 0.95)',
            color: quickToast.type === 'error' ? '#fecaca' : '#e2e8f0',
            border: `1px solid ${quickToast.type === 'error' ? 'rgba(248,113,113,0.4)' : 'rgba(250,204,21,0.4)'}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {quickToast.type !== 'error' && <span className="mr-2">⚡</span>}
          {quickToast.message}
        </div>
      )}
      <style jsx global>{`
        @keyframes quickInviteToastIn {
          from { transform: translate(-50%, 12px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .quick-invite-toast {
          transform: translateX(-50%);
          animation: quickInviteToastIn 0.22s ease-out;
        }
      `}</style>

    </div>
  );
}

export async function getServerSideProps(context) {
  const { getBattlePreviewProps } = await import('../lib/battle-preview');
  return getBattlePreviewProps(context, {
    queryKeys: ['battle', 'live', 'forfeit', 'result'],
    inviteKeys: ['invite'],
  });
}
