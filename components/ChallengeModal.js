
import { useState } from 'react';

export default function ChallengeModal({ onClose }) {
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const challenges = [
    {
      id: 1,
      name: 'Starter Challenge',
      description: 'Perfect for beginners getting started',
      startingBalance: 10000,
      targetProfit: 1000,
      maxLoss: 800,
      badge: 'BEGINNER',
      color: 'blue',
      features: [
        '10% Profit Target',
        '8% Max Loss',
        'Min 5 Trading Days',
        'No Weekend Holds'
      ]
    },
    {
      id: 2,
      name: 'Professional Challenge',
      description: 'For experienced traders seeking bigger profits',
      startingBalance: 25000,
      targetProfit: 2500,
      maxLoss: 2000,
      badge: 'POPULAR',
      color: 'green',
      features: [
        '10% Profit Target',
        '8% Max Loss',
        'Min 10 Trading Days',
        'Advanced Analytics'
      ]
    },
    {
      id: 3,
      name: 'Elite Challenge',
      description: 'Maximum funding for expert traders',
      startingBalance: 100000,
      targetProfit: 10000,
      maxLoss: 8000,
      badge: 'ELITE',
      color: 'purple',
      features: [
        '10% Profit Target',
        '8% Max Loss',
        'Min 15 Trading Days',
        'Priority Support'
      ]
    }
  ];

  const handleStartChallenge = async (challenge) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Here you would typically make an API call to start the challenge
    console.log('Starting challenge:', challenge);
    
    setIsLoading(false);
    onClose();
  };

  const getColorClasses = (color) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'from-blue-600 to-blue-700',
          border: 'border-blue-500',
          button: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
        };
      case 'green':
        return {
          bg: 'from-green-600 to-green-700',
          border: 'border-green-500',
          button: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
        };
      case 'purple':
        return {
          bg: 'from-purple-600 to-purple-700',
          border: 'border-purple-500',
          button: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
        };
      default:
        return {
          bg: 'from-gray-600 to-gray-700',
          border: 'border-gray-500',
          button: 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
        };
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Choose Your Challenge</h2>
              <p className="text-green-100">Select the challenge that matches your experience level</p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Challenge Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {challenges.map((challenge) => {
              const colors = getColorClasses(challenge.color);
              return (
                <div
                  key={challenge.id}
                  className={`relative bg-slate-800 rounded-xl border-2 transition-all duration-300 hover:scale-105 cursor-pointer ${
                    selectedChallenge?.id === challenge.id 
                      ? `${colors.border} shadow-lg` 
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedChallenge(challenge)}
                >
                  {/* Badge */}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                      challenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      challenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {challenge.badge}
                    </span>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{challenge.name}</h3>
                    <p className="text-gray-400 mb-6">{challenge.description}</p>

                    {/* Stats */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Starting Balance:</span>
                        <span className="text-white font-semibold">${challenge.startingBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Profit Target:</span>
                        <span className="text-green-400 font-semibold">${challenge.targetProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Max Loss:</span>
                        <span className="text-red-400 font-semibold">${challenge.maxLoss.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-6">
                      <h4 className="text-white font-semibold mb-3">Features:</h4>
                      <ul className="space-y-1">
                        {challenge.features.map((feature, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-center">
                            <svg className="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Select Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChallenge(challenge);
                      }}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        selectedChallenge?.id === challenge.id
                          ? `bg-gradient-to-r ${colors.button} text-white shadow-lg`
                          : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                      }`}
                    >
                      {selectedChallenge?.id === challenge.id ? 'Selected' : 'Select Challenge'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Button */}
          {selectedChallenge && (
            <div className="mt-8 text-center">
              <button
                onClick={() => handleStartChallenge(selectedChallenge)}
                disabled={isLoading}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-12 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl disabled:transform-none disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Starting Challenge...
                  </div>
                ) : (
                  `Start ${selectedChallenge.name}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
