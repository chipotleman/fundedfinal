import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMatchup } from '../contexts/MatchupContext';

const GAME_MODES = {
  rush: { durationMinutes: 180, label: 'RUSH' },
  original: { durationMinutes: 1440, label: 'ORIGINAL' },
  tournament: { durationMinutes: 4320, label: 'TOURNAMENT' },
};

const MODE_THEMES = {
  rush: {
    label: 'RUSH',
    icon: '⚡',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 30%, #1a0a00 70%, #0d0500 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(251,146,60,0.12) 0%, rgba(251,146,60,0.04) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0.02) 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    dotColor: 'bg-orange-400',
    scanColor: 'rgba(251,146,60,0.3)',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    cardBg: 'linear-gradient(135deg, #020a1a 0%, #0c1a35 30%, #081428 70%, #040c18 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    dotColor: 'bg-blue-400',
    scanColor: 'rgba(59,130,246,0.3)',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 30%, #0a1a0e 70%, #040d06 100%)',
    leftPanelBg: 'linear-gradient(160deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 100%)',
    rightPanelBg: 'linear-gradient(200deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    dotColor: 'bg-emerald-400',
    scanColor: 'rgba(16,185,129,0.3)',
  },
};

function getMode(data, isQueueEntry) {
  if (isQueueEntry) return data.gameMode || 'original';
  const dm = data.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function WaitingBattleCard({ matchup, queueEntry }) {
  const { refresh: refreshMatchup } = useMatchup();
  const { data: session } = useSession();
  const [userAvatar, setUserAvatar] = useState(null);
  const [userName, setUserName] = useState('You');

  const data = matchup || queueEntry;

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(d => {
          if (d?.avatar) setUserAvatar(d.avatar);
          if (d?.username) setUserName(d.username);
        })
        .catch(() => {});
    }
  }, [session?.user?.id]);

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
        @keyframes waiting-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes search-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes search-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden relative h-[140px] md:h-[180px]"
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.borderColor}`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.1 }}>
          <div className="absolute inset-0" style={{
            background: `linear-gradient(90deg, transparent, ${theme.scanColor}, transparent)`,
            animation: 'waiting-scan 2.5s ease-in-out infinite',
          }} />
        </div>

        <div className="relative z-10 h-full flex items-stretch">
          <div className="flex-1 flex flex-col items-center justify-center px-2 md:px-4" style={{ background: theme.leftPanelBg }}>
            <div className="relative mb-1">
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: `3px solid ${theme.avatarRing}`,
                  boxShadow: theme.avatarGlow,
                  background: '#111',
                }}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl md:text-3xl">👤</span>
                )}
              </div>
            </div>
            <p className="text-white text-[11px] md:text-xs font-bold truncate max-w-[80px] md:max-w-[100px] text-center">{userName}</p>
            <p className="text-[10px] text-gray-500">Ready</p>
          </div>

          <div className="flex flex-col items-center justify-center w-[100px] md:w-[140px] flex-shrink-0 relative z-20">
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full mb-1" style={{ background: theme.badgeBg }}>
              <span className="text-[8px] md:text-[9px]">{theme.icon}</span>
              <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>{theme.label}</span>
            </div>

            <div className="text-xl md:text-2xl font-black italic text-white/30 mb-0.5">VS</div>

            <div className="text-center">
              <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-none">Prize</p>
              <p className="text-sm md:text-lg font-black leading-tight" style={{ color: theme.accentColor }}>
                ${pot.toLocaleString()}
              </p>
            </div>

            {privateCode && (
              <div className="flex items-center gap-1 mt-1 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5">
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

          <div className="flex-1 flex flex-col items-center justify-center px-2 md:px-4 relative" style={{ background: theme.rightPanelBg }}>
            <div className="relative mb-1">
              <div
                className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center overflow-hidden relative z-10"
                style={{
                  border: '3px solid #333',
                  background: '#0a0a0a',
                }}
              >
                <div className="absolute inset-0 rounded-full" style={{
                  background: `conic-gradient(${theme.accentColor}, transparent, ${theme.accentColor})`,
                  animation: 'search-ring 2s linear infinite',
                  opacity: 0.3,
                }} />
                <span className="text-xl md:text-2xl text-gray-600 relative z-10">?</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-1 h-1 ${theme.dotColor} rounded-full animate-pulse`}></div>
              <p className="text-gray-500 text-[10px] md:text-[11px]">Searching...</p>
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
