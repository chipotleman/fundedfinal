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
          0% { transform: translateX(-120vw) rotate(-10deg); opacity: 0; }
          60% { transform: translateX(20px) rotate(2deg); opacity: 1; }
          80% { transform: translateX(-5px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        @keyframes slideInRight {
          0% { transform: translateX(120vw) rotate(10deg); opacity: 0; }
          60% { transform: translateX(-20px) rotate(-2deg); opacity: 1; }
          80% { transform: translateX(5px) rotate(1deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        @keyframes vsSlam {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.6); opacity: 1; }
          70% { transform: scale(0.85); }
          85% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes avatarGlow {
          0% { box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.1); }
          50% { box-shadow: 0 0 25px rgba(59,130,246,0.6), 0 0 50px rgba(59,130,246,0.3), 0 0 80px rgba(59,130,246,0.1); }
          100% { box-shadow: 0 0 10px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.1); }
        }
        @keyframes avatarGlowRight {
          0% { box-shadow: 0 0 10px rgba(6,182,212,0.3), 0 0 20px rgba(6,182,212,0.1); }
          50% { box-shadow: 0 0 25px rgba(6,182,212,0.6), 0 0 50px rgba(6,182,212,0.3), 0 0 80px rgba(6,182,212,0.1); }
          100% { box-shadow: 0 0 10px rgba(6,182,212,0.3), 0 0 20px rgba(6,182,212,0.1); }
        }
        @keyframes countdownPop {
          0% { transform: scale(2.5); opacity: 0; }
          30% { transform: scale(0.9); opacity: 1; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes battleFlash {
          0% { transform: scale(0.3); opacity: 0; text-shadow: 0 0 0px transparent; }
          30% { transform: scale(1.4); opacity: 1; text-shadow: 0 0 60px rgba(16,185,129,0.8), 0 0 120px rgba(6,182,212,0.4); }
          50% { transform: scale(0.95); }
          70% { transform: scale(1.05); text-shadow: 0 0 40px rgba(16,185,129,0.6), 0 0 80px rgba(6,182,212,0.3); }
          100% { transform: scale(1); text-shadow: 0 0 30px rgba(16,185,129,0.4), 0 0 60px rgba(6,182,212,0.2); }
        }
        @keyframes screenFlash {
          0% { opacity: 0; }
          20% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes energyLine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes energyPulse {
          0% { opacity: 0.3; height: 2px; }
          50% { opacity: 1; height: 4px; }
          100% { opacity: 0.3; height: 2px; }
        }
        @keyframes stakesSlideUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes labelFade {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .lobby-player-left {
          animation: slideInLeft 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-player-right {
          animation: slideInRight 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
          opacity: 0;
        }
        .lobby-vs {
          animation: vsSlam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards;
          opacity: 0;
        }
        .lobby-avatar-left {
          animation: avatarGlow 2s ease-in-out infinite;
        }
        .lobby-avatar-right {
          animation: avatarGlowRight 2s ease-in-out infinite 0.5s;
        }
        .lobby-countdown {
          animation: countdownPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-battle-text {
          animation: battleFlash 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-flash-overlay {
          animation: screenFlash 0.6s ease-out forwards;
        }
        .lobby-energy-line {
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.6), rgba(6,182,212,0.8), rgba(16,185,129,0.6), transparent);
          background-size: 200% 100%;
          animation: energyLine 1.5s linear infinite, energyPulse 1s ease-in-out infinite;
        }
        .lobby-stakes {
          animation: stakesSlideUp 0.6s ease-out 1s forwards;
          opacity: 0;
        }
        .lobby-label {
          animation: labelFade 0.5s ease-out 0.3s forwards;
          opacity: 0;
        }
        .lobby-ring {
          animation: ringRotate 3s linear infinite;
        }
      `}</style>

      <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden">
        {showBattle && (
          <div className="lobby-flash-overlay absolute inset-0 bg-emerald-400/50 z-10 pointer-events-none" />
        )}

        <div className="max-w-md w-full text-center relative z-20">
          <div className="lobby-label text-xs font-medium text-cyan-400/80 uppercase tracking-[0.3em] mb-2">
            {matchTypeLabel}
          </div>

          <div className="flex items-center justify-center gap-4 mb-6 relative" style={{ minHeight: '160px' }}>
            <div className={`text-center flex-1 ${entered ? 'lobby-player-left' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div className="absolute -inset-1 rounded-full lobby-ring" style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(59,130,246,0.6), transparent, rgba(59,130,246,0.3), transparent)',
                }} />
                <div className="lobby-avatar-left w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center relative overflow-hidden border-2 border-blue-400/50">
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
                <div className="lobby-battle-text text-4xl font-black bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                  BATTLE!
                </div>
              ) : (
                <div className={`${entered ? 'lobby-vs' : 'opacity-0'}`}>
                  <div className="text-5xl font-black bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent" style={{
                    textShadow: '0 0 30px rgba(59,130,246,0.3)',
                    WebkitTextStroke: '1px rgba(255,255,255,0.1)',
                  }}>
                    VS
                  </div>
                </div>
              )}
            </div>

            <div className={`text-center flex-1 ${entered ? 'lobby-player-right' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div className="absolute -inset-1 rounded-full lobby-ring" style={{
                  background: 'conic-gradient(from 180deg, transparent, rgba(6,182,212,0.6), transparent, rgba(6,182,212,0.3), transparent)',
                  animationDirection: 'reverse',
                }} />
                <div className="lobby-avatar-right w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center relative overflow-hidden border-2 border-cyan-400/50">
                  {player2.avatar ? (
                    <img src={player2.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-3xl font-black text-white">{player2.username?.[0]?.toUpperCase() || 'P2'}</span>
                  )}
                </div>
              </div>
              <div className="text-white text-sm font-bold truncate max-w-[110px] mx-auto">{player2.username || 'Player 2'}</div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[3px] z-0 pointer-events-none" style={{ maxWidth: '80%' }}>
              <div className="lobby-energy-line w-full h-full rounded-full" />
            </div>
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
              <div key={countdown} className="lobby-countdown text-6xl font-black bg-gradient-to-b from-white to-blue-200 bg-clip-text text-transparent">
                {countdown}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}