import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TopNavbar from '../../../components/TopNavbar';
import PiksBetCard from '../../../components/PiksBetCard';
import FramedAvatar from '../../../components/UserAvatar';
import OddsHistoryChart from '../../../components/game/OddsHistoryChart';
import { formatMoney } from '../../../utils/formatMoney';
import { formatLastSeen } from '../../../utils/relativeTime';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useBetaMode } from '../../../contexts/SiteConfigContext';
import { grantBetaAccess } from '../../../utils/betaAccess';

// ---------------------------------------------------------------------------
// Battle Summary — a public, my-piks-style historical view of a finished
// battle. It shows BOTH players' piks (cards + odds-history tracker) exactly
// like the My Piks page, in light/dark theme, for a battle that has already
// ended. Desktop renders the two players side-by-side; mobile uses tabs.
// ---------------------------------------------------------------------------

// Theme-aware palette — mirrors pages/my-picks.js getPalette so the page reads
// as the same surface in both themes.
function getPalette(isLight) {
  if (isLight) {
    return {
      pageBg: '#f5f1ea',
      cardSurface: '#ffffff',
      innerSurface: '#f0ebe1',
      pickSurface: '#ffffff',
      skeletonSurface: 'rgba(148,163,184,0.25)',
      softBorder: 'rgba(15,23,42,0.10)',
      hardShadow: '0 10px 30px rgba(15,23,42,0.10)',
      bodyText: '#0f172a',
      mutedText: '#64748b',
      faintText: '#94a3b8',
      posGreen: '#059669',
    };
  }
  return {
    pageBg: '#000000',
    cardSurface: '#0d0d0d',
    innerSurface: '#141414',
    pickSurface: '#0d0d0d',
    skeletonSurface: '#1a1a1a',
    softBorder: '#1a1a1a',
    hardShadow: 'none',
    bodyText: '#ffffff',
    mutedText: '#9ca3af',
    faintText: '#6b7280',
    posGreen: '#34d399',
  };
}

// Clash Coins glyph — the in-matchup currency (orange ⚔). Every balance in a
// battle is Clash Coins, shown in white per the brand currency rules.
function Coin() {
  return <span style={{ color: '#fb923c' }} aria-hidden="true">⚔</span>;
}

function normalizeBet(bet) {
  if (!bet) return bet;
  if (bet.status === 'pending') return { ...bet, status: 'open' };
  return bet;
}

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

// Derive the chart context for a pick — gameId, team names, and the implied
// two-sided odds used to seed the tracker. Pure port of my-picks getChartCtx,
// minus the live flags (a finished battle is always final, never live).
function getChartCtx(bet) {
  const { homeTeam: parsedHome, awayTeam: parsedAway } = parseMatchup(bet.matchup);
  const firstLeg = Array.isArray(bet.legs) && bet.legs.length > 0 ? bet.legs[0] : null;
  const gameId = bet.gameId || firstLeg?.gameId || null;
  const homeTeam = bet.homeTeamFull || firstLeg?.homeTeamFull || parsedHome || 'Home';
  const awayTeam = bet.awayTeamFull || firstLeg?.awayTeamFull || parsedAway || 'Away';
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
  return { gameId, homeTeam, awayTeam, derivedLiveOdds };
}

