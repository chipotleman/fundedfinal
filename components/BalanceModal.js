
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
    { date: '2024-01-15', sport: 'NFL', bet: 'Chiefs -3.5', amount: 500, result: 'won', profit: 455 },
    { date: '2024-01-14', sport: 'NBA', bet: 'Lakers ML', amount: 300, result: 'won', profit: 255 },
    { date: '2024-01-13', sport: 'NHL', bet: 'Over 6.5', amount: 750, result: 'lost', profit: -750 },
    { date: '2024-01-12', sport: 'NFL', bet: 'Cowboys +7', amount: 400, result: 'won', profit: 364 }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Challenge Dashboard</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'progress', label: 'Progress' },
            { id: 'history', label: 'History' },
            { id: 'stats', label: 'Stats' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-green-400 border-b-2 border-green-400 bg-slate-800'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Current Balance</h3>
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-3xl font-bold text-green-400">${bankroll.toLocaleString()}</div>
                  <div className="text-sm text-gray-400 mt-2">Starting: ${startingBankroll.toLocaleString()}</div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Unrealized P&L</h3>
                  <div className={`text-3xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    {((pnl / startingBankroll) * 100).toFixed(2)}% ROI
                  </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Challenge Phase</h3>
                  <div className="text-3xl font-bold text-blue-400">Phase {challengePhase}</div>
                  <div className="text-sm text-gray-400 mt-2">of {totalChallenges} phases</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Challenge Progress</h3>
                <div className="relative h-6 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-6 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">${startingBankroll.toLocaleString()}</span>
                  <span className="text-white font-semibold">{progressPercent.toFixed(1)}%</span>
                  <span className="text-gray-400">${challengeGoal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-6">Phase {challengePhase} Requirements</h3>
                <div className="space-y-3">
                  {challengeRequirements.map((req, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-gray-300">{req}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <h4 className="text-lg font-semibold text-white mb-4">Risk Management</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Daily Loss:</span>
                      <span className="text-red-400 font-semibold">-$800</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Today's P&L:</span>
                      <span className="text-green-400 font-semibold">+$240</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Position Size:</span>
                      <span className="text-white font-semibold">$1,000</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <h4 className="text-lg font-semibold text-white mb-4">Betting Days</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Completed:</span>
                      <span className="text-green-400 font-semibold">7 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Required:</span>
                      <span className="text-white font-semibold">10 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Remaining:</span>
                      <span className="text-blue-400 font-semibold">3 days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Recent Betting History</h3>
              <div className="space-y-3">
                {bettingHistory.map((bet, index) => (
                  <div key={index} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-gray-400 text-sm">{bet.date}</div>
                        <div className="bg-slate-700 px-2 py-1 rounded text-xs text-gray-300">{bet.sport}</div>
                        <div className="text-white font-medium">{bet.bet}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-gray-400">${bet.amount}</div>
                        <div className={`font-bold ${bet.result === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                          {bet.result === 'won' ? '+' : ''}${bet.profit}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h4 className="text-lg font-semibold text-white mb-4">Performance Metrics</h4>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="text-green-400 font-bold">68.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Bets:</span>
                    <span className="text-white font-semibold">43</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Bet Size:</span>
                    <span className="text-white font-semibold">$425</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Streak:</span>
                    <span className="text-green-400 font-semibold">8 wins</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h4 className="text-lg font-semibold text-white mb-4">Sport Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">NFL:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="w-3/4 h-2 bg-green-400 rounded-full"></div>
                      </div>
                      <span className="text-green-400 text-sm">75%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">NBA:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="w-3/5 h-2 bg-blue-400 rounded-full"></div>
                      </div>
                      <span className="text-blue-400 text-sm">60%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">NHL:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="w-1/2 h-2 bg-purple-400 rounded-full"></div>
                      </div>
                      <span className="text-purple-400 text-sm">50%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
