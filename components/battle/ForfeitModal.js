import { useState } from 'react';

export default function ForfeitModal({ isOpen, onConfirm, onCancel, matchup }) {
  const [isForfeiting, setIsForfeiting] = useState(false);

  if (!isOpen) return null;

  const potSize = parseFloat(matchup?.potSize || matchup?.winnerPayout || 0);
  const buyIn = parseFloat(matchup?.startingBalance || matchup?.buyIn || 0);

  const handleConfirm = async () => {
    setIsForfeiting(true);
    try {
      await onConfirm();
    } finally {
      setIsForfeiting(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes forfeitOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes forfeitModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes forfeitShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes forfeitPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
        @keyframes forfeitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .forfeit-overlay { animation: forfeitOverlayIn 0.25s ease-out; }
        .forfeit-modal { animation: forfeitModalIn 0.3s ease-out; }
        .forfeit-icon { animation: forfeitShake 0.5s ease-in-out 0.3s; }
        .forfeit-btn-pulse { animation: forfeitPulse 2s ease-in-out infinite; }
        .forfeit-spinner { animation: forfeitSpin 0.8s linear infinite; }
      `}</style>

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 forfeit-overlay"
        style={{ background: 'radial-gradient(ellipse at center, rgba(127,29,29,0.5) 0%, rgba(0,0,0,0.85) 100%)' }}
        onClick={onCancel}
      >
        <div
          className="forfeit-modal w-full max-w-sm rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 60px rgba(239, 68, 68, 0.15), 0 25px 50px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 pt-6 pb-4 text-center" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center forfeit-icon"
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.3)' }}
            >
              <span className="text-3xl">🏳️</span>
            </div>
            <h2 className="text-2xl font-black text-red-400 mb-1">Surrender?</h2>
            <p className="text-gray-500 text-sm">This action cannot be undone</p>
          </div>

          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
              <span className="text-lg">⚠️</span>
              <p className="text-red-300 text-sm font-medium">Your opponent will win</p>
            </div>
            <div className="flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
              <span className="text-lg">💸</span>
              <p className="text-red-300 text-sm font-medium">
                You will lose your buy-in{buyIn > 0 ? ` ($${buyIn.toFixed(0)})` : ''}
              </p>
            </div>
            {potSize > 0 && (
              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-700/50">
                <span className="text-lg">🏆</span>
                <p className="text-gray-300 text-sm">
                  Pot size: <span className="font-bold text-white">${potSize.toFixed(0)}</span>
                </p>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
            <button
              onClick={onCancel}
              disabled={isForfeiting}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #059669 100%)',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
              }}
            >
              Keep Fighting 💪
            </button>
            <button
              onClick={handleConfirm}
              disabled={isForfeiting}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 forfeit-btn-pulse disabled:opacity-50"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
              }}
            >
              {isForfeiting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full forfeit-spinner"
                    style={{ border: '2px solid rgba(248,113,113,0.3)', borderTopColor: '#f87171' }}
                  />
                  Forfeiting...
                </span>
              ) : (
                'Forfeit Battle'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
