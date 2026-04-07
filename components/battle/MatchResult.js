import { useState, useEffect, useRef, useCallback } from 'react';

function useCountUp(target, duration = 1000, shouldStart = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!shouldStart) return;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, shouldStart]);

  return value;
}

export default function MatchResult({ matchup, currentUserId, onRematch, onClose }) {
  const [showStats, setShowStats] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCompleted = matchup && matchup.status === 'completed';
  const isUser1 = matchup?.user1Id === currentUserId;
  const myFinalBalance = parseFloat(isUser1 ? matchup?.user1FinalBalance : matchup?.user2FinalBalance) || 0;
  const opponentFinalBalance = parseFloat(isUser1 ? matchup?.user2FinalBalance : matchup?.user1FinalBalance) || 0;
  const startingBalance = parseFloat(matchup?.startingBalance) || 0;
  const pnl = myFinalBalance - startingBalance;
  const isWinner = isCompleted && matchup?.winnerId === currentUserId;
  const isTie = matchup?.winnerType === 'tie';
  const prizeWon = isWinner && matchup?.winnerPayout ? parseFloat(matchup.winnerPayout) : 0;

  useEffect(() => {
    if (!isCompleted) return;
    const t1 = setTimeout(() => setShowTitle(true), 100);
    const t2 = setTimeout(() => setShowStats(true), 600);
    const t3 = setTimeout(() => { if (isWinner) setShowConfetti(true); }, 200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isCompleted, isWinner]);

  const animatedStarting = useCountUp(startingBalance, 800, showStats);
  const animatedFinal = useCountUp(myFinalBalance, 1000, showStats);
  const animatedPnl = useCountUp(Math.abs(pnl), 1200, showStats);
  const animatedPrize = useCountUp(prizeWon, 1400, showStats);

  const handleShare = useCallback(() => {
    const text = `I just won $${prizeWon.toFixed(2)} on Piks! 🏆🔥`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [prizeWon]);

  if (!isCompleted) return null;

  const confettiColors = ['#3b82f6', '#10b981', '#06b6d4', '#f97316', '#fbbf24', '#22d3ee'];

  return (
    <>
      <style>{`
        @keyframes mr-confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes mr-trophy-bounce {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes mr-title-slam {
          0% { transform: scale(3); opacity: 0; }
          60% { transform: scale(0.9); opacity: 1; }
          80% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mr-defeat-fade {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes mr-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-8px); }
          20% { transform: translateX(8px); }
          30% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          50% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes mr-stats-slide {
          0% { transform: translateY(60px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes mr-golden-glow {
          0%, 100% { text-shadow: 0 0 10px rgba(251,191,36,0.5), 0 0 30px rgba(251,191,36,0.3); }
          50% { text-shadow: 0 0 20px rgba(251,191,36,0.8), 0 0 50px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.3); }
        }
        @keyframes mr-pulse-btn {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
        }
        @keyframes mr-flash {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes mr-scale-balance {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(3deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes mr-vignette-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .mr-confetti-piece {
          position: fixed;
          width: 8px;
          height: 8px;
          top: -10px;
          z-index: 60;
          animation: mr-confetti-fall linear forwards;
        }
        .mr-trophy {
          animation: mr-trophy-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .mr-title-win {
          animation: mr-title-slam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, mr-golden-glow 2s ease-in-out infinite;
        }
        .mr-title-lose {
          animation: mr-defeat-fade 0.8s ease-out forwards;
        }
        .mr-title-tie {
          animation: mr-scale-balance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .mr-shake {
          animation: mr-shake 0.5s ease-out;
        }
        .mr-stats-card {
          animation: mr-stats-slide 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .mr-pulse-rematch {
          animation: mr-pulse-btn 1.5s ease-in-out infinite;
        }
        .mr-red-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 51;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(220,38,38,0.3) 100%);
          animation: mr-vignette-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {showConfetti && isWinner && Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="mr-confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: confettiColors[i % confettiColors.length],
            animationDuration: `${2 + Math.random() * 2}s`,
            animationDelay: `${Math.random() * 1.5}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 6}px`,
          }}
        />
      ))}

      {!isWinner && !isTie && <div className="mr-red-vignette" />}

      <div className={`fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 ${!isWinner && !isTie ? 'mr-shake' : ''}`}>
        <div className="max-w-md w-full text-center">

          {showTitle && (
            <div className="mb-6">
              {isTie ? (
                <>
                  <div className="mr-title-tie">
                    <span className="text-6xl block mb-3">⚖️</span>
                  </div>
                  <h2 className="text-4xl font-black text-cyan-400 mr-title-tie" style={{ animationDelay: '0.15s' }}>
                    DRAW!
                  </h2>
                  <p className="text-gray-400 mt-2 text-sm">Evenly matched</p>
                </>
              ) : isWinner ? (
                <>
                  <div className="mr-trophy">
                    <span className="text-7xl block mb-3">🏆</span>
                  </div>
                  <h2 className="text-4xl font-black text-yellow-400 mr-title-win tracking-wider">
                    VICTORY!
                  </h2>
                  {prizeWon > 0 && (
                    <p className="text-emerald-400 text-lg font-bold mt-2">
                      +${animatedPrize.toFixed(2)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <span className="text-6xl block mb-3 mr-title-lose">😤</span>
                  <h2 className="text-4xl font-black text-red-500 mr-title-lose tracking-wider">
                    DEFEAT
                  </h2>
                  <p className="text-gray-500 mt-2 text-sm">Better luck next time</p>
                </>
              )}
            </div>
          )}

          {showStats && (
            <div className="mr-stats-card bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 mb-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Starting Balance</span>
                <span className="text-white font-medium">${animatedStarting.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Final Balance</span>
                <span className="text-white font-bold">${animatedFinal.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#1a1a1a] pt-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">P&L</span>
                <span className={`font-bold text-lg ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : '-'}${animatedPnl.toFixed(2)}
                </span>
              </div>
              {isWinner && prizeWon > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Prize Won</span>
                  <span className="text-emerald-400 font-bold text-lg">${animatedPrize.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {showStats && (
            <div className="flex gap-3 mr-stats-card" style={{ animationDelay: '0.15s' }}>
              <button
                onClick={onRematch}
                className="flex-1 bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Rematch
              </button>
              {isWinner ? (
                <button
                  onClick={handleShare}
                  className="flex-1 bg-[#1a1a1a] text-emerald-400 font-semibold py-3 rounded-lg hover:bg-[#222] transition-colors border border-[#333]"
                >
                  {copied ? 'Copied!' : 'Share Win'}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 bg-[#1a1a1a] text-gray-300 font-medium py-3 rounded-lg hover:bg-[#222] transition-colors border border-[#333]"
                >
                  Back to Battle
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}