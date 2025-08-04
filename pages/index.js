import { useState } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import LiveFeed from '../components/LiveFeed';

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={null}
        pnl={null}
        betSlipCount={0}
        onBetSlipClick={() => {}}
      />

      <div>
        {/* Main Video Section - No scrolling needed */}
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-black"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-8">
            {/* Logo with matching glow effect */}
            <div className="text-center mb-12 sm:mb-16 pt-4 sm:pt-0">


              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 sm:mb-8 leading-tight px-2">
                Get <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Funded</span> to Bet
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-4 sm:mb-6 px-4">
                Watch how you can get funded up to <span className="text-green-400 font-bold">$25,000</span> to bet with and keep 80% of your profits
              </p>
            </div>

            {/* Main Video Player */}
            <div className="relative max-w-5xl mx-auto mb-8 px-4">
              {/* Video container with prominent tracing border */}
              <div className="relative">
                {/* Prominent purple/blue tracing border */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 p-[2px] animate-pulse"></div>

                {/* Video container - more rectangular */}
                <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
                  <video 
                    controls 
                    playsInline
                    webkit-playsinline="true"
                    muted
                    preload="metadata"
                    className="block w-full h-full object-cover md:aspect-[2.5/1] aspect-video"
                    poster="/fundmybet-logo.png"
                    style={{ 
                      minHeight: '240px',
                      maxHeight: '380px',
                      objectFit: 'cover'
                    }}
                  >
                    <source src="/latest-explainer-video.mov" type="video/mp4" />
                    <source src="/latest-explainer-video.mov" type="video/quicktime" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>

            {/* Call to Action Below Video */}
            <div className="text-center px-4 mb-8">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-6 sm:mb-8">
                <Link href="/auth" className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg shadow-2xl">
                  Start a Challenge
                </Link>
                <Link href="/how-it-works" className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg border border-slate-700">
                  How It Works
                </Link>
              </div>
            </div>

            {/* Live Winners Section - Moved up for better visual flow */}
            <div className="text-center mb-12 px-4">
              <h2 className="text-4xl font-bold text-white mb-4">
                See Real <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Winners</span>
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-8">
                Watch as traders like you win real money in real-time. Click any user to see their full profile and betting history.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                <LiveFeed />

                {/* Stats Panel */}
                <div className="bg-black/90 backdrop-blur-lg rounded-2xl border border-gray-800 p-8">
                  <h3 className="text-2xl font-bold text-white mb-6">Community Stats</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-black/50 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-green-400">$2.4M+</div>
                        <div className="text-gray-300">Total Payouts</div>
                      </div>
                      <div className="text-green-400 text-2xl">💰</div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/50 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-blue-400">12,847</div>
                        <div className="text-gray-300">Active Traders</div>
                      </div>
                      <div className="text-blue-400 text-2xl">👥</div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/50 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-purple-400">68.5%</div>
                        <div className="text-gray-300">Average Win Rate</div>
                      </div>
                      <div className="text-purple-400 text-2xl">📈</div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/50 rounded-xl">
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

            {/* Feature Boxes - Moved below Live Winners */}
            <div className="text-center px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto px-2">
                <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No Risk Betting</h3>
                  <p className="text-gray-400 text-sm">Bet with our money, not yours</p>
                </div>

                <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Real Payouts</h3>
                  <p className="text-gray-400 text-sm">Keep 80% of your profits</p>
                </div>

                <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">All Sports</h3>
                  <p className="text-gray-400 text-sm">NFL, NBA, MLB, NHL & more</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-black py-16">
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

        
      </div>
    </div>
  );
}