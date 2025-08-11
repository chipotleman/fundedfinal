import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const challenges = [
  {
    id: 1,
    name: "Starter Challenge",
    description: "Perfect for beginners looking to get started",
    startingBalance: 5000,
    target: 1000, // 20% of 5000
    maxBet: 250,
    payout: 800,
    price: 149,
    badge: "BEGINNER",
    popular: false
  },
  {
    id: 2,
    name: "Pro Challenge",
    description: "For experienced bettors ready to scale up",
    startingBalance: 10000,
    target: 2000, // 20% of 10000
    maxBet: 500,
    payout: 1600,
    price: 249,
    badge: "POPULAR",
    popular: true
  },
  {
    id: 3,
    name: "Elite Challenge",
    description: "Maximum stakes for serious professionals",
    startingBalance: 25000,
    target: 5000, // 20% of 25000
    maxBet: 1250,
    payout: 4000,
    price: 399,
    badge: "ADVANCED",
    popular: false
  }
];

export default function ChallengePopup({ isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(1); // Start with Pro Challenge (most popular)
  const [showDropdown, setShowDropdown] = useState(false);
  const [step, setStep] = useState('selection'); // 'selection' or 'payment'
  const [userSplit, setUserSplit] = useState(80); // Default 80% user split
  const [cardInfo, setCardInfo] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: '',
    email: '',
    zipCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showTargetExplainer, setShowTargetExplainer] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [termsAccepted, setTermsAccepted] = useState({ gambling: false, propFirm: false });
  const [showGamblingTerms, setShowGamblingTerms] = useState(false);
  const [showPropFirmTerms, setShowPropFirmTerms] = useState(false);
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
    if (field === 'zipCode') {
      value = value.replace(/\D/g, '');
      if (value.length > 5) return;
    }

    setCardInfo(prev => ({ ...prev, [field]: value }));
  };

  // Generate unique license key
  const generateLicenseKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    let result = '';
    
    for (let i = 0; i < segments; i++) {
      if (i > 0) result += '-';
      for (let j = 0; j < segmentLength; j++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    }
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-4);
    return `${result}-${timestamp}`;
  };

  const handlePayment = async () => {
    setLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      const newLicenseKey = generateLicenseKey();
      setLicenseKey(newLicenseKey);
      setStep('receipt');
    }, 2000);
  };

  const handleBeginChallenge = () => {
    onClose();
    router.push('/auth');
  };

  if (!isOpen) return null;

  const currentChallenge = challenges[currentIndex];

  // Calculate price based on split (80% is base price, lower = discount, higher = surcharge)
  const baseSplit = 80;
  let priceMultiplier;

  if (userSplit <= baseSplit) {
    // Discount for splits at or below 80%
    priceMultiplier = 1 - ((baseSplit - userSplit) * 0.02); // 2% discount per % below 80%
  } else {
    // Surcharge for splits above 80%
    priceMultiplier = 1 + ((userSplit - baseSplit) * 0.08); // 8% surcharge per % above 80%
  }

  const adjustedPrice = Math.round(currentChallenge.price * priceMultiplier);

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
            {/* Challenge Selection */}
            <div className="p-6 pt-8">
              {/* Header */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white">Choose Your Challenge</h2>
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
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{currentChallenge.name}</h3>
                <p className="text-gray-400 text-sm">{currentChallenge.description}</p>
              </div>

              {/* Challenge Details */}
              <div className="space-y-3 mb-6">
                {/* Starting Balance with Dropdown */}
                <div className="relative">
                  <div
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border-2 border-green-400/50 cursor-pointer hover:border-green-400 transition-all duration-300 shadow-lg shadow-green-400/20"
                  >
                    <div>
                      <span className="text-gray-300 font-medium text-sm">Starting Balance</span>
                      <div className="text-xs text-green-400 font-medium">Click to change</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 font-bold">${currentChallenge.startingBalance.toLocaleString()}</span>
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

                <div className="flex justify-between items-center py-2 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-300 font-medium text-sm">Target Balance</span>
                    <button
                      onClick={() => setShowTargetExplainer(true)}
                      className="w-3 h-3 bg-blue-500 hover:bg-blue-400 rounded-full flex items-center justify-center transition-colors"
                    >
                      <span className="text-white text-xs font-bold">?</span>
                    </button>
                  </div>
                  <span className="text-blue-400 font-bold">${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <span className="text-gray-300 font-medium text-sm">Max Bet Size</span>
                  <span className="text-white font-bold">${currentChallenge.maxBet}</span>
                </div>
              </div>

              {/* Profit Split */}
              <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/30 mb-4 relative">
                {/* Reset Button */}
                <button
                  onClick={() => setUserSplit(80)}
                  className="absolute top-2 right-2 w-6 h-6 bg-slate-700/80 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                  title="Reset to 80%"
                >
                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <div className="text-center mb-3">
                  <div className="text-sm font-medium text-gray-300">Profit Split</div>
                  <div className="text-xs text-gray-400">Drag anywhere on the bar to adjust</div>
                </div>

                {/* Draggable Split Visual */}
                <div
                  className="flex h-10 rounded-xl overflow-hidden border border-slate-600 cursor-grab active:cursor-grabbing relative"
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const startX = e.clientX;
                    const startSplit = userSplit;

                    const handleMouseMove = (e) => {
                      const deltaX = e.clientX - startX;
                      const deltaPercent = (deltaX / rect.width) * 100;
                      const newSplit = Math.max(50, Math.min(90, startSplit + deltaPercent));
                      setUserSplit(Math.round(newSplit));
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                  onTouchStart={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const startX = e.touches[0].clientX;
                    const startSplit = userSplit;

                    const handleTouchMove = (e) => {
                      const deltaX = e.touches[0].clientX - startX;
                      const deltaPercent = (deltaX / rect.width) * 100;
                      const newSplit = Math.max(50, Math.min(90, startSplit + deltaPercent));
                      setUserSplit(Math.round(newSplit));
                    };

                    const handleTouchEnd = () => {
                      document.removeEventListener('touchmove', handleTouchMove);
                      document.removeEventListener('touchend', handleTouchEnd);
                    };

                    document.addEventListener('touchmove', handleTouchMove);
                    document.addEventListener('touchend', handleTouchEnd);
                  }}
                >
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-150"
                    style={{ width: `${userSplit}%` }}
                  >
                    You {userSplit}%
                  </div>
                  <div
                    className="bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold transition-all duration-150"
                    style={{ width: `${100 - userSplit}%` }}
                  >
                    Us {100 - userSplit}%
                  </div>
                </div>
              </div>

              {/* Price Display */}
              <div className="text-center mb-4 p-3 bg-slate-800/30 rounded-xl border border-slate-600">
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-xl font-bold text-white">${adjustedPrice}</div>
                  {adjustedPrice !== currentChallenge.price && (
                    <div className="text-xs">
                      {userSplit < 80 ? (
                        <span className="text-green-400">(-${currentChallenge.price - adjustedPrice})</span>
                      ) : (
                        <span className="text-orange-400">(+${adjustedPrice - currentChallenge.price})</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-gray-400 text-xs">
                  Challenge fee
                  {adjustedPrice !== currentChallenge.price && (
                    <span className="ml-1">
                      {userSplit < 80 ? '(discount applied)' : '(surcharge applied)'}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-2xl mb-4 transform hover:scale-105 transition-all duration-300"
              >
                Next - Get Set Up (${adjustedPrice})
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
        ) : step === 'payment' ? (
          /* Payment Step */
          <div className="p-6 pt-12">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Funder.png" alt="Funder Logo" className="h-8 mx-auto" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Complete Purchase</h2>
              <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm">
                <span>{currentChallenge.name}</span>
                <span>•</span>
                <span className="text-green-400 font-bold">${adjustedPrice}</span>
                <span>•</span>
                <span className="text-blue-400 font-medium">{userSplit}% split</span>
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={cardInfo.email}
                  onChange={(e) => handleCardInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                  placeholder="your@email.com"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={cardInfo.name}
                  onChange={(e) => handleCardInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                  placeholder="John Doe"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardInfo.cardNumber}
                  onChange={(e) => handleCardInputChange('cardNumber', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                  placeholder="1234 5678 9012 3456"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-1">Expiry</label>
                  <input
                    type="text"
                    value={cardInfo.expiry}
                    onChange={(e) => handleCardInputChange('expiry', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                    placeholder="MM/YY"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-1">CVV</label>
                  <input
                    type="text"
                    value={cardInfo.cvv}
                    onChange={(e) => handleCardInputChange('cvv', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                    placeholder="123"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>

              {/* Zip Code Field - Shows when card number is being entered */}
              {cardInfo.cardNumber.length > 0 && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-gray-300 text-xs font-medium mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={cardInfo.zipCode}
                    onChange={(e) => handleCardInputChange('zipCode', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-400 focus:border-green-400 focus:outline-none transition-colors text-sm"
                    placeholder="12345"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}
            </div>

            {/* Security Notice and Account Info */}
            <div className="space-y-3 mb-4">
              <div className="text-center p-2 bg-slate-800/30 rounded-xl border border-slate-600">
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
                  <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Secured with SSL encryption</span>
                </div>
              </div>

              {/* Account Info Button */}
              <div className="text-center">
                <button
                  onClick={() => setShowAccountInfo(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium underline transition-colors"
                >
                  How Do I Get My Account?
                </button>
              </div>
            </div>

            {/* Complete Purchase Button */}
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                `Pay and Start Challenge - $${adjustedPrice}`
              )}
            </button>
          </div>
        ) : (
          /* Receipt Step */
          <div className="p-6 pt-12">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Funder.png" alt="Funder Logo" className="h-8 mx-auto" />
              </div>
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-gray-400 text-sm">Your challenge is ready to begin</p>
            </div>

            {/* License Key */}
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl border border-green-500/30 p-4 mb-6">
              <div className="text-center">
                <div className="text-gray-300 text-xs font-medium mb-1">License Key</div>
                <div className="text-green-400 font-mono font-bold text-lg tracking-wider">{licenseKey}</div>
                <div className="text-gray-400 text-xs mt-1">Keep this safe - you'll need it to access your challenge</div>
              </div>
            </div>

            {/* Challenge Details */}
            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h3 className="text-white font-bold text-lg mb-3">{currentChallenge.name}</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Starting Balance</span>
                    <span className="text-green-400 font-bold">${currentChallenge.startingBalance.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Target Balance (Phase 1)</span>
                    <span className="text-blue-400 font-bold">${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Target Balance (Phase 2)</span>
                    <span className="text-purple-400 font-bold">${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-600 pt-2 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Minimum Balance (Phase 1)</span>
                      <span className="text-red-400 font-bold">${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Minimum Balance (Phase 2)</span>
                      <span className="text-red-400 font-bold">${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-2 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Max Bet Size</span>
                      <span className="text-white font-bold">${currentChallenge.maxBet}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Profit Split</span>
                      <span className="text-green-400 font-bold">{userSplit}% / {100 - userSplit}%</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Challenge Fee</span>
                      <span className="text-white font-bold">${adjustedPrice}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-3 mb-6">
              <div className="text-white font-medium text-sm mb-3">Please accept the following terms:</div>
              
              {/* Gambling Risk Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="gambling-terms"
                  checked={termsAccepted.gambling}
                  onChange={(e) => setTermsAccepted(prev => ({ ...prev, gambling: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <div className="flex-1">
                  <label htmlFor="gambling-terms" className="text-gray-300 text-sm cursor-pointer">
                    I understand the gambling risks and responsibilities
                  </label>
                  <button
                    onClick={() => setShowGamblingTerms(true)}
                    className="text-blue-400 hover:text-blue-300 text-xs ml-2 underline"
                  >
                    (Read Full Terms)
                  </button>
                </div>
              </div>

              {/* Prop Firm Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="propfirm-terms"
                  checked={termsAccepted.propFirm}
                  onChange={(e) => setTermsAccepted(prev => ({ ...prev, propFirm: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <div className="flex-1">
                  <label htmlFor="propfirm-terms" className="text-gray-300 text-sm cursor-pointer">
                    I understand this is a proprietary trading firm simulation
                  </label>
                  <button
                    onClick={() => setShowPropFirmTerms(true)}
                    className="text-blue-400 hover:text-blue-300 text-xs ml-2 underline"
                  >
                    (Read Full Terms)
                  </button>
                </div>
              </div>
            </div>

            {/* Begin Challenge Button */}
            <button
              onClick={handleBeginChallenge}
              disabled={!termsAccepted.gambling || !termsAccepted.propFirm}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:cursor-not-allowed"
            >
              {(!termsAccepted.gambling || !termsAccepted.propFirm) ? 
                'Please Accept Terms to Continue' : 
                'Begin Challenge'
              }
            </button>
          </div>
        )}
      </div>

      {/* Account Info Modal */}
      {showAccountInfo && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6">
            {/* Close Button */}
            <button
              onClick={() => setShowAccountInfo(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">How Do I Get My Account?</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">New Users</h4>
                    <p className="text-sm">Your account details will be sent to the email on file immediately after payment completion.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Existing Users</h4>
                    <p className="text-sm">If you already have an account, your new challenge will be automatically added to your existing account.</p>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  Check your spam folder if you don't see the email within 5 minutes.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowAccountInfo(false)}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Gambling Terms Modal */}
      {showGamblingTerms && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowGamblingTerms(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Gambling Risk Disclosure</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300 text-sm">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-2">⚠️ Important Warning</h4>
                <p>Gambling can be addictive and should be done responsibly. Never bet more than you can afford to lose.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">No Profit Guarantee</h4>
                <p>There is absolutely no guarantee that you will make money from this challenge. Sports betting involves significant risk and most participants lose money.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Personal Responsibility</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You are solely responsible for your betting decisions</li>
                  <li>You acknowledge the risks involved in sports betting</li>
                  <li>You agree to gamble responsibly and within your means</li>
                  <li>You understand that past performance does not guarantee future results</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Limitation of Liability</h4>
                <p>Funder is not responsible for any financial losses you may incur. This is a skill-based challenge with inherent risks.</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3">
                <p className="text-xs text-gray-400">
                  If you or someone you know has a gambling problem, please seek help:
                  <br />• National Problem Gambling Helpline: 1-800-522-4700
                  <br />• Visit ncpgambling.org for resources
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowGamblingTerms(false)}
              className="w-full mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              I Understand the Risks
            </button>
          </div>
        </div>
      )}

      {/* Prop Firm Terms Modal */}
      {showPropFirmTerms && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowPropFirmTerms(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Proprietary Firm Terms</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300 text-sm">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">📋 Challenge Structure</h4>
                <p>This is a proprietary trading firm evaluation process designed to assess your sports betting skills.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Challenge Rules</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You must complete 2 phases to receive funding</li>
                  <li>Strict adherence to maximum bet sizes is required</li>
                  <li>Daily and overall drawdown limits must be respected</li>
                  <li>All betting activity is monitored and evaluated</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Evaluation Criteria</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Consistent profit generation within risk parameters</li>
                  <li>Proper risk management and position sizing</li>
                  <li>Adherence to all challenge rules and guidelines</li>
                  <li>Professional trading behavior and discipline</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Firm Discretion</h4>
                <p>Funder reserves the right to evaluate, modify, or terminate challenges based on our internal risk management policies. All decisions are final.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">No Guaranteed Outcomes</h4>
                <p>Completion of challenge phases does not guarantee funding. All evaluations are subject to final approval by our risk management team.</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowPropFirmTerms(false)}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              I Understand the Terms
            </button>
          </div>
        </div>
      )}

      {/* Target Explainer Modal */}
      {showTargetExplainer && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6">
            {/* Close Button */}
            <button
              onClick={() => setShowTargetExplainer(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Challenge Phases</h3>
              <p className="text-gray-400 text-sm">You must complete 2 phases to get funded</p>
            </div>

            {/* Phase 1 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Phase 1 - Evaluation</h4>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">CURRENT</span>
              </div>
              
              {/* Phase 1 Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Minimum: ${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                  <span>Target: ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 relative overflow-hidden">
                  {/* Danger Zone (Red) */}
                  <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500 w-[15%]"></div>
                  {/* Safe Zone (Gray) */}
                  <div className="absolute left-[15%] top-0 h-full bg-slate-600 w-[65%]"></div>
                  {/* Target Zone (Green) */}
                  <div className="absolute right-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400 w-[20%]"></div>
                  {/* Current Position Indicator */}
                  <div className="absolute left-[15%] top-0 h-full w-1 bg-white shadow-lg"></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-400">Fail Zone</span>
                  <span className="text-gray-400">Starting: ${currentChallenge.startingBalance.toLocaleString()}</span>
                  <span className="text-green-400">Pass Zone</span>
                </div>
              </div>

              <div className="text-sm text-gray-300 space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Reach ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()} to advance</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Don't fall below ${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Phase 2 - Verification</h4>
                <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full border border-gray-500/30">LOCKED</span>
              </div>
              
              {/* Phase 2 Progress Bar */}
              <div className="mb-3 opacity-50">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Minimum: ${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                  <span>Target: ${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 relative overflow-hidden">
                  {/* Danger Zone (Red) */}
                  <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500 w-[15%]"></div>
                  {/* Safe Zone (Gray) */}
                  <div className="absolute left-[15%] top-0 h-full bg-slate-600 w-[65%]"></div>
                  {/* Target Zone (Green) */}
                  <div className="absolute right-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400 w-[20%]"></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-400">Fail Zone</span>
                  <span className="text-gray-400">Starting: ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                  <span className="text-green-400">Pass Zone</span>
                </div>
              </div>

              <div className="text-sm text-gray-300 space-y-1 opacity-50">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Reach ${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()} to get funded</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Don't fall below ${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowTargetExplainer(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #3b82f6);
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #3b82f6);
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }

        .slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }
      `}</style>
    </div>
  );
}