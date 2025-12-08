import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ChallengeOverview from '../components/ChallengeOverview';
import DemoPreview from '../components/DemoPreview';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';

// Piks Card Module Component
function ThunderCardModule() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      // Here you would typically send to your backend
      console.log('Piks Card waitlist signup:', email);
      setIsSubmitted(true);
      setEmail('');
    }
  };

  return (
    <div className="text-center px-4 mb-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 rounded-2xl border border-purple-500/30 overflow-hidden p-4 sm:p-6">
          {/* Card Image - Main Focus */}
          <div className="flex justify-center mb-1">
            <div className="relative transform hover:scale-105 transition-all duration-300">
              <img 
                src="/piks-card.png" 
                alt="Piks Card" 
                className="w-[400px] sm:w-[540px] drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
            Introducing the <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Piks Card</span>
          </h2>
          <p className="text-base text-gray-300 mb-4 max-w-lg mx-auto">
            The first prepaid bank card that gets funded directly from your betting profits. Use it anywhere.
          </p>

          {/* Sign Up Section */}
          <div className="bg-black/30 backdrop-blur-lg rounded-xl p-5 max-w-md mx-auto border border-slate-700/50">
            <div className="inline-flex items-center bg-purple-600/20 text-purple-300 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
              🚀 Coming Soon
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Get Early Access</h3>
            <p className="text-gray-400 text-sm mb-4">
              Join our waitlist for early access and special perks.
            </p>
            
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-3">
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
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl"
                >
                  Join Waitlist
                </button>
              </form>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="text-green-400 font-medium">
                  ✅ You're on the list! We'll notify you when the Piks Card is ready.
                </div>
              </div>
            )}
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
  const [demoBetSlipCount, setDemoBetSlipCount] = useState(0);
  const [showDemoBetSlip, setShowDemoBetSlip] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  // Force scroll to top when page loads (especially after beta landing)
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Show floating button when scrolled down past 200px (below header)
      // and there are demo bets selected
      const scrollPosition = window.scrollY;
      setShowFloatingButton(scrollPosition > 200 && demoBetSlipCount > 0);
    };

    // Hide button immediately when no bets selected
    if (demoBetSlipCount === 0) {
      setShowFloatingButton(false);
    } else {
      // Check current scroll position when bets are added
      handleScroll();
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [demoBetSlipCount]);

  return (
    <div className="min-h-screen bg-black w-full overflow-x-hidden" style={{scrollBehavior: 'smooth'}}>
      <TopNavbar 
        bankroll={user ? 10000 : null}
        pnl={user ? 0 : null}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
        demoBetSlipCount={demoBetSlipCount}
        onDemoBetSlipClick={() => setShowDemoBetSlip(!showDemoBetSlip)}
      />

      <div style={{overflowY: 'visible'}}>
        {/* Main Video Section - No scrolling needed */}
        <div className="relative flex items-center justify-center pt-2 pb-8 sm:min-h-screen">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-black"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
            {/* Logo with matching glow effect */}
            <div className="text-center mb-6 sm:mb-16 pt-2 sm:pt-0">


              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 leading-tight px-2">
                Get <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-block" style={{ transform: 'translateY(0.42px)' }}>Funded</span> to Bet
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-4 sm:mb-6 px-4">
                Watch how you can get funded up to <button onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))} className="text-green-400 font-bold hover:text-green-300 transition-colors cursor-pointer">$100,000</button> to bet with and keep 90% of your profits
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
                  onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg shadow-2xl"
                >
                  Start a Challenge
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('openHowItWorks'))}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg border border-slate-700"
                >
                  How It Works
                </button>
              </div>
            </div>

            {/* Compare Challenges */}
            <div className="mb-12 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    Compare <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Challenges</span>
                  </h2>
                  <p className="text-gray-400 text-sm">
                    See what's included at each level
                  </p>
                </div>
                <ChallengeOverview />
              </div>
            </div>

            {/* Piks Card Coming Soon Module */}
            <ThunderCardModule />
          </div>
        </div>

        {/* Demo Preview Section */}
        <DemoPreview 
          demoBetSlipCount={demoBetSlipCount}
          setDemoBetSlipCount={setDemoBetSlipCount}
          showDemoBetSlip={showDemoBetSlip}
          setShowDemoBetSlip={setShowDemoBetSlip}
        />
      </div>

      {/* Bet Slip */}
      {showBetSlip && (
        <BetSlip
          bankroll={10000}
          onClose={() => setShowBetSlip(false)}
        />
      )}

      {/* Floating Demo Bet Slip Button - Bottom Left */}
      {showFloatingButton && (
        <button
          onClick={() => setShowDemoBetSlip(true)}
          className="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-full shadow-2xl transform hover:scale-110 flex items-center space-x-2 px-5 py-4"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          <span className="text-base">Demo Bets</span>
          <div className="bg-white text-purple-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            {demoBetSlipCount}
          </div>
        </button>
      )}
    </div>
  );
}