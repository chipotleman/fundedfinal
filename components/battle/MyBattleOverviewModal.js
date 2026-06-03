import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import SharedUserAvatar from '../UserAvatar';
import SlideToForfeit from './SlideToForfeit';
import { useTheme } from '../../contexts/ThemeContext';

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

function fmtBalance(n, isBeta) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return isBeta ? compactCoins(v) : `$${compactCoins(v)}`;
}

function PnlPill({ pnl }) {
  const v = Number(pnl);
  if (!Number.isFinite(v) || v === 0) {
    return (
      <span className="text-[9px] font-black" style={{ color: '#94a3b8', letterSpacing: '0.04em' }}>
        EVEN
      </span>
    );
  }
  const pos = v > 0;
  return (
    <span
      className="text-[9px] font-black"
      style={{ color: pos ? '#34d399' : '#f87171', letterSpacing: '0.04em' }}
    >
      {pos ? '+' : ''}{v.toFixed(1)}%
    </span>
  );
}

function PlayerStat({ balance, pnl, isBeta, accent, textColor = '#fff' }) {
  const label = fmtBalance(balance, isBeta);
  if (label == null) return null;
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      <span className="text-[13px] font-black tabular-nums" style={{ color: textColor, textShadow: `0 0 8px ${accent}55` }}>
        {label}
      </span>
      <PnlPill pnl={pnl} />
    </div>
  );
}

