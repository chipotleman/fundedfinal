export default function MatchResult({ matchup, currentUserId, onRematch, onClose }) {
  if (!matchup || matchup.status !== 'completed') return null;

  const isUser1 = matchup.user1Id === currentUserId;
  const myFinalBalance = parseFloat(isUser1 ? matchup.user1FinalBalance : matchup.user2FinalBalance) || 0;
  const opponentFinalBalance = parseFloat(isUser1 ? matchup.user2FinalBalance : matchup.user1FinalBalance) || 0;
  const startingBalance = parseFloat(matchup.startingBalance) || 0;
  const pnl = myFinalBalance - startingBalance;
  const isWinner = matchup.winnerId === currentUserId;
  const isTie = matchup.winnerType === 'tie';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          {isTie ? (
            <>
              <span className="text-5xl block mb-3">🤝</span>
              <h2 className="text-3xl font-black text-yellow-400">It's a Tie!</h2>
            </>
          ) : isWinner ? (
            <>
              <span className="text-5xl block mb-3">🏆</span>
              <h2 className="text-3xl font-black text-green-400">You Win!</h2>
            </>
          ) : (
            <>
              <span className="text-5xl block mb-3">😤</span>
              <h2 className="text-3xl font-black text-red-400">Defeat</h2>
            </>
          )}
        </div>

        <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Starting Balance</span>
            <span className="text-white font-medium">${startingBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Final Balance</span>
            <span className="text-white font-bold">${myFinalBalance.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-700/50 pt-3 flex justify-between items-center">
            <span className="text-gray-400 text-sm">P&L</span>
            <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
            </span>
          </div>
          {isWinner && matchup.winnerPayout && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Prize Won</span>
              <span className="text-green-400 font-bold">${parseFloat(matchup.winnerPayout).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRematch}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all"
          >
            Rematch
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 text-gray-300 font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Back to Battle
          </button>
        </div>
      </div>
    </div>
  );
}
