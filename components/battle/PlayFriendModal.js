import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import haptic from '../../utils/haptics';
import SharedUserAvatar from '../UserAvatar';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';
import { useMatchup } from '../../contexts/MatchupContext';
import { saveLastBuyIn } from '../../utils/lastBattleBuyIn';

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

export default function PlayFriendModal({ isOpen, onClose, friends = [], onInviteSent, onInviteCancelled, onSwitchToPrivate, initialFriend = null, lockedFriend = null, currentUser = null, onOpenMessage = null, initialBuyIn = null }) {
  const router = useRouter();
  const profileCache = useProfileCacheOptional();
  const { hasActiveMatchup } = useMatchup();
  useModalScrollLock(isOpen);
  const [selectedFriend, setSelectedFriend] = useState(null);
  // Seed from the remembered buy-in (which is hydrated server-side and
  // therefore follows the user across devices) so the modal's defaults
  // match whatever the friend-row shortcut would send.
  const rememberedBuyIn = initialBuyIn && BUY_IN_OPTIONS.includes(Number(initialBuyIn.buyIn))
    ? Number(initialBuyIn.buyIn)
    : 10;
  const rememberedMode = initialBuyIn?.gameMode === 'rush' || initialBuyIn?.gameMode === 'tournament' || initialBuyIn?.gameMode === 'original'
    ? initialBuyIn.gameMode
    : 'original';
  const [buyIn, setBuyIn] = useState(rememberedBuyIn);
  const [gameMode, setGameMode] = useState(rememberedMode);
  // Rush requires a live game — lock the mode tile when none are available.
  const rushAvailable = useRushAvailability(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    if (rushAvailable === false && gameMode === 'rush') setGameMode('original');
  }, [isOpen, rushAvailable, gameMode]);
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
  const [showGameModeInfo, setShowGameModeInfo] = useState(false);
  const countdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const gameModeInfoRef = useRef(null);

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
      setShowGameModeInfo(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
    } else {
      // Re-apply the remembered buy-in every time the modal opens. This
      // covers the case where `initialBuyIn` arrived after the component
      // mounted (the parent hydrates it from the server asynchronously),
      // and keeps the modal defaults in sync with the friend-row shortcut.
      if (initialBuyIn) {
        const rb = Number(initialBuyIn.buyIn);
        if (BUY_IN_OPTIONS.includes(rb)) setBuyIn(rb);
        const rm = initialBuyIn.gameMode;
        if (rm === 'rush' || rm === 'tournament' || rm === 'original') setGameMode(rm);
      }
      if (lockedFriend) {
        setSelectedFriend(lockedFriend);
        setActiveTab('friends');
      } else if (initialFriend) {
        setSelectedFriend(initialFriend);
        setActiveTab('friends');
      }
    }
  }, [isOpen, initialFriend, lockedFriend, initialBuyIn]);

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
    if (!selectedFriend && showGameModeInfo) {
      setShowGameModeInfo(false);
    }
  }, [selectedFriend, showGameModeInfo]);

  useEffect(() => {
    if (!showGameModeInfo) return undefined;
    function handleOutside(e) {
      if (gameModeInfoRef.current && !gameModeInfoRef.current.contains(e.target)) {
        setShowGameModeInfo(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setShowGameModeInfo(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showGameModeInfo]);

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
      // Remember the buy-in + mode so the friend row can offer a one-tap
      // "send last buy-in" shortcut next time. Mirrors to the user's
      // profile so the value follows them across devices.
      saveLastBuyIn(currentUser?.id, { buyIn, gameMode });
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

  const dispatchInviteEnded = (reason, friendForEvent = selectedFriend) => {
    if (typeof window === 'undefined') return;
    if (!friendForEvent?.id) return;
    window.dispatchEvent(new CustomEvent('piks:invite:ended', {
      detail: {
        otherUserId: friendForEvent.id,
        otherUsername: friendForEvent.username || null,
        reason,
        inviteId: sentInviteId || null,
      },
    }));
  };

  const finishWaiting = (reason) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    dispatchInviteEnded(reason);
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
      finishWaiting('cancelled');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // While the waiting screen is showing, poll the invite so we can detect
  // a decline (the recipient pressed "decline") or a server-side expiry and
  // surface a quiet note in the conversation header — instead of the modal
  // silently sitting on "Waiting…" forever.
  useEffect(() => {
    if (!sent || !sentInviteId) return undefined;
    let cancelledLocal = false;
    let interval = null;
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/battles/invite/${sentInviteId}`);
        if (cancelledLocal) return;
        if (!res.ok) {
          if (res.status === 404) { stop(); finishWaiting('cancelled'); }
          return;
        }
        const data = await res.json();
        const status = data?.invite?.status;
        if (cancelledLocal) return;
        if (!status || status === 'pending') return;
        // Stop polling for any terminal status — including 'accepted', where
        // MatchupContext handles the redirect into the live battle.
        stop();
        if (status === 'declined') finishWaiting('declined');
        else if (status === 'cancelled') finishWaiting('cancelled');
        else if (status === 'expired') finishWaiting('expired');
      } catch {}
    };
    interval = setInterval(checkStatus, 5000);
    checkStatus();
    return () => { cancelledLocal = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent, sentInviteId]);

  // Local countdown hitting zero means the invite expired client-side; fire
  // the same quiet note so the conversation header reflects it.
  const expiredFiredRef = useRef(false);
  useEffect(() => {
    if (sent && inviteCountdown === 0 && sentInviteId && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      dispatchInviteEnded('expired');
    }
    if (!sent) expiredFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent, inviteCountdown, sentInviteId]);

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
  if (typeof document === 'undefined') return null;

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

  const content = (
    <div data-allow-fixed-overlay="true" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pfm-title"
        className="rounded-3xl max-w-md w-full max-h-[88vh] overflow-hidden flex flex-col pfm-slide-in my-auto"
        style={{ backgroundColor: cardBg, border: `2.5px solid #0a0a0a`, boxShadow: '0 8px 0 #0a0a0a, 0 22px 44px rgba(0,0,0,0.55)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* Cartoon-styled title to match BattleModeChooser:
                  uppercase, extrabold, drop shadow on the heading and a
                  smaller all-caps eyebrow for the subtitle. Keeps
                  PlayFriendModal in the same visual family as the rest
                  of the battle UI. */}
              <h2
                id="pfm-title"
                className="font-black uppercase"
                style={{
                  color: textPrimary,
                  fontSize: '20px',
                  lineHeight: 1.05,
                  letterSpacing: '0.06em',
                  textShadow: '0 2px 0 #000',
                }}
              >
                Play a Friend
              </h2>
              <p
                className="mt-1 font-extrabold uppercase"
                style={{
                  color: '#60a5fa',
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                }}
              >
                Challenge someone to a 1v1 battle
              </p>
            </div>
            <button
              aria-label="Close"
              onClick={onClose}
              className="pfm-close-btn w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: elevatedBg, border: '2.5px solid #0a0a0a', boxShadow: '0 3px 0 #0a0a0a' }}
            >
              <svg className="w-4 h-4" style={{ color: textPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {!sent && !lockedFriend && (
            <div
              className="flex gap-1.5 p-1.5 rounded-2xl mb-4"
              style={{ backgroundColor: '#0a0a0a', border: '2.5px solid #0a0a0a', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}
            >
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="pfm-tab-btn flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider relative"
                    style={{
                      background: active ? 'linear-gradient(180deg,#3b82f6,#2563eb)' : 'transparent',
                      color: active ? '#fff' : textMuted,
                      border: active ? '2px solid #0a0a0a' : '2px solid transparent',
                      boxShadow: active ? '0 3px 0 #0a0a0a, 0 0 16px rgba(59,130,246,0.45)' : 'none',
                      textShadow: active ? '0 1px 0 rgba(0,0,0,0.35)' : 'none',
                    }}
                  >
                    {tab.label}
                    {tab.id === 'requests' && requestCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center"
                        style={{ background: 'linear-gradient(180deg,#ef4444,#dc2626)', border: '2px solid #0a0a0a', boxShadow: '0 2px 0 #0a0a0a' }}
                      >
                        {requestCount}
                      </span>
                    )}
                  </button>
                );
              })}
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
                <div
                  className="rounded-full p-[3px]"
                  style={{
                    background: 'linear-gradient(135deg,#22c55e,#10b981)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(34,197,94,0.45)',
                  }}
                >
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
                <div
                  className="pfm-wait-avatar rounded-full p-[3px]"
                  style={{
                    background: 'linear-gradient(135deg,#3b82f6,#22d3ee)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.45)',
                  }}
                >
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

            {/* Cartoon-themed waiting tips card — chunky black border +
                offset shadow so the supporting copy still reads as part
                of the same playful design language as the VS card. */}
            <div
              className="mt-4 rounded-2xl p-3 text-left space-y-2"
              style={{
                backgroundColor: elevatedBg,
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
              }}
            >
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
              /* Cartoon countdown — chunky black border around the
                 progress track so it matches the rest of the slip. */
              <div className="mt-4">
                <div
                  className="w-full rounded-full h-2.5 mb-2 overflow-hidden"
                  style={{
                    backgroundColor: '#0a0a0a',
                    border: '2px solid #0a0a0a',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="pfm-wait-shimmer h-full rounded-full"
                    style={{
                      width: `${(inviteCountdown / (INVITE_EXPIRY_HOURS * 3600)) * 100}%`,
                      background: 'linear-gradient(90deg,#3b82f6,#22d3ee)',
                      boxShadow: '0 0 12px rgba(59,130,246,0.55)',
                    }}
                  ></div>
                </div>
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                  style={{ color: textMuted }}
                >
                  Invite expires in {formatCountdown(inviteCountdown)}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p
                  className="font-extrabold uppercase"
                  style={{ color: '#fcd34d', fontSize: '12px', letterSpacing: '0.12em' }}
                >
                  Invite expired
                </p>
                <button
                  onClick={() => { setSent(false); setError(''); }}
                  className="pfm-cartoon-btn mt-3 px-4 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                    color: '#fff',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.4)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {error && (
              <div
                className="mt-3 rounded-2xl p-3 text-xs pfm-fade-in"
                style={{
                  background: 'linear-gradient(180deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 4px 0 #0a0a0a',
                  color: '#fecaca',
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={onClose}
              className="pfm-cartoon-btn mt-4 w-full font-extrabold text-sm py-3 rounded-2xl uppercase tracking-wider"
              style={{
                backgroundColor: elevatedBg,
                color: textPrimary,
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
              }}
            >
              I&apos;ll wait in the background
            </button>

            {sentInviteId && inviteCountdown > 0 && (
              <button
                onClick={cancelInvite}
                disabled={cancelling}
                className="pfm-cartoon-btn mt-3 w-full font-extrabold text-xs py-2.5 rounded-2xl uppercase tracking-wider disabled:opacity-60"
                style={{
                  background: 'linear-gradient(180deg,#1a0a0a,#120808)',
                  color: '#fca5a5',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(248,113,113,0.25)',
                }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel Invite'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* Cartoon-themed non-sent error box — same red gradient +
                chunky black border + offset shadow as the sent state,
                so failures read consistently across both branches. */}
            {error && (
              <div
                className="rounded-2xl p-3 text-sm mb-4 pfm-fade-in"
                style={{
                  background: 'linear-gradient(180deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 4px 0 #0a0a0a',
                  color: '#fecaca',
                }}
              >
                {error}
              </div>
            )}

            {activeTab === 'friends' && !lockedFriend && !selectedFriend && (
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
                              className="pfm-cartoon-btn inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl"
                              style={
                                isSelected
                                  ? {
                                      background: 'linear-gradient(180deg,#22c55e,#10b981)',
                                      color: '#fff',
                                      border: '2px solid #0a0a0a',
                                      boxShadow: '0 3px 0 #0a0a0a, 0 0 12px rgba(34,197,94,0.45)',
                                      textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                    }
                                  : {
                                      background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                      color: '#fff',
                                      border: '2px solid #0a0a0a',
                                      boxShadow: '0 3px 0 #0a0a0a, 0 0 12px rgba(59,130,246,0.4)',
                                      textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                    }
                              }
                            >
                              {isSelected ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  Picked
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
              <div className="space-y-4 pfm-fade-in">
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04))',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.18)',
                  }}
                >
                  <UserAvatar user={selectedFriend} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.2em]" style={{ color: '#60a5fa' }}>Challenging</div>
                    <div className="text-sm font-extrabold truncate" style={{ color: textPrimary }}>{selectedFriend.username}</div>
                  </div>
                  {!lockedFriend && (
                    <button
                      type="button"
                      onClick={() => setSelectedFriend(null)}
                      aria-label="Pick a different friend"
                      className="pfm-cartoon-btn text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl"
                      style={{
                        backgroundColor: elevatedBg,
                        color: textPrimary,
                        border: '2px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                      }}
                    >
                      Change
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider mb-2 block" style={{ color: textMuted }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => {
                      const selected = buyIn === amount;
                      return (
                        <button
                          key={amount}
                          onClick={() => setBuyIn(amount)}
                          className="pfm-cartoon-btn py-2 rounded-xl text-sm font-extrabold"
                          style={
                            selected
                              ? {
                                  background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                  color: '#fff',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.45)',
                                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                }
                              : {
                                  backgroundColor: elevatedBg,
                                  color: textSecondary,
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 3px 0 #0a0a0a',
                                }
                          }
                        >
                          ${amount}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2 gap-2">
                    <div className="relative flex items-center gap-1.5" ref={gameModeInfoRef}>
                      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Game Mode</label>
                      {/* Cartoon `?` info button — chunky black border +
                          offset shadow + press-down. Glows blue when
                          active so users see the tooltip is open. */}
                      <button
                        type="button"
                        onClick={() => setShowGameModeInfo(v => !v)}
                        aria-label="What's the difference between buy-in and coins?"
                        aria-expanded={showGameModeInfo}
                        className="pfm-cartoon-btn w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-extrabold leading-none"
                        style={{
                          background: showGameModeInfo ? 'linear-gradient(180deg,#3b82f6,#2563eb)' : 'linear-gradient(180deg,#1f2937,#111827)',
                          color: '#ffffff',
                          border: '2px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                          textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                        }}
                      >
                        ?
                      </button>
                      {showGameModeInfo && (
                        <div
                          role="tooltip"
                          className="absolute left-0 top-full mt-2 z-30 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-2xl text-[11px] leading-snug"
                          style={{
                            backgroundColor: cardBg,
                            color: textSecondary,
                            border: '2.5px solid #0a0a0a',
                            boxShadow: '0 5px 0 #0a0a0a, 0 12px 24px rgba(0,0,0,0.6)',
                          }}
                        >
                          The <span style={{ color: textPrimary, fontWeight: 800 }}>${buyIn}</span> above is each player&apos;s wager. The coins below are the in-battle starting bankroll each player gets to bet with.
                        </div>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: textMuted }}>Coins = starting bankroll</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const locked = mode.id === 'rush' && rushAvailable === false;
                      const isRush = mode.id === 'rush';
                      const rushLive = isRush && rushAvailable === true;
                      const hex = mode.color.replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16);
                      const g = parseInt(hex.substring(2, 4), 16);
                      const b = parseInt(hex.substring(4, 6), 16);
                      const glow = `rgba(${r},${g},${b},0.45)`;
                      const tint = `rgba(${r},${g},${b},0.18)`;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            // Clear haptic + a11y feedback for both
                            // accept and reject paths so the user
                            // always gets a tactile response (mobile-
                            // first polish per user feedback).
                            if (locked) {
                              haptic.warning && haptic.warning();
                              return;
                            }
                            haptic.tap && haptic.tap();
                            setGameMode(mode.id);
                            setShowGameModeInfo(false);
                          }}
                          // Intentionally NOT using native `disabled`
                          // here so the locked-state warning haptic
                          // (haptic.warning) still fires when a user
                          // taps a locked Rush tile. We surface the
                          // disabled state via aria-disabled + visual
                          // dim + cursor + the in-handler guard.
                          aria-disabled={locked || undefined}
                          aria-pressed={selected}
                          onKeyDown={(e) => {
                            if (locked && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              haptic.warning && haptic.warning();
                            }
                          }}
                          title={locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined}
                          className={`pfm-cartoon-btn flex flex-col items-center text-center px-1.5 py-2.5 rounded-2xl relative ${rushLive ? 'pfm-rush-live' : ''}`}
                          style={
                            selected
                              ? {
                                  background: `linear-gradient(180deg,${tint},${elevatedBg})`,
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 16px ${glow}`,
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                              : {
                                  backgroundColor: elevatedBg,
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: rushLive
                                    ? `0 3px 0 #0a0a0a, 0 0 12px ${glow}`
                                    : '0 3px 0 #0a0a0a',
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                          }
                        >
                          {mode.recommended && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                            >
                              Popular
                            </span>
                          )}
                          {/* Live-now eyebrow on the Rush tile when a
                              live game is available — this is the key
                              affordance that tells the user Rush is
                              ready to play *right now*. The dot pulses
                              so it reads as live, and the eyebrow uses
                              the orange Rush palette. */}
                          {rushLive && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                              aria-hidden="true"
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  backgroundColor: '#fff',
                                  boxShadow: '0 0 6px rgba(255,255,255,0.95)',
                                }}
                                className="pfm-rush-dot"
                              />
                              Live
                            </span>
                          )}
                          {/* Locked padlock badge on the Rush tile
                              when no live game is available — gives
                              the user a clear visual "you can't pick
                              this right now" signal beyond the
                              opacity dim. */}
                          {locked && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          <span className="text-lg leading-none mb-1">{mode.icon}</span>
                          <span className="font-extrabold text-[11px] leading-tight uppercase tracking-wider" style={{ color: textPrimary }}>{mode.label}</span>
                          <span className="text-[8px] uppercase tracking-wider mt-1 leading-none" style={{ color: textMuted }}>Start with</span>
                          <span className="font-extrabold text-[11px] mt-0.5" style={{ color: textPrimary }}>{mode.coins.toLocaleString()}</span>
                          <span className="text-[9px]" style={{ color: textMuted }}>coins</span>
                        </button>
                      );
                    })}
                  </div>
                  {rushAvailable === false && (
                    /* Cartoon-themed Rush-locked notice — chunky black
                       border + offset shadow + uppercase eyebrow so it
                       reads as part of the same playful design system
                       as the rest of the modal (was previously a
                       plain-text muted line that didn't match). */
                    <div
                      className="mt-2 rounded-2xl px-3 py-2.5 text-[11px] leading-snug flex items-start gap-2"
                      style={{
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                        color: '#fde68a',
                      }}
                      aria-live="polite"
                    >
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">⚡</span>
                      <div>
                        <div
                          className="font-extrabold uppercase mb-0.5"
                          style={{ color: '#fbbf24', fontSize: '9px', letterSpacing: '0.18em' }}
                        >
                          Rush locked
                        </div>
                        Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                      </div>
                    </div>
                  )}
                  {(() => {
                    const selectedMode = GAME_MODE_OPTIONS.find(m => m.id === gameMode);
                    if (!selectedMode) return null;
                    // Cartoon-themed mode description card — chunky black
                    // border + offset shadow + a colored glow pulled from
                    // the active mode's palette so it feels connected to
                    // the tile the user just picked.
                    return (
                      <div
                        aria-live="polite"
                        className="mt-2 flex items-start gap-2 rounded-2xl px-3 py-2.5"
                        style={{
                          background: `linear-gradient(180deg, ${selectedMode.color}1f, ${selectedMode.color}0a)`,
                          border: '2.5px solid #0a0a0a',
                          boxShadow: `0 4px 0 #0a0a0a, 0 0 14px ${selectedMode.color}40`,
                        }}
                      >
                        <span className="text-sm leading-none mt-0.5" aria-hidden="true">{selectedMode.icon}</span>
                        <p className="text-[11px] leading-snug" style={{ color: textSecondary }}>
                          <span className="font-extrabold uppercase tracking-wider" style={{ color: textPrimary }}>{selectedMode.label}:</span>{' '}
                          {selectedMode.description}
                        </p>
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}
          </div>
        )}

        {!sent && selectedFriend && activeTab === 'friends' && (
          <div
            className="flex-shrink-0 px-5 pt-3 pb-4 space-y-2"
            style={{
              backgroundColor: cardBg,
              borderTop: `1px solid ${cardBorder}`,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            }}
          >
            {hasActiveMatchup && (
              /* Cartoon-themed warning — chunky red border + offset
                 shadow + bold uppercase eyebrow so it carries the same
                 design language as the cartoon "Cancel Invite" button. */
              <div
                className="rounded-2xl px-3 py-2.5 text-xs leading-snug"
                style={{
                  background: 'linear-gradient(180deg, rgba(248,113,113,0.16), rgba(248,113,113,0.06))',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(248,113,113,0.25)',
                  color: '#fecaca',
                }}
              >
                <div
                  className="font-extrabold uppercase mb-0.5"
                  style={{ color: '#fca5a5', fontSize: '9px', letterSpacing: '0.18em' }}
                >
                  Battle in progress
                </div>
                {ACTIVE_BATTLE_BLOCK_MESSAGE}
              </div>
            )}
            <button
              onClick={sendInvite}
              disabled={sending || hasActiveMatchup}
              title={hasActiveMatchup ? ACTIVE_BATTLE_BLOCK_MESSAGE : undefined}
              className="pfm-cartoon-btn w-full text-white font-extrabold uppercase tracking-wider py-3.5 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed relative"
              style={{
                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 5px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55)',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                fontSize: '15px',
              }}
            >
              <span className="relative z-10">{sending ? 'Sending…' : hasActiveMatchup ? 'In a battle' : `Challenge ${selectedFriend.username}`}</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pfmSlideIn {
          0% { opacity: 0; transform: translateY(-18px) scale(0.9) rotate(-1deg); }
          60% { opacity: 1; transform: translateY(4px) scale(1.02) rotate(0.4deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
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
        .pfm-slide-in { animation: pfmSlideIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .pfm-fade-in { animation: pfmFadeIn 0.2s ease-out; }
        .pfm-list-item { animation: pfmListItem 0.25s ease-out both; }
        .pfm-bounce-in { animation: pfmBounceIn 0.4s ease-out; }
        .pfm-cartoon-btn {
          transition: transform 0.08s ease-out, box-shadow 0.08s ease-out, filter 0.18s ease-out;
        }
        @media (hover: hover) {
          .pfm-cartoon-btn:hover:not(:disabled) {
            filter: brightness(1.08);
          }
        }
        .pfm-cartoon-btn:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 1px 0 #0a0a0a !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .pfm-slide-in, .pfm-fade-in, .pfm-list-item, .pfm-bounce-in { animation: none !important; }
          .pfm-cartoon-btn { transition: none !important; }
        }
      `}</style>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
