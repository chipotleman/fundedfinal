import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const challenges = [
  {
    id: 1,
    name: "Starter Challenge",
    description: "Perfect for beginners looking to get started",
    startingBalance: 1000,
    target: 1200,
    maxBet: 50,
    payout: 800,
    badge: "BEGINNER",
    popular: false
  },
  {
    id: 2,
    name: "Pro Challenge",
    description: "For experienced bettors ready to scale up",
    startingBalance: 5000,
    target: 6000,
    maxBet: 250,
    payout: 4000,
    badge: "POPULAR",
    popular: true
  },
  {
    id: 3,
    name: "Elite Challenge",
    description: "Maximum stakes for serious professionals",
    startingBalance: 10000,
    target: 12000,
    maxBet: 500,
    payout: 8000,
    badge: "ADVANCED",
    popular: false
  }
];

export default function ChallengePopup({ isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(1); // Start with Pro Challenge (most popular)
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleChallengeSelect = (index) => {
    setCurrentIndex(index);
    setShowDropdown(false);
  };

  const handleSelectChallenge = (challenge) => {
    onClose();
    router.push('/auth');
  };

  if (!isOpen) return null;

  const currentChallenge = challenges[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="relative bg-black border-2 border-slate-700 rounded-3xl max-w-md w-full overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Popular Badge */}
        {currentChallenge.popular && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <span className="bg-gradient-to-r from-green-400 to-blue-500 text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              Most Popular
            </span>
          </div>
        )}

        {/* Challenge Card */}
        <div className="p-8 pt-12">
          {/* Badge */}
          <div className="text-center mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              currentChallenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              currentChallenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {currentChallenge.badge}
            </span>
          </div>

          {/* Title and Description */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-3">{currentChallenge.name}</h3>
            <p className="text-gray-400 text-lg">{currentChallenge.description}</p>
          </div>

          {/* Challenge Details */}
          <div className="space-y-4 mb-8">
            {/* Starting Balance with Dropdown */}
            <div className="relative">
              <div 
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50 cursor-pointer hover:border-green-400/50 transition-all duration-300"
              >
                <span className="text-gray-300 font-medium">Starting Balance</span>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400 font-bold text-lg">${currentChallenge.startingBalance.toLocaleString()}</span>
                  <svg className={`w-4 h-4 text-green-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-20">
                  {challenges.map((challenge, index) => (
                    <div
                      key={challenge.id}
                      onClick={() => handleChallengeSelect(index)}
                      className={`flex justify-between items-center py-3 px-4 cursor-pointer hover:bg-slate-700/50 transition-all duration-200 ${
                        index === currentIndex ? 'bg-green-500/20 border-l-4 border-green-400' : ''
                      } ${index === 0 ? 'rounded-t-xl' : ''} ${index === challenges.length - 1 ? 'rounded-b-xl' : ''}`}
                    >
                      <div>
                        <span className="text-white font-medium text-sm">{challenge.name}</span>
                        <div className="text-xs text-gray-400">{challenge.badge}</div>
                      </div>
                      <span className="text-green-400 font-bold">${challenge.startingBalance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <span className="text-gray-300 font-medium">Profit Target</span>
              <span className="text-blue-400 font-bold text-lg">${currentChallenge.target.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <span className="text-gray-300 font-medium">Max Bet Size</span>
              <span className="text-white font-bold text-lg">${currentChallenge.maxBet}</span>
            </div>
          </div>

          {/* Payout */}
          <div className="text-center p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/30 mb-8">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
              ${currentChallenge.payout.toLocaleString()}
            </div>
            <div className="text-gray-300 text-sm font-medium mt-1">Payout on Success</div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => handleSelectChallenge(currentChallenge)}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-2xl mb-6 transform hover:scale-105 transition-all duration-300"
          >
            Next - Get Set Up
          </button>

          {/* Challenge indicator */}
          <div className="flex justify-center space-x-2">
            {challenges.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-green-400' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}