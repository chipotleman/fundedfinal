import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useTheme } from '../contexts/ThemeContext';
import ForfeitModal from './battle/ForfeitModal';
import ConnectionBadge from './battle/ConnectionBadge';
import { formatMoney } from '../utils/formatMoney';
import UserAvatar from './UserAvatar';
import { useVoiceChat } from '../contexts/VoiceChatContext';

function SpeakingIndicator({ active, size = 10 }) {
  if (!active) return null;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      title="Speaking"
      aria-label="Speaking"
      style={{ width: size + 4, height: size + 4 }}
    >
      <style>{`
        @keyframes abc-mic-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
      `}</style>
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: size + 4,
          height: size + 4,
          background: 'rgba(34,197,94,0.18)',
          border: '1px solid rgba(34,197,94,0.7)',
          animation: 'abc-mic-pulse 1.2s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 24 24" width={size - 2} height={size - 2} fill="#22c55e" aria-hidden="true">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </span>
    </span>
  );
}

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const MODE_THEMES = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 25%, #1a0a00 50%, #0d0500 75%, #050200 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    vsColor: '#fb923c',
    prizeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    glowColor: 'rgba(251,146,60,0.4)',
    emberColors: ['#fdba74', '#fb923c', '#f97316'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef3c7 0%, #fb923c 50%, #ea580c 100%)',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    cardBg: 'linear-gradient(135deg, #020a18 0%, #0a1628 25%, #122240 50%, #0d1a30 75%, #050d1a 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    vsColor: '#ffffff',
    prizeColor: '#facc15',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    glowColor: 'rgba(59,130,246,0.4)',
    emberColors: ['#93c5fd', '#60a5fa', '#3b82f6'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 25%, #0a1a0e 50%, #040d06 75%, #020804 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    vsColor: '#facc15',
    prizeColor: '#10b981',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    glowColor: 'rgba(16,185,129,0.4)',
    emberColors: ['#6ee7b7', '#34d399', '#10b981'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
};

function getGameMode(matchup) {
  const dm = matchup?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function ActiveBattleCard({
  matchup,
  opponent,
  myBalance,
  opponentBalance,
  myLiveBalance,
  opponentLiveBalance,
  myUnrealizedPnl,
  opponentUnrealizedPnl,
  myBetsCount = 0,
  myPendingAtRiskCount = 0,
  opponentBets = [],
  canSeeBets = false,
  onForfeit,
  myProfile,
}) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();
  const { oppSpeaking } = useVoiceChat();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showModal]);

  const userAvatar = myProfile?.avatar || null;
  const userName = myProfile?.username || session?.user?.name || '';

  useEffect(() => {
    if (!matchup?.endsAt) return;
    const updateTime = () => {
      const remaining = new Date(matchup.endsAt).getTime() - Date.now();
      setTimeRemaining(remaining);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [matchup?.endsAt]);

  if (!matchup || !opponent) return null;

  const mode = getGameMode(matchup);
  const theme = MODE_THEMES[mode];

  const myBalanceNum = parseFloat(myBalance ?? 0);
  const oppBalanceNum = parseFloat(opponentBalance ?? 0);
  // Prefer the mark-to-market live balance (driven by current odds)
  // for PnL display so the opponent's number ticks as odds move.
  const myLiveNum = myLiveBalance != null && Number.isFinite(parseFloat(myLiveBalance))
    ? parseFloat(myLiveBalance)
    : myBalanceNum;
  const oppLiveNum = opponentLiveBalance != null && Number.isFinite(parseFloat(opponentLiveBalance))
    ? parseFloat(opponentLiveBalance)
    : oppBalanceNum;
  const startingBalance = parseFloat(matchup.startingBalance ?? 0);
  const isWinning = myLiveNum > oppLiveNum;
  const isLosing = myLiveNum < oppLiveNum;
  const isTied = myLiveNum === oppLiveNum;
  const winnerPayout = parseFloat(matchup.winnerPayout ?? 0);
  const myPnL = (myUnrealizedPnl != null && Number.isFinite(parseFloat(myUnrealizedPnl)))
    ? parseFloat(myUnrealizedPnl)
    : (myLiveNum - startingBalance);
  const oppPnL = (opponentUnrealizedPnl != null && Number.isFinite(parseFloat(opponentUnrealizedPnl)))
    ? parseFloat(opponentUnrealizedPnl)
    : (oppLiveNum - startingBalance);
  const settledBets = opponentBets.filter(b => b.status !== 'pending');
  const minPicks = 4;
  const piksRemaining = Math.max(0, minPicks - myBetsCount);
  const WARNING_WINDOW_MS = 30 * 60 * 1000;
  const showUngradedWarning = myPendingAtRiskCount > 0
    && timeRemaining != null
    && timeRemaining > 0
    && timeRemaining <= WARNING_WINDOW_MS;
  const ungradedLabel = `${myPendingAtRiskCount} ${myPendingAtRiskCount === 1 ? 'pik' : 'piks'}`;

  return (
    <>
      <style>{`
        @keyframes abc-ember-float {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 0.9; 
          }
          100% { 
            transform: translateY(-160px) translateX(10px) scale(0.3); 
            opacity: 0; 
          }
        }
        @keyframes abc-smoke-rise {
          0% { 
            transform: translateY(0) translateX(0) scale(1) rotate(0deg); 
            opacity: 0.35; 
          }
          50% {
            transform: translateY(-60px) translateX(12px) scale(1.6) rotate(8deg);
            opacity: 0.2;
          }
          100% { 
            transform: translateY(-140px) translateX(-8px) scale(2.5) rotate(-5deg); 
            opacity: 0; 
          }
        }
        @keyframes abc-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes abc-glow {
          0%, 100% { box-shadow: 0 0 15px ${theme.glowColor}; }
          50% { box-shadow: 0 0 30px ${theme.glowColor}, 0 0 50px ${theme.glowColor}; }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px] active:scale-[0.98]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${isWinning ? 'rgba(34, 197, 94, 0.5)' : isLosing ? 'rgba(239, 68, 68, 0.5)' : theme.borderColor}`,
        }}
        onClick={() => setShowModal(true)}
      >
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${theme.glowColor} 0%, transparent 60%)`,
          }}
        />

        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <div
              key={`smoke-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${20 + (i % 4) * 12}px`,
                height: `${20 + (i % 4) * 12}px`,
                left: `${5 + (i * 9.5)}%`,
                bottom: `${5 + (i * 4) % 20}%`,
                background: `radial-gradient(circle, rgba(100,100,100,${theme.smokeOpacity + 0.05}) 0%, rgba(70,70,70,${theme.smokeOpacity * 0.5}) 50%, transparent 70%)`,
                filter: 'blur(6px)',
                animation: `abc-smoke-rise ${3.5 + (i % 3) * 0.8}s linear infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
          {[...Array(25)].map((_, i) => (
            <div
              key={`ember-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${2 + (i % 3) * 2}px`,
                height: `${2 + (i % 3) * 2}px`,
                left: `${2 + (i * 4)}%`,
                bottom: `-5%`,
                background: theme.emberColors[i % 3],
                boxShadow: `0 0 ${6 + (i % 3) * 3}px ${theme.emberColors[i % 3]}`,
                animation: `abc-ember-float ${2.5 + (i % 5) * 0.4}s linear infinite`,
                animationDelay: `${(i * 0.12)}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute top-1.5 right-1.5 z-30 pointer-events-none">
          <ConnectionBadge />
        </div>

        {showUngradedWarning && (
          <div
            className="absolute top-0 left-0 right-0 z-20 px-2 py-1 flex items-center justify-center gap-1.5"
            style={{
              background: 'linear-gradient(90deg, rgba(202,138,4,0.95) 0%, rgba(234,179,8,0.95) 50%, rgba(202,138,4,0.95) 100%)',
              borderBottom: '1px solid rgba(0,0,0,0.25)',
            }}
            title={`You have ${ungradedLabel} that may not grade before the timer ends — they'd be forfeited toward your battle score.`}
          >
            <span className="text-[11px] leading-none">⚠️</span>
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-black truncate">
              {ungradedLabel} may not grade — forfeit risk
            </span>
          </div>
        )}

        <div className={`relative z-10 h-full flex items-center px-4 md:px-8 ${showUngradedWarning ? 'pt-3' : ''}`}>
          <div className="flex items-center w-full">
            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: `3px solid ${theme.avatarRing}`,
                  boxShadow: theme.avatarGlow,
                  background: '#111',
                  animation: 'abc-glow 2s ease-in-out infinite',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                )}
              </div>
              <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center mt-1 min-h-[14px]">{userName || '\u00A0'}</p>
              <p className={`text-[10px] md:text-xs font-bold leading-tight ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                ${formatMoney(myBalanceNum, 0)}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center" style={{ width: '50%' }}>
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full mb-1" style={{ background: theme.badgeBg }}>
                <span className="text-[8px] md:text-[9px]">{theme.icon}</span>
                <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
              </div>

              <div
                className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text mb-0.5"
                style={{
                  backgroundImage: theme.vsGradient,
                  WebkitBackgroundClip: 'text',
                  animation: 'abc-vs-pulse 2s ease-in-out infinite',
                }}
              >
                VS
              </div>

              <div className="text-center">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-none">Prize</p>
                <p className="text-sm md:text-lg font-black leading-tight" style={{
                  color: theme.prizeColor,
                  textShadow: `0 0 10px rgba(${theme.accentRgb},0.4)`,
                }}>
                  ${formatMoney(winnerPayout, 0)}
                </p>
              </div>

              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] md:text-[8px] font-bold mt-0.5 ${
                isWinning ? 'bg-green-500/20 text-green-400'
                : isLosing ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {isTied ? 'TIED' : isWinning ? 'WINNING' : 'BEHIND'}
                <span className="text-white/50">{formatTimer(timeRemaining)}</span>
              </div>
            </div>

            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div
                className="relative z-10"
                style={{
                  filter: opponent.equippedFrame
                    ? 'none'
                    : oppSpeaking
                      ? 'drop-shadow(0 0 14px rgba(34,197,94,0.7))'
                      : 'drop-shadow(0 0 20px rgba(239,68,68,0.3))',
                  transition: 'filter 150ms ease',
                }}
              >
                <UserAvatar
                  avatar={opponent.avatar}
                  username={opponent.username}
                  frameId={opponent.equippedFrame}
                  size={72}
                  bgColor="#111"
                />
              </div>
              <div className="flex items-center justify-center gap-1 mt-1 max-w-[80px] md:max-w-[100px]">
                <p className="text-white text-[11px] md:text-xs font-bold truncate text-center">{opponent.username || 'Opponent'}</p>
                <SpeakingIndicator active={oppSpeaking} size={10} />
              </div>
              <p className="text-[10px] md:text-xs font-bold text-red-400 leading-tight">
                ${formatMoney(oppBalanceNum, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {mounted && showModal && createPortal((() => {
        const totalBalance = myBalanceNum + oppBalanceNum;
        const myDomPercent = totalBalance > 0 ? Math.round((myBalanceNum / totalBalance) * 100) : 50;
        const oppDomPercent = 100 - myDomPercent;
        const oppStaked = settledBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0);

        return (
          <div
            className="fixed inset-0 z-[60] overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
            <div className="flex min-h-full items-start justify-center p-4 pt-4 md:pt-8">
              <div
                className="relative w-full max-w-lg rounded-2xl overflow-hidden"
                style={{ background: isDarkMode ? '#0a0a0a' : '#ffffff', border: `1px solid ${isDarkMode ? `rgba(${theme.accentRgb},0.2)` : '#e5e7eb'}` }}
                onClick={e => e.stopPropagation()}
              >
                <div className="relative overflow-hidden" style={{ background: theme.cardBg }}>
                  <div 
                    className="absolute inset-0 opacity-25 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at center bottom, ${theme.glowColor} 0%, transparent 60%)` }}
                  />
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={`m-ember-${i}`}
                        className="absolute rounded-full"
                        style={{
                          width: `${2 + (i % 3) * 2}px`,
                          height: `${2 + (i % 3) * 2}px`,
                          left: `${3 + (i * 6.5)}%`,
                          bottom: `-5%`,
                          background: theme.emberColors[i % 3],
                          boxShadow: `0 0 ${6 + (i % 3) * 3}px ${theme.emberColors[i % 3]}`,
                          animation: `abc-ember-float ${2.5 + (i % 5) * 0.4}s linear infinite`,
                          animationDelay: `${(i * 0.15)}s`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="relative z-10 pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: theme.badgeBg }}>
                        <span className="text-xs">{theme.icon}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
                      </div>
                      <button
                        onClick={() => setShowModal(false)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-white/20 hover:bg-white/30'}`}
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-start justify-between">
                      <div className="flex flex-col items-center" style={{ width: '38%' }}>
                        <div
                          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center overflow-hidden mb-2"
                          style={{
                            border: `3px solid ${theme.avatarRing}`,
                            boxShadow: theme.avatarGlow,
                            background: '#111',
                            animation: 'abc-glow 2s ease-in-out infinite',
                          }}
                        >
                          {userAvatar ? (
                            <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                          )}
                        </div>
                        <p className="text-white text-xs font-bold truncate max-w-[120px] text-center">{userName}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">YOU</p>
                      </div>

                      <div className="flex flex-col items-center justify-center pt-3" style={{ width: '24%' }}>
                        <div
                          className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text mb-1"
                          style={{
                            backgroundImage: theme.vsGradient,
                            WebkitBackgroundClip: 'text',
                            animation: 'abc-vs-pulse 2s ease-in-out infinite',
                          }}
                        >
                          VS
                        </div>
                        <div className="text-center">
                          <p className="text-[7px] text-gray-500 uppercase tracking-widest leading-none mb-0.5">Prize</p>
                          <p className="text-lg md:text-xl font-black leading-none" style={{
                            color: theme.prizeColor,
                            textShadow: `0 0 15px rgba(${theme.accentRgb},0.5)`,
                          }}>
                            ${formatMoney(winnerPayout, 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center" style={{ width: '38%' }}>
                        <div
                          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center overflow-hidden mb-2"
                          style={{
                            border: `3px solid ${oppSpeaking ? '#22c55e' : '#ef4444'}`,
                            boxShadow: oppSpeaking ? '0 0 20px rgba(34,197,94,0.55)' : '0 0 20px rgba(239,68,68,0.3)',
                            background: '#111',
                            transition: 'border-color 150ms ease, box-shadow 150ms ease',
                          }}
                        >
                          {opponent.avatar ? (
                            <img src={opponent.avatar} alt={opponent.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-white/70">{(opponent.username || 'O')[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-1 max-w-[120px]">
                          <p className="text-white text-xs font-bold truncate text-center">{opponent.username || 'Opponent'}</p>
                          <SpeakingIndicator active={oppSpeaking} size={10} />
                        </div>
                        <p className="text-[10px] text-red-400/60 mt-0.5">OPP</p>
                      </div>
                    </div>

                    <div className="mt-3 mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold ${isWinning ? 'text-green-400' : isLosing ? 'text-red-400' : 'text-yellow-400'}`}>
                          {myDomPercent}%
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isWinning ? 'bg-green-500/15 text-green-400'
                          : isLosing ? 'bg-red-500/15 text-red-400'
                          : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {isTied ? 'TIED' : isWinning ? 'DOMINATING' : 'BEHIND'}
                        </span>
                        <span className={`text-[10px] font-bold ${oppBalanceNum > myBalanceNum ? 'text-green-400' : oppBalanceNum < myBalanceNum ? 'text-red-400' : 'text-yellow-400'}`}>
                          {oppDomPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-black/40 flex">
                        <div
                          className="h-full rounded-l-full transition-all duration-500"
                          style={{
                            width: `${myDomPercent}%`,
                            background: isWinning ? 'linear-gradient(90deg, #22c55e, #4ade80)' : isLosing ? 'linear-gradient(90deg, #ef4444, #f87171)' : `linear-gradient(90deg, rgba(${theme.accentRgb},0.8), rgba(${theme.accentRgb},1))`,
                          }}
                        />
                        <div
                          className="h-full rounded-r-full transition-all duration-500"
                          style={{
                            width: `${oppDomPercent}%`,
                            background: oppBalanceNum > myBalanceNum ? 'linear-gradient(90deg, #4ade80, #22c55e)' : oppBalanceNum < myBalanceNum ? 'linear-gradient(90deg, #f87171, #ef4444)' : `linear-gradient(90deg, rgba(${theme.accentRgb},1), rgba(${theme.accentRgb},0.8))`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pt-3 pb-4 space-y-3" style={{ background: isDarkMode ? '#0a0a0a' : '#ffffff' }}>
                  {showUngradedWarning && (
                    <div
                      className="rounded-lg px-3 py-2 flex items-start gap-2"
                      style={{
                        background: isDarkMode ? 'rgba(202,138,4,0.15)' : 'rgba(254,243,199,0.9)',
                        border: `1px solid ${isDarkMode ? 'rgba(234,179,8,0.45)' : 'rgba(202,138,4,0.4)'}`,
                      }}
                    >
                      <span className="text-base leading-none mt-0.5">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-yellow-400 leading-tight">
                          {ungradedLabel} may not grade in time
                        </div>
                        <div className={`text-[11px] mt-0.5 leading-snug ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          The battle ends in {formatTimer(timeRemaining)}. Any pik whose game hasn’t finished by then is automatically forfeited toward your battle score.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme.accentColor }} />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{userName}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Balance</span>
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${formatMoney(myBalanceNum, 0)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">P&L</span>
                          <span className={`text-sm font-bold ${myPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {myPnL >= 0 ? '+' : ''}${formatMoney(myPnL, 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Piks</span>
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{myBetsCount}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Min Piks Left</span>
                          <span className={`text-sm font-bold ${piksRemaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {piksRemaining > 0 ? piksRemaining : '✓'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl p-3" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{opponent.username || 'Opponent'}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Balance</span>
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${formatMoney(oppBalanceNum, 0)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">P&L</span>
                          <span className={`text-sm font-bold ${oppPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {oppPnL >= 0 ? '+' : ''}${formatMoney(oppPnL, 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Piks</span>
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponentBets.length}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-500">Staked</span>
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${formatMoney(oppStaked, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-1">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formatTimer(timeRemaining)}</span>
                    <span className="text-[10px] text-gray-500">remaining</span>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                    <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opponent's Piks</span>
                      {!canSeeBets && (
                        <span className={`text-[9px] flex items-center gap-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                          Locked
                        </span>
                      )}
                    </div>
                    {canSeeBets ? (
                      <div className="max-h-[180px] overflow-y-auto">
                        {opponentBets.length === 0 ? (
                          <div className="py-6 text-center">
                            <p className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>No piks placed yet</p>
                          </div>
                        ) : (
                          <div className={`divide-y ${isDarkMode ? 'divide-[#1a1a1a]' : 'divide-gray-200'}`}>
                            {opponentBets.map((bet, i) => (
                              <div key={i} className="flex justify-between items-center px-3 py-2.5">
                                <div className="flex-1 truncate mr-2">
                                  <span className={`text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{bet.selection}</span>
                                  <span className="text-[10px] text-gray-500 ml-1.5">({bet.odds})</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[10px] text-gray-500">${formatMoney(bet.stake, 0)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    bet.status === 'won' ? 'bg-green-500/15 text-green-400' :
                                    bet.status === 'lost' ? 'bg-red-500/15 text-red-400' :
                                    'bg-yellow-500/15 text-yellow-400'
                                  }`}>
                                    {bet.status.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                          <svg className={`w-5 h-5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                        </div>
                        <p className="text-[11px] text-gray-500 text-center">Place a pik to reveal opponent's piks</p>
                      </div>
                    )}
                  </div>

                  {onForfeit && (
                    <div className="pt-1 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowForfeitModal(true);
                        }}
                        className="text-red-500/60 hover:text-red-400 text-[10px] font-medium transition-colors"
                      >
                        Forfeit Battle
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {typeof document !== 'undefined' && createPortal(
        <ForfeitModal
          isOpen={showForfeitModal}
          matchup={matchup}
          onCancel={() => setShowForfeitModal(false)}
          onConfirm={async () => {
            if (onForfeit) {
              await onForfeit();
            }
            setShowForfeitModal(false);
            setShowModal(false);
          }}
        />,
        document.body
      )}
    </>
  );
}
