import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PackagesPopup({ isOpen, onClose }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(1); // Start with "Most Popular" package
  const [billingType, setBillingType] = useState('monthly');
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const monthlyPackages = [
    {
      id: 1,
      name: "Starter Challenge",
      fundingAmount: "$5,000",
      price: "$99",
      target: "$500",
      dailyLoss: "5%",
      features: [
        "5% daily loss limit",
        "$500 profit target", 
        "80% profit share",
        "Monthly subscription",
        "All sports betting",
        "Real-time tracking",
        "Cancel anytime"
      ],
      popular: false
    },
    {
      id: 2,
      name: "Pro Challenge",
      fundingAmount: "$10,000", 
      price: "$199",
      target: "$1,000",
      dailyLoss: "6%",
      features: [
        "6% daily loss limit",
        "$1,000 profit target",
        "80% profit share", 
        "Monthly subscription",
        "All sports betting",
        "Priority support",
        "Advanced analytics",
        "Cancel anytime"
      ],
      popular: true
    },
    {
      id: 3,
      name: "Elite Challenge",
      fundingAmount: "$25,000",
      price: "$299", 
      target: "$2,500",
      dailyLoss: "8%",
      features: [
        "8% daily loss limit",
        "$2,500 profit target",
        "80% profit share",
        "Monthly subscription", 
        "All sports betting",
        "VIP support",
        "Advanced analytics",
        "Weekly payouts",
        "Cancel anytime"
      ],
      popular: false
    }
  ];

  const annualPackages = [
    {
      id: 1,
      name: "Starter Challenge",
      fundingAmount: "$5,000",
      price: "$792",
      target: "$500",
      dailyLoss: "5%",
      features: [
        "5% daily loss limit",
        "$500 profit target", 
        "80% profit share",
        "Annual subscription",
        "14-day evaluation",
        "All sports betting",
        "Real-time tracking"
      ],
      popular: false
    },
    {
      id: 2,
      name: "Pro Challenge",
      fundingAmount: "$10,000", 
      price: "$1,592",
      target: "$1,000",
      dailyLoss: "6%",
      features: [
        "6% daily loss limit",
        "$1,000 profit target",
        "80% profit share", 
        "Annual subscription",
        "14-day evaluation",
        "All sports betting",
        "Priority support",
        "Advanced analytics"
      ],
      popular: true
    },
    {
      id: 3,
      name: "Elite Challenge",
      fundingAmount: "$25,000",
      price: "$2,392", 
      target: "$2,500",
      dailyLoss: "8%",
      features: [
        "8% daily loss limit",
        "$2,500 profit target",
        "80% profit share",
        "Annual subscription",
        "14-day evaluation", 
        "All sports betting",
        "VIP support",
        "Advanced analytics",
        "Weekly payouts"
      ],
      popular: false
    }
  ];

  const packages = billingType === 'monthly' ? monthlyPackages : annualPackages;

  const handlePurchase = (packageData) => {
    localStorage.setItem('selected_package', JSON.stringify({
      ...packageData,
      startingBalance: parseInt(packageData.fundingAmount.replace(/[$,]/g, '')),
      profitTarget: parseInt(packageData.target.replace(/[$,]/g, '')),
      dailyLossLimit: parseFloat(packageData.dailyLoss.replace('%', '')) / 100
    }));

    router.push('/auth');
  };

  const nextPackage = () => {
    setCurrentIndex((prev) => (prev + 1) % packages.length);
  };

  const prevPackage = () => {
    setCurrentIndex((prev) => (prev - 1 + packages.length) % packages.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      nextPackage();
    }
    if (touchEndX.current - touchStartX.current > 50) {
      prevPackage();
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPackage = packages[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-slate-900 rounded-2xl border-2 border-slate-700 max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center p-4 pb-0">
          <h2 className="text-xl font-black text-white mb-2">
            Choose Your <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Challenge</span>
          </h2>
          <p className="text-gray-300 text-xs mb-3">Swipe left/right to explore packages</p>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-3">
            <div className="bg-slate-800 rounded-lg p-1 border border-slate-700">
              <div className="flex">
                <button
                  onClick={() => setBillingType('monthly')}
                  className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 ${
                    billingType === 'monthly'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingType('annual')}
                  className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-all duration-300 ${
                    billingType === 'annual'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Annually
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Package Card */}
        <div 
          className="px-4 pb-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={`relative bg-slate-800 rounded-xl border-2 p-4 transition-all duration-300 ${
            currentPackage.popular 
              ? 'border-green-400 shadow-lg shadow-green-400/20' 
              : 'border-slate-600'
          }`}>
            {currentPackage.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  MOST POPULAR
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-white mb-1">{currentPackage.name}</h3>
              <div className="text-2xl font-black text-green-400 mb-1">{currentPackage.fundingAmount}</div>
              <div className="text-gray-400 text-xs">Funding Amount</div>
            </div>

            <div className="text-center mb-4">
              <div className="text-xl font-bold text-white">{currentPackage.price}</div>
              <div className="text-gray-400 text-xs">
                {billingType === 'monthly' ? 'Per month' : 'Per year'}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-xs">Profit Target:</span>
                <span className="text-green-400 font-bold text-sm">{currentPackage.target}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-xs">Daily Loss Limit:</span>
                <span className="text-red-400 font-bold text-sm">{currentPackage.dailyLoss}</span>
              </div>
            </div>

            <div className="space-y-1.5 mb-6">
              {currentPackage.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-300 text-xs">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handlePurchase(currentPackage)}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
                currentPackage.popular
                  ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
              }`}
            >
              {billingType === 'monthly' ? 'Subscribe Now' : 'Subscribe Annually'}
            </button>
          </div>

          {/* Navigation Dots & Arrows */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={prevPackage}
              className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="flex space-x-1.5">
              {packages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextPackage}
              className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}