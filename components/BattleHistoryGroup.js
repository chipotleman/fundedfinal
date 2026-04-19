import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney } from '../utils/formatMoney';
import BattleOverviewPopup from './BattleOverviewPopup';

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

export default function BattleHistoryGroup({
  battle,
  matchupId,
  myProfile,
  betCount,
  opponentBetCount = 0,
  myBetCards,
  opponentBetCards,
  isOpen,
  onOpenChange,
  children,
}) {
  const isControlled = typeof isOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState(false);
  const isPopupOpen = isControlled ? isOpen : internalOpen;
  const setIsPopupOpen = (next) => {
    const value = typeof next === 'function' ? next(isPopupOpen) : next;
    if (!isControlled) setInternalOpen(value);
    if (onOpenChange) onOpenChange(value);
  };
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
        onClick={() => setIsPopupOpen(true)}
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
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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

      {isPopupOpen && (
        <BattleOverviewPopup
          battle={battle}
          matchupId={matchupId}
          theme={theme}
          myProfile={myProfile}
          betCount={betCount}
          opponentBetCount={opponentBetCount}
          myBetCards={myBetCards}
          opponentBetCards={opponentBetCards}
          outcomeBadge={outcomeBadge}
          onClose={() => setIsPopupOpen(false)}
        />
      )}
    </div>
  );
}
