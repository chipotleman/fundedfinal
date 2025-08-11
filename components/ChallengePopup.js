
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
    price: 99,
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
    price: 199,
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
    price: 299,
    badge: "ADVANCED",
    popular: false
  }
];

export default function ChallengePopup({ isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(1); // Start with Pro Challenge (most popular)
  const [showDropdown, setShowDropdown] = useState(false);
  const [step, setStep] = useState('selection'); // 'selection' or 'payment'
  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
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

  const handleNext = () => {
    setStep('payment');
  };

  const handleBack = () => {
    setStep('selection');
  };

  const handleCardInputChange = (field, value) => {
    if (field === 'cardNumber') {
      // Format card number with spaces
      value = value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
      if (value.length > 19) return; // Max length for formatted card number
    }
    if (field === 'expiry') {
      // Format expiry as MM/YY
      value = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2');
      if (value.length > 5) return;
    }
    if (field === 'cvv') {
      value = value.replace(/\D/g, '');
      if (value.length > 4) return;
    }
    
    setCardInfo(prev => ({ ...prev, [field]: value }));
  };

  const handlePayment = async () => {
    setLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      onClose();
      router.push('/auth');
    }, 2000);
  };

  if (!isOpen) return null;

  const currentChallenge = challenges[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="relative bg-black border-2 border-slate-700 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Close Button - Always visible */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Back Button (Payment Step) */}
        {step === 'payment' && (
          <button
            onClick={handleBack}
            className="absolute top-4 left-4 z-10 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {step === 'selection' ? (
          <>
            {/* Popular Badge */}
            {currentChallenge.popular && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-gradient-to-r from-green-400 to-blue-500 text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  Most Popular
                </span>
              </div>
            )}

            {/* Challenge Selection */}
            <div className="p-8 pt-12">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Choose Your Challenge Package</h2>
                <p className="text-gray-400">Select your starting balance to begin</p>
              </div>

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
                    className="flex justify-between items-center py-4 px-4 bg-slate-800/50 rounded-xl border-2 border-green-400/50 cursor-pointer hover:border-green-400 transition-all duration-300 shadow-lg shadow-green-400/20"
                  >
                    <div>
                      <span className="text-gray-300 font-medium">Starting Balance</span>
                      <div className="text-xs text-green-400 font-medium">Click to change package</div>
                    </div>
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
                            <div className="text-xs text-gray-400">{challenge.badge} • ${challenge.price}</div>
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

              {/* Price Display */}
              <div className="text-center mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-600">
                <div className="text-2xl font-bold text-white">${currentChallenge.price}</div>
                <div className="text-gray-400 text-sm">One-time challenge fee</div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-2xl mb-6 transform hover:scale-105 transition-all duration-300"
              >
                Next - Get Set Up (${currentChallenge.price})
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
          </>
        ) : (
          /* Payment Step */
          <div className="p-8 pt-12">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Complete Your Purchase</h2>
              <div className="flex items-center justify-center space-x-2 text-gray-400">
                <span>{currentChallenge.name}</span>
                <span>•</span>
                <span className="text-green-400 font-bold">${currentChallenge.price}</span>
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={cardInfo.email}
                  onChange={(e) => handleCardInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Cardholder Name</label>
                <input
                  type="text"
                  value={cardInfo.name}
                  onChange={(e) => handleCardInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Card Number</label>
                <input
                  type="text"
                  value={cardInfo.cardNumber}
                  onChange={(e) => handleCardInputChange('cardNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors"
                  placeholder="1234 5678 9012 3456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Expiry</label>
                  <input
                    type="text"
                    value={cardInfo.expiry}
                    onChange={(e) => handleCardInputChange('expiry', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors"
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">CVV</label>
                  <input
                    type="text"
                    value={cardInfo.cvv}
                    onChange={(e) => handleCardInputChange('cvv', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors"
                    placeholder="123"
                  />
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="text-center mb-6 p-3 bg-slate-800/30 rounded-xl border border-slate-600">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Your payment is secured with 256-bit SSL encryption</span>
              </div>
            </div>

            {/* Complete Purchase Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                `Pay and Start Challenge - $${currentChallenge.price}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
