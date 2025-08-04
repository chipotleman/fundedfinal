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
        <div className="relative w-40 h-40 mb-4">
          <div
            className="absolute inset-0 rounded-full border-4 border-green-700 animate-spin-slow"
            style={{
              background: `conic-gradient(#22c55e ${progressPercent}%, #1e293b ${progressPercent}%)`,
            }}
          />
          <div className="absolute inset-4 rounded-full bg-black flex flex-col items-center justify-center border border-green-700">
            <p className="text-green-300 text-sm">PnL</p>
            <p className="text-green-400 text-xl font-bold">${pnl}</p>
            <p className="text-green-300 text-sm mt-1">{progressPercent.toFixed(1)}%</p>
          </div>
        </div>

        <p className="text-green-300 mb-4">Goal: ${challengeGoal}</p>

        <button
          onClick={onClose}
          className="bg-green-400 text-black font-bold py-2 px-4 rounded hover:bg-green-500 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
