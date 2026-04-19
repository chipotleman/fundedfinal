import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../../../components/TopNavbar';
import FramedAvatar from '../../../components/UserAvatar';
import { formatMoney } from '../../../utils/formatMoney';
import { formatLastSeen } from '../../../utils/relativeTime';
import { getBattlePreview } from '../../../lib/battle-preview';
import { useAuth } from '../../../contexts/AuthContext';

const cardBg = '#0d0d0d';
const cardBorder = '#1a1a1a';
const textPrimary = '#ffffff';
const textSecondary = '#9ca3af';

function StatusMessage({ title, message, showHomeLink = true }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar />
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <h1 className="text-lg font-bold mb-2">{title}</h1>
          <p className="text-sm mb-4" style={{ color: textSecondary }}>{message}</p>
          {showHomeLink && (
            <Link
              href="/battle"
              className="inline-block px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#fff', color: '#000' }}
            >
              Back to battle
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PickRow({ pick }) {
  const status = (pick.status || '').toLowerCase();
  const isWon = status === 'won';
  const isLost = status === 'lost';
  const statusColor = isWon ? '#22c55e' : isLost ? '#ef4444' : status === 'push' ? '#9ca3af' : '#facc15';
  const statusLabel = isWon ? 'Won' : isLost ? 'Lost' : status === 'push' ? 'Push' : 'Open';
  const oddsValue = pick.odds;
  const oddsText = oddsValue
    ? (Number(oddsValue) > 0 ? `+${oddsValue}` : `${oddsValue}`)
    : '';

  return (
    <div
      className="rounded-lg p-2.5 text-[12px]"
      style={{ background: '#0a0a0a', border: `1px solid ${cardBorder}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate" style={{ color: textPrimary }}>
            {pick.selection || pick.matchup || 'Pick'}
          </div>
          {pick.matchup && pick.selection && (
            <div className="truncate text-[11px]" style={{ color: textSecondary }}>
              {pick.matchup}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: textSecondary }}>
            {pick.betType && <span className="uppercase tracking-wider">{pick.betType}</span>}
            {oddsText && <span>{oddsText}</span>}
            <span>${formatMoney(pick.stake || 0, 2)}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div
            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: statusColor, border: `1px solid ${statusColor}55` }}
          >
            {statusLabel}
          </div>
          {(isWon || isLost) && (
            <div
              className="mt-1 text-[12px] font-semibold"
              style={{ color: isWon ? '#22c55e' : '#ef4444' }}
            >
              {isWon ? '+' : '-'}${formatMoney(Math.abs(pick.profit || 0), 2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerColumn({ player, balance, isWinner, isTie, picks, side }) {
  const ringColor = isWinner ? '#facc15' : isTie ? '#9ca3af' : side === 'left' ? '#3b82f6' : '#ef4444';
  const headerLabel = isWinner ? 'Winner' : isTie ? 'Tie' : 'Lost';
  const headerColor = isWinner ? '#facc15' : isTie ? '#9ca3af' : '#ef4444';

  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${isWinner ? 'rgba(250,204,21,0.45)' : cardBorder}`,
        boxShadow: isWinner ? '0 0 18px rgba(250,204,21,0.12)' : 'none',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div style={{ borderRadius: '9999px', boxShadow: `0 0 0 2px ${ringColor}` }}>
          <FramedAvatar user={player} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          {player?.id ? (
            <Link
              href={`/profile/${player.id}`}
              className="font-bold text-sm truncate hover:underline block"
              style={{ color: textPrimary }}
            >
              {player?.username || 'Player'}
            </Link>
          ) : (
            <div className="font-bold text-sm truncate" style={{ color: textPrimary }}>
              {player?.username || 'Player'}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: headerColor }}>
            {headerLabel}
          </div>
        </div>
      </div>

      <div
        className="rounded-lg px-3 py-2 mb-3"
        style={{ background: '#0a0a0a', border: `1px solid ${cardBorder}` }}
      >
        <div className="text-[10px] uppercase tracking-wider" style={{ color: textSecondary }}>
          Final score
        </div>
        <div className="text-xl font-black" style={{ color: isWinner ? '#facc15' : textPrimary }}>
          ${formatMoney(balance || 0, 0)}
        </div>
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: textSecondary }}>
        {picks.length > 0 ? `${picks.length} ${picks.length === 1 ? 'pik' : 'piks'}` : 'No piks placed'}
      </div>
      <div className="flex flex-col gap-1.5">
        {picks.map((pick) => (
          <PickRow key={pick.id} pick={pick} />
        ))}
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
        description = `${preview.winnerUsername} won a ${preview.mode.toLowerCase()} battle on Piks and took home ${preview.prize}. Watch the replay.`;
      } else {
        title = `${u1} vs ${u2} · Battle replay · Piks`;
        description = `${preview.mode} battle replay on Piks · ${preview.prize} pot.`;
      }
    } else {
      title = `${u1} vs ${u2} · Battle replay · Piks`;
      description = `${preview.mode} battle on Piks · ${preview.prize} prize pool · ${preview.statusLabel}.`;
    }

    return {
      props: {
        battlePreview: {
          ...preview,
          origin,
          title,
          description,
          url: `/battle/replay/${encodeURIComponent(id)}`,
        },
      },
    };
  } catch (_err) {
    return { props: {} };
  }
}

export default function BattleReplayPage() {
  const router = useRouter();
  const { id } = router.query;
  const auth = useAuth();
  const isSignedIn = !!auth?.user;

  const handleSignUpClick = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('beta_access', 'true');
    } catch (_e) {}
    window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }));
  };
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moreBattles, setMoreBattles] = useState([]);

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/battles/public/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setError('not_found');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('error');
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setBattle(data?.battle || null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('error');
          setLoading(false);
        }
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
        const list = Array.isArray(data?.battles) ? data.battles : [];
        setMoreBattles(list);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNavbar />
        <div className="max-w-md mx-auto px-4 py-10">
          <div
            className="rounded-xl p-6 animate-pulse"
            style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
          >
            <div className="h-4 w-24 rounded mb-4" style={{ background: '#1a1a1a' }} />
            <div className="h-20 rounded mb-3" style={{ background: '#1a1a1a' }} />
            <div className="h-20 rounded" style={{ background: '#1a1a1a' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <StatusMessage
        title="Replay not found"
        message="This battle doesn't exist or is no longer available."
      />
    );
  }

  if (error || !battle) {
    return (
      <StatusMessage
        title="Couldn't load replay"
        message="Something went wrong loading this battle. Please try again in a moment."
      />
    );
  }

  if (battle.status === 'cancelled') {
    return (
      <StatusMessage
        title="Battle cancelled"
        message="This matchup was cancelled before it finished, so there's nothing to replay."
      />
    );
  }

  if (battle.status !== 'completed') {
    return (
      <StatusMessage
        title="Battle still in progress"
        message="Replays only become available after a battle ends."
      />
    );
  }

  const { player, opponent, myBalance, oppBalance, myBets = [], opponentBets = [], potSize, winnerPayout, outcome, endsAt } = battle;

  const player1IsWinner = outcome === 'won';
  const player2IsWinner = outcome === 'lost';
  const isTie = outcome === 'tie';

  const headline = isTie
    ? 'It was a tie'
    : `${(player1IsWinner ? player?.username : opponent?.username) || 'Player'} won`;

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar />
      <div className="max-w-md mx-auto px-4 py-5">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/battle"
            className="text-[12px] font-semibold inline-flex items-center gap-1 hover:underline"
            style={{ color: textSecondary }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to battles
          </Link>
          {endsAt && (
            <span className="text-[11px]" style={{ color: textSecondary }}>
              {formatLastSeen(endsAt)}
            </span>
          )}
        </div>

        <div
          className="rounded-xl p-4 mb-4 text-center"
          style={{
            background: 'linear-gradient(160deg, rgba(30,41,59,0.6) 0%, rgba(15,15,15,0.95) 100%)',
            border: '1px solid rgba(250,204,21,0.35)',
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textSecondary }}>
            Battle replay
          </div>
          <div className="text-xl font-black mt-1" style={{ color: textPrimary }}>
            {headline}
          </div>
          <div className="mt-3 inline-flex flex-col items-center px-4 py-2 rounded-lg" style={{ background: '#0a0a0a', border: `1px solid ${cardBorder}` }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: textSecondary }}>
              {isTie ? 'Pot' : 'Winner payout'}
            </div>
            <div className="text-2xl font-black" style={{ color: '#facc15' }}>
              ${formatMoney(isTie ? potSize : (winnerPayout || potSize), 2)}
            </div>
            {!isTie && potSize > 0 && (
              <div className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                Pot ${formatMoney(potSize, 2)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <PlayerColumn
            player={player}
            balance={myBalance}
            isWinner={player1IsWinner}
            isTie={isTie}
            picks={myBets}
            side="left"
          />
          <PlayerColumn
            player={opponent}
            balance={oppBalance}
            isWinner={player2IsWinner}
            isTie={isTie}
            picks={opponentBets}
            side="right"
          />
        </div>

        {(() => {
          const others = moreBattles.filter(b => String(b.id) !== String(id)).slice(0, 5);
          if (others.length === 0) return null;
          return (
            <div
              className="mt-5 rounded-xl p-3"
              style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                  More recent battles
                </span>
                <span className="text-[10px]" style={{ color: textSecondary }}>
                  Just finished
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {others.map((b) => (
                  <Link
                    key={b.id}
                    href={`/battle/replay/${b.id}`}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-white/5"
                    style={{ background: '#0a0a0a', border: `1px solid ${cardBorder}` }}
                  >
                    <FramedAvatar user={b.winner} size={28} />
                    <div className="min-w-0 flex-1 text-[11px] leading-tight" style={{ color: textPrimary }}>
                      <div className="truncate">
                        <span className="font-semibold text-green-400">
                          {b.winner?.username || 'Player'}
                        </span>
                        <span style={{ color: textSecondary }}> beat </span>
                        <span className="font-medium">
                          {b.loser?.username || 'Player'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ color: textSecondary }}>
                        <span className="font-semibold text-yellow-400">${formatMoney(b.potSize, 0)} pot</span>
                        <span>·</span>
                        <span>{formatLastSeen(b.endedAt)}</span>
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-5 text-center">
          {isSignedIn ? (
            <Link
              href="/battle"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)', color: '#000' }}
            >
              Start your own battle
            </Link>
          ) : (
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
            >
              <div className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>
                Want in on the action?
              </div>
              <div className="text-[12px] mb-3" style={{ color: textSecondary }}>
                Create a free account and battle your friends head-to-head.
              </div>
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

