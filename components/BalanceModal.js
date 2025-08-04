
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

  const bettingHistory = [
    { date: '2024-01-15', sport: 'NFL', bet: 'Chiefs -3.5', amount: 500, result: 'Win', pnl: 454 },
    { date: '2024-01-14', sport: 'NBA', bet: 'Lakers +5.5', amount: 300, result: 'Loss', pnl: -300 },
    { date: '2024-01-13', sport: 'NHL', bet: 'Bruins ML', amount: 200, result: 'Win', pnl: 180 }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="relative bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
        >
          ×
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Challenge Dashboard</h2>
          <p className="text-gray-400">Phase {challengePhase} of {totalChallenges}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'overview'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'history'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Bet History
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'rules'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Rules
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Balance Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Current Balance</p>
                <p className="text-2xl font-bold text-white">${bankroll?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Total P&L</p>
                <p className={`text-2xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}${pnl?.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Progress</p>
                <p className="text-2xl font-bold text-blue-400">{progressPercent}%</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Challenge Progress</h3>
                <span className="text-sm text-gray-400">
                  ${(startingBankroll + pnl)?.toLocaleString()} / ${challengeGoal?.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                ${(challengeGoal - startingBankroll - pnl)?.toLocaleString()} remaining to target
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Win Rate</p>
                <p className="text-xl font-bold text-green-400">67%</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Total Bets</p>
                <p className="text-xl font-bold text-white">42</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Best Day</p>
                <p className="text-xl font-bold text-green-400">+$1,250</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Days Active</p>
                <p className="text-xl font-bold text-blue-400">8</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Bets</h3>
            {bettingHistory.map((bet, index) => (
              <div key={index} className="bg-slate-800 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{bet.bet}</p>
                  <p className="text-gray-400 text-sm">{bet.sport} • {bet.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">${bet.amount}</p>
                  <p className={`text-sm font-medium ${
                    bet.result === 'Win' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {bet.result === 'Win' ? '+' : ''}${bet.pnl}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Challenge Requirements</h3>
              <div className="space-y-3">
                {challengeRequirements.map((req, index) => (
                  <p key={index} className="text-gray-300">{req}</p>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payout Structure</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Phase 1 Completion:</span>
                  <span className="text-green-400 font-medium">Account Funded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Your Share:</span>
                  <span className="text-green-400 font-medium">80%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Payout Method:</span>
                  <span className="text-blue-400 font-medium">Direct Deposit</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
