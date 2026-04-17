import { useEffect, useRef, useState } from 'react';
import CoinRain from './CoinRain';

export default function WonByForfeitModal({ isOpen, onClose, opponent, payout }) {
  const [show, setShow] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const celebrationTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      setShow(false);
      setCelebrating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = null;
      }
    };
  }, []);

  const handleClaim = () => {
    if (celebrating) return;
    setCelebrating(true);
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => {
      celebrationTimerRef.current = null;
      onClose && onClose();
    }, 2400);
  };

  const handleBackdrop = () => {
    if (celebrating) return;
    onClose && onClose();
  };

  if (!isOpen) return null;

  const opponentName = opponent?.username || 'Your opponent';
  const opponentAvatar = opponent?.avatar;
  const payoutDisplay = payout != null ? Number(payout).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: show ? 1 : 0,
        transition: 'opacity 240ms ease',
      }}
      onClick={handleBackdrop}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #050d1a 0%, #0a1f2e 50%, #050d1a 100%)',
          border: '2px solid rgba(16,185,129,0.55)',
          boxShadow: '0 0 60px rgba(16,185,129,0.35), 0 24px 48px rgba(0,0,0,0.5)',
          transform: show ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
          transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.35) 0%, transparent 60%)',
          }}
        />

        <div className="relative p-6 pt-8 text-center">
          <div className="text-5xl mb-2">🏆</div>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400 mb-1">
            Won by Forfeit
          </div>
          <div className="text-2xl font-black text-white mb-3">
            {opponentName} forfeited
          </div>

          <div className="flex items-center justify-center gap-3 my-4">
            <div
              className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                border: '2px solid rgba(239,68,68,0.5)',
                background: '#111',
                filter: 'grayscale(60%)',
              }}
            >
              {opponentAvatar ? (
                <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white/60">
                  {opponentName[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-3xl">🏳️</div>
          </div>

          <div
            className="rounded-2xl px-4 py-3 mb-5"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.35)',
            }}
          >
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">
              Payout
            </div>
            <div className="text-3xl font-black text-emerald-400">${payoutDisplay}</div>
          </div>

          <button
            onClick={handleClaim}
            disabled={celebrating}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-transform active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              boxShadow: '0 8px 20px rgba(16,185,129,0.35)',
              opacity: celebrating ? 0.85 : 1,
              cursor: celebrating ? 'default' : 'pointer',
            }}
          >
            {celebrating ? 'Claimed!' : 'Claim Win'}
          </button>
        </div>
      </div>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 110 }}>
        <CoinRain trigger={celebrating} />
      </div>
    </div>
  );
}
