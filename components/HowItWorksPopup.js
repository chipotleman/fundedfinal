
import Link from 'next/link';

export default function HowItWorksPopup({ isOpen, onClose }) {
  if (!isOpen) return null;

  const steps = [
    {
      number: 1,
      title: "Choose Your Challenge",
      description: "Select from Starter ($10K), Pro ($25K), or Elite ($100K) funding levels",
      details: "Pick the challenge that matches your experience and risk tolerance",
      icon: "💰",
      color: "from-blue-500 to-blue-600"
    },
    {
      number: 2,
      title: "Pay One-Time Fee",
      description: "Secure your funded account with a single payment - no monthly fees",
      details: "Your fee covers evaluation, funding, and ongoing support",
      icon: "💳",
      color: "from-green-500 to-green-600"
    },
    {
      number: 3,
      title: "Start Betting",
      description: "Place bets on your favorite sports with your funded account",
      details: "Real money, real markets, real profits from day one",
      icon: "🎯",
      color: "from-purple-500 to-purple-600"
    },
    {
      number: 4,
      title: "Hit Your Target",
      description: "Reach your profit goal while following simple risk management rules",
      details: "8-10% profit target with maximum 5% daily drawdown limit",
      icon: "📈",
      color: "from-orange-500 to-orange-600"
    },
    {
      number: 5,
      title: "Keep 80% Profits",
      description: "Withdraw up to 80% of all profits you generate",
      details: "Fast payouts, no hidden fees, keep betting with house money",
      icon: "💸",
      color: "from-pink-500 to-pink-600"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">How It Works</h2>
            <p className="text-gray-300">Your path to funded betting in 5 simple steps</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-6">
          {steps.map((step, index) => (
            <div key={step.number} className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/50 hover:bg-slate-700/50 transition-all duration-300">
              <div className="flex items-start space-x-4">
                <div className={`w-16 h-16 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-gray-400 text-sm font-medium mr-3">STEP {step.number}</span>
                    <div className="flex-1 h-px bg-slate-600"></div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-gray-300 mb-2 text-lg">{step.description}</p>
                  <p className="text-gray-400 text-sm">{step.details}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Key Benefits */}
        <div className="p-6 border-t border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-3"></span>
            Why Choose Funded Betting?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg p-4 border border-slate-600">
              <div className="text-green-400 font-bold text-lg mb-2">🚀 No Risk</div>
              <div className="text-white text-sm">Bet with our money, not yours. Keep the profits!</div>
            </div>
            <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg p-4 border border-slate-600">
              <div className="text-blue-400 font-bold text-lg mb-2">⚡ Instant Access</div>
              <div className="text-white text-sm">Start betting immediately after payment. No waiting!</div>
            </div>
            <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg p-4 border border-slate-600">
              <div className="text-purple-400 font-bold text-lg mb-2">💎 Scale Up</div>
              <div className="text-white text-sm">Successful bettors get access to larger funding amounts</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/auth" 
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Start Your Challenge Now
            </Link>
            <Link 
              href="/pricing" 
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center border border-slate-600 hover:border-slate-500"
            >
              View Pricing Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
