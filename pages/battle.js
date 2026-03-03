import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import QuickMatchModal from '../components/battle/QuickMatchModal';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import PrivateMatchModal from '../components/battle/PrivateMatchModal';
import InviteToast from '../components/battle/InviteToast';
import MatchHistoryModal from '../components/battle/MatchHistoryModal';
import MatchLobby from '../components/battle/MatchLobby';
import MatchResult from '../components/battle/MatchResult';
import LiveBattlesSection from '../components/battle/LiveBattlesSection';

function GuestAvatarRotator() {
  const [index, setIndex] = useState(0);
  const avatars = ['🏀', '⚽', '🏈', '⚾', '🏒'];
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % avatars.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  return <span className="text-xl transition-all duration-500">{avatars[index]}</span>;
}

export default function BattlePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [invites, setInvites] = useState({ received: [], sent: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [activeMatchup, setActiveMatchup] = useState(null);

  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLobby, setShowLobby] = useState(null);
  const [showResult, setShowResult] = useState(null);

  const isGuest = status !== 'authenticated';
  const userId = session?.user?.id;

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, friendsRes, invitesRes, historyRes, matchupRes] = await Promise.allSettled([
        fetch(`/api/profiles/${userId}`),
        fetch('/api/friends'),
        fetch('/api/battles/invite'),
        fetch('/api/battles/history?limit=5'),
        fetch('/api/matchups/current'),
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
        }
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
    if (!userId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/battles/invite');
        if (res.ok) {
          const data = await res.json();
          setInvites(data);
        }
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [userId]);

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
              clearInterval(interval);
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

  const handleAcceptInvite = async (inviteId) => {
    try {
      const invite = invites.received?.find(i => i.id === inviteId);
      const res = await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matchupId) {
          const matchRes = await fetch(`/api/matchups/${data.matchupId}`);
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            setShowLobby(matchData.matchup || matchData);
          } else {
            router.push('/');
          }
        }
        fetchData();
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
      window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }));
      return;
    }
    callback();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'tie': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black">
        <TopNavbar />
        <div className="pt-20 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 5rem)' }}>
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Loading Battle Arena...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar />

      <div className="pt-20 pb-8 max-w-6xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="flex-1">
            {!isGuest && (
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center overflow-hidden ring-2 ring-blue-500/20">
                  {profile?.avatar ? (
                    <img src={profile.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-xl font-bold text-white">{profile?.username?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-white truncate">{profile?.username || 'Player'}</h1>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-400 font-medium">{profile?.battleWins || 0}W</span>
                    <span className="text-gray-600">-</span>
                    <span className="text-red-400 font-medium">{profile?.battleLosses || 0}L</span>
                    {profile?.bankroll && (
                      <>
                        <span className="text-gray-700">|</span>
                        <span className="text-gray-400">${parseFloat(profile.bankroll).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors relative"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {(invites.received?.length > 0) && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {invites.received.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {activeMatchup && activeMatchup.status === 'waiting' && (
              <div className="mb-6 bg-gradient-to-r from-orange-900/20 to-orange-800/10 border border-orange-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-orange-400 text-sm font-bold">Waiting for Opponent</span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {activeMatchup.matchType === 'private' ? 'Private Match' : activeMatchup.matchType === 'friend' ? 'Friend Match' : 'Quick Match'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Buy-In</p>
                    <p className="text-white font-bold text-lg">${parseFloat(activeMatchup.startingBalance || 0).toFixed(0)}</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-white font-bold text-lg">
                      {activeMatchup.durationMinutes >= 1440
                        ? `${Math.floor(activeMatchup.durationMinutes / 1440)}d`
                        : activeMatchup.durationMinutes >= 60
                        ? `${Math.floor(activeMatchup.durationMinutes / 60)}h`
                        : `${activeMatchup.durationMinutes}m`}
                    </p>
                  </div>
                </div>

                {activeMatchup.privateCode && (
                  <div className="bg-black/40 rounded-xl p-4 mb-4">
                    <p className="text-gray-400 text-xs text-center mb-2">Share this code with your opponent</p>
                    <div className="text-3xl font-mono font-bold text-white text-center tracking-[0.3em] mb-3">
                      {activeMatchup.privateCode}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeMatchup.privateCode);
                        const btn = document.getElementById('copy-code-btn');
                        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000); }
                      }}
                      id="copy-code-btn"
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                    >
                      Copy Code
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-400 text-xs">Waiting for someone to join...</span>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Cancel this match? You can create a new one afterward.')) {
                        fetch('/api/battles/private', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'cancel' }),
                        })
                          .then(r => r.json())
                          .then(data => {
                            if (data.success) {
                              setActiveMatchup(null);
                              fetchData();
                            }
                          })
                          .catch(() => {});
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    Cancel Match
                  </button>
                </div>
              </div>
            )}

            {activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched') && (
              <div className="mb-6 bg-gradient-to-r from-blue-900/30 to-blue-800/20 border border-blue-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-bold">Active Battle</span>
                  </div>
                  <button
                    onClick={() => router.push('/')}
                    className="text-blue-400 text-sm hover:text-blue-300 transition-colors font-medium"
                  >
                    Go to Dashboard →
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-3">You have an active battle in progress. Head to the dashboard to place bets.</p>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to forfeit this battle? Your opponent will be declared the winner and receive the payout.')) {
                      fetch('/api/battles/forfeit', { method: 'POST' })
                        .then(r => r.json())
                        .then(data => {
                          if (data.success) {
                            setActiveMatchup(null);
                            fetchData();
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                >
                  Forfeit Battle
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="relative group">
                <button
                  onClick={() => requireAuth(() => setShowQuickMatch(true))}
                  disabled={!!activeMatchup}
                  className="w-full bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-500/20 touch-none-hover rounded-2xl p-6 text-left transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-14 h-14 bg-blue-500/15 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-3xl">⚡</span>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Quick Match</h3>
                  <p className="text-gray-400 text-sm">Find a random opponent</p>
                </button>
                {!!activeMatchup && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Finish your current battle first
                  </div>
                )}
              </div>

              <div className="relative group">
                <button
                  onClick={() => requireAuth(() => setShowPlayFriend(true))}
                  disabled={!!activeMatchup}
                  className="w-full bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-500/20 touch-none-hover rounded-2xl p-6 text-left transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-14 h-14 bg-emerald-500/15 rounded-xl flex items-center justify-center mb-4 transition-transform">
                    <span className="text-3xl">👥</span>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Play a Friend</h3>
                  <p className="text-gray-400 text-sm">Challenge someone you know</p>
                </button>
                {!!activeMatchup && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Finish your current battle first
                  </div>
                )}
              </div>

              <div className="relative group">
                <button
                  onClick={() => requireAuth(() => setShowPrivateMatch(true))}
                  disabled={!!activeMatchup}
                  className="w-full bg-gradient-to-br from-orange-900/40 to-orange-800/20 border border-orange-500/20 touch-none-hover rounded-2xl p-6 text-left transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-14 h-14 bg-orange-500/15 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🔑</span>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Private Match</h3>
                  <p className="text-gray-400 text-sm">Create or join with a code</p>
                </button>
                {!!activeMatchup && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Finish your current battle first
                  </div>
                )}
              </div>
            </div>

            {isGuest && (
              <div className="mb-6 bg-gradient-to-r from-blue-600/15 to-emerald-600/10 border border-blue-500/20 rounded-2xl p-6 text-center">
                <h3 className="text-white font-bold text-lg mb-2">Ready to Battle?</h3>
                <p className="text-gray-400 text-sm mb-4">Create an account to challenge opponents and win real prizes</p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-colors"
                >
                  Sign Up to Start Battling
                </button>
              </div>
            )}

            {!isGuest && invites.received?.length > 0 && (
              <div className="mb-6 space-y-2">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Incoming Challenges</h3>
                {invites.received.map(invite => (
                  <InviteToast
                    key={invite.id}
                    invite={invite}
                    onAccept={handleAcceptInvite}
                    onDecline={handleDeclineInvite}
                  />
                ))}
              </div>
            )}

            <LiveBattlesSection focusBattleId={router.query.battle} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent Matches</h3>
                <button
                  onClick={() => requireAuth(() => setShowHistory(true))}
                  className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
                >
                  View All
                </button>
              </div>

              {recentMatches.length === 0 ? (
                <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-8 text-center">
                  <span className="text-3xl block mb-2">🏟️</span>
                  <p className="text-gray-500 text-sm">No matches yet</p>
                  <p className="text-gray-600 text-xs mt-1">Start your first battle above!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentMatches.map(match => (
                    <div key={match.id} className="bg-gray-900/30 border border-gray-800/30 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {match.opponent?.avatar ? (
                          <img src={match.opponent.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-xs font-bold text-gray-300">{match.opponent?.username?.[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{match.opponent?.username || 'Unknown'}</div>
                        <div className="text-gray-500 text-xs">${match.buyIn} · {formatDate(match.createdAt)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xs font-bold uppercase ${getResultColor(match.result)}`}>
                          {match.result === 'pending' ? 'ACTIVE' : match.result?.toUpperCase()}
                        </div>
                        {match.result !== 'pending' && match.result !== 'cancelled' && (
                          <div className={`text-xs ${match.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {match.pnl >= 0 ? '+' : ''}{match.pnl?.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`lg:w-72 flex-shrink-0 ${showSidebar ? 'fixed inset-0 z-40 bg-black/80 lg:static lg:bg-transparent' : 'hidden lg:block'}`}>
            {showSidebar && (
              <div className="absolute inset-0 lg:hidden" onClick={() => setShowSidebar(false)}></div>
            )}
            <div className={`${showSidebar ? 'absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto z-50' : ''} lg:static lg:p-0 space-y-5`}>
              {showSidebar && (
                <div className="flex items-center justify-between mb-2 lg:hidden">
                  <h3 className="text-white font-bold">Social</h3>
                  <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Friends</h3>
                {friends.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-2">No friends yet</p>
                    <button
                      onClick={() => requireAuth(() => setShowPlayFriend(true))}
                      className="text-blue-400 text-xs hover:text-blue-300"
                    >
                      Find friends →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {friends.map(friend => (
                      <div key={friend.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-800/50 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {friend.avatar ? (
                            <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-xs font-bold">{friend.username?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{friend.username}</div>
                          <div className="text-gray-500 text-[11px]">{friend.battleWins || 0}W-{friend.battleLosses || 0}L</div>
                        </div>
                        <button
                          onClick={() => {
                            setShowPlayFriend(true);
                            setShowSidebar(false);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-all p-1"
                          title="Challenge"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {invites.sent?.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Sent Invites</h3>
                  <div className="space-y-2">
                    {invites.sent.map(invite => (
                      <div key={invite.id} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {invite.receiver?.avatar ? (
                              <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <span className="text-[10px]">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>
                            )}
                          </div>
                          <span className="text-gray-300 text-xs truncate">{invite.receiver?.username || 'User'}</span>
                        </div>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="text-gray-500 hover:text-red-400 text-[10px] font-medium transition-colors flex-shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <QuickMatchModal
        isOpen={showQuickMatch}
        onClose={() => setShowQuickMatch(false)}
        userId={userId}
        onMatchFound={(matchup) => {
          setShowLobby(matchup);
          fetchData();
        }}
      />
      <PlayFriendModal
        isOpen={showPlayFriend}
        onClose={() => setShowPlayFriend(false)}
        friends={friends}
        onInviteSent={fetchData}
        onSwitchToPrivate={() => setShowPrivateMatch(true)}
      />
      <PrivateMatchModal
        isOpen={showPrivateMatch}
        onClose={() => setShowPrivateMatch(false)}
        onMatchJoined={(matchup) => {
          setShowLobby(matchup);
          fetchData();
        }}
      />
      <MatchHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
      {showLobby && (
        <MatchLobby
          matchup={showLobby}
          currentUser={{ id: userId }}
          onDismiss={() => setShowLobby(null)}
        />
      )}
      {showResult && (
        <MatchResult
          matchup={showResult}
          currentUserId={userId}
          onRematch={() => {
            setShowResult(null);
            setShowPlayFriend(true);
          }}
          onClose={() => setShowResult(null)}
        />
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        :global(.animate-slideIn) {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
