import { useState, useEffect } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock';
import { useRouter } from 'next/router';
import TapSurface from './TapSurface';

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
  const router = useRouter();

  useModalScrollLock(isOpen);

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

  const handleTryDemo = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openDemoPopup'));
  };

  if (!isOpen) return null;

  const currentStep = steps[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center overflow-y-auto z-50 p-4">
      <div className="relative bg-[#0a0a0a] border border-gray-800/50 rounded-2xl max-w-md w-full overflow-hidden">
        <TapSurface
          onTap={onClose}
          isActive={false}
          inactiveColor="#1a1a1a"
          inactiveTextColor="#9ca3af"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </TapSurface>

        <div className="absolute top-4 left-4 z-10">
          <span className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            {currentIndex + 1} of {steps.length}
          </span>
        </div>

        <div
          className="p-8 pt-16"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{currentStep.icon}</div>
          </div>

          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">{currentStep.title}</h3>
            <p className="text-gray-300 text-lg leading-relaxed">{currentStep.description}</p>
          </div>

          <div className="space-y-3 mb-8">
            {currentStep.details.map((detail, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-[#111111] rounded-lg border border-gray-800/50">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                <span className="text-gray-300">{detail}</span>
              </div>
            ))}
          </div>

          {currentIndex === steps.length - 1 ? (
            <TapSurface
              onTap={handleTryDemo}
              isActive={true}
              activeColor="#22c55e"
              className="w-full font-bold py-4 px-6 rounded-xl text-lg mb-6 text-center"
            >
              Try a Demo
            </TapSurface>
          ) : (
            <TapSurface
              onTap={nextStep}
              isActive={true}
              activeColor="#2563eb"
              className="w-full font-bold py-4 px-6 rounded-xl text-lg mb-6 text-center"
            >
              Next Step
            </TapSurface>
          )}

          <div className="mb-4">
            <div className="w-full bg-[#1a1a1a] rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-between mb-4">
            <TapSurface
              onTap={prevStep}
              disabled={currentIndex === 0}
              isActive={false}
              inactiveColor="transparent"
              inactiveTextColor={currentIndex === 0 ? '#4b5563' : '#9ca3af'}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Previous</span>
            </TapSurface>
            
            <div className="flex items-center space-x-2">
              {steps.map((_, index) => (
                <TapSurface
                  key={index}
                  onTap={() => goToStep(index)}
                  isActive={index === currentIndex}
                  activeColor="#22c55e"
                  inactiveColor="#374151"
                  className="w-2 h-2 rounded-full"
                />
              ))}
            </div>
            
            <TapSurface
              onTap={nextStep}
              disabled={currentIndex === steps.length - 1}
              isActive={false}
              inactiveColor="transparent"
              inactiveTextColor={currentIndex === steps.length - 1 ? '#4b5563' : '#9ca3af'}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg"
            >
              <span>Next</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </TapSurface>
          </div>

          {steps.length > 1 && (
            <div className="md:hidden flex items-center justify-center space-x-4 text-gray-500 text-sm">
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
