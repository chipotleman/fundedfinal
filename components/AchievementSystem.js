
import React, { useState } from 'react';

export default function AchievementSystem({ userStats }) {
  const [activeTab, setActiveTab] = useState('achievements');

  const achievements = [
    {
      id: 1,
      title: 'First Win',
      description: 'Win your first bet',
      icon: '🎯',
      progress: 100,
      maxProgress: 100,
      reward: '$10 Bonus',
      tier: 'bronze',
      unlocked: true,
      claimed: true
    },
    {
      id: 2,
      title: 'Hot Streak',
      description: 'Win 5 bets in a row',
      icon: '🔥',
      progress: 80,
      maxProgress: 100,
      reward: '$50 Bonus',
      tier: 'silver',
      unlocked: true,
      claimed: false
    },
    {
      id: 3,
      title: 'High Roller',
      description: 'Place a bet worth $500 or more',
      icon: '💎',
      progress: 60,
      maxProgress: 100,
      reward: '$100 Bonus',
      tier: 'gold',
      unlocked: true,
      claimed: false
    },
    {
      id: 4,
      title: 'The Predictor',
      description: 'Achieve 75% win rate over 50 bets',
      icon: '🔮',
      progress: 0,
      maxProgress: 100,
      reward: '$250 Bonus',
      tier: 'platinum',
      unlocked: false,
      claimed: false
    }
  ];

  const dailyChallenges = [
    {
      id: 1,
      title: 'Early Bird',
      description: 'Place 3 bets before 12 PM',
      progress: 2,
      maxProgress: 3,
      reward: '$15',
      timeLeft: '4h 23m',
      difficulty: 'Easy'
    },
    {
      id: 2,
      title: 'Parlay Master',
      description: 'Win a 3+ leg parlay',
      progress: 0,
      maxProgress: 1,
      reward: '$35',
      timeLeft: '16h 45m',
      difficulty: 'Medium'
    },
    {
      id: 3,
      title: 'Perfect Day',
      description: 'Win all bets placed today (min 3)',
      progress: 0,
      maxProgress: 3,
      reward: '$75',
      timeLeft: '18h 12m',
      difficulty: 'Hard'
    }
  ];

  const tierColors = {
    bronze: 'from-amber-600 to-amber-500',
    silver: 'from-gray-400 to-gray-300',
    gold: 'from-yellow-500 to-yellow-400',
    platinum: 'from-purple-500 to-purple-400'
  };

  const difficultyColors = {
    Easy: 'bg-green-500/20 text-green-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Hard: 'bg-red-500/20 text-red-400'
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Achievements</h2>
        <div className="flex space-x-2 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'achievements'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Achievements
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'challenges'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Daily Challenges
          </button>
        </div>
      </div>

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className={`relative overflow-hidden rounded-2xl border transition-all ${
                achievement.unlocked
                  ? 'bg-slate-800/50 border-slate-700/50'
                  : 'bg-slate-900/50 border-slate-800/50 opacity-75'
              }`}
            >
              {/* Tier Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-r ${tierColors[achievement.tier]} opacity-5`}></div>
              
              <div className="relative p-6">
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${tierColors[achievement.tier]} flex items-center justify-center text-2xl`}>
                    {achievement.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white font-bold text-lg">{achievement.title}</h3>
                        <p className="text-gray-400">{achievement.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">{achievement.reward}</div>
                        <div className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${tierColors[achievement.tier]} text-black font-bold uppercase`}>
                          {achievement.tier}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{achievement.progress}/{achievement.maxProgress}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full bg-gradient-to-r ${tierColors[achievement.tier]} transition-all`}
                          style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {achievement.claimed ? (
                      <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg font-medium text-center">
                        ✓ Claimed
                      </div>
                    ) : achievement.progress >= achievement.maxProgress ? (
                      <button className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all">
                        Claim Reward
                      </button>
                    ) : (
                      <div className="bg-slate-700/50 text-gray-400 px-4 py-2 rounded-lg font-medium text-center">
                        {achievement.unlocked ? 'In Progress' : 'Locked'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-gray-400 mb-2">Daily challenges reset in:</div>
            <div className="text-2xl font-bold text-white">23h 47m 12s</div>
          </div>

          {dailyChallenges.map(challenge => (
            <div key={challenge.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-white font-bold text-lg">{challenge.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${difficultyColors[challenge.difficulty]}`}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-400 mb-2">{challenge.description}</p>
                  <div className="text-sm text-gray-500">
                    Time remaining: <span className="text-yellow-400 font-medium">{challenge.timeLeft}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold text-lg">{challenge.reward}</div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Progress</span>
                  <span>{challenge.progress}/{challenge.maxProgress}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{ width: `${(challenge.progress / challenge.maxProgress) * 100}%` }}
                  ></div>
                </div>
              </div>

              {challenge.progress >= challenge.maxProgress && (
                <button className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all">
                  Claim Reward
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
