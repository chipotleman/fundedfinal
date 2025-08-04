
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';

export default function Packages() {
  const router = useRouter();

  const packages = [
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
      price: "$199",
      target: "$1,000",
      dailyLoss: "6%",
      features: [
        "6% daily loss limit",
        "$1,000 profit target",
        "80% profit share", 
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
      price: "$399", 
      target: "$2,500",
      dailyLoss: "8%",
      features: [
        "8% daily loss limit",
        "$2,500 profit target",
        "80% profit share",
        "14-day evaluation", 
        "All sports betting",
        "VIP support",
        "Advanced analytics",
        "Weekly payouts"
      ],
      popular: false
    }
  ];

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

      

      {/* Title Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4">
            PICK YOUR <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">CHALLENGE</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto">
            Choose the funding level that matches your betting strategy and start earning real profits
          </p>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
                <div className="text-gray-400 text-sm">One-time fee</div>
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
                Start Challenge
              </button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center mb-3 mx-auto">
                  <span className="text-white font-bold">1</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Purchase Challenge</h3>
                <p className="text-gray-400 text-sm">Choose your funding package and complete payment</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mb-3 mx-auto">
                  <span className="text-white font-bold">2</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Complete Challenge</h3>
                <p className="text-gray-400 text-sm">Reach your profit target within 14 days while following the rules</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mb-3 mx-auto">
                  <span className="text-white font-bold">3</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Get Funded</h3>
                <p className="text-gray-400 text-sm">Receive your funding and start earning 80%+ of all profits</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <Link href="/how-it-works" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 border border-slate-600">
            Learn More About Our Process
          </Link>
        </div>
      </div>
    </div>
  );
}
