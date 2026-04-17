import { useEffect, useState } from 'react';

export default function ForfeitConfirmedModal({ isOpen, onClose, opponent, payout, totalPot }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const opponentName = opponent?.username || 'Your opponent';
  const opponentAvatar = opponent?.avatar;
  const payoutDisplay = payout != null
    ? Number(payout).toLocaleString('en-US', { maximumFractionDigits: 2 })
    : '0';
  const potDisplay = totalPot != null
    ? Number(totalPot).toLocaleString('en-US', { maximumFractionDigits: 2 })
    : null;

  const handleStartNew = (e) => {
    e.stopPropagation();
    onClose && onClose();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[100] pointer-events-none"
      style={{
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        transform: `translate(-50%, ${show ? '0' : '20px'})`,
        opacity: show ? 1 : 0,
        transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease',
        width: 'min(420px, calc(100vw - 24px))',
      }}
    >
      <div
        className="pointer-events-auto rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #1a0a0a 0%, #2a1010 60%, #1a0a0a 100%)',
          border: '1px solid rgba(239,68,68,0.45)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 0 28px rgba(239,68,68,0.18)',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          aria-label="Dismiss"
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="p-3 sm:p-4 flex items-center gap-3">
          <div
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-2xl"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
            }}
          >
            🏳️
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">
                Battle Forfeited
              </span>
            </div>
            <div className="text-sm font-bold text-white truncate">
              ${payoutDisplay} paid to {opponentName}
            </div>
            <div className="text-[11px] text-white/55 mt-0.5">
              {potDisplay
                ? `From $${potDisplay} pot · your battle balance is now $0`
                : 'Your battle balance is now $0'}
            </div>
            <button
              onClick={handleStartNew}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Start a new battle
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5h6m0 0L5 2m3 3L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {opponentAvatar ? (
            <img
              src={opponentAvatar}
              alt=""
              className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            />
          ) : (
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white/70"
              style={{
                background: '#111',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {opponentName[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
