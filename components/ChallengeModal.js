import { useState } from 'react';

export default function ChallengeModal({ onClose }) {
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  const challenges = [
    {
      id: 1,
      name: "Starter Challenge",
      bankroll: 1000,
      target: 1500,
      timeLimit: "7 days",
      difficulty: "Easy",
      payout: 250,
      description: "Perfect for beginners. Reach $1,500 from $1,000 in 7 days."
    },
    {
      id: 2,
      name: "Pro Challenge", 
      bankroll: 2500,
      target: 4000,
      timeLimit: "14 days",
      difficulty: "Medium",
      payout: 750,
      description: "For experienced traders. Reach $4,000 from $2,500 in 14 days."
    },
    {
      id: 3,
      name: "Elite Challenge",
      bankroll: 5000,
      target: 8000,
      timeLimit: "30 days", 
      difficulty: "Hard",
      payout: 2000,
      description: "For elite traders. Reach $8,000 from $5,000 in 30 days."
    }
  ];

  const handleStartChallenge = (challenge) => {
    // Handle challenge start logic here
    console.log('Starting challenge:', challenge);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Choose Your Challenge</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                selectedChallenge?.id === challenge.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-400 bg-slate-800'
              }`}
              onClick={() => setSelectedChallenge(challenge)}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">{challenge.name}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  challenge.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                  challenge.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {challenge.difficulty}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Starting Bankroll:</span>
                  <span className="text-white font-semibold">${challenge.bankroll.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target:</span>
                  <span className="text-green-400 font-semibold">${challenge.target.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time Limit:</span>
                  <span className="text-white font-semibold">{challenge.timeLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payout:</span>
                  <span className="text-blue-400 font-semibold">${challenge.payout.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4">{challenge.description}</p>

              {selectedChallenge?.id === challenge.id && (
                <button
                  onClick={() => handleStartChallenge(challenge)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Start Challenge
                </button>
              )}
            </div>
          ))}
        </div>

        {!selectedChallenge && (
          <div className="text-center mt-6">
            <p className="text-gray-400">Select a challenge to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
