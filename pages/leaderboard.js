import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ProfileModal from '../components/ProfileModal';
import UserAvatar, { UserNameLink, useProfilePrefetchHandlers } from '../components/UserAvatar';
import TapSurface from '../components/TapSurface';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserProfiles } from '../contexts/UserProfilesContext';
import { useAuth } from '../contexts/AuthContext';
import BetSlip from '../components/BetSlip';

function ProfileLink({ user, extras, children, className = '', ...rest }) {
  const handlers = useProfilePrefetchHandlers(user, extras);
  return (
    <Link
      href={user?.id ? `/profile/${user.id}` : '#'}
      className={className}
      {...handlers}
      {...rest}
    >
      {children}
    </Link>
  );
}

const Leaderboard = () => {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { selectedProfile, showProfileModal, setShowProfileModal, openProfile } = useUserProfiles();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState('monthly');
  const [category, setCategory] = useState('all');
  const [bankroll, setBankroll] = useState(10000);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const profileRequestRef = useRef(0);
  const listRef = useRef(null);
  const userRowRefs = useRef({});

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            if (profile?.bankroll) {
              setBankroll(profile.bankroll);
            }
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ timeframe, category });
        const response = await fetch(`/api/leaderboard?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load leaderboard');
        const data = await response.json();
        if (!cancelled) {
          setLeaderboardData(Array.isArray(data.leaders) ? data.leaders : []);
          setCommunityStats(data.communityStats || null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        if (!cancelled) {
          setError('Could not load the leaderboard. Please try again.');
          setLeaderboardData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [timeframe, category]);

  const handleOpenLeader = async (leader) => {
    const winRate = leader.totalBets > 0
      ? Number(((leader.wins / leader.totalBets) * 100).toFixed(1))
      : 0;

    const baseProfile = {
      id: leader.id,
      username: leader.username,
      avatar: leader.avatar || null,
      tier: leader.tier,
      joinDate: leader.joinDate || new Date().toISOString(),
      stats: {
        totalBets: leader.totalBets,
        winRate,
        totalProfit: leader.profit,
        currentStreak: 0,
        longestStreak: 0,
        avgOdds: 0,
        challengesCompleted: 0,
        currentChallenge: 0,
        roi: leader.roi,
      },
      achievements: [],
      recentBets: [],
    };

    openProfile(baseProfile);

    if (!leader.id) return;

    const requestId = ++profileRequestRef.current;

    try {
      const response = await fetch(`/api/profiles/${leader.id}`);
      if (!response.ok) return;
      if (requestId !== profileRequestRef.current) return;
      const data = await response.json();
      if (requestId !== profileRequestRef.current) return;
      openProfile({
        ...baseProfile,
        joinDate: data.createdAt || baseProfile.joinDate,
        stats: {
          ...baseProfile.stats,
          currentStreak: data.currentStreak ?? 0,
          avgOdds: data.avgOdds ?? 0,
        },
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        recentBets: Array.isArray(data.recentBets) ? data.recentBets : [],
      });
    } catch (err) {
      console.error('Error loading leader profile:', err);
    }
  };

  const formatProfit = (n) => {
    const value = Number(n) || 0;
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  const winRateOf = (leader) => {
    if (!leader?.totalBets) return 0;
    return (leader.wins / leader.totalBets) * 100;
  };

  const keyStatFor = (leader) => {
    if (category === 'all') {
      return { label: 'PnL', value: formatProfit(leader.profit) };
    }
    const wr = winRateOf(leader);
    return { label: 'Win Rate', value: `${wr.toFixed(0)}%` };
  };

  const top3 = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
  const rest = useMemo(() => leaderboardData.slice(3), [leaderboardData]);

  const userRank = useMemo(() => {
    if (!user?.id) return null;
    const me = leaderboardData.find((l) => l.id === user.id);
    return me || null;
  }, [user, leaderboardData]);

  const scrollToMyRank = () => {
    if (!userRank) return;
    let el = userRowRefs.current[userRank.id];
    // If the user is in the top 3 their row lives in the podium and won't have
    // a row ref — fall back to scrolling the page to the very top so the
    // podium is in view.
    if (!el && userRank.rank <= 3) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('lb-row-flash');
      setTimeout(() => el.classList.remove('lb-row-flash'), 1600);
    }
  };

  const userToProps = (leader) => ({
    id: leader.id,
    username: leader.username,
    avatar: leader.avatar || null,
    frameId: leader.equippedFrame,
  });

  // Podium order: 2 - 1 - 3 (so #1 stands tallest in the middle)
  const podiumOrder = useMemo(() => {
    const map = new Map(top3.map((l) => [l.rank, l]));
    return [map.get(2), map.get(1), map.get(3)].filter(Boolean);
  }, [top3]);

  const renderPodiumItem = (leader) => {
    if (!leader) return null;
    const isFirst = leader.rank === 1;
    const size = isFirst ? 120 : 96;
    const stat = keyStatFor(leader);
    const medal = leader.rank === 1 ? '👑' : leader.rank === 2 ? '🥈' : '🥉';
    const ringColor = leader.rank === 1
      ? 'ring-yellow-400/70'
      : leader.rank === 2
      ? 'ring-cyan-300/60'
      : 'ring-orange-400/60';
    const glow = leader.rank === 1
      ? 'shadow-[0_0_60px_-12px_rgba(250,204,21,0.55)]'
      : leader.rank === 2
      ? 'shadow-[0_0_40px_-14px_rgba(103,232,249,0.5)]'
      : 'shadow-[0_0_40px_-14px_rgba(251,146,60,0.5)]';

    return (
      <div
        key={leader.id || leader.rank}
        className={`flex flex-col items-center ${isFirst ? 'order-2 -mt-2 sm:-mt-4' : leader.rank === 2 ? 'order-1' : 'order-3'}`}
        style={{ minWidth: 0, flex: '1 1 0' }}
      >
        <div className="relative">
          <div
            className={`absolute -top-3 left-1/2 -translate-x-1/2 z-10 text-2xl sm:text-3xl select-none`}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
            aria-hidden="true"
          >
            {medal}
          </div>
          <div
            className={`rounded-full p-1 ring-2 ${ringColor} ${glow} bg-black/40 transition-transform duration-200 active:scale-95`}
          >
            <ProfileLink
              user={userToProps(leader)}
              extras={{ tier: leader.tier }}
              aria-label={`View ${leader.username}'s profile`}
              className="block rounded-full"
            >
              <UserAvatar
                user={userToProps(leader)}
                size={size}
                isOnline={!!leader.isOnline}
                onlineDotBorderColor="#0a0a0a"
              />
            </ProfileLink>
          </div>
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/80 border border-white/10 text-[10px] font-bold text-white tracking-wider"
          >
            #{leader.rank}
          </div>
        </div>

        <div className="mt-5 text-center w-full px-1">
          <UserNameLink
            user={userToProps(leader)}
            className="block text-white font-semibold text-sm sm:text-base truncate"
          />
          <div className="mt-1.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              {stat.label}
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-400">
              {stat.value}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListRow = (leader) => {
    const wr = winRateOf(leader);
    const losses = Math.max(0, (leader.totalBets || 0) - (leader.wins || 0));
    const isMe = user?.id && leader.id === user.id;

    return (
      <div
        key={leader.id || leader.rank}
        ref={(el) => { if (leader.id) userRowRefs.current[leader.id] = el; }}
        className={`group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 transition-colors ${
          isMe ? 'bg-emerald-500/5' : ''
        } lb-row`}
      >
        <div className="w-8 sm:w-10 text-center text-sm sm:text-base font-bold text-gray-400 tabular-nums">
          {leader.rank}
        </div>

        <ProfileLink
          user={userToProps(leader)}
          extras={{ tier: leader.tier }}
          aria-label={`View ${leader.username}'s profile`}
          className="shrink-0 rounded-full"
        >
          <UserAvatar
            user={userToProps(leader)}
            size={52}
            isOnline={!!leader.isOnline}
            onlineDotBorderColor="#111111"
          />
        </ProfileLink>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <UserNameLink
              user={userToProps(leader)}
              className="text-white font-semibold text-sm sm:text-base truncate"
            />
            {isMe && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                You
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-400 truncate">
            {leader.totalBets || 0} bets · {leader.tier || 'Player'}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <StatPill label="PnL" value={formatProfit(leader.profit)} tone="emerald" />
          <StatPill label="W-L" value={`${leader.wins || 0}-${losses}`} tone="cyan" />
          <StatPill label="ROI" value={`${(leader.roi || 0).toFixed(1)}%`} tone="blue" />
        </div>

        <div className="sm:hidden flex flex-col items-end gap-1">
          <div className="text-emerald-400 font-bold text-sm tabular-nums">
            {formatProfit(leader.profit)}
          </div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">
            {wr.toFixed(0)}% WR
          </div>
        </div>

        <button
          onClick={() => handleOpenLeader(leader)}
          aria-label={`Quick view ${leader.username}`}
          className="hidden sm:inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar
        bankroll={user ? bankroll : null}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-4 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Leaderboard</h1>
          <p className="text-gray-400 text-sm">The community's top performers</p>
        </div>

        {/* Sticky "You're #N" pill — sits just under the TopNavbar so it's
            always reachable while scrolling the long ranks list. */}
        {userRank && (
          <div className="sticky top-2 z-30 mb-4 flex justify-end pointer-events-none">
            <button
              onClick={scrollToMyRank}
              className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-lg shadow-emerald-500/10 transition-colors active:bg-emerald-500/25"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              You're #{userRank.rank}
            </button>
          </div>
        )}

        {/* Filters */}
        <div
          className="rounded-2xl p-3 sm:p-4 border border-white/10 backdrop-blur-xl mb-5"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)' }}
        >
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-between">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {[
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'alltime', label: 'All Time' }
              ].map((tf) => (
                <TapSurface
                  key={tf.id}
                  onTap={() => setTimeframe(tf.id)}
                  isActive={timeframe === tf.id}
                  activeColor="#10b981"
                  inactiveColor="rgba(255,255,255,0.04)"
                  activeTextColor="#ffffff"
                  inactiveTextColor="#9ca3af"
                  className="px-3.5 py-2 rounded-lg font-semibold text-xs whitespace-nowrap border border-white/5 flex items-center justify-center"
                >
                  {tf.label}
                </TapSurface>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all', label: 'All' },
                { id: 'elite', label: 'Elite' },
                { id: 'pro', label: 'Pro' },
                { id: 'starter', label: 'Starter' }
              ].map((cat) => (
                <TapSurface
                  key={cat.id}
                  onTap={() => setCategory(cat.id)}
                  isActive={category === cat.id}
                  activeColor="#0891b2"
                  inactiveColor="rgba(255,255,255,0.04)"
                  activeTextColor="#ffffff"
                  inactiveTextColor="#9ca3af"
                  className="px-3.5 py-2 rounded-lg font-semibold text-xs whitespace-nowrap border border-white/5 flex items-center justify-center"
                >
                  {cat.label}
                </TapSurface>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 p-10 text-center text-gray-400">
            Loading leaderboard...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center text-red-300">
            {error}
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-10 text-center text-gray-400">
            No bettors match these filters yet.
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div
                className="rounded-3xl border border-white/10 backdrop-blur-xl mb-6 overflow-hidden"
                style={{
                  background:
                    'radial-gradient(120% 80% at 50% 0%, rgba(16,185,129,0.10) 0%, rgba(8,145,178,0.06) 35%, rgba(0,0,0,0) 70%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                }}
              >
                <div className="px-4 sm:px-6 pt-6 pb-8">
                  <div className="text-[11px] text-emerald-300/80 font-semibold uppercase tracking-[0.18em] text-center mb-6">
                    Top Performers
                  </div>
                  <div className="flex items-end justify-center gap-3 sm:gap-8">
                    {podiumOrder.map((leader) => renderPodiumItem(leader))}
                  </div>
                </div>
              </div>
            )}

            {/* Rest of the list */}
            {rest.length > 0 && (
              <div
                ref={listRef}
                className="rounded-2xl border border-white/10 overflow-hidden"
                style={{ background: '#111111' }}
              >
                <div className="px-4 sm:px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Rankings
                  </h2>
                  <span className="text-[11px] text-gray-500">
                    {leaderboardData.length} players
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {rest.map((leader) => renderListRow(leader))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Community stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          {[
            {
              value: communityStats
                ? communityStats.activeBettors.toLocaleString()
                : '—',
              label: 'Active Bettors',
              color: 'text-emerald-400',
            },
            {
              value: communityStats
                ? formatProfit(communityStats.totalProfits)
                : '—',
              label: 'Total Profits',
              color: 'text-emerald-400',
            },
            {
              value: communityStats
                ? `${communityStats.avgWinRate.toFixed(1)}%`
                : '—',
              label: 'Avg Win Rate',
              color: 'text-cyan-400',
            },
            { value: '24/7', label: 'Live Updates', color: 'text-orange-400' },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 sm:p-5 border border-white/10 text-center"
              style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
            >
              <div className={`text-xl sm:text-2xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!user && (
          <div className="mt-6">
            <div
              className="rounded-2xl p-6 sm:p-8 border border-white/10 text-center"
              style={{ background: 'linear-gradient(160deg, rgba(16,185,129,0.08) 0%, rgba(8,145,178,0.04) 100%)' }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Ready to Climb the Rankings?</h2>
              <p className="text-gray-400 mb-5 text-sm">Join the competition and prove you belong among the elite bettors.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/auth" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm">
                  Start Your Journey
                </Link>
                <Link href="/" className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm border border-white/10">
                  View Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {showBetSlip && (
        <BetSlip
          bankroll={bankroll}
          isOpen={showBetSlip}
          onClose={() => setShowBetSlip(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          profile={selectedProfile}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @media (hover: hover) {
          .lb-row:hover {
            background: rgba(255, 255, 255, 0.03);
          }
        }
        .lb-row-flash {
          animation: lbFlash 1.6s ease-out;
        }
        @keyframes lbFlash {
          0% { background-color: rgba(16, 185, 129, 0.25); }
          100% { background-color: rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

function StatPill({ label, value, tone = 'emerald' }) {
  const tones = {
    emerald: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
    cyan: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
    blue: 'text-blue-300 border-blue-500/20 bg-blue-500/5',
    orange: 'text-orange-300 border-orange-500/20 bg-orange-500/5',
  };
  return (
    <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold tabular-nums whitespace-nowrap ${tones[tone] || tones.emerald}`}>
      <span className="opacity-60 mr-1 uppercase tracking-wider text-[9px]">{label}</span>
      {value}
    </div>
  );
}

export default Leaderboard;
