import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import LiveFeed from '../components/LiveFeed';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';

// Thunder Card Module Component
function ThunderCardModule() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      // Here you would typically send to your backend
      console.log('Thunder Card waitlist signup:', email);
      setIsSubmitted(true);
      setEmail('');
    }
  };

  return (
    <div className="text-center px-4 mb-16">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 rounded-2xl border border-purple-500/30 overflow-hidden">
          {/* Header */}
          <div className="p-8 sm:p-12">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Introducing the <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Thunder Card</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
              The first prepaid bank card that gets funded directly from your betting profits. Use it anywhere, just like a regular debit card.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 pb-8">
            {/* Thunder Card Preview */}
            <div className="flex justify-center items-center">
              <div className="relative">
                {/* Card with gradient background */}
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-xl p-6 shadow-2xl border border-blue-500/30 transform hover:scale-105 transition-all duration-300" style={{aspectRatio: '1.586/1', width: '320px'}}>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-blue-300 text-xs font-medium mb-1">THUNDER CARD</div>
                      <div className="text-white text-base font-bold">PREMIUM</div>
                    </div>
                    <div className="w-10 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded flex items-center justify-center">
                      <div className="w-5 h-3 bg-yellow-300 rounded-sm"></div>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className="mb-4">
                    <div className="text-white text-lg font-mono tracking-widest">
                      •••• •••• •••• 1234
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-blue-300 text-xs mb-1">CARDHOLDER</div>
                      <div className="text-white text-sm font-bold">YOUR NAME</div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-300 text-xs mb-1">EXPIRES</div>
                      <div className="text-white text-sm font-bold">12/28</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon Sign Up */}
            <div className="flex flex-col justify-center">
              <div className="bg-black/40 backdrop-blur-lg rounded-xl p-8 border border-slate-700">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center bg-purple-600/20 text-purple-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
                    🚀 Coming Soon
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Get Early Access</h3>
                  <p className="text-gray-400 text-base">
                    Be the first to know when the Thunder Card launches. Join our exclusive waitlist for early access and special perks.
                  </p>
                </div>

                {!isSubmitted ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      Join Waitlist
                    </button>
                  </form>
                ) : (
                  <div className="text-center">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <div className="text-green-400 font-medium">
                        ✅ You're on the list! We'll notify you when the Thunder Card is ready.
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 text-center">
                  <Link href="/waitlist" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
                    Learn more about Thunder Card →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom Video Player Component
function CustomVideoPlayer() {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="relative md:aspect-[2.5/1] aspect-video bg-slate-800" style={{ minHeight: '240px', maxHeight: '380px' }}>
      {/* Video Element with Autoplay */}
      <video 
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        webkit-playsinline="true"
        preload="auto"
        className="w-full h-full object-cover"
        style={{ 
          objectFit: 'cover',
          backgroundColor: '#1e293b'
        }}
      >
        <source src="/latest-explainer-video.mov" type="video/mp4" />
        <source src="/latest-explainer-video.mov" type="video/quicktime" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);

  return (
    <div className="min-h-screen bg-black" style={{scrollBehavior: 'smooth'}}>
      <TopNavbar 
        bankroll={user ? 10000 : null}
        pnl={user ? 0 : null}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div style={{overflowY: 'visible'}}>
        {/* Main Video Section - No scrolling needed */}
        <div className="relative min-h-screen flex items-center justify-center">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-black"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-8">
            {/* Logo with matching glow effect */}
            <div className="text-center mb-12 sm:mb-16 pt-4 sm:pt-0">


              <h1 className="text-4xl font-black text-white mb-6 sm:mb-8 leading-tight px-2">
                Get <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-block" style={{ transform: 'translateY(0.47px)' }}>Funded</span> to Bet
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-4 sm:mb-6 px-4">
                Watch how you can get funded up to <Link href="/packages" className="text-green-400 font-bold hover:text-green-300 transition-colors cursor-pointer">$25,000</Link> to bet with and keep 80% of your profits
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
                  <CustomVideoPlayer />
                </div>
              </div>
            </div>

            {/* Call to Action Below Video */}
            <div className="text-center px-4 mb-8">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-6 sm:mb-8">
                <button 
                  onClick={() => setShowChallengePopup(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg shadow-2xl"
                >
                  Start a Challenge
                </button>
                <button 
                  onClick={() => setShowHowItWorksPopup(true)}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg border border-slate-700"
                >
                  How It Works
                </button>
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

                {/* Live Community Stats Panel */}
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 h-96 flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <h3 className="text-white font-bold">Live Community Stats</h3>
                    <span className="text-gray-400 text-sm">Real-time updates</span>
                  </div>

                  {/* Stats */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-sm">
                    <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">🟢</span>
                          <div>
                            <div className="text-white">
                              <span className="text-green-400 font-bold">1,247</span> Bettors Online
                            </div>
                            <div className="text-gray-400 text-xs">Active right now</div>
                          </div>
                        </div>
                        <div className="text-green-400 font-bold text-lg">Live</div>
                      </div>
                    </div>

                    <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-blue-400 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">⏱️</span>
                          <div>
                            <div className="text-white">
                              <span className="text-blue-400 font-bold">72.3%</span> Win Rate
                            </div>
                            <div className="text-gray-400 text-xs">Last hour performance</div>
                          </div>
                        </div>
                        <div className="text-blue-400 font-bold text-lg">+72%</div>
                      </div>
                    </div>

                    <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-purple-400 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">🎯</span>
                          <div>
                            <div className="text-white">
                              <span className="text-purple-400 font-bold">$184K</span> Gambled Today
                            </div>
                            <div className="text-gray-400 text-xs">Total action today</div>
                          </div>
                        </div>
                        <div className="text-purple-400 font-bold text-lg">$184K</div>
                      </div>
                    </div>

                    <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-orange-400 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">💸</span>
                          <div>
                            <div className="text-white">
                              <span className="text-orange-400 font-bold">$89K</span> Withdrawn Today
                            </div>
                            <div className="text-gray-400 text-xs">Successful payouts</div>
                          </div>
                        </div>
                        <div className="text-orange-400 font-bold text-lg">$89K</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-3 border-t border-slate-700 text-center">
                    <div className="text-gray-400 text-xs mb-3">
                      Live community data • Updated every second
                    </div>
                    <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 inline-block text-sm">
                      Join the Action
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Thunder Card Coming Soon Module */}
            <ThunderCardModule />
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

      {/* Popups */}
      <ChallengePopup 
        isOpen={showChallengePopup} 
        onClose={() => setShowChallengePopup(false)} 
      />
      <HowItWorksPopup 
        isOpen={showHowItWorksPopup} 
        onClose={() => setShowHowItWorksPopup(false)} 
      />
    </div>
  );
}