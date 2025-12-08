
import { useState } from 'react';

const challenges = [
  {
    id: 1,
    name: 'Starter Challenge',
    badge: 'BEGINNER',
    startingBalance: 5000,
    target: 6000,
    price: 149,
    profitSplit: '70-90%',
    description: 'Perfect for newcomers',
    color: 'blue',
    features: ['$5,000 Starting Balance', '$6,000 Profit Target', '15% Daily Loss Limit', 'All Sports Available']
  },
  {
    id: 2,
    name: 'Pro Challenge',
    badge: 'POPULAR',
    startingBalance: 10000,
    target: 12000,
    price: 249,
    profitSplit: '70-90%',
    description: 'Most popular choice',
    color: 'green',
    features: ['$10,000 Starting Balance', '$12,000 Profit Target', '15% Daily Loss Limit', 'Priority Support']
  },
  {
    id: 3,
    name: 'Elite Challenge',
    badge: 'ADVANCED',
    startingBalance: 25000,
    target: 30000,
    price: 399,
    profitSplit: '70-90%',
    description: 'For serious bettors',
    color: 'purple',
    features: ['$25,000 Starting Balance', '$30,000 Profit Target', '15% Daily Loss Limit', 'VIP Support']
  }
];

export default function ChallengeOverview() {
  const [hoveredCard, setHoveredCard] = useState(null);

  const getColorClasses = (color, isHovered) => {
    const colors = {
      blue: {
        border: isHovered ? 'border-blue-500' : 'border-gray-800/50',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        text: 'text-blue-400',
        button: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
      },
      green: {
        border: isHovered ? 'border-green-500' : 'border-gray-800/50',
        badge: 'bg-green-500/20 text-green-400 border-green-500/30',
        text: 'text-green-400',
        button: 'from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
      },
      purple: {
        border: isHovered ? 'border-purple-500' : 'border-gray-800/50',
        badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        text: 'text-purple-400',
        button: 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
      }
    };
    return colors[color];
  };

  const handleStartChallenge = () => {
    window.dispatchEvent(new CustomEvent('openChallengePopup'));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
      {challenges.map((challenge) => {
        const isHovered = hoveredCard === challenge.id;
        const colors = getColorClasses(challenge.color, isHovered);
        const isPopular = challenge.badge === 'POPULAR';

        return (
          <div
            key={challenge.id}
            className={`relative bg-[#0a0a0a] rounded-2xl border ${colors.border} p-5 transition-all duration-300 cursor-pointer hover:scale-[1.02] ${isPopular ? 'md:-mt-2 md:mb-2' : ''}`}
            onMouseEnter={() => setHoveredCard(challenge.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={handleStartChallenge}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}

            <div className="mb-4">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${colors.badge}`}>
                {challenge.badge}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">{challenge.name}</h3>
            <p className="text-gray-500 text-sm mb-4">{challenge.description}</p>

            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${colors.text}`}>${challenge.startingBalance.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">balance</span>
              </div>
              <div className="text-gray-400 text-sm mt-1">
                Target: <span className="text-white font-medium">${challenge.target.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {challenge.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`}></div>
                  <span className="text-gray-400">{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-gray-500 text-xs">Starting at</span>
                <div className="text-white font-bold text-lg">${challenge.price}</div>
              </div>
              <div className="text-right">
                <span className="text-gray-500 text-xs">Profit Split</span>
                <div className={`${colors.text} font-bold`}>{challenge.profitSplit}</div>
              </div>
            </div>

            <button
              className={`w-full bg-gradient-to-r ${colors.button} text-white font-bold py-3 px-4 rounded-xl transition-all duration-300`}
            >
              Start Challenge
            </button>
          </div>
        );
      })}
    </div>
  );
}
