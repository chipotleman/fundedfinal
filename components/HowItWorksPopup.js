
import { useState, useEffect } from 'react';

const steps = [
  {
    id: 1,
    title: "Choose Your Challenge",
    description: "Select from our three challenge tiers based on your experience and comfort level",
    icon: "🎯",
    details: [
      "Starter: $5,000 starting balance",
      "Pro: $10,000 starting balance", 
      "Elite: $25,000 starting balance"
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
    description: "Reach your target balance within the challenge timeframe to qualify for payout",
    icon: "🎪",
    details: [
      "Starter: $6,000 target balance",
      "Pro: $12,000 target balance",
      "Elite: $30,000 target balance"
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

  const goToStep = (index) => {
    setCurrentIndex(index);
  };

  if (!isOpen) return null;

  const currentStep = steps[currentIndex];

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
              <div key={index} className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                <span className="text-gray-300">{detail}</span>
              </div>
            ))}
          </div>

          {/* Action Button */}
          {currentIndex === steps.length - 1 ? (
            <button
              onClick={() => {
                onClose();
                // Scroll to demo section
                setTimeout(() => {
                  const demoSection = document.getElementById('demo-section');
                  if (demoSection) {
                    demoSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }, 100);
              }}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg mb-6"
            >
              Try a Demo
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl text-lg mb-6"
            >
              Next Step
            </button>
          )}

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Desktop Navigation Buttons */}
          <div className="hidden md:flex items-center justify-between mb-4">
            <button
              onClick={prevStep}
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
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={nextStep}
              disabled={currentIndex === steps.length - 1}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                currentIndex === steps.length - 1 
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
          {steps.length > 1 && (
            <div className="md:hidden flex items-center justify-center space-x-4 text-gray-400 text-sm">
              {currentIndex > 0 && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Swipe left</span>
                </div>
              )}
              {currentIndex < steps.length - 1 && (
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
