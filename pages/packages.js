
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';

export default function Packages() {
  const router = useRouter();
  const [billingType, setBillingType] = useState('monthly'); // 'monthly' or 'annual'

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
    // You can implement Stripe checkout or redirect to payment
    console.log('Purchasing package:', packageData);
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={null}
        pnl={null}
        betSlipCount={0}
        onBetSlipClick={() => {}}
      />

      {/* Compact Title Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-3">
            PICK YOUR <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">CHALLENGE</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto mb-6">
            Choose the funding level that matches your betting strategy and start earning real profits
          </p>
          
          {/* Billing Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-slate-800 rounded-xl p-1 border border-slate-700">
              <div className="flex">
                <button
                  onClick={() => setBillingType('monthly')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                    billingType === 'monthly'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingType('annual')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
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
      </div>

      {/* Packages Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop Grid Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-8">
          {packages.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`relative bg-slate-900 rounded-2xl border-2 p-6 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl ${
                pkg.popular 
                  ? 'border-green-400 shadow-lg shadow-green-400/20' 
                  : 'border-slate-700 hover:border-blue-400'
              }`}
            >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                  <div className="text-3xl font-black text-green-400 mb-1">{pkg.fundingAmount}</div>
                  <div className="text-gray-400 text-sm">Funding Amount</div>
                </div>

                <div className="text-center mb-6">
                  <div className="text-2xl font-bold text-white">{pkg.price}</div>
                  <div className="text-gray-400 text-sm">
                    {billingType === 'monthly' ? 'Per month' : 'Per year'}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Profit Target:</span>
                    <span className="text-green-400 font-bold">{pkg.target}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Daily Loss Limit:</span>
                    <span className="text-red-400 font-bold">{pkg.dailyLoss}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  {pkg.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePurchase(pkg)}
                  className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-300 ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                  }`}
                >
                  {billingType === 'monthly' ? 'Subscribe Now' : 'Subscribe Annually'}
                </button>
              </div>
            ))}
        </div>

        {/* Mobile Carousel Layout */}
        <div className="lg:hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex space-x-6 pb-4" style={{ width: 'max-content' }}>
              {packages.map((pkg) => (
                <div 
                  key={pkg.id} 
                  className={`flex-shrink-0 w-80 relative bg-slate-900 rounded-2xl border-2 p-6 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl ${
                    pkg.popular 
                      ? 'border-green-400 shadow-lg shadow-green-400/20' 
                      : 'border-slate-700 hover:border-blue-400'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                    <div className="text-3xl font-black text-green-400 mb-1">{pkg.fundingAmount}</div>
                    <div className="text-gray-400 text-sm">Funding Amount</div>
                  </div>

                  <div className="text-center mb-6">
                    <div className="text-2xl font-bold text-white">{pkg.price}</div>
                    <div className="text-gray-400 text-sm">
                      {billingType === 'monthly' ? 'Per month' : 'Per year'}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Profit Target:</span>
                      <span className="text-green-400 font-bold">{pkg.target}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Daily Loss Limit:</span>
                      <span className="text-red-400 font-bold">{pkg.dailyLoss}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-8">
                    {pkg.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePurchase(pkg)}
                    className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-300 ${
                      pkg.popular
                        ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                    }`}
                  >
                    {billingType === 'monthly' ? 'Subscribe Now' : 'Subscribe Annually'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll Indicator for Mobile */}
          <div className="flex justify-center mt-4">
            <div className="flex space-x-2">
              {packages.map((_, index) => (
                <div key={index} className="w-2 h-2 bg-gray-600 rounded-full"></div>
              ))}
            </div>
            <p className="text-gray-400 text-sm ml-4">← Swipe to explore packages →</p>
          </div>
        </div>
      </div>

      {/* Compact How It Works Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">Purchase Challenge</h3>
              <p className="text-gray-400 text-xs">Choose your funding package and complete payment</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">Complete Challenge</h3>
              <p className="text-gray-400 text-xs">Reach your profit target within 14 days while following the rules</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">Get Funded</h3>
              <p className="text-gray-400 text-xs">Receive your funding and start earning 80%+ of all profits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Call to Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-center">
        <Link href="/how-it-works" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 border border-slate-600 inline-block">
          Learn More About Our Process
        </Link>
      </div>
    </div>
  );
}
