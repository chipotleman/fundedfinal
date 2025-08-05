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

  const goToStep = (index) => {
    setCurrentIndex(index);
  };

  if (!isOpen) return null;

  const currentStep = steps[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-black text-white mb-2">
              How <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">It Works</span>
            </h2>
            <p className="text-gray-300 text-sm">Get funded to bet with our money. Keep 80% of your profits.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                number: "01",
                title: "Choose Challenge",
                description: "Select your challenge level based on your experience and comfort level.",
                icon: "🎯"
              },
              {
                number: "02", 
                title: "Complete Evaluation",
                description: "Demonstrate your betting skills by hitting your profit target with our virtual money.",
                icon: "📈"
              },
              {
                number: "03",
                title: "Get Funded & Trade",
                description: "Once you pass, we'll fund your real account. Keep 80% of all profits you make.",
                icon: "💰"
              }
            ].map((step, index) => (
              <div key={index} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 text-center hover:bg-slate-700/50 transition-all duration-300">
                <div className="text-3xl mb-3">{step.icon}</div>
                <div className="text-sm font-bold text-green-400 mb-2">{step.number}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-300 text-xs leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={() => {
              onClose();
              window.location.href = '/auth';
            }}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Start Your Challenge
          </button>
        </div>
      </div>
    </div>
  );
}