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
import BattleVoiceChat from '../components/battle/BattleVoiceChat';
import { useVoiceChat } from '../contexts/VoiceChatContext';
import ForfeitModal from '../components/battle/ForfeitModal';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import ConnectionBadge from '../components/battle/ConnectionBadge';
import { useMatchup } from '../contexts/MatchupContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { formatMoney } from '../utils/formatMoney';
import { formatLastSeen } from '../utils/relativeTime';

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

export default function BattlePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { matchup: globalMatchup, matchupData: globalMatchupData, hasActiveMatchup: globalHasActive, isWaiting: globalIsWaiting, hasAnyMatchup: globalHasAny, refresh: refreshGlobalMatchup } = useMatchup();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState({ received: [], sent: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [activeMatchup, setActiveMatchup] = useState(null);
  const [matchupData, setMatchupData] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);

  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
  const [showLobby, setShowLobby] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);
  const [showBattleOptions, setShowBattleOptions] = useState(false);
  const [focusLiveBattleId, setFocusLiveBattleId] = useState(null);
  const [highlightInviteId, setHighlightInviteId] = useState(null);
  const [highlightResult, setHighlightResult] = useState(false);
  const inviteRowRef = useRef(null);

  const [socialTab, setSocialTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const { setSuppress } = useNotifications();
  const { oppSpeaking } = useVoiceChat();
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
  const consumedDeepLinkRef = useRef(null);
  useEffect(() => {
    if (!router.isReady) return;
    if (isGuest) return;
    const { invite, forfeit, result, live } = router.query;
    const inviteId = Array.isArray(invite) ? invite[0] : invite;
    const forfeitId = Array.isArray(forfeit) ? forfeit[0] : forfeit;
    const resultId = Array.isArray(result) ? result[0] : result;
    const liveId = Array.isArray(live) ? live[0] : live;
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
        try {
          const res = await fetch('/api/battles/history?limit=20');
          if (res.ok) {
            const data = await res.json();
            const match = (data.matches || []).find(m => String(m.id) === String(resultId));
            if (match) {
              setShowResult({
                ...match,
                status: 'completed',
                winnerId: match.winnerId || match.winner_id,
                user1FinalBalance: match.user1FinalBalance || match.user1_final_balance,
                user2FinalBalance: match.user2FinalBalance || match.user2_final_balance,
              });
              // Briefly highlight the result panel so the user sees this is
              // the exact match the notification pointed to.
              setHighlightResult(true);
              setTimeout(() => setHighlightResult(false), 3500);
            }
          }
        } catch {}
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
      router.replace({ pathname: router.pathname, query: cleaned }, undefined, { shallow: true });
    })();
  }, [router.isReady, router.query.invite, router.query.forfeit, router.query.result, router.query.live, isGuest, fetchData, refreshGlobalMatchup]);

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

      <div className="flex" style={{ borderBottom: `1px solid ${cardBorder}` }}>
        {[
          { key: 'friends', label: 'Friends', count: 0 },
          { key: 'requests', label: 'Requests', count: requestCount },
          { key: 'invites', label: 'Invites', count: inviteCount },
          { key: 'search', label: 'Find', count: 0 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSocialTab(tab.key)}
            className="relative flex-1 py-2 text-[11px] font-semibold transition-colors"
            style={{
              color: socialTab === tab.key ? '#3b82f6' : textSecondary,
              borderBottom: socialTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white">
                {tab.count > 9 ? '9+' : tab.count}
              </span>
            )}
          </button>
        ))}
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
                return (
                <div key={friend.id} className="flex items-center gap-2.5 px-3 py-2.5 group">
                  <div
                    className="flex-shrink-0 cursor-pointer"
                    onClick={() => router.push(`/profile/${friend.id}`)}
                  >
                    <FramedAvatar
                      user={friend}
                      avatar={friend.avatar}
                      username={friend.username}
                      frameId={friend.frameId}
                      size={32}
                      isOnline={friend.isOnline}
                      onlineDotBorderColor={cardBg}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate cursor-pointer flex items-center gap-1.5" style={{ color: textPrimary }} onClick={() => router.push(`/profile/${friend.id}`)}>
                      <span className="truncate">{friend.username}</span>
                      {friend.isOnline && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-green-500 flex-shrink-0">Active now</span>
                      )}
                    </div>
                    <div className="text-[10px]" style={{ color: textSecondary }}>{friend.battleWins || 0}W-{friend.battleLosses || 0}L</div>
                    {lastSeenLabel && (
                      <div className="text-[10px]" style={{ color: textSecondary }}>Last seen {lastSeenLabel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { router.push(`/notifications?chat=${friend.id}`); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/20 active:bg-blue-500/20 text-blue-400"
                      title="Message"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                    <button
                      onClick={() => { setShowPlayFriend(true); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-purple-500/20 active:bg-purple-500/20 text-purple-400"
                      title="Challenge"
                      aria-label="Challenge to a battle"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v14l11-7z" /></svg>
                    </button>
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
                <div key={req.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                    style={{ backgroundColor: '#374151' }}
                    onClick={() => router.push(`/profile/${req.sender?.id}`)}
                  >
                    {req.sender?.avatar ? (
                      <img src={req.sender.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-xs font-bold" style={{ color: textPrimary }}>{req.sender?.username?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: textPrimary }}>{req.sender?.username}</div>
                    <div className="text-[10px] text-purple-400">wants to be friends</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptFriendRequest(req.id)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-md transition"
                    >Accept</button>
                    <button
                      onClick={() => handleDeclineFriendRequest(req.id)}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-medium rounded-md transition"
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
                  className={`px-3 py-2.5 bg-gradient-to-r from-blue-900/20 to-transparent transition-all duration-500 ${invite.id === highlightInviteId ? 'invite-row-highlight' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: '#374151' }}>
                      {invite.sender?.avatar ? <img src={invite.sender.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] font-bold text-white">{invite.sender?.username?.[0]?.toUpperCase() || '?'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{invite.sender?.username} challenged you!</div>
                      <div className="text-[10px]" style={{ color: textSecondary }}>${invite.buyIn} buy-in · ${parseFloat(invite.buyIn) * 2} pot</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAcceptInvite(invite.id)} className="flex-1 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-md transition">Accept</button>
                    <button onClick={() => handleDeclineInvite(invite.id)} className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-medium rounded-md transition">Decline</button>
                  </div>
                </div>
              ))}
              {(invites.sent || []).map(invite => (
                <div
                  key={invite.id}
                  ref={invite.id === highlightInviteId ? inviteRowRef : null}
                  className={`flex items-center gap-2.5 px-3 py-2.5 transition-all duration-500 ${invite.id === highlightInviteId ? 'invite-row-highlight' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: '#374151' }}>
                    {invite.receiver?.avatar ? <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] font-bold text-white">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: textPrimary }}>{invite.receiver?.username || 'User'}</div>
                    <div className="text-[10px] text-orange-400">Pending response…</div>
                  </div>
                  <button onClick={() => handleCancelInvite(invite.id)} className="text-[10px] font-medium text-gray-500 hover:text-red-400 transition flex-shrink-0">Cancel</button>
                </div>
              ))}
              {(invites.recentlyClosed || []).map(invite => (
                <div key={invite.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: '#374151' }}>
                    {invite.receiver?.avatar ? <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] font-bold text-white">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: textPrimary }}>{invite.receiver?.username || 'User'}</div>
                  </div>
                  <span className={`text-[10px] font-medium flex-shrink-0 ${invite.status === 'accepted' ? 'text-green-400' : invite.status === 'expired' ? 'text-orange-400' : invite.status === 'declined' ? 'text-red-400' : 'text-gray-400'}`}>
                    {invite.status === 'accepted' ? 'Accepted' : invite.status === 'expired' ? 'Expired' : invite.status === 'declined' ? 'Declined' : invite.status}
                  </span>
                </div>
              ))}
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
              {searchResults.map(user => (
                <div key={user.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" style={{ backgroundColor: '#374151' }} onClick={() => router.push(`/profile/${user.id}`)}>
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold" style={{ color: textPrimary }}>{user.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate cursor-pointer" style={{ color: textPrimary }} onClick={() => router.push(`/profile/${user.id}`)}>{user.username}</div>
                    <div className="text-[10px]" style={{ color: textSecondary }}>{user.battleWins || 0}W-{user.battleLosses || 0}L</div>
                  </div>
                  {userId !== user.id && (
                    friendIds.has(user.id) ? (
                      <button onClick={() => router.push(`/notifications?chat=${user.id}`)} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded-md">Message</button>
                    ) : (
                      <button onClick={() => handleAddFriend(user.id)} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold rounded-md transition">Add</button>
                    )
                  )}
                </div>
              ))}
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
          highlight={highlightResult}
          onRematch={() => { setShowResult(null); setShowQuickMatch(true); }}
          onClose={() => setShowResult(null)}
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

          {activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched') && <BattleVoiceChat />}

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
                      <div
                        className="mb-1.5 rounded-full inline-flex items-center justify-center"
                        style={{
                          padding: 2,
                          border: `2px solid ${oppSpeaking ? '#22c55e' : 'transparent'}`,
                          boxShadow: oppSpeaking ? '0 0 14px rgba(34,197,94,0.55)' : 'none',
                          transition: 'border-color 150ms ease, box-shadow 150ms ease',
                        }}
                      >
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
                      <div className="flex items-center justify-center gap-1 max-w-[100px] min-h-[16px]">
                        <p className="text-white font-semibold text-xs truncate">{oppName}</p>
                        {oppSpeaking && (
                          <span
                            className="inline-flex items-center justify-center rounded-full flex-shrink-0"
                            title="Speaking"
                            aria-label="Speaking"
                            style={{
                              width: 14,
                              height: 14,
                              background: 'rgba(34,197,94,0.18)',
                              border: '1px solid rgba(34,197,94,0.7)',
                              animation: 'battlePulse 1.2s ease-in-out infinite',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width={8} height={8} fill="#22c55e" aria-hidden="true">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                          </span>
                        )}
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

                <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowForfeitModal(true); }}
                    className="text-gray-600 text-[10px] font-medium hover:text-red-400 transition-colors"
                  >Forfeit</button>
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
              <div className="rounded-xl overflow-hidden mb-5" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}>
                <div className="p-5 sm:p-6 text-center">
                  <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: textPrimary }}>1v1 Betting Battles</h2>
                  <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: textSecondary }}>
                    Go head-to-head against another player. Both start with the same bankroll, make your piks on live games, and the best record takes the pot.
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2 border border-blue-500/20">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: textPrimary }}>Pick Games</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>Both players make piks on live games</p>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: textPrimary }}>Track Live</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>Watch your balance move in real time</p>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
                      <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-2 border border-orange-500/20">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: textPrimary }}>Winner Takes Pot</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>Keep the entire pot, just a 5% rake</p>
                    </div>
                  </div>

                  {!activeMatchup && (
                    <button
                      onClick={() => requireAuth(() => setShowBattleOptions(true))}
                      className="w-full relative overflow-hidden rounded-xl py-4 sm:py-5 font-bold text-lg text-white border border-blue-500/30 transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500"></div>
                      <div className="relative flex items-center justify-center gap-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>Start a Battle</span>
                      </div>
                    </button>
                  )}

                  {isGuest && (
                    <div className="text-center mt-4 pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <p className="text-sm mb-3" style={{ color: textSecondary }}>Create an account to start battling</p>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                        className="font-semibold py-2.5 px-8 rounded-lg transition-colors text-sm"
                        style={{ backgroundColor: '#fff', color: '#000' }}
                      >
                        Sign Up Free
                      </button>
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
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}>
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
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
        onClose={() => setShowPlayFriend(false)}
        friends={friends}
        onInviteSent={() => fetchData()}
        onSwitchToPrivate={() => { setShowPlayFriend(false); setShowPrivateMatch(true); }}
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
