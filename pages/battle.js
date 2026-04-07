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
import ForfeitModal from '../components/battle/ForfeitModal';

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
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showBattleOptions, setShowBattleOptions] = useState(false);

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
        const [inviteRes, matchupRes] = await Promise.all([
          fetch('/api/battles/invite'),
          fetch('/api/matchups/current'),
        ]);

        let matchData = null;
        if (matchupRes.ok) {
          matchData = await matchupRes.json();
        }

        if (inviteRes.ok) {
          const data = await inviteRes.json();
          const hadPendingSent = invites.sent?.length > 0;
          const hasPendingSent = data.sent?.length > 0;
          setInvites(data);

          if (hadPendingSent && !hasPendingSent && matchData?.matchup) {
            if (matchData.matchup.status === 'active' || matchData.matchup.status === 'matched') {
              setActiveMatchup(matchData.matchup);
              setShowLobby(matchData.matchup);
            }
          }
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
  }, [userId, invites.sent?.length, activeMatchup?.id, activeMatchup?.status]);

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

  const totalBattles = (profile?.battleWins || 0) + (profile?.battleLosses || 0);
  const winRate = totalBattles > 0 ? Math.round(((profile?.battleWins || 0) / totalBattles) * 100) : 0;

  const handleBattleOptionClick = (setter) => {
    setShowBattleOptions(false);
    requireAuth(() => setter(true));
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar />

      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-4">

          <div className="flex items-center justify-between py-2 sm:py-3">
            <div className="flex items-center gap-3">
              {!isGuest && profile && (
                <>
                  <div
                    className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden border border-[#333] cursor-pointer"
                    onClick={() => router.push(`/profile/${userId}`)}
                  >
                    {profile?.avatar ? (
                      <img src={profile.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-sm font-bold text-white">{profile?.username?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="cursor-pointer" onClick={() => router.push(`/profile/${userId}`)}>
                    <h1 className="text-base font-bold text-white leading-tight">{profile?.username || 'Player'}</h1>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="text-green-400 font-semibold">{profile?.battleWins || 0}W</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-red-400 font-semibold">{profile?.battleLosses || 0}L</span>
                      {totalBattles > 0 && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-gray-400">{winRate}%</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
              {(isGuest || !profile) && (
                <div>
                  <h1 className="text-lg font-bold text-white">Battle Arena</h1>
                  <p className="text-gray-500 text-xs mt-0.5">Head-to-head sports betting battles</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isGuest && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden w-9 h-9 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-gray-400 transition-colors relative border border-[#333]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {(invites.received?.length > 0) && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                      {invites.received.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {!isGuest && invites.received?.length > 0 && (
            <div className="mb-4 space-y-2">
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

          {activeMatchup && activeMatchup.status === 'waiting' && (
            <div className="mb-4 bg-[#0d0d0d] border border-orange-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-semibold">Waiting for Opponent</span>
                </div>
                <span className="text-gray-500 text-xs font-medium">
                  {activeMatchup.matchType === 'private' ? 'Private' : activeMatchup.matchType === 'friend' ? 'Friend' : 'Quick'}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="flex gap-5 mb-3">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Buy-In</p>
                    <p className="text-white font-semibold text-sm">${parseFloat(activeMatchup.startingBalance || 0).toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Duration</p>
                    <p className="text-white font-semibold text-sm">
                      {activeMatchup.durationMinutes >= 1440
                        ? `${Math.floor(activeMatchup.durationMinutes / 1440)}d`
                        : activeMatchup.durationMinutes >= 60
                        ? `${Math.floor(activeMatchup.durationMinutes / 60)}h`
                        : `${activeMatchup.durationMinutes}m`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Pot</p>
                    <p className="text-white font-semibold text-sm">${parseFloat(activeMatchup.potSize || activeMatchup.startingBalance * 2 || 0).toFixed(0)}</p>
                  </div>
                </div>
                {activeMatchup.privateCode && (
                  <div className="bg-[#111] border border-[#222] rounded-lg p-3 mb-3">
                    <p className="text-gray-500 text-xs text-center mb-1.5">Share this code</p>
                    <div className="text-xl font-mono font-bold text-white text-center tracking-[0.3em] mb-2">
                      {activeMatchup.privateCode}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeMatchup.privateCode);
                        const btn = document.getElementById('copy-code-btn');
                        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000); }
                      }}
                      id="copy-code-btn"
                      className="w-full bg-[#1a1a1a] text-white font-medium py-2 rounded-lg transition-colors text-sm border border-[#333]"
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
                          .then(data => {
                            if (data.success) {
                              setActiveMatchup(null);
                              fetchData();
                            }
                          })
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

          {activeMatchup && (activeMatchup.status === 'active' || activeMatchup.status === 'matched') && (
            <div className="mb-4 bg-[#0d0d0d] border border-green-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-semibold">Active Battle</span>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="text-blue-400 text-xs font-medium"
                >
                  Dashboard →
                </button>
              </div>
              <div className="px-4 py-3">
                <p className="text-gray-400 text-sm mb-2">Battle in progress. Head to the dashboard to place picks.</p>
                <button
                  onClick={() => setShowForfeitModal(true)}
                  className="text-gray-500 text-xs font-medium transition-colors"
                >
                  Forfeit
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 pb-8">
            <div className="flex-1 min-w-0">

              <div className="mb-5">
                <LiveBattlesSection focusBattleId={router.query.battle} />
              </div>

              {!activeMatchup && (
                <div className="mb-5">
                  {!showBattleOptions ? (
                    <button
                      onClick={() => requireAuth(() => setShowBattleOptions(true))}
                      className="battle-start-btn w-full relative overflow-hidden rounded-xl py-4 sm:py-5 font-bold text-lg text-white border border-blue-500/30 transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 battle-start-btn-hover-gradient"></div>
                      <div className="relative flex items-center justify-center gap-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span>Start a Battle</span>
                      </div>
                    </button>
                  ) : (
                    <div className="battle-options-panel rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                        <span className="text-white text-sm font-semibold">Choose Battle Mode</span>
                        <button
                          onClick={() => setShowBattleOptions(false)}
                          className="text-gray-500 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="p-3 grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                          onClick={() => handleBattleOptionClick(setShowQuickMatch)}
                          className="battle-mode-btn group flex flex-col items-center gap-2 sm:gap-3 py-4 sm:py-5 px-2 rounded-xl border border-[#1a1a1a] bg-[#111] transition-all duration-200"
                          data-color="blue"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 transition-colors">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold text-xs sm:text-sm leading-tight">Quick Match</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 leading-tight hidden sm:block">Random opponent</p>
                          </div>
                        </button>

                        <button
                          onClick={() => handleBattleOptionClick(setShowPlayFriend)}
                          className="battle-mode-btn group flex flex-col items-center gap-2 sm:gap-3 py-4 sm:py-5 px-2 rounded-xl border border-[#1a1a1a] bg-[#111] transition-all duration-200"
                          data-color="emerald"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 transition-colors">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold text-xs sm:text-sm leading-tight">Play a Friend</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 leading-tight hidden sm:block">Challenge a friend</p>
                          </div>
                        </button>

                        <button
                          onClick={() => handleBattleOptionClick(setShowPrivateMatch)}
                          className="battle-mode-btn group flex flex-col items-center gap-2 sm:gap-3 py-4 sm:py-5 px-2 rounded-xl border border-[#1a1a1a] bg-[#111] transition-all duration-200"
                          data-color="orange"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 transition-colors">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                          </div>
                          <div className="text-center">
                            <p className="text-white font-semibold text-xs sm:text-sm leading-tight">Private Match</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 leading-tight hidden sm:block">Join with code</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isGuest && (
                <div className="mb-5 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 text-center">
                  <h3 className="text-white font-semibold text-base mb-1.5">Ready to Battle?</h3>
                  <p className="text-gray-500 text-sm mb-4">Create an account to challenge opponents and win real prizes</p>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                    className="bg-white text-black font-semibold py-2.5 px-8 rounded-lg transition-colors text-sm"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>

            <div className={`lg:w-72 flex-shrink-0 ${showSidebar ? 'fixed inset-0 z-40 bg-black/80 lg:static lg:bg-transparent' : 'hidden lg:block'}`}>
              {showSidebar && (
                <div className="absolute inset-0 lg:hidden" onClick={() => setShowSidebar(false)}></div>
              )}
              <div className={`${showSidebar ? 'absolute right-0 top-0 bottom-0 w-80 bg-[#0a0a0a] border-l border-[#1a1a1a] p-4 overflow-y-auto z-50' : ''} lg:static lg:p-0 space-y-5`}>
                {showSidebar && (
                  <div className="flex items-center justify-between mb-2 lg:hidden">
                    <h3 className="text-white font-bold">Social</h3>
                    <button onClick={() => setShowSidebar(false)} className="text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Friends</h3>
                  {friends.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm mb-2">No friends yet</p>
                      <button
                        onClick={() => requireAuth(() => setShowPlayFriend(true))}
                        className="text-blue-400 text-xs"
                      >
                        Find friends
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {friends.map(friend => (
                        <div key={friend.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg group transition-colors">
                          <div
                            className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                            onClick={() => router.push(`/profile/${friend.id}`)}
                          >
                            {friend.avatar ? (
                              <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <span className="text-xs font-bold">{friend.username?.[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-white text-sm font-medium truncate cursor-pointer"
                              onClick={() => router.push(`/profile/${friend.id}`)}
                            >{friend.username}</div>
                            <div className="text-gray-500 text-[11px]">{friend.battleWins || 0}W-{friend.battleLosses || 0}L</div>
                          </div>
                          <button
                            onClick={() => {
                              setShowPlayFriend(true);
                              setShowSidebar(false);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-blue-400 transition-all p-1"
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
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sent Invites</h3>
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
                            className="text-gray-500 text-[10px] font-medium transition-colors flex-shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {invites.recentlyClosed?.length > 0 && (
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Invite Updates</h3>
                    <div className="space-y-2">
                      {invites.recentlyClosed.map(invite => (
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
                          <span className={`text-[10px] font-medium flex-shrink-0 ${
                            invite.status === 'accepted' ? 'text-green-400' :
                            invite.status === 'expired' ? 'text-orange-400' :
                            invite.status === 'declined' ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {invite.status === 'accepted' ? 'Accepted' :
                             invite.status === 'expired' ? 'Expired' :
                             invite.status === 'declined' ? 'Declined' : invite.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

      <ForfeitModal
        isOpen={showForfeitModal}
        matchup={activeMatchup}
        onCancel={() => setShowForfeitModal(false)}
        onConfirm={async () => {
          try {
            const res = await fetch('/api/battles/forfeit', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              setActiveMatchup(null);
              fetchData();
            }
          } catch {}
          setShowForfeitModal(false);
        }}
      />

      <style>{`
        .battle-start-btn {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        @media (hover: hover) {
          .battle-start-btn:hover {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255,255,255,0.15);
            transform: translateY(-1px);
          }
          .battle-start-btn:hover .battle-start-btn-hover-gradient {
            opacity: 1;
          }
          .battle-mode-btn[data-color="blue"]:hover {
            border-color: rgba(59, 130, 246, 0.3) !important;
            background: rgba(59, 130, 246, 0.05) !important;
          }
          .battle-mode-btn[data-color="emerald"]:hover {
            border-color: rgba(16, 185, 129, 0.3) !important;
            background: rgba(16, 185, 129, 0.05) !important;
          }
          .battle-mode-btn[data-color="orange"]:hover {
            border-color: rgba(249, 115, 22, 0.3) !important;
            background: rgba(249, 115, 22, 0.05) !important;
          }
        }
        .battle-start-btn-hover-gradient {
          transition: opacity 0.3s ease;
        }
        .battle-options-panel {
          animation: battleOptionsSlideIn 0.2s ease-out;
        }
        @keyframes battleOptionsSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (hover: none) {
          .battle-mode-btn:active {
            transform: scale(0.97);
          }
          .battle-start-btn:active {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
