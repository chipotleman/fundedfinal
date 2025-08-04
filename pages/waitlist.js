import React, { useState } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the data to your backend
    console.log('Waitlist signup:', { name, email });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar 
        bankroll={null}
        pnl={null}
        betSlipCount={0}
        onBetSlipClick={() => {}}
      />

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
            Introducing the <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Thunder Card</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            The first prepaid bank card that gets funded directly from your betting profits. Use it anywhere, just like a regular debit card.
          </p>
        </div>

        {/* Thunder Card Preview */}
            <div className="relative max-w-sm mx-auto mb-12 flex justify-center">
              <div className="relative">
                {/* Card with gradient background - more rectangular aspect ratio like real debit card */}
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-xl p-6 shadow-2xl border border-blue-500/30 transform hover:scale-105 transition-all duration-300 mx-auto" style={{aspectRatio: '1.586/1', width: '320px'}}>
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

                  {/* Card Details */}
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <div className="text-blue-300 text-xs mb-1">CARDHOLDER</div>
                      <div className="text-white text-xs font-medium">FUNDER MEMBER</div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-300 text-xs mb-1">EXPIRES</div>
                      <div className="text-white text-xs font-medium">12/28</div>
                    </div>
                  </div>

                  {/* Powered by Funder */}
                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                    <div className="text-center text-blue-300 text-xs font-medium">
                      Powered by Funder
                    </div>
                  </div>
                </div>
              </div>
            </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 text-center">Auto-Funded</h3>
            <p className="text-gray-400 text-sm text-center">Your card gets automatically loaded with your betting profits</p>
          </div>

          <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 text-center">Use Anywhere</h3>
            <p className="text-gray-400 text-sm text-center">Works at any store, ATM, or online merchant worldwide</p>
          </div>

          <div className="bg-black/90 backdrop-blur-lg rounded-xl p-6 border border-gray-800">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 text-center">Secure & Safe</h3>
            <p className="text-gray-400 text-sm text-center">Bank-level security with fraud protection and instant notifications</p>
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
                Be among the first to get your Thunder Card when we launch
              </p>
            </div>
          ) : (
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-green-500/30 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You're In!</h2>
              <p className="text-gray-300 mb-6">
                Thanks for joining the waitlist. We'll notify you as soon as the Thunder Card is available.
              </p>
              <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 inline-block">
                Start Your Challenge
              </Link>
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
    </div>
  );
}