import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MatchLobby({ matchup, currentUser, onDismiss }) {
  const [countdown, setCountdown] = useState(5);
  const [showBattle, setShowBattle] = useState(false);
  const [entered, setEntered] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!matchup) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchup]);

  useEffect(() => {
    if (countdown === 0) {
      setShowBattle(true);
      const t = setTimeout(() => router.push('/'), 1500);
      return () => clearTimeout(t);
    }
  }, [countdown, router]);

  if (!matchup) return null;

  const isUser1 = matchup.user1Id === currentUser?.id;
  const myBalance = isUser1 ? matchup.user1Balance : matchup.user2Balance;
  const buyIn = matchup.startingBalance || myBalance;
  const potSize = matchup.potSize;
  const payout = matchup.winnerPayout;

  const player1 = matchup.player1 || { username: matchup.user1Info?.username || 'Player 1', avatar: matchup.user1Info?.avatar };
  const player2 = matchup.player2 || { username: matchup.user2Info?.username || 'Player 2', avatar: matchup.user2Info?.avatar };

  const matchTypeLabel = {
    random: 'Quick Match',
    friend: 'Friend Battle',
    private: 'Private Match',
  }[matchup.matchType] || 'Battle';

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          0% { transform: translateX(-120vw); opacity: 0; }
          60% { transform: translateX(10px); opacity: 1; }
          100% { transform: translateX(0); }
        }
        @keyframes slideInRight {
          0% { transform: translateX(120vw); opacity: 0; }
          60% { transform: translateX(-10px); opacity: 1; }
          100% { transform: translateX(0); }
        }
        @keyframes vsSlam {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes countdownPop {
          0% { transform: scale(2); opacity: 0; }
          50% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes battleReveal {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes stakesSlideUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes labelFade {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .lobby-player-left {
          animation: slideInLeft 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-player-right {
          animation: slideInRight 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
          opacity: 0;
        }
        .lobby-vs {
          animation: vsSlam 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s forwards;
          opacity: 0;
        }
        .lobby-countdown {
          animation: countdownPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-battle-text {
          animation: battleReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-stakes {
          animation: stakesSlideUp 0.6s ease-out 1s forwards;
          opacity: 0;
        }
        .lobby-label {
          animation: labelFade 0.5s ease-out 0.3s forwards;
          opacity: 0;
        }
      `}</style>

      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4 overflow-hidden">
        <div className="max-w-md w-full text-center relative">
          <div className="lobby-label text-xs font-medium text-gray-400 uppercase tracking-[0.3em] mb-2">
            {matchTypeLabel}
          </div>

          <div className="flex items-center justify-center gap-4 mb-6 relative" style={{ minHeight: '160px' }}>
            <div className={`text-center flex-1 ${entered ? 'lobby-player-left' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div className="w-24 h-24 rounded-full bg-[#1e40af] flex items-center justify-center relative overflow-hidden border-2 border-[#333]">
                  {player1.avatar ? (
                    <img src={player1.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-3xl font-black text-white">{player1.username?.[0]?.toUpperCase() || 'P1'}</span>
                  )}
                </div>
              </div>
              <div className="text-white text-sm font-bold truncate max-w-[110px] mx-auto">{player1.username || 'Player 1'}</div>
            </div>

            <div className="flex flex-col items-center relative z-10">
              {showBattle ? (
                <div className="lobby-battle-text text-4xl font-black text-emerald-400">
                  BATTLE!
                </div>
              ) : (
                <div className={`${entered ? 'lobby-vs' : 'opacity-0'}`}>
                  <div className="text-5xl font-black text-white">
                    VS
                  </div>
                </div>
              )}
            </div>

            <div className={`text-center flex-1 ${entered ? 'lobby-player-right' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div className="w-24 h-24 rounded-full bg-[#065f46] flex items-center justify-center relative overflow-hidden border-2 border-[#333]">
                  {player2.avatar ? (
                    <img src={player2.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-3xl font-black text-white">{player2.username?.[0]?.toUpperCase() || 'P2'}</span>
                  )}
                </div>
              </div>
              <div className="text-white text-sm font-bold truncate max-w-[110px] mx-auto">{player2.username || 'Player 2'}</div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-px bg-[#1a1a1a] z-0 pointer-events-none" />
          </div>

          <div className="lobby-stakes">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Buy-In</span>
                <span className="text-white font-semibold">${parseFloat(buyIn || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Prize Pool</span>
                <span className="text-cyan-400 font-semibold">${parseFloat(potSize || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Winner Gets</span>
                <span className="text-emerald-400 font-bold text-base">${parseFloat(payout || 0).toFixed(2)}</span>
              </div>
              <div className="border-t border-[#222] pt-3">
                <p className="text-gray-500 text-xs text-center">Higher ending balance wins · 10% platform fee</p>
              </div>
            </div>
          </div>

          {!showBattle && (
            <div className="mb-4">
              <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Starting in</div>
              <div key={countdown} className="lobby-countdown text-6xl font-black text-white">
                {countdown}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
