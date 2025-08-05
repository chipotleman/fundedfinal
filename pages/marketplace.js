import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Marketplace() {
  const router = useRouter();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [cappers, setCappers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock data for now - will be replaced with actual Supabase data
  const mockCappers = [
    {
      id: 1,
      name: "BetMaster Pro",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "15+ years of NFL betting experience with 68% win rate",
      winRate: 68.2,
      followers: 2847,
      monthlyPrice: 49.99,
      categories: ["NFL", "NBA"],
      verified: true,
      rating: 4.8,
      totalPicks: 1249,
      helpedGetFunded: 127
    },
    {
      id: 2,
      name: "AI Sports Oracle",
      type: "ai",
      avatar: "https://via.placeholder.com/80",
      description: "Advanced ML model analyzing 500+ data points for each pick",
      winRate: 71.5,
      followers: 5234,
      monthlyPrice: 79.99,
      categories: ["NFL", "NBA", "MLB"],
      verified: true,
      rating: 4.9,
      totalPicks: 3428,
      helpedGetFunded: 294
    },
    {
      id: 3,
      name: "Hockey Analytics Hub",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "NHL specialist with deep analytics focus",
      winRate: 64.7,
      followers: 892,
      monthlyPrice: 29.99,
      categories: ["NHL"],
      verified: false,
      rating: 4.6,
      totalPicks: 687,
      helpedGetFunded: 43
    },
    {
      id: 4,
      name: "NBA Prediction Engine",
      type: "ai",
      avatar: "https://via.placeholder.com/80",
      description: "Deep learning model specializing in NBA player props and totals",
      winRate: 73.8,
      followers: 3421,
      monthlyPrice: 89.99,
      categories: ["NBA"],
      verified: true,
      rating: 4.9,
      totalPicks: 2156,
      helpedGetFunded: 198
    },
    {
      id: 5,
      name: "College Football Guru",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "Former D1 coach with insider knowledge of college football",
      winRate: 66.4,
      followers: 1593,
      monthlyPrice: 39.99,
      categories: ["NCAAF"],
      verified: true,
      rating: 4.7,
      totalPicks: 892,
      helpedGetFunded: 76
    },
    {
      id: 6,
      name: "Baseball Analytics Pro",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "Sabermetrics expert with focus on MLB run lines and totals",
      winRate: 69.1,
      followers: 2134,
      monthlyPrice: 44.99,
      categories: ["MLB"],
      verified: true,
      rating: 4.6,
      totalPicks: 1678,
      helpedGetFunded: 89
    },
    {
      id: 7,
      name: "Live Bet AI",
      type: "ai",
      avatar: "https://via.placeholder.com/80",
      description: "Real-time ML model for live betting opportunities across all sports",
      winRate: 70.3,
      followers: 4567,
      monthlyPrice: 99.99,
      categories: ["NFL", "NBA", "MLB", "NHL"],
      verified: true,
      rating: 4.8,
      totalPicks: 3892,
      helpedGetFunded: 312
    },
    {
      id: 8,
      name: "Tennis Sharp",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "Former ATP tour player with expertise in tennis betting markets",
      winRate: 65.9,
      followers: 734,
      monthlyPrice: 34.99,
      categories: ["Tennis"],
      verified: false,
      rating: 4.5,
      totalPicks: 456,
      helpedGetFunded: 29
    },
    {
      id: 9,
      name: "Soccer Analytics AI",
      type: "ai",
      avatar: "https://via.placeholder.com/80",
      description: "Global soccer prediction model covering major leagues worldwide",
      winRate: 67.7,
      followers: 2891,
      monthlyPrice: 54.99,
      categories: ["Soccer"],
      verified: true,
      rating: 4.7,
      totalPicks: 2234,
      helpedGetFunded: 156
    },
    {
      id: 10,
      name: "Fantasy Football Expert",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "DFS expert transitioning to sports betting with proven track record",
      winRate: 63.2,
      followers: 1876,
      monthlyPrice: 29.99,
      categories: ["NFL", "NCAAF"],
      verified: false,
      rating: 4.4,
      totalPicks: 743,
      helpedGetFunded: 52
    },
    {
      id: 11,
      name: "Props Predictor AI",
      type: "ai",
      avatar: "https://via.placeholder.com/80",
      description: "Specialized AI model for player props across NFL, NBA, and MLB",
      winRate: 72.1,
      followers: 3756,
      monthlyPrice: 74.99,
      categories: ["NFL", "NBA", "MLB"],
      verified: true,
      rating: 4.8,
      totalPicks: 2567,
      helpedGetFunded: 203
    },
    {
      id: 12,
      name: "March Madness Maven",
      type: "human",
      avatar: "https://via.placeholder.com/80",
      description: "College basketball specialist with focus on tournament play",
      winRate: 61.8,
      followers: 1234,
      monthlyPrice: 49.99,
      categories: ["NCAAB"],
      verified: true,
      rating: 4.3,
      totalPicks: 589,
      helpedGetFunded: 38
    }
  ];

  useEffect(() => {
    const fetchCappers = async () => {
      try {
        const response = await fetch('/api/marketplace/cappers');
        const data = await response.json();

        if (response.ok) {
          setCappers(data.cappers);
        } else {
          console.error('Error fetching cappers:', data.error);
          // Fallback to mock data
          setCappers(mockCappers);
        }
      } catch (error) {
        console.error('Error fetching cappers:', error);
        // Fallback to mock data
        setCappers(mockCappers);
      } finally {
        setLoading(false);
      }
    };

    fetchCappers();
  }, []);

  const handleSubscribe = async (capper) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Please sign in to subscribe to cappers');
        return;
      }

      const response = await fetch('/api/marketplace/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          capper_id: capper.id,
          user_id: user.id,
          monthly_price: capper.monthly_price
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully subscribed to ${capper.name}!`);
        // Optionally redirect to capper's channel
        // router.push(`/capper/${capper.id}`);
      } else {
        alert(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('An error occurred while subscribing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={10000}
        pnl={0}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 py-8 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Need Help Passing a Challenge?
          </h1>
          <p className="text-lg sm:text-xl text-purple-100 max-w-4xl mx-auto">
            These cappers and AI models are available to help you if you are having trouble becoming a funded bettor.
          </p>
        </div>
      </div>

      {/* Marketplace Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cappers.map(capper => (
            <div key={capper.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1">
              {/* Capper Header */}
              <div className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="relative">
                    <img
                      src={capper.avatar}
                      alt={capper.name}
                      className="w-16 h-16 rounded-full border-2 border-purple-500"
                    />
                    {capper.type === 'ai' && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-xs">🤖</span>
                      </div>
                    )}
                    {capper.verified && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{capper.name}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center">
                        <span className="text-yellow-400">★</span>
                        <span className="text-gray-300 text-sm ml-1">{capper.rating}</span>
                      </div>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-300 text-sm">{capper.followers} followers</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {capper.categories.map(cat => (
                        <span key={cat} className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-4">{capper.description}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">{capper.winRate}%</div>
                    <div className="text-xs text-gray-400">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">{capper.totalPicks.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Total Picks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-400">{capper.helpedGetFunded}</div>
                    <div className="text-xs text-gray-400">Clients Funded</div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-2xl font-bold text-white">${capper.monthlyPrice}</div>
                    <div className="text-sm text-gray-400">per month</div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(capper)}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Subscribe
                  </button>
                </div>

                {/* Benefits */}
                <div className="text-sm text-gray-400">
                  <div className="flex items-center mb-1">
                    <span className="text-green-400 mr-2">✓</span>
                    Daily picks and analysis
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="text-green-400 mr-2">✓</span>
                    Private channel access
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Real-time notifications
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cappers.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-2">No Cappers Available</h3>
              <p className="text-gray-400">Check back soon for more cappers and AI models.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}