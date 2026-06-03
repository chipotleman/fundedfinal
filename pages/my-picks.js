import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import PiksBetCard from '../components/PiksBetCard';
import ForfeitModal from '../components/battle/ForfeitModal';
import UserAvatar from '../components/UserAvatar';
import OddsHistoryChart from '../components/game/OddsHistoryChart';
import { getTeamColor, inkFor } from '../utils/teamColors';
import TeamLogo, { SelectionLogos } from '../components/TeamLogo';
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
      pageBg: '#f5f1ea',
      chromeBg: '#ffffff',
      cardSurface: '#ffffff',
      innerSurface: '#f0ebe1',
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
      posGreen: '#059669',
    };
  }
  // Dark theme mirrors the dashboard (pages/index.js): pure-black page,
  // flat #0d0d0d cards with #1a1a1a hairline borders and NO drop shadows,
  // so My Piks reads as the same site — not a separate themed app.
  return {
    pageBg: '#000000',
    chromeBg: '#0d0d0d',
    cardSurface: '#0d0d0d',
    innerSurface: '#141414',
    pickSurface: '#0d0d0d',
    skeletonSurface: '#1a1a1a',
    chromeBorder: '#1a1a1a',
    softBorder: '#1a1a1a',
    dashedBorder: '2.5px dashed rgba(59,130,246,0.4)',
    hardShadow: 'none',
    bodyText: '#ffffff',
    mutedText: '#9ca3af',
    faintText: '#6b7280',
    navIdleText: '#cbd5e1',
    navHoverBg: 'rgba(255,255,255,0.05)',
    disabledGameBg: 'rgba(75,85,99,0.15)',
    disabledGameBorder: '1px solid rgba(75,85,99,0.3)',
    disabledGameText: '#6b7280',
    posGreen: '#34d399',
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

// Clash Coins glyph — the in-matchup currency (white ⚔). Every amount
// on this page lives inside a single battle, so they are all Clash Coins.
function Coin({ color = '#ffffff' }) {
  return <span style={{ color }} aria-hidden="true">⚔</span>;
}

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
    refresh: refreshMatchup,
  } = useMatchup();

  const { betSlip, setShowBetSlip } = useBetSlip();
  const { theme, toggleTheme } = useTheme();
  const { formatOdds } = useUserPreferences();
  const isLight = theme === 'light';
  const p = getPalette(isLight);

  const isLoggedIn = sessionStatus === 'authenticated';

  const [sortMode, setSortMode] = useState('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const sortOptions = useMemo(() => ([
    { id: 'recent', label: 'Recent' },
    { id: 'oldest', label: 'Oldest' },
    { id: 'payout', label: 'Potential payout' },
    { id: 'stake', label: 'Amount picked' },
    { id: 'odds', label: 'Odds' },
  ]), []);
  const sortLabel = sortOptions.find((o) => o.id === sortMode)?.label || 'Recent';

  const sortedBets = useMemo(() => {
    const arr = Array.isArray(myBets) ? myBets.slice() : [];
    const time = (x) => (x?.placedAt ? new Date(x.placedAt).getTime() : 0);
    const num = (x, k) => parseFloat(x?.[k] || 0) || 0;
    const payout = (x) => {
      const pp = parseFloat(x?.potentialPayout);
      if (Number.isFinite(pp) && pp > 0) return pp;
      return calculatePayout(x?.odds, x?.stake) || 0;
    };
    arr.sort((a, b) => {
      switch (sortMode) {
        case 'oldest': return time(a) - time(b);
        case 'payout': return payout(b) - payout(a);
        case 'stake': return num(b, 'stake') - num(a, 'stake');
        case 'odds': return num(b, 'odds') - num(a, 'odds');
        case 'recent':
        default: return time(b) - time(a);
      }
    });
    return arr.map(normalizeBet);
  }, [myBets, sortMode]);

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

  // The desktop ticket column always shows the currently-selected pick (the
  // first pick by default). Clicking a pick row just changes which ticket is
  // shown — it no longer swaps the whole hero out for the ticket.
  const openTicket = (id) => { setSelectedBetId(id); };

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

  // ---- Forfeit (surrender the active battle) ----
  const [showForfeit, setShowForfeit] = useState(false);
  // Mobile "match progress" flip card — collapsed by default so the picks list
  // leads. flipNonce re-triggers the flip animation on each toggle.
  const [progressOpen, setProgressOpen] = useState(false);
  const [flipNonce, setFlipNonce] = useState(0);
  const toggleProgress = () => { setProgressOpen((o) => !o); setFlipNonce((n) => n + 1); };
  const handleForfeit = async () => {
    try {
      const res = await fetch('/api/battles/forfeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchupId: matchup?.id }),
      });
      if (res.ok) {
        setShowForfeit(false);
        try { await refreshMatchup?.(); } catch (_e) {}
      }
    } catch (_e) {}
  };

  // Understated, theme-aware forfeit control. Lives inside the active-battle
  // hero/banner so it reads as a battle action without competing with the
  // primary "place picks" flow. Opens the double-confirm ForfeitModal.
  const renderForfeitBar = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderTop: `1px solid ${p.softBorder}`, background: isLight ? 'rgba(15,23,42,0.025)' : 'rgba(0,0,0,0.25)' }}>
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Done battling?</span>
        <button type="button" onClick={() => setShowForfeit(true)}
          className="no-hover-effect inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider"
          style={{
            color: isLight ? '#dc2626' : '#f87171',
            background: isLight ? 'rgba(220,38,38,0.07)' : 'rgba(248,113,113,0.10)',
            border: `1px solid ${isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.30)'}`,
            cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          }}>
          <span aria-hidden="true">🏳️</span> Forfeit
        </button>
      </div>
    );
  };

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
        <div className="rounded-full p-[3px]" style={{ background: p.softBorder }}>
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

  const renderBalanceDuel = ({ showBar = true } = {}) => {
    if (!matchup || !hasActiveMatchup) return null;
    const { startingBalance, myLive, oppLive } = battleBalances;
    const oppName = opponent?.username || 'Opponent';
    const total = Math.max(1, myLive + oppLive);
    const myPct = Math.max(8, Math.min(92, (myLive / total) * 100));
    const delta = (d) => {
      if (!d) return <span className="text-[11px] font-bold" style={{ color: p.mutedText }}>even</span>;
      const up = d > 0;
      return <span className="text-[11px] font-black" style={{ color: up ? p.posGreen : (isLight ? '#dc2626' : '#f87171') }}>{up ? '+' : ''}{formatMoney(d, 0)}</span>;
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
            <div className="text-xl font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin color={isLight ? '#0f172a' : '#ffffff'} />{formatMoney(oppLive, 0)}</div>
            <div className="text-right">{delta(oppLive - startingBalance)}</div>
          </div>
        </div>
        {showBar && (
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(251,146,60,0.3)', border: `1px solid ${p.softBorder}` }}>
            <div className="absolute inset-y-0 left-0 transition-all duration-500" style={{ width: `${myPct}%`, background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }} />
          </div>
        )}
        <div className="mt-1 text-[9px] uppercase tracking-wider font-bold text-center" style={{ color: p.faintText }}>Clash Coins · this battle</div>
      </div>
    );
  };

  // Mobile active-battle card. Collapsed it's a slim "Active Battle · time"
  // strip with a "Show match progress" button; tapping flips it to a clean
  // progress view (VS + live balances, no progress bar) with an Apple-styled
  // forfeit button. Replaces the old always-on hero + stat-tiles grid.
  const renderMobileBattleCard = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div className="mb-5" style={{ perspective: '1400px' }}>
        <div
          key={flipNonce}
          className="mp-flip rounded-2xl overflow-hidden"
          style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}
        >
          {progressOpen ? (
            <>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.18), rgba(251,146,60,0.12))', borderBottom: `1px solid ${p.softBorder}` }}>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-black" style={{ color: p.bodyText }}>
                  <span className="text-sm" aria-hidden="true">⏱️</span>{formatTimeRemaining(timeRemaining)}
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.faintText }}>left</span>
                </span>
                <button type="button" onClick={toggleProgress}
                  className="no-hover-effect inline-flex items-center gap-1 text-[12px] font-semibold rounded-full px-3 py-1.5"
                  style={{ color: p.mutedText, background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.07)', letterSpacing: '-0.01em', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
                  Hide
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                </button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {renderVsRow()}
                <div className="pt-3" style={{ borderTop: `1px solid ${p.softBorder}` }}>{renderBalanceDuel({ showBar: false })}</div>
                <button type="button" onClick={() => setShowForfeit(true)}
                  className="no-hover-effect w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98]"
                  style={{ color: '#ff453a', background: isLight ? 'rgba(255,69,58,0.10)' : 'rgba(255,69,58,0.16)', letterSpacing: '-0.01em', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
                  Forfeit Battle
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>Active Battle</div>
                <div className="inline-flex items-center gap-1.5 text-lg font-black" style={{ color: p.bodyText }}>
                  <span className="text-sm" aria-hidden="true">⏱️</span>{formatTimeRemaining(timeRemaining)}
                </div>
              </div>
              <button type="button" onClick={toggleProgress}
                className="no-hover-effect inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold flex-shrink-0 transition-transform active:scale-[0.97]"
                style={{ color: '#fff', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', letterSpacing: '-0.01em', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
                Show match progress
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          )}
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
      <div className="space-y-2.5">
        <div className="min-w-0">
          <div className="text-sm font-black truncate" style={{ color: p.bodyText }}>{bet.selection || '—'}</div>
          <div className="text-[10px] truncate" style={{ color: p.mutedText }}>{awayTeam} @ {homeTeam}</div>
        </div>
        <OddsHistoryChart gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} liveOdds={derivedLiveOdds} commenceTime={bet.placedAt} isLive={isLive} isFinal={isFinal} compact />
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


  // Always-on ticket/receipt for the selected pick, shown in its own desktop
  // column. Premium, theme-aware, screenshot-friendly (mirrors the share card).
  const renderTicket = (bet) => {
    const { gameId, homeTeam, awayTeam, isLive: ctxLive } = getChartCtx(bet);
    const status = bet.status || 'open';
    const statusMeta = ({
      won: { label: 'WON', color: p.posGreen },
      lost: { label: 'LOST', color: isLight ? '#dc2626' : '#f87171' },
      cashed_out: { label: 'CASHED OUT', color: '#e9762b' },
      open: { label: 'OPEN', color: isLight ? '#2563eb' : '#60a5fa' },
    })[status] || { label: String(status).toUpperCase(), color: p.mutedText };
    const isLive = !!(bet.isLive || ctxLive);
    const homeScore = bet.homeScore ?? bet.currentHomeScore;
    const awayScore = bet.awayScore ?? bet.currentAwayScore;
    const hasScores = homeScore != null && awayScore != null;
    const isParlay = Array.isArray(bet.legs) && bet.legs.length > 1;
    const placed = bet.placedAt ? new Date(bet.placedAt) : null;
    const placedStr = placed
      ? `${placed.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(placed.getDate()).padStart(2, '0')}, ${placed.getFullYear()} ${placed.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : '';
    const gameTime = bet.gameStart
      ? new Date(bet.gameStart).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
      : (bet.gameTime || null);
    const pikId = (() => {
      const raw = String(bet.id ?? '');
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 6) return digits.slice(-12);
      let h = 0; for (let i = 0; i < raw.length; i++) { h = (h * 31 + raw.charCodeAt(i)) >>> 0; }
      return String(100000000 + (h % 900000000));
    })();
    const ticketBg = isLight ? '#ffffff' : '#0b1119';
    const divider = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)';
    const coinColor = isLight ? '#0f172a' : '#ffffff';
    const scoreRow = (team, score) => (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo name={team} sport={bet.sport || bet.sportName} size={26} />
          <span className="text-sm font-semibold truncate" style={{ color: p.bodyText }}>{team}</span>
        </div>
        <span className="text-sm font-black flex-shrink-0 ml-2" style={{ color: p.bodyText }}>{score}</span>
      </div>
    );
    return (
      <div className="relative rounded-3xl overflow-hidden mb-4"
        style={{ border: `1px solid ${p.softBorder}`, background: isLight ? 'linear-gradient(180deg,#eef1f7,#e2e7f0)' : 'linear-gradient(180deg,#10141d,#0a0d13)', boxShadow: p.hardShadow }}>
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: p.mutedText }}>Your Ticket</span>
        </div>
        <div className="px-5 pb-6 pt-3 mp-ticket-logos">
          <div className="rounded-2xl overflow-hidden" style={{ background: ticketBg, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
            <div className="px-5 pt-4 pb-4">
              {/* Header: logo + status */}
              <div className="flex items-center justify-between mb-1">
                <img src="/pikslogotransparent.png" alt="Piks" className="h-16 object-contain" style={{ filter: isLight ? 'brightness(0)' : 'none' }} />
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ color: statusMeta.color, background: `${statusMeta.color}1f`, border: `1px solid ${statusMeta.color}59` }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status === 'open' ? 'animate-pulse' : ''}`} style={{ background: statusMeta.color }} />
                  {statusMeta.label}
                </span>
              </div>

              {/* Selection + odds */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5"><SelectionLogos selection={bet.selectionFull || bet.selection} bet={bet} size={30} sport={bet.sport || bet.sportName} /></div>
                  <div className="min-w-0">
                    <div className="text-base font-black truncate" style={{ color: p.bodyText }}>{isParlay ? `${bet.legs.length} Leg Parlay` : (bet.selectionFull || bet.selection || '—')}</div>
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: p.mutedText }}>{isParlay ? 'Parlay' : (bet.betType || 'Moneyline')}</div>
                  </div>
                </div>
                <div className="text-xl font-black flex-shrink-0" style={{ color: p.bodyText }}>{formatOdds(bet.odds)}</div>
              </div>

              {/* Game block */}
              <div className="mt-3 space-y-1.5">
                {isParlay ? (
                  bet.legs.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <SelectionLogos selection={leg.selection} bet={leg} size={16} sport={leg.sport || leg.sportName} />
                        <span className="text-xs font-semibold truncate" style={{ color: p.bodyText }}>{leg.selection}</span>
                      </div>
                      <span className="text-xs font-black flex-shrink-0" style={{ color: isLight ? '#2563eb' : '#60a5fa' }}>{formatOdds(leg.odds)}</span>
                    </div>
                  ))
                ) : (
                  <>
                    {(isLive || hasScores) && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#ef4444' }}>Live</span>
                        {gameTime && <span className="text-[11px]" style={{ color: p.mutedText }}>{gameTime} ET</span>}
                      </div>
                    )}
                    {hasScores ? (
                      <>
                        {scoreRow(awayTeam, awayScore)}
                        {scoreRow(homeTeam, homeScore)}
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold truncate" style={{ color: p.bodyText }}>{bet.matchup || `${awayTeam} @ ${homeTeam}`}</span>
                        {gameTime && <span className="text-[11px] flex-shrink-0 ml-2" style={{ color: p.mutedText }}>{gameTime}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Totals */}
              <div className="mt-3 pt-3 flex items-end justify-between" style={{ borderTop: `1px solid ${divider}` }}>
                <div>
                  <div className="text-lg font-black inline-flex items-center gap-1.5" style={{ color: p.bodyText }}><Coin color={coinColor} />{formatMoney(bet.stake, 2)}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Total Pikked</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black inline-flex items-center gap-1.5" style={{ color: p.posGreen }}><Coin color={p.posGreen} />{formatMoney(betPayout(bet), 2)}</div>
                  <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Potential Payout</div>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${divider}` }}>
                <span className="text-[10px] font-mono" style={{ color: p.faintText }}>PIK ID: {pikId}</span>
                {placedStr && <span className="text-[10px]" style={{ color: p.faintText }}>PLACED: {placedStr}</span>}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Desktop pick row (custom, matches mockup).
  const renderDesktopPickRow = (bet) => {
    const isSelected = bet.id === selectedBetId;
    const { gameId, homeTeam } = getChartCtx(bet);
    const rowHomeColor = getTeamColor(homeTeam, bet.sport || bet.sportName) || '#2563eb';
    const isLive = !!(bet.isLive || bet.currentHomeScore != null);
    const placed = bet.placedAt ? new Date(bet.placedAt) : null;
    const placedStr = placed
      ? `${placed.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(placed.getDate()).padStart(2, '0')}, ${placed.getFullYear()} ${placed.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : '';
    const sportLabel = bet.sport || bet.sportName || '';
    const col = (label, node) => (
      <div className="hidden xl:flex flex-col items-center justify-center text-center px-3 min-w-[92px]">
        <div className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: p.faintText }}>{label}</div>
        <div className="text-sm font-black">{node}</div>
      </div>
    );
    return (
      <div key={bet.id} role="button" tabIndex={0} onClick={() => openTicket(bet.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTicket(bet.id); } }}
        className="relative flex items-stretch rounded-2xl overflow-hidden transition-all"
        style={{
          background: p.pickSurface,
          border: isSelected ? '1.5px solid rgba(34,211,238,0.7)' : `1px solid ${p.softBorder}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(34,211,238,0.18), 0 10px 24px rgba(0,0,0,0.3)' : p.hardShadow,
          cursor: 'pointer',
        }}>
        {/* Vertical TRACKING tab */}
        <div className="flex items-center justify-center" style={{ width: 20, background: isSelected ? 'rgba(34,211,238,0.14)' : 'transparent', borderRight: isSelected ? '1px solid rgba(34,211,238,0.4)' : `1px solid ${p.softBorder}` }}>
          {isSelected && (
            <span className="text-[7px] uppercase tracking-[0.08em] font-black" style={{ color: '#22d3ee', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Tracking</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
          <SelectionLogos selection={bet.selectionFull || bet.selection} bet={bet} size={36} sport={sportLabel} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black truncate" style={{ color: p.bodyText }}>{bet.selectionFull || bet.selection || '—'}</span>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-black" style={{ background: 'rgba(52,211,153,0.18)', color: p.posGreen, border: '1px solid rgba(52,211,153,0.45)' }}>
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: p.posGreen }} />Live
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
        {col('Picked', <span className="inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin color={isLight ? '#0f172a' : '#ffffff'} />{formatMoney(bet.stake, 2)}</span>)}
        {col('Potential Payout', <span className="inline-flex items-center gap-1" style={{ color: p.posGreen }}><Coin color={p.posGreen} />{formatMoney(betPayout(bet), 2)}</span>)}

        <div className="flex items-center pr-3 pl-1">
          {gameId ? (
            <Link href={`/game/${encodeURIComponent(gameId)}?from=${encodeURIComponent('/my-picks')}`} prefetch onClick={(e) => e.stopPropagation()}
              className="no-hover-effect flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: rowHomeColor, color: inkFor(rowHomeColor) }} aria-label="Open game">
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
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: p.posGreen }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.posGreen }}>Live Tracked Pick</span>
          </div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-base font-black truncate" style={{ color: p.bodyText }}>{bet.selectionFull || bet.selection}</div>
              <div className="text-[11px] truncate" style={{ color: p.mutedText }}>vs {homeTeam === (bet.selectionFull || bet.selection) ? awayTeam : homeTeam}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <SelectionLogos selection={awayTeam} bet={{ ...bet, legs: undefined, selection: awayTeam, awayTeam, homeTeam, awayTeamFull: awayTeam, homeTeamFull: homeTeam }} size={26} sport={bet.sport || bet.sportName} />
              <span className="text-[10px] font-black" style={{ color: p.faintText }}>VS</span>
              <SelectionLogos selection={homeTeam} bet={{ ...bet, legs: undefined, selection: homeTeam, awayTeam, homeTeam, awayTeamFull: awayTeam, homeTeamFull: homeTeam }} size={26} sport={bet.sport || bet.sportName} />
            </div>
          </div>
        </div>

        <div className="px-3">
          <OddsHistoryChart gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} liveOdds={derivedLiveOdds} commenceTime={bet.placedAt} isLive={isLive} isFinal={isFinal} />
        </div>

        {/* Pick summary card */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 rounded-xl overflow-hidden" style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}>
            <div className="flex flex-col items-center justify-center text-center py-3 px-1">
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1 leading-tight min-h-[20px] flex items-center justify-center" style={{ color: p.faintText }}>Total Picked</div>
              <div className="text-sm font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}><Coin color={isLight ? '#0f172a' : '#ffffff'} />{formatMoney(bet.stake, 2)}</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center py-3 px-1" style={{ borderLeft: `1px solid ${p.softBorder}`, borderRight: `1px solid ${p.softBorder}` }}>
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1 leading-tight min-h-[20px] flex items-center justify-center" style={{ color: p.faintText }}>Odds</div>
              <div className="text-sm font-black" style={{ color: p.bodyText }}>{formatOdds(bet.odds)}</div>
            </div>
            <div className="flex flex-col items-center justify-center text-center py-3 px-1">
              <div className="text-[8px] uppercase tracking-wider font-bold mb-1 leading-tight min-h-[20px] flex items-center justify-center" style={{ color: p.faintText }}>Potential Payout</div>
              <div className="text-sm font-black inline-flex items-center gap-1" style={{ color: p.posGreen }}><Coin color={p.posGreen} />{formatMoney(betPayout(bet), 2)}</div>
            </div>
          </div>
        </div>

        {renderForfeitBar()}
      </div>
    );
  };

  // Compact battle-status panel ("Match Updates") shown on desktop in its own
  // column to the LEFT of the always-on ticket. A vertical, narrow-column
  // friendly version of the wide hero — YOU vs OPP balances, time left and a
  // condensed stat strip — so the ticket gets dedicated space beside it.
  const renderMatchUpdates = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const { myLive, oppLive, startingBalance } = battleBalances;
    const oppName = opponent?.username || 'Opponent';
    const myChange = myLive - startingBalance;
    const oppChange = oppLive - startingBalance;
    const text = isLight ? '#0f172a' : '#ffffff';
    const faint = isLight ? '#64748b' : '#94a3b8';
    const youCoin = isLight ? '#2563eb' : '#60a5fa';
    const oppCoin = isLight ? '#0f172a' : '#ffffff';
    const surface = isLight ? 'linear-gradient(180deg,#ffffff,#eef1f7)' : 'linear-gradient(180deg,#10141d,#0a0d13)';
    const rowBg = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.03)';
    const changeColor = (d) => (d < 0 ? (isLight ? '#dc2626' : '#f87171') : d > 0 ? p.posGreen : faint);
    const sideRow = ({ name, balance, change, coin, avatar, isYou }) => (
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl" style={{ background: rowBg, border: `1px solid ${p.softBorder}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-full p-[2px] flex-shrink-0" style={{ background: p.softBorder }}>
            <div className="rounded-full overflow-hidden" style={{ background: isLight ? '#ffffff' : '#0a0f1c' }}>
              <UserAvatar avatar={avatar} username={name} size={46} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black truncate" style={{ color: text }}>{name}</div>
            {isYou && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black mt-0.5" style={{ background: 'rgba(59,130,246,0.16)', color: youCoin, border: '1px solid rgba(59,130,246,0.45)' }}>YOU</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-black inline-flex items-center gap-1 justify-end" style={{ color: text }}><Coin color={coin} />{formatMoney(balance, 0)}</div>
          <div className="text-[10px] font-black" style={{ color: changeColor(change) }}>{change > 0 ? '+' : ''}{formatMoney(change, 0)} <span className="text-[8px] font-bold tracking-wider" style={{ color: faint }}>CHG</span></div>
        </div>
      </div>
    );
    return (
      <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${p.softBorder}`, background: surface, boxShadow: p.hardShadow }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: p.mutedText }}>Match Updates</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-black" style={{ background: 'rgba(239,68,68,0.14)', color: isLight ? '#dc2626' : '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />Live Battle
          </span>
        </div>
        <div className="px-4 pb-4 pt-2 space-y-2.5">
          {sideRow({ name: 'YOU', balance: myLive, change: myChange, coin: youCoin, avatar: myProfile?.avatar, isYou: true })}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: p.softBorder }} />
            <div className="flex flex-col items-center leading-none">
              <span className="text-base font-black" style={{ color: text }}>VS</span>
              <span className="text-[8px] uppercase tracking-widest font-bold mt-1" style={{ color: faint }}>{formatTimeRemaining(timeRemaining)} left</span>
            </div>
            <div className="flex-1 h-px" style={{ background: p.softBorder }} />
          </div>
          {sideRow({ name: oppName, balance: oppLive, change: oppChange, coin: oppCoin, avatar: opponent?.avatar })}
        </div>
        <div className="grid grid-cols-5" style={{ background: isLight ? 'rgba(15,23,42,0.025)' : 'rgba(0,0,0,0.35)', borderTop: `1px solid ${p.softBorder}` }}>
          {[
            { label: 'Open', node: <span style={{ color: youCoin }}>{counts.open}</span> },
            { label: 'Won', node: <span style={{ color: p.posGreen }}>{counts.won}</span> },
            { label: 'Lost', node: <span style={{ color: isLight ? '#dc2626' : '#f87171' }}>{counts.lost}</span> },
            { label: 'At Risk', node: <span className="inline-flex items-center gap-0.5" style={{ color: text }}><Coin color={oppCoin} />{formatMoney(counts.totalStake, 0)}</span> },
            { label: 'To Win', node: <span className="inline-flex items-center gap-0.5" style={{ color: p.posGreen }}><Coin color={p.posGreen} />{formatMoney(Math.max(0, counts.potentialPayout - counts.totalStake), 0)}</span> },
          ].map((s, i) => (
            <div key={s.label} className="text-center py-3 px-0.5" style={i > 0 ? { borderLeft: `1px solid ${p.softBorder}` } : undefined}>
              <div className="text-sm font-black leading-none">{s.node}</div>
              <div className="text-[8px] uppercase tracking-wider font-bold mt-1.5" style={{ color: faint }}>{s.label}</div>
            </div>
          ))}
        </div>
        {renderForfeitBar()}
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
          {sortedBets.length === 0 ? (
            <>
              {renderMatchUpdates()}
              <div className="mt-5">{renderEmptyNoPicks()}</div>
            </>
          ) : (
            <>
              <div className="flex gap-5 items-start mb-1">
                <div className="flex-1 min-w-0">{renderMatchUpdates()}</div>
                <div className="w-[390px] flex-shrink-0">{selectedBet ? renderTicket(selectedBet) : null}</div>
              </div>
              <div className="flex items-center justify-between mb-3 mt-5">
                <div className="text-base font-black" style={{ color: p.bodyText }}>
                  Your Active Piks <span style={{ color: p.faintText }}>({sortedBets.length})</span>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSortOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: p.mutedText, border: `1px solid ${p.softBorder}`, background: 'transparent' }}
                  >
                    Sort by: {sortLabel}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 mt-1.5 z-20 rounded-xl overflow-hidden py-1 min-w-[180px]" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: '0 12px 28px rgba(0,0,0,0.22)' }}>
                        {sortOptions.map((o) => {
                          const active = o.id === sortMode;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => { setSortMode(o.id); setSortOpen(false); }}
                              className="w-full text-left text-xs font-bold px-3 py-2 flex items-center justify-between transition-colors"
                              style={{ color: active ? (isLight ? '#2563eb' : '#60a5fa') : p.bodyText, background: active ? (isLight ? 'rgba(37,99,235,0.08)' : 'rgba(96,165,250,0.12)') : 'transparent' }}
                            >
                              {o.label}
                              {active && (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
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
      {/* ---------------- MOBILE / TABLET ---------------- */}
      <div className="lg:hidden min-h-screen" style={{ backgroundColor: p.pageBg }}>
        <TopNavbar />
        <div className="pt-3 sm:pt-4 px-4 sm:px-6 pb-24">
          <style>{`
            @keyframes mpFlip {
              from { transform: rotateY(-90deg); opacity: 0; }
              to   { transform: rotateY(0deg); opacity: 1; }
            }
            .mp-flip { animation: mpFlip 0.4s cubic-bezier(0.22,1,0.36,1); transform-origin: center; backface-visibility: hidden; }
          `}</style>
          {renderMobileBattleCard()}
          {mobileBody}
        </div>
      </div>

      {/* ---------------- DESKTOP ---------------- */}
      <div className="hidden lg:block min-h-screen" style={{ backgroundColor: p.pageBg }}>
        <TopNavbar />
        <main className="max-w-7xl mx-auto px-6 xl:px-8 py-6">{renderDesktopMain()}</main>
      </div>

      <ForfeitModal
        isOpen={showForfeit && !!matchup}
        matchup={matchup}
        onCancel={() => setShowForfeit(false)}
        onConfirm={handleForfeit}
      />
    </>
  );
}
