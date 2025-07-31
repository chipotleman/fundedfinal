
import React from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';

const Rules = ({ selectedBets = [], bankroll = 10000 }) => {
  const challengeTiers = [
    { name: "Starter", bankroll: 10000, target: 1000, fee: 49, payout: "80%" },
    { name: "Pro", bankroll: 25000, target: 2500, fee: 99, payout: "80%" },
    { name: "Elite", bankroll: 50000, target: 5000, fee: 199, payout: "85%" }
  ];

  const rules = [
    {
      icon: "🎯",
      title: "Challenge Objective",
      description: "Reach your profit target within the betting limit to qualify for funding. Each tier has different requirements and payouts."
    },
    {
      icon: "📊",
      title: "Real Market Odds",
      description: "All bets use live sportsbook odds updated every second. Your performance is tracked against real market conditions."
    },
    {
      icon: "💰",
      title: "Risk Management",
      description: "Maximum bet size is 5% of your account balance. Daily loss limit is 10% to encourage disciplined betting."
    },
    {
      icon: "🏆",
      title: "Payout Structure",
      description: "Keep 80-85% of profits depending on your tier. Monthly payouts via PayPal, Zelle, or cryptocurrency."
    },
    {
      icon: "🔄",
      title: "Reset Policy",
      description: "Failed challenges can be reset instantly with no penalties. Learn from mistakes and improve your strategy."
    },
    {
      icon: "📈",
      title: "Performance Tracking",
      description: "Detailed analytics track your ROI, win rate, average odds, and betting patterns to help optimize your approach."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        bankroll={bankroll}
        pnl={0}
        betSlipCount={selectedBets.length}
        onBetSlipClick={() => {}}
      />

      <div className="pt-20 pb-16">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          
          <div className="relative max-w-7xl mx-auto px-6 py-24 text-center">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
              Challenge <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Rules</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Master these rules to maximize your chances of getting funded. Our challenges are designed to identify consistently profitable bettors.
            </p>
          </div>
        </div>

        {/* Challenge Tiers */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Challenge Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {challengeTiers.map((tier, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300 group">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">{tier.name}</h3>
                  <div className="text-4xl font-black text-green-400 mb-2">${tier.bankroll.toLocaleString()}</div>
                  <div className="text-gray-400 mb-6">Starting Balance</div>
                  
                  <div className="space-y-3 text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Profit Target:</span>
                      <span className="text-white font-semibold">${tier.target.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Challenge Fee:</span>
                      <span className="text-white font-semibold">${tier.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Profit Share:</span>
                      <span className="text-green-400 font-semibold">{tier.payout}</span>
                    </div>
                  </div>

                  <Link href="/auth" className="mt-6 w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 inline-block text-center group-hover:scale-105 transform">
                    Start {tier.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Grid */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rules.map((rule, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{rule.icon}</div>
                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-blue-400 transition-colors">{rule.title}</h3>
                <p className="text-gray-300 leading-relaxed group-hover:text-white transition-colors">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Guidelines */}
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700 hover:border-purple-500/50 transition-colors">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Key Guidelines</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Maximum Bet Size</div>
                    <div className="text-gray-300 text-sm">5% of current balance per bet</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Daily Loss Limit</div>
                    <div className="text-gray-300 text-sm">10% of starting balance</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Minimum Odds</div>
                    <div className="text-gray-300 text-sm">-200 (1.50) or higher</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Challenge Duration</div>
                    <div className="text-gray-300 text-sm">No time limit - bet at your pace</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Sports Coverage</div>
                    <div className="text-gray-300 text-sm">NFL, NBA, MLB, NHL, UFC, Soccer+</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 hover:bg-slate-700/30 p-3 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-white font-semibold">Bet Types</div>
                    <div className="text-gray-300 text-sm">Spreads, Totals, Moneylines, Props</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive FAQ Section */}
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: "What happens if I lose my challenge?", a: "You can restart immediately with no penalties. Learn from your mistakes and try again." },
              { q: "How fast do I get paid?", a: "Payouts are processed monthly via PayPal, Zelle, or cryptocurrency." },
              { q: "Can I bet on any sport?", a: "Yes! We cover NFL, NBA, MLB, NHL, UFC, Soccer, Tennis, and many more." },
              { q: "Is there a time limit?", a: "No time limits. Take your time and bet strategically at your own pace." }
            ].map((item, index) => (
              <details key={index} className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700 group">
                <summary className="p-6 cursor-pointer hover:bg-slate-700/30 transition-colors">
                  <span className="text-white font-semibold text-lg">{item.q}</span>
                </summary>
                <div className="px-6 pb-6 text-gray-300 leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-12 border border-green-500/30 hover:border-green-400/50 transition-colors">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Funded?</h2>
            <p className="text-gray-300 mb-8 text-lg">Join thousands of successful bettors who've proven their skills and earned funding.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg hover:scale-105 transform">
                Start Challenge
              </Link>
              <Link href="/dashboard" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg border border-slate-600 hover:border-slate-500">
                View Dashboard
              </Link>
              <Link href="/leaderboard" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg">
                See Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rules;
