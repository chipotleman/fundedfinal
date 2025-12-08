
import { useState } from 'react';

const challenges = [
  {
    id: 1,
    name: 'Starter',
    badge: 'BEGINNER',
    startingBalance: 5000,
    target: 6000,
    price: 149,
    profitSplit: '70-90%',
    color: 'blue',
    maxDailyLoss: '$750',
    duration: '30 days',
    support: 'Standard'
  },
  {
    id: 2,
    name: 'Pro',
    badge: 'POPULAR',
    startingBalance: 10000,
    target: 12000,
    price: 249,
    profitSplit: '70-90%',
    color: 'green',
    maxDailyLoss: '$1,500',
    duration: '30 days',
    support: 'Priority'
  },
  {
    id: 3,
    name: 'Elite',
    badge: 'ADVANCED',
    startingBalance: 25000,
    target: 30000,
    price: 399,
    profitSplit: '70-90%',
    color: 'purple',
    maxDailyLoss: '$3,750',
    duration: '30 days',
    support: 'VIP'
  }
];

const comparisonRows = [
  { label: 'Starting Balance', key: 'startingBalance', format: (v) => `$${v.toLocaleString()}` },
  { label: 'Profit Target', key: 'target', format: (v) => `$${v.toLocaleString()}` },
  { label: 'Max Daily Loss', key: 'maxDailyLoss', format: (v) => v },
  { label: 'Duration', key: 'duration', format: (v) => v },
  { label: 'Profit Split', key: 'profitSplit', format: (v) => v },
  { label: 'Support Level', key: 'support', format: (v) => v },
  { label: 'Price', key: 'price', format: (v) => `$${v}`, highlight: true }
];

export default function ChallengeOverview() {
  const handleStartChallenge = () => {
    window.dispatchEvent(new CustomEvent('openChallengePopup'));
  };

  const getColorClass = (color, type) => {
    const colors = {
      blue: {
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        text: 'text-blue-400',
        border: 'border-blue-500',
        button: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
      },
      green: {
        badge: 'bg-green-500/20 text-green-400 border-green-500/30',
        text: 'text-green-400',
        border: 'border-green-500',
        button: 'from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
      },
      purple: {
        badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        text: 'text-purple-400',
        border: 'border-purple-500',
        button: 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
      }
    };
    return colors[color][type];
  };

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className={`bg-[#0a0a0a] rounded-xl border border-gray-800/50 overflow-hidden ${challenge.badge === 'POPULAR' ? 'ring-2 ring-green-500/50' : ''}`}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getColorClass(challenge.color, 'badge')}`}>
                    {challenge.badge}
                  </span>
                  {challenge.badge === 'POPULAR' && (
                    <span className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                      TOP PICK
                    </span>
                  )}
                </div>
                <span className="text-white font-bold text-lg">${challenge.price}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">{challenge.name} Challenge</h3>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-[#111111] rounded-lg p-2 border border-gray-800/50">
                  <div className="text-gray-500 text-xs">Balance</div>
                  <div className={`font-bold ${getColorClass(challenge.color, 'text')}`}>${challenge.startingBalance.toLocaleString()}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 border border-gray-800/50">
                  <div className="text-gray-500 text-xs">Target</div>
                  <div className="text-white font-bold">${challenge.target.toLocaleString()}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 border border-gray-800/50">
                  <div className="text-gray-500 text-xs">Daily Loss Limit</div>
                  <div className="text-white font-bold">{challenge.maxDailyLoss}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 border border-gray-800/50">
                  <div className="text-gray-500 text-xs">Profit Split</div>
                  <div className="text-green-400 font-bold">{challenge.profitSplit}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                <span>{challenge.duration}</span>
                <span>{challenge.support} Support</span>
              </div>

              <button
                onClick={handleStartChallenge}
                className={`w-full bg-gradient-to-r ${getColorClass(challenge.color, 'button')} text-white font-bold py-3 rounded-xl transition-all`}
              >
                Start for ${challenge.price}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Comparison Table */}
      <div className="hidden md:block bg-[#0a0a0a] rounded-2xl border border-gray-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Compare</th>
                {challenges.map((challenge) => (
                  <th key={challenge.id} className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getColorClass(challenge.color, 'badge')}`}>
                        {challenge.badge}
                      </span>
                      <span className="text-white font-bold text-lg">{challenge.name}</span>
                      {challenge.badge === 'POPULAR' && (
                        <span className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                          MOST POPULAR
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => (
                <tr key={row.key} className={`border-b border-gray-800/50 ${row.highlight ? 'bg-[#111111]' : ''}`}>
                  <td className="p-4 text-gray-400 text-sm font-medium">{row.label}</td>
                  {challenges.map((challenge) => (
                    <td key={challenge.id} className="p-4 text-center">
                      <span className={`font-bold ${row.highlight ? getColorClass(challenge.color, 'text') + ' text-lg' : 'text-white'}`}>
                        {row.format(challenge[row.key])}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4"></td>
                {challenges.map((challenge) => (
                  <td key={challenge.id} className="p-4 text-center">
                    <button
                      onClick={handleStartChallenge}
                      className={`bg-gradient-to-r ${getColorClass(challenge.color, 'button')} text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm`}
                    >
                      Start Challenge
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
