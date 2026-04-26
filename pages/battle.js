import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import FramedAvatar from '../components/UserAvatar';
import QuickMatchModal from '../components/battle/QuickMatchModal';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import PrivateMatchModal from '../components/battle/PrivateMatchModal';
import InviteToast from '../components/battle/InviteToast';
import MatchHistoryModal from '../components/battle/MatchHistoryModal';
import MatchLobby from '../components/battle/MatchLobby';
import MatchResult from '../components/battle/MatchResult';
import LiveBattlesSection from '../components/battle/LiveBattlesSection';
import ForfeitModal from '../components/battle/ForfeitModal';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import ConnectionBadge from '../components/battle/ConnectionBadge';
import { useMatchup } from '../contexts/MatchupContext';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagePopup from '../components/messages/MessagePopup';
import { useProfileCache } from '../contexts/ProfileCacheContext';
import { formatMoney } from '../utils/formatMoney';
import { formatLastSeen } from '../utils/relativeTime';
import { readBattleResult, clearBattleResult } from '../utils/battleResultCache';
import { readLastBuyIn, writeLastBuyIn } from '../utils/lastBattleBuyIn';
import { getBattleStreamClient } from '../lib/battleStreamClient';

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
  const router = useRouter();
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
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState({ received: [], sent: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentHighlights, setRecentHighlights] = useState([]);
  const [activeMatchup, setActiveMatchup] = useState(null);
  const [matchupData, setMatchupData] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);

  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  const [playFriendInitial, setPlayFriendInitial] = useState(null);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
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
  const isGuest = status !== 'authenticated';
  const userId = session?.user?.id;
  const debounceRef = useRef(null);

  useEffect(() => {
    setSuppress('battle_invites', true);
    setSuppress('friend_requests', true);
    return () => {
      setSuppress('battle_invites', false);
      setSuppress('friend_requests', false);
    };
  }, [setSuppress]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, friendsRes, invitesRes, historyRes, matchupRes, requestsRes] = await Promise.allSettled([
        fetch(`/api/profiles/${userId}`),
        fetch('/api/friends'),
        fetch('/api/battles/invite'),
        fetch('/api/battles/history?limit=5'),
        fetch('/api/matchups/current'),
        fetch('/api/friends/requests'),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const data = await profileRes.value.json();
        setProfile(data.profile || data);
      }
      if (friendsRes.status === 'fulfilled' && friendsRes.value.ok) {
        const data = await friendsRes.value.json();
        setFriends(data.friends || []);
      }
      if (invitesRes.status === 'fulfilled' && invitesRes.value.ok) {
        const data = await invitesRes.value.json();
        setInvites(data);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const data = await historyRes.value.json();
        setRecentMatches(data.matches || []);
      }
      if (matchupRes.status === 'fulfilled' && matchupRes.value.ok) {
        const data = await matchupRes.value.json();
        if (data.matchup && (data.matchup.status === 'active' || data.matchup.status === 'matched' || data.matchup.status === 'waiting')) {
          setActiveMatchup(data.matchup);
          setMatchupData(data);
        }
      }
      if (requestsRes.status === 'fulfilled' && requestsRes.value.ok) {
        const data = await requestsRes.value.json();
        setFriendRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching battle data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hydrate the remembered buy-in once we know who the user is. Reads from
  // localStorage so it's safe to call after mount without an extra fetch.
  const refreshLastBuyIn = useCallback(() => {
    if (!userId) {
      setLastBuyIn(null);
      return;
    }
    setLastBuyIn(readLastBuyIn(userId));
  }, [userId]);

  useEffect(() => {
    refreshLastBuyIn();
  }, [refreshLastBuyIn]);

  useEffect(() => {
    let cancelled = false;
    const limit = isGuest ? 5 : 3;
    const load = async () => {
      try {
        const res = await fetch(`/api/battles/recent?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRecentHighlights(Array.isArray(data.battles) ? data.battles : []);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
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

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      try {
        const [inviteRes, matchupRes] = await Promise.all([
          fetch('/api/battles/invite'),
          fetch('/api/matchups/current'),
        ]);

        let matchData = null;
        if (matchupRes.ok) matchData = await matchupRes.json();

        if (inviteRes.ok) {
          const data = await inviteRes.json();
          const hadPendingSent = invites.sent?.length > 0;
          const hasPendingSent = data.sent?.length > 0;
          setInvites(data);

          if (hadPendingSent && !hasPendingSent && matchData?.matchup) {
            if (matchData.matchup.status === 'active' || matchData.matchup.status === 'matched') {
              setActiveMatchup(matchData.matchup);
              setMatchupData(matchData);
              setShowLobby(matchData.matchup);
              refreshGlobalMatchup();
              setTimeout(() => router.push('/?battleStarted=true'), 2500);
            }
          }
        }

        if (matchData?.matchup && (matchData.matchup.status === 'active' || matchData.matchup.status === 'matched')) {
          setMatchupData(matchData);
          setActiveMatchup(matchData.matchup);
          refreshGlobalMatchup();
        }

        if (activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched')) {
          if (matchData && (!matchData.matchup || matchData.status === 'none')) {
            const histRes = await fetch('/api/battles/history?limit=1');
            if (histRes.ok) {
              const histData = await histRes.json();
              const lastMatch = histData.matches?.[0];
              if (lastMatch && lastMatch.id === activeMatchup.id) {
                setActiveMatchup(null);
                setShowResult({
                  ...activeMatchup,
                  ...lastMatch,
                  status: 'completed',
                  winnerId: lastMatch.winnerId || lastMatch.winner_id,
                  user1FinalBalance: lastMatch.user1FinalBalance || lastMatch.user1_final_balance || activeMatchup.user1Balance,
                  user2FinalBalance: lastMatch.user2FinalBalance || lastMatch.user2_final_balance || activeMatchup.user2Balance,
                });
                // Pull authoritative data (cash P&L, rematch state, opponent profile)
                loadResultDetails(lastMatch.id);
                fetchData();
              }
            }
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, invites.sent?.length, activeMatchup?.id, activeMatchup?.status, refreshGlobalMatchup]);

  useEffect(() => {
    if (!userId || !activeMatchup || activeMatchup.status !== 'waiting') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/matchups/current');
        if (res.ok) {
          const data = await res.json();
          if (data.matchup) {
            if (data.matchup.status === 'active' || data.matchup.status === 'matched') {
              setActiveMatchup(data.matchup);
              setMatchupData(data);
              setShowLobby(data.matchup);
              refreshGlobalMatchup();
              clearInterval(interval);
              setTimeout(() => router.push('/?battleStarted=true'), 2500);
            }
          } else {
            setActiveMatchup(null);
            clearInterval(interval);
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, activeMatchup?.status]);

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
  // another tab, or an outgoing invite expires server-side. Without this
  // we'd wait up to 5 s for the polling loop above to notice.
  //
  // We also mirror the polling loop's "outgoing invite was just accepted →
  // auto-show the lobby" transition here. If we only refreshed invites,
  // the polling loop would re-mount with sent.length already 0 and miss
  // the pending → matched transition entirely.
  const invitesRef = useRef(invites);
  useEffect(() => { invitesRef.current = invites; }, [invites]);
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
                setShowLobby(matchData.matchup);
                refreshGlobalMatchup();
                setTimeout(() => router.push('/?battleStarted=true'), 2500);
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
        scheduleRefresh();
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [userId, isGuest, refreshGlobalMatchup, router]);

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
    setTimeout(() => router.push('/?battleStarted=true'), 400);
  }, [rematchState?.rematchMatchupId]);

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
        if (data.matchup) {
          setShowLobby(data.matchup);
        } else if (data.matchupId) {
          const matchRes = await fetch(`/api/matchups/${data.matchupId}`);
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            setShowLobby(matchData.matchup || matchData);
          } else {
            router.push('/');
          }
        }
        fetchData();
        refreshGlobalMatchup();
        setTimeout(() => router.push('/?battleStarted=true'), 2500);
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
    if (!friend?.id) return;
    if (isGuest) {
      requireAuth(() => {});
      return;
    }
    if (globalHasActive) {
      showQuickToast("You're already in a battle — finish it first.", 'error');
      return;
    }
    const last = readLastBuyIn(userId);
    if (!last) {
      // No remembered buy-in — open the modal so the user can pick one.
      setPlayFriendInitial(friend);
      setShowPlayFriend(true);
      return;
    }
    if (quickInviteFor) return;
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
        return;
      }
      // Refresh the remembered values (mode may have been normalised server-side).
      writeLastBuyIn(userId, { buyIn: last.buyIn, gameMode: last.gameMode });
      refreshLastBuyIn();
      showQuickToast(`Invite sent to ${friend.username || 'friend'} · $${last.buyIn} buy-in`);
      fetchData();
    } catch {
      showQuickToast('Could not send invite. Try again.', 'error');
    } finally {
      setQuickInviteFor(null);
    }
  }, [isGuest, globalHasActive, userId, quickInviteFor, fetchData, showQuickToast, refreshLastBuyIn]);

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

  const requireAuth = (callback) => {
    if (isGuest) {
      if (typeof window !== 'undefined') window.__pendingAuthAction = 'resumeBattleOptions';
      window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signin', pendingAction: 'resumeBattleOptions' } }));
      return;
    }
    callback();
  };

  useEffect(() => {
    const handleResume = () => setShowBattleOptions(true);
    window.addEventListener('resumeBattleOptions', handleResume);
    return () => window.removeEventListener('resumeBattleOptions', handleResume);
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
            <div className="text-center py-6">
              <p className="text-sm mb-2" style={{ color: textSecondary }}>No friends yet</p>
              <button onClick={() => setSocialTab('search')} className="text-blue-400 text-xs font-medium">Find players</button>
            </div>
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
                          ? `Quick invite — $${lastBuyIn.buyIn} ${QUICK_MODE_LABELS[lastBuyIn.gameMode] || 'Original'}`
                          : 'Quick invite — pick a buy-in (opens the full picker)'
                      }
                      aria-label={
                        hasPendingInvite
                          ? `Invite to ${friend.username || 'friend'} already pending`
                          : lastBuyIn
                          ? `Quick invite ${friend.username || 'friend'} with $${lastBuyIn.buyIn} ${QUICK_MODE_LABELS[lastBuyIn.gameMode] || 'Original'} buy-in`
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
                              ${lastBuyIn.buyIn}
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
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: textSecondary }}>No pending requests</p>
            </div>
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
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: textSecondary }}>No pending battle invites</p>
            </div>
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
                        ${invite.buyIn} buy-in · ${parseFloat(invite.buyIn) * 2} pot
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

      <div className={`pt-14 ${!isGuest ? 'pb-[calc(env(safe-area-inset-bottom,0px)+72px)] lg:pb-0' : ''}`}>
        <div className="max-w-5xl mx-auto px-4">

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
                    <p className="font-semibold text-sm" style={{ color: textPrimary }}>${formatMoney(activeMatchup.startingBalance || 0, 0)}</p>
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
                    <p className="font-semibold text-sm" style={{ color: textPrimary }}>${formatMoney(activeMatchup.potSize || activeMatchup.startingBalance * 2 || 0, 0)}</p>
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

          {activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched') && (() => {
            const startBal = parseFloat(activeMatchup.startingBalance || 0);
            const myBal = matchupData?.myBalance ?? startBal;
            const oppBal = matchupData?.opponentBalance ?? startBal;
            const myPnl = myBal - startBal;
            const oppPnl = oppBal - startBal;
            const pot = parseFloat(activeMatchup.potSize || startBal * 2 || 0);
            const opp = matchupData?.opponent;
            const myName = profile?.username || session?.user?.name || '';
            const myAvatar = profile?.avatar;
            const myFrameId = profile?.equippedFrame;
            const oppName = opp?.username || opp?.displayName || 'Opponent';
            const oppAvatar = opp?.avatar;
            const oppFrameId = opp?.equippedFrame;
            const totalBal = myBal + oppBal;
            const myPercent = totalBal > 0 ? Math.max(5, Math.min(95, (myBal / totalBal) * 100)) : 50;
            const endsAt = activeMatchup.endsAt;
            const startsAt = activeMatchup.startsAt || activeMatchup.createdAt;
            const totalDuration = endsAt && startsAt ? new Date(endsAt) - new Date(startsAt) : 0;
            const elapsed = startsAt ? Date.now() - new Date(startsAt).getTime() : 0;
            const timeProgress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
            const timeLeft = endsAt ? Math.max(0, new Date(endsAt).getTime() - Date.now()) : null;
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
              <div className="mb-4 rounded-xl overflow-hidden cursor-pointer" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }} onClick={() => router.push('/')}>
                <style>{`
                  @keyframes battlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                  @keyframes vsGlow { 0%, 100% { text-shadow: 0 0 10px rgba(59,130,246,0.5); } 50% { text-shadow: 0 0 20px rgba(59,130,246,0.8); } }
                  .battle-hero-pulse { animation: battlePulse 2s ease-in-out infinite; }
                  .vs-glow { animation: vsGlow 2s ease-in-out infinite; }
                `}</style>

                <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full battle-hero-pulse"></div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400">Live Battle</span>
                    <ConnectionBadge className="ml-1" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">{formatTime(timeLeft)}</span>
                    <span className="text-blue-400 text-[10px] font-medium">Place Picks →</span>
                  </div>
                </div>

                <div className="relative px-4 py-4">
                  <div className="flex items-center">
                    <div className="flex-1 flex flex-col items-center text-center">
                      <div className="mb-1.5">
                        <FramedAvatar
                          avatar={myAvatar}
                          username={myName || 'Y'}
                          frameId={myFrameId}
                          size={64}
                          bgColor="#1a1a1a"
                        />
                      </div>
                      <p className="text-white font-semibold text-xs truncate max-w-[100px] min-h-[16px]">{myName || '\u00A0'}</p>
                      <p className={`text-sm font-bold mt-0.5 ${myPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${formatMoney(myBal, 0)}</p>
                      <p className={`text-[10px] font-medium ${myPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>{myPnl >= 0 ? '+' : ''}{formatMoney(myPnl, 0)}</p>
                    </div>

                    <div className="flex flex-col items-center px-3">
                      <span className="text-xl sm:text-2xl font-black text-blue-400 vs-glow">VS</span>
                      <div className="text-[9px] text-gray-500 font-medium mt-1 text-center">
                        <span className="text-white font-bold">${formatMoney(pot, 0)}</span> pot
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center text-center">
                      <div className="mb-1.5 rounded-full inline-flex items-center justify-center">
                        <FramedAvatar
                          avatar={oppAvatar}
                          username={oppName}
                          frameId={oppFrameId}
                          size={64}
                          bgColor="#1a1a1a"
                          isOnline={!!opp?.isOnline && opp?.isReal !== false}
                          onlineDotBorderColor="#0d0d0d"
                        />
                      </div>
                      <div className="flex items-center justify-center max-w-[100px] min-h-[16px]">
                        <p className="text-white font-semibold text-xs truncate">{oppName}</p>
                      </div>
                      <p className={`text-sm font-bold mt-0.5 ${oppPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${formatMoney(oppBal, 0)}</p>
                      <p className={`text-[10px] font-medium ${oppPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>{oppPnl >= 0 ? '+' : ''}{formatMoney(oppPnl, 0)}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500 w-8">{myPercent.toFixed(0)}%</span>
                      <div className="flex-1 mx-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                        <div className="h-full rounded-full transition-all duration-1000" style={{
                          width: `${myPercent}%`,
                          background: myPnl >= 0 ? 'linear-gradient(90deg, #22c55e, #10b981)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                        }}></div>
                      </div>
                      <span className="text-[10px] text-gray-500 w-8">{(100 - myPercent).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timeProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowForfeitModal(true); }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      color: '#ef4444',
                      boxShadow: '0 1px 2px rgba(239, 68, 68, 0.1)',
                    }}
                  >
                    <span>🏳️</span>
                    <span>Forfeit</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push('/'); }}
                    className="flex items-center gap-1 text-blue-400 text-xs font-medium"
                  >
                    Go to Dashboard
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            );
          })()}

          {(() => {
            const battleCTA = (
              <div className="rounded-xl overflow-hidden mb-5 relative" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}>
                <div className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(ellipse at 100% 0%, rgba(249,115,22,0.16), transparent 60%)' }} />
                <div className="relative p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      1v1 Battle
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>Winner takes pot · 5% rake</span>
                  </div>

                  <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/20 to-blue-600/5">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">You</span>
                    </div>

                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-orange-400 to-red-500 bg-clip-text text-transparent leading-none">VS</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>Head to head</div>
                    </div>

                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/20 to-red-600/5">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300">Rival</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: '#111', borderColor: cardBorder, color: textPrimary }}>
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1" /></svg>
                      Same bankroll
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: '#111', borderColor: cardBorder, color: textPrimary }}>
                      <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Live piks
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border" style={{ backgroundColor: '#111', borderColor: cardBorder, color: textPrimary }}>
                      <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.49L12 14.77 7.06 17.39 8 11.9 4 8l5.61-1.16L12 2z" /></svg>
                      Best record wins
                    </span>
                  </div>

                  {!activeMatchup && (
                    <button
                      onClick={() => requireAuth(() => setShowBattleOptions(true))}
                      className="w-full relative overflow-hidden rounded-xl py-3.5 sm:py-4 font-bold text-base sm:text-lg text-white border border-blue-500/30 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500"></div>
                      <div className="relative flex items-center justify-center gap-2.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>Start a Battle</span>
                      </div>
                    </button>
                  )}

                  {isGuest && (
                    <div className="text-center mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <p className="text-xs mb-2" style={{ color: textSecondary }}>Create an account to start battling</p>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                        className="font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
                        style={{ backgroundColor: '#fff', color: '#000' }}
                      >
                        Sign Up Free
                      </button>
                    </div>
                  )}

                  {recentHighlights.length > 0 && (
                    <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                          {isGuest ? 'Live on Piks · Recent winners' : 'Recent battles'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: textSecondary }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {recentHighlights.slice(0, isGuest ? 5 : 3).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); router.push(`/battle/replay/${b.id}`); }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-white/5"
                            style={{ background: '#0a0a0a', border: `1px solid ${cardBorder}` }}
                          >
                            <UserAvatar user={b.winner} size="sm" />
                            <div className="min-w-0 flex-1 text-[11px] leading-tight" style={{ color: textPrimary }}>
                              <div className="truncate">
                                <span
                                  className="font-semibold text-green-400 hover:underline"
                                  onClick={(e) => { e.stopPropagation(); if (b.winner?.id) goToProfile(b.winner); }}
                                >
                                  {b.winner?.username || 'Player'}
                                </span>
                                <span style={{ color: textSecondary }}> beat </span>
                                <span
                                  className="font-medium hover:underline"
                                  onClick={(e) => { e.stopPropagation(); if (b.loser?.id) goToProfile(b.loser); }}
                                >
                                  {b.loser?.username || 'Player'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5" style={{ color: textSecondary }}>
                                <span className="font-semibold text-yellow-400">${formatMoney(b.potSize, 0)} pot</span>
                                <span>·</span>
                                <span>{formatLastSeen(b.endedAt)}</span>
                              </div>
                            </div>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );

            const socialHeader = !isGuest ? (
              <div
                className="mb-5 rounded-xl overflow-hidden"
                style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
              >
                <button
                  type="button"
                  onClick={() => setSocialExpanded(v => !v)}
                  aria-expanded={socialExpanded}
                  aria-controls="battle-social-panel"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(124,58,237,0.06) 60%, transparent)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {friends.length > 0 ? (
                      <div className="flex -space-x-2 flex-shrink-0">
                        {friends.slice(0, 3).map((f) => (
                          <div key={f.id} className="rounded-full ring-2" style={{ '--tw-ring-color': cardBg }}>
                            <FramedAvatar user={f} size={28} isOnline={f.isOnline} onlineDotBorderColor={cardBg} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-tight" style={{ color: textPrimary }}>Friends &amp; Invites</div>
                      <div className="text-[11px] leading-tight" style={{ color: textSecondary }}>
                        {friends.length} friend{friends.length === 1 ? '' : 's'}
                        {onlineFriendCount > 0 ? ` · ${onlineFriendCount} online` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {inviteCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          {inviteCount} invite{inviteCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {requestCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          {requestCount} request{requestCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {onlineFriendCount > 0 && inviteCount === 0 && requestCount === 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/15 text-green-300 border border-green-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {onlineFriendCount} online
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 transition-transform flex-shrink-0"
                    style={{ color: textSecondary, transform: socialExpanded ? 'rotate(180deg)' : 'none' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {socialExpanded && (
                  <div id="battle-social-panel" className="px-3 pb-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                    <div className="pt-3">
                      <SocialSection />
                    </div>
                  </div>
                )}
              </div>
            ) : null;

            return (
              <div className="flex flex-col lg:flex-row gap-6 pb-8">
                <div className="lg:hidden">
                  {battleCTA}
                </div>

                <div className="flex-1 min-w-0 order-2 lg:order-1">
                  {socialHeader}
                  <div className="mb-5">
                    <LiveBattlesSection focusBattleId={focusLiveBattleId || router.query.battle} currentUserId={userId} />
                  </div>

                </div>

                <div className="lg:w-[340px] flex-shrink-0 order-1 lg:order-2">
                  <div className="hidden lg:block lg:sticky lg:top-16">
                    {battleCTA}
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      </div>

      {showBattleOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowBattleOptions(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-3" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-center mb-4" style={{ color: textPrimary }}>Choose Battle Mode</h3>
            <button onClick={() => handleBattleOptionClick(setShowQuickMatch)} className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
              <div><p className="font-semibold text-sm" style={{ color: textPrimary }}>Quick Match</p><p className="text-xs" style={{ color: textSecondary }}>Find a random opponent</p></div>
            </button>
            <button onClick={() => handleBattleOptionClick(setShowPlayFriend)} className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
              <div><p className="font-semibold text-sm" style={{ color: textPrimary }}>Challenge Friend</p><p className="text-xs" style={{ color: textSecondary }}>Invite a friend to battle</p></div>
            </button>
            <button onClick={() => handleBattleOptionClick(setShowPrivateMatch)} className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
              <div><p className="font-semibold text-sm" style={{ color: textPrimary }}>Private Match</p><p className="text-xs" style={{ color: textSecondary }}>Create a room with a code</p></div>
            </button>
            <button onClick={() => setShowBattleOptions(false)} className="w-full py-2.5 text-sm font-medium" style={{ color: textSecondary }}>Cancel</button>
          </div>
        </div>
      )}

      <QuickMatchModal
        isOpen={showQuickMatch}
        onClose={() => setShowQuickMatch(false)}
        userId={userId}
        onMatchFound={(matchup, opponent) => {
          setShowQuickMatch(false);
          if (matchup) {
            if (opponent) {
              setMatchupData(prev => ({ ...(prev || {}), opponent }));
            }
            setShowLobby(matchup);
            refreshGlobalMatchup();
          }
          setTimeout(() => router.push('/?battleStarted=true'), 2500);
        }}
      />

      <PlayFriendModal
        isOpen={showPlayFriend}
        onClose={() => { setShowPlayFriend(false); setPlayFriendInitial(null); refreshLastBuyIn(); }}
        friends={friends}
        initialFriend={playFriendInitial}
        currentUser={profile ? { id: userId, username: profile.username, avatar: profile.avatar, frameId: profile.equippedFrame } : (session?.user ? { id: userId, username: session.user.name, avatar: session.user.image } : null)}
        onInviteSent={() => { fetchData(); refreshLastBuyIn(); }}
        onInviteCancelled={() => fetchData()}
        onSwitchToPrivate={() => { setShowPlayFriend(false); setPlayFriendInitial(null); setShowPrivateMatch(true); }}
        onOpenMessage={(friend) => { setShowPlayFriend(false); setPlayFriendInitial(null); openMessagePopup(friend); }}
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
