
import { useState, useEffect } from 'react';

export default function AchievementSystem({ userStats, onClose }) {
  const [achievements, setAchievements] = useState([
    {
      id: 1,
      title: "First Blood",
      description: "Place your first bet",
      icon: "🎯",
      completed: true,
      unlockedAt: "2024-01-15",
      reward: "$5 Bonus"
    },
    {
      id: 2,
      title: "Hot Streak",
      description: "Win 5 bets in a row",
      icon: "🔥",
      completed: true,
      unlockedAt: "2024-01-18",
      reward: "$25 Bonus"
    },
    {
      id: 3,
      title: "Underdog Hunter",
      description: "Win 10 underdog bets",
      icon: "🐕",
      completed: false,
      progress: 7,
      target: 10,
      reward: "$50 Bonus"
    },
    {
      id: 4,
      title: "High Roller",
      description: "Place a bet over $500",
      icon: "💎",
      completed: false,
      progress: 0,
      target: 1,
      reward: "VIP Status"
    },
    {
      id: 5,
      title: "Perfect Week",
      description: "Win every bet for 7 consecutive days",
      icon: "👑",
      completed: false,
      progress: 3,
      target: 7,
      reward: "$500 Bonus"
    },
    {
      id: 6,
      title: "Volume Shooter",
      description: "Place 100 total bets",
      icon: "📊",
      completed: false,
      progress: 73,
      target: 100,
      reward: "Analytics Pro"
    }
  ]);

  const [showNewAchievement, setShowNewAchievement] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);

  // Simulate achievement unlock
  useEffect(() => {
    const timer = setTimeout(() => {
      const unlockedAchievement = achievements.find(a => a.id === 3);
      if (unlockedAchievement && !unlockedAchievement.completed && unlockedAchievement.progress >= unlockedAchievement.target) {
        setNewAchievement(unlockedAchievement);
        setShowNewAchievement(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const completedCount = achievements.filter(a => a.completed).length;
  const totalPoints = achievements.filter(a => a.completed).length * 100;

  return (
    <div className="space-y-6">
      {/* Achievement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Achievements</p>
              <p className="text-2xl font-bold text-white">{completedCount}/{achievements.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Points</p>
              <p className="text-2xl font-bold text-green-400">{totalPoints}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Rank</p>
              <p className="text-2xl font-bold text-purple-400">Silver</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {achievements.map(achievement => (
          <div key={achievement.id} className={`bg-slate-800 rounded-xl p-6 border transition-all duration-300 ${
            achievement.completed 
              ? 'border-green-500/50 bg-green-500/5' 
              : 'border-slate-700 hover:border-slate-600'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`text-2xl ${achievement.completed ? 'grayscale-0' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <div>
                  <h3 className={`font-bold ${achievement.completed ? 'text-green-400' : 'text-white'}`}>
                    {achievement.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{achievement.description}</p>
                </div>
              </div>
              {achievement.completed && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {!achievement.completed && achievement.progress !== undefined && (
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-gray-400">{achievement.progress}/{achievement.target}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Reward */}
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-400">Reward: </span>
                <span className="text-yellow-400 font-medium">{achievement.reward}</span>
              </div>
              {achievement.completed && (
                <div className="text-xs text-green-400">
                  Unlocked {achievement.unlockedAt}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Achievement Modal */}
      {showNewAchievement && newAchievement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30 p-8 text-center max-w-md animate-pulse">
            <div className="text-6xl mb-4">{newAchievement.icon}</div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">Achievement Unlocked!</h2>
            <h3 className="text-xl font-bold text-white mb-2">{newAchievement.title}</h3>
            <p className="text-gray-300 mb-4">{newAchievement.description}</p>
            <div className="bg-yellow-500/20 rounded-lg p-3 mb-6">
              <p className="text-yellow-400 font-medium">Reward: {newAchievement.reward}</p>
            </div>
            <button
              onClick={() => setShowNewAchievement(false)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 px-6 rounded-xl"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
