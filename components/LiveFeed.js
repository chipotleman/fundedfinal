
import { useState, useEffect } from 'react';

export default function LiveFeed() {
  const [wins, setWins] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Mock users and their stats
  const mockUsers = {
    'SharpShooter99': { 
      avatar: '🎯', 
      tier: 'Elite', 
      winRate: 72.30, 
      totalProfit: 24500, 
      currentStreak: 8,
      challengePhase: 3,
      joinDate: '2023-11-15',
      recentBets: [
        { game: 'Chiefs vs Bills', bet: 'Chiefs -3.5', result: 'Won', amount: 250 },
        { game: 'Lakers vs Warriors', bet: 'Over 225.5', result: 'Won', amount: 150 },
        { game: 'Cowboys vs Eagles', bet: 'Eagles ML', result: 'Lost', amount: 100 }
      ]
    },
    'BetMaster2024': { 
      avatar: '👑', 
      tier: 'Pro', 
      winRate: 68.90, 
      totalProfit: 18750, 
      currentStreak: 5,
      challengePhase: 2,
      joinDate: '2024-01-08',
      recentBets: [
        { game: 'Packers vs Vikings', bet: 'Under 48.5', result: 'Won', amount: 300 },
        { game: 'Celtics vs Heat', bet: 'Celtics -7', result: 'Won', amount: 200 }
      ]
    },
    'OddsWhisperer': { 
      avatar: '🔮', 
      tier: 'Elite', 
      winRate: 75.10, 
      totalProfit: 31200, 
      currentStreak: 12,
      challengePhase: 3,
      joinDate: '2023-09-22',
      recentBets: [
        { game: 'Rams vs 49ers', bet: '49ers ML', result: 'Won', amount: 500 },
        { game: 'Knicks vs Nets', bet: 'Over 215.5', result: 'Won', amount: 350 }
      ]
    },
    'ValueFinder': { 
      avatar: '💎', 
      tier: 'Pro', 
      winRate: 65.40, 
      totalProfit: 15800, 
      currentStreak: 3,
      challengePhase: 2,
      joinDate: '2023-12-03',
      recentBets: [
        { game: 'Bruins vs Rangers', bet: 'Bruins -1.5', result: 'Won', amount: 180 }
      ]
    }
  };

  // Generate random wins
  useEffect(() => {
    const generateWin = () => {
      const usernames = Object.keys(mockUsers);
      const username = usernames[Math.floor(Math.random() * usernames.length)];
      const user = mockUsers[username];
      const amounts = [125, 250, 375, 500, 750, 1000, 1250];
      const games = [
        'Chiefs vs Bills', 'Lakers vs Warriors', 'Cowboys vs Eagles',
        'Packers vs Vikings', 'Celtics vs Heat', 'Rams vs 49ers'
      ];
      const betTypes = ['ML', 'Spread', 'Over', 'Under'];
      
      const newWin = {
        id: Date.now() + Math.random(),
        username,
        avatar: user.avatar,
        tier: user.tier,
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        game: games[Math.floor(Math.random() * games.length)],
        betType: betTypes[Math.floor(Math.random() * betTypes.length)],
        timestamp: new Date(),
        challengeProgress: ((user.totalProfit - 10000) / 15000 * 100).toFixed(1)
      };

      setWins(prev => [newWin, ...prev.slice(0, 19)]); // Keep last 20
    };

    // Initial wins
    for (let i = 0; i < 5; i++) {
      setTimeout(() => generateWin(), i * 500);
    }

    // Continue generating wins
    const interval = setInterval(generateWin, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const UserProfileModal = ({ user, onClose }) => {
    const userData = mockUsers[user.username];
    
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-2xl">
                  {userData.avatar}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{user.username}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    userData.tier === 'Elite' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {userData.tier} Bettor
                  </span>
                </div>
              </div>
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

          {/* Stats */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">${userData.totalProfit.toLocaleString()}</div>
                <div className="text-gray-300 text-sm">Total Profit</div>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{userData.winRate}%</div>
                <div className="text-gray-300 text-sm">Win Rate</div>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{userData.currentStreak}</div>
                <div className="text-gray-300 text-sm">Win Streak</div>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-400">Phase {userData.challengePhase}</div>
                <div className="text-gray-300 text-sm">Challenge</div>
              </div>
            </div>

            {/* Recent Bets */}
            <div className="mb-6">
              <h4 className="text-white font-semibold mb-3">Recent Bets</h4>
              <div className="space-y-2">
                {userData.recentBets.map((bet, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="text-white text-sm font-medium">{bet.game}</div>
                      <div className="text-gray-300 text-xs">{bet.bet}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${bet.result === 'Won' ? 'text-green-400' : 'text-red-400'}`}>
                        {bet.result}
                      </div>
                      <div className="text-gray-300 text-xs">${bet.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Member Since */}
            <div className="text-center">
              <div className="text-gray-400 text-sm">Member since {new Date(userData.joinDate).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 h-96 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="text-white font-bold">Live Wins</h3>
          <span className="text-gray-400 text-sm">Real-time updates</span>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-sm">
          {wins.map((win) => (
            <div
              key={win.id}
              className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400 transition-all duration-300 animate-pulse cursor-pointer"
              onClick={() => setSelectedUser(win)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{win.avatar}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-400 font-semibold hover:text-green-300 transition-colors">
                        {win.username}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        win.tier === 'Elite' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {win.tier}
                      </span>
                    </div>
                    <div className="text-white">
                      Won <span className="text-green-400 font-bold">${win.amount}</span> on {win.game}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Challenge Progress: {win.challengeProgress}% • {win.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-green-400 font-bold text-lg">+${win.amount}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 text-center">
          <div className="text-gray-400 text-xs">
            {wins.length} wins in the last hour • Click any user to view profile
          </div>
        </div>
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}
