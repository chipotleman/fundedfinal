import React, { useState } from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ProfileModal from '../components/ProfileModal';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserProfiles } from '../contexts/UserProfilesContext';
import { useAuth } from '../contexts/AuthContext';

const Leaderboard = () => {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { selectedProfile, showProfileModal, setShowProfileModal, openProfile } = useUserProfiles();
  const { user, login, logout } = useAuth(); // Assuming user object indicates login status
  const [timeframe, setTimeframe] = useState('monthly');
  const [category, setCategory] = useState('all');

  // Mock leaderboard data - replace with real data from your backend
  const allLeaderboardData = [
    { rank: 1, username: "BetMaster2024", profit: 15420, roi: 154.2, wins: 89, totalBets: 127, tier: "Elite", badge: "🏆" },
    { rank: 2, username: "SharpShooter", profit: 12890, roi: 128.9, wins: 76, totalBets: 115, tier: "Pro", badge: "🥈" },
    { rank: 3, username: "SportsSage", profit: 11250, roi: 112.5, wins: 82, totalBets: 134, tier: "Elite", badge: "🥉" },
    { rank: 4, username: "OddsWhisperer", profit: 9875, roi: 98.8, wins: 68, totalBets: 98, tier: "Pro", badge: "⭐" },
    { rank: 5, username: "LineHunter", profit: 8640, roi: 86.4, wins: 71, totalBets: 109, tier: "Starter", badge: "⭐" },
    { rank: 6, username: "ValueFinder", profit: 7920, roi: 79.2, wins: 63, totalBets: 94, tier: "Pro", badge: "⭐" },
    { rank: 7, username: "BankrollBeast", profit: 7435, roi: 74.4, wins: 58, totalBets: 87, tier: "Starter", badge: "⭐" },
    { rank: 8, username: "EdgeSeeker", profit: 6890, roi: 68.9, wins: 55, totalBets: 92, tier: "Pro", badge: "⭐" },
    { rank: 9, username: "ProfitPro", profit: 6210, roi: 62.1, wins: 49, totalBets: 81, tier: "Starter", badge: "⭐" },
    { rank: 10, username: "WinStreaker", profit: 5875, roi: 58.8, wins: 47, totalBets: 76, tier: "Starter", badge: "⭐" }
  ];

  // Filter data based on selected filters
  const getFilteredData = () => {
    let filteredData = [...allLeaderboardData];

    // Filter by tier/category
    if (category !== 'all') {
      filteredData = filteredData.filter(user => user.tier.toLowerCase() === category);
    }

    // Simulate different data for different timeframes
    if (timeframe === 'weekly') {
      // Simulate weekly data with slightly different profits
      filteredData = filteredData.map(user => ({
        ...user,
        profit: Math.floor(user.profit * 0.3),
        roi: user.roi * 0.3
      }));
    } else if (timeframe === 'monthly') {
      // Use current data as monthly
      filteredData = filteredData.map(user => ({
        ...user,
        profit: Math.floor(user.profit * 0.7),
        roi: user.roi * 0.7
      }));
    }

    return filteredData;
  };

  const leaderboardData = getFilteredData();

  const getTierColor = (tier) => {
    switch(tier) {
      case 'Elite': return 'text-purple-400 bg-purple-400/10';
      case 'Pro': return 'text-blue-400 bg-blue-400/10';
      case 'Starter': return 'text-green-400 bg-green-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1: return "🏆";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "⭐";
    }
  };

  // Determine if the user has an open challenge (mock implementation)
  const hasOpenChallenge = (username) => {
    // Replace with actual logic to check for open challenges
    return false; 
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={user ? 10000 : null}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-4 pb-16">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-6 pt-2 pb-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Leaderboard</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            See how you stack up against the best funded bettors. Track performance, ROI, and climb the ranks.
          </p>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeframe('weekly')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timeframe === 'weekly' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timeframe === 'monthly' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setTimeframe('alltime')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timeframe === 'alltime' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  All Time
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCategory('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    category === 'all' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  All Tiers
                </button>
                <button
                  onClick={() => setCategory('elite')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    category === 'elite' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Elite
                </button>
                <button
                  onClick={() => setCategory('pro')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    category === 'pro' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Pro
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="max-w-7xl mx-auto px-6 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {leaderboardData.slice(0, 3).map((user, index) => (
              <div key={user.rank} className={`relative ${index === 0 ? 'md:order-2' : index === 1 ? 'md:order-1' : 'md:order-3'}`}>
                <div className={`bg-gradient-to-br ${
                  user.rank === 1 
                    ? 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30' 
                    : user.rank === 2 
                    ? 'from-gray-400/20 to-gray-600/20 border-gray-400/30'
                    : 'from-orange-600/20 to-orange-800/20 border-orange-600/30'
                } backdrop-blur-lg rounded-2xl p-8 border text-center ${index === 0 ? 'transform scale-105' : ''}`}>

                  <div className="text-6xl mb-4">{getRankIcon(user.rank)}</div>
                  <button 
                    onClick={() => openProfile(user.username)}
                    className="text-2xl font-bold text-white mb-2 hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {user.username}
                  </button>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${getTierColor(user.tier)}`}>
                    {user.tier}
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-black text-green-400">${user.profit.toLocaleString()}</div>
                    <div className="text-gray-300">Profit</div>
                    <div className="text-xl font-bold text-blue-400">{user.roi.toFixed(2)}%</div>
                    <div className="text-gray-300">ROI</div>
                    <div className="text-lg text-white">{user.wins}/{user.totalBets}</div>
                    <div className="text-gray-300">Win Rate: {((user.wins/user.totalBets) * 100).toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Leaderboard Table */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-black/90 backdrop-blur-lg rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-2xl font-bold text-white">Full Rankings</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/90">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Bettor</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Profit</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">ROI</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Win Rate</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Bets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leaderboardData.map((user, index) => (
                    <tr 
                      key={user.rank} 
                      className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Clicked user:', user.username, 'Rank:', user.rank);
                        openProfile(user.username);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">{getRankIcon(user.rank)}</span>
                          <span className="text-lg font-bold text-white">#{user.rank}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-semibold text-white hover:text-blue-400 transition-colors">
                          {user.username}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getTierColor(user.tier)}`}>
                          {user.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-lg font-bold text-green-400">${user.profit.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-lg font-semibold text-blue-400">{user.roi.toFixed(2)}%</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-white font-medium">{((user.wins/user.totalBets) * 100).toFixed(2)}%</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-gray-300">{user.totalBets}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 text-center">
              <div className="text-3xl font-black text-purple-400 mb-2">2,847</div>
              <div className="text-gray-300">Active Bettors</div>
            </div>
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 text-center">
              <div className="text-3xl font-black text-green-400 mb-2">$1.2M</div>
              <div className="text-gray-300">Total Profits</div>
            </div>
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 text-center">
              <div className="text-3xl font-black text-blue-400 mb-2">{(68.4).toFixed(1)}%</div>
              <div className="text-gray-300">Avg Win Rate</div>
            </div>
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 text-center">
              <div className="text-3xl font-black text-orange-400 mb-2">24/7</div>
              <div className="text-gray-300">Live Updates</div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-12 border border-purple-500/30">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Climb the Rankings?</h2>
            <p className="text-gray-300 mb-8 text-lg">Join the competition and prove you belong among the elite bettors.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg hover:scale-105 transform">
                Start Your Journey
              </Link>
              <Link href="/dashboard" className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg border border-gray-600 hover:border-gray-500">
                View Dashboard
              </Link>
              <Link href="/how-it-works" className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg">
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showProfileModal && (
        <ProfileModal 
          profile={selectedProfile}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}

export default Leaderboard;