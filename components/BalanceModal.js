import { useState } from 'react';

export default function BalanceModal({ 
  isOpen, 
  onClose, 
  bankroll, 
  pnl, 
  challengePhase, 
  totalChallenges,
  progressPercent,
  challengeGoal,
  startingBankroll 
}) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const challengeRequirements = [
    '• Reach $25,000 profit target',
    '• Maximum 8% daily loss limit', 
    '• Minimum 10 betting days',
    '• No overnight positions on major events'
  ];

  const bettingRules = [
    '• Minimum bet: $10',
    '• Maximum bet: 10% of current balance',
    '• Sports betting only (no casino games)',
    '• Live betting allowed',
    '• All major sports included'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50" onClick={onClose}>
      <div className="relative bg-slate-900 rounded-2xl border border-green-400 p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl font-bold"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-green-400 mb-6 text-center">Account Balance</h2>

        {/* Tab Navigation */}
        <div className="flex mb-6 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'bg-green-400 text-black' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'requirements' 
                ? 'bg-green-400 text-black' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Rules
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Current Balance */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Current Balance</div>
              <div className="text-2xl font-bold text-white">${bankroll?.toLocaleString() || '0'}</div>
            </div>

            {/* P&L */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Profit & Loss</div>
              <div className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}${pnl?.toLocaleString() || '0'}
              </div>
            </div>

            {/* Challenge Progress */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Challenge Progress</span>
                <span className="text-sm text-green-400">{challengePhase || 1}/{totalChallenges || 1}</span>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent || 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-xs text-gray-400">
                <span>${startingBankroll?.toLocaleString() || '25,000'}</span>
                <span>${challengeGoal?.toLocaleString() || '50,000'}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Challenge Requirements</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                {challengeRequirements.map((requirement, index) => (
                  <li key={index}>{requirement}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Betting Rules</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                {bettingRules.map((rule, index) => (
                  <li key={index}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}