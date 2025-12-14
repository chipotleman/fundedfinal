import { useState, useEffect } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  const trackingSteps = [
    { label: 'PLANNING', icon: '📋' },
    { label: 'PRODUCTION', icon: '🔨' },
    { label: 'SHIPPED', icon: '📦' },
    { label: 'ARRIVED', icon: '🏠' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Waitlist signup:', { name, email });
    setIsFlipping(true);
    
    setTimeout(() => {
      setIsFlipping(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
            Introducing the <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Piks Card</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            The first prepaid bank card that gets funded directly from your betting profits. Use it anywhere, just like a regular debit card.
          </p>
        </div>

        {/* Piks Card Preview */}
            <div className="relative max-w-md mx-auto mb-12 flex justify-center" style={{perspective: '1000px'}}>
              <div 
                className={`relative ${isFlipping ? '' : 'hover:scale-105'}`}
                style={{
                  transformStyle: 'preserve-3d',
                  transition: isFlipping ? 'transform 1.5s' : 'transform 0.3s',
                  transform: isFlipping ? 'rotateY(720deg) rotateX(360deg)' : 'rotateY(0deg) rotateX(0deg)'
                }}
              >
                <img 
                  src="/piks-card.png" 
                  alt="Piks Card" 
                  className="w-full max-w-md rounded-2xl shadow-2xl"
                />
              </div>
            </div>

        {/* Waitlist Form */}
        <div className="max-w-md mx-auto">
          {!submitted ? (
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-800">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Join the Waitlist</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Your Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Join Waitlist
                </button>
              </form>
              <p className="text-gray-400 text-sm text-center mt-4">
                Be among the first to get your Piks Card when we launch
              </p>
            </div>
          ) : (
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-700 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">You're on the Waitlist!</h2>
              <p className="text-gray-400 mb-6">
                We'll notify <span className="text-white">{email}</span> when production begins
              </p>

              {/* Tracking Steps with Truck */}
              <div className="relative mb-8 pt-12">
                {/* Truck positioned above PLANNING bubble */}
                <div 
                  className="absolute top-0 z-20"
                  style={{ left: 'calc(12.5% - 24px)' }}
                >
                  <div className="text-5xl transform -scale-x-100">🚚</div>
                </div>

                {/* Progress Line */}
                <div className="absolute top-16 left-0 right-0 h-1 bg-gray-700 rounded-full mx-8"></div>

                {/* Steps */}
                <div className="flex justify-between relative pt-4">
                  {trackingSteps.map((step, index) => (
                    <div key={index} className="flex flex-col items-center z-10">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${
                          index === 0 
                            ? 'bg-white scale-110' 
                            : 'bg-gray-700'
                        }`}
                      >
                        {index === 0 ? (
                          <span>{step.icon}</span>
                        ) : (
                          <span className="text-gray-500 text-sm">{index + 1}</span>
                        )}
                      </div>
                      <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                        index === 0 ? 'text-white' : 'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              <div className="mb-6">
                <p className="text-white font-medium">
                  Your card is in the planning stage
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Expected launch: Q1 2026
                </p>
              </div>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-block shadow-lg"
              >
                Start Your Challenge
              </button>
            </div>
          )}
        </div>

        {/* Coming Soon */}
        <div className="text-center mt-16">
          <p className="text-gray-400 text-lg">
            Coming Soon • Expected Launch: Q1 2026
          </p>
        </div>
      </div>
      {betSlip.length > 0 && <BetSlip show={showBetSlip} onClose={() => setShowBetSlip(false)} />}
    </div>
  );
}