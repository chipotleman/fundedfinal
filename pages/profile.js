
import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Profile() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [user, setUser] = useState({
    username: 'DemoUser2024',
    email: 'demo@fundmybet.com',
    joinDate: '2024-01-15',
    tier: 'Pro',
    avatar: null
  });

  const [stats] = useState({
    totalBets: 127,
    winRate: 68.5,
    totalProfit: 12450,
    currentStreak: 5,
    longestStreak: 12,
    avgOdds: -115,
    challengesCompleted: 2,
    currentChallenge: 3
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(user);

  const handleSave = () => {
    setUser(editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm(user);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        user={user}
        bankroll={15450}
        pnl={2450}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Profile Header */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8 mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-0 right-0 bg-slate-700 hover:bg-slate-600 rounded-full p-2 border-2 border-slate-800">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* User Info */}
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                      className="text-2xl font-bold bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-400 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="text-gray-300 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-400 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{user.username}</h1>
                    <p className="text-gray-300 mb-4">{user.email}</p>
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.tier === 'Elite' ? 'bg-purple-500/20 text-purple-400' :
                        user.tier === 'Pro' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {user.tier} Trader
                      </span>
                      <span className="text-gray-400 text-sm">Joined {new Date(user.joinDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
              <div className="text-2xl font-bold text-green-400 mb-2">${stats.totalProfit.toLocaleString()}</div>
              <div className="text-gray-300 text-sm">Total Profit</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-2">{stats.winRate}%</div>
              <div className="text-gray-300 text-sm">Win Rate</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-2">{stats.totalBets}</div>
              <div className="text-gray-300 text-sm">Total Bets</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700 p-6 text-center">
              <div className="text-2xl font-bold text-orange-400 mb-2">{stats.currentStreak}</div>
              <div className="text-gray-300 text-sm">Win Streak</div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Achievements</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-700/50 rounded-xl p-6 border border-yellow-500/30">
                <div className="text-4xl mb-3">🏆</div>
                <div className="text-white font-semibold mb-1">Challenge Master</div>
                <div className="text-gray-300 text-sm">Completed {stats.challengesCompleted} challenges</div>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-6 border border-green-500/30">
                <div className="text-4xl mb-3">🎯</div>
                <div className="text-white font-semibold mb-1">Sharpshooter</div>
                <div className="text-gray-300 text-sm">Win streak of {stats.longestStreak}</div>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-6 border border-blue-500/30">
                <div className="text-4xl mb-3">📈</div>
                <div className="text-white font-semibold mb-1">Profit King</div>
                <div className="text-gray-300 text-sm">Top 10% of traders</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
