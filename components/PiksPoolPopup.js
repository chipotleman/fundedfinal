import { useEffect } from 'react';
import TapSurface from './TapSurface';

export default function PiksPoolPopup({ isOpen, onClose, pool }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const buyIn = pool ? parseFloat(pool.buyIn) : 25;
  const maxPlayers = pool?.maxPlayers || 25;
  const currentPlayers = pool?.currentPlayers || 0;
  const prizePool = pool ? parseFloat(pool.maxPrizePool || pool.prizePool) : 562.50;
  const platformFee = 0.10;
  const winnerPayout = prizePool * (1 - platformFee);

  const rules = [
    { icon: '💵', title: 'Starting Balance', desc: 'Everyone starts with $1,000' },
    { icon: '🎯', title: 'Goal', desc: 'Grow your balance the most to win' },
    { icon: '🏆', title: 'Winner Takes All', desc: `Top player wins ${((1 - platformFee) * 100).toFixed(0)}% of the prize pool` },
    { icon: '📊', title: 'Betting Rules', desc: '1-5% of balance per pick, max 5 active bets' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 25%, #0369a1 50%, #075985 75%, #0c4a6e 100%)',
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={`bubble-${i}`}
              className="absolute rounded-full bg-white/10"
              style={{
                width: `${15 + (i * 4)}px`,
                height: `${15 + (i * 4)}px`,
                left: `${5 + (i * 8)}%`,
                top: `${10 + (i * 7) % 80}%`,
                animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10 p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full mb-3">
              <span className="text-lg">🌊</span>
              <span className="text-white text-sm font-bold uppercase tracking-wider">Piks Pool</span>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-4xl">🏆</span>
            </div>
            
            <p className="text-5xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] mb-1">
              ${winnerPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-white/70 text-sm">Winner Takes All</p>
          </div>

          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="bg-yellow-400 text-black px-4 py-2 rounded-xl shadow-lg mb-1">
                <span className="text-xl font-black">${buyIn.toFixed(0)}</span>
              </div>
              <p className="text-white/60 text-xs uppercase">Entry Fee</p>
            </div>
            <div className="text-center">
              <div className="bg-white/20 text-white px-4 py-2 rounded-xl mb-1">
                <span className="text-xl font-black">{currentPlayers}/{maxPlayers}</span>
              </div>
              <p className="text-white/60 text-xs uppercase">Players</p>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 mb-6">
            <h3 className="text-white font-bold text-sm uppercase tracking-wide mb-3 text-center">How It Works</h3>
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{rule.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm">{rule.title}</p>
                    <p className="text-white/70 text-xs">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <TapSurface
              onTap={onClose}
              className="w-full py-4 bg-white text-sky-700 font-bold text-lg rounded-xl shadow-lg hover:bg-white/90 transition-colors text-center"
            >
              Join Pool - ${buyIn.toFixed(0)}
            </TapSurface>
            <button
              onClick={onClose}
              className="text-white/60 text-sm hover:text-white/80 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
            50% { transform: translateY(-10px) scale(1.1); opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}
