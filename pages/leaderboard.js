import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ProfileModal from '../components/ProfileModal';
import UserAvatar, { UserNameLink, useProfilePrefetchHandlers } from '../components/UserAvatar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserProfiles } from '../contexts/UserProfilesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

/* ─────────────────────────────────────────────────────────────────────
   Cartoon-themed Leaderboard
   ─────────────────────────────────────────────────────────────────────
   Built around three goals from the brief:
     1. Group focus, not a single-winner pedestal — show *many* bettors
        in one glance so visiting the page feels like walking into an
        arcade scoreboard, not a hall of fame for one person.
     2. Filterable on every meaningful axis — sport (NBA/NFL/MLB/NHL),
        sort metric (Profit / Win% / ROI / Volume), and timeframe.
        Switching axes re-ranks the whole board so #1 can change.
     3. Million-user ready — pagination via offset/limit, "Show more"
        button, total counter so the user can see they're not at the
        bottom. The API is paginated on the server, the page only
        holds what's visible.

   Visual language:
     • 2.5–3px black borders + 4px hard offset shadows (cartoon panel).
     • Blue / Orange / Emerald / Yellow palette only. No purple.
     • Bouncy hover on tappable surfaces (gated under hover:hover via
       Tailwind's hoverOnlyWhenSupported so touch devices don't get
       sticky hover states).
   ───────────────────────────────────────────────────────────────────── */

const SPORTS = [
  { id: 'all',  emoji: '🏆', label: 'All' },
  { id: 'nba',  emoji: '🏀', label: 'NBA' },
  { id: 'nfl',  emoji: '🏈', label: 'NFL' },
  { id: 'mlb',  emoji: '⚾', label: 'MLB' },
  { id: 'nhl',  emoji: '🏒', label: 'NHL' },
];

const SORTS = [
  { id: 'profit',  label: 'Profit',  short: '$$$', accent: '#10b981' },
  { id: 'winrate', label: 'Win %',   short: 'W%',  accent: '#3b82f6' },
  { id: 'roi',     label: 'ROI',     short: 'ROI', accent: '#06b6d4' },
  { id: 'volume',  label: 'Volume',  short: 'Vol', accent: '#fb923c' },
];

const TIMEFRAMES = [
  { id: 'weekly',  label: 'Week' },
  { id: 'monthly', label: 'Month' },
  { id: 'alltime', label: 'All-Time' },
];

const PAGE_SIZE = 25;

/* Theme-aware palette. The page was authored dark-first with cartoon
   colors (#0d0d0d surfaces / #1a1a1a borders / #000 page) baked into
   inline styles, so light mode rendered all-black. Every neutral
   surface/text/ink token flips through this palette; bright accent
   colors (gold/cyan/orange/emerald/blue) stay the same in both themes. */
function getPalette(isLight) {
  if (isLight) {
    return {
      pageBg: '#f5f1ea',
      heroBg: 'linear-gradient(135deg, #ffffff 0%, #eef2f7 100%)',
      dotColor: '#0f172a',
      surface: '#ffffff',
      surfaceDeep: '#f0ebe1',
      chipIdleBg: '#ffffff',
      ink: '#0f172a',
      shadowInk: 'rgba(15,23,42,0.16)',
      borderSoft: 'rgba(15,23,42,0.12)',
      shadowSoft: 'rgba(15,23,42,0.10)',
      rowBorder: 'rgba(15,23,42,0.08)',
      primaryText: '#0f172a',
      mutedText: '#64748b',
      faintText: '#cbd5e1',
      heroSub: '#64748b',
      neutralRankBg: '#e2e8f0',
      invBg: '#0f172a',
      invText: '#ffffff',
      rowHover: 'rgba(15,23,42,0.04)',
    };
  }
  return {
    pageBg: '#000000',
    heroBg: 'linear-gradient(135deg, #0d0d0d 0%, #111827 100%)',
    dotColor: '#ffffff',
    surface: '#0d0d0d',
    surfaceDeep: '#0a0a0a',
    chipIdleBg: '#0d0d0d',
    ink: '#0d0d0d',
    shadowInk: '#0d0d0d',
    borderSoft: '#1a1a1a',
    shadowSoft: '#1a1a1a',
    rowBorder: '#111111',
    primaryText: '#ffffff',
    mutedText: '#9ca3af',
    faintText: '#374151',
    heroSub: '#9ca3af',
    neutralRankBg: '#1a1a1a',
    invBg: '#ffffff',
    invText: '#0d0d0d',
    rowHover: 'rgba(255,255,255,0.04)',
  };
}

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

