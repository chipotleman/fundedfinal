import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { formatMoney } from '../../utils/formatMoney';
import useModalScrollLock from '../../hooks/useModalScrollLock';

export default function ForfeitModal({ isOpen, onConfirm, onCancel, matchup }) {
  const [isForfeiting, setIsForfeiting] = useState(false);
  const { isDarkMode } = useTheme();
  useModalScrollLock(isOpen, { restoreScroll: true });

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
        @keyframes forfeitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .forfeit-overlay { animation: forfeitOverlayIn 0.25s ease-out; }
        .forfeit-modal { animation: forfeitModalIn 0.3s ease-out; }
        .forfeit-icon { animation: forfeitShake 0.5s ease-in-out 0.3s; }
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
            background: isDarkMode ? 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)' : '#ffffff',
            border: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#e5e7eb'}`,
            boxShadow: isDarkMode ? '0 0 60px rgba(239, 68, 68, 0.15), 0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 pt-6 pb-4 text-center" style={{ borderBottom: `1px solid ${isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#f3e8e8'}` }}>
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center forfeit-icon"
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid rgba(239, 68, 68, 0.3)' }}
            >
              <span className="text-3xl">🏳️</span>
            </div>
            <h2 className="text-2xl font-black text-red-500 mb-1">Surrender?</h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>This action cannot be undone</p>
          </div>

          <div className="px-6 py-4 space-y-2">
            <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <span className="text-base">⚠️</span>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your opponent will win</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <span className="text-base">💸</span>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You will lose your buy-in{buyIn > 0 ? ` ($${formatMoney(buyIn, 0)})` : ''}
              </p>
            </div>
            {potSize > 0 && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                <span className="text-base">🏆</span>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Pot size: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${formatMoney(potSize, 0)}</span>
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
              className="w-full py-3 rounded-xl text-sm transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'transparent',
                border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
                color: '#ef4444',
                fontWeight: 500,
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
