import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import PiksBetCard from '../components/PiksBetCard';
import UserAvatar from '../components/UserAvatar';
import OddsHistoryChart from '../components/game/OddsHistoryChart';
import { useMatchup } from '../contexts/MatchupContext';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney } from '../utils/formatMoney';

// Theme-aware palette. The page was authored dark-first with
// hardcoded #000 / rgba navy / #fff / #9ca3af / etc. baked into
// inline styles — those bypass globals.css overrides, which is
// why light mode looked broken (white nav over black page,
// dark picks panels floating on cream, invisible labels). We
// flip every surface/text token through this palette instead.
function getPalette(isLight) {
  if (isLight) {
    return {
      pageBg: '#f8fafc',
      // Solid card surface (was navy gradient on dark).
      cardSurface: '#ffffff',
      // Subtle inset surface (was rgba(15,23,42,0.6)).
      innerSurface: '#f1f5f9',
      // Pick card body (was #0a0a0a).
      pickSurface: '#ffffff',
      // Skeleton block.
      skeletonSurface: 'rgba(148,163,184,0.25)',
      // Cartoon border stays black — looks identical on white.
      cartoonBorder: '#0d0d0d',
      // Soft 1px border for inner surfaces.
      softBorder: 'rgba(15,23,42,0.10)',
      // Dashed empty-state border.
      dashedBorder: '2.5px dashed rgba(37,99,235,0.45)',
      // Hard cartoon shadow — lighter on white so it doesn't bruise.
      hardShadow: '0 4px 0 rgba(15,23,42,0.18)',
      pickShadow: '0 4px 0 rgba(15,23,42,0.18)',
      pickShadowSelected: '0 0 0 3px rgba(34,211,238,0.35), 0 4px 0 rgba(15,23,42,0.18)',
      vsText: '#0f172a',
      bodyText: '#0f172a',
      mutedText: '#64748b',
      hintBg: 'rgba(34,211,238,0.12)',
      hintBorder: '1px solid rgba(34,211,238,0.45)',
      hintText: '#0891b2',
      openGameBg: 'rgba(59,130,246,0.12)',
      openGameBorder: '1px solid rgba(59,130,246,0.45)',
      openGameText: '#1d4ed8',
      disabledGameBg: 'rgba(148,163,184,0.18)',
      disabledGameBorder: '1px solid rgba(148,163,184,0.4)',
      disabledGameText: '#64748b',
      divider: 'border-slate-900/10',
    };
  }
  return {
    pageBg: '#000000',
    cardSurface: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(8,12,24,0.95) 100%)',
    innerSurface: 'rgba(15,23,42,0.6)',
    pickSurface: '#0a0a0a',
    skeletonSurface: 'rgba(15,23,42,0.55)',
    cartoonBorder: '#0d0d0d',
    softBorder: 'rgba(255,255,255,0.08)',
    dashedBorder: '2.5px dashed rgba(59,130,246,0.4)',
    hardShadow: '0 4px 0 rgba(0,0,0,0.55)',
    pickShadow: '0 4px 0 rgba(0,0,0,0.55)',
    pickShadowSelected: '0 0 0 3px rgba(34,211,238,0.25), 0 4px 0 rgba(0,0,0,0.55)',
    vsText: '#ffffff',
    bodyText: '#ffffff',
    mutedText: '#9ca3af',
    hintBg: 'rgba(34,211,238,0.08)',
    hintBorder: '1px solid rgba(34,211,238,0.35)',
    hintText: '#67e8f9',
    openGameBg: 'rgba(59,130,246,0.15)',
    openGameBorder: '1px solid rgba(59,130,246,0.4)',
    openGameText: '#93c5fd',
    disabledGameBg: 'rgba(75,85,99,0.15)',
    disabledGameBorder: '1px solid rgba(75,85,99,0.3)',
    disabledGameText: '#6b7280',
    divider: 'border-white/10',
  };
}

// Normalize a raw user_bets / fake_opponent_bets row into the shape
// PiksBetCard expects. The DB column defaults to 'pending' for ungraded
// bets, but PiksBetCard's `isOpen` branch checks 'open' (the rest of
// the app — BattleHistoryTable, BetSlip, BetReceipt — uses 'open' as
// the in-flight status). Mapping happens here so the rest of the app
// stays untouched.
function normalizeBet(bet) {
  if (!bet) return bet;
  if (bet.status === 'pending') {
    return { ...bet, status: 'open' };
  }
  return bet;
}

