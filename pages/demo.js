import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';

export default function DemoPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(1); // Start with Pro Challenge
  const [userSplit, setUserSplit] = useState(80); // Default 80% user split
  const [showDropdown, setShowDropdown] = useState(false);

  const challengeOptions = [
    {
      id: 1,
      name: "Starter Demo",
      description: "Perfect for beginners",
      startingBalance: 5000,
      target: 1000,
      maxBet: 250,
      payout: 800,
      badge: "BEGINNER",
      popular: false
    },
    {
      id: 2,
      name: "Pro Demo",
      description: "For experienced bettors",
      startingBalance: 10000,
      target: 2000,
      maxBet: 500,
      payout: 1600,
      badge: "POPULAR",
      popular: true
    },
    {
      id: 3,
      name: "Elite Demo",
      description: "Maximum stakes for pros",
      startingBalance: 25000,
      target: 5000,
      maxBet: 1250,
      payout: 4000,
      badge: "ADVANCED",
      popular: false
    }
  ];

  const currentChallenge = challengeOptions[currentIndex];

  const handleChallengeSelect = (index) => {
    setCurrentIndex(index);
    setShowDropdown(false);
  };

  const handleStartDemo = () => {
    // Save demo challenge to localStorage
    const demoChallenge = {
      ...currentChallenge,
      userSplit,
      isDemoMode: true,
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('demo_challenge', JSON.stringify(demoChallenge));
    
    // Navigate to demo dashboard
    router.push('/demo-dashboard');
  };

  return (
    <div className="min-h-screen bg-black">
      <Head>
        <title>Try Demo - Funder</title>
        <meta name="description" content="Try our platform with a free demo challenge" />
      </Head>

      <TopNavbar />

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            🎮 100% FREE - No Payment Required
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Try Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Demo Platform</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Experience the full betting challenge platform with customizable settings. No signup required!
          </p>
        </div>

        {/* Challenge Selection Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border-2 border-slate-700 p-6 sm:p-8 mb-8">
          {/* Badge */}
          <div className="text-center mb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              currentChallenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              currentChallenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {currentChallenge.badge}
            </span>
          </div>

          {/* Title and Description */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">{currentChallenge.name}</h3>
            <p className="text-gray-400">{currentChallenge.description}</p>
          </div>

          {/* Challenge Details */}
          <div className="space-y-4 mb-8">
            {/* Starting Balance with Dropdown */}
            <div className="relative">
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex justify-between items-center py-4 px-5 bg-slate-800/50 rounded-xl border-2 border-green-400/50 cursor-pointer hover:border-green-400 transition-all duration-300 shadow-lg shadow-green-400/20"
              >
                <div>
                  <span className="text-gray-400 text-sm block mb-1">Starting Balance</span>
                  <span className="text-green-400 font-bold text-xl">${currentChallenge.startingBalance.toLocaleString()}</span>
                </div>
                <svg className={`w-5 h-5 text-green-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
                  {challengeOptions.map((challenge, index) => (
                    <div
                      key={challenge.id}
                      onClick={() => handleChallengeSelect(index)}
                      className={`px-5 py-4 cursor-pointer transition-colors duration-200 ${
                        index === currentIndex 
                          ? 'bg-green-400/20 border-l-4 border-green-400' 
                          : 'hover:bg-slate-700 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-white font-bold">{challenge.name}</div>
                          <div className="text-gray-400 text-sm">{challenge.description}</div>
                        </div>
                        <div className="text-green-400 font-bold text-lg">
                          ${challenge.startingBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profit Target */}
            <div className="flex justify-between items-center py-4 px-5 bg-slate-700/30 rounded-xl">
              <span className="text-gray-300 font-medium">Profit Target</span>
              <span className="text-blue-400 font-bold text-lg">${currentChallenge.target.toLocaleString()}</span>
            </div>

            {/* Max Bet Size */}
            <div className="flex justify-between items-center py-4 px-5 bg-slate-700/30 rounded-xl">
              <span className="text-gray-300 font-medium">Max Bet Size</span>
              <span className="text-white font-bold text-lg">${currentChallenge.maxBet.toLocaleString()}</span>
            </div>

            {/* Profit Split Slider */}
            <div className="py-4 px-5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/30">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-300 font-medium">Your Profit Split</span>
                <span className="text-purple-400 font-bold text-xl">{userSplit}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={userSplit}
                onChange={(e) => setUserSplit(parseInt(e.target.value))}
                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>50% Split</span>
                <span>100% Split</span>
              </div>
            </div>
          </div>

          {/* Potential Payout Display */}
          <div className="text-center p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/20 mb-8">
            <div className="text-gray-300 text-sm font-medium mb-1">Demo Experience - Practice Mode</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
              100% FREE
            </div>
            <div className="text-gray-400 text-xs mt-2">Full platform features • No credit card required</div>
          </div>

          {/* Start Demo Button */}
          <button
            onClick={handleStartDemo}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg shadow-2xl transform hover:scale-105"
          >
            Start Demo Challenge
          </button>

          {/* Info Text */}
          <div className="text-center mt-6 text-sm text-gray-400">
            <p>Your demo settings and progress will be saved in your browser</p>
            <Link href="/auth" className="text-purple-400 hover:text-purple-300 mt-2 inline-block">
              Ready for real betting? Sign up here →
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">Full Features</h3>
            <p className="text-gray-400 text-sm">Experience all platform features including real-time betting</p>
          </div>

          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">No Signup</h3>
            <p className="text-gray-400 text-sm">Start immediately without creating an account</p>
          </div>

          <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">Customizable</h3>
            <p className="text-gray-400 text-sm">Choose your balance and profit split preferences</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes logoRedYellowGlow {
          0% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
          50% { filter: hue-rotate(30deg) saturate(1.3) brightness(1.2); }
          100% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
        }
      `}</style>
    </div>
  );
}
