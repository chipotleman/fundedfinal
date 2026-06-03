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
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { ConnectingToFriend, FlowCard, FlowButton } from './matchflow/MatchFlowScreens';

const ACTIVE_BATTLE_BLOCK_MESSAGE = "You're already in a battle — finish it before inviting someone else.";

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const GAME_MODE_OPTIONS = [
  // Canonical social-battle-flow mode identity (see --sbf-* tokens in
  // styles/globals.css): RUSH amber, ORIGINAL blue, TOURNAMENT violet —
  // matched to IncomingInviteModal so the two 1v1 surfaces agree. Rush was
  // green and Tournament orange here, which disagreed with the invite popup.
  { id: 'rush', label: 'RUSH', tagline: 'FAST · INTENSE', icon: '⚡', description: 'Pick 6 props from a live game', coins: 10000, color: '#fb923c' },
  { id: 'original', label: 'ORIGINAL', tagline: 'BALANCED · COMPETITIVE', icon: '🏆', description: 'Highest balance after all games end', coins: 10000, recommended: true, color: '#3b82f6' },
  { id: 'tournament', label: 'TOURNAMENT', tagline: 'BIG STAKES · BIGGER WINS', icon: '👑', description: '3-day battle, massive bankroll', coins: 100000, color: '#8b5cf6' },
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

export default function PlayFriendModal({ isOpen, onClose, onBack, friends = [], onInviteSent, onInviteCancelled, onSwitchToPrivate, initialFriend = null, lockedFriend = null, currentUser = null, onOpenMessage = null, initialBuyIn = null, initialSentInvite = null }) {
  const router = useRouter();
  const profileCache = useProfileCacheOptional();
  const { hasActiveMatchup, matchup: activeMatchup, opponent: activeOpponent, refresh: refreshMatchup } = useMatchup();
  useModalScrollLock(isOpen);
  const [selectedFriend, setSelectedFriend] = useState(null);
  // Seed from the remembered buy-in (which is hydrated server-side and
  // therefore follows the user across devices) so the modal's defaults
  // match whatever the friend-row shortcut would send.
  const isBeta = useBetaMode();
  const rememberedBuyIn = initialBuyIn && BUY_IN_OPTIONS.includes(Number(initialBuyIn.buyIn))
    ? Number(initialBuyIn.buyIn)
    : 10;
  const rememberedMode = initialBuyIn?.gameMode === 'rush' || initialBuyIn?.gameMode === 'tournament' || initialBuyIn?.gameMode === 'original'
    ? initialBuyIn.gameMode
    : 'original';
  const [buyIn, setBuyIn] = useState(rememberedBuyIn);
  const [gameMode, setGameMode] = useState(rememberedMode);
  // Beta lockdown: force ORIGINAL + zero buy-in. UI pickers are also
  // hidden / faded; this effect keeps state in sync if the flag flips.
  useEffect(() => {
    if (isBeta) {
      setGameMode('original');
      setBuyIn(0);
    }
  }, [isBeta]);
  // Rush requires a live game — lock the mode tile when none are available.
  // We deliberately do NOT auto-downgrade rush → original here: doing so
  // silently turned an intended Rush invite into a 24-hour Original
  // bet-balance battle whenever live games briefly disappeared. Instead
  // we keep the user's selection and block at submit time below with a
  // visible error so they can pick another mode intentionally.
  const rushAvailable = useRushAvailability(isOpen);
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
  // One-shot guard so the sender navigates into the started battle exactly
  // once, no matter which signal wins the race (SSE matchup:start vs the
  // waiting-screen accept poll). Reset whenever the waiting state resets.
  const navigatedToBattleRef = useRef(false);

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
      navigatedToBattleRef.current = false;
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
      // Friend-row "Battle" shortcut already POSTed an invite before
      // opening this modal — boot directly into the cartoon waiting
      // overlay so the sender sees the same countdown + Cancel UI as
      // when they sent the invite from inside the modal. Without this
      // path the user just got a "Invite sent" toast and no popup.
      if (initialSentInvite?.id && initialSentInvite?.friend) {
        setSelectedFriend(initialSentInvite.friend);
        setActiveTab('friends');
        if (typeof initialSentInvite.buyIn === 'number' && BUY_IN_OPTIONS.includes(initialSentInvite.buyIn)) {
          setBuyIn(initialSentInvite.buyIn);
        }
        if (initialSentInvite.gameMode === 'rush' || initialSentInvite.gameMode === 'tournament' || initialSentInvite.gameMode === 'original') {
          setGameMode(initialSentInvite.gameMode);
        }
        setSent(true);
        setSentInviteId(initialSentInvite.id);
        const expirySeconds = INVITE_EXPIRY_HOURS * 3600;
        setInviteCountdown(expirySeconds);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setInviteCountdown(prev => {
            if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    }
  }, [isOpen, initialFriend, lockedFriend, initialBuyIn, initialSentInvite]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Deterministic, single-fire transition into the started battle. Both the
  // SSE `matchup:start` path (below) and the waiting-screen accept poll
  // (further down) call this; the ref guard ensures only the first one wins,
  // so a slow SSE push and a fast poll (or vice-versa) can't double-navigate.
  // `matchupLike` only needs { id, durationType } for navigateToBattleStart
  // to route rush vs original correctly.
  const goToStartedBattle = (matchupLike) => {
    if (navigatedToBattleRef.current) return;
    if (!matchupLike?.id) return;
    navigatedToBattleRef.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    onClose();
    navigateToBattleStart(router, matchupLike);
  };

  // Auto-route into the battle when the recipient accepts our pending
  // invite. Without this, the moment `matchup:start` fires the modal's
  // render-phase `hasActiveMatchup` guard would flip the waiting screen
  // into the "Finish your fight first" blocker — which is wrong, because
  // the matchup the user is "already in" IS the one that just started
  // from this invite. We detect the transition (sent → active) and hand
  // the user straight to the lobby instead.
  useEffect(() => {
    if (!isOpen) return;
    if (!sent) return;
    if (!hasActiveMatchup) return;
    if (!activeMatchup?.id) return;
    goToStartedBattle(activeMatchup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sent, hasActiveMatchup, activeMatchup?.id]);

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
    // Hard guard: don't let a stale "Rush" selection silently fall back
    // to an Original 24-hour battle when no live games are available.
    if (gameMode === 'rush' && rushAvailable === false) {
      setError('Rush needs a live game in progress. Pick another mode or try again when one tips off.');
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
      navigatedToBattleRef.current = false;
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
    navigatedToBattleRef.current = false;
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
        // Stop polling for any terminal status. For 'accepted' we also
        // kick MatchupContext to re-fetch /api/matchups/current right
        // now — the SSE `matchup:start` handler usually beats us to it,
        // but if SSE flaked or we polled first this guarantees the
        // sender's waiting screen transitions instead of sitting on
        // "Waiting…" until the fallback poll's next tick.
        stop();
        if (status === 'accepted') {
          // Kick MatchupContext to re-sync so the destination battle page
          // has fresh state, then transition immediately using the matchup
          // identity the GET now returns — no dependency on the SSE push or
          // a second hasActiveMatchup flip. goToStartedBattle is guarded, so
          // if SSE already navigated this is a harmless no-op.
          try { refreshMatchup && refreshMatchup(); } catch {}
          const inv = data.invite || {};
          if (inv.matchupId) {
            goToStartedBattle({ id: inv.matchupId, durationType: inv.gameMode });
          }
        }
        else if (status === 'declined') finishWaiting('declined');
        else if (status === 'cancelled') finishWaiting('cancelled');
        else if (status === 'expired') finishWaiting('expired');
      } catch {}
    };
    // Poll cadence is the sender's deterministic floor for the transition
    // when SSE is degraded. Kept tight (2s) so a healthy-but-pushless window
    // still feels near-instant; it only runs while a single waiting screen
    // is mounted, so the load is bounded.
    interval = setInterval(checkStatus, 2000);
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

  // Active-battle blocker: if the user is already in a live matchup,
  // replace the entire invite flow with a friendly cartoon-themed notice
  // that explains the situation and routes them to the current battle (or
  // shows how to forfeit). Sending an invite mid-battle is what allows
  // the recipient's accept to silently create a SECOND matchup that
  // surfaces the moment the first one ends — by blocking the entry point
  // visually we close the door at the UI layer too.
  if (hasActiveMatchup) {
    const opponentName = activeOpponent?.username || 'your opponent';
    const goToBattle = () => {
      onClose();
      if (activeMatchup?.id) {
        navigateToBattleStart(router, activeMatchup);
      } else {
        router.push('/battle');
      }
    };
    const blocker = (
      <div
        data-allow-fixed-overlay="true"
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <style jsx>{`
          @keyframes pfmBlockerIn {
            0% { opacity: 0; transform: scale(0.85) translateY(20px); }
            60% { opacity: 1; transform: scale(1.03) translateY(-2px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes pfmSwordSwing {
            0%, 100% { transform: rotate(-8deg); }
            50% { transform: rotate(8deg); }
          }
          .pfm-blocker { animation: pfmBlockerIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
          .pfm-sword { display: inline-block; animation: pfmSwordSwing 1.6s ease-in-out infinite; }
          .pfm-blk-primary { transition: transform 0.12s ease, box-shadow 0.12s ease; }
          @media (hover: hover) {
            .pfm-blk-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55); }
          }
          .pfm-blk-primary:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
          .pfm-blk-secondary { transition: transform 0.12s ease, box-shadow 0.12s ease; }
          @media (hover: hover) {
            .pfm-blk-secondary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a; }
          }
          .pfm-blk-secondary:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
        `}</style>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pfm-blocker-title"
          className="pfm-blocker rounded-3xl max-w-sm w-full overflow-hidden my-auto"
          style={{
            backgroundColor: '#0d0d0d',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 8px 0 #0a0a0a, 0 22px 44px rgba(0,0,0,0.55)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-2 text-center">
            <div
              className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.45)',
              }}
            >
              <span className="text-4xl pfm-sword">⚔️</span>
            </div>
            <div
              className="text-[11px] font-extrabold uppercase mb-1"
              style={{ color: '#60a5fa', letterSpacing: '0.22em' }}
            >
              You're In A Battle
            </div>
            <h2
              id="pfm-blocker-title"
              className="font-black uppercase"
              style={{
                color: '#fff',
                fontSize: '22px',
                letterSpacing: '0.04em',
                textShadow: '0 2px 0 #000',
              }}
            >
              Finish your fight first
            </h2>
            <p className="text-sm mt-3" style={{ color: '#9ca3af', lineHeight: 1.5 }}>
              You can't send a new battle invite while you're already
              matched up with <span style={{ color: '#fff', fontWeight: 700 }}>{opponentName}</span>.
            </p>
          </div>

          <div className="px-5 py-4 space-y-2">
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: '#111',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
            >
              <span className="text-lg leading-none mt-0.5">🎯</span>
              <p className="text-xs font-semibold" style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
                Head back to your battle and play it out — winner takes the pot.
              </p>
            </div>
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: '#111',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
            >
              <span className="text-lg leading-none mt-0.5">🏳️</span>
              <p className="text-xs font-semibold" style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
                Or tap{' '}
                <span style={{ color: '#fb923c', fontWeight: 800 }}>Forfeit</span>
                {' '}on your battle to surrender — then you'll be free to invite anyone.
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 pt-1 flex flex-col gap-3">
            <button
              onClick={goToBattle}
              className="pfm-blk-primary w-full py-3.5 rounded-2xl text-sm uppercase"
              style={{
                background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                fontWeight: 900,
                letterSpacing: '0.08em',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.4)',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
              }}
            >
              Go to my battle
            </button>
            <button
              onClick={onClose}
              className="pfm-blk-secondary w-full py-3 rounded-2xl text-sm uppercase"
              style={{
                background: '#111',
                color: '#9ca3af',
                fontWeight: 800,
                letterSpacing: '0.08em',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
    return ReactDOM.createPortal(blocker, document.body);
  }

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

  // ── Premium "challenge sent / waiting" moment (shared look with Quick
  // Match). This restyles ONLY the sender's waiting screen. All invite
  // logic — the countdown ref, expiry effect, accept/decline polling and
  // navigateToBattleStart — lives in the effects/handlers above and is
  // untouched here; cancelInvite / setSent / onClose are reused as-is.
  if (sent) {
    const friendName = selectedFriend?.username || 'your opponent';
    const flowStake = isBeta ? (Number(buyIn) || 10000) : (Number(buyIn) || 0);
    const waitingPremium = (
      <div
        data-allow-fixed-overlay="true"
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="max-w-md w-full my-auto rounded-[22px] overflow-hidden"
          style={{
            backgroundColor: '#070a14',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 28px 64px rgba(0,0,0,0.62)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {inviteCountdown > 0 ? (
            <ConnectingToFriend
              you={currentUser}
              friend={selectedFriend}
              balance={flowStake}
              onCancel={sentInviteId ? cancelInvite : onClose}
              subtitle={`Waiting for ${friendName} to accept · expires in ${formatCountdown(inviteCountdown)}`}
            />
          ) : (
            <FlowCard balance={flowStake}>
              <div className="px-6 pt-7 pb-8 text-center">
                <span aria-hidden="true" style={{ fontSize: 26 }}>⌛</span>
                <h2 className="mt-1 font-black italic uppercase leading-[0.95]" style={{ fontSize: 'clamp(26px,7vw,38px)', color: '#facc15' }}>
                  Invite Expired
                </h2>
                <p className="mt-2 text-[12px]" style={{ color: '#94a3b8' }}>
                  {friendName} didn’t respond in time.
                </p>
                <div className="mt-6 max-w-[300px] mx-auto space-y-3">
                  <FlowButton color="blue" onClick={() => { setSent(false); setError(''); }}>Try Again</FlowButton>
                  <FlowButton color="dark" onClick={onClose}>Close</FlowButton>
                </div>
              </div>
            </FlowCard>
          )}
          {error && (
            <div className="px-6 pb-5">
              <div
                className="rounded-xl px-3 py-2.5 text-xs font-semibold text-center"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
              >
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    );
    return ReactDOM.createPortal(waitingPremium, document.body);
  }

  const content = (
    <div data-allow-fixed-overlay="true" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pfm-title"
        className="rounded-3xl max-w-md w-full max-h-[88vh] overflow-hidden flex flex-col pfm-slide-in my-auto"
        style={{ backgroundColor: cardBg, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              {onBack && (
                <button
                  aria-label="Back"
                  onClick={onBack}
                  className="pfm-close-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <svg className="w-4 h-4" style={{ color: textPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
            <div>
              {/* Cartoon-styled title to match BattleModeChooser:
                  uppercase, extrabold, drop shadow on the heading and a
                  smaller all-caps eyebrow for the subtitle. Keeps
                  PlayFriendModal in the same visual family as the rest
                  of the battle UI. */}
              {/* Premium hero title — clean italic wordmark with a muted
                  brand-blue eyebrow, matching QuickMatchModal so both 1v1
                  entry flows share the same design system. */}
              <div className="flex items-center" style={{ paddingTop: 6 }}>
                <h2
                  id="pfm-title"
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 'clamp(22px, 5.5vw, 30px)',
                    lineHeight: 1.2,
                    letterSpacing: '0.01em',
                    color: '#fff',
                    textShadow: '0 0 22px rgba(59,130,246,0.45)',
                    whiteSpace: 'nowrap',
                    margin: 0,
                    padding: '2px 0',
                  }}
                >
                  Play a Friend
                </h2>
              </div>
              <p
                className="mt-1 font-bold uppercase"
                style={{
                  color: '#93c5fd',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                }}
              >
                Challenge someone to a 1v1 battle
              </p>
            </div>
            </div>
            <button
              aria-label="Close"
              onClick={onClose}
              className="pfm-close-btn w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <svg className="w-4 h-4" style={{ color: textPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {!sent && !lockedFriend && (
            <div
              className="flex gap-1.5 p-1.5 rounded-2xl mb-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="pfm-tab-btn flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider relative"
                    style={{
                      background: active ? 'linear-gradient(180deg,#60a5fa,#2563eb)' : 'transparent',
                      color: active ? '#fff' : textMuted,
                      border: active ? '1px solid rgba(0,0,0,0.15)' : '1px solid transparent',
                      boxShadow: active ? '0 6px 18px rgba(59,130,246,0.4)' : 'none',
                    }}
                  >
                    {tab.label}
                    {tab.id === 'requests' && requestCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center"
                        style={{ background: 'linear-gradient(180deg,#ef4444,#dc2626)', border: '1px solid rgba(0,0,0,0.2)', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
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

          <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ minHeight: 360 }}>
            {/* Cartoon-themed non-sent error box — same red gradient +
                chunky black border + offset shadow as the sent state,
                so failures read consistently across both branches. */}
            {error && (
              <div
                className="rounded-xl px-3 py-2.5 text-sm font-semibold mb-4 pfm-fade-in"
                style={{
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#fca5a5',
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition-transform active:scale-[0.97]"
                              style={
                                isSelected
                                  ? {
                                      background: 'linear-gradient(180deg,#34d399,#10b981)',
                                      color: '#fff',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      boxShadow: '0 6px 16px rgba(16,185,129,0.4)',
                                    }
                                  : {
                                      background: 'linear-gradient(180deg,#60a5fa,#2563eb)',
                                      color: '#fff',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      boxShadow: '0 6px 16px rgba(59,130,246,0.4)',
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
                    border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 0 14px rgba(59,130,246,0.18)',
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
                      className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-transform active:scale-[0.97]"
                      style={{
                        backgroundColor: elevatedBg,
                        color: textPrimary,
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      Change
                    </button>
                  )}
                </div>

                {isBeta ? null : (
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider mb-2 block" style={{ color: textMuted }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => {
                      const selected = buyIn === amount;
                      return (
                        <button
                          key={amount}
                          onClick={() => setBuyIn(amount)}
                          className="py-2 rounded-xl text-sm font-extrabold transition-transform active:scale-[0.97]"
                          style={
                            selected
                              ? {
                                  background: 'linear-gradient(180deg,#60a5fa,#2563eb)',
                                  color: '#fff',
                                  border: '1px solid rgba(0,0,0,0.15)',
                                  boxShadow: '0 6px 16px rgba(59,130,246,0.4)',
                                }
                              : {
                                  backgroundColor: elevatedBg,
                                  color: textSecondary,
                                  border: '1px solid rgba(255,255,255,0.1)',
                                }
                          }
                        >
                          ${amount}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

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
                        aria-label="What's the difference between buy-in and Clash Coins?"
                        aria-expanded={showGameModeInfo}
                        className="pfm-cartoon-btn w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-extrabold leading-none"
                        style={{
                          background: showGameModeInfo ? 'linear-gradient(180deg,#60a5fa,#2563eb)' : 'rgba(255,255,255,0.08)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.12)',
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
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 12px 28px rgba(0,0,0,0.6)',
                          }}
                        >
                          {isBeta ? (
                            <>During the public beta there&apos;s no real cash — both players start with the same Clash Coins stack and the most Crowns wins the beta.</>
                          ) : (
                            <>The <span style={{ color: textPrimary, fontWeight: 800 }}>${buyIn}</span> above is each player&apos;s wager. The Clash Coins below are the in-battle starting bankroll each player gets to bet with.</>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px]" style={{ color: textMuted }}>Clash Coins = starting bankroll</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const betaLocked = isBeta && mode.id !== 'original';
                      const locked = betaLocked || (mode.id === 'rush' && rushAvailable === false);
                      const isRush = mode.id === 'rush';
                      const rushLive = !betaLocked && isRush && rushAvailable === true;
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
                          title={betaLocked ? 'Available after the public beta — Original is the only mode during beta.' : (locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined)}
                          className="flex flex-col items-center text-center px-1.5 pt-6 pb-2.5 rounded-2xl relative overflow-hidden transition-transform active:scale-[0.98]"
                          style={
                            selected
                              ? {
                                  background: `linear-gradient(180deg, rgba(${r},${g},${b},0.32) 0%, rgba(${r},${g},${b},0.08) 100%), #0a0a0a`,
                                  border: `1.5px solid ${mode.color}`,
                                  boxShadow: `0 8px 24px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.06)`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                              : {
                                  background: `linear-gradient(180deg, ${tint} 0%, rgba(${r},${g},${b},0.05) 100%), #0a0a0a`,
                                  border: `1px solid ${mode.color}55`,
                                  boxShadow: `0 6px 18px rgba(0,0,0,0.4), 0 0 16px ${glow}`,
                                  opacity: locked ? 0.5 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 132,
                                }
                          }
                        >
                          {mode.recommended && (
                            <span
                              className="absolute left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '1px solid rgba(0,0,0,0.2)',
                                boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
                                zIndex: 2,
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
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '1px solid rgba(0,0,0,0.2)',
                                boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
                                zIndex: 2,
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
                              className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                top: 6,
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                zIndex: 2,
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          {/* Internal radial color glow — gives each tile
                              the "trading card" look, matching QuickMatchModal. */}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(ellipse at 50% 38%, ${glow} 0%, transparent 60%)`,
                              borderRadius: 'inherit',
                              opacity: 0.9,
                            }}
                          />
                          <span
                            className="leading-none mb-2 relative"
                            style={{
                              fontSize: 38,
                              filter: `drop-shadow(0 0 14px ${glow})`,
                            }}
                          >
                            {mode.icon}
                          </span>
                          <span className="font-black text-[13px] leading-tight uppercase tracking-wider relative" style={{ color: '#fff' }}>{mode.label}</span>
                          {mode.tagline && (
                            <span
                              className="text-[8px] font-extrabold uppercase mt-1 leading-none relative"
                              style={{ color: '#e2e8f0', letterSpacing: '0.16em', opacity: 0.9 }}
                            >
                              {mode.tagline}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 mt-2 relative">
                            <span className="font-black text-[15px] leading-none" style={{ color: '#fff', textShadow: '0 1px 0 #000' }}>{mode.coins.toLocaleString()}</span>
                            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1, color: '#fb923c', filter: 'drop-shadow(0 0 6px #fb923c)' }}>⚔</span>
                          </span>
                          <span className="text-[8px] uppercase tracking-[0.18em] mt-0.5 leading-none font-bold relative" style={{ color: '#94a3b8' }}>Clash Coins</span>
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
                        border: '1px solid rgba(245,158,11,0.4)',
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
                          border: '1px solid rgba(255,255,255,0.08)',
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
                  border: '1px solid rgba(248,113,113,0.4)',
                  boxShadow: '0 0 14px rgba(248,113,113,0.25)',
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
              className="pfm-hero w-full font-black uppercase rounded-2xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
              style={{
                background: hasActiveMatchup
                  ? 'linear-gradient(180deg,#27272a,#18181b)'
                  : 'linear-gradient(180deg,#60a5fa,#2563eb)',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: hasActiveMatchup
                  ? '0 2px 8px rgba(0,0,0,0.5)'
                  : '0 10px 30px rgba(59,130,246,0.45)',
                color: '#ffffff',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                letterSpacing: '0.04em',
                padding: '14px 12px',
                fontSize: 'clamp(14px, 3.6vw, 17px)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <span
                className="relative z-10"
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: '0.4em',
                  minWidth: 0,
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {sending ? (
                  'Sending…'
                ) : hasActiveMatchup ? (
                  'In a battle'
                ) : (
                  <>
                    <span style={{ flexShrink: 0 }}>Challenge</span>
                    <span
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedFriend.username}
                    </span>
                  </>
                )}
              </span>
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
          transform: scale(0.97);
        }
        @keyframes pfmSheen {
          0% { transform: translateX(-130%) skewX(-18deg); }
          100% { transform: translateX(230%) skewX(-18deg); }
        }
        .pfm-hero { transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease; }
        .pfm-hero:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 6px 16px rgba(59,130,246,0.30); }
        .pfm-hero:not(:disabled)::after {
          content: '';
          position: absolute; top: 0; left: 0; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          animation: pfmSheen 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .pfm-slide-in, .pfm-fade-in, .pfm-list-item, .pfm-bounce-in { animation: none !important; }
          .pfm-cartoon-btn, .pfm-hero { transition: none !important; }
          .pfm-hero:not(:disabled)::after { animation: none !important; opacity: 0; }
        }
      `}</style>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
