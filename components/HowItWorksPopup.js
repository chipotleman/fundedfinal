
import { useState, useEffect } from 'react';

const steps = [
  {
    id: 1,
    title: "Choose Your Challenge",
    description: "Select from our three challenge tiers based on your experience and comfort level",
    icon: "🎯",
    details: [
      "Starter: $1,000 starting balance",
      "Pro: $5,000 starting balance", 
      "Elite: $10,000 starting balance"
    ]
  },
  {
    id: 2,
    title: "Start Betting",
    description: "Use our money to place bets on your favorite sports. No risk to your personal funds",
    icon: "💰",
    details: [
      "Bet on NFL, NBA, MLB, NHL & more",
      "Live betting available",
      "Professional odds and lines"
    ]
  },
  {
    id: 3,
    title: "Hit Your Target",
    description: "Reach your profit target within the challenge timeframe to qualify for payout",
    icon: "🎪",
    details: [
      "Starter: $200 profit target",
      "Pro: $1,000 profit target",
      "Elite: $2,000 profit target"
    ]
  },
  {
    id: 4,
    title: "Get Paid",
    description: "Keep 80% of your profits when you successfully complete a challenge",
    icon: "💸",
    details: [
      "Fast payouts within 24 hours",
      "Multiple withdrawal methods",
      "No hidden fees or charges"
    ]
  }
];

export default function HowItWorksPopup({ isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

    if (isLeftSwipe && currentIndex < steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const nextStep = () => {
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!isOpen) return null;

  const currentStep = steps[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl max-w-md w-full border-2 border-slate-700 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step Number */}
        <div className="absolute top-4 left-4 z-10">
          <span className="bg-gradient-to-r from-green-400 to-blue-500 text-black px-3 py-1 rounded-full text-xs font-bold">
            {currentIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Step Content */}
        <div
          className="p-8 pt-16"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Icon */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{currentStep.icon}</div>
          </div>

          {/* Title and Description */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">{currentStep.title}</h3>
            <p className="text-gray-300 text-lg leading-relaxed">{currentStep.description}</p>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-8">
            {currentStep.details.map((detail, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                <span className="text-gray-300">{detail}</span>
              </div>
            ))}
          </div>

          {/* Action Button */}
          {currentIndex === steps.length - 1 ? (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-lg"
            >
              Got It!
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-lg"
            >
              Next Step
            </button>
          )}
        </div>

        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={prevStep}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {currentIndex < steps.length - 1 && (
          <button
            onClick={nextStep}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Dots Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-green-400' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