function formatProfit(n) {
  const value = Number(n) || 0;
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}👑${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}👑${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${sign}👑${(abs / 1_000).toFixed(1)}K`;
  return `${sign}👑${abs.toLocaleString()}`;
}

function formatVolume(n) {
  const v = Number(n) || 0;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

/* The headline stat for each row depends on which sort is active so
   the user always sees the number the board is ranked by, big and
   centered. Other stats fall to a compact secondary line. */
function primaryStatFor(leader, sortBy) {
  switch (sortBy) {
    case 'winrate':
      return {
        label: 'Win Rate',
        value: `${(leader.winRate || 0).toFixed(1)}%`,
        accent: '#3b82f6',
      };
    case 'roi':
      return {
        label: 'ROI',
        value: `${(leader.roi || 0).toFixed(1)}%`,
        accent: '#06b6d4',
      };
    case 'volume':
      return {
        label: 'Bets',
        value: formatVolume(leader.totalBets),
        accent: '#fb923c',
      };
    case 'profit':
    default: {
      const profit = Number(leader.profit) || 0;
      return {
        label: 'Profit',
        value: formatProfit(profit),
        accent: profit >= 0 ? '#10b981' : '#ef4444',
      };
    }
  }
}

const Leaderboard = () => {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { selectedProfile, showProfileModal, setShowProfileModal, openProfile } = useUserProfiles();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const p = getPalette(isLight);

  const [timeframe, setTimeframe] = useState('alltime');
  const [sortBy, setSortBy] = useState('profit');
  const [sport, setSport] = useState('all');

  const [leaders, setLeaders] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [myRank, setMyRank] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [bankroll, setBankroll] = useState(10000);

  const profileRequestRef = useRef(0);
  const userRowRefs = useRef({});

  // ── User's own bankroll for the navbar pill ─────────────────────
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/profiles/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p?.bankroll && setBankroll(p.bankroll))
      .catch(() => {});
  }, [user]);

  // ── Whenever a filter axis flips we reset the page and refetch ──
  useEffect(() => {
    setOffset(0);
  }, [timeframe, sortBy, sport]);

  useEffect(() => {
    let cancelled = false;
    const isInitial = offset === 0;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    const params = new URLSearchParams({
      timeframe,
      sortBy,
      sport,
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });

    fetch(`/api/leaderboard?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load leaderboard');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const next = Array.isArray(data.leaders) ? data.leaders : [];
        setLeaders((prev) => (isInitial ? next : [...prev, ...next]));
        setTotal(Number(data.total) || next.length);
        if (isInitial) setMyRank(data.myRank || null);
        if (data.communityStats) setCommunityStats(data.communityStats);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Leaderboard fetch error:', err);
        setError('Could not load the leaderboard. Try again.');
        if (isInitial) setLeaders([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe, sortBy, sport, offset]);

  const handleOpenLeader = useCallback(async (leader) => {
    const baseProfile = {
      id: leader.id,
      username: leader.username,
      avatar: leader.avatar || null,
      tier: leader.tier,
      joinDate: new Date().toISOString(),
      stats: {
        totalBets: leader.totalBets,
        winRate: leader.winRate,
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
      const r = await fetch(`/api/profiles/${leader.id}`);
      if (!r.ok) return;
      if (requestId !== profileRequestRef.current) return;
      const data = await r.json();
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
    } catch (e) {
      console.error('Leader profile error:', e);
    }
  }, [openProfile]);

  const userToProps = (leader) => ({
    id: leader.id,
    username: leader.username,
    avatar: leader.avatar || null,
    frameId: leader.equippedFrame,
  });

  // Prefer the server-computed myRank (works even when the user is off
  // the visible page); fall back to scanning the loaded page for parity.
  const userRank = useMemo(() => {
    if (!user?.id) return null;
    if (myRank) return myRank;
    return leaders.find((l) => l.id === user.id) || null;
  }, [user, leaders, myRank]);

  const scrollToMyRank = () => {
    if (!userRank) return;
    const el = userRowRefs.current[userRank.id];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('lb-row-flash');
      setTimeout(() => el.classList.remove('lb-row-flash'), 1500);
      return;
    }
    // User is off the currently loaded page — load up to their rank so
    // the row exists in the DOM, then a follow-up render will scroll.
    if (userRank.rank > leaders.length) {
      setOffset(0); // re-fetch from top; subsequent "Show more" walks down
      // We can't auto-scroll synchronously here because the rows aren't
      // mounted yet. The pill remains visible; user taps Show More until
      // their row paints. Future: jump-load by computing the offset page.
    }
  };

  const hasMore = leaders.length < total;
  const activeSport = SPORTS.find((s) => s.id === sport) || SPORTS[0];
  const activeSort = SORTS.find((s) => s.id === sortBy) || SORTS[0];

  return (
    <div className="min-h-screen" style={{ background: p.pageBg }}>
      <TopNavbar
        bankroll={user ? bankroll : null}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-3 sm:pt-4 pb-32">
        {/* TopNavbar is `sticky` (not `fixed`), so it already occupies
            its own height in document flow. Padding the container by
            `--top-nav-height` again would double-count it and leave a
            ~200px empty band on desktop (because the navbar's giant
            "piks" logo makes navRef.current.offsetHeight ~230px). A
            small fixed top padding is correct here. */}

        {/* Cartoon-themed hero banner — gives the page a clear, gamified
            identity so it matches the rest of the site (chunky black
            border + 4px hard shadow, bright yellow trophy chip, no
            purple). Sits above the filter/board grid. */}
        <div
          className="relative mb-4 sm:mb-5 rounded-2xl overflow-hidden"
          style={{
            background: p.heroBg,
            border: `3px solid ${p.ink}`,
            boxShadow: `5px 5px 0 ${p.shadowInk}`,
          }}
        >
          {/* Subtle dot grid for arcade feel */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `radial-gradient(circle, ${p.dotColor} 1px, transparent 1px)`,
              backgroundSize: '14px 14px',
            }}
          />
          <div className="relative flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
            <div
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl text-2xl sm:text-3xl flex-shrink-0"
              style={{
                background: '#fbbf24',
                border: `3px solid ${p.ink}`,
                boxShadow: `3px 3px 0 ${p.shadowInk}`,
              }}
            >
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate" style={{ color: p.primaryText }}>
                  Leaderboard
                </h1>
                <span
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest"
                  style={{
                    background: '#10b981',
                    color: '#0d0d0d',
                    border: '2px solid #0d0d0d',
                    boxShadow: `2px 2px 0 ${p.shadowInk}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d] animate-pulse" />
                  Live
                </span>
              </div>
              <div className="text-[11px] sm:text-xs font-bold mt-0.5" style={{ color: p.heroSub }}>
                Climb the ranks. Real bettors, real winnings, updated live.
              </div>
            </div>
            {userRank && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: p.mutedText }}>Your rank</span>
                <span
                  className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-black"
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: `2.5px solid ${p.ink}`,
                    boxShadow: `2px 2px 0 ${p.shadowInk}`,
                  }}
                >
                  #{userRank.rank}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout on desktop: filter sidebar (left) + board (right).
            On mobile filters collapse into horizontal chip rows above the
            board. */}
        <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-5">

          {/* ── Filter sidebar (desktop) / chip rows (mobile) ─────── */}
          <aside
            className="lg:sticky lg:self-start lg:overflow-y-auto scrollbar-hide space-y-3 lg:space-y-4 mb-3 lg:mb-0"
            style={{
              top: 'calc(var(--top-nav-height, 0px) + 12px)',
              maxHeight: 'calc(100vh - var(--top-nav-height, 0px) - 24px)',
            }}
          >
            {/* Sport — vertical list on desktop, horizontal scroll on mobile */}
            <div>
              <div className="hidden lg:block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: p.mutedText }}>Sport</div>
              <div className="flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-visible scrollbar-hide -mx-1 px-1 lg:mx-0 lg:px-0">
                {SPORTS.map((s) => {
                  const active = s.id === sport;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSport(s.id)}
                      className="lb-chip flex-shrink-0 lg:w-full inline-flex items-center gap-1.5 lg:gap-2 px-3 py-2 lg:py-2 rounded-xl lg:rounded-lg font-black text-[12px] lg:text-[11px] uppercase tracking-wider transition-transform active:scale-95"
                      style={{
                        background: active ? '#fbbf24' : p.chipIdleBg,
                        color: active ? '#0d0d0d' : p.mutedText,
                        border: `2px solid ${p.ink}`,
                        boxShadow: active ? `2px 2px 0 ${p.shadowInk}` : `2px 2px 0 ${p.shadowSoft}`,
                        justifyContent: 'flex-start',
                      }}
                    >
                      <span className="text-base leading-none">{s.emoji}</span>
                      <span className="lg:flex-1 lg:text-left">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort metric */}
            <div>
              <div className="hidden lg:block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: p.mutedText }}>Sort by</div>
              <div className="flex lg:grid lg:grid-cols-2 gap-1.5 overflow-x-auto lg:overflow-visible scrollbar-hide -mx-1 px-1 lg:mx-0 lg:px-0">
                {SORTS.map((s) => {
                  const active = s.id === sortBy;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSortBy(s.id)}
                      className="flex-shrink-0 lg:flex-shrink px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wider transition-transform active:scale-95"
                      style={{
                        background: active ? s.accent : p.chipIdleBg,
                        color: active ? '#0d0d0d' : p.mutedText,
                        border: `2px solid ${active ? p.ink : p.borderSoft}`,
                        boxShadow: active ? `2px 2px 0 ${p.shadowInk}` : 'none',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <div className="hidden lg:block text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: p.mutedText }}>Window</div>
              <div className="flex lg:grid lg:grid-cols-3 gap-1 lg:gap-1.5">
                {TIMEFRAMES.map((tf) => {
                  const active = tf.id === timeframe;
                  return (
                    <button
                      key={tf.id}
                      onClick={() => setTimeframe(tf.id)}
                      className="flex-1 lg:flex-initial px-2.5 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-transform active:scale-95"
                      style={{
                        background: active ? p.invBg : p.chipIdleBg,
                        color: active ? p.invText : p.mutedText,
                        border: `2px solid ${active ? p.ink : p.borderSoft}`,
                        boxShadow: active ? `2px 2px 0 ${p.shadowInk}` : 'none',
                      }}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Community stats — compact, sidebar only */}
            {communityStats && (
              <div
                className="hidden lg:block rounded-xl p-3"
                style={{
                  background: p.surface,
                  border: `2px solid ${p.borderSoft}`,
                }}
              >
                <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: p.mutedText }}>Community</div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-bold" style={{ color: p.mutedText }}>Bettors</span>
                    <span className="text-emerald-400 font-black tabular-nums">{communityStats.activeBettors.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold" style={{ color: p.mutedText }}>Avg win %</span>
                    <span className="text-cyan-400 font-black tabular-nums">{(communityStats.avgWinRate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold" style={{ color: p.mutedText }}>Winnings</span>
                    <span className="text-orange-400 font-black tabular-nums">{formatProfit(communityStats.totalProfits)}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* ── Main board column ─────────────────────────────────── */}
          <div className="min-w-0">

        {/* ── The list ─────────────────────────────────────────── */}
        {loading ? (
          <div
            className="rounded-2xl p-8 text-center text-sm font-bold"
            style={{
              background: p.surface,
              border: `2.5px solid ${p.borderSoft}`,
              boxShadow: `3px 3px 0 ${p.shadowSoft}`,
              color: p.mutedText,
            }}
          >
            Loading the board…
          </div>
        ) : error ? (
          <div
            className="rounded-2xl p-8 text-center text-red-400 text-sm font-bold"
            style={{
              background: p.surface,
              border: '2.5px solid #ef4444',
              boxShadow: `3px 3px 0 ${p.shadowInk}`,
            }}
          >
            {error}
          </div>
        ) : leaders.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: p.surface,
              border: `2.5px solid ${p.borderSoft}`,
              boxShadow: `3px 3px 0 ${p.shadowSoft}`,
            }}
          >
            <div className="text-4xl mb-2">{activeSport.emoji}</div>
            <div className="font-black text-base mb-1" style={{ color: p.primaryText }}>No bettors yet</div>
            <div className="text-xs" style={{ color: p.mutedText }}>
              No one has settled bets in <span className="font-bold" style={{ color: p.primaryText }}>{activeSport.label}</span> for this window. Try a different sport or timeframe.
            </div>
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: p.surfaceDeep,
                border: `2.5px solid ${p.ink}`,
                boxShadow: `4px 4px 0 ${p.shadowInk}`,
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: p.surface, borderBottom: `2px solid ${p.borderSoft}` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: activeSort.accent, boxShadow: `0 0 8px ${activeSort.accent}` }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: p.primaryText }}>
                    Ranked by {activeSort.label} · {activeSport.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: p.mutedText }}>
                  {total.toLocaleString()} total
                </span>
              </div>

              <div>
                {leaders.map((leader) => (
                  <LeaderRow
                    key={leader.id || leader.rank}
                    leader={leader}
                    sortBy={sortBy}
                    isMe={!!user?.id && leader.id === user.id}
                    onOpen={() => handleOpenLeader(leader)}
                    userToProps={userToProps}
                    rowRef={(el) => { if (leader.id) userRowRefs.current[leader.id] = el; }}
                    p={p}
                  />
                ))}
              </div>

              {/* ── Load more / cycle ─────────────────────────── */}
              {hasMore && (
                <div className="p-3" style={{ borderTop: `2px solid ${p.borderSoft}`, background: p.surface }}>
                  <button
                    onClick={() => setOffset(leaders.length)}
                    disabled={loadingMore}
                    className="w-full py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider transition-transform active:scale-95 disabled:opacity-50"
                    style={{
                      background: '#fb923c',
                      color: '#0d0d0d',
                      border: `2.5px solid ${p.ink}`,
                      boxShadow: `3px 3px 0 ${p.shadowInk}`,
                    }}
                  >
                    {loadingMore ? 'Loading…' : `Show next ${Math.min(PAGE_SIZE, total - leaders.length)}`}
                  </button>
                  <div className="text-center text-[10px] font-bold mt-1.5 tabular-nums" style={{ color: p.mutedText }}>
                    Showing 1–{leaders.length} of {total.toLocaleString()}
                  </div>
                </div>
              )}
              {!hasMore && leaders.length > PAGE_SIZE && (
                <div
                  className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider"
                  style={{ borderTop: `2px solid ${p.borderSoft}`, background: p.surface, color: p.mutedText }}
                >
                  · End of board ·
                </div>
              )}
            </div>

            {/* ── Sticky "You're #N" pill ─────────────────────── */}
            {userRank && (
              <button
                onClick={scrollToMyRank}
                className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-transform active:scale-95"
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: '2.5px solid #0d0d0d',
                  boxShadow: '3px 3px 0 #0d0d0d',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                You&apos;re #{userRank.rank}
              </button>
            )}
          </>
        )}

        {/* ── Sign-in CTA (guests only) ─────────────────────────── */}
        {!user && !loading && (
          <div
            className="mt-5 rounded-2xl p-5 sm:p-6 text-center"
            style={{
              background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
              border: '3px solid #0d0d0d',
              boxShadow: '5px 5px 0 #0d0d0d',
            }}
          >
            <div className="text-2xl sm:text-3xl font-black text-black mb-1"
              style={{
                fontStyle: 'italic',
                textShadow: '2px 2px 0 rgba(0,0,0,0.15)',
              }}
            >
              Climb the Ranks
            </div>
            <p className="text-black/80 text-sm font-bold mb-4">
              Sign up, place some bets, and watch your name climb this board.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/auth"
                className="inline-block px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-transform active:scale-95"
                style={{
                  background: '#0d0d0d',
                  color: '#fff',
                  border: '2.5px solid #0d0d0d',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                }}
              >
                Join Piks
              </Link>
              <Link
                href="/dashboard"
                className="inline-block px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-transform active:scale-95"
                style={{
                  background: '#fff',
                  color: '#0d0d0d',
                  border: '2.5px solid #0d0d0d',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
                }}
              >
                Battle Now
              </Link>
            </div>
          </div>
        )}
          </div>{/* /board column */}
        </div>{/* /grid */}
      </div>

      {showProfileModal && (
        <ProfileModal
          profile={selectedProfile}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }

        .lb-row { transition: background-color 160ms ease; }
        @media (hover: hover) {
          .lb-row:hover { background-color: ${p.rowHover}; }
        }

        .lb-row-flash { animation: lbFlash 1.4s ease-out; }
        @keyframes lbFlash {
          0%   { background-color: rgba(59,130,246,0.3); }
          100% { background-color: rgba(59,130,246,0); }
        }

        /* Cartoon chip subtle bounce on tap (handled by active:scale-95). */
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────
   TopThreeStrip — three #1/#2/#3 cards side-by-side in a single row.
   Replaces the old vertical "podium" hero that put one person on a
   pedestal. All three are visible at the same size so the page reads
   as "here are the leaders" rather than "here is THE leader".
   ───────────────────────────────────────────────────────────────────── */
function TopThreeStrip({ leaders, sortBy, onOpen, userToProps }) {
  const ACCENTS = ['#fbbf24', '#06b6d4', '#fb923c']; // gold / cyan / orange
  const MEDALS = ['👑', '🥈', '🥉'];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
      {leaders.map((leader, i) => {
        const stat = primaryStatFor(leader, sortBy);
        const accent = ACCENTS[i];
        return (
          <button
            key={leader.id || i}
            onClick={() => onOpen(leader)}
            className="lb-top3 relative flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl transition-transform active:scale-95"
            style={{
              background: '#0d0d0d',
              border: `2.5px solid ${accent}`,
              boxShadow: `3px 3px 0 #0d0d0d`,
            }}
          >
            <div
              className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[10px] font-black"
              style={{
                background: accent,
                color: '#0d0d0d',
                border: '2px solid #0d0d0d',
              }}
            >
              #{leader.rank}
            </div>
            <div className="text-xl sm:text-2xl mb-1 leading-none">{MEDALS[i]}</div>
            <div
              className="rounded-full p-0.5 mb-1.5"
              style={{ border: `2px solid ${accent}`, background: '#0d0d0d' }}
            >
              <ProfileLink
                user={userToProps(leader)}
                extras={{ tier: leader.tier }}
                onClick={(e) => e.stopPropagation()}
                className="block rounded-full"
                aria-label={`Open ${leader.username}'s profile`}
              >
                <UserAvatar
                  user={userToProps(leader)}
                  size={44}
                  isOnline={!!leader.isOnline}
                  onlineDotBorderColor="#0d0d0d"
                />
              </ProfileLink>
            </div>
            <UserNameLink
              user={userToProps(leader)}
              onClick={(e) => e.stopPropagation()}
              className="block text-white font-black text-[11px] sm:text-xs truncate w-full"
            />
            <div className="mt-1 px-1.5 py-0.5 rounded text-[11px] sm:text-sm font-black tabular-nums leading-tight"
              style={{ background: '#000', color: stat.accent }}
            >
              {stat.value}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   LeaderRow — dense single-line row tuned for mobile.
   • Left: rank chip with cartoon border
   • Avatar
   • Name + tier · bet count
   • Primary stat (driven by current sort) on the right, big & bold
   ───────────────────────────────────────────────────────────────────── */
function LeaderRow({ leader, sortBy, isMe, onOpen, userToProps, rowRef, p }) {
  const stat = primaryStatFor(leader, sortBy);
  const rankBg = leader.rank === 1
    ? '#fbbf24'
    : leader.rank === 2
    ? '#06b6d4'
    : leader.rank === 3
    ? '#fb923c'
    : p.neutralRankBg;
  const rankColor = leader.rank <= 3 ? '#0d0d0d' : p.mutedText;

  return (
    <div
      ref={rowRef}
      className={`lb-row flex items-center gap-2.5 px-3 py-2.5 ${isMe ? 'bg-blue-500/5' : ''}`}
      style={{ borderBottom: `1px solid ${p.rowBorder}` }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 font-black tabular-nums text-sm"
        style={{
          background: rankBg,
          color: rankColor,
          border: `2px solid ${p.ink}`,
          boxShadow: leader.rank <= 3 ? `2px 2px 0 ${p.shadowInk}` : 'none',
        }}
      >
        {leader.rank}
      </div>

      <ProfileLink
        user={userToProps(leader)}
        extras={{ tier: leader.tier }}
        className="flex-shrink-0 rounded-full"
        aria-label={`Open ${leader.username}'s profile`}
      >
        <UserAvatar
          user={userToProps(leader)}
          size={38}
          isOnline={!!leader.isOnline}
          onlineDotBorderColor={p.surfaceDeep}
        />
      </ProfileLink>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <UserNameLink
            user={userToProps(leader)}
            className="font-black text-[13px] truncate"
            style={{ color: p.primaryText }}
          />
          {isMe && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
              style={{
                background: '#3b82f6',
                color: '#0d0d0d',
                border: '1.5px solid #0d0d0d',
              }}
            >
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px]" style={{ color: p.mutedText }}>
          <span className="font-bold">{leader.totalBets || 0} bets</span>
          <span style={{ color: p.faintText }}>·</span>
          <span className="font-bold">{(leader.winRate || 0).toFixed(0)}% W</span>
          {leader.tier && (
            <>
              <span style={{ color: p.faintText }}>·</span>
              <span
                className="font-black uppercase tracking-wider"
                style={{
                  color:
                    leader.tier === 'Elite'
                      ? '#fbbf24'
                      : leader.tier === 'Pro'
                      ? '#06b6d4'
                      : p.mutedText,
                }}
              >
                {leader.tier}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="flex-shrink-0 flex flex-col items-end gap-0.5 px-2.5 py-1.5 rounded-lg transition-transform active:scale-95"
        style={{
          background: p.surface,
          border: `2px solid ${stat.accent}`,
          boxShadow: `2px 2px 0 ${p.shadowInk}`,
        }}
      >
        <span className="text-[8px] font-black uppercase tracking-wider leading-none" style={{ color: p.mutedText }}>
          {stat.label}
        </span>
        <span
          className="font-black text-sm tabular-nums leading-none"
          style={{ color: stat.accent }}
        >
          {stat.value}
        </span>
      </button>
    </div>
  );
}

export default Leaderboard;
