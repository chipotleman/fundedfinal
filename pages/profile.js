import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  useEffect(() => {
    const userData = localStorage.getItem('current_user');
    if (!userData) {
      router.push('/auth');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setCurrentUser(parsedUser);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const stats = currentUser.profileStats || {};
  const winRate = currentUser.totalBets > 0 ? (stats.totalWins / currentUser.totalBets * 100).toFixed(2) : 0;

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        bankroll={currentUser.bankroll}
        pnl={currentUser.pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-20 px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          {/* Profile Header */}
          <div className="bg-slate-800 rounded-2xl p-8 mb-8 border border-slate-700">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{currentUser.username}</h1>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 font-medium">
                      {currentUser.challenge ? `${currentUser.challenge.name} Challenge` : 'No Active Challenge'}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    Member since {new Date(currentUser.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Challenge Overview */}
          {currentUser.challenge && (
            <div className="bg-slate-800 rounded-2xl p-8 mb-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-6">Current Challenge</h2>
              
<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">${currentUser.bankroll?.toLocaleString() || 0}</div>
                  <div className="text-gray-400 text-sm">Current Balance</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${currentUser.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${(currentUser.pnl || 0).toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-sm">P&L</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{currentUser.challengePhase}</div>
                  <div className="text-gray-400 text-sm">Challenge Phase</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{currentUser.bettingDays}</div>
                  <div className="text-gray-400 text-sm">Betting Days</div>
                </div>
              </div>
</div>
          )}

          {/* Betting Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-6">Betting Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Total Bets</span>
                  <span className="text-white font-bold">{currentUser.totalBets || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Win Rate</span>
                  <span className="text-green-400 font-bold">{winRate}%</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Wins</span>
                  <span className="text-green-400 font-bold">{stats.totalWins || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Losses</span>
                  <span className="text-red-400 font-bold">{stats.totalLosses || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Current Streak</span>
                  <span className="text-blue-400 font-bold">{stats.currentWinStreak || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-6">Performance Metrics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Biggest Win</span>
                  <span className="text-green-400 font-bold">+${stats.biggestWin || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Biggest Loss</span>
                  <span className="text-red-400 font-bold">-${stats.biggestLoss || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Avg Bet Size</span>
                  <span className="text-white font-bold">${stats.averageBetSize || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Longest Streak</span>
                  <span className="text-blue-400 font-bold">{stats.longestWinStreak || 0}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                  <span className="text-gray-300">Daily Loss Limit</span>
                  <span className="text-yellow-400 font-bold">${(currentUser.maxDailyLoss || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Bets */}
          {currentUser.betsHistory && currentUser.betsHistory.length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-8 mt-8 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-6">Recent Bets</h3>
              <div className="space-y-3">
                {currentUser.betsHistory.slice(-5).reverse().map((bet, index) => (
                  <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-700/30 rounded-xl">
                    <div>
                      <span className="text-white font-medium">{bet.selection}</span>
                      <div className="text-gray-400 text-sm">{bet.gameInfo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">${bet.amount}</div>
                      <div className={`text-sm font-medium ${bet.status === 'won' ? 'text-green-400' : bet.status === 'lost' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {bet.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}