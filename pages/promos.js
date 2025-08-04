
import React, { useState } from 'react';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Promos() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState('referrals');

  const userReferralCode = "FUNDBET2024";
  const userStats = {
    referrals: 5,
    earnings: 250,
    tier: "VIP"
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(`https://fundmybet.com/ref/${userReferralCode}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const promos = [
    {
      id: 1,
      title: "Refer a Friend",
      description: "Earn $50 for each friend who completes their first challenge",
      reward: "$50",
      type: "referral",
      status: "active",
      progress: { current: 5, max: 10 }
    },
    {
      id: 2,
      title: "Social Media Share",
      description: "Share your wins on social media for bonus credits",
      reward: "$25",
      type: "social",
      status: "available",
      progress: { current: 0, max: 1 }
    },
    {
      id: 3,
      title: "VIP Weekly Bonus",
      description: "Exclusive weekly bonus for VIP members",
      reward: "$100",
      type: "vip",
      status: "claimed",
      progress: { current: 1, max: 1 }
    },
    {
      id: 4,
      title: "First Challenge Bonus",
      description: "Complete your first challenge for a bonus payout",
      reward: "+50%",
      type: "challenge",
      status: "completed",
      progress: { current: 1, max: 1 }
    }
  ];

  const challenges = [
    {
      id: 1,
      title: "Share Your Success",
      description: "Post about your wins on Twitter with #FundMyBet",
      reward: "$25",
      difficulty: "Easy",
      timeLimit: "24 hours"
    },
    {
      id: 2,
      title: "Invite 3 Friends",
      description: "Get 3 friends to sign up and start their first challenge",
      reward: "$150",
      difficulty: "Medium",
      timeLimit: "1 week"
    },
    {
      id: 3,
      title: "Perfect Week",
      description: "Win all bets for 7 consecutive days",
      reward: "$500",
      difficulty: "Hard",
      timeLimit: "1 week"
    }
  ];

  const vipPerks = [
    {
      title: "Higher Payouts",
      description: "Earn 20% more on successful challenges",
      icon: "💰"
    },
    {
      title: "Priority Support",
      description: "24/7 dedicated customer service",
      icon: "🎧"
    },
    {
      title: "Exclusive Challenges",
      description: "Access to VIP-only high-stakes challenges",
      icon: "🏆"
    },
    {
      title: "Weekly Bonuses",
      description: "Guaranteed weekly bonus regardless of performance",
      icon: "🎁"
    }
  ];

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={10000}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-20 pb-16">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Promotions</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Earn more through referrals, challenges, and exclusive VIP rewards. Turn your network into profits.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto px-6 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 text-center">
              <div className="text-4xl font-black text-green-400 mb-2">{userStats.referrals}</div>
              <div className="text-gray-300">Successful Referrals</div>
            </div>
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 text-center">
              <div className="text-4xl font-black text-blue-400 mb-2">${userStats.earnings}</div>
              <div className="text-gray-300">Total Earned</div>
            </div>
            <div className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 text-center">
              <div className="text-4xl font-black text-purple-400 mb-2">{userStats.tier}</div>
              <div className="text-gray-300">Member Status</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <div className="flex space-x-1 bg-black/90 rounded-xl p-1 border border-gray-800">
            <button
              onClick={() => setActiveTab('referrals')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                activeTab === 'referrals' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Referral Program
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                activeTab === 'challenges' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Social Challenges
            </button>
            <button
              onClick={() => setActiveTab('vip')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                activeTab === 'vip' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              VIP Perks
            </button>
          </div>
        </div>

        {/* Referral Program Tab */}
        {activeTab === 'referrals' && (
          <div className="max-w-7xl mx-auto px-6">
            {/* Referral Code */}
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-8 border border-green-500/30 mb-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4">Your Referral Code</h2>
                <div className="bg-slate-800 rounded-xl p-6 mb-6">
                  <div className="text-2xl font-mono text-green-400 mb-4">{userReferralCode}</div>
                  <div className="text-gray-300 mb-4">Share this link with friends:</div>
                  <div className="bg-slate-700 rounded-lg p-3 text-gray-300 text-sm break-all mb-4">
                    https://fundmybet.com/ref/{userReferralCode}
                  </div>
                  <button
                    onClick={copyReferralCode}
                    className={`px-6 py-3 rounded-xl font-bold transition-all ${
                      copiedCode 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {copiedCode ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* Available Promos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {promos.map((promo) => (
                <div key={promo.id} className="bg-black/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-800">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">{promo.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      promo.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      promo.status === 'available' ? 'bg-blue-500/20 text-blue-400' :
                      promo.status === 'claimed' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {promo.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 mb-4">{promo.description}</p>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-bold text-green-400">{promo.reward}</span>
                    <span className="text-gray-400">
                      {promo.progress.current}/{promo.progress.max}
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(promo.progress.current / promo.progress.max) * 100}%` }}
                    ></div>
                  </div>
                  
                  <button 
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      promo.status === 'available' 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-slate-700 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={promo.status !== 'available'}
                  >
                    {promo.status === 'available' ? 'Claim Now' : 
                     promo.status === 'active' ? 'In Progress' :
                     promo.status === 'claimed' ? 'Claimed' : 'Completed'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {challenges.map((challenge) => (
                <div key={challenge.id} className="bg-black/90 backdrop-blur-lg rounded-2xl p-8 border border-gray-800">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">{challenge.title}</h3>
                    <p className="text-gray-300 mb-6">{challenge.description}</p>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Reward:</span>
                        <span className="text-green-400 font-bold">{challenge.reward}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Difficulty:</span>
                        <span className={`font-bold ${
                          challenge.difficulty === 'Easy' ? 'text-green-400' :
                          challenge.difficulty === 'Medium' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>{challenge.difficulty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Time Limit:</span>
                        <span className="text-blue-400 font-bold">{challenge.timeLimit}</span>
                      </div>
                    </div>
                    
                    <button className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300">
                      Start Challenge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIP Perks Tab */}
        {activeTab === 'vip' && (
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">VIP Member Benefits</h2>
              <p className="text-xl text-gray-300">Unlock exclusive rewards and premium features</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {vipPerks.map((perk, index) => (
                <div key={index} className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/30">
                  <div className="flex items-start space-x-4">
                    <div className="text-4xl">{perk.icon}</div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-3">{perk.title}</h3>
                      <p className="text-gray-300 text-lg">{perk.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-12 border border-purple-500/30">
                <h3 className="text-3xl font-bold text-white mb-4">Become a VIP Member</h3>
                <p className="text-gray-300 mb-8 text-lg">Complete 3 challenges or maintain $50,000+ in funded profits</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/dashboard" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg">
                    Start Challenges
                  </Link>
                  <Link href="/rules" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 text-lg border border-slate-600">
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
