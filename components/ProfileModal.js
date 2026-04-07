
import { Fragment, useEffect } from 'react';

export default function ProfileModal({ profile, isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black/90" onClick={onClose}></div>

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform shadow-2xl rounded-2xl" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white">{profile.username}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                profile.tier === 'Elite' ? 'bg-blue-500/20 text-blue-400' :
                profile.tier === 'Pro' ? 'bg-cyan-500/20 text-cyan-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {profile.tier} User
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-green-400">${profile.stats.totalProfit.toLocaleString()}</div>
              <div className="text-gray-500 text-sm">Total Profit</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-blue-400">{profile.stats.winRate}%</div>
              <div className="text-gray-500 text-sm">Win Rate</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-cyan-400">{profile.stats.roi}%</div>
              <div className="text-gray-500 text-sm">ROI</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
              <div className="text-2xl font-bold text-orange-400">{profile.stats.currentStreak}</div>
              <div className="text-gray-500 text-sm">Current Streak</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Achievements</h3>
              <div className="space-y-2">
                {profile.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center space-x-3 rounded-lg p-3" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <div className="text-white font-medium text-sm">{achievement.name}</div>
                      <div className="text-gray-500 text-xs">{achievement.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Bets</h3>
              <div className="space-y-2">
                {profile.recentBets.map((bet, index) => (
                  <div key={index} className="rounded-lg p-3" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium text-sm">{bet.game}</div>
                        <div className="text-gray-500 text-sm">{bet.bet} ({bet.odds})</div>
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
            <div className="text-gray-600 text-sm">
              Member since {new Date(profile.joinDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
