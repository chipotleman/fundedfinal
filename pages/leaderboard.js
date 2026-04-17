import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ProfileModal from '../components/ProfileModal';
import TapSurface from '../components/TapSurface';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserProfiles } from '../contexts/UserProfilesContext';
import { useAuth } from '../contexts/AuthContext';
import BetSlip from '../components/BetSlip';

const Leaderboard = () => {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { selectedProfile, showProfileModal, setShowProfileModal, openProfile } = useUserProfiles();
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState('monthly');
  const [category, setCategory] = useState('all');
  const [bankroll, setBankroll] = useState(10000);
  const [activeIndex, setActiveIndex] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const carouselRef = useRef(null);
  const profileRequestRef = useRef(0);

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
        } catch (error) {
          console.error('Error fetching profile:', error);
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

  // Reset carousel position when filters change
  useEffect(() => {
    setActiveIndex(0);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [timeframe, category]);

  // Use actual child offsets so indicator math stays correct even if
  // card width, gap, or padding change in the future.
  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || !el.children.length) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    if (nearestIdx !== activeIndex) {
      setActiveIndex(nearestIdx);
    }
  }, [activeIndex]);

  const scrollToCard = (idx) => {
    const el = carouselRef.current;
    if (!el) return;
    const child = el.children[idx];
    if (!child) return;
    const target = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  };

  const getTierStyles = (tier) => {
    switch (tier) {
      case 'Elite':
        return {
          chipBg: 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300',
          accent: 'from-yellow-500/20 via-yellow-500/5 to-transparent',
          dot: 'bg-yellow-400'
        };
      case 'Pro':
        return {
          chipBg: 'bg-blue-400/10 border-blue-400/30 text-blue-300',
          accent: 'from-blue-500/20 via-blue-500/5 to-transparent',
          dot: 'bg-blue-400'
        };
      case 'Starter':
        return {
          chipBg: 'bg-green-400/10 border-green-400/30 text-green-300',
          accent: 'from-green-500/20 via-green-500/5 to-transparent',
          dot: 'bg-green-400'
        };
      default:
        return {
          chipBg: 'bg-gray-400/10 border-gray-400/30 text-gray-300',
          accent: 'from-gray-500/20 via-gray-500/5 to-transparent',
          dot: 'bg-gray-400'
        };
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return { label: '1st', icon: '🏆', ring: 'ring-2 ring-yellow-400/60', glow: 'shadow-[0_0_30px_-8px_rgba(250,204,21,0.6)]' };
    if (rank === 2) return { label: '2nd', icon: '🥈', ring: 'ring-1 ring-gray-300/40', glow: '' };
    if (rank === 3) return { label: '3rd', icon: '🥉', ring: 'ring-1 ring-orange-400/40', glow: '' };
    return { label: `#${rank}`, icon: null, ring: 'ring-1 ring-white/5', glow: '' };
  };

  const initials = (name) => name.slice(0, 2).toUpperCase();

  const formatProfit = (n) => {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  const renderLeaderCard = (leader, opts = {}) => {
    const { variant = 'carousel' } = opts;
    const tier = getTierStyles(leader.tier);
    const badge = getRankBadge(leader.rank);
    const winRate = ((leader.wins / leader.totalBets) * 100).toFixed(0);

    return (
      <TapSurface
        key={leader.rank}
        onTap={() => handleOpenLeader(leader)}
        activeColor="transparent"
        inactiveColor="transparent"
        activeTextColor="#ffffff"
        inactiveTextColor="#ffffff"
        className={`relative rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl ${badge.ring} ${badge.glow}`}
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.4) 100%)',
          width: variant === 'carousel' ? '85vw' : '100%',
          maxWidth: variant === 'carousel' ? '340px' : '100%',
          flex: variant === 'carousel' ? '0 0 auto' : undefined,
          scrollSnapAlign: variant === 'carousel' ? 'center' : undefined,
        }}
      >
        {/* Tier accent gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${tier.accent} pointer-events-none`} />

        <div className="relative p-5 flex flex-col h-full">
          {/* Header row: rank + tier */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10`}>
                {badge.icon && <span className="text-base leading-none">{badge.icon}</span>}
                <span className="text-xs font-bold text-white tracking-wide">{badge.label}</span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${tier.chipBg}`}>
              {leader.tier}
            </span>
          </div>

          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white border border-white/10 ${badge.ring}`}
                 style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
              {initials(leader.username)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-base truncate">{leader.username}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                <span className="text-gray-400 text-xs">{leader.totalBets} bets</span>
              </div>
            </div>
          </div>

          {/* Profit hero */}
          <div className="mb-4 rounded-xl bg-black/30 border border-white/5 p-3 text-center">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Profit</div>
            <div className="text-2xl font-black text-green-400">${leader.profit.toLocaleString()}</div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 text-center">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">ROI</div>
              <div className="text-base font-bold text-blue-400 mt-0.5">{leader.roi.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 text-center">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Win Rate</div>
              <div className="text-base font-bold text-white mt-0.5">{winRate}%</div>
            </div>
          </div>
        </div>
      </TapSurface>
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

      <div className="pt-4 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Leaderboard</h1>
          <p className="text-gray-400 text-sm">Top performers across all challenges</p>
        </div>

        {/* Filters - glassmorphism */}
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
                  activeColor="#16a34a"
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
                  activeColor="#2563eb"
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
            {/* Mobile: Swipeable carousel */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Swipe to browse
                </h2>
                <span className="text-xs text-gray-400">
                  {activeIndex + 1} / {leaderboardData.length}
                </span>
              </div>

              <div
                ref={carouselRef}
                onScroll={handleScroll}
                className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4"
                style={{
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollPaddingLeft: '1rem',
                  scrollPaddingRight: '1rem',
                }}
              >
                {leaderboardData.map((leader) => renderLeaderCard(leader, { variant: 'carousel' }))}
              </div>

              {/* Dot indicators */}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {leaderboardData.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToCard(i)}
                    aria-label={`Go to user ${i + 1}`}
                    className={`transition-all duration-200 rounded-full ${
                      i === activeIndex
                        ? 'w-6 h-1.5 bg-white'
                        : 'w-1.5 h-1.5 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop: Grid of same cards */}
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                Rankings
              </h2>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {leaderboardData.map((leader) => (
                  <div key={leader.rank}>
                    {renderLeaderCard(leader, { variant: 'grid' })}
                  </div>
                ))}
              </div>
            </div>
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
              color: 'text-green-400',
            },
            {
              value: communityStats
                ? formatProfit(communityStats.totalProfits)
                : '—',
              label: 'Total Profits',
              color: 'text-green-400',
            },
            {
              value: communityStats
                ? `${communityStats.avgWinRate.toFixed(1)}%`
                : '—',
              label: 'Avg Win Rate',
              color: 'text-blue-400',
            },
            { value: '24/7', label: 'Live Updates', color: 'text-yellow-400' },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 sm:p-5 border border-white/10 backdrop-blur-xl text-center"
              style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)' }}
            >
              <div className={`text-xl sm:text-2xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6">
          <div
            className="rounded-2xl p-6 sm:p-8 border border-white/10 backdrop-blur-xl text-center"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)' }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Ready to Climb the Rankings?</h2>
            <p className="text-gray-400 mb-5 text-sm">Join the competition and prove you belong among the elite bettors.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm">
                Start Your Journey
              </Link>
              <Link href="/" className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm border border-white/10">
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
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

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Leaderboard;
