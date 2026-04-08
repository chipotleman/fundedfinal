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
    bg: 'linear-gradient(135deg, #1a0a00 0%, #1f0e00 50%, #1a0a00 100%)',
    border: 'rgba(251, 146, 60, 0.3)',
    scanColor: 'rgba(251,146,60,0.4)',
    dotColor: 'bg-orange-400',
    modeTextColor: 'text-orange-400',
    labelColor: '#fb923c',
  },
  original: {
    label: 'ORIGINAL',
    icon: '🏆',
    bg: 'linear-gradient(135deg, #020a18 0%, #0a1225 50%, #020a18 100%)',
    border: 'rgba(59, 130, 246, 0.3)',
    scanColor: 'rgba(59,130,246,0.4)',
    dotColor: 'bg-blue-400',
    modeTextColor: 'text-blue-400',
    labelColor: '#3b82f6',
  },
  tournament: {
    label: 'TOURNAMENT',
    icon: '👑',
    bg: 'linear-gradient(135deg, #0a0f00 0%, #0d1a0a 50%, #0a0f00 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
    scanColor: 'rgba(16,185,129,0.4)',
    dotColor: 'bg-emerald-400',
    modeTextColor: 'text-emerald-400',
    labelColor: '#10b981',
  },
};

function getMode(data, isQueueEntry) {
  if (isQueueEntry) {
    return data.gameMode || 'original';
  }
  const dm = data.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function WaitingBattleCard({ matchup, queueEntry }) {
  const { refresh: refreshMatchup } = useMatchup();

  const data = matchup || queueEntry;
  if (!data) return null;

  const isQueueEntry = !matchup && !!queueEntry;

  const matchTypeLabel = isQueueEntry
    ? 'Quick Match'
    : (data.matchType === 'private' ? 'Private Match' : data.matchType === 'friend' ? 'Friend Match' : 'Quick Match');

  const mode = getMode(data, isQueueEntry);
  const theme = MODE_THEMES[mode] || MODE_THEMES.original;

  const buyIn = isQueueEntry
    ? parseFloat(data.buyIn ?? 0)
    : parseFloat(data.startingBalance ?? 0);

  const pot = isQueueEntry
    ? buyIn * 2
    : (parseFloat(data.potSize ?? 0) || (buyIn * 2));

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
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden relative h-[140px] md:h-[180px]"
        style={{
          background: theme.bg,
          border: `2px solid ${theme.border}`,
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ opacity: 0.15 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.scanColor}, transparent)`,
              animation: 'waiting-scan 2.5s ease-in-out infinite',
            }}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${theme.dotColor} rounded-full animate-pulse`}></div>
              <span className="text-white text-sm font-semibold">Waiting for Opponent</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: theme.labelColor }} className="text-xs font-bold">{theme.icon} {theme.label}</span>
              <span className="text-gray-600 text-[10px]">|</span>
              <span className="text-gray-500 text-xs font-medium">{matchTypeLabel}</span>
            </div>
          </div>

          {privateCode ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-4">
                <div>
                  <p className="text-gray-500 text-[9px] uppercase tracking-wider">Buy-In</p>
                  <p className="text-white font-bold text-sm">${buyIn.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[9px] uppercase tracking-wider">Pot</p>
                  <p className="text-white font-bold text-sm">${pot.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5">
                <span className="text-white font-mono font-bold text-sm tracking-[0.2em]">{privateCode}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(privateCode);
                    const el = e.currentTarget;
                    el.textContent = '✓';
                    setTimeout(() => { el.textContent = 'Copy'; }, 1500);
                  }}
                  className="text-gray-400 text-[10px] font-medium hover:text-white transition-colors ml-1"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-5">
              <div>
                <p className="text-gray-500 text-[9px] uppercase tracking-wider">Buy-In</p>
                <p className="text-white font-bold text-sm">${buyIn.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[9px] uppercase tracking-wider">Pot</p>
                <p className="text-white font-bold text-sm">${pot.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 ${theme.dotColor} rounded-full animate-pulse`}></div>
              <span className="text-gray-500 text-xs">Searching for opponent...</span>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-500 text-xs font-medium hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
