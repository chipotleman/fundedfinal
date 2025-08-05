
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

        {/* Challenge Card */}
        <div
          className="p-8 pt-12"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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
            <div className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <span className="text-gray-300 font-medium">Starting Balance</span>
              <span className="text-green-400 font-bold text-lg">${currentChallenge.startingBalance.toLocaleString()}</span>
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
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-2xl mb-6"
          >
            Start This Challenge
          </button>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                style={{ width: `${((currentIndex + 1) / challenges.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Desktop Navigation Buttons */}
          <div className="hidden md:flex items-center justify-between mb-4">
            <button
              onClick={prevChallenge}
              disabled={currentIndex === 0}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                currentIndex === 0 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Previous</span>
            </button>
            
            <div className="flex items-center space-x-2">
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
              disabled={currentIndex === challenges.length - 1}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                currentIndex === challenges.length - 1 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Mobile Swipe Indicator */}
          {challenges.length > 1 && (
            <div className="md:hidden flex items-center justify-center space-x-4 text-gray-400 text-sm">
              {currentIndex > 0 && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Swipe left</span>
                </div>
              )}
              {currentIndex < challenges.length - 1 && (
                <div className="flex items-center space-x-1">
                  <span>Swipe right</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
}
