
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
        <div className="relative mb-4">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-zinc-700"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - (progressPercent || 0) / 100)}`}
              className="text-green-400 transition-all duration-500 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{Math.round(progressPercent || 0)}%</span>
          </div>
        </div>

        <div className="text-center space-y-2">
          <div className="text-gray-300">
            Current P&L: <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}${pnl?.toLocaleString() || '0'}
            </span>
          </div>
          <div className="text-gray-300">
            Goal: <span className="font-bold text-green-400">${challengeGoal?.toLocaleString() || '25,000'}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 bg-green-400 hover:bg-green-500 text-black font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
