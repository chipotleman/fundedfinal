
import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [selectedTier, setSelectedTier] = useState(null);

  const challengeTiers = [
    {
      id: 1,
      name: "Starter Challenge",
      startingBalance: 1000,
      target: 2500,
      maxBet: 100,
      payout: 500,
      duration: "30 days",
      description: "Perfect for beginners to prove their betting skills"
    },
    {
      id: 2,
      name: "Pro Challenge",
      startingBalance: 5000,
      target: 12500,
      maxBet: 500,
      payout: 2500,
      duration: "45 days",
      description: "For experienced bettors ready for bigger stakes",
      popular: true
    },
    {
      id: 3,
      name: "Elite Challenge",
      startingBalance: 10000,
      target: 25000,
      maxBet: 1000,
      payout: 5000,
      duration: "60 days",
      description: "The ultimate test for professional bettors"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-white">
            Rollr<span className="text-emerald-400">Funded</span>
          </div>
          <div className="flex space-x-6">
            <Link href="/login" className="text-gray-300 hover:text-white transition">
              Login
            </Link>
            <Link href="/auth" className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Bet Smart,
            <span className="text-emerald-400 block">Get Funded</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Prove your betting skills with zero risk. Complete challenges to earn real payouts 
            without risking your own money.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth" className="bg-emerald-500 text-white px-8 py-4 rounded-lg font-semibold hover:bg-emerald-600 transition text-lg">
              Start Free Challenge
            </Link>
            <Link href="/how-it-works" className="border border-gray-400 text-white px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 transition text-lg">
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-emerald-400">$2.5M+</div>
              <div className="text-gray-300">Payouts Distributed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">15,000+</div>
              <div className="text-gray-300">Active Traders</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">72%</div>
              <div className="text-gray-300">Success Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">$500</div>
              <div className="text-gray-300">Avg. First Payout</div>
            </div>
          </div>
        </div>
      </section>

      {/* Challenge Tiers */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Choose Your Challenge</h2>
            <p className="text-xl text-gray-300">Select the tier that matches your skill level</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {challengeTiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative bg-slate-800 rounded-2xl p-8 border-2 transition-all cursor-pointer ${
                  tier.popular
                    ? 'border-emerald-400 scale-105'
                    : selectedTier === tier.id
                    ? 'border-emerald-400'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedTier(tier.id)}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-emerald-400 text-black px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  <p className="text-gray-400 mb-6">{tier.description}</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Starting Balance:</span>
                      <span className="text-emerald-400 font-semibold">${tier.startingBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Profit Target:</span>
                      <span className="text-emerald-400 font-semibold">${tier.target.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Max Bet Size:</span>
                      <span className="text-white">${tier.maxBet}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Duration:</span>
                      <span className="text-white">{tier.duration}</span>
                    </div>
                  </div>
                  
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-emerald-400">${tier.payout.toLocaleString()}</div>
                    <div className="text-gray-300">Payout on Success</div>
                  </div>
                  
                  <Link href="/auth" className="w-full bg-emerald-500 text-white py-3 rounded-lg font-semibold hover:bg-emerald-600 transition block text-center">
                    Start Challenge
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Choose Challenge</h3>
              <p className="text-gray-300">Select your preferred challenge tier based on your experience and risk tolerance.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Trade & Profit</h3>
              <p className="text-gray-300">Use our virtual bankroll to place bets on real sports events with live odds.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Get Paid</h3>
              <p className="text-gray-300">Reach your profit target and receive real money payouts to your preferred method.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-2xl font-bold text-white mb-4">
            Rollr<span className="text-emerald-400">Funded</span>
          </div>
          <p className="text-gray-400 mb-6">Risk-free sports betting challenges with real payouts</p>
          <div className="flex justify-center space-x-8">
            <Link href="/rules" className="text-gray-400 hover:text-white transition">Rules</Link>
            <Link href="/how-it-works" className="text-gray-400 hover:text-white transition">How It Works</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
