import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PiksPoolPopup({ isOpen, onClose, pool, onJoinSuccess }) {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);
  const [showDepositPrompt, setShowDepositPrompt] = useState(false);
  const [neededAmount, setNeededAmount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setError(null);
      setShowDepositPrompt(false);
      setIsJoining(false);
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

  const rules = [
    { icon: '⏱️', title: '1-Day Run It Up', desc: 'You have exactly 24 hours from when the challenge starts' },
    { icon: '💵', title: 'Starting Balance', desc: 'Everyone starts with $1,000' },
    { icon: '📈', title: 'Highest Balance Wins', desc: 'Player with the highest balance at the end wins' },
    { icon: '🏆', title: 'Winner Takes All', desc: 'Top pikker takes the whole pool' },
  ];

  const handleJoin = async () => {
    if (!pool?.id) {
      setError('No pool available');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch('/api/pools/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ poolId: pool.id }),
      });

      const data = await res.json();

      if (res.status === 402 && data.code === 'INSUFFICIENT_BALANCE') {
        setNeededAmount(data.needed);
        setShowDepositPrompt(true);
        setIsJoining(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to join pool');
        setIsJoining(false);
        return;
      }

      if (onJoinSuccess) {
        onJoinSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error('Error joining pool:', err);
      setError('Something went wrong. Please try again.');
      setIsJoining(false);
    }
  };

  const handleDeposit = () => {
    onClose();
    router.push('/deposit?amount=' + Math.ceil(neededAmount));
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-4 px-4 overflow-y-auto"
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
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
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
              ${prizePool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

          {showDepositPrompt ? (
            <div className="bg-red-500/20 rounded-2xl p-4 mb-6 text-center">
              <p className="text-white font-semibold mb-2">Insufficient Balance</p>
              <p className="text-white/70 text-sm mb-4">
                You need ${neededAmount.toFixed(2)} more to join this pool.
              </p>
              <button
                onClick={handleDeposit}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-colors"
              >
                Deposit ${Math.ceil(neededAmount)}
              </button>
            </div>
          ) : (
            <div className="bg-white/10 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-sm uppercase tracking-wide mb-3 text-center" style={{ color: '#ffffff' }}>How It Works</h3>
              <div className="space-y-3">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{rule.icon}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#ffffff' }}>{rule.title}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{rule.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 text-red-200 text-sm text-center p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!showDepositPrompt && (
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-4 bg-white/25 hover:bg-white/35 active:bg-white/40 active:scale-95 font-bold text-lg rounded-xl shadow-lg transition-all text-center backdrop-blur-sm disabled:opacity-50"
                style={{ color: '#ffffff' }}
              >
                {isJoining ? 'Joining...' : `Join Pool - $${buyIn.toFixed(0)}`}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-sm no-hover-effect"
              style={{ color: 'rgba(255,255,255,0.6)' }}
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
