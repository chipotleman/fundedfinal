
export default function ChallengeModal({ pnl, progressPercent, challengeGoal, onClose }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-zinc-900 rounded-2xl border border-green-400 p-6 w-80 flex flex-col items-center animate-fade-in"
      >
        <h2 className="text-lg font-semibold text-green-400 mb-4">Challenge Progress</h2>

        {/* Animated circular progress ring */}
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="rgba(74, 222, 128, 0.2)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#4ade80"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${progressPercent * 2.51} 251`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{progressPercent}%</span>
          </div>
        </div>

        <div className="text-center mb-4">
          <p className="text-sm text-gray-400">Current P&L</p>
          <p className={`text-xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
          </p>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm text-gray-400">Target Goal</p>
          <p className="text-lg font-semibold text-white">${challengeGoal.toLocaleString()}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Continue Trading
        </button>
      </div>
    </div>
  );
}
