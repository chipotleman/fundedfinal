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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
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

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < challenges.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const nextChallenge = () => {
    if (currentIndex < challenges.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevChallenge = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToChallenge = (index) => {
    setCurrentIndex(index);
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

        <div
          className="p-8 pt-12"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Challenge Card */}
        <div className="relative h-full flex flex-col p-4">
          <div className="text-center mb-6">
            <div className="inline-block bg-gradient-to-r from-green-400/20 to-blue-500/20 backdrop-blur-lg rounded-full px-4 py-1 border border-green-400/30 mb-4">
              <span className="text-green-400 text-sm font-bold">{currentChallenge.badge}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{currentChallenge.name}</h2>
            <p className="text-gray-300 text-sm">{currentChallenge.description}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
              <div className="text-gray-400 text-xs font-medium mb-1">Starting Balance</div>
              <div className="text-green-400 text-xl font-bold">${currentChallenge.startingBalance.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
              <div className="text-gray-400 text-xs font-medium mb-1">Target</div>
              <div className="text-blue-400 text-xl font-bold">${currentChallenge.target.toLocaleString()}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
              <div className="text-gray-400 text-xs font-medium mb-1">Max Bet Size</div>
              <div className="text-purple-400 text-xl font-bold">${currentChallenge.maxBet}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
              <div className="text-gray-400 text-xs font-medium mb-1">Your Payout</div>
              <div className="text-orange-400 text-xl font-bold">${currentChallenge.payout.toLocaleString()}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSelectChallenge}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Start This Challenge
            </button>

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={prevChallenge}
                className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                disabled={currentIndex === 0}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex space-x-2">
                {challenges.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToChallenge(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextChallenge}
                className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                disabled={currentIndex === challenges.length - 1}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        </div>


      </div>
    </div>
  );
}