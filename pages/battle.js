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
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import { useMatchup } from '../contexts/MatchupContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationsContext';

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

  const [showQuickMatch, setShowQuickMatch] = useState(false);
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLobby, setShowLobby] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);
  const [showBattleOptions, setShowBattleOptions] = useState(false);

  const { isDarkMode } = useTheme();
  const { setSuppress } = useNotifications();
  const isGuest = status !== 'authenticated';
  const userId = session?.user?.id;

  // Suppress global invite toasts while the user is on the battle page —
  // the page already renders InviteToast inline for received invites.
  useEffect(() => {
    setSuppress('battle_invites', true);
    return () => setSuppress('battle_invites', false);
  }, [setSuppress]);

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
          setMatchupData(data);
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
      if (typeof window !== 'undefined') {
        window.__pendingAuthAction = 'resumeBattleOptions';
      }
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

  const totalBattles = (profile?.battleWins || 0) + (profile?.battleLosses || 0);
  const winRate = totalBattles > 0 ? Math.round(((profile?.battleWins || 0) / totalBattles) * 100) : 0;

  const handleBattleOptionClick = (setter) => {
    setShowBattleOptions(false);
    requireAuth(() => setter(true));
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDarkMode ? '#000000' : '#f5f5f5' }}>
      <TopNavbar />

      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-4">
          {!isGuest && (
            <div className="flex items-center justify-end py-2 sm:py-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 transition-colors relative"
                style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#eef0f3', border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}` }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {(invites.received?.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                    {invites.received.length}
                  </span>
                )}
              </button>
            </div>
          )}

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
            <div className="mb-4 rounded-xl overflow-hidden" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Waiting for Opponent</span>
                </div>
                <span className="text-gray-500 text-xs font-medium">
                  {activeMatchup.matchType === 'private' ? 'Private' : activeMatchup.matchType === 'friend' ? 'Friend' : 'Quick'}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="flex gap-5 mb-3">
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Buy-In</p>
                    <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>${parseFloat(activeMatchup.startingBalance || 0).toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Duration</p>
                    <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>
                      {activeMatchup.durationMinutes >= 1440
                        ? `${Math.floor(activeMatchup.durationMinutes / 1440)}d`
                        : activeMatchup.durationMinutes >= 60
                        ? `${Math.floor(activeMatchup.durationMinutes / 60)}h`
                        : `${activeMatchup.durationMinutes}m`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Pot</p>
                    <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>${parseFloat(activeMatchup.potSize || activeMatchup.startingBalance * 2 || 0).toFixed(0)}</p>
                  </div>
                </div>
                {activeMatchup.privateCode && (
                  <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: isDarkMode ? '#111' : '#eef0f3', border: `1px solid ${isDarkMode ? '#222' : '#d1d5db'}` }}>
                    <p className="text-gray-500 text-xs text-center mb-1.5">Share this code</p>
                    <div className="text-xl font-mono font-bold text-center tracking-[0.3em] mb-2" style={{ color: isDarkMode ? '#fff' : '#111' }}>
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
                      style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#fff', color: isDarkMode ? '#fff' : '#111', border: `1px solid ${isDarkMode ? '#333' : '#d1d5db'}` }}
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
            const oppName = opp?.username || opp?.displayName || 'Opponent';
            const oppAvatar = opp?.avatar;
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
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">{formatTime(timeLeft)}</span>
                    <span className="text-blue-400 text-[10px] font-medium">Place Picks →</span>
                  </div>
                </div>

                <div className="relative px-4 py-4">
                  <div className="flex items-center">
                    <div className="flex-1 flex flex-col items-center text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #333' }}>
                        {myAvatar ? (
                          <img src={myAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-lg">{(myName || 'Y')[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <p className="text-white font-semibold text-xs truncate max-w-[100px] min-h-[16px]">{myName || '\u00A0'}</p>
                      <p className={`text-sm font-bold mt-0.5 ${myPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${myBal.toFixed(0)}
                      </p>
                      <p className={`text-[10px] font-medium ${myPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {myPnl >= 0 ? '+' : ''}{myPnl.toFixed(0)}
                      </p>
                    </div>

                    <div className="flex flex-col items-center px-3">
                      <span className="text-xl sm:text-2xl font-black text-blue-400 vs-glow">VS</span>
                      <div className="text-[9px] text-gray-500 font-medium mt-1 text-center">
                        <span className="text-white font-bold">${pot.toFixed(0)}</span> pot
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center text-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #333' }}>
                        {oppAvatar ? (
                          <img src={oppAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-lg">{oppName[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <p className="text-white font-semibold text-xs truncate max-w-[100px] min-h-[16px]">{oppName}</p>
                      <p className={`text-sm font-bold mt-0.5 ${oppPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${oppBal.toFixed(0)}
                      </p>
                      <p className={`text-[10px] font-medium ${oppPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {oppPnl >= 0 ? '+' : ''}{oppPnl.toFixed(0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-500 w-8 text-right">{myPercent.toFixed(0)}%</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{
                          width: `${myPercent}%`,
                          background: myPnl >= oppPnl
                            ? 'linear-gradient(90deg, #22c55e, #10b981)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)',
                        }}></div>
                      </div>
                      <span className="text-[10px] text-gray-500 w-8">{(100 - myPercent).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{
                        width: `${timeProgress}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                      }}></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowForfeitModal(true); }}
                    className="text-gray-600 text-[10px] font-medium hover:text-red-400 transition-colors"
                  >
                    Forfeit
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
              <>
                <div className="rounded-xl overflow-hidden mb-5" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="p-5 sm:p-6 text-center">
                    <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#fff' : '#111' }}>1v1 Betting Battles</h2>
                    <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                      Go head-to-head against another player. Both start with the same bankroll, make your piks on live games, and the best record takes the pot.
                    </p>

                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-2 border border-blue-500/20">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <p className="text-[11px] font-semibold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Pick Games</p>
                        <p className="text-[10px] mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Both players make piks on live games</p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="text-[11px] font-semibold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Track Live</p>
                        <p className="text-[10px] mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Watch your balance move in real time</p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                        <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-2 border border-orange-500/20">
                          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-[11px] font-semibold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Winner Takes Pot</p>
                        <p className="text-[10px] mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Keep the entire pot, just a 5% rake</p>
                      </div>
                    </div>

                    {!activeMatchup && (
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
                    )}

                    {isGuest && (
                      <div className="text-center mt-4 pt-4" style={{ borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                        <p className="text-sm mb-3" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Create an account to start battling</p>
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                          className="font-semibold py-2.5 px-8 rounded-lg transition-colors text-sm"
                          style={{ backgroundColor: isDarkMode ? '#fff' : '#111', color: isDarkMode ? '#000' : '#fff' }}
                        >
                          Sign Up Free
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );

            return (
              <div className="flex flex-col lg:flex-row gap-6 pb-8">
                <div className="lg:hidden">
                  {battleCTA}
                </div>

                <div className="flex-1 min-w-0 order-2 lg:order-1">
                  <div className="mb-5">
                    <LiveBattlesSection focusBattleId={router.query.battle} currentUserId={userId} />
                  </div>
                </div>

                <div className="lg:w-[340px] flex-shrink-0 order-1 lg:order-2">
                  <div className="hidden lg:block lg:sticky lg:top-16">
                    {battleCTA}

                    <div className={`${showSidebar ? 'fixed inset-0 z-40 bg-black/80 lg:static lg:bg-transparent' : 'hidden lg:block'}`}>
                      {showSidebar && (
                        <div className="absolute inset-0 lg:hidden" onClick={() => setShowSidebar(false)}></div>
                      )}
                      <div className={`${showSidebar ? `absolute right-0 top-0 bottom-0 w-80 p-4 overflow-y-auto z-50` : ''} lg:static lg:p-0 space-y-5`} style={showSidebar ? { backgroundColor: isDarkMode ? '#0a0a0a' : '#f5f5f5', borderLeft: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` } : undefined}>
                        {showSidebar && (
                          <div className="flex items-center justify-between mb-2 lg:hidden">
                            <h3 className="font-bold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Social</h3>
                            <button onClick={() => setShowSidebar(false)} className="text-gray-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}

                        <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
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
                                    className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
                                    style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                                    onClick={() => router.push(`/profile/${friend.id}`)}
                                  >
                                    {friend.avatar ? (
                                      <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                      <span className="text-xs font-bold" style={{ color: isDarkMode ? '#fff' : '#111' }}>{friend.username?.[0]?.toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="text-sm font-medium truncate cursor-pointer"
                                      style={{ color: isDarkMode ? '#fff' : '#111' }}
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
                          <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sent Invites</h3>
                            <div className="space-y-2">
                              {invites.sent.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb' }}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                                      {invite.receiver?.avatar ? (
                                        <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" />
                                      ) : (
                                        <span className="text-[10px]">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>
                                      )}
                                    </div>
                                    <span className="text-xs truncate" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>{invite.receiver?.username || 'User'}</span>
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
                          <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Invite Updates</h3>
                            <div className="space-y-2">
                              {invites.recentlyClosed.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb' }}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                                      {invite.receiver?.avatar ? (
                                        <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" />
                                      ) : (
                                        <span className="text-[10px]">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>
                                      )}
                                    </div>
                                    <span className="text-xs truncate" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>{invite.receiver?.username || 'User'}</span>
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

                <div className={`lg:hidden ${showSidebar ? 'fixed inset-0 z-40 bg-black/80' : 'hidden'}`}>
                  <div className="absolute inset-0" onClick={() => setShowSidebar(false)}></div>
                  <div className="absolute right-0 top-0 bottom-0 w-80 p-4 overflow-y-auto z-50 space-y-5" style={{ backgroundColor: isDarkMode ? '#0a0a0a' : '#f5f5f5', borderLeft: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Social</h3>
                      <button onClick={() => setShowSidebar(false)} className="text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Friends</h3>
                      {friends.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-500 text-sm mb-2">No friends yet</p>
                          <button onClick={() => requireAuth(() => setShowPlayFriend(true))} className="text-blue-400 text-xs">Find friends</button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {friends.map(friend => (
                            <div key={friend.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg group transition-colors">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }} onClick={() => router.push(`/profile/${friend.id}`)}>
                                {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-xs font-bold" style={{ color: isDarkMode ? '#fff' : '#111' }}>{friend.username?.[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate cursor-pointer" style={{ color: isDarkMode ? '#fff' : '#111' }} onClick={() => router.push(`/profile/${friend.id}`)}>{friend.username}</div>
                                <div className="text-gray-500 text-[11px]">{friend.battleWins || 0}W-{friend.battleLosses || 0}L</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {invites.sent?.length > 0 && (
                      <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sent Invites</h3>
                        <div className="space-y-2">
                          {invites.sent.map(invite => (
                            <div key={invite.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                                  {invite.receiver?.avatar ? <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px]">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>}
                                </div>
                                <span className="text-xs truncate" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>{invite.receiver?.username || 'User'}</span>
                              </div>
                              <button onClick={() => handleCancelInvite(invite.id)} className="text-gray-500 text-[10px] font-medium transition-colors flex-shrink-0">Cancel</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {invites.recentlyClosed?.length > 0 && (
                      <div className="rounded-xl p-4" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Invite Updates</h3>
                        <div className="space-y-2">
                          {invites.recentlyClosed.map(invite => (
                            <div key={invite.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                                  {invite.receiver?.avatar ? <img src={invite.receiver.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px]">{invite.receiver?.username?.[0]?.toUpperCase() || '?'}</span>}
                                </div>
                                <span className="text-xs truncate" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>{invite.receiver?.username || 'User'}</span>
                              </div>
                              <span className={`text-[10px] font-medium flex-shrink-0 ${invite.status === 'accepted' ? 'text-green-400' : invite.status === 'expired' ? 'text-orange-400' : invite.status === 'declined' ? 'text-red-400' : 'text-gray-400'}`}>
                                {invite.status === 'accepted' ? 'Accepted' : invite.status === 'expired' ? 'Expired' : invite.status === 'declined' ? 'Declined' : invite.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {showBattleOptions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBattleOptions(false)} onKeyDown={e => { if (e.key === 'Escape') setShowBattleOptions(false); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-mode-title"
            className="rounded-2xl max-w-sm w-full overflow-hidden bm-slide-in"
            style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? '0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 pb-3" style={{ borderBottom: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="battle-mode-title" className="text-lg font-bold" style={{ color: isDarkMode ? '#fff' : '#111' }}>Choose Battle Mode</h2>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>How do you want to play?</p>
                </div>
                <button aria-label="Close" onClick={() => setShowBattleOptions(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6' }}>
                  <svg className="w-4 h-4" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-5 space-y-2.5">
              <button
                onClick={() => { setShowBattleOptions(false); setShowQuickMatch(true); }}
                className="bm-option w-full flex items-center gap-4 p-4 rounded-xl transition-all"
                style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>Quick Match</p>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Get matched with a random opponent instantly</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: isDarkMode ? '#4b5563' : '#d1d5db' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button
                onClick={() => { setShowBattleOptions(false); setShowPlayFriend(true); }}
                className="bm-option w-full flex items-center gap-4 p-4 rounded-xl transition-all"
                style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>Play a Friend</p>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Challenge someone from your friends list</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: isDarkMode ? '#4b5563' : '#d1d5db' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button
                onClick={() => { setShowBattleOptions(false); setShowPrivateMatch(true); }}
                className="bm-option w-full flex items-center gap-4 p-4 rounded-xl transition-all"
                style={{ backgroundColor: isDarkMode ? '#111' : '#f9fafb', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
              >
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm" style={{ color: isDarkMode ? '#fff' : '#111' }}>Private Match</p>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Create or join with a private code</p>
                </div>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: isDarkMode ? '#4b5563' : '#d1d5db' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <style>{`
            @keyframes bmSlideIn {
              from { opacity: 0; transform: translateY(-12px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .bm-slide-in { animation: bmSlideIn 0.2s ease-out; }
            @media (hover: hover) {
              .bm-option:hover { transform: translateX(2px); }
            }
          `}</style>
        </div>
      )}

      <QuickMatchModal
        isOpen={showQuickMatch}
        onClose={() => setShowQuickMatch(false)}
        userId={userId}
        onMatchFound={(matchup) => {
          fetchData();
          refreshGlobalMatchup();
          router.push('/?battleStarted=true');
        }}
      />
      <PlayFriendModal
        isOpen={showPlayFriend}
        onClose={() => setShowPlayFriend(false)}
        friends={friends}
        onInviteSent={() => { fetchData(); refreshGlobalMatchup(); }}
        onSwitchToPrivate={() => setShowPrivateMatch(true)}
      />
      <PrivateMatchModal
        isOpen={showPrivateMatch}
        onClose={() => setShowPrivateMatch(false)}
        onMatchJoined={(matchup) => {
          setShowLobby(matchup);
          fetchData();
          refreshGlobalMatchup();
          setTimeout(() => router.push('/?battleStarted=true'), 2500);
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
            const opponentSnapshot = matchupData?.opponent || null;
            const res = await fetch('/api/battles/forfeit', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              setForfeitConfirmation({
                opponent: opponentSnapshot,
                payout: data?.matchup?.winnerPayout ?? null,
                totalPot: data?.matchup?.totalPot ?? null,
              });
              setActiveMatchup(null);
              setMatchupData(null);
              fetchData();
            }
          } catch {}
          setShowForfeitModal(false);
        }}
      />

      <ForfeitConfirmedModal
        isOpen={!!forfeitConfirmation}
        onClose={() => setForfeitConfirmation(null)}
        opponent={forfeitConfirmation?.opponent}
        payout={forfeitConfirmation?.payout}
        totalPot={forfeitConfirmation?.totalPot}
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
        }
        .battle-start-btn-hover-gradient {
          transition: opacity 0.3s ease;
        }
        @media (hover: none) {
          .battle-start-btn:active {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
