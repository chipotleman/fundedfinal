import { useSession } from 'next-auth/react';
import { useMatchup } from '../contexts/MatchupContext';
import { formatMoney } from '../utils/formatMoney';

const GAME_MODES = {
  rush: { durationMinutes: 180, label: 'RUSH' },
  original: { durationMinutes: 1440, label: 'ORIGINAL' },
  tournament: { durationMinutes: 4320, label: 'TOURNAMENT' },
};

const MODE_THEMES = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 25%, #1a0a00 50%, #0d0500 75%, #050200 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
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
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    glowColor: 'rgba(16,185,129,0.4)',
    emberColors: ['#6ee7b7', '#34d399', '#10b981'],
    smokeOpacity: 0.35,
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
  },
};

function getMode(data, isQueueEntry) {
  if (isQueueEntry) return data.gameMode || 'original';
  const dm = data.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function WaitingBattleCard({ matchup, queueEntry, myProfile, opponent }) {
  const { refresh: refreshMatchup } = useMatchup();
  const { data: session } = useSession();

  const data = matchup || queueEntry;

  const userAvatar = myProfile?.avatar || null;
  const userName = myProfile?.username || session?.user?.name || 'You';

  if (!data) return null;

  const isQueueEntry = !matchup && !!queueEntry;
  const mode = getMode(data, isQueueEntry);
  const theme = MODE_THEMES[mode] || MODE_THEMES.original;

  const matchTypeLabel = isQueueEntry
    ? 'Quick Match'
    : (data.matchType === 'private' ? 'Private' : data.matchType === 'friend' ? 'Friend' : 'Quick');

  const buyIn = isQueueEntry ? parseFloat(data.buyIn ?? 0) : parseFloat(data.startingBalance ?? 0);
  const pot = isQueueEntry ? buyIn * 2 : (parseFloat(data.potSize ?? 0) || (buyIn * 2));
  const privateCode = !isQueueEntry ? data.privateCode : null;

  const handleCancel = (e) => {
    e.stopPropagation();
    if (window.confirm('Cancel this match?')) {
      if (isQueueEntry) {
        fetch('/api/battles/cancel-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: data.id }),
        })
          .then(r => r.json())
          .then(d => { if (d.success) refreshMatchup(); })
          .catch(() => {});
      } else {
        fetch('/api/battles/private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        })
          .then(r => r.json())
          .then(d => { if (d.success) refreshMatchup(); })
          .catch(() => {});
      }
    }
  };

  return (
    <>
      <style>{`
        @keyframes wbc-ember-float {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 0.9; 
          }
          100% { 
            transform: translateY(-160px) translateX(10px) scale(0.3); 
            opacity: 0; 
          }
        }
        @keyframes wbc-smoke-rise {
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
        @keyframes wbc-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes wbc-glow {
          0%, 100% { box-shadow: 0 0 15px ${theme.glowColor}; }
          50% { box-shadow: 0 0 30px ${theme.glowColor}, 0 0 50px ${theme.glowColor}; }
        }
        @keyframes wbc-search-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wbc-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden relative h-[140px] md:h-[180px]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.borderColor}`,
        }}
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
                animation: `wbc-smoke-rise ${3.5 + (i % 3) * 0.8}s linear infinite`,
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
                animation: `wbc-ember-float ${2.5 + (i % 5) * 0.4}s linear infinite`,
                animationDelay: `${(i * 0.12)}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 h-full flex items-center px-4 md:px-8">
          <div className="flex items-center w-full">
            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div 
                className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 shadow-lg flex items-center justify-center overflow-hidden"
                style={{ 
                  borderColor: theme.avatarRing,
                  animation: 'wbc-glow 2s ease-in-out infinite',
                  background: '#111',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                )}
              </div>
              <span className="text-white text-[11px] md:text-xs font-bold mt-1.5 truncate max-w-[80px] md:max-w-[100px] text-center">{userName}</span>
              <span className="text-[10px] mt-0.5" style={{ color: theme.accentColor }}>Ready</span>
            </div>

            <div className="flex flex-col items-center justify-center" style={{ width: '50%' }}>
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full mb-1" style={{ background: theme.badgeBg }}>
                <span className="text-[9px] md:text-[10px]">{theme.icon}</span>
                <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
              </div>

              <div 
                className="text-xl md:text-2xl font-black text-transparent bg-clip-text mb-0.5"
                style={{ 
                  backgroundImage: theme.vsGradient,
                  WebkitBackgroundClip: 'text',
                  animation: 'wbc-vs-pulse 1.5s ease-in-out infinite',
                }}
              >
                VS
              </div>

              <div className="text-center">
                <p className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest leading-none mb-0.5">Win Up To</p>
                <p className="text-2xl md:text-3xl font-black leading-none tracking-tight" style={{ 
                  color: theme.accentColor,
                  textShadow: `0 0 20px rgba(${theme.accentRgb},0.5)`,
                }}>
                  ${formatMoney(pot, 0)}
                </p>
              </div>

              {privateCode && (
                <div className="flex items-center gap-1 mt-1.5 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5">
                  <span className="text-white font-mono font-bold text-[10px] tracking-wider">{privateCode}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(privateCode);
                      const el = e.currentTarget;
                      el.textContent = '✓';
                      setTimeout(() => { el.textContent = '📋'; }, 1500);
                    }}
                    className="text-[10px]"
                  >📋</button>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center" style={{ width: '25%' }}>
              <div className="relative">
                <div
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-lg"
                  style={{
                    borderColor: opponent ? theme.avatarRing : '#333',
                    background: opponent ? '#111' : '#0a0a0a',
                    boxShadow: opponent ? theme.avatarGlow : 'none',
                    animation: opponent ? 'wbc-glow 2s ease-in-out infinite' : 'wbc-pulse 2s ease-in-out infinite',
                  }}
                >
                  {opponent ? (
                    opponent.avatar ? (
                      <img src={opponent.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl md:text-2xl font-black text-white/70">{(opponent.username || 'O')[0].toUpperCase()}</span>
                    )
                  ) : (
                    <>
                      <div className="absolute inset-0 rounded-full" style={{
                        background: `conic-gradient(${theme.accentColor}, transparent, ${theme.accentColor})`,
                        animation: 'wbc-search-ring 2s linear infinite',
                        opacity: 0.3,
                      }} />
                      <span className="text-xl md:text-2xl text-gray-600 relative z-10">?</span>
                    </>
                  )}
                </div>
              </div>
              {opponent ? (
                <div className="flex flex-col items-center mt-1.5">
                  <span className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center">{opponent.username || 'Opponent'}</span>
                  <span className="text-[10px]" style={{ color: theme.accentColor }}>Matched</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.accentColor }} />
                  <span className="text-[10px] md:text-[11px] text-gray-400">Searching...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-between px-3 z-30" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}>
          <span className="text-gray-500 text-[9px]">{matchTypeLabel}</span>
          <button
            onClick={handleCancel}
            className="text-gray-500 text-[9px] font-medium hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