// One player's column: their pik cards, each tappable to reveal the
// odds-history tracker for that pick (final, not live). Each column owns its
// own selected-pick state so the two sides are independent.
function PicksColumn({ bets, p, isOpp, opponentName, opponentAvatar }) {
  const list = useMemo(() => (Array.isArray(bets) ? bets.map(normalizeBet) : []), [bets]);
  const [selectedBetId, setSelectedBetId] = useState(null);

  useEffect(() => {
    if (list.length === 0) { setSelectedBetId(null); return; }
    setSelectedBetId((prev) => (prev && list.some((b) => b.id === prev) ? prev : list[0].id));
  }, [list]);

  if (list.length === 0) {
    return (
      <div
        className="rounded-2xl px-4 py-8 text-center"
        style={{ background: p.cardSurface, border: `1px dashed ${p.softBorder}` }}
      >
        <div className="text-sm font-bold" style={{ color: p.bodyText }}>No piks placed</div>
        <div className="text-xs mt-1" style={{ color: p.mutedText }}>
          {isOpp ? `${opponentName} didn't place any piks in this battle.` : 'No piks were placed in this battle.'}
        </div>
      </div>
    );
  }

  const renderTrackingBody = (bet) => {
    const { gameId, homeTeam, awayTeam, derivedLiveOdds } = getChartCtx(bet);
    return (
      <div className="space-y-2.5">
        <div className="min-w-0">
          <div className="text-sm font-black truncate" style={{ color: p.bodyText }}>{bet.selection || '—'}</div>
          <div className="text-[10px] truncate" style={{ color: p.mutedText }}>{awayTeam} @ {homeTeam}</div>
        </div>
        <OddsHistoryChart
          gameId={gameId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          liveOdds={derivedLiveOdds}
          commenceTime={bet.placedAt}
          isLive={false}
          isFinal
          compact
        />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {list.length > 1 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.35)' }}
        >
          <span aria-hidden="true">👆</span><span>Tap any pick to see how its odds moved ↓</span>
        </div>
      )}
      {list.map((bet) => {
        const isSelected = bet.id === selectedBetId;
        return (
          <div
            key={bet.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedBetId(bet.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBetId(bet.id); } }}
            className="relative rounded-2xl transition-all"
            style={{ outline: 'none', background: p.pickSurface, border: isSelected ? '2.5px solid #22d3ee' : '2.5px solid transparent', boxShadow: p.hardShadow, borderRadius: 16, cursor: 'pointer' }}
          >
            <PiksBetCard
              bet={bet}
              compactHeader
              prominentHeader
              isBattleEnded
              isOpponent={isOpp}
              opponentName={opponentName}
              opponentAvatar={opponentAvatar}
            />
            {isSelected && (
              <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
                <div className="rounded-xl overflow-hidden" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}` }}>
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.16), rgba(59,130,246,0.10))', borderBottom: `1px solid ${p.softBorder}` }}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-black" style={{ color: p.bodyText }}>Odds History</span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(148,163,184,0.15)', color: p.mutedText, border: `1px solid ${p.softBorder}` }}
                    >
                      Final
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
}

// Player header card — avatar, name, outcome chip, final Clash-Coins balance.
function PlayerHeader({ player, balance, outcomeLabel, outcomeColor, isWinner, p }) {
  const ringColor = isWinner ? '#facc15' : outcomeColor;
  return (
    <div
      className="rounded-2xl p-3 mb-3"
      style={{
        background: p.cardSurface,
        border: `1px solid ${isWinner ? 'rgba(250,204,21,0.45)' : p.softBorder}`,
        boxShadow: isWinner ? '0 0 18px rgba(250,204,21,0.12)' : p.hardShadow,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div style={{ borderRadius: '9999px', boxShadow: `0 0 0 2px ${ringColor}` }}>
          <FramedAvatar user={player} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          {player?.id ? (
            <Link href={`/profile/${player.id}`} className="font-bold text-sm truncate hover:underline block" style={{ color: p.bodyText }}>
              {player?.username || 'Player'}
            </Link>
          ) : (
            <div className="font-bold text-sm truncate" style={{ color: p.bodyText }}>{player?.username || 'Player'}</div>
          )}
          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: outcomeColor }}>{outcomeLabel}</div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: p.faintText }}>Final</div>
          <div className="text-lg font-black inline-flex items-center gap-1" style={{ color: p.bodyText }}>
            <Coin />{formatMoney(balance || 0, 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ title, message, p }) {
  return (
    <div className="min-h-screen" style={{ background: p.pageBg }}>
      <TopNavbar />
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="rounded-xl p-6" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}` }}>
          <h1 className="text-lg font-bold mb-2" style={{ color: p.bodyText }}>{title}</h1>
          <p className="text-sm mb-4" style={{ color: p.mutedText }}>{message}</p>
          <Link href="/battle" className="inline-block px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: p.bodyText, color: p.pageBg }}>
            Back to battles
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params || {};
  if (!id || typeof id !== 'string') return { props: {} };
  try {
    const { getBattlePreview } = await import('../../../lib/battle-preview');
    const preview = await getBattlePreview(id);
    if (!preview) return { props: {} };

    const proto = (context.req?.headers['x-forwarded-proto'] || '').toString().split(',')[0]
      || (context.req?.socket?.encrypted ? 'https' : 'http');
    const host = (context.req?.headers['x-forwarded-host'] || context.req?.headers?.host || '')
      .toString().split(',')[0] || '';
    const origin = host ? `${proto}://${host}` : '';

    const u1 = preview.user1?.username || 'Player 1';
    const u2 = preview.user2?.username || 'Player 2';

    let title;
    let description;
    if (preview.status === 'completed') {
      if (preview.winnerType === 'tie') {
        title = `${u1} vs ${u2} ended in a tie · Piks`;
        description = `Tied ${preview.mode.toLowerCase()} battle on Piks · ${preview.prize} pot. See every pick from the matchup.`;
      } else if (preview.winnerUsername) {
        title = `${preview.winnerUsername} beat ${preview.loserUsername || 'their opponent'} on Piks`;
        description = `${preview.winnerUsername} won a ${preview.mode.toLowerCase()} battle on Piks and took home ${preview.prize}. See the full battle summary.`;
      } else {
        title = `${u1} vs ${u2} · Battle summary · Piks`;
        description = `${preview.mode} battle summary on Piks · ${preview.prize} pot.`;
      }
    } else {
      title = `${u1} vs ${u2} · Battle summary · Piks`;
      description = `${preview.mode} battle on Piks · ${preview.prize} prize pool · ${preview.statusLabel}.`;
    }

    return {
      props: {
        battlePreview: {
          ...preview,
          origin,
          title,
          description,
          url: `/battle/summary/${encodeURIComponent(id)}`,
        },
      },
    };
  } catch (_err) {
    return { props: {} };
  }
}

export default function BattleSummaryPage({ battlePreview }) {
  const router = useRouter();
  const { id } = router.query;
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const p = getPalette(isLight);
  const isBeta = useBetaMode();
  const auth = useAuth();
  const isSignedIn = !!auth?.user;

  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moreBattles, setMoreBattles] = useState([]);
  const [activeTab, setActiveTab] = useState('mine');

  const handleSignUpClick = () => {
    if (typeof window === 'undefined') return;
    try { grantBetaAccess(); } catch (_e) {}
    window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }));
  };

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/battles/public/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (res.status === 404) { setError('not_found'); setLoading(false); return; }
        if (!res.ok) { setError('error'); setLoading(false); return; }
        const data = await res.json();
        if (cancelled) return;
        setBattle(data?.battle || null);
        setLoading(false);
      } catch {
        if (!cancelled) { setError('error'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, id]);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/battles/recent?limit=10');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setMoreBattles(Array.isArray(data?.battles) ? data.battles : []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [router.isReady]);

  const meta = battlePreview && (
    <Head>
      <title>{battlePreview.title}</title>
      <meta name="description" content={battlePreview.description} />
      <meta property="og:title" content={battlePreview.title} />
      <meta property="og:description" content={battlePreview.description} />
      <meta property="og:type" content="website" />
      {battlePreview.origin && battlePreview.url && (
        <meta property="og:url" content={`${battlePreview.origin}${battlePreview.url}`} />
      )}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={battlePreview.title} />
      <meta name="twitter:description" content={battlePreview.description} />
    </Head>
  );

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: p.pageBg }}>
        {meta}
        <TopNavbar />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-28 rounded-2xl animate-pulse mb-4" style={{ background: p.skeletonSurface }} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-20 rounded-2xl animate-pulse" style={{ background: p.skeletonSurface }} />
                <div className="h-44 rounded-2xl animate-pulse" style={{ background: p.skeletonSurface }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return <>{meta}<StatusMessage title="Battle not found" message="This battle doesn't exist or is no longer available." p={p} /></>;
  }
  if (error || !battle) {
    return <>{meta}<StatusMessage title="Couldn't load battle" message="Something went wrong loading this battle. Please try again in a moment." p={p} /></>;
  }
  if (battle.status === 'cancelled') {
    return <>{meta}<StatusMessage title="Battle cancelled" message="This matchup was cancelled before it finished, so there's nothing to show." p={p} /></>;
  }
  if (battle.status !== 'completed') {
    return <>{meta}<StatusMessage title="Battle still in progress" message="Summaries only become available after a battle ends." p={p} /></>;
  }

  const { player, opponent, myBalance, oppBalance, myBets = [], opponentBets = [], potSize, winnerPayout, outcome, endsAt } = battle;

  const player1IsWinner = outcome === 'won';
  const player2IsWinner = outcome === 'lost';
  const isTie = outcome === 'tie';

  const headline = isTie
    ? 'It was a tie'
    : `${(player1IsWinner ? player?.username : opponent?.username) || 'Player'} won`;

  const playerOutcome = {
    label: isTie ? 'Tie' : player1IsWinner ? 'Winner' : 'Lost',
    color: isTie ? p.mutedText : player1IsWinner ? '#facc15' : '#ef4444',
  };
  const oppOutcome = {
    label: isTie ? 'Tie' : player2IsWinner ? 'Winner' : 'Lost',
    color: isTie ? p.mutedText : player2IsWinner ? '#facc15' : '#ef4444',
  };

  const renderPlayerSide = (who) => {
    if (who === 'mine') {
      return (
        <>
          <PlayerHeader player={player} balance={myBalance} outcomeLabel={playerOutcome.label} outcomeColor={playerOutcome.color} isWinner={player1IsWinner} p={p} />
          <PicksColumn bets={myBets} p={p} isOpp={false} />
        </>
      );
    }
    return (
      <>
        <PlayerHeader player={opponent} balance={oppBalance} outcomeLabel={oppOutcome.label} outcomeColor={oppOutcome.color} isWinner={player2IsWinner} p={p} />
        <PicksColumn bets={opponentBets} p={p} isOpp opponentName={opponent?.username || 'Opponent'} opponentAvatar={opponent?.avatar || null} />
      </>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: p.pageBg }}>
      {meta}
      <TopNavbar />
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/battle" className="text-[12px] font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: p.mutedText }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to battles
          </Link>
          {endsAt && <span className="text-[11px]" style={{ color: p.mutedText }}>{formatLastSeen(endsAt)}</span>}
        </div>

        {/* Outcome splash */}
        <div
          className="rounded-2xl p-4 mb-5 text-center"
          style={{
            background: isLight ? p.cardSurface : 'linear-gradient(160deg, rgba(30,41,59,0.6) 0%, rgba(15,15,15,0.95) 100%)',
            border: '1px solid rgba(250,204,21,0.35)',
            boxShadow: p.hardShadow,
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.mutedText }}>Battle summary</div>
          <div className="text-2xl font-black mt-1" style={{ color: p.bodyText }}>{headline}</div>
          <div className="mt-3 inline-flex flex-col items-center px-4 py-2 rounded-lg" style={{ background: isLight ? p.innerSurface : '#0a0a0a', border: `1px solid ${p.softBorder}` }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: p.mutedText }}>{isTie ? 'Pot' : 'Winner payout'}</div>
            <div className="text-2xl font-black" style={{ color: '#facc15' }}>
              {formatMoney(isTie ? potSize : (winnerPayout || potSize), 0)} <span aria-hidden="true">👑</span>
            </div>
            {!isTie && potSize > 0 && (
              <div className="text-[10px] mt-0.5" style={{ color: p.mutedText }}>Pot {formatMoney(potSize, 0)} 👑</div>
            )}
          </div>
        </div>

        {/* Mobile: tabs to switch between players */}
        <div className="lg:hidden">
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-full mb-4"
            style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('mine')}
              className="py-2 rounded-full text-[12px] font-bold uppercase tracking-wider truncate transition-colors"
              style={{ background: activeTab === 'mine' ? '#3b82f6' : 'transparent', color: activeTab === 'mine' ? '#fff' : p.mutedText }}
            >
              {(player?.username || 'You')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('theirs')}
              className="py-2 rounded-full text-[12px] font-bold uppercase tracking-wider truncate transition-colors"
              style={{ background: activeTab === 'theirs' ? '#fb923c' : 'transparent', color: activeTab === 'theirs' ? '#fff' : p.mutedText }}
            >
              {(opponent?.username || 'Opponent')}
            </button>
          </div>
          {renderPlayerSide(activeTab)}
        </div>

        {/* Desktop: both players side-by-side */}
        <div className="hidden lg:grid grid-cols-2 gap-6 items-start">
          <div className="min-w-0">{renderPlayerSide('mine')}</div>
          <div className="min-w-0">{renderPlayerSide('theirs')}</div>
        </div>

        {(() => {
          const others = moreBattles.filter((b) => String(b.id) !== String(id)).slice(0, 5);
          if (others.length === 0) return null;
          return (
            <div className="mt-6 rounded-2xl p-3" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.mutedText }}>More recent battles</span>
                <span className="text-[10px]" style={{ color: p.mutedText }}>Just finished</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {others.map((b) => (
                  <Link
                    key={b.id}
                    href={`/battle/summary/${b.id}`}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5"
                    style={{ background: p.innerSurface, border: `1px solid ${p.softBorder}` }}
                  >
                    <FramedAvatar user={b.winner} size={28} />
                    <div className="min-w-0 flex-1 text-[11px] leading-tight" style={{ color: p.bodyText }}>
                      <div className="truncate">
                        <span className="font-semibold" style={{ color: p.posGreen }}>{b.winner?.username || 'Player'}</span>
                        <span style={{ color: p.mutedText }}> beat </span>
                        <span className="font-medium">{b.loser?.username || 'Player'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ color: p.mutedText }}>
                        <span className="font-semibold" style={{ color: '#facc15' }}>{isBeta ? `${formatMoney(b.potSize, 0)} coin pot` : `$${formatMoney(b.potSize, 0)} pot`}</span>
                        <span>·</span>
                        <span>{formatLastSeen(b.endedAt)}</span>
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: p.mutedText }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-6 text-center">
          {isSignedIn ? (
            <Link
              href="/battle"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)', color: '#000' }}
            >
              Start your own battle
            </Link>
          ) : (
            <div className="rounded-2xl p-4 max-w-md mx-auto" style={{ background: p.cardSurface, border: `1px solid ${p.softBorder}`, boxShadow: p.hardShadow }}>
              <div className="text-sm font-semibold mb-1" style={{ color: p.bodyText }}>Want in on the action?</div>
              <div className="text-[12px] mb-3" style={{ color: p.mutedText }}>Create a free account and battle your friends head-to-head.</div>
              <button
                type="button"
                onClick={handleSignUpClick}
                className="inline-block w-full px-5 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)', color: '#000' }}
              >
                Sign up to play your own battle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