// Format the remaining battle time — same vocabulary used on the
// dashboard hero card.
function formatTimeRemaining(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  // Once the pick deadline (midnight ET for day battles) has passed,
  // the matchup stays active until the last picked game grades —
  // surface that state explicitly instead of an em-dash.
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

  // Both players' live balances are now shown side-by-side in the
  // balance duel (renderBalanceDuel), so the old tap-to-flip single
  // balance view (and its hidden state) was removed.
  const { betSlip, setShowBetSlip } = useBetSlip();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const p = getPalette(isLight);

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

  // Track which pick the user has highlighted on desktop — that pick's
  // game drives the right-rail live-odds chart. Default to the most
  // recent pick once data lands.
  const [selectedBetId, setSelectedBetId] = useState(null);
  useEffect(() => {
    if (sortedBets.length === 0) {
      setSelectedBetId(null);
      return;
    }
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
        open += 1;
        totalStake += stake;
        potentialPayout += payout;
      } else if (b.status === 'won') won += 1;
      else if (b.status === 'lost') lost += 1;
      else if (b.status === 'cashed_out') cashedOut += 1;
    }
    return { open, won, lost, cashedOut, totalStake, potentialPayout };
  }, [sortedBets]);

  // Both players' live balances, resolved through the same fallback
  // chain the top-nav coin pill uses so the figures never diverge. We
  // use the SETTLED balances (myBalance / opponentBalance) first.
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

  const openBetSlip = () => {
    try { setShowBetSlip(true); } catch (_e) {}
  };

  // -------- Sub-renderers --------

  // Header intentionally omitted: the top-nav already shows the
  // active "My Piks" tab underline, so repeating the page title +
  // subtitle here was just redundant chrome. The renderer is kept
  // as a no-op so call sites elsewhere in the file don't need to
  // change.
  const renderHeader = () => null;

  // VS hero — both fighters facing off with gradient avatar rings and
  // colored name chips (blue = you, orange = opponent). Used stacked in
  // the desktop battle-HQ rail and inside the mobile banner.
  const renderVsRow = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const oppName = opponent?.username || 'Opponent';
    const hasOpponent = !!opponent;
    const fighter = (avatar, name, color, gradient, ringRgba, isMe) => (
      <div className="flex flex-col items-center gap-2 min-w-0">
        <div className="rounded-full p-[3px]" style={{ background: gradient, boxShadow: `0 0 0 3px ${ringRgba}` }}>
          <UserAvatar avatar={avatar} username={name} size={60} />
        </div>
        <div
          className="text-[11px] font-black px-2.5 py-0.5 rounded-full truncate max-w-[104px] text-center"
          style={{ color: '#fff', background: `${color}29`, border: `1px solid ${color}80` }}
        >
          {isMe ? 'You' : name}
        </div>
      </div>
    );
    return (
      <div className="flex items-center justify-center gap-3">
        {fighter(myProfile?.avatar, myProfile?.username || 'You', '#3b82f6', 'linear-gradient(135deg,#3b82f6,#1d4ed8)', 'rgba(59,130,246,0.25)', true)}
        <div
          className="text-sm font-black px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{
            color: '#fff',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(251,146,60,0.3))',
            border: `1.5px solid ${p.softBorder}`,
            boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
          }}
        >
          VS
        </div>
        {fighter(opponent?.avatar, oppName, '#fb923c', hasOpponent ? 'linear-gradient(135deg,#fb923c,#ea580c)' : 'rgba(148,163,184,0.4)', 'rgba(251,146,60,0.25)', false)}
      </div>
    );
  };

  // Head-to-head live balance duel — both balances shown at once over a
  // single proportional bar (blue = you, orange = opponent) so it reads
  // as "who's winning" at a glance.
  const renderBalanceDuel = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const { startingBalance, myLive, oppLive } = battleBalances;
    const oppName = opponent?.username || 'Opponent';
    const total = Math.max(1, myLive + oppLive);
    const myPct = Math.max(8, Math.min(92, (myLive / total) * 100));
    const delta = (d) => {
      if (!d) return <span className="text-[11px] font-bold" style={{ color: p.mutedText }}>even</span>;
      const up = d > 0;
      return (
        <span className="text-[11px] font-black" style={{ color: up ? '#34d399' : '#f87171' }}>
          {up ? '+' : ''}{formatMoney(d, 0)}
        </span>
      );
    };
    return (
      <div>
        <div className="flex items-end justify-between gap-2 mb-2">
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#3b82f6' }}>You</div>
            <div className="text-xl font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}>
              <span style={{ color: '#3b82f6' }}>⚔</span>{formatMoney(myLive, 0)}
            </div>
            <div>{delta(myLive - startingBalance)}</div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold truncate max-w-[120px] ml-auto" style={{ color: '#fb923c' }}>{oppName}</div>
            <div className="text-xl font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}>
              <span style={{ color: '#fb923c' }}>⚔</span>{formatMoney(oppLive, 0)}
            </div>
            <div className="text-right">{delta(oppLive - startingBalance)}</div>
          </div>
        </div>
        <div
          className="relative h-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(251,146,60,0.3)', border: `1px solid ${p.softBorder}` }}
        >
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{ width: `${myPct}%`, background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }}
          />
        </div>
      </div>
    );
  };

  // Time-left pill.
  const renderTimePill = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-xl py-2.5"
        style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}
      >
        <span className="text-base" aria-hidden="true">⏱️</span>
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: p.mutedText }}>Time Left</span>
        <span className="text-lg font-black" style={{ color: p.bodyText }}>{formatTimeRemaining(timeRemaining)}</span>
      </div>
    );
  };

  // Battle stat tiles — colored Open/Won/Lost/Cashed chips + At Risk /
  // To Win money footer. Shared by the desktop rail and the mobile card.
  const renderStatTiles = () => {
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
        <div className="text-base font-black" style={{ color }}>${formatMoney(value, 0)}</div>
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

  // Mobile / tablet inline banner — VS hero + balance duel in a framed
  // card with a gradient header carrying the time left.
  const renderInlineBanner = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div
        className="lg:hidden rounded-2xl overflow-hidden mb-5"
        style={{ background: p.cardSurface, border: `2.5px solid ${p.cartoonBorder}`, boxShadow: p.hardShadow }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.18), rgba(251,146,60,0.12))', borderBottom: `1px solid ${p.softBorder}` }}
        >
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

  // Empty state — no active matchup.
  const renderEmptyNoMatchup = () => (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: p.innerSurface,
        border: p.dashedBorder,
      }}
    >
      <div className="text-5xl mb-3" aria-hidden="true">⚔️</div>
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>No active battle</div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: p.mutedText }}>
        You need to be in a battle to place picks. Jump into a Quick Match,
        challenge a friend, or set up a private match — your picks will show
        up here in real time.
      </p>
      {/* Deep-link to the same mode-chooser popup that the homepage
          "Play Now" CTA opens — `/battle?openChooser=1` is handled by
          the effect in pages/battle.js which auto-opens the battle
          options chooser (Quick Match / Challenge Friend / Private
          Match). Previously this just sent the user to the homepage,
          which dumped them on the dashboard with no clear next step. */}
      <Link
        href="/battle?openChooser=1"
        className="inline-block px-6 py-3 rounded-xl font-black text-base"
        style={{
          background: '#2563eb',
          color: '#ffffff',
          border: `2.5px solid ${p.cartoonBorder}`,
          boxShadow: p.hardShadow,
        }}
      >
        Start a Battle
      </Link>
    </div>
  );

  // Empty state — in battle but no picks yet.
  const renderEmptyNoPicks = () => (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: p.innerSurface,
        border: p.dashedBorder,
      }}
    >
      <div className="text-5xl mb-3" aria-hidden="true">🎯</div>
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>No picks placed yet</div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: p.mutedText }}>
        Pick a side on any game from the Battle board, add it to your Pik
        Slip, and submit. Your picks will land here the moment they're
        placed.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-block px-5 py-3 rounded-xl font-black text-sm"
          style={{
            background: '#2563eb',
            color: '#ffffff',
            border: `2.5px solid ${p.cartoonBorder}`,
            boxShadow: p.hardShadow,
          }}
        >
          Browse Games
        </Link>
        {(betSlip?.length || 0) > 0 && (
          <button
            type="button"
            onClick={openBetSlip}
            className="no-hover-effect inline-block px-5 py-3 rounded-xl font-black text-sm"
            style={{
              background: '#fb923c',
              color: '#1a0a02',
              border: `2.5px solid ${p.cartoonBorder}`,
              boxShadow: p.hardShadow,
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            Open Pik Slip ({betSlip.length})
          </button>
        )}
      </div>
    </div>
  );

  const renderNotLoggedIn = () => (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: p.innerSurface,
        border: p.dashedBorder,
      }}
    >
      <div className="text-xl font-black mb-2" style={{ color: p.bodyText }}>Sign in to see your picks</div>
      <p className="text-sm mb-5" style={{ color: p.mutedText }}>
        My Piks pulls from your active battle. Log in to start placing picks.
      </p>
      <Link
        href="/"
        className="inline-block px-5 py-3 rounded-xl font-black text-sm"
        style={{
          background: '#2563eb',
          color: '#ffffff',
          border: `2.5px solid ${p.cartoonBorder}`,
          boxShadow: p.hardShadow,
        }}
      >
        Back Home
      </Link>
    </div>
  );

  // Picks list — each card is wrapped in a clickable container that
  // selects the bet for the right-rail analytics panel (desktop only).
  // The wrapper now carries the cartoon 2.5px black border + hard
  // shadow so the picks read as distinct framed cards instead of
  // blending into the page background. The selected pick swaps the
  // shadow for a chunky cyan glow + adds a small "TRACKING" badge
  // overlay so it's obvious which pick is driving the right-rail
  // chart (desktop only — hidden on mobile where there's no chart).
  const renderPicksList = () => (
    <div className="space-y-3 sm:space-y-4">
      {/* Hint so users discover the tap-to-track interaction. On desktop
          the chart opens in the right rail; on mobile it expands inline
          under the tapped pick — so the copy differs per breakpoint. */}
      {sortedBets.length > 1 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
          style={{
            background: p.hintBg,
            color: p.hintText,
            border: p.hintBorder,
          }}
        >
          <span aria-hidden="true">👆</span>
          <span className="hidden lg:inline">Tap any pick to track its live odds →</span>
          <span className="lg:hidden">Tap any pick to track its live odds ↓</span>
        </div>
      )}

      {sortedBets.map((bet) => {
        const isSelected = bet.id === selectedBetId;
        return (
          <div
            key={bet.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedBetId(bet.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedBetId(bet.id);
              }
            }}
            className="relative rounded-2xl transition-all"
            style={{
              outline: 'none',
              background: p.pickSurface,
              border: isSelected
                ? '2.5px solid #22d3ee'
                : `2.5px solid ${p.pickSurface}`,
              boxShadow: isSelected ? p.pickShadowSelected : p.pickShadow,
              borderRadius: 16,
              cursor: 'pointer',
            }}
          >
            {isSelected && (
              <div
                className="hidden lg:flex absolute top-2 left-2 z-10 items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                style={{
                  background: '#22d3ee',
                  color: '#0a0a0a',
                  border: '1.5px solid #0a0a0a',
                  boxShadow: '0 2px 0 #0a0a0a',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
                Tracking
              </div>
            )}
            <PiksBetCard bet={bet} compactHeader prominentHeader isBattleEnded={false} />

            {/* Mobile inline tracker — the right rail is hidden on
                phone/tablet, so the live-odds chart for the tapped pick
                renders right here instead. stopPropagation keeps taps on
                the chart's range controls / Open Game button from
                re-triggering the card's select handler. */}
            {isSelected && (
              <div
                className="lg:hidden px-3 pb-3 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}` }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.16), rgba(59,130,246,0.10))', borderBottom: `1px solid ${p.softBorder}` }}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>Live Odds Tracker</span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.45)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />Live
                    </span>
                  </div>
                  <div className="p-3">
                    {renderTrackingBody(bet)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // -------- Desktop side panels --------

  // Left rail — one cohesive "Battle HQ" card: gradient header + LIVE
  // pill, VS hero, balance duel, time pill, and the battle stat tiles.
  const renderLeftRail = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <aside className="hidden lg:block lg:col-span-3">
        <div
          className="rounded-2xl overflow-hidden h-full flex flex-col"
          style={{ background: p.cardSurface, border: `2.5px solid ${p.cartoonBorder}`, boxShadow: p.hardShadow }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.18), rgba(251,146,60,0.12))', borderBottom: `1px solid ${p.softBorder}` }}
          >
            <span className="text-[11px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>Active Battle</span>
            <span
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.45)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f87171' }} />Live
            </span>
          </div>
          <div className="p-4 flex flex-col gap-4 flex-1">
            {renderVsRow()}
            <div className="pt-4" style={{ borderTop: `1px solid ${p.softBorder}` }}>{renderBalanceDuel()}</div>
            {renderTimePill()}
            {sortedBets.length > 0 && (
              <div className="pt-4 mt-auto" style={{ borderTop: `1px solid ${p.softBorder}` }}>
                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: p.mutedText }}>This Battle</div>
                {renderStatTiles()}
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  };

  // Builds the tracking panel body (pick summary + live odds chart +
  // open-game button) for a given bet. Shared by the desktop right rail
  // AND the mobile inline tracker (rendered under the selected pick on
  // phone/tablet, where the right rail is hidden) so both stay in sync.
  const renderTrackingBody = (bet) => {
    const { homeTeam: parsedHome, awayTeam: parsedAway } = parseMatchup(bet.matchup);
    // `userBets` does NOT have a top-level gameId column — the real
    // gameId is stashed inside `legs[]` JSONB at insert time (see
    // pages/api/bets/place.js). Fall back through every reasonable
    // location so the chart can fetch real history when available.
    const firstLeg = Array.isArray(bet.legs) && bet.legs.length > 0 ? bet.legs[0] : null;
    const gameId = bet.gameId || firstLeg?.gameId || null;
    const homeTeam = bet.homeTeamFull || firstLeg?.homeTeamFull || parsedHome || 'Home';
    const awayTeam = bet.awayTeamFull || firstLeg?.awayTeamFull || parsedAway || 'Away';
    const isLive = !!(bet.isLive || bet.currentHomeScore != null);
    // Any terminal status counts as final for chart-rendering purposes
    // (stops the live-tail random walk).
    const isFinal = ['won', 'lost', 'cashed_out', 'voided', 'pushed'].includes(bet.status);

    // Synthesize a liveOdds pair from the bet's own American odds so the
    // chart has an anchor to plot around even when the server has no
    // captured history. Mirrors the picked side's implied probability to
    // derive the opposite side's American moneyline. Without this the
    // chart sat on a perpetual spinner because the synthesized history
    // path requires a non-null anchor.
    const derivedLiveOdds = (() => {
      const oddsRaw = Number(bet.odds ?? firstLeg?.odds);
      if (!Number.isFinite(oddsRaw) || oddsRaw === 0) return null;
      const myImplied = oddsRaw > 0 ? 100 / (oddsRaw + 100) : -oddsRaw / (-oddsRaw + 100);
      const oppImplied = Math.min(0.95, Math.max(0.05, 1 - myImplied));
      const oppAmerican = oppImplied >= 0.5
        ? Math.round(-(oppImplied / (1 - oppImplied)) * 100)
        : Math.round(((1 - oppImplied) / oppImplied) * 100);
      // Map "selection" to home or away by simple substring match on
      // the team names. Falls back to treating selection as home.
      const sel = String(bet.selection || '').toLowerCase();
      const homeKey = String(homeTeam || '').toLowerCase().split(/\s+/)[0];
      const awayKey = String(awayTeam || '').toLowerCase().split(/\s+/)[0];
      const selectionIsAway = awayKey && sel.includes(awayKey);
      const selectionIsHome = homeKey && sel.includes(homeKey) && !selectionIsAway;
      if (selectionIsAway) return { home: oppAmerican, away: oddsRaw };
      if (selectionIsHome) return { home: oddsRaw, away: oppAmerican };
      // Couldn't match — default to picked-side-is-home so the chart
      // still gets an anchor instead of spinning.
      return { home: oddsRaw, away: oppAmerican };
    })();

    return (
      <div className="space-y-4">
        <div
          className="rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.3)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#22d3ee' }}>Tracking your pick</span>
          </div>
          <div className="text-base font-black truncate" style={{ color: p.bodyText }}>
            {bet.selection || '—'}
          </div>
          <div className="text-[11px] truncate" style={{ color: p.mutedText }}>
            {awayTeam} @ {homeTeam}
          </div>
        </div>

        <OddsHistoryChart
          gameId={gameId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          liveOdds={derivedLiveOdds}
          commenceTime={bet.placedAt}
          isLive={isLive}
          isFinal={isFinal}
        />

        {gameId ? (
          <Link
            href={`/game/${encodeURIComponent(gameId)}`}
            prefetch
            className="block w-full text-center px-3 py-3 rounded-xl text-sm font-black uppercase tracking-wider"
            style={{
              background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
              color: '#ffffff',
              border: `2.5px solid ${p.cartoonBorder}`,
              boxShadow: p.hardShadow,
            }}
          >
            Open Game →
          </Link>
        ) : (
          // No gameId on this pick — disable the button instead of
          // falling back to '/', which previously caused a flash back
          // to the home page when the user expected the game summary.
          <div
            className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed select-none"
            style={{
              background: p.disabledGameBg,
              color: p.disabledGameText,
              border: p.disabledGameBorder,
            }}
            title="Game summary not available for this pick"
          >
            Game Unavailable
          </div>
        )}
      </div>
    );
  };

  // Empty-state explainer shown in the right rail before a pick is
  // selected.
  const trackingPlaceholder = (
    <div className="text-center py-6">
      <div className="text-3xl mb-2" aria-hidden="true">📈</div>
      <div className="text-sm font-bold mb-1" style={{ color: p.bodyText }}>Live odds tracker</div>
      <p className="text-xs" style={{ color: p.mutedText }}>
        Place a pick and we'll plot how its odds move in real time
        right here.
      </p>
    </div>
  );

  // Right rail — live-odds chart for the currently selected pick's
  // game. Falls back to an explainer panel when nothing's selectable.
  const renderRightRail = () => {
    if (!matchup || !hasActiveMatchup) return null;

    const panelBody = selectedBet ? renderTrackingBody(selectedBet) : trackingPlaceholder;

    return (
      <aside className="hidden lg:block lg:col-span-4">
        <div className="flex flex-col h-full">
          <div
            className="rounded-2xl overflow-hidden flex-1 flex flex-col"
            style={{
              background: p.cardSurface,
              border: `2.5px solid ${p.cartoonBorder}`,
              boxShadow: p.hardShadow,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.16), rgba(59,130,246,0.10))', borderBottom: `1px solid ${p.softBorder}` }}
            >
              <span className="text-[11px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>
                Live Odds Tracker
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.45)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />Live
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              {panelBody}
            </div>
          </div>
        </div>
      </aside>
    );
  };

  // -------- Body selector --------

  let body;
  if (sessionStatus === 'loading' || (isLoggedIn && loading && !matchup && sortedBets.length === 0)) {
    body = (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl animate-pulse"
            style={{ background: p.skeletonSurface, border: `1px solid ${p.softBorder}` }}
          />
        ))}
      </div>
    );
  } else if (!isLoggedIn) {
    body = renderNotLoggedIn();
  } else if (!hasActiveMatchup) {
    body = renderEmptyNoMatchup();
  } else if (sortedBets.length === 0) {
    body = renderEmptyNoPicks();
  } else {
    body = renderPicksList();
  }

  // On desktop we run a 3-column grid (left rail / picks / right
  // rail). On mobile/tablet the rails collapse and everything stacks.
  return (
    <>
      <Head>
        <title>My Piks · Piks</title>
        <meta name="description" content="See every pick you've placed in your current battle." />
      </Head>
      <div className="min-h-screen" style={{ backgroundColor: p.pageBg }}>
        <TopNavbar />
        <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 max-w-7xl mx-auto">
          {renderHeader()}

          {/* Mobile / tablet inline banner (sits above picks). */}
          {renderInlineBanner()}
          <div className="lg:hidden">
            {sortedBets.length > 0 && (
              <div
                className="rounded-2xl p-4 mb-5"
                style={{ background: p.cardSurface, border: `2.5px solid ${p.cartoonBorder}`, boxShadow: p.hardShadow }}
              >
                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: p.mutedText }}>This Battle</div>
                {renderStatTiles()}
              </div>
            )}
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:gap-6">
            {renderLeftRail()}
            <div className="lg:col-span-5">
              {body}
            </div>
            {renderRightRail()}
          </div>
        </div>
      </div>
    </>
  );
}
