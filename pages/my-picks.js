import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import PiksBetCard from '../components/PiksBetCard';
import UserAvatar from '../components/UserAvatar';
import OddsHistoryChart from '../components/game/OddsHistoryChart';
import HowItWorksModal from '../components/desktop/HowItWorksModal';
import { SelectionLogos } from '../components/TeamLogo';
import { useMatchup } from '../contexts/MatchupContext';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { formatMoney } from '../utils/formatMoney';
import { calculatePayout } from '../utils/odds';

// Theme-aware palette. The page was authored dark-first with hardcoded
// colors baked into inline styles — those bypass globals.css overrides,
// which is why light mode looked broken. We flip every surface/text
// token through this palette instead.
function getPalette(isLight) {
  if (isLight) {
    return {
      pageBg: '#f4f6fb',
      chromeBg: '#ffffff',
      cardSurface: '#ffffff',
      innerSurface: '#f1f5f9',
      pickSurface: '#ffffff',
      skeletonSurface: 'rgba(148,163,184,0.25)',
      chromeBorder: 'rgba(15,23,42,0.10)',
      softBorder: 'rgba(15,23,42,0.10)',
      dashedBorder: '2.5px dashed rgba(37,99,235,0.45)',
      hardShadow: '0 10px 30px rgba(15,23,42,0.10)',
      bodyText: '#0f172a',
      mutedText: '#64748b',
      faintText: '#94a3b8',
      navIdleText: '#475569',
      navHoverBg: 'rgba(15,23,42,0.05)',
      disabledGameBg: 'rgba(148,163,184,0.18)',
      disabledGameBorder: '1px solid rgba(148,163,184,0.4)',
      disabledGameText: '#64748b',
    };
  }
  return {
    pageBg: '#05080f',
    chromeBg: '#080c16',
    cardSurface: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(8,12,24,0.94) 100%)',
    innerSurface: 'rgba(15,23,42,0.55)',
    pickSurface: 'rgba(10,14,24,0.92)',
    skeletonSurface: 'rgba(15,23,42,0.55)',
    chromeBorder: 'rgba(255,255,255,0.07)',
    softBorder: 'rgba(255,255,255,0.08)',
    dashedBorder: '2.5px dashed rgba(59,130,246,0.4)',
    hardShadow: '0 16px 40px rgba(0,0,0,0.55)',
    bodyText: '#ffffff',
    mutedText: '#9ca3af',
    faintText: '#64748b',
    navIdleText: '#cbd5e1',
    navHoverBg: 'rgba(255,255,255,0.05)',
    disabledGameBg: 'rgba(75,85,99,0.15)',
    disabledGameBorder: '1px solid rgba(75,85,99,0.3)',
    disabledGameText: '#6b7280',
  };
}

// Normalize a raw user_bets / fake_opponent_bets row into the shape
// PiksBetCard expects (DB defaults to 'pending', the app uses 'open').
function normalizeBet(bet) {
  if (!bet) return bet;
  if (bet.status === 'pending') return { ...bet, status: 'open' };
  return bet;
}

