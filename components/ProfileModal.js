
import { Fragment } from 'react';

export default function ProfileModal({ profile, isOpen, onClose }) {
  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-slate-800 shadow-2xl rounded-2xl border border-slate-700">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white">{profile.username}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                profile.tier === 'Elite' ? 'bg-purple-500/20 text-purple-400' :
                profile.tier === 'Pro' ? 'bg-blue-500/20 text-blue-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {profile.tier} Trader
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">${profile.stats.totalProfit.toLocaleString()}</div>
              <div className="text-gray-300 text-sm">Total Profit</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{profile.stats.winRate}%</div>
              <div className="text-gray-300 text-sm">Win Rate</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{profile.stats.roi}%</div>
              <div className="text-gray-300 text-sm">ROI</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{profile.stats.currentStreak}</div>
              <div className="text-gray-300 text-sm">Current Streak</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Achievements */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Achievements</h3>
              <div className="space-y-3">
                {profile.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-slate-700/30 rounded-lg p-3">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <div className="text-white font-medium">{achievement.name}</div>
                      <div className="text-gray-400 text-sm">{achievement.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Bets */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Recent Bets</h3>
              <div className="space-y-3">
                {profile.recentBets.map((bet, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium text-sm">{bet.game}</div>
                        <div className="text-gray-300 text-sm">{bet.bet} ({bet.odds})</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${bet.result === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                          ${bet.amount}
                        </div>
                        <div className={`text-xs ${bet.result === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                          {bet.result.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="text-gray-400 text-sm">
              Member since {new Date(profile.joinDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
