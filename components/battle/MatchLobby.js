import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MatchLobby({ matchup, currentUser, onDismiss }) {
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();

  useEffect(() => {
    if (!matchup) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchup, router]);

  if (!matchup) return null;

  const isUser1 = matchup.user1Id === currentUser?.id;
  const myBalance = isUser1 ? matchup.user1Balance : matchup.user2Balance;
  const buyIn = matchup.startingBalance || myBalance;
  const potSize = matchup.potSize;
  const payout = matchup.winnerPayout;

  const matchTypeLabel = {
    random: 'Quick Match',
    friend: 'Friend Battle',
    private: 'Private Match',
  }[matchup.matchType] || 'Battle';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">{matchTypeLabel}</div>
        <h2 className="text-2xl font-bold text-white mb-8">Match Found!</h2>

        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mx-auto mb-2 ring-2 ring-blue-500/30 overflow-hidden">
              {matchup.player1?.avatar ? (
                <img src={matchup.player1.avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-2xl font-bold text-white">{matchup.player1?.username?.[0]?.toUpperCase() || 'P1'}</span>
              )}
            </div>
            <div className="text-white text-sm font-bold truncate max-w-[100px]">{matchup.player1?.username || 'Player 1'}</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-3xl font-black text-gray-500">VS</div>
          </div>

          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center mx-auto mb-2 ring-2 ring-red-500/30 overflow-hidden">
              {matchup.player2?.avatar ? (
                <img src={matchup.player2.avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-2xl font-bold text-white">{matchup.player2?.username?.[0]?.toUpperCase() || 'P2'}</span>
              )}
            </div>
            <div className="text-white text-sm font-bold truncate max-w-[100px]">{matchup.player2?.username || 'Player 2'}</div>
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-5 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Buy-In</span>
            <span className="text-white font-medium">${parseFloat(buyIn || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Prize Pool</span>
            <span className="text-white font-medium">${parseFloat(potSize || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Winner Gets</span>
            <span className="text-green-400 font-bold">${parseFloat(payout || 0).toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-700/50 pt-3">
            <p className="text-gray-500 text-xs text-center">Higher ending balance wins · 10% platform fee</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-gray-400 text-sm mb-1">Starting in</div>
          <div className="text-5xl font-black text-white">{countdown}</div>
        </div>
      </div>
    </div>
  );
}