function formatTimeRemaining(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'Settling';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Parse "Away @ Home" or "Home vs Away" → { homeTeam, awayTeam }.
function parseMatchup(matchupStr) {
  if (!matchupStr || typeof matchupStr !== 'string') return { homeTeam: '', awayTeam: '' };
  if (matchupStr.includes(' @ ')) {
    const [away, home] = matchupStr.split(' @ ');
    return { homeTeam: home, awayTeam: away };
  }
  if (matchupStr.includes(' vs ')) {
    const [home, away] = matchupStr.split(' vs ');
    return { homeTeam: home, awayTeam: away };
  }
  return { homeTeam: matchupStr, awayTeam: '' };
}

// Clash Coins glyph — the in-matchup currency (orange ⚔). Every amount
// on this page lives inside a single battle, so they are all Clash Coins.
function Coin({ color = '#fb923c' }) {
  return <span style={{ color }} aria-hidden="true">⚔</span>;
}

// ---- Sidebar line icons (stroke = currentColor) ----
const ICON_PATHS = {
  battle: <path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 14l-2 2v3h3l2-2" />,
  picks: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  live: <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />,
  leagues: <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />,
  history: <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l3 2" />,
  wallet: <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM16 12h3M16 12a1.5 1.5 0 0 0 0 3h4v-3h-4z" />,
  rewards: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
};
function NavIcon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

const NAV_ITEMS = [
  { key: 'battle', label: 'Battle', href: '/dashboard' },
  { key: 'picks', label: 'Picks', href: '/my-picks' },
  { key: 'live', label: 'Live', href: '/battle' },
  { key: 'leagues', label: 'Leagues', href: '/leaderboard' },
  { key: 'history', label: 'History', href: '/bet-history' },
  { key: 'wallet', label: 'Wallet', href: '/withdrawal' },
  { key: 'rewards', label: 'Rewards', href: null },
  { key: 'settings', label: 'Settings', href: '/settings' },
];

const SIDEBAR_W = 212;

export default function MyPicksPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const {
    matchup,
    opponent,
    myBets,
    myProfile,
    myBalance,
    myLiveBalance,
    opponentBalance,
    opponentLiveBalance,
    timeRemaining,
    hasActiveMatchup,
    loading,
  } = useMatchup();

  const { betSlip, setShowBetSlip } = useBetSlip();
  const { theme, toggleTheme } = useTheme();
  const { formatOdds } = useUserPreferences();
  const isLight = theme === 'light';
  const p = getPalette(isLight);

  const [howOpen, setHowOpen] = useState(false);
  const isLoggedIn = sessionStatus === 'authenticated';

  const sortedBets = useMemo(() => {
    const arr = Array.isArray(myBets) ? myBets.slice() : [];
    arr.sort((a, b) => {
      const ta = a?.placedAt ? new Date(a.placedAt).getTime() : 0;
      const tb = b?.placedAt ? new Date(b.placedAt).getTime() : 0;
      return tb - ta;
    });
    return arr.map(normalizeBet);
  }, [myBets]);

  // The selected pick drives the right-rail (and mobile inline) live-odds
  // tracker. Default to the most recent pick once data lands.
  const [selectedBetId, setSelectedBetId] = useState(null);
  useEffect(() => {
    if (sortedBets.length === 0) { setSelectedBetId(null); return; }
    setSelectedBetId((prev) => {
      if (prev && sortedBets.some((b) => b.id === prev)) return prev;
      return sortedBets[0].id;
    });
  }, [sortedBets]);

  const selectedBet = useMemo(
    () => sortedBets.find((b) => b.id === selectedBetId) || sortedBets[0] || null,
    [sortedBets, selectedBetId],
  );

  const counts = useMemo(() => {
    let open = 0, won = 0, lost = 0, cashedOut = 0;
    let totalStake = 0, potentialPayout = 0;
    for (const b of sortedBets) {
      const stake = parseFloat(b.stake || 0) || 0;
      const payout = parseFloat(b.potentialPayout || 0) || 0;
      if (b.status === 'open') {
        open += 1; totalStake += stake; potentialPayout += payout;
      } else if (b.status === 'won') won += 1;
      else if (b.status === 'lost') lost += 1;
      else if (b.status === 'cashed_out') cashedOut += 1;
    }
    return { open, won, lost, cashedOut, totalStake, potentialPayout };
  }, [sortedBets]);

  const battleBalances = useMemo(() => {
    const startingBalance = parseFloat(matchup?.startingBalance || 0) || 0;
    const myLive =
      myBalance != null ? parseFloat(myBalance)
        : myLiveBalance != null ? parseFloat(myLiveBalance)
        : startingBalance;
    const oppLive =
      opponentBalance != null ? parseFloat(opponentBalance)
        : opponentLiveBalance != null ? parseFloat(opponentLiveBalance)
        : startingBalance;
    return { startingBalance, myLive, oppLive };
  }, [matchup, myBalance, myLiveBalance, opponentBalance, opponentLiveBalance]);

  const openBetSlip = () => { try { setShowBetSlip(true); } catch (_e) {} };

  // ---- Shared chart context (used by mobile tracker + desktop insights) ----
  const getChartCtx = (bet) => {
    const { homeTeam: parsedHome, awayTeam: parsedAway } = parseMatchup(bet.matchup);
    const firstLeg = Array.isArray(bet.legs) && bet.legs.length > 0 ? bet.legs[0] : null;
    const gameId = bet.gameId || firstLeg?.gameId || null;
    const homeTeam = bet.homeTeamFull || firstLeg?.homeTeamFull || parsedHome || 'Home';
    const awayTeam = bet.awayTeamFull || firstLeg?.awayTeamFull || parsedAway || 'Away';
    const isLive = !!(bet.isLive || bet.currentHomeScore != null);
    const isFinal = ['won', 'lost', 'cashed_out', 'voided', 'pushed'].includes(bet.status);
    const derivedLiveOdds = (() => {
      const oddsRaw = Number(bet.odds ?? firstLeg?.odds);
      if (!Number.isFinite(oddsRaw) || oddsRaw === 0) return null;
      const myImplied = oddsRaw > 0 ? 100 / (oddsRaw + 100) : -oddsRaw / (-oddsRaw + 100);
      const oppImplied = Math.min(0.95, Math.max(0.05, 1 - myImplied));
      const oppAmerican = oppImplied >= 0.5
        ? Math.round(-(oppImplied / (1 - oppImplied)) * 100)
        : Math.round(((1 - oppImplied) / oppImplied) * 100);
      const sel = String(bet.selection || '').toLowerCase();
      const homeKey = String(homeTeam || '').toLowerCase().split(/\s+/)[0];
      const awayKey = String(awayTeam || '').toLowerCase().split(/\s+/)[0];
      const selectionIsAway = awayKey && sel.includes(awayKey);
      const selectionIsHome = homeKey && sel.includes(homeKey) && !selectionIsAway;
      if (selectionIsAway) return { home: oppAmerican, away: oddsRaw };
      if (selectionIsHome) return { home: oddsRaw, away: oppAmerican };
      return { home: oddsRaw, away: oppAmerican };
    })();
    return { gameId, homeTeam, awayTeam, isLive, isFinal, derivedLiveOdds };
  };

  const betPayout = (bet) => {
    const pp = parseFloat(bet.potentialPayout);
    if (Number.isFinite(pp) && pp > 0) return pp;
    return calculatePayout(bet.odds, bet.stake) || 0;
  };

  // ===================== MOBILE sub-renderers =====================
  // Mobile keeps the global TopNavbar + the proven stacked layout.

  const renderVsRow = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const oppName = opponent?.username || 'Opponent';
    const hasOpponent = !!opponent;
    const fighter = (avatar, name, color, gradient, ringRgba, isMe) => (
      <div className="flex flex-col items-center gap-2 min-w-0">
        <div className="rounded-full p-[3px]" style={{ background: gradient, boxShadow: `0 0 0 3px ${ringRgba}` }}>
          <UserAvatar avatar={avatar} username={name} size={56} />
        </div>
        <div className="text-[11px] font-black px-2.5 py-0.5 rounded-full truncate max-w-[104px] text-center"
          style={{ color: '#fff', background: `${color}29`, border: `1px solid ${color}80` }}>
          {isMe ? 'You' : name}
        </div>
      </div>
    );
    return (
      <div className="flex items-center justify-center gap-3">
        {fighter(myProfile?.avatar, myProfile?.username || 'You', '#3b82f6', 'linear-gradient(135deg,#3b82f6,#1d4ed8)', 'rgba(59,130,246,0.25)', true)}
        <div className="text-sm font-black px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{ color: '#fff', background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(251,146,60,0.3))', border: `1.5px solid ${p.softBorder}`, boxShadow: '0 2px 0 rgba(0,0,0,0.35)' }}>
          VS
        </div>
        {fighter(opponent?.avatar, oppName, '#fb923c', hasOpponent ? 'linear-gradient(135deg,#fb923c,#ea580c)' : 'rgba(148,163,184,0.4)', 'rgba(251,146,60,0.25)', false)}
      </div>
    );
  };

  const renderBalanceDuel = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const { startingBalance, myLive, oppLive } = battleBalances;
    const oppName = opponent?.username || 'Opponent';
    const total = Math.max(1, myLive + oppLive);
    const myPct = Math.max(8, Math.min(92, (myLive / total) * 100));
    const delta = (d) => {
      if (!d) return <span className="text-[11px] font-bold" style={{ color: p.mutedText }}>even</span>;
      const up = d > 0;
      return <span className="text-[11px] font-black" style={{ color: up ? '#34d399' : '#f87171' }}>{up ? '+' : ''}{formatMoney(d, 0)}</span>;
    };
    return (
      <div>
        <div className="flex items-end justify-between gap-2 mb-2">
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#3b82f6' }}>You</div>
            <div className="text-xl font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin color="#3b82f6" />{formatMoney(myLive, 0)}</div>
            <div>{delta(myLive - startingBalance)}</div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold truncate max-w-[120px] ml-auto" style={{ color: '#fb923c' }}>{oppName}</div>
            <div className="text-xl font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin />{formatMoney(oppLive, 0)}</div>
            <div className="text-right">{delta(oppLive - startingBalance)}</div>
          </div>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(251,146,60,0.3)', border: `1px solid ${p.softBorder}` }}>
          <div className="absolute inset-y-0 left-0 transition-all duration-500" style={{ width: `${myPct}%`, background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }} />
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-wider font-bold text-center" style={{ color: p.faintText }}>Clash Coins · this battle</div>
      </div>
    );
  };

  const renderStatTilesMobile = () => {
    if (sortedBets.length === 0) return null;
    const tile = (label, value, color) => (
      <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: `${color}1f`, border: `1px solid ${color}59` }}>
        <div className="text-lg font-black leading-none" style={{ color }}>{value}</div>
        <div className="text-[9px] uppercase tracking-wider font-bold mt-1" style={{ color: p.mutedText }}>{label}</div>
      </div>
    );
    const money = (label, value, color) => (
      <div className="rounded-xl px-3 py-2.5" style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}>
        <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>{label}</div>
        <div className="text-base font-black inline-flex items-center gap-1" style={{ color }}><Coin color={color} />{formatMoney(value, 0)}</div>
      </div>
    );
    return (
      <div>
        <div className="grid grid-cols-4 gap-2">
          {tile('Open', counts.open, '#3b82f6')}
          {tile('Won', counts.won, '#34d399')}
          {tile('Lost', counts.lost, '#f87171')}
          {tile('Cashed', counts.cashedOut, '#fb923c')}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {money('At Risk', counts.totalStake, '#fbbf24')}
          {money('To Win', Math.max(0, counts.potentialPayout - counts.totalStake), '#34d399')}
        </div>
      </div>
    );
  };

  const renderInlineBanner = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div className="rounded-2xl overflow-hidden mb-5" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.18), rgba(251,146,60,0.12))', borderBottom: `1px solid ${p.softBorder}` }}>
          <span className="text-[11px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>Active Battle</span>
          <span className="inline-flex items-center gap-1.5 text-lg font-black" style={{ color: p.bodyText }}>
            <span className="text-sm" aria-hidden="true">⏱️</span>{formatTimeRemaining(timeRemaining)}
          </span>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {renderVsRow()}
          <div className="pt-3" style={{ borderTop: `1px solid ${p.softBorder}` }}>{renderBalanceDuel()}</div>
        </div>
      </div>
    );
  };

  // ===================== Empty / auth states =====================
  const renderEmptyNoMatchup = () => (
    <div className="rounded-2xl p-8 text-center" style={{ background: p.innerSurface, border: p.dashedBorder }}>
      <div className="text-5xl mb-3" aria-hidden="true">⚔️</div>
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>No active battle</div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: p.mutedText }}>
        You need to be in a battle to place picks. Jump into a Quick Match, challenge a friend, or set up a private match — your picks will show up here in real time.
      </p>
      <Link href="/battle?openChooser=1" className="inline-block px-6 py-3 rounded-xl font-black text-base" style={{ background: '#2563eb', color: '#ffffff', boxShadow: p.hardShadow }}>
        Start a Battle
      </Link>
    </div>
  );

  const renderEmptyNoPicks = () => (
    <div className="rounded-2xl p-8 text-center" style={{ background: p.innerSurface, border: p.dashedBorder }}>
      <div className="text-5xl mb-3" aria-hidden="true">🎯</div>
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>No picks placed yet</div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: p.mutedText }}>
        Pick a side on any game from the Battle board, add it to your Pik Slip, and submit. Your picks will land here the moment they're placed.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-block px-5 py-3 rounded-xl font-black text-sm" style={{ background: '#2563eb', color: '#ffffff', boxShadow: p.hardShadow }}>
          Browse Games
        </Link>
        {(betSlip?.length || 0) > 0 && (
          <button type="button" onClick={openBetSlip} className="no-hover-effect inline-block px-5 py-3 rounded-xl font-black text-sm"
            style={{ background: '#fb923c', color: '#1a0a02', boxShadow: p.hardShadow, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
            Open Pik Slip ({betSlip.length})
          </button>
        )}
      </div>
    </div>
  );

  const renderNotLoggedIn = () => (
    <div className="rounded-2xl p-8 text-center" style={{ background: p.innerSurface, border: p.dashedBorder }}>
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>Sign in to see your picks</div>
      <p className="text-sm mb-5" style={{ color: p.mutedText }}>My Piks pulls from your active battle. Log in to start placing picks.</p>
      <Link href="/" className="inline-block px-5 py-3 rounded-xl font-black text-sm" style={{ background: '#2563eb', color: '#ffffff', boxShadow: p.hardShadow }}>Back Home</Link>
    </div>
  );

  // ===================== Live-odds tracker body (mobile inline) =====================
  const renderTrackingBody = (bet) => {
    const { gameId, homeTeam, awayTeam, isLive, isFinal, derivedLiveOdds } = getChartCtx(bet);
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.3)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#22d3ee' }}>Tracking your pick</span>
          </div>
          <div className="text-base font-black truncate" style={{ color: p.bodyText }}>{bet.selection || '—'}</div>
          <div className="text-[11px] truncate" style={{ color: p.mutedText }}>{awayTeam} @ {homeTeam}</div>
        </div>
        <OddsHistoryChart gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} liveOdds={derivedLiveOdds} commenceTime={bet.placedAt} isLive={isLive} isFinal={isFinal} />
        {gameId ? (
          <Link href={`/game/${encodeURIComponent(gameId)}`} prefetch className="block w-full text-center px-3 py-3 rounded-xl text-sm font-black uppercase tracking-wider"
            style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#ffffff', boxShadow: p.hardShadow }}>
            Open Game →
          </Link>
        ) : (
          <div className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed select-none"
            style={{ background: p.disabledGameBg, color: p.disabledGameText, border: p.disabledGameBorder }} title="Game summary not available for this pick">
            Game Unavailable
          </div>
        )}
      </div>
    );
  };

  // Mobile picks list (PiksBetCard rows + inline tracker under the tapped pick).
  const renderMobilePicksList = () => (
    <div className="space-y-3">
      {sortedBets.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.35)' }}>
          <span aria-hidden="true">👆</span><span>Tap any pick to track its live odds ↓</span>
        </div>
      )}
      {sortedBets.map((bet) => {
        const isSelected = bet.id === selectedBetId;
        return (
          <div key={bet.id} role="button" tabIndex={0} onClick={() => setSelectedBetId(bet.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBetId(bet.id); } }}
            className="relative rounded-2xl transition-all"
            style={{ outline: 'none', background: p.pickSurface, border: isSelected ? '2.5px solid #22d3ee' : `2.5px solid transparent`, boxShadow: p.hardShadow, borderRadius: 16, cursor: 'pointer' }}>
            <PiksBetCard bet={bet} compactHeader prominentHeader isBattleEnded={false} />
            {isSelected && (
              <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
                <div className="rounded-xl overflow-hidden" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}` }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.16), rgba(59,130,246,0.10))', borderBottom: `1px solid ${p.softBorder}` }}>
                    <span className="text-[10px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>Live Odds Tracker</span>
                    <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.45)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />Live
                    </span>
                  </div>
                  <div className="p-3">{renderTrackingBody(bet)}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  let mobileBody;
  if (sessionStatus === 'loading' || (isLoggedIn && loading && !matchup && sortedBets.length === 0)) {
    mobileBody = (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: p.skeletonSurface, border: `1px solid ${p.softBorder}` }} />)}
      </div>
    );
  } else if (!isLoggedIn) mobileBody = renderNotLoggedIn();
  else if (!hasActiveMatchup) mobileBody = renderEmptyNoMatchup();
  else if (sortedBets.length === 0) mobileBody = renderEmptyNoPicks();
  else mobileBody = renderMobilePicksList();

  // ===================== DESKTOP chrome =====================
  const renderSidebar = () => (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-30"
      style={{ width: SIDEBAR_W, background: p.chromeBg, borderRight: `1px solid ${p.chromeBorder}` }}>
      <div className="px-5 pt-6 pb-4">
        <img src="/pikslogotransparent.png" alt="Piks" className="h-9 w-auto object-contain" />
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/my-picks';
          const inner = (
            <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{
                color: active ? '#3b82f6' : p.navIdleText,
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
              }}>
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full" style={{ background: '#3b82f6' }} />}
              <NavIcon name={item.key} />
              <span>{item.label}</span>
            </div>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} prefetch={false}>{inner}</Link>
          ) : (
            <div key={item.key} className="cursor-default opacity-80" title="Coming soon">{inner}</div>
          );
        })}
      </nav>
      <div className="px-5 py-5" style={{ borderTop: `1px solid ${p.chromeBorder}` }}>
        <button type="button" onClick={toggleTheme} className="no-hover-effect inline-flex items-center gap-2 text-sm font-bold"
          style={{ color: p.navIdleText, background: 'transparent', cursor: 'pointer' }} aria-label="Toggle theme">
          <span aria-hidden="true">☀️</span>
          <span className="w-9 h-5 rounded-full relative" style={{ background: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.15)' }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ left: isLight ? 2 : 18, background: isLight ? '#fbbf24' : '#3b82f6' }} />
          </span>
          <span aria-hidden="true">🌙</span>
        </button>
      </div>
    </aside>
  );

  const renderTopBar = () => {
    const change = battleBalances.myLive - battleBalances.startingBalance;
    return (
      <header className="hidden lg:flex items-center gap-4 px-8 py-4 sticky top-0 z-20"
        style={{ background: p.chromeBg, borderBottom: `1px solid ${p.chromeBorder}` }}>
        <div className="flex-1 max-w-xl mx-auto w-full relative">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl w-full"
            style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.mutedText} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input type="text" placeholder="Search players, teams, games…" className="bg-transparent flex-1 text-sm outline-none" style={{ color: p.bodyText }} />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: p.faintText, border: `1px solid ${p.softBorder}` }}>⌘K</span>
          </div>
        </div>
        <button type="button" onClick={() => setHowOpen(true)} className="no-hover-effect inline-flex items-center gap-2 text-sm font-bold flex-shrink-0"
          style={{ color: p.mutedText, background: 'transparent', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
          How it works
        </button>
        {hasActiveMatchup && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)' }}>
              <Coin color="#34d399" />
              <div className="leading-tight">
                <div className="text-sm font-black" style={{ color: '#34d399' }}>{formatMoney(battleBalances.myLive, 0)}</div>
                <div className="text-[8px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Your Balance</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
              style={{ background: change < 0 ? 'rgba(248,113,113,0.12)' : 'rgba(251,146,60,0.12)', border: `1px solid ${change < 0 ? 'rgba(248,113,113,0.4)' : 'rgba(251,146,60,0.4)'}` }}>
              <div className="leading-tight">
                <div className="text-sm font-black" style={{ color: change < 0 ? '#f87171' : '#fb923c' }}>{change > 0 ? '+' : ''}{formatMoney(change, 0)}</div>
                <div className="text-[8px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Change</div>
              </div>
            </div>
          </>
        )}
        <Link href="/notifications" className="relative flex-shrink-0 p-2 rounded-lg" style={{ color: p.mutedText }} aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        </Link>
        <Link href="/messenger" className="flex-shrink-0 p-2 rounded-lg" style={{ color: p.mutedText }} aria-label="Messages">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7a8.38 8.38 0 0 1-.8-3.6A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>
        </Link>
        <Link href="/profile" className="flex-shrink-0" aria-label="Profile">
          <div className="rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
            <UserAvatar avatar={myProfile?.avatar} username={myProfile?.username || 'You'} size={34} />
          </div>
        </Link>
      </header>
    );
  };

  const renderHero = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const { myLive, oppLive, startingBalance } = battleBalances;
    const oppName = opponent?.username || 'Opponent';
    const hasOpponent = !!opponent;
    const myChange = myLive - startingBalance;
    const oppChange = oppLive - startingBalance;
    const sideChange = (d) => (
      <div className="text-xs font-black" style={{ color: d < 0 ? '#f87171' : d > 0 ? '#34d399' : '#9ca3af' }}>
        {d > 0 ? '+' : ''}{formatMoney(d, 0)} <span className="text-[9px] font-bold tracking-wider" style={{ color: '#64748b' }}>CHANGE</span>
      </div>
    );
    return (
      <div className="relative rounded-3xl overflow-hidden mb-4"
        style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        {/* Cinematic stadium backdrop */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#0b1730 0%,#0a0f1c 48%,#1c1108 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% -10%, rgba(96,165,250,0.22), transparent 60%)' }} />
        <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at 12% 0%, rgba(59,130,246,0.25), transparent 35%), radial-gradient(circle at 88% 0%, rgba(251,146,60,0.22), transparent 35%)' }} />
        <div className="absolute left-0 inset-y-0 w-1/2" style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.16), transparent)' }} />
        <div className="absolute right-0 inset-y-0 w-1/2" style={{ background: 'linear-gradient(270deg, rgba(234,88,12,0.16), transparent)' }} />

        <div className="relative flex items-center justify-between gap-3 px-6 py-7 sm:px-10 sm:py-9">
          {/* YOU */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="rounded-2xl p-[3px]" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 0 0 4px rgba(59,130,246,0.18), 0 8px 24px rgba(59,130,246,0.35)' }}>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0f1c' }}>
                <UserAvatar avatar={myProfile?.avatar} username={myProfile?.username || 'You'} size={76} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-black truncate" style={{ color: '#fff' }}>YOU</div>
              <div className="text-3xl font-black inline-flex items-center gap-1.5" style={{ color: '#fff' }}><Coin color="#60a5fa" />{formatMoney(myLive, 0)}</div>
              <div className="mt-0.5">{sideChange(myChange)}</div>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.5)' }}>YOU</div>
            </div>
          </div>

          {/* CENTER */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-black" style={{ background: 'rgba(248,113,113,0.15)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.45)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f87171' }} />Live Battle
            </div>
            <div className="text-5xl font-black tracking-tight" style={{ color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>VS</div>
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: '#64748b' }}>Time Left</div>
              <div className="text-xl font-black" style={{ color: '#fff' }}>{formatTimeRemaining(timeRemaining)}</div>
            </div>
          </div>

          {/* OPPONENT */}
          <div className="flex items-center gap-4 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <div className="text-2xl font-black truncate" style={{ color: '#fff' }}>{oppName}</div>
              <div className="text-3xl font-black inline-flex items-center gap-1.5 justify-end" style={{ color: '#fff' }}><Coin color="#fb923c" />{formatMoney(oppLive, 0)}</div>
              <div className="mt-0.5 flex justify-end">{sideChange(oppChange)}</div>
            </div>
            <div className="rounded-2xl p-[3px]" style={{ background: hasOpponent ? 'linear-gradient(135deg,#fbbf24,#ea580c)' : 'rgba(148,163,184,0.4)', boxShadow: '0 0 0 4px rgba(251,146,60,0.16), 0 8px 24px rgba(234,88,12,0.3)' }}>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0f1c' }}>
                <UserAvatar avatar={opponent?.avatar} username={oppName} size={76} />
              </div>
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="relative grid grid-cols-6 px-2" style={{ background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Open', node: <span style={{ color: '#60a5fa' }}>{counts.open}</span> },
            { label: 'Won', node: <span style={{ color: '#34d399' }}>{counts.won}</span> },
            { label: 'Lost', node: <span style={{ color: '#f87171' }}>{counts.lost}</span> },
            { label: 'At Risk', node: <span className="inline-flex items-center gap-1" style={{ color: '#fbbf24' }}><Coin color="#fbbf24" />{formatMoney(counts.totalStake, 0)}</span> },
            { label: 'To Win', node: <span className="inline-flex items-center gap-1" style={{ color: '#34d399' }}><Coin color="#34d399" />{formatMoney(Math.max(0, counts.potentialPayout - counts.totalStake), 0)}</span> },
            { label: 'Streak', node: <span style={{ color: '#9ca3af' }}>—</span> },
          ].map((s, i) => (
            <div key={s.label} className="text-center py-3.5" style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.06)' } : undefined}>
              <div className="text-lg font-black leading-none">{s.node}</div>
              <div className="text-[9px] uppercase tracking-widest font-bold mt-1.5" style={{ color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Desktop pick row (custom, matches mockup).
  const renderDesktopPickRow = (bet) => {
    const isSelected = bet.id === selectedBetId;
    const { gameId } = getChartCtx(bet);
    const isLive = !!(bet.isLive || bet.currentHomeScore != null);
    const placed = bet.placedAt ? new Date(bet.placedAt) : null;
    const placedStr = placed
      ? `${placed.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(placed.getDate()).padStart(2, '0')}, ${placed.getFullYear()} ${placed.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : '';
    const sportLabel = bet.sport || bet.sportName || '';
    const col = (label, node) => (
      <div className="hidden xl:block text-center px-3 min-w-[92px]">
        <div className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: p.faintText }}>{label}</div>
        <div className="text-sm font-black">{node}</div>
      </div>
    );
    return (
      <div key={bet.id} role="button" tabIndex={0} onClick={() => setSelectedBetId(bet.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBetId(bet.id); } }}
        className="relative flex items-stretch rounded-2xl overflow-hidden transition-all"
        style={{
          background: p.pickSurface,
          border: isSelected ? '1.5px solid rgba(34,211,238,0.7)' : `1px solid ${p.softBorder}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(34,211,238,0.18), 0 10px 24px rgba(0,0,0,0.3)' : p.hardShadow,
          cursor: 'pointer',
        }}>
        {/* Vertical TRACKING tab */}
        <div className="flex items-center justify-center" style={{ width: 26, background: isSelected ? 'rgba(34,211,238,0.14)' : 'transparent', borderRight: isSelected ? '1px solid rgba(34,211,238,0.4)' : `1px solid ${p.softBorder}` }}>
          {isSelected && (
            <span className="text-[8px] uppercase tracking-[0.25em] font-black" style={{ color: '#22d3ee', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Tracking</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
          <SelectionLogos selection={bet.selectionFull || bet.selection} bet={bet} size={36} sport={sportLabel} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black truncate" style={{ color: p.bodyText }}>{bet.selectionFull || bet.selection || '—'}</span>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-black" style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399', border: '1px solid rgba(52,211,153,0.45)' }}>
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#34d399' }} />Live
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#22d3ee' : p.faintText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 14l4-4 3 3 5-6" /></svg>
            </div>
            <div className="text-[11px] truncate" style={{ color: p.mutedText }}>
              {bet.matchup}{sportLabel ? ` · ${sportLabel}` : ''}
            </div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5 truncate" style={{ color: p.faintText }}>
              {placedStr && `Placed: ${placedStr}`}
            </div>
          </div>
        </div>

        {col('Odds', <span style={{ color: p.bodyText }}>{formatOdds(bet.odds)}</span>)}
        {col('Picked', <span className="inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin />{formatMoney(bet.stake, 2)}</span>)}
        {col('Potential Payout', <span className="inline-flex items-center gap-1" style={{ color: '#34d399' }}><Coin color="#34d399" />{formatMoney(betPayout(bet), 2)}</span>)}

        <div className="flex items-center pr-3 pl-1">
          {gameId ? (
            <Link href={`/game/${encodeURIComponent(gameId)}`} prefetch onClick={(e) => e.stopPropagation()}
              className="no-hover-effect flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: '#2563eb', color: '#fff' }} aria-label="Open game">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          ) : (
            <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: p.disabledGameBg, color: p.disabledGameText }} title="Game summary not available">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Desktop "Battle Insights" rail.
  const renderBattleInsights = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const bet = selectedBet;
    const sectionTitle = (
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: p.mutedText }}>Battle Insights</div>
      </div>
    );
    if (!bet) {
      return (
        <div className="rounded-2xl overflow-hidden" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
          {sectionTitle}
          <div className="px-5 pb-6 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">📈</div>
            <div className="text-sm font-bold mb-1" style={{ color: p.bodyText }}>Live odds tracker</div>
            <p className="text-xs" style={{ color: p.mutedText }}>Tap a pick to plot how its odds move in real time.</p>
          </div>
        </div>
      );
    }
    const { gameId, homeTeam, awayTeam, isLive, isFinal, derivedLiveOdds } = getChartCtx(bet);
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
        {sectionTitle}
        <div className="px-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34d399' }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#34d399' }}>Live Tracked Pick</span>
          </div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-base font-black truncate" style={{ color: p.bodyText }}>{bet.selectionFull || bet.selection}</div>
              <div className="text-[11px] truncate" style={{ color: p.mutedText }}>vs {homeTeam === (bet.selectionFull || bet.selection) ? awayTeam : homeTeam}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <SelectionLogos selection={awayTeam} bet={{ ...bet, selection: awayTeam }} size={26} sport={bet.sport || bet.sportName} />
              <span className="text-[10px] font-black" style={{ color: p.faintText }}>VS</span>
              <SelectionLogos selection={homeTeam} bet={{ ...bet, selection: homeTeam }} size={26} sport={bet.sport || bet.sportName} />
            </div>
          </div>
        </div>

        <div className="px-3">
          <OddsHistoryChart gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} liveOdds={derivedLiveOdds} commenceTime={bet.placedAt} isLive={isLive} isFinal={isFinal} />
        </div>

        {/* Pick summary card */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 rounded-xl overflow-hidden" style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}>
            <div className="text-center py-3 px-1">
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1" style={{ color: p.faintText }}>Total Picked</div>
              <div className="text-sm font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin />{formatMoney(bet.stake, 2)}</div>
            </div>
            <div className="text-center py-3 px-1" style={{ borderLeft: `1px solid ${p.softBorder}`, borderRight: `1px solid ${p.softBorder}` }}>
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1" style={{ color: p.faintText }}>Odds</div>
              <div className="text-sm font-black" style={{ color: p.bodyText }}>{formatOdds(bet.odds)}</div>
            </div>
            <div className="text-center py-3 px-1">
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1" style={{ color: p.faintText }}>Potential Payout</div>
              <div className="text-sm font-black inline-flex items-center gap-1" style={{ color: '#34d399' }}><Coin color="#34d399" />{formatMoney(betPayout(bet), 2)}</div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          {gameId ? (
            <Link href={`/game/${encodeURIComponent(gameId)}`} prefetch className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl text-sm font-black uppercase tracking-wider"
              style={{ background: '#2563eb', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,0.35)' }}>
              Open Game
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          ) : (
            <div className="w-full text-center px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-not-allowed"
              style={{ background: p.disabledGameBg, color: p.disabledGameText, border: p.disabledGameBorder }}>Game Unavailable</div>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopMain = () => {
    if (sessionStatus === 'loading' || (isLoggedIn && loading && !matchup && sortedBets.length === 0)) {
      return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: p.skeletonSurface, border: `1px solid ${p.softBorder}` }} />)}</div>;
    }
    if (!isLoggedIn) return renderNotLoggedIn();
    if (!hasActiveMatchup) return renderEmptyNoMatchup();
    return (
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {renderHero()}
          {sortedBets.length === 0 ? renderEmptyNoPicks() : (
            <>
              <div className="flex items-center justify-between mb-3 mt-5">
                <div className="text-base font-black" style={{ color: p.bodyText }}>
                  Your Active Picks <span style={{ color: p.faintText }}>({sortedBets.length})</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ color: p.mutedText, border: `1px solid ${p.softBorder}` }}>
                  Sort by: Recent
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="space-y-3">{sortedBets.map((bet) => renderDesktopPickRow(bet))}</div>
            </>
          )}
        </div>
        <aside className="w-[340px] flex-shrink-0 sticky top-24">{renderBattleInsights()}</aside>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>My Piks · Piks</title>
        <meta name="description" content="See every pick you've placed in your current battle." />
      </Head>
      <HowItWorksModal open={howOpen} onClose={() => setHowOpen(false)} />

      {/* ---------------- MOBILE / TABLET ---------------- */}
      <div className="lg:hidden min-h-screen" style={{ backgroundColor: p.pageBg }}>
        <TopNavbar />
        <div className="pt-3 sm:pt-4 px-4 sm:px-6 pb-24">
          {renderInlineBanner()}
          {sortedBets.length > 0 && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: p.mutedText }}>This Battle</div>
              {renderStatTilesMobile()}
            </div>
          )}
          {mobileBody}
        </div>
      </div>

      {/* ---------------- DESKTOP ---------------- */}
      <div className="hidden lg:block min-h-screen" style={{ backgroundColor: p.pageBg }}>
        {renderSidebar()}
        <div style={{ marginLeft: SIDEBAR_W }} className="min-h-screen flex flex-col">
          {renderTopBar()}
          <main className="flex-1 px-8 py-6">{renderDesktopMain()}</main>
        </div>
        {/* Desktop Pik Slip entry (TopNavbar is hidden here) */}
        {(betSlip?.length || 0) > 0 && (
          <button type="button" onClick={openBetSlip}
            className="no-hover-effect fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black"
            style={{ background: '#fb923c', color: '#1a0a02', boxShadow: '0 12px 30px rgba(251,146,60,0.4)', cursor: 'pointer' }}>
            <Coin color="#1a0a02" /> Pik Slip ({betSlip.length})
          </button>
        )}
      </div>
    </>
  );
}
