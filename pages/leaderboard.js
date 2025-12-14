import React, { useState } from "react";
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import ProfileModal from '../components/ProfileModal';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserProfiles } from '../contexts/UserProfilesContext';
import { useAuth } from '../contexts/AuthContext';
import BetSlip from '../components/BetSlip';

const Leaderboard = () => {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { selectedProfile, showProfileModal, setShowProfileModal, openProfile } = useUserProfiles();
  const { user, login, logout } = useAuth();
  const [timeframe, setTimeframe] = useState('monthly');
  const [category, setCategory] = useState('all');

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

  const getFilteredData = () => {
    let filteredData = [...allLeaderboardData];

    if (category !== 'all') {
      filteredData = filteredData.filter(user => user.tier.toLowerCase() === category);
    }

    if (timeframe === 'weekly') {
      filteredData = filteredData.map(user => ({
        ...user,
        profit: Math.floor(user.profit * 0.3),
        roi: user.roi * 0.3
      }));
    } else if (timeframe === 'monthly') {
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
      case 'Elite': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'Pro': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'Starter': return 'text-green-400 bg-green-400/10 border-green-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getRankIcon = (rank) => {
    switch(rank) {
      case 1: return "🏆";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return null;
    }
  };

  const getRankStyle = (rank) => {
    switch(rank) {
      case 1: return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/40';
      case 2: return 'from-gray-400/20 to-gray-500/10 border-gray-400/40';
      case 3: return 'from-orange-600/20 to-orange-700/10 border-orange-600/40';
      default: return 'from-transparent to-transparent border-gray-800/50';
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={user ? 10000 : null}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-4 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-gray-400 text-sm sm:text-base">Top performers across all challenges</p>
        </div>

        <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              {['weekly', 'monthly', 'alltime'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    timeframe === tf 
                      ? 'bg-green-600 text-white' 
                      : 'bg-[#1a1a1a] text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {tf === 'weekly' ? 'Weekly' : tf === 'monthly' ? 'Monthly' : 'All Time'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              {['all', 'elite', 'pro', 'starter'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    category === cat 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-[#1a1a1a] text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {cat === 'all' ? 'All Tiers' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {leaderboardData.slice(0, 3).map((leader, index) => (
            <div 
              key={leader.rank} 
              onClick={() => openProfile(leader.username)}
              className={`relative bg-gradient-to-b ${getRankStyle(leader.rank)} bg-[#111111] rounded-xl p-6 border cursor-pointer hover:scale-[1.02] transition-transform duration-200 ${index === 0 ? 'sm:order-2 sm:scale-105' : index === 1 ? 'sm:order-1' : 'sm:order-3'}`}
            >
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-3">{getRankIcon(leader.rank)}</div>
                <div className="text-lg sm:text-xl font-bold text-white mb-2">{leader.username}</div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 border ${getTierColor(leader.tier)}`}>
                  {leader.tier}
                </div>
                <div className="space-y-2">
                  <div className="text-2xl sm:text-3xl font-black text-green-400">${leader.profit.toLocaleString()}</div>
                  <div className="text-gray-500 text-xs uppercase">Profit</div>
                  <div className="text-lg font-bold text-blue-400">{leader.roi.toFixed(1)}%</div>
                  <div className="text-gray-500 text-xs uppercase">ROI</div>
                  <div className="text-white font-medium">{((leader.wins/leader.totalBets) * 100).toFixed(0)}%</div>
                  <div className="text-gray-500 text-xs uppercase">Win Rate</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#111111] rounded-xl border border-gray-800/50 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-800/50">
            <h2 className="text-lg sm:text-xl font-bold text-white">Full Rankings</h2>
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0a0a]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Bettor</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Tier</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Profit</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">ROI</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Win Rate</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Bets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {leaderboardData.map((leader) => (
                  <tr 
                    key={leader.rank} 
                    className="hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                    onClick={() => openProfile(leader.username)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRankIcon(leader.rank) && <span className="text-xl mr-2">{getRankIcon(leader.rank)}</span>}
                        <span className="text-lg font-bold text-white">#{leader.rank}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white font-medium hover:text-green-400 transition-colors">{leader.username}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getTierColor(leader.tier)}`}>
                        {leader.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-green-400 font-bold">${leader.profit.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-blue-400 font-medium">{leader.roi.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-white">{((leader.wins/leader.totalBets) * 100).toFixed(0)}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-gray-400">{leader.totalBets}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden divide-y divide-gray-800/50">
            {leaderboardData.map((leader) => (
              <div 
                key={leader.rank}
                onClick={() => openProfile(leader.username)}
                className="p-4 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getRankIcon(leader.rank) && <span className="text-xl">{getRankIcon(leader.rank)}</span>}
                    <span className="text-lg font-bold text-white">#{leader.rank}</span>
                    <span className="text-white font-medium ml-2">{leader.username}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(leader.tier)}`}>
                    {leader.tier}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-green-400 font-bold">${leader.profit.toLocaleString()}</div>
                    <div className="text-gray-500 text-xs">Profit</div>
                  </div>
                  <div>
                    <div className="text-blue-400 font-medium">{leader.roi.toFixed(1)}%</div>
                    <div className="text-gray-500 text-xs">ROI</div>
                  </div>
                  <div>
                    <div className="text-white">{((leader.wins/leader.totalBets) * 100).toFixed(0)}%</div>
                    <div className="text-gray-500 text-xs">Win Rate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
          <div className="bg-[#111111] rounded-xl p-4 sm:p-6 border border-gray-800/50 text-center">
            <div className="text-2xl sm:text-3xl font-black text-green-400 mb-1">2,847</div>
            <div className="text-gray-400 text-xs sm:text-sm">Active Bettors</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 sm:p-6 border border-gray-800/50 text-center">
            <div className="text-2xl sm:text-3xl font-black text-green-400 mb-1">$1.2M</div>
            <div className="text-gray-400 text-xs sm:text-sm">Total Profits</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 sm:p-6 border border-gray-800/50 text-center">
            <div className="text-2xl sm:text-3xl font-black text-blue-400 mb-1">68.4%</div>
            <div className="text-gray-400 text-xs sm:text-sm">Avg Win Rate</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 sm:p-6 border border-gray-800/50 text-center">
            <div className="text-2xl sm:text-3xl font-black text-yellow-400 mb-1">24/7</div>
            <div className="text-gray-400 text-xs sm:text-sm">Live Updates</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-[#111111] rounded-xl p-6 sm:p-8 border border-gray-800/50 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Ready to Climb the Rankings?</h2>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">Join the competition and prove you belong among the elite bettors.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm sm:text-base">
                Start Your Journey
              </Link>
              <Link href="/dashboard" className="bg-[#1a1a1a] hover:bg-[#222] text-white font-bold py-3 px-6 rounded-xl transition-all text-sm sm:text-base border border-gray-700">
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showBetSlip && (
        <BetSlip
          bankroll={10000}
          isOpen={showBetSlip}
          onClose={() => setShowBetSlip(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal 
          profile={selectedProfile}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default Leaderboard;
