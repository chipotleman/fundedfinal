import { useState, useRef, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney } from '../utils/formatMoney';

const MODE_THEMES = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 25%, #1a0a00 50%, #0d0500 75%, #050200 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    prizeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    glowColor: 'rgba(251,146,60,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef3c7 0%, #fb923c 50%, #ea580c 100%)',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    cardBg: 'linear-gradient(135deg, #020a18 0%, #0a1628 25%, #122240 50%, #0d1a30 75%, #050d1a 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    prizeColor: '#facc15',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    glowColor: 'rgba(59,130,246,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 25%, #0a1a0e 50%, #040d06 75%, #020804 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    prizeColor: '#10b981',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    glowColor: 'rgba(16,185,129,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
};

function getGameMode(battle) {
  const dm = battle?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TicketCarousel({ cards, theme, emptyMessage }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const mouseStartX = useRef(null);
  const isDragging = useRef(false);

  const total = cards ? cards.length : 0;

  const prev = useCallback((e) => {
    e && e.stopPropagation();
    setIndex(i => Math.max(0, i - 1));
  }, []);

  const next = useCallback((e) => {
    e && e.stopPropagation();
    setIndex(i => Math.min(total - 1, i + 1));
  }, [total]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  const onMouseDown = (e) => {
    mouseStartX.current = e.clientX;
    isDragging.current = true;
  };

  const onMouseUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = mouseStartX.current - e.clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? next() : prev();
    }
    mouseStartX.current = null;
  };

  const onMouseLeave = () => {
    isDragging.current = false;
    mouseStartX.current = null;
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') prev(e);
    if (e.key === 'ArrowRight') next(e);
  };

  if (!cards || total === 0) {
    return <p className="text-xs text-gray-500 py-4 text-center">{emptyMessage}</p>;
  }

  if (total === 1) {
    return <div>{cards[0]}</div>;
  }

  return (
    <div className="select-none" onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {cards.map((card, i) => (
            <div key={i} className="w-full flex-shrink-0">
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.borderColor}` }}
          aria-label="Previous ticket"
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                background: i === index ? theme.accentColor : 'rgba(255,255,255,0.2)',
              }}
              aria-label={`Go to ticket ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={index === total - 1}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.borderColor}` }}
          aria-label="Next ticket"
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="text-[11px] font-bold tabular-nums" style={{ color: theme.accentColor }}>
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

export default function BattleHistoryGroup({
  battle,
  myProfile,
  betCount,
  opponentBetCount = 0,
  myBetCards,
  opponentBetCards,
  children,
  defaultExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState('mine');
  const { isDarkMode } = useTheme();

  const mode = getGameMode(battle);
  const theme = MODE_THEMES[mode];

  const myBalance = parseFloat(battle.myBalance ?? 0);
  const oppBalance = parseFloat(battle.oppBalance ?? 0);
  const startingBalance = parseFloat(battle.startingBalance ?? 0);
  const myPnL = myBalance - startingBalance;

  const outcome = battle.outcome || 'active';
  const isWon = outcome === 'won';
  const isLost = outcome === 'lost';
  const isTie = outcome === 'tie';
  const isActive = outcome === 'active';

  const userAvatar = myProfile?.avatar || null;
  const userName = myProfile?.username || 'You';
  const opponent = battle.opponent || { username: 'Opponent', avatar: null };

  const myPendingCount = Number(battle.myPendingCount) || 0;
  const opponentPendingCount = Number(battle.opponentPendingCount) || 0;
  const totalPendingCount = myPendingCount + opponentPendingCount;
  const showPendingNote = !isActive && totalPendingCount > 0;

  const outcomeBadge = isWon
    ? { label: 'WON', bg: 'bg-green-500/20', text: 'text-green-400', border: 'rgba(34,197,94,0.6)' }
    : isLost
    ? { label: 'LOST', bg: 'bg-red-500/20', text: 'text-red-400', border: 'rgba(239,68,68,0.6)' }
    : isTie
    ? { label: 'TIE', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'rgba(234,179,8,0.6)' }
    : { label: 'ACTIVE', bg: 'bg-blue-500/20', text: 'text-blue-400', border: theme.borderColor };

  return (
    <div className="w-full">
      <div
        onClick={() => setIsExpanded(v => !v)}
        className="w-full rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative active:scale-[0.99]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${outcomeBadge.border}`,
        }}
      >
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center bottom, ${theme.glowColor} 0%, transparent 60%)` }}
        />

        <div className="relative z-10 px-4 md:px-6 py-3 md:py-4">
          {/* Top row: mode badge + date + outcome */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: theme.badgeBg }}>
                <span className="text-[10px]">{theme.icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
                  {theme.label}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">{formatDate(battle.endsAt || battle.createdAt)}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-2 py-0.5 rounded-full ${outcomeBadge.bg}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${outcomeBadge.text}`}>
                  {outcomeBadge.label}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Main row: avatars / VS / opponent */}
          <div className="flex items-center w-full">
            <div className="flex flex-col items-center" style={{ width: '32%' }}>
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  border: `3px solid ${theme.avatarRing}`,
                  boxShadow: theme.avatarGlow,
                  background: '#111',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                )}
              </div>
              <p className="text-white text-[11px] font-bold truncate max-w-[90px] text-center mt-1">{userName}</p>
              <p className={`text-[10px] font-bold leading-tight ${myPnL > 0 ? 'text-green-400' : myPnL < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                ${formatMoney(myBalance, 0)}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center" style={{ width: '36%' }}>
              <div
                className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text"
                style={{
                  backgroundImage: theme.vsGradient,
                  WebkitBackgroundClip: 'text',
                }}
              >
                VS
              </div>
              <div className="text-center mt-0.5">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-none">
                  {isActive ? 'Prize' : 'Pot'}
                </p>
                <p className="text-sm md:text-base font-black leading-tight" style={{
                  color: theme.prizeColor,
                  textShadow: `0 0 10px rgba(${theme.accentRgb},0.4)`,
                }}>
                  ${formatMoney(battle.winnerPayout || battle.potSize || 0, 0)}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] leading-none">
                <span style={{ color: theme.accentColor }}>
                  <span className="font-bold">You</span>
                  <span className="text-white/80 ml-0.5">{betCount}</span>
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-red-300">
                  <span className="font-bold">Opp</span>
                  <span className="text-white/80 ml-0.5">{opponentBetCount}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center" style={{ width: '32%' }}>
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  border: '3px solid #ef4444',
                  boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                  background: '#111',
                }}
              >
                {opponent.avatar ? (
                  <img src={opponent.avatar} alt={opponent.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-black text-white/70">{(opponent.username || 'O')[0].toUpperCase()}</span>
                )}
              </div>
              <p className="text-white text-[11px] font-bold truncate max-w-[90px] text-center mt-1">{opponent.username}</p>
              <p className="text-[10px] font-bold text-red-400 leading-tight">
                ${formatMoney(oppBalance, 0)}
              </p>
            </div>
          </div>

          {showPendingNote && (
            <div
              className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
              style={{
                background: 'rgba(234,179,8,0.10)',
                border: '1px solid rgba(234,179,8,0.45)',
              }}
            >
              <span className="text-sm leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <div className="text-yellow-400 text-[11px] font-bold uppercase tracking-wide leading-tight">
                  {totalPendingCount} {totalPendingCount === 1 ? 'pik' : 'piks'} did not grade in time
                </div>
                <div className="text-[10px] mt-0.5 text-gray-300 leading-snug">
                  {(() => {
                    const parts = [];
                    if (myPendingCount > 0) parts.push(`${myPendingCount} of yours`);
                    if (opponentPendingCount > 0) parts.push(`${opponentPendingCount} of ${opponent.username || 'opponent'}'s`);
                    const who = parts.join(' and ');
                    return `${who} ${totalPendingCount === 1 ? 'was' : 'were'} forfeited toward this battle's score.`;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pl-2 md:pl-4 border-l-2" style={{ borderColor: theme.borderColor }}>
          {(myBetCards || opponentBetCards) ? (
            <>
              {/* Mine / Theirs toggle */}
              <div
                className="inline-flex rounded-full p-1 mb-3"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveTab('mine'); }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                  style={{
                    background: activeTab === 'mine' ? theme.accentColor : 'transparent',
                    color: activeTab === 'mine' ? '#fff' : (isDarkMode ? '#9ca3af' : '#6b7280'),
                  }}
                >
                  Your Piks ({betCount})
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveTab('theirs'); }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                  style={{
                    background: activeTab === 'theirs' ? '#ef4444' : 'transparent',
                    color: activeTab === 'theirs' ? '#fff' : (isDarkMode ? '#9ca3af' : '#6b7280'),
                  }}
                >
                  {opponent.username}'s Piks ({opponentBetCount})
                </button>
              </div>

              {/* Context caption */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: theme.accentColor }}>
                  {activeTab === 'mine'
                    ? `Your Piks in this battle`
                    : `${opponent.username}'s Piks in this battle`}
                </span>
              </div>

              {activeTab === 'mine' ? (
                <TicketCarousel
                  key="mine"
                  cards={myBetCards && myBetCards.length > 0 ? myBetCards : null}
                  theme={theme}
                  emptyMessage="No piks placed in this battle."
                />
              ) : (
                <TicketCarousel
                  key="theirs"
                  cards={opponentBetCards && opponentBetCards.length > 0 ? opponentBetCards : null}
                  theme={theme}
                  emptyMessage={`${opponent.username} hasn't placed any piks yet.`}
                />
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}
