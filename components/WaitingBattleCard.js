import { useMatchup } from '../contexts/MatchupContext';

const GAME_MODES = {
  rush: { durationMinutes: 180, label: 'RUSH' },
  original: { durationMinutes: 1440, label: 'ORIGINAL' },
  tournament: { durationMinutes: 4320, label: 'TOURNAMENT' },
};

export default function WaitingBattleCard({ matchup, queueEntry }) {
  const { refresh: refreshMatchup } = useMatchup();

  const data = matchup || queueEntry;
  if (!data) return null;

  const isQueueEntry = !matchup && !!queueEntry;

  const matchTypeLabel = isQueueEntry
    ? 'Quick Match'
    : (data.matchType === 'private' ? 'Private Match' : data.matchType === 'friend' ? 'Friend Match' : 'Quick Match');

  const modeLabel = isQueueEntry
    ? (GAME_MODES[data.gameMode]?.label || 'ORIGINAL')
    : (data.durationMinutes <= 200 ? 'RUSH' : data.durationMinutes <= 1500 ? 'ORIGINAL' : 'TOURNAMENT');

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
          background: 'linear-gradient(135deg, #0d0d0d 0%, #111 50%, #0d0d0d 100%)',
          border: '2px solid rgba(251, 146, 60, 0.3)',
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ opacity: 0.15 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(251,146,60,0.4), transparent)',
              animation: 'waiting-scan 2.5s ease-in-out infinite',
            }}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-semibold">Waiting for Opponent</span>
            </div>
            <span className="text-gray-500 text-xs font-medium">{matchTypeLabel}</span>
          </div>

          {privateCode ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-4">
                <div>
                  <p className="text-gray-500 text-[9px] uppercase tracking-wider">Buy-In</p>
                  <p className="text-white font-bold text-sm">${buyIn.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[9px] uppercase tracking-wider">Mode</p>
                  <p className="text-white font-bold text-sm">{modeLabel}</p>
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
                <p className="text-gray-500 text-[9px] uppercase tracking-wider">Mode</p>
                <p className="text-white font-bold text-sm">{modeLabel}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[9px] uppercase tracking-wider">Pot</p>
                <p className="text-white font-bold text-sm">${pot.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
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
