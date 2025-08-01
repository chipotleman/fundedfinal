import { useState } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import LiveFeed from '../components/LiveFeed';

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        bankroll={null}
        pnl={null}
        betSlipCount={0}
        onBetSlipClick={() => {}}
      />

      <div className="pt-16">
        {/* Hero Section */}
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-8 sm:pt-0">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

          <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto py-8 sm:py-0">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
              Get <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Funded</span> to Bet
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Prove your betting skills in our challenges and get funded up to <span className="text-green-400 font-bold">$25,000</span> to bet with. Keep 80% of your profits.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg shadow-2xl">
                Start Challenge - $49
              </Link>
              <Link href="/rules" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg border border-slate-700">
                How It Works
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">No Risk Betting</h3>
                <p className="text-gray-400">Bet with our money, not yours. Prove your skills in simulated challenges first.</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Real Payouts</h3>
                <p className="text-gray-400">Keep 80% of your profits. Monthly payouts via PayPal, Zelle, or Bitcoin.</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-slate-700">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center mb-6 mx-auto">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">All Sports</h3>
                <p className="text-gray-400">NFL, NBA, MLB, NHL, UFC, Soccer and more. Live lines updated every second.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-slate-800 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-black text-green-400 mb-2">$2.1M+</div>
                <div className="text-gray-400">Total Payouts</div>
              </div>
              <div>
                <div className="text-4xl font-black text-blue-400 mb-2">15,000+</div>
                <div className="text-gray-400">Active Traders</div>
              </div>
              <div>
                <div className="text-4xl font-black text-purple-400 mb-2">78%</div>
                <div className="text-gray-400">Success Rate</div>
              </div>
              <div>
                <div className="text-4xl font-black text-orange-400 mb-2">24/7</div>
                <div className="text-gray-400">Live Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Feed Section */}
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              See Real <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Winners</span>
            </h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Watch as traders like you win real money in real-time. Click any user to see their full profile and betting history.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <LiveFeed />
            
            {/* Stats Panel */}
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Community Stats</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div>
                    <div className="text-2xl font-bold text-green-400">$2.4M+</div>
                    <div className="text-gray-300">Total Payouts</div>
                  </div>
                  <div className="text-green-400 text-2xl">💰</div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">12,847</div>
                    <div className="text-gray-300">Active Traders</div>
                  </div>
                  <div className="text-blue-400 text-2xl">👥</div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div>
                    <div className="text-2xl font-bold text-purple-400">68.5%</div>
                    <div className="text-gray-300">Average Win Rate</div>
                  </div>
                  <div className="text-purple-400 text-2xl">📈</div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                  <div>
                    <div className="text-2xl font-bold text-orange-400">24/7</div>
                    <div className="text-gray-300">Live Betting</div>
                  </div>
                  <div className="text-orange-400 text-2xl">⚡</div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-block">
                  Join the Winners
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}