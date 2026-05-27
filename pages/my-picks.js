import { useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import PiksBetCard from '../components/PiksBetCard';
import TeamLogo from '../components/TeamLogo';
import UserAvatar from '../components/UserAvatar';
import { useMatchup } from '../contexts/MatchupContext';
import { useBetSlip } from '../contexts/BetSlipContext';
import { formatMoney } from '../utils/formatMoney';

// Normalize a raw user_bets row (or fake_opponent_bets row) into the
// shape PiksBetCard expects. The DB column defaults to 'pending' for
// ungraded bets, but PiksBetCard's `isOpen` branch checks for the
// string 'open' (the rest of the app — BattleHistoryTable, BetSlip,
// BetReceipt — uses 'open' as the in-flight status). Mapping happens
// here so the rest of the app stays untouched.
function normalizeBet(bet) {
  if (!bet) return bet;
  if (bet.status === 'pending') {
    return { ...bet, status: 'open' };
  }
  return bet;
}

// Format the remaining battle time as "Hh Mm" / "Mm Ss" — same
// vocabulary the rest of the app uses on the dashboard hero card.
function formatTimeRemaining(ms) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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
    myUnrealizedPnl,
    timeRemaining,
    hasActiveMatchup,
    loading,
  } = useMatchup();
  const { betSlip, setShowBetSlip } = useBetSlip();

  const isLoggedIn = sessionStatus === 'authenticated';
  const sortedBets = useMemo(() => {
    const arr = Array.isArray(myBets) ? myBets.slice() : [];
    // Newest first — same ordering the bet slip / receipt screens use.
    arr.sort((a, b) => {
      const ta = a?.placedAt ? new Date(a.placedAt).getTime() : 0;
      const tb = b?.placedAt ? new Date(b.placedAt).getTime() : 0;
      return tb - ta;
    });
    return arr.map(normalizeBet);
  }, [myBets]);

  const counts = useMemo(() => {
    let open = 0;
    let won = 0;
    let lost = 0;
    let cashedOut = 0;
    let totalStake = 0;
    let potentialPayout = 0;
    for (const b of sortedBets) {
      const stake = parseFloat(b.stake || 0) || 0;
      const payout = parseFloat(b.potentialPayout || 0) || 0;
      if (b.status === 'open') {
        open += 1;
        totalStake += stake;
        potentialPayout += payout;
      } else if (b.status === 'won') {
        won += 1;
      } else if (b.status === 'lost') {
        lost += 1;
      } else if (b.status === 'cashed_out') {
        cashedOut += 1;
      }
    }
    return { open, won, lost, cashedOut, totalStake, potentialPayout };
  }, [sortedBets]);

  // The dashboard's "Pik Slip" button is the canonical way to add picks
  // — surface it from the empty state so users aren't bounced around.
  const openBetSlip = () => {
    try { setShowBetSlip(true); } catch (_e) {}
  };

  const renderHeader = () => (
    <div className="mb-4 sm:mb-6">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: '#ffffff' }}>
        My Picks
      </h1>
      <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
        Every pick you've placed in your current battle, FanDuel-style.
      </p>
    </div>
  );

  const renderMatchupBanner = () => {
    if (!matchup || !hasActiveMatchup) return null;
    const startingBalance = parseFloat(matchup.startingBalance || 0) || 0;
    const live = myLiveBalance != null ? parseFloat(myLiveBalance) : (myBalance != null ? parseFloat(myBalance) : startingBalance);
    const liveDelta = live - startingBalance;
    const isUp = liveDelta > 0;
    const isDown = liveDelta < 0;
    return (
      <div
        className="rounded-2xl p-4 sm:p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(8,12,24,0.95) 100%)',
          border: '2.5px solid #0d0d0d',
          boxShadow: '0 4px 0 rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              avatar={myProfile?.avatar}
              username={myProfile?.username || 'You'}
              size={40}
            />
            <div className="text-lg font-black" style={{ color: '#3b82f6' }}>YOU</div>
            <div className="text-xl font-black px-2" style={{ color: '#ffffff' }}>VS</div>
            <div className="text-lg font-black" style={{ color: '#fb923c' }}>{opponent?.username || 'OPP'}</div>
            <UserAvatar
              avatar={opponent?.avatar}
              username={opponent?.username || 'Opponent'}
              size={40}
            />
          </div>
          <div className="flex items-center gap-4 sm:gap-6 ml-auto">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Balance</div>
              <div className="text-lg font-black inline-flex items-center gap-1">
                <span style={{ color: '#fb923c' }}>⚔</span>
                <span style={{ color: '#ffffff' }}>{formatMoney(live, 0)}</span>
              </div>
              {(isUp || isDown) && (
                <div
                  className="text-[11px] font-bold"
                  style={{ color: isUp ? '#34d399' : '#f87171' }}
                >
                  {isUp ? '+' : ''}{formatMoney(liveDelta, 0)}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>Time Left</div>
              <div className="text-lg font-black" style={{ color: '#ffffff' }}>{formatTimeRemaining(timeRemaining)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryStrip = () => {
    if (sortedBets.length === 0) return null;
    const cell = (label, value, color) => (
      <div className="flex-1 text-center px-2 py-2">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>{label}</div>
        <div className="text-lg font-black mt-0.5" style={{ color }}>{value}</div>
      </div>
    );
    return (
      <div
        className="rounded-xl mb-5 grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/5"
        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {cell('Open', counts.open, '#3b82f6')}
        {cell('Won', counts.won, '#34d399')}
        {cell('Lost', counts.lost, '#f87171')}
        {cell('At Risk', `${formatMoney(counts.totalStake, 0)}`, '#fed7aa')}
        {cell('To Win', `${formatMoney(Math.max(0, counts.potentialPayout - counts.totalStake), 0)}`, '#34d399')}
      </div>
    );
  };

  // No active matchup — explain and direct user to start one.
  const renderEmptyNoMatchup = () => (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: 'rgba(15,23,42,0.6)',
        border: '2.5px dashed rgba(59,130,246,0.4)',
      }}
    >
      <div className="text-5xl mb-3" aria-hidden="true">⚔️</div>
      <div className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>
        No active battle
      </div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: '#9ca3af' }}>
        You need to be in a battle to place picks. Jump into a Quick Match,
        challenge a friend, or set up a private match — your picks will show
        up here in real time.
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-3 rounded-xl font-black text-base"
        style={{
          background: '#2563eb',
          color: '#ffffff',
          border: '2.5px solid #0d0d0d',
          boxShadow: '0 4px 0 rgba(0,0,0,0.55)',
        }}
      >
        Start a Battle
      </Link>
    </div>
  );

  // In a battle, but haven't placed any picks yet.
  const renderEmptyNoPicks = () => (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: 'rgba(15,23,42,0.6)',
        border: '2.5px dashed rgba(59,130,246,0.4)',
      }}
    >
      <div className="text-5xl mb-3" aria-hidden="true">🎯</div>
      <div className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>
        No picks placed yet
      </div>
      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: '#9ca3af' }}>
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
            border: '2.5px solid #0d0d0d',
            boxShadow: '0 4px 0 rgba(0,0,0,0.55)',
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
              border: '2.5px solid #0d0d0d',
              boxShadow: '0 4px 0 rgba(0,0,0,0.55)',
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
        background: 'rgba(15,23,42,0.6)',
        border: '2.5px dashed rgba(59,130,246,0.4)',
      }}
    >
      <div className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>
        Sign in to see your picks
      </div>
      <p className="text-sm mb-5" style={{ color: '#9ca3af' }}>
        My Picks pulls from your active battle. Log in to start placing picks.
      </p>
      <Link
        href="/"
        className="inline-block px-5 py-3 rounded-xl font-black text-sm"
        style={{
          background: '#2563eb',
          color: '#ffffff',
          border: '2.5px solid #0d0d0d',
          boxShadow: '0 4px 0 rgba(0,0,0,0.55)',
        }}
      >
        Back Home
      </Link>
    </div>
  );

  let body;
  if (sessionStatus === 'loading' || (isLoggedIn && loading && !matchup && sortedBets.length === 0)) {
    body = (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl animate-pulse"
            style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}
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
    body = (
      <div className="space-y-3 sm:space-y-4">
        {sortedBets.map((bet) => (
          <PiksBetCard
            key={bet.id}
            bet={bet}
            compactHeader
            isBattleEnded={false}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Picks · Piks</title>
        <meta name="description" content="See every pick you've placed in your current battle." />
      </Head>
      <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
        <TopNavbar />
        <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16 max-w-3xl mx-auto">
          {renderHeader()}
          {renderMatchupBanner()}
          {renderSummaryStrip()}
          {body}
        </div>
      </div>
    </>
  );
}
