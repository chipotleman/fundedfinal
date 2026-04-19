import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';
import { useMatchup } from '../../contexts/MatchupContext';

const ACTIVE_BATTLE_BLOCK_MESSAGE = "You're already in a battle — finish it before inviting someone else.";

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const GAME_MODE_OPTIONS = [
  { id: 'rush', label: 'RUSH', icon: '⚡', description: 'Pick 6 props from a live game', coins: 10000, color: '#f59e0b' },
  { id: 'original', label: 'ORIGINAL', icon: '🏆', description: 'Highest balance after all games end', coins: 10000, recommended: true, color: '#3b82f6' },
  { id: 'tournament', label: 'TOURNAMENT', icon: '👑', description: '3-day battle, massive bankroll', coins: 100000, color: '#10b981' },
];

const INVITE_EXPIRY_HOURS = 24;

const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'find', label: 'Find Players' },
  { id: 'requests', label: 'Requests' },
];

function UserAvatar({ user, size = 36 }) {
  return <SharedUserAvatar user={user} size={size} />;
}

export default function PlayFriendModal({ isOpen, onClose, friends = [], onInviteSent, onInviteCancelled, onSwitchToPrivate, initialFriend = null, lockedFriend = null, currentUser = null, onOpenMessage = null }) {
  const router = useRouter();
  const profileCache = useProfileCacheOptional();
  const { hasActiveMatchup } = useMatchup();
  useModalScrollLock(isOpen);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentInviteId, setSentInviteId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [inviteCountdown, setInviteCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState('friends');
  const [friendRequests, setFriendRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [addingFriend, setAddingFriend] = useState({});
  const [respondingTo, setRespondingTo] = useState({});
  const countdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const cardBg = '#0d0d0d';
  const cardBorder = '#1a1a1a';
  const inputBg = '#111';
  const inputBorder = '#1a1a1a';
  const textPrimary = '#fff';
  const textSecondary = '#9ca3af';
  const textMuted = '#6b7280';
  const elevatedBg = '#111';

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setSearchQuery('');
      setSearchResults([]);
      setSent(false);
      setSentInviteId(null);
      setCancelling(false);
      setError('');
      setInviteCountdown(0);
      setActiveTab('friends');
      if (countdownRef.current) clearInterval(countdownRef.current);
    } else if (lockedFriend) {
      setSelectedFriend(lockedFriend);
      setActiveTab('friends');
    } else if (initialFriend) {
      setSelectedFriend(initialFriend);
      setActiveTab('friends');
    }
  }, [isOpen, initialFriend, lockedFriend]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFriendRequests();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'requests') {
      fetchFriendRequests();
    }
  }, [activeTab]);

  const fetchFriendRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/friends/requests');
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data.requests || []);
      }
    } catch {} finally {
      setLoadingRequests(false);
    }
  };

  const friendIds = friends.map(f => f.id);
  const isFriend = (userId) => friendIds.includes(userId);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch {} finally {
        setSearching(false);
      }
    }, 300);
  };

  const sendInvite = async () => {
    if (!selectedFriend) return;
    if (hasActiveMatchup) {
      setError(ACTIVE_BATTLE_BLOCK_MESSAGE);
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/battles/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selectedFriend.id, buyIn, gameMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send invite');
        return;
      }
      setSent(true);
      setSentInviteId(data?.invite?.id || null);
      const expirySeconds = INVITE_EXPIRY_HOURS * 3600;
      setInviteCountdown(expirySeconds);
      countdownRef.current = setInterval(() => {
        setInviteCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      if (onInviteSent) onInviteSent(selectedFriend);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const cancelInvite = async () => {
    if (!sentInviteId || cancelling) return;
    setCancelling(true);
    setError('');
    try {
      const res = await fetch(`/api/battles/invite/${sentInviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to cancel invite');
        return;
      }
      if (countdownRef.current) clearInterval(countdownRef.current);
      setSent(false);
      setSentInviteId(null);
      setInviteCountdown(0);
      if (lockedFriend) {
        onClose();
      } else {
        setSelectedFriend(null);
        setActiveTab('friends');
      }
      if (onInviteCancelled) onInviteCancelled();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const addFriend = async (userId) => {
    setAddingFriend(prev => ({ ...prev, [userId]: 'loading' }));
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'accepted') {
          setAddingFriend(prev => ({ ...prev, [userId]: 'accepted' }));
        } else {
          setAddingFriend(prev => ({ ...prev, [userId]: 'sent' }));
        }
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, requestSent: true } : u));
      } else {
        if (data.error?.includes('already pending') || data.error?.includes('Already friends')) {
          setAddingFriend(prev => ({ ...prev, [userId]: 'sent' }));
          setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, requestSent: true } : u));
        } else {
          setAddingFriend(prev => ({ ...prev, [userId]: 'error' }));
          setError(data.error || 'Failed to send friend request');
        }
      }
    } catch {
      setAddingFriend(prev => ({ ...prev, [userId]: 'error' }));
      setError('Network error sending friend request');
    }
  };

  const respondToRequest = async (requestId, action) => {
    setRespondingTo(prev => ({ ...prev, [requestId]: action }));
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch {} finally {
      setRespondingTo(prev => { const n = { ...prev }; delete n[requestId]; return n; });
    }
  };

  const navigateToProfile = (userOrId) => {
    const user = userOrId && typeof userOrId === 'object' ? userOrId : null;
    const id = user ? user.id : userOrId;
    if (!id) return;
    if (profileCache) {
      profileCache.prefetchProfile(id, user ? {
        id,
        username: user.username || user.name,
        avatar: user.avatar ?? null,
      } : null);
    }
    onClose();
    router.push(`/profile/${id}`);
  };

  const handleSwitchToPrivate = () => {
    onClose();
    if (onSwitchToPrivate) onSwitchToPrivate();
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter(f =>
    !searchQuery || f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const nonFriendResults = searchResults.filter(u => !isFriend(u.id));

  const formatCountdown = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const requestCount = friendRequests.length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pfm-title"
        className="rounded-2xl max-w-md w-full max-h-[88vh] overflow-hidden flex flex-col pfm-slide-in my-auto"
        style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="pfm-title" className="text-lg font-bold" style={{ color: textPrimary }}>Play a Friend</h2>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>Challenge someone to a 1v1 battle</p>
            </div>
            <button aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: elevatedBg }}>
              <svg className="w-4 h-4" style={{ color: textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {!sent && !lockedFriend && (
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: elevatedBg }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all relative"
                  style={{
                    backgroundColor: activeTab === tab.id ? ('#1a1a1a') : 'transparent',
                    color: activeTab === tab.id ? textPrimary : textMuted,
                    boxShadow: activeTab === tab.id ? ('0 1px 3px rgba(0,0,0,0.3)') : 'none',
                  }}
                >
                  {tab.label}
                  {tab.id === 'requests' && requestCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {requestCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {sent ? (
          <div className="p-6 text-center pfm-fade-in">
            <style jsx>{`
              @keyframes pfmWaitPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); transform: scale(1); }
                50% { box-shadow: 0 0 0 10px rgba(59,130,246,0.0), 0 0 32px rgba(59,130,246,0.45); transform: scale(1.04); }
              }
              @keyframes pfmShimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
              @keyframes pfmDots {
                0%, 20% { opacity: 0.2; }
                50% { opacity: 1; }
                80%, 100% { opacity: 0.2; }
              }
              .pfm-wait-avatar {
                animation: pfmWaitPulse 1.8s ease-in-out infinite;
                border-radius: 9999px;
              }
              .pfm-wait-shimmer {
                background: linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.45) 50%, rgba(59,130,246,0) 100%);
                background-size: 200% 100%;
                animation: pfmShimmer 1.6s linear infinite;
              }
              .pfm-dot { display: inline-block; animation: pfmDots 1.4s infinite; }
              .pfm-dot:nth-child(2) { animation-delay: 0.2s; }
              .pfm-dot:nth-child(3) { animation-delay: 0.4s; }
            `}</style>

            <div className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: textMuted }}>
              Challenge Sent
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 pfm-bounce-in">
              <div className="flex flex-col items-center" style={{ width: 96 }}>
                <div className="rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                  <div className="rounded-full" style={{ background: cardBg, padding: 2 }}>
                    <UserAvatar
                      user={currentUser ? { id: currentUser.id, username: currentUser.username, avatar: currentUser.avatar, frameId: currentUser.frameId } : { username: 'You' }}
                      size={72}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs font-bold truncate max-w-[88px]" style={{ color: textPrimary }}>
                  {currentUser?.username || 'You'}
                </div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#22c55e' }}>Ready</div>
              </div>

              <div className="flex flex-col items-center px-1">
                <div className="text-2xl font-black italic" style={{ color: textPrimary, textShadow: '0 0 12px rgba(255,255,255,0.25)' }}>VS</div>
              </div>

              <div className="flex flex-col items-center" style={{ width: 96 }}>
                <div className="pfm-wait-avatar rounded-full p-[3px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#22d3ee)' }}>
                  <div className="rounded-full" style={{ background: cardBg, padding: 2 }}>
                    <UserAvatar
                      user={{ id: selectedFriend?.id, username: selectedFriend?.username, avatar: selectedFriend?.avatar, frameId: selectedFriend?.equippedFrame }}
                      size={72}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs font-bold truncate max-w-[88px]" style={{ color: textPrimary }}>
                  {selectedFriend?.username}
                </div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                  Waiting<span className="pfm-dot">.</span><span className="pfm-dot">.</span><span className="pfm-dot">.</span>
                </div>
              </div>
            </div>

            <h3 className="font-bold text-base" style={{ color: textPrimary }}>
              Waiting for {selectedFriend?.username || 'your opponent'}
            </h3>

            <div className="mt-4 rounded-xl p-3 text-left space-y-2" style={{ backgroundColor: elevatedBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">✅</span>
                <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                  It's safe to close this — you can wait in the background.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">⚔️</span>
                <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                  When they accept, you'll be dropped straight into the match.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">🔔</span>
                <p className="text-xs leading-snug" style={{ color: textSecondary }}>
                  If they decline, we'll let you know.
                </p>
              </div>
            </div>

            {inviteCountdown > 0 ? (
              <div className="mt-4">
                <div className="w-full rounded-full h-1.5 mb-2 overflow-hidden" style={{ backgroundColor: elevatedBg }}>
                  <div className="pfm-wait-shimmer h-1.5 rounded-full" style={{ width: `${(inviteCountdown / (INVITE_EXPIRY_HOURS * 3600)) * 100}%`, background: '#3b82f6' }}></div>
                </div>
                <p className="text-xs" style={{ color: textMuted }}>Invite expires in {formatCountdown(inviteCountdown)}</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-yellow-400 text-sm">Invite expired.</p>
                <button onClick={() => { setSent(false); setError(''); }} className="mt-3 px-4 py-2 rounded-lg text-sm transition-colors" style={{ backgroundColor: elevatedBg, color: textSecondary }}>
                  Try Again
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-xs pfm-fade-in">{error}</div>
            )}

            <button
              onClick={onClose}
              className="mt-4 w-full font-semibold text-sm py-3 rounded-xl transition-colors"
              style={{ backgroundColor: elevatedBg, color: textPrimary, border: `1px solid ${cardBorder}` }}
            >
              I'll wait in the background
            </button>

            {sentInviteId && inviteCountdown > 0 && (
              <button
                onClick={cancelInvite}
                disabled={cancelling}
                className="mt-2 w-full font-medium text-xs py-2.5 rounded-xl transition-colors disabled:opacity-60"
                style={{ backgroundColor: 'transparent', color: '#f87171', border: `1px solid rgba(248,113,113,0.3)` }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel invite'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4 pfm-fade-in">{error}</div>
            )}

            {activeTab === 'friends' && !lockedFriend && (
              <div className="space-y-3 pfm-fade-in">
                {friends.length > 3 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 pl-10 placeholder-gray-500 focus:outline-none transition-colors"
                      style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, fontSize: '14px', color: textPrimary }}
                      placeholder="Filter friends..."
                    />
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                )}

                {filteredFriends.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: elevatedBg }}>
                      <svg className="w-6 h-6" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <p className="font-medium text-sm mb-1" style={{ color: textPrimary }}>
                      {friends.length === 0 ? 'No friends yet' : 'No matches'}
                    </p>
                    <p className="text-xs mb-4" style={{ color: textMuted }}>
                      {friends.length === 0 ? 'Find players in the "Find Players" tab to add friends' : 'Try a different search'}
                    </p>
                    {friends.length === 0 && (
                      <div className="flex flex-col gap-2 items-center">
                        <button onClick={() => setActiveTab('find')} className="text-blue-400 text-xs font-medium">
                          Find Players
                        </button>
                        <button onClick={handleSwitchToPrivate} className="text-xs font-medium flex items-center gap-1" style={{ color: textMuted }}>
                          Or use a Private Match code
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredFriends.map((friend, i) => {
                      const isSelected = selectedFriend?.id === friend.id;
                      const togglePlay = () => setSelectedFriend(isSelected ? null : friend);
                      const openMessage = () => {
                        if (onOpenMessage) {
                          onClose && onClose();
                          onOpenMessage(friend);
                        } else {
                          onClose && onClose();
                          router.push(`/notifications?chat=${friend.id}`);
                        }
                      };
                      return (
                        <div
                          key={friend.id}
                          className="pfm-list-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                          style={{
                            backgroundColor: isSelected ? ('rgba(59,130,246,0.12)') : elevatedBg,
                            border: `1px solid ${isSelected ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                            animationDelay: `${i * 40}ms`,
                          }}
                        >
                          <button type="button" className="cursor-pointer flex-shrink-0" onClick={(e) => { e.stopPropagation(); navigateToProfile(friend); }} aria-label={`View ${friend.username}'s profile`}>
                            <UserAvatar user={friend} size={38} />
                          </button>
                          <button type="button" onClick={togglePlay} className="text-left flex-1 min-w-0 cursor-pointer">
                            <div className="text-sm font-medium truncate" style={{ color: textPrimary }}>{friend.username}</div>
                            <div className="text-xs" style={{ color: textMuted }}>
                              <span className="text-green-400 font-medium">{friend.battleWins || 0}W</span>
                              <span className="mx-1">·</span>
                              <span className="text-red-400 font-medium">{friend.battleLosses || 0}L</span>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={openMessage}
                              className="sm:hidden p-2 rounded-lg text-blue-400 hover:bg-blue-500/15"
                              title="Message"
                              aria-label="Message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={openMessage}
                              className="hidden sm:inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-400 hover:bg-blue-500/15"
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              onClick={togglePlay}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-purple-400 hover:bg-purple-500/15"
                            >
                              {isSelected ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  Selected
                                </>
                              ) : 'Play'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'find' && (
              <div className="space-y-4 pfm-fade-in">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 pl-10 placeholder-gray-500 focus:outline-none transition-colors"
                    style={{ backgroundColor: inputBg, border: `1px solid ${searchQuery.length >= 2 ? 'rgba(59,130,246,0.3)' : inputBorder}`, fontSize: '14px', color: textPrimary }}
                    placeholder="Search by username..."
                    autoFocus
                  />
                  <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  {searching && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${cardBorder}`, borderTopColor: '#3b82f6' }}></div>
                    </div>
                  )}
                </div>

                {searchQuery.length < 2 && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <p className="text-xs font-medium mb-1" style={{ color: textPrimary }}>Search for players</p>
                    <p className="text-[11px]" style={{ color: textMuted }}>Type at least 2 characters to find users</p>
                  </div>
                )}

                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="text-center py-6 pfm-fade-in">
                    <p className="text-sm" style={{ color: textSecondary }}>No users found for "{searchQuery}"</p>
                    <p className="text-xs mt-2" style={{ color: textMuted }}>Try a different username</p>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 pfm-fade-in">
                    {searchResults.map((user, i) => {
                      const isAlreadyFriend = isFriend(user.id);
                      const addState = addingFriend[user.id];
                      return (
                        <div
                          key={user.id}
                          className="rounded-xl p-3 pfm-list-item"
                          style={{ backgroundColor: elevatedBg, border: `1px solid ${cardBorder}`, animationDelay: `${i * 50}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <button type="button" className="cursor-pointer flex-shrink-0" onClick={() => navigateToProfile(user)} aria-label={`View ${user.username}'s profile`}>
                              <UserAvatar user={user} size={40} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <button type="button" className="text-sm font-semibold truncate cursor-pointer bg-transparent border-none p-0" style={{ color: textPrimary }} onClick={() => navigateToProfile(user)}>
                                  {user.username}
                                </button>
                                {isAlreadyFriend && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">Friend</span>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: textMuted }}>
                                {user.battleWins || user.battleLosses ? (
                                  <>
                                    <span className="text-green-400 font-medium">{user.battleWins || 0}W</span>
                                    <span className="mx-1">·</span>
                                    <span className="text-red-400 font-medium">{user.battleLosses || 0}L</span>
                                  </>
                                ) : (
                                  <span>New player</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {isAlreadyFriend ? (
                                <button
                                  onClick={() => { setSelectedFriend(user); setActiveTab('friends'); }}
                                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                                  style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                                >
                                  Challenge
                                </button>
                              ) : addState === 'sent' || user.requestSent ? (
                                <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: elevatedBg, color: textMuted, border: `1px solid ${cardBorder}` }}>
                                  Sent ✓
                                </span>
                              ) : addState === 'accepted' ? (
                                <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-green-500/15 text-green-400 border border-green-500/20">
                                  Added!
                                </span>
                              ) : addState === 'loading' ? (
                                <div className="w-8 h-8 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: cardBorder, borderTopColor: '#3b82f6' }}></div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addFriend(user.id)}
                                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                                  style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                                >
                                  Add Friend
                                </button>
                              )}
                            </div>
                          </div>
                          {!isAlreadyFriend && !addState && !user.requestSent && (
                            <div className="mt-2.5 pt-2.5 flex items-center justify-between" style={{ borderTop: `1px solid ${cardBorder}` }}>
                              <p className="text-[11px]" style={{ color: textMuted }}>Play without adding?</p>
                              <button
                                onClick={handleSwitchToPrivate}
                                className="text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all"
                                style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}
                              >
                                🔑 Private Code
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-3 pfm-fade-in">
                {loadingRequests ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: cardBorder, borderTopColor: '#3b82f6' }}></div>
                  </div>
                ) : friendRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: elevatedBg }}>
                      <svg className="w-6 h-6" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="font-medium text-sm mb-1" style={{ color: textPrimary }}>No pending requests</p>
                    <p className="text-xs" style={{ color: textMuted }}>When someone sends you a friend request, it will appear here</p>
                  </div>
                ) : (
                  friendRequests.map((request, i) => {
                    const sender = request.sender || {};
                    const isResponding = respondingTo[request.id];
                    return (
                      <div
                        key={request.id}
                        className="rounded-xl p-3.5 pfm-list-item"
                        style={{ backgroundColor: elevatedBg, border: `1px solid ${cardBorder}`, animationDelay: `${i * 50}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <button type="button" className="cursor-pointer flex-shrink-0" onClick={() => navigateToProfile(sender)} aria-label={`View ${sender.username || 'user'}'s profile`}>
                            <UserAvatar user={sender} size={42} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <button type="button" className="text-sm font-semibold truncate cursor-pointer bg-transparent border-none p-0 text-left" style={{ color: textPrimary }} onClick={() => navigateToProfile(sender)}>
                              {sender.username || 'Unknown'}
                            </button>
                            <div className="text-xs mt-0.5" style={{ color: textMuted }}>
                              {sender.battleWins || sender.battleLosses ? (
                                <>
                                  <span className="text-green-400 font-medium">{sender.battleWins || 0}W</span>
                                  <span className="mx-1">·</span>
                                  <span className="text-red-400 font-medium">{sender.battleLosses || 0}L</span>
                                </>
                              ) : (
                                <span>Wants to be your friend</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => respondToRequest(request.id, 'accept')}
                            disabled={!!isResponding}
                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                          >
                            {isResponding === 'accept' ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => respondToRequest(request.id, 'reject')}
                            disabled={!!isResponding}
                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            style={{ backgroundColor: elevatedBg, color: textMuted, border: `1px solid ${cardBorder}` }}
                          >
                            {isResponding === 'reject' ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {selectedFriend && activeTab === 'friends' && (
              <div className="mt-4 pt-4 space-y-4 pfm-fade-in" style={{ borderTop: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <UserAvatar user={selectedFriend} size={32} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: textPrimary }}>Challenging {selectedFriend.username}</span>
                  </div>
                  {!lockedFriend && (
                    <button onClick={() => setSelectedFriend(null)} className="text-xs" style={{ color: textMuted }}>Change</button>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: textMuted }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => (
                      <button
                        key={amount}
                        onClick={() => setBuyIn(amount)}
                        className="py-2 rounded-xl text-sm font-bold transition-all"
                        style={{
                          backgroundColor: buyIn === amount ? '#3b82f6' : elevatedBg,
                          color: buyIn === amount ? '#fff' : textSecondary,
                          border: `1px solid ${buyIn === amount ? '#3b82f6' : cardBorder}`,
                        }}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: textMuted }}>Game Mode</label>
                  <p className="text-[10px] mb-2 leading-snug" style={{ color: textMuted }}>
                    The ${buyIn} above is each player's wager. The coins below are the in-battle starting bankroll each player gets to bet with.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setGameMode(mode.id)}
                          className="flex flex-col items-center text-center px-1.5 py-2 rounded-xl transition-all relative"
                          style={{
                            backgroundColor: selected ? `${mode.color}12` : elevatedBg,
                            border: `1px solid ${selected ? `${mode.color}40` : cardBorder}`,
                          }}
                        >
                          {mode.recommended && (
                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">POPULAR</span>
                          )}
                          <span className="text-base leading-none mb-1">{mode.icon}</span>
                          <span className="font-bold text-[11px] leading-tight" style={{ color: textPrimary }}>{mode.label}</span>
                          <span className="text-[8px] uppercase tracking-wider mt-1 leading-none" style={{ color: textMuted }}>Start with</span>
                          <span className="font-bold text-[10px] mt-0.5" style={{ color: textPrimary }}>{mode.coins.toLocaleString()}</span>
                          <span className="text-[9px]" style={{ color: textMuted }}>coins</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasActiveMatchup && (
                  <div
                    className="rounded-xl px-3 py-2.5 text-xs leading-snug"
                    style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5' }}
                  >
                    {ACTIVE_BATTLE_BLOCK_MESSAGE}
                  </div>
                )}
                <button
                  onClick={sendInvite}
                  disabled={sending || hasActiveMatchup}
                  title={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : undefined}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden pfm-cta-btn"
                >
                  <span className="relative z-10">{sending ? 'Sending...' : hasActiveMatchup ? 'In a battle' : `Challenge ${selectedFriend.username}`}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pfmSlideIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pfmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pfmListItem {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pfmBounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .pfm-slide-in { animation: pfmSlideIn 0.25s ease-out; }
        .pfm-fade-in { animation: pfmFadeIn 0.2s ease-out; }
        .pfm-list-item { animation: pfmListItem 0.25s ease-out both; }
        .pfm-bounce-in { animation: pfmBounceIn 0.4s ease-out; }
        .pfm-cta-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #3b82f6, #06b6d4);
          opacity: 0;
          transition: opacity 0.3s;
        }
        @media (hover: hover) {
          .pfm-cta-btn:hover::before { opacity: 1; }
        }
        @media (hover: none) {
          .pfm-cta-btn:active { transform: scale(0.98); }
        }
      `}</style>
    </div>
  );
}
