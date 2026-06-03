import { useState } from 'react';
import { formatMoney } from '../../utils/formatMoney';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import { useTheme } from '../../contexts/ThemeContext';

export default function ForfeitModal({ isOpen, onConfirm, onCancel, matchup }) {
  const [isForfeiting, setIsForfeiting] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  useModalScrollLock(isOpen, { restoreScroll: true });

  if (!isOpen) return null;

  // Cartoon hard borders/shadows (#0a0a0a) stay in both themes — only the
  // panel/card surfaces and text flip so the modal matches the light page
  // (My Piks) instead of dropping a dark modal onto a beige background.
  const c = isLight
    ? { modalBg: '#ffffff', cardBg: '#f5f1ea', title: '#0f172a', titleShadow: 'none', sub: '#64748b', cardText: '#334155' }
    : { modalBg: '#0d0d0d', cardBg: '#111', title: '#fff', titleShadow: '0 2px 0 #000', sub: '#9ca3af', cardText: '#e5e7eb' };

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
        @keyframes ffOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ffModalIn {
          0% { opacity: 0; transform: scale(0.85) translateY(24px); }
          60% { opacity: 1; transform: scale(1.03) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ffFlagBounce {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(-3px); }
        }
        @keyframes ffSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ff-overlay { animation: ffOverlayIn 0.2s ease-out; }
        .ff-modal { animation: ffModalIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .ff-flag { animation: ffFlagBounce 1.6s ease-in-out infinite; display: inline-block; }
        .ff-spinner { animation: ffSpin 0.8s linear infinite; }
        .ff-keep-btn { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        @media (hover: hover) {
          .ff-keep-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55); }
        }
        .ff-keep-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
        .ff-forfeit-btn { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        @media (hover: hover) {
          .ff-forfeit-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a; }
        }
        .ff-forfeit-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
      `}</style>

      <div
        data-allow-fixed-overlay="true"
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 ff-overlay overflow-y-auto overscroll-contain"
        style={{
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          minHeight: '100dvh',
        }}
        onClick={onCancel}
      >
        <div
          className="ff-modal w-full max-w-sm rounded-3xl overflow-hidden my-auto"
          style={{
            background: c.modalBg,
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 8px 0 #0a0a0a, 0 22px 44px rgba(0,0,0,0.6)',
            maxHeight: 'calc(100dvh - max(2rem, env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <div
              className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #fb923c 0%, #f97316 100%)',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
              }}
            >
              <span className="text-4xl ff-flag">🏳️</span>
            </div>
            <div
              className="text-[11px] font-extrabold uppercase mb-1"
              style={{ color: '#fb923c', letterSpacing: '0.22em' }}
            >
              Surrender?
            </div>
            <h2
              className="font-black uppercase"
              style={{
                color: c.title,
                fontSize: '24px',
                letterSpacing: '0.04em',
                textShadow: c.titleShadow,
              }}
            >
              Forfeit Battle
            </h2>
            <p className="text-xs mt-2" style={{ color: c.sub }}>
              This action cannot be undone
            </p>
          </div>

          <div className="px-5 pb-2 space-y-2">
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: c.cardBg,
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
            >
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-semibold" style={{ color: c.cardText }}>
                Your opponent will win
              </p>
            </div>
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: c.cardBg,
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 3px 0 #0a0a0a',
              }}
            >
              <span className="text-lg">💸</span>
              <p className="text-sm font-semibold" style={{ color: c.cardText }}>
                You'll lose your buy-in
                {buyIn > 0 ? <span style={{ color: '#fb923c' }}> (${formatMoney(buyIn, 0)})</span> : ''}
              </p>
            </div>
            {potSize > 0 && (
              <div
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: c.cardBg,
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 3px 0 #0a0a0a',
                }}
              >
                <span className="text-lg">🏆</span>
                <p className="text-sm font-semibold" style={{ color: c.cardText }}>
                  Pot size:{' '}
                  <span style={{ color: '#10b981', fontWeight: 800 }}>
                    ${formatMoney(potSize, 0)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-4 flex flex-col gap-3">
            <button
              onClick={onCancel}
              disabled={isForfeiting}
              className="ff-keep-btn w-full py-3.5 rounded-2xl text-sm uppercase disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                fontWeight: 900,
                letterSpacing: '0.08em',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.4)',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
              }}
            >
              Keep Fighting 💪
            </button>
            <button
              onClick={handleConfirm}
              disabled={isForfeiting}
              className="ff-forfeit-btn w-full py-3 rounded-2xl text-sm uppercase disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
                color: '#fff',
                fontWeight: 900,
                letterSpacing: '0.08em',
                border: '2.5px solid #0a0a0a',
                boxShadow: '0 4px 0 #0a0a0a',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
              }}
            >
              {isForfeiting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full ff-spinner"
                    style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
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