export default function MyBattleOverviewModal({
  isOpen,
  onClose,
  matchup,
  opponent,
  myProfile,
  onOpenBattle,
  onForfeit,
  onMessageOpponent,
  onViewUpdates,
  myLiveBalance = null,
  opponentLiveBalance = null,
  myUnrealizedPnl = null,
  opponentUnrealizedPnl = null,
  isBeta = false,
}) {
  useModalScrollLock(isOpen);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) setClosing(false);
  }, [isOpen]);

  if (!isOpen || !matchup) return null;
  // Render through a portal to document.body so the fixed-position overlay
  // escapes any ancestor with a transform/filter/animation (e.g. the
  // LiveBattlesSection cartoon pop-in / HUD frames). Without this, the
  // transformed ancestor becomes the containing block for `position: fixed`,
  // trapping the modal inside that container on mobile — it fills the
  // container, pushes page content down, and scrolls within itself.
  if (typeof document === 'undefined') return null;

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

  // Theme tokens. The cartoon HUD keeps its chunky black borders + neon
  // accents in both themes; only the dark panel/card/pill surfaces and the
  // white text flip to light so the popup matches the rest of the app when
  // light mode is on (it used to stay dark regardless of theme).
  const t = isLight
    ? {
        panel: 'linear-gradient(180deg,#ffffff 0%,#f7f3ea 55%,#efe9dc 100%)',
        panelShadow: '0 10px 0 #0a0a0a, 0 0 50px rgba(6,182,212,0.18), inset 0 0 0 1.5px rgba(6,182,212,0.35)',
        card: 'linear-gradient(180deg,#ffffff,#f4efe4)',
        pill: 'linear-gradient(180deg,#ffffff,#f1ecdf)',
        textMain: '#0f172a',
        closeIcon: '#475569',
        durationText: '#a16207',
        backdrop: 'rgba(15,23,42,0.45)',
      }
    : {
        panel: 'linear-gradient(180deg, #0b1830 0%, #061022 55%, #03070f 100%)',
        panelShadow: '0 10px 0 #0a0a0a, 0 0 60px rgba(6,182,212,0.32), inset 0 0 0 1.5px rgba(6,182,212,0.55)',
        card: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
        pill: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
        textMain: '#ffffff',
        closeIcon: '#d1d5db',
        durationText: '#facc15',
        backdrop: 'rgba(0,0,0,0.78)',
      };

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

  const handleMessage = () => {
    if (onMessageOpponent) onMessageOpponent(opponent);
    close();
  };

  const handleViewUpdates = () => {
    if (onViewUpdates) onViewUpdates(matchup);
    close();
  };

  return createPortal((
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 mbom-fade-in"
      style={{ background: t.backdrop }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden mbom-pop-in"
        style={{
          background: t.panel,
          border: '2.5px solid #0a0a0a',
          boxShadow: t.panelShadow,
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
            <span className="text-[9px] font-black uppercase" style={{ color: isLight ? '#059669' : '#6ee7b7', letterSpacing: '0.22em', textShadow: isLight ? 'none' : '0 1px 0 #0a0a0a' }}>
              Live
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: t.pill, border: '2.5px solid #0a0a0a', boxShadow: '0 2px 0 #0a0a0a' }}
          >
            <svg className="w-4 h-4" style={{ color: t.closeIcon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p className="font-black uppercase whitespace-nowrap text-center" style={{ color: isLight ? '#0e7490' : '#7dd3fc', fontSize: 10, letterSpacing: '0.2em', textShadow: isLight ? 'none' : '0 0 10px rgba(6,182,212,0.7)', margin: 0 }}>
              vs <span style={{ color: t.textMain }}>{opponent?.username || 'Opponent'}</span> · <span style={{ color: mode.color }}>{mode.label}</span>
            </p>
            <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: 'linear-gradient(270deg, transparent, #06b6d4)', boxShadow: '0 0 6px rgba(6,182,212,0.6)' }} />
          </div>
        </div>

        {/* Mode banner — cartoon card with chunky black border + hard shadow */}
        <div className="px-5 pb-3">
          <div
            className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: t.card,
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
                style={{ color: mode.color, letterSpacing: '0.2em', textShadow: isLight ? 'none' : '0 1px 0 #0a0a0a' }}
              >
                {mode.label} MODE
              </div>
              <div className="text-xs font-bold mt-0.5 leading-snug" style={{ color: t.textMain }}>
                {mode.tagline}
              </div>
            </div>
            <div
              className="flex-shrink-0 px-2 py-1 rounded-md text-[9px] font-black uppercase whitespace-nowrap"
              style={{
                background: t.pill,
                color: t.durationText,
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
            <div className="mt-2 text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
              background: t.pill,
              color: t.textMain,
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
            <PlayerStat balance={myLiveBalance} pnl={myUnrealizedPnl} isBeta={isBeta} accent="#3b82f6" textColor={t.textMain} />
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
            <div className="mt-2 text-[10px] font-black uppercase truncate w-full text-center px-2 py-1 rounded-lg" style={{
              background: t.pill,
              color: t.textMain,
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
            <PlayerStat balance={opponentLiveBalance} pnl={opponentUnrealizedPnl} isBeta={isBeta} accent="#fb923c" textColor={t.textMain} />
          </div>
        </div>

        {/* Stakes capsule — orange-bordered, matches walkthrough info bar */}
        <div className="px-3 sm:px-5 py-3">
          <div
            className="mx-auto rounded-full px-3 py-2 flex items-center justify-center flex-wrap gap-x-2 gap-y-1"
            style={{
              background: t.card,
              border: '2.5px solid #facc15',
              boxShadow: '0 4px 0 #0a0a0a, 0 0 16px rgba(250,204,21,0.45), inset 0 0 0 1px rgba(250,204,21,0.4)',
              maxWidth: 380,
            }}
          >
            <span style={{ fontSize: 16, filter: 'drop-shadow(0 1px 0 #0a0a0a)' }} aria-hidden="true">🪙</span>
            <span className="font-black text-[10px] uppercase" style={{ letterSpacing: '0.1em', color: isLight ? '#475569' : '#94a3b8' }}>
              Playing for
            </span>
            <span className="font-black text-[13px] uppercase" style={{ letterSpacing: '0.06em', color: t.durationText }}>
              {buyInLabel}
            </span>
          </div>
        </div>

        {/* Quick actions — message the opponent + jump to battle updates */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleMessage}
              className="no-hover-effect flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[12px]"
              style={{
                background: isLight
                  ? 'linear-gradient(180deg, #ecfeff, #cffafe)'
                  : 'linear-gradient(180deg, rgba(34,211,238,0.12), rgba(8,145,178,0.12))',
                border: isLight ? '1.5px solid #0891b2' : '1px solid rgba(34,211,238,0.4)',
                color: isLight ? '#0e7490' : '#67e8f9',
                letterSpacing: '0.04em',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="truncate">Message {opponent?.username ? opponent.username.split(' ')[0] : 'opponent'}</span>
            </button>
            <button
              type="button"
              onClick={handleViewUpdates}
              className="no-hover-effect flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[12px]"
              style={{
                background: isLight
                  ? 'linear-gradient(180deg, #eff6ff, #dbeafe)'
                  : 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(29,78,216,0.12))',
                border: isLight ? '1.5px solid #2563eb' : '1px solid rgba(59,130,246,0.4)',
                color: isLight ? '#1d4ed8' : '#93c5fd',
                letterSpacing: '0.04em',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="truncate">Battle updates</span>
            </button>
          </div>
        </div>

        {/* Rush keeps a primary CTA because it actually enters live gameplay.
            Original/Tournament battles are already "open" — you place picks on
            the dashboard — so a redundant "Open Battle" button is dropped. */}
        <div className="px-5 pb-5">
          {isRush && (
            <button
              type="button"
              onClick={handleOpen}
              className="mbom-cta no-hover-effect w-full rounded-2xl font-black uppercase flex items-center justify-between gap-2 px-3 py-3 mb-2"
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
                Jump Into Rush
              </span>
              <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: 'linear-gradient(180deg,#0a0a0a,#1a1a1a)', border: '2.5px solid #facc15', boxShadow: '0 0 12px rgba(250,204,21,0.85), inset 0 0 6px rgba(250,204,21,0.3)', color: '#facc15', fontSize: 15 }}>«</span>
            </button>
          )}
          {onForfeit ? (
            <SlideToForfeit onConfirm={handleForfeit} />
          ) : (
            <button
              type="button"
              onClick={close}
              className="no-hover-effect w-full py-3 rounded-xl font-black text-xs uppercase"
              style={{
                background: t.pill,
                border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid #1a2238',
                color: isLight ? '#475569' : '#9ca3af',
                letterSpacing: '0.12em',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}
