
import { useState } from 'react';
import Link from 'next/link';

export default function ChallengePopup({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [selectedChallenge, setSelectedChallenge] = useState('starter');

  const challenges = {
    starter: {
      name: 'Starter Challenge',
      funding: '$10,000',
      profit: '$1,000',
      fee: '$149',
      description: 'Perfect for beginners looking to prove their skills',
      features: ['60-day evaluation', '8% profit target', 'Up to 5% daily loss limit', '1:30 max leverage']
    },
    pro: {
      name: 'Pro Challenge',
      funding: '$25,000',
      profit: '$2,500',
      fee: '$299',
      description: 'For experienced bettors ready for bigger stakes',
      features: ['90-day evaluation', '10% profit target', 'Up to 5% daily loss limit', '1:50 max leverage']
    },
    elite: {
      name: 'Elite Challenge',
      funding: '$100,000',
      profit: '$10,000',
      fee: '$999',
      description: 'The ultimate challenge for elite bettors',
      features: ['120-day evaluation', '10% profit target', 'Up to 5% daily loss limit', '1:100 max leverage']
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Choose Your Challenge</h2>
            <p className="text-gray-300">Select the funding level that matches your trading experience</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Challenge Selection */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(challenges).map(([key, challenge]) => (
              <button
                key={key}
                onClick={() => setSelectedChallenge(key)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                  selectedChallenge === key
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : 'border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                <div className="text-white font-bold text-lg mb-2">{challenge.name}</div>
                <div className="text-green-400 font-bold text-2xl mb-1">{challenge.funding}</div>
                <div className="text-gray-300 text-sm">{challenge.description}</div>
              </button>
            ))}
          </div>

          {/* Selected Challenge Details */}
          <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-xl p-6 border border-slate-600 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">{challenges[selectedChallenge].name} Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Funding Amount:</span>
                    <span className="text-green-400 font-bold">{challenges[selectedChallenge].funding}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Profit Target:</span>
                    <span className="text-blue-400 font-bold">{challenges[selectedChallenge].profit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Challenge Fee:</span>
                    <span className="text-orange-400 font-bold">{challenges[selectedChallenge].fee}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-bold text-white mb-4">Features & Rules</h4>
                <ul className="space-y-2">
                  {challenges[selectedChallenge].features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-300 text-sm">
                      <span className="text-green-400 mr-2 flex-shrink-0">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/50 mb-6">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-3"></span>
              How It Works
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <h5 className="text-white font-semibold mb-2">Purchase Challenge</h5>
                <p className="text-gray-400 text-sm">Pay the one-time fee and get instant access to your funded account</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">2</span>
                </div>
                <h5 className="text-white font-semibold mb-2">Trade & Profit</h5>
                <p className="text-gray-400 text-sm">Place bets, hit your profit target while following the rules</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">3</span>
                </div>
                <h5 className="text-white font-semibold mb-2">Get Funded</h5>
                <p className="text-gray-400 text-sm">Receive up to 80% of profits on all winning trades</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/auth" 
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 text-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Start {challenges[selectedChallenge].name} - {challenges[selectedChallenge].fee}
            </Link>
            <button 
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 border border-slate-600 hover:border-slate-500"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
