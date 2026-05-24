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
          background: 'linear-gradient(180deg, #0b1830 0%, #061022 55%, #03070f 100%)',
          border: '2.5px solid #0a0a0a',
          boxShadow: '0 10px 0 #0a0a0a, 0 0 60px rgba(6,182,212,0.32), inset 0 0 0 1.5px rgba(6,182,212,0.55)',
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
            0%, 100% { transform: translateY(0); box-shadow: 0 5px 0 #0a0a0a, 0 0 28px rgba(251,146,60,0.55); }
            50% { transform: translateY(-2px); box-shadow: 0 7px 0 #0a0a0a, 0 0 38px rgba(251,146,60,0.8); }
          }
          @keyframes mbomLiveDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(1.25); }
          }
          @keyframes mbomBolt {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(0.92); }
          }
          .mbom-fade-in { animation: mbomFadeIn 0.18s ease-out; }
          .mbom-pop-in { animation: mbomPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1); }
          .mbom-slam-left { animation: mbomSlamLeft 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
          .mbom-slam-right { animation: mbomSlamRight 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
          .mbom-cta { animation: mbomCtaPulse 1.5s ease-in-out infinite; }
          .mbom-live-dot { animation: mbomLiveDot 1.2s ease-in-out infinite; }
          .mbom-bolt { animation: mbomBolt 0.9s ease-in-out infinite; }
        `}</style>

        {/* Cyan corner brackets — gaming HUD frame, matches the
            walkthrough + QuickMatchModal cartoon style. */}
        {['tl','tr','bl','br'].map(pos => {
          const base = { position: 'absolute', width: 20, height: 20, pointerEvents: 'none', zIndex: 3 };
          const stroke = '2.5px solid #06b6d4';
          const glow = { filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' };
          const map = {
            tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke, borderTopLeftRadius: 8 },
            tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke, borderTopRightRadius: 8 },
            bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke, borderBottomLeftRadius: 8 },
            br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke, borderBottomRightRadius: 8 },
          };
          return <span key={pos} aria-hidden="true" style={{ ...base, ...map[pos], ...glow }} />;
        })}

        {/* Header — close button + arcade-style stacked title */}
        <div className="px-5 pt-5 pb-1 flex items-start justify-between relative" style={{ zIndex: 4 }}>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full mbom-live-dot flex-shrink-0"
              style={{ width: 9, height: 9, background: '#10b981', boxShadow: '0 0 10px #10b981, 0 0 0 2px #0a0a0a' }}
              aria-hidden="true"
            />
            <span className="text-emerald-300 text-[9px] font-black uppercase" style={{ letterSpacing: '0.22em', textShadow: '0 1px 0 #0a0a0a' }}>
              Live
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)', border: '2.5px solid #0a0a0a', boxShadow: '0 2px 0 #0a0a0a' }}
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stacked arcade hero title — yellow fill, black stroke, orange glow */}
        <div className="px-5 pt-1 pb-3 text-center relative">
          <div className="flex items-center justify-center gap-2.5">
            <span aria-hidden="true" className="mbom-bolt" style={{
              fontSize: 26, lineHeight: 1, color: '#facc15',
              filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.95)) drop-shadow(0 0 6px rgba(251,146,60,0.8)) drop-shadow(0 2px 0 #0a0a0a)',
            }}>⚡</span>
            <h2
              id="mbom-title"
              className="font-black uppercase text-center"
              style={{
                color: '#facc15',
                fontSize: 'clamp(26px, 7.5vw, 34px)',
                lineHeight: 0.92,
                letterSpacing: '0.02em',
                fontStyle: 'italic',
                WebkitTextStroke: '1.5px #0a0a0a',
                textShadow: '0 3px 0 #0a0a0a, 0 0 16px rgba(251,146,60,0.7), 0 0 30px rgba(251,146,60,0.4)',
                margin: 0,
                fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
              }}
            >
              You&apos;re In Battle!
            </h2>
            <span aria-hidden="true" className="mbom-bolt" style={{
              fontSize: 26, lineHeight: 1, color: '#facc15',
              animationDelay: '0.15s',
              filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.95)) drop-shadow(0 0 6px rgba(251,146,60,0.8)) drop-shadow(0 2px 0 #0a0a0a)',
            }}>⚡</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
            <p className="font-black uppercase whitespace-nowrap text-center" style={{ color: '#7dd3fc', fontSize: 10, letterSpacing: '0.2em', textShadow: '0 0 10px rgba(6,182,212,0.7)', margin: 0 }}>
              vs <span className="text-white">{opponent?.username || 'Opponent'}</span> · <span style={{ color: mode.color }}>{mode.label}</span>
            </p>
            <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(270deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
          </div>
        </div>

        {/* Mode banner — cartoon card with chunky black border + hard shadow */}
        <div className="px-5 pb-3">
          <div
            className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
              border: `2.5px solid ${mode.color}`,
              boxShadow: `0 4px 0 #0a0a0a, 0 0 16px ${mode.color}55`,
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                background: `linear-gradient(180deg,${mode.color},${mode.color}cc)`,
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
                fontSize: 22,
              }}
              aria-hidden="true"
            >
              {mode.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[10px] font-black uppercase"
                style={{ color: mode.color, letterSpacing: '0.2em', textShadow: '0 1px 0 #0a0a0a' }}
              >
                {mode.label} MODE
              </div>
              <div className="text-white text-xs font-bold mt-0.5 leading-snug">
                {mode.tagline}
              </div>
            </div>
            <div
              className="flex-shrink-0 px-2 py-1 rounded-md text-[9px] font-black uppercase whitespace-nowrap"
              style={{
                background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                color: '#facc15',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
                letterSpacing: '0.1em',
              }}
            >
              {mode.durationLabel}
            </div>
          </div>
        </div>

        {/* Avatars + VS — crown on host, neon ring borders, name pills with hard shadow */}
        <div className="flex items-start justify-center gap-2 sm:gap-3 px-3 sm:px-5 pb-2">
          <div className="flex flex-col items-center mbom-slam-left flex-shrink min-w-0" style={{ flexBasis: 110, maxWidth: 110 }}>
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginBottom: 2, filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.85)) drop-shadow(0 1px 0 #0a0a0a)' }}>👑</span>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 72, height: 72,
                border: '3.5px solid #0a0a0a',
                background: '#0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.6), inset 0 0 0 2.5px #3b82f6',
              }}
            >
              <UserAvatar user={myProfile} size={64} />
            </div>
            <div className="mt-2 text-white text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
              background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
              border: '2.5px solid #3b82f6',
              boxShadow: '0 2px 0 #0a0a0a, 0 0 8px rgba(59,130,246,0.4)',
              letterSpacing: '0.06em',
            }}>
              {myProfile?.username || 'You'}
            </div>
            <div
              className="mt-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md"
              style={{
                background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
                letterSpacing: '0.14em',
              }}
            >
              You
            </div>
          </div>

          <div className="flex flex-col items-center flex-shrink-0 self-center" style={{ minWidth: 48 }}>
            <div className="text-3xl font-black italic" style={{
              color: '#facc15',
              fontFamily: 'Impact, "Arial Black", sans-serif',
              WebkitTextStroke: '1.5px #0a0a0a',
              textShadow: '0 3px 0 #0a0a0a, 0 0 14px rgba(251,146,60,0.7)',
              letterSpacing: '0.04em',
            }}>VS</div>
          </div>

          <div className="flex flex-col items-center mbom-slam-right flex-shrink min-w-0" style={{ flexBasis: 110, maxWidth: 110 }}>
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginBottom: 2, opacity: 0 }}>👑</span>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 72, height: 72,
                border: '3.5px solid #0a0a0a',
                background: '#0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a, 0 0 18px rgba(251,146,60,0.6), inset 0 0 0 2.5px #fb923c',
              }}
            >
              <UserAvatar
                user={opponent ? { id: opponent.id, username: opponent.username, avatar: opponent.avatar } : null}
                size={64}
              />
            </div>
            <div className="mt-2 text-white text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
              background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
              border: '2.5px solid #fb923c',
              boxShadow: '0 2px 0 #0a0a0a, 0 0 8px rgba(251,146,60,0.4)',
              letterSpacing: '0.06em',
            }}>
              {opponent?.username || 'Opponent'}
            </div>
            <div
              className="mt-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md"
              style={{
                background: 'linear-gradient(180deg,#fb923c,#c2410c)',
                color: '#fff',
                border: '2px solid #0a0a0a',
                boxShadow: '0 2px 0 #0a0a0a',
                letterSpacing: '0.14em',
              }}
            >
              Opp
            </div>
          </div>
        </div>

        {/* Stakes capsule — orange-bordered, matches walkthrough info bar */}
        <div className="px-3 sm:px-5 py-3">
          <div
            className="mx-auto rounded-full px-3 py-2 flex items-center justify-center flex-wrap gap-x-2 gap-y-1"
            style={{
              background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
              border: '2.5px solid #facc15',
              boxShadow: '0 4px 0 #0a0a0a, 0 0 16px rgba(250,204,21,0.45), inset 0 0 0 1px rgba(250,204,21,0.4)',
              maxWidth: 380,
            }}
          >
            <span style={{ fontSize: 16, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }} aria-hidden="true">🪙</span>
            <span className="text-white font-black text-[12px] uppercase" style={{ letterSpacing: '0.06em', color: '#facc15' }}>
              {buyInLabel}
            </span>
            <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>·</span>
            <span className="text-white font-black text-[12px] uppercase" style={{ letterSpacing: '0.06em', color: '#facc15' }}>
              {potLabel}
            </span>
            <span style={{ fontSize: 16, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }} aria-hidden="true">🏆</span>
          </div>
        </div>

        {/* Cartoon stat tiles — hard shadows + colored glows */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: '🟢', label: 'Live Now', color: '#10b981', glow: 'rgba(16,185,129,0.5)' },
              { icon: '🎯', label: 'Place Picks', color: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
              { icon: isRush ? '⚡' : '⏰', label: isRush ? 'Race Now' : 'Ends Today', color: '#facc15', glow: 'rgba(250,204,21,0.5)' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-1.5 py-2 flex flex-col items-center text-center"
                style={{
                  background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
                  border: `2.5px solid ${s.color}`,
                  boxShadow: `0 3px 0 #0a0a0a, 0 0 10px ${s.glow}`,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }}>{s.icon}</span>
                <div className="text-white text-[9px] font-black uppercase mt-1 leading-tight" style={{ color: s.color, letterSpacing: '0.12em', textShadow: '0 1px 0 #0a0a0a' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs — orange OPEN BATTLE w/ yellow chevron caps */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleOpen}
            className="mbom-cta no-hover-effect w-full rounded-2xl font-black uppercase flex items-center justify-between gap-2 px-3 py-3"
            style={{
              background: 'linear-gradient(180deg,#fb923c 0%,#ea580c 55%,#c2410c 100%)',
              border: '2.5px solid #0a0a0a',
              color: '#fff',
              letterSpacing: '0.06em',
              textShadow: '0 2px 0 rgba(0,0,0,0.55)',
              boxShadow: '0 5px 0 #0a0a0a, 0 0 28px rgba(251,146,60,0.55), inset 0 0 0 1.5px rgba(250,204,21,0.7)',
              fontFamily: 'Impact, "Arial Black", system-ui, -apple-system, sans-serif',
            }}
          >
            <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: 'linear-gradient(180deg,#0a0a0a,#1a1a1a)', border: '2.5px solid #facc15', boxShadow: '0 0 12px rgba(250,204,21,0.85), inset 0 0 6px rgba(250,204,21,0.3)', color: '#facc15', fontSize: 15 }}>»</span>
            <span style={{ fontSize: 19, fontStyle: 'italic', WebkitTextStroke: '1px #0a0a0a' }}>
              {isRush ? 'Jump Into Rush' : 'Open Battle'}
            </span>
            <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: 'linear-gradient(180deg,#0a0a0a,#1a1a1a)', border: '2.5px solid #facc15', boxShadow: '0 0 12px rgba(250,204,21,0.85), inset 0 0 6px rgba(250,204,21,0.3)', color: '#facc15', fontSize: 15 }}>«</span>
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {onForfeit ? (
              <button
                type="button"
                onClick={handleForfeit}
                className="no-hover-effect py-3 rounded-xl font-black text-xs uppercase"
                style={{
                  background: 'linear-gradient(180deg,#1a0b0b,#0d0606)',
                  border: '2.5px solid #ef4444',
                  color: '#fca5a5',
                  letterSpacing: '0.12em',
                  boxShadow: '0 3px 0 #0a0a0a, 0 0 10px rgba(239,68,68,0.3)',
                }}
              >
                Forfeit
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="no-hover-effect py-3 rounded-xl font-black text-xs uppercase"
                style={{
                  background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                  border: '2.5px solid #0a0a0a',
                  color: '#9ca3af',
                  letterSpacing: '0.12em',
                  boxShadow: '0 3px 0 #0a0a0a',
                }}
              >
                Close
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="no-hover-effect py-3 rounded-xl font-black text-xs uppercase"
              style={{
                background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
                border: '2.5px solid #1a2238',
                color: '#9ca3af',
                letterSpacing: '0.12em',
                boxShadow: '0 3px 0 #0a0a0a',
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
