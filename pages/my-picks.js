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

  // Active battle card flips between YOUR balance and your OPPONENT's
  // every 3.5s so both are visible at a glance. Tapping the label or
  // the balance row also flips it instantly (and pauses the auto-flip
  // for ~6s so a deliberate tap isn't immediately overridden).
  const [balanceView, setBalanceView] = useState('me');
  const [autoPausedUntil, setAutoPausedUntil] = useState(0);
  const opponentId = opponent?.id || null;
  // Reset view back to "me" whenever the opponent changes so we
  // never carry the prior battle's flip state into a new one.
  useEffect(() => {
    setBalanceView('me');
  }, [opponentId]);
  // Depend only on stable primitives — the useMatchup context
  // returns a fresh `opponent` object on every poll tick, which
  // would otherwise tear down and recreate the interval before
  // it ever fired.
  useEffect(() => {
    if (!hasActiveMatchup || !opponentId) return undefined;
    const id = setInterval(() => {
      if (Date.now() < autoPausedUntil) return;
      setBalanceView((v) => (v === 'me' ? 'opp' : 'me'));
    }, 3500);
    return () => clearInterval(id);
  }, [hasActiveMatchup, opponentId, autoPausedUntil]);
  const flipBalanceView = useCallback(() => {
    setAutoPausedUntil(Date.now() + 6000);
    setBalanceView((v) => (v === 'me' ? 'opp' : 'me'));
  }, []);
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

  const openBetSlip = () => {
    try { setShowBetSlip(true); } catch (_e) {}
  };

  // -------- Sub-renderers --------

  // Header intentionally omitted: the top-nav already shows the
  // active "My Picks" tab underline, so repeating the page title +
  // subtitle here was just redundant chrome. The renderer is kept
  // as a no-op so call sites elsewhere in the file don't need to
  // change.
  const renderHeader = () => null;

  // VS row — used both inline (mobile) and stacked (desktop sidebar).
  // "You" matches the casing convention of the opponent's display name
  // (we don't uppercase the opponent's handle, so we shouldn't shout
  // YOU at the user either). The opponent half is a button that
  // navigates to their public profile.
  const renderVsRow = ({ stacked = false } = {}) => {
    if (!matchup || !hasActiveMatchup) return null;
    const oppName = opponent?.username || 'Opponent';
    const oppClickable = !!opponent?.id;
    const goToOpponentProfile = () => {
      if (!oppClickable) return;
      router.push(`/profile/${opponent.id}`);
    };
    return (
      <div className={`flex items-center ${stacked ? 'justify-center' : 'justify-start'} gap-3`}>
        <div className="flex flex-col items-center gap-1">
          <UserAvatar
            avatar={myProfile?.avatar}
            username={myProfile?.username || 'You'}
            size={stacked ? 48 : 40}
          />
          <div className="text-xs font-black" style={{ color: '#3b82f6' }}>You</div>
        </div>
        <div className="text-xl font-black px-1" style={{ color: p.vsText }}>VS</div>
        <button
          type="button"
          onClick={goToOpponentProfile}
          disabled={!oppClickable}
          className={`flex flex-col items-center gap-1 rounded-lg px-1 py-0.5 -mx-1 ${oppClickable ? 'cursor-pointer hover:bg-white/5 active:scale-95 transition' : 'cursor-default'}`}
          title={oppClickable ? `View ${oppName}'s profile` : oppName}
        >
          <UserAvatar
            avatar={opponent?.avatar}
            username={oppName}
            size={stacked ? 48 : 40}
          />
          <div
            className="text-xs font-black truncate max-w-[88px] text-center"
            style={{ color: '#fb923c' }}
          >
            {oppName}
          </div>
        </button>
      </div>
    );
  };

  // Balance + Time Left pair (compact, fits both mobile inline and
  // desktop sidebar). The Balance cell alternates between YOUR and
  // your OPPONENT's live balance (auto every ~3.5s, or tap to flip).
  // We keep the cell itself clickable so the toggle target is large
  // and obvious without extra chrome.
  const renderBalanceTimeRow = ({ vertical = false } = {}) => {
    if (!matchup || !hasActiveMatchup) return null;
    const startingBalance = parseFloat(matchup.startingBalance || 0) || 0;

    const myLive =
      myLiveBalance != null ? parseFloat(myLiveBalance)
        : myBalance != null ? parseFloat(myBalance)
        : startingBalance;
    const oppLive =
      opponentLiveBalance != null ? parseFloat(opponentLiveBalance)
        : opponentBalance != null ? parseFloat(opponentBalance)
        : startingBalance;

    const showingOpp = balanceView === 'opp' && !!opponent;
    const live = showingOpp ? oppLive : myLive;
    const liveDelta = live - startingBalance;
    const isUp = liveDelta > 0;
    const isDown = liveDelta < 0;
    const cellBase = vertical ? 'text-center w-full' : 'text-right';
    const labelColor = showingOpp ? '#fb923c' : '#3b82f6';
    const labelText = showingOpp
      ? `${(opponent?.username || 'Opponent').slice(0, 14)} Balance`
      : 'Your Balance';

    return (
      <div className={vertical ? 'flex flex-col gap-3' : 'flex items-center gap-5'}>
        <button
          type="button"
          onClick={opponent ? flipBalanceView : undefined}
          disabled={!opponent}
          className={`${cellBase} ${opponent ? 'cursor-pointer active:scale-95 transition' : 'cursor-default'}`}
          title={opponent ? 'Tap to see the other balance' : 'Balance'}
        >
          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: labelColor }}>
            {labelText}
          </div>
          <div className="text-lg font-black inline-flex items-center gap-1">
            <span style={{ color: '#fb923c' }}>⚔</span>
            <span style={{ color: p.bodyText }}>{formatMoney(live, 0)}</span>
          </div>
          {(isUp || isDown) && (
            <div className="text-[11px] font-bold" style={{ color: isUp ? '#34d399' : '#f87171' }}>
              {isUp ? '+' : ''}{formatMoney(liveDelta, 0)}
            </div>
          )}
        </button>
        <div className={cellBase}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>Time Left</div>
          <div className="text-lg font-black" style={{ color: p.bodyText }}>{formatTimeRemaining(timeRemaining)}</div>
        </div>
      </div>
    );
  };

  // Mobile / tablet inline banner (single row).
  const renderInlineBanner = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <div
        className="lg:hidden rounded-2xl p-4 mb-5"
        style={{
          background: p.cardSurface,
          border: `2.5px solid ${p.cartoonBorder}`,
          boxShadow: p.hardShadow,
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {renderVsRow()}
          <div className="ml-auto">{renderBalanceTimeRow()}</div>
        </div>
      </div>
    );
  };

  const renderSummaryStrip = ({ compact = false } = {}) => {
    if (sortedBets.length === 0) return null;
    const cell = (label, value, color) => (
      <div className={`${compact ? 'flex-1' : 'flex-1'} text-center px-2 py-2`}>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>{label}</div>
        <div className={`${compact ? 'text-base' : 'text-lg'} font-black mt-0.5`} style={{ color }}>{value}</div>
      </div>
    );
    return (
      <div
        className={`rounded-xl mb-5 grid ${compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'} ${isLight ? 'divide-x divide-slate-900/5' : 'divide-x divide-white/5'}`}
        style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}
      >
        {cell('Open', counts.open, '#3b82f6')}
        {cell('Won', counts.won, '#34d399')}
        {cell('Lost', counts.lost, '#f87171')}
        {cell('At Risk', `${formatMoney(counts.totalStake, 0)}`, '#fed7aa')}
        {cell('To Win', `${formatMoney(Math.max(0, counts.potentialPayout - counts.totalStake), 0)}`, '#34d399')}
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
        My Picks pulls from your active battle. Log in to start placing picks.
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
      {/* Desktop-only hint so users discover the click-to-track
          interaction. Hidden on mobile where there's no right rail. */}
      {sortedBets.length > 1 && (
        <div
          className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
          style={{
            background: p.hintBg,
            color: p.hintText,
            border: p.hintBorder,
          }}
        >
          <span aria-hidden="true">👆</span>
          <span>Tap any pick to track its live odds →</span>
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
            <PiksBetCard bet={bet} compactHeader isBattleEnded={false} />
          </div>
        );
      })}
    </div>
  );

  // -------- Desktop side panels --------

  // Left rail — VS card + balance/time + summary.
  const renderLeftRail = () => {
    if (!matchup || !hasActiveMatchup) return null;
    return (
      <aside className="hidden lg:block lg:col-span-3">
        {/* Drop `sticky` so the rail stretches to the grid row height
            (default `items-stretch` on the parent grid). The bottom
            stats card flex-grows so the column matches the picks
            column and the right analytics rail. */}
        <div className="flex flex-col gap-4 h-full">
          <div
            className="rounded-2xl p-5"
            style={{
              background: p.cardSurface,
              border: `2.5px solid ${p.cartoonBorder}`,
              boxShadow: p.hardShadow,
            }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-3 text-center" style={{ color: p.mutedText }}>
              Active Battle
            </div>
            {renderVsRow({ stacked: true })}
            <div className={`mt-4 pt-4 border-t ${p.divider}`}>
              {renderBalanceTimeRow({ vertical: true })}
            </div>
          </div>

          {sortedBets.length > 0 && (
            <div
              className="rounded-2xl p-3 flex-1 flex flex-col justify-center"
              style={{
                background: p.innerSurface,
                border: `1px solid ${p.softBorder}`,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-2 text-center" style={{ color: p.mutedText }}>
                This Battle
              </div>
              <div className="grid grid-cols-2 gap-y-3">
                {[
                  ['Open', counts.open, '#3b82f6'],
                  ['Won', counts.won, '#34d399'],
                  ['Lost', counts.lost, '#f87171'],
                  ['Cashed', counts.cashedOut, '#fb923c'],
                ].map(([label, value, color]) => (
                  <div key={label} className="text-center">
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>{label}</div>
                    <div className="text-lg font-black" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
              <div className={`mt-3 pt-3 border-t ${p.divider} grid grid-cols-2 gap-y-2`}>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>At Risk</div>
                  <div className="text-sm font-black" style={{ color: '#fed7aa' }}>${formatMoney(counts.totalStake, 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>To Win</div>
                  <div className="text-sm font-black" style={{ color: '#34d399' }}>
                    ${formatMoney(Math.max(0, counts.potentialPayout - counts.totalStake), 0)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  };

  // Right rail — live-odds chart for the currently selected pick's
  // game. Falls back to an explainer panel when nothing's selectable.
  const renderRightRail = () => {
    if (!matchup || !hasActiveMatchup) return null;

    let panelBody;
    if (!selectedBet) {
      panelBody = (
        <div className="text-center py-6">
          <div className="text-3xl mb-2" aria-hidden="true">📈</div>
          <div className="text-sm font-bold mb-1" style={{ color: p.bodyText }}>Live odds tracker</div>
          <p className="text-xs" style={{ color: p.mutedText }}>
            Place a pick and we'll plot how its odds move in real time
            right here.
          </p>
        </div>
      );
    } else {
      const { homeTeam: parsedHome, awayTeam: parsedAway } = parseMatchup(selectedBet.matchup);
      // `userBets` does NOT have a top-level gameId column — the real
      // gameId is stashed inside `legs[]` JSONB at insert time (see
      // pages/api/bets/place.js). Fall back through every reasonable
      // location so the chart can fetch real history when available.
      const firstLeg = Array.isArray(selectedBet.legs) && selectedBet.legs.length > 0 ? selectedBet.legs[0] : null;
      const gameId = selectedBet.gameId || firstLeg?.gameId || null;
      const homeTeam = selectedBet.homeTeamFull || firstLeg?.homeTeamFull || parsedHome || 'Home';
      const awayTeam = selectedBet.awayTeamFull || firstLeg?.awayTeamFull || parsedAway || 'Away';
      const isLive = !!(selectedBet.isLive || selectedBet.currentHomeScore != null);
      // Any terminal status counts as final for chart-rendering purposes
      // (stops the live-tail random walk).
      const isFinal = ['won', 'lost', 'cashed_out', 'voided', 'pushed'].includes(selectedBet.status);

      // Synthesize a liveOdds pair from the bet's own American odds so
      // the chart has an anchor to plot around even when the server has
      // no captured history. Mirrors the picked side's implied
      // probability to derive the opposite side's American moneyline.
      // Without this the chart sat on a perpetual spinner because the
      // synthesized history path requires a non-null anchor.
      const derivedLiveOdds = (() => {
        const oddsRaw = Number(selectedBet.odds ?? firstLeg?.odds);
        if (!Number.isFinite(oddsRaw) || oddsRaw === 0) return null;
        const myImplied = oddsRaw > 0 ? 100 / (oddsRaw + 100) : -oddsRaw / (-oddsRaw + 100);
        const oppImplied = Math.min(0.95, Math.max(0.05, 1 - myImplied));
        const oppAmerican = oppImplied >= 0.5
          ? Math.round(-(oppImplied / (1 - oppImplied)) * 100)
          : Math.round(((1 - oppImplied) / oppImplied) * 100);
        // Map "selection" to home or away by simple substring match on
        // the team names. Falls back to treating selection as home.
        const sel = String(selectedBet.selection || '').toLowerCase();
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

      panelBody = (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: p.mutedText }}>
              Tracking your pick
            </div>
            <div className="text-sm font-black truncate" style={{ color: p.bodyText }}>
              {selectedBet.selection || '—'}
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
            commenceTime={selectedBet.placedAt}
            isLive={isLive}
            isFinal={isFinal}
          />

          {gameId ? (
            <Link
              href={`/game/${encodeURIComponent(gameId)}`}
              prefetch
              className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
              style={{
                background: p.openGameBg,
                color: p.openGameText,
                border: p.openGameBorder,
              }}
            >
              Open Game →
            </Link>
          ) : (
            // No gameId on this pick — disable the button instead of
            // falling back to '/', which previously caused a flash
            // back to the home page when the user expected the game
            // summary.
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
    }

    return (
      <aside className="hidden lg:block lg:col-span-4">
        {/* Stretch to match the picks column + left rail height. */}
        <div className="flex flex-col h-full">
          <div
            className="rounded-2xl p-4 flex-1 flex flex-col"
            style={{
              background: p.cardSurface,
              border: `2.5px solid ${p.cartoonBorder}`,
              boxShadow: p.hardShadow,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>
                Analytics
              </div>
              <div
                className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(34,211,238,0.15)',
                  color: '#22d3ee',
                  border: '1px solid rgba(34,211,238,0.45)',
                }}
              >
                Live
              </div>
            </div>
            {panelBody}
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
        <title>My Picks · Piks</title>
        <meta name="description" content="See every pick you've placed in your current battle." />
      </Head>
      <div className="min-h-screen" style={{ backgroundColor: p.pageBg }}>
        <TopNavbar />
        <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 max-w-7xl mx-auto">
          {renderHeader()}

          {/* Mobile / tablet inline banner (sits above picks). */}
          {renderInlineBanner()}
          <div className="lg:hidden">
            {sortedBets.length > 0 && renderSummaryStrip()}
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
