import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ChallengeOverview from '../components/ChallengeOverview';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Piks Card Module Component
function ThunderCardModule() {
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');

  const trackingSteps = [
    { label: 'PLANNING', icon: '📋' },
    { label: 'PRODUCTION', icon: '🔨' },
    { label: 'SHIPPED', icon: '📦' },
    { label: 'ARRIVED', icon: '🏠' }
  ];

  useEffect(() => {
    const storedEmail = localStorage.getItem('piksCardWaitlistEmail');
    if (storedEmail) {
      setSavedEmail(storedEmail);
      setIsSubmitted(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      console.log('Piks Card waitlist signup:', email);
      localStorage.setItem('piksCardWaitlistEmail', email);
      setSavedEmail(email);
      setIsSubmitted(true);
    }
  };

  return (
    <div className="text-center px-4 mb-8">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl overflow-hidden p-4 sm:p-6" style={{ background: isDarkMode ? 'linear-gradient(to bottom right, #0f172a, #581c87, #1e3a8a)' : 'linear-gradient(to bottom right, #f8fafc, #e0e7ff, #dbeafe)', borderWidth: 1, borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : '#c7d2fe' }}>
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
          <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
            Introducing the <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Piks Card</span>
          </h2>
          <p className="text-base mb-4 max-w-lg mx-auto" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
            The first prepaid bank card that gets funded directly from your betting profits. Use it anywhere.
          </p>

          {/* Sign Up Section */}
          <div className="backdrop-blur-lg rounded-xl p-5 max-w-md mx-auto" style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : '#d1d5db' }}>
            {!isSubmitted ? (
              <>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium mb-3" style={{ backgroundColor: isDarkMode ? 'rgba(147, 51, 234, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: isDarkMode ? '#c4b5fd' : '#15803d' }}>
                  🚀 Coming Soon
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>Get Early Access</h3>
                <p className="text-sm mb-4" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
                  Join our waitlist for early access and special perks.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                    style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#d1d5db', color: isDarkMode ? '#ffffff' : '#111827' }}
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    Join Waitlist
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">You're on the Waitlist!</h3>
                <p className="text-gray-400 text-sm mb-6">
                  {savedEmail && <span className="text-white">{savedEmail}</span>}
                  {savedEmail ? ' - ' : ''}We'll notify you when production begins
                </p>

                {/* Tracking Steps */}
                <div className="relative mb-6">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-0 right-0 h-1 bg-gray-700 rounded-full mx-6"></div>

                  {/* Steps */}
                  <div className="flex justify-between relative">
                    {trackingSteps.map((step, index) => (
                      <div key={index} className="flex flex-col items-center z-10">
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${
                            index === 0 
                              ? 'bg-white scale-110' 
                              : 'bg-gray-700'
                          }`}
                        >
                          {index === 0 ? (
                            <span>{step.icon}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">{index + 1}</span>
                          )}
                        </div>
                        <span className={`mt-1 text-[10px] font-medium transition-colors duration-300 ${
                          index === 0 ? 'text-white' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Message */}
                <p className="text-white font-medium text-sm">
                  Your card is in the planning stage
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Expected launch: Q1 2026
                </p>
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
  const [bankroll, setBankroll] = useState(10000);

  // Force scroll to top when page loads (especially after beta landing)
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            if (profile?.bankroll) {
              setBankroll(profile.bankroll);
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{scrollBehavior: 'smooth', backgroundColor: isDarkMode ? '#000000' : '#f9fafb'}}>
      <TopNavbar 
        bankroll={user ? bankroll : null}
        pnl={user ? 0 : null}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div style={{overflowY: 'visible'}}>
        {/* Main Video Section - No scrolling needed */}
        <div className="relative flex items-center justify-center pt-2 pb-8 sm:min-h-screen">
          {/* Background Pattern */}
          <div className="absolute inset-0" style={{ backgroundColor: isDarkMode ? '#000000' : '#f9fafb' }}></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
            {/* Logo with matching glow effect */}
            <div className="text-center mb-6 sm:mb-16 pt-2 sm:pt-0">


              <h1 className="text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 leading-tight px-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                Get <span style={{ color: isDarkMode ? undefined : '#111827' }} className={isDarkMode ? "bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-block" : "font-bold inline-block"}>{isDarkMode ? 'Funded' : <span style={{ color: '#111827' }}>Funded</span>}</span> to Bet
              </h1>
              <p className="text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-4 sm:mb-6 px-4" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
                Watch how you can get funded up to <button onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))} className="font-bold transition-colors cursor-pointer" style={{ color: isDarkMode ? '#4ade80' : '#111827', textDecoration: isDarkMode ? 'none' : 'underline' }}>$100,000</button> to bet with and keep 90% of your profits
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
                  className="w-full sm:w-auto font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg shadow-2xl"
                  style={{ 
                    backgroundColor: isDarkMode ? undefined : '#22c55e',
                    backgroundImage: isDarkMode ? 'linear-gradient(to right, #22c55e, #3b82f6)' : 'none',
                    color: '#ffffff'
                  }}
                >
                  Start a Challenge
                </button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('openHowItWorks'))}
                  className="w-full sm:w-auto font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg"
                  style={{
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    border: isDarkMode ? '1px solid #334155' : '1px solid #d1d5db'
                  }}
                >
                  How It Works
                </button>
              </div>
            </div>

            {/* Compare Challenges */}
            <div className="mb-12 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                    Compare <span style={{ color: isDarkMode ? undefined : '#111827' }} className={isDarkMode ? "bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent" : ""}>{isDarkMode ? 'Challenges' : <span style={{ color: '#111827' }}>Challenges</span>}</span>
                  </h2>
                  <p className="text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
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

      </div>

      {/* Bet Slip */}
      {showBetSlip && (
        <BetSlip
          bankroll={bankroll}
          isOpen={showBetSlip}
          onClose={() => setShowBetSlip(false)}
        />
      )}

    </div>
  );
}