import { useEffect, useState } from 'react';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';

const MODE_META = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    color: '#fb923c',
    tagline: '6 quick props from one live game',
    durationLabel: 'Live · ~3 min',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    color: '#3b82f6',
    tagline: 'Highest balance after the games end wins',
    durationLabel: 'Ends after today',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    color: '#10b981',
    tagline: '3-day grind for a massive bankroll',
    durationLabel: '3-day battle',
  },
};

function modeMetaFor(n) {
  return MODE_META[n] || MODE_META.original;
}

function compactCoins(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 ? 1 : 0)}K`;
  return String(v);
}

function UserAvatar({ user, size = 72 }) {
  return <SharedUserAvatar user={user} size={size} />;
}

export default function MyBattleOverviewModal({
  isOpen,
  onClose,
  matchup,
  opponent,
  myProfile,
  onOpenBattle,
  onForfeit,
  isBeta = false,
}) {
  useModalScrollLock(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) setClosing(false);
  }, [isOpen]);

  if (!isOpen || !matchup) return null;

  const mode = modeMetaFor(matchup?.durationType || 'original');
  const isRush = matchup?.durationType === 'rush';
  const pot = (() => {
    const ps = parseFloat(matchup?.potSize);
    if (Number.isFinite(ps)) return ps;
    const sb = parseFloat(matchup?.startingBalance);
    if (Number.isFinite(sb)) return sb * 2;
    return null;
  })();
  const buyIn = (() => {
    const sb = parseFloat(matchup?.startingBalance);
    if (Number.isFinite(sb)) return sb;
    if (pot != null) return pot / 2;
    return null;
  })();

  const buyInLabel = buyIn != null
    ? (isBeta ? `${compactCoins(buyIn)} coins` : `$${compactCoins(buyIn)}`)
    : '—';
  const potLabel = pot != null
    ? (isBeta ? `${compactCoins(pot)} pot` : `$${compactCoins(pot)} pot`)
    : '—';

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose && onClose(), 150);
  };

  const handleOpen = () => {
    if (onOpenBattle) onOpenBattle(matchup);
    close();
  };

  const handleForfeit = () => {
    if (onForfeit) onForfeit(matchup);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 mbom-fade-in"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden mbom-pop-in"
        style={{
          background: 'linear-gradient(180deg, #0d1320 0%, #0a0d18 100%)',
          border: '2.5px solid #1a2238',
          boxShadow: '0 18px 0 rgba(0,0,0,0.55), 0 0 0 1px rgba(59,130,246,0.18) inset',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mbom-title"
      >
        <style jsx>{`
          @keyframes mbomFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes mbomPopIn {
            0% { transform: scale(0.86) translateY(14px); opacity: 0; }
            70% { transform: scale(1.03) translateY(0); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes mbomSlamLeft {
            0% { transform: translateX(-30px) scale(0.9); opacity: 0; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes mbomSlamRight {
            0% { transform: translateX(30px) scale(0.9); opacity: 0; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes mbomCtaPulse {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @keyframes mbomLiveDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(1.25); }
          }
          .mbom-fade-in { animation: mbomFadeIn 0.18s ease-out; }
          .mbom-pop-in { animation: mbomPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1); }
          .mbom-slam-left { animation: mbomSlamLeft 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
          .mbom-slam-right { animation: mbomSlamRight 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
          .mbom-cta { animation: mbomCtaPulse 1.5s ease-in-out infinite; }
          .mbom-live-dot { animation: mbomLiveDot 1.2s ease-in-out infinite; }
        `}</style>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full mbom-live-dot"
                style={{ width: 8, height: 8, background: '#10b981', boxShadow: '0 0 10px #10b981' }}
              />
              <h2
                id="mbom-title"
                className="text-lg font-black text-white truncate"
                style={{ letterSpacing: '0.02em' }}
              >
                You're In Battle!
              </h2>
            </div>
            <p className="text-xs mt-1 text-gray-400">
              vs <span className="font-bold text-white">{opponent?.username || 'Opponent'}</span>
              <span className="mx-1.5 text-gray-600">·</span>
              <span className="font-semibold" style={{ color: mode.color }}>{mode.label}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#1a1a1a', border: '2px solid #0a0a0a' }}
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode banner */}
        <div className="px-5 pb-3">
          <div
            className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: '#0f1424',
              border: `2.5px solid ${mode.color}`,
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                background: mode.color,
                border: '2px solid #0a0a0a',
                fontSize: 24,
              }}
              aria-hidden="true"
            >
              {mode.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[10px] font-extrabold uppercase"
                style={{ color: mode.color, letterSpacing: '0.18em' }}
              >
                {mode.label} MODE
              </div>
              <div className="text-white text-xs font-semibold mt-0.5 leading-snug">
                {mode.tagline}
              </div>
            </div>
            <div
              className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase whitespace-nowrap"
              style={{
                background: '#1a1a1a',
                color: '#fff',
                border: '2px solid #0a0a0a',
                letterSpacing: '0.08em',
              }}
            >
              {mode.durationLabel}
            </div>
          </div>
        </div>

        {/* Avatars + VS */}
        <div className="flex items-center justify-center gap-3 md:gap-5 px-5 pb-2">
          <div className="flex flex-col items-center mbom-slam-left" style={{ width: 110 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 84, height: 84,
                border: '3px solid #3b82f6',
                background: '#0a1124',
                boxShadow: '0 0 0 4px rgba(59,130,246,0.18)',
              }}
            >
              <UserAvatar user={myProfile} size={76} />
            </div>
            <div className="mt-2 text-xs font-extrabold text-white truncate max-w-[100px]">
              {myProfile?.username || 'You'}
            </div>
            <div
              className="mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: '2px solid #1d4ed8',
                letterSpacing: '0.12em',
              }}
            >
              You
            </div>
          </div>

          <div className="flex flex-col items-center px-1">
            <div
              className="text-3xl md:text-4xl font-black italic"
              style={{ color: '#facc15', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              VS
            </div>
          </div>

          <div className="flex flex-col items-center mbom-slam-right" style={{ width: 110 }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 84, height: 84,
                border: '3px solid #fb923c',
                background: '#1a0d05',
                boxShadow: '0 0 0 4px rgba(251,146,60,0.18)',
              }}
            >
              <UserAvatar
                user={opponent ? { id: opponent.id, username: opponent.username, avatar: opponent.avatar } : null}
                size={76}
              />
            </div>
            <div className="mt-2 text-xs font-extrabold text-white truncate max-w-[100px]">
              {opponent?.username || 'Opponent'}
            </div>
            <div
              className="mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md"
              style={{
                background: '#fb923c',
                color: '#fff',
                border: '2px solid #c2410c',
                letterSpacing: '0.12em',
              }}
            >
              Opponent
            </div>
          </div>
        </div>

        {/* Stakes pill */}
        <div className="px-5 py-3">
          <div
            className="mx-auto rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2 whitespace-nowrap"
            style={{
              background: '#0f1424',
              border: '2px solid #facc15',
              maxWidth: 380,
            }}
          >
            <span style={{ fontSize: 22 }} aria-hidden="true">🪙</span>
            <span className="text-white font-extrabold text-sm md:text-base" style={{ letterSpacing: '0.02em' }}>
              <span style={{ color: '#facc15' }}>{buyInLabel}</span>
              <span className="text-gray-400 mx-1.5">·</span>
              <span style={{ color: '#facc15' }}>{potLabel}</span>
            </span>
            <span style={{ fontSize: 22 }} aria-hidden="true">🏆</span>
          </div>
        </div>

        {/* Quick stat strip */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#052016', border: '2px solid #10b981' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">🟢</span>
              <div className="text-[8.5px] font-extrabold uppercase text-emerald-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                Live Now
              </div>
            </div>
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#0a1124', border: '2px solid #3b82f6' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">🎯</span>
              <div className="text-[8.5px] font-extrabold uppercase text-blue-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                Place Picks
              </div>
            </div>
            <div
              className="rounded-xl px-2 py-2 flex flex-col items-center text-center"
              style={{ background: '#1a1505', border: '2px solid #facc15' }}
            >
              <span style={{ fontSize: 18 }} aria-hidden="true">{isRush ? '⚡' : '⏰'}</span>
              <div className="text-[8.5px] font-extrabold uppercase text-yellow-300 mt-1 leading-tight" style={{ letterSpacing: '0.08em' }}>
                {isRush ? 'Race Now' : 'Ends Today'}
              </div>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleOpen}
            className="mbom-cta no-hover-effect w-full py-4 rounded-2xl font-black text-lg uppercase flex items-center justify-center gap-2"
            style={{
              background: '#3b82f6',
              border: '2.5px solid #1d4ed8',
              color: '#fff',
              letterSpacing: '0.08em',
              boxShadow: '0 4px 0 #1e3a8a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <span aria-hidden="true">⚔️</span>
            {isRush ? 'Jump Into Rush' : 'Open Battle'}
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {onForfeit ? (
              <button
                type="button"
                onClick={handleForfeit}
                className="no-hover-effect py-3 rounded-xl font-extrabold text-sm uppercase"
                style={{
                  background: '#1a0b0b',
                  border: '2px solid #ef4444',
                  color: '#fca5a5',
                  letterSpacing: '0.08em',
                }}
              >
                Forfeit
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="no-hover-effect py-3 rounded-xl font-extrabold text-sm uppercase"
                style={{
                  background: '#1a1a1a',
                  border: '2px solid #0a0a0a',
                  color: '#9ca3af',
                  letterSpacing: '0.08em',
                }}
              >
                Close
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="no-hover-effect py-3 rounded-xl font-extrabold text-sm uppercase"
              style={{
                background: 'transparent',
                border: '2px solid #1a1a1a',
                color: '#6b7280',
                letterSpacing: '0.08em',
              }}
            >
              Stay Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
