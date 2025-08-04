
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
    '• Max bet size: 5% of current balance',
    '• Sports betting only (no casino games)',
    '• Minimum odds: -300 (+1.33)',
    '• Maximum 3 simultaneous positions'
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Challenge Progress</h2>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Balance */}
          <div className="mt-4 text-center">
            <p className="text-green-100 text-sm">Current Balance</p>
            <p className="text-3xl font-bold text-white">${bankroll?.toLocaleString()}</p>
            <p className={`text-sm mt-1 ${pnl >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              PnL: {pnl >= 0 ? '+' : ''}${pnl?.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'rules' 
                ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Rules
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Progress Ring */}
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      stroke="#374151"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      stroke="#10b981"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - (progressPercent || 0) / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{progressPercent?.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400">Complete</span>
                  </div>
                </div>
              </div>

              {/* Challenge Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">Phase</p>
                  <p className="text-white font-bold text-lg">{challengePhase || 1}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">Goal</p>
                  <p className="text-white font-bold text-lg">${challengeGoal?.toLocaleString()}</p>
                </div>
              </div>

              {/* Starting Balance */}
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Starting Balance:</span>
                  <span className="text-white font-medium">${startingBankroll?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Remaining to Goal:</span>
                  <span className="text-green-400 font-medium">
                    ${((challengeGoal || 0) - (pnl || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Challenge Requirements */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Challenge Requirements</h3>
                <div className="bg-slate-800 rounded-lg p-4">
                  {challengeRequirements.map((req, index) => (
                    <p key={index} className="text-gray-300 text-sm mb-2 last:mb-0">{req}</p>
                  ))}
                </div>
              </div>

              {/* Betting Rules */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Betting Rules</h3>
                <div className="bg-slate-800 rounded-lg p-4">
                  {bettingRules.map((rule, index) => (
                    <p key={index} className="text-gray-300 text-sm mb-2 last:mb-0">{rule}</p>
                  ))}
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-2">Important Notes</h4>
                <p className="text-yellow-300 text-sm">
                  Violating any rules will result in immediate challenge termination. 
                  Keep track of your progress and stay within all limits.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
