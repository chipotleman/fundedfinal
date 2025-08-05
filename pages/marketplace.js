
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Marketplace() {
  const router = useRouter();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [cappers, setCappers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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
      totalPicks: 1249
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
      totalPicks: 3428
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
      totalPicks: 687
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

  const filteredCappers = cappers.filter(capper => {
    const matchesSearch = capper.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         capper.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           capper.categories.includes(selectedCategory) ||
                           (selectedCategory === 'human' && capper.type === 'human') ||
                           (selectedCategory === 'ai' && capper.type === 'ai');
    return matchesSearch && matchesCategory;
  });

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

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 py-8 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Sports Picks Marketplace
          </h1>
          <p className="text-lg sm:text-xl text-purple-100 max-w-3xl mx-auto">
            Connect with top cappers and AI models. Get expert picks, analysis, and guidance to improve your betting game.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search cappers and AI models..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="human">Human Cappers</option>
              <option value="ai">AI Models</option>
              <option value="NFL">NFL</option>
              <option value="NBA">NBA</option>
              <option value="MLB">MLB</option>
              <option value="NHL">NHL</option>
            </select>
          </div>
        </div>

        {/* Marketplace Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCappers.map(capper => (
            <div key={capper.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-purple-500 transition-all duration-300">
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
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{capper.winRate}%</div>
                    <div className="text-xs text-gray-400">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{capper.totalPicks.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Total Picks</div>
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
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300"
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

        {filteredCappers.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white mb-2">No Results Found</h3>
              <p className="text-gray-400">Try adjusting your search or filters to find cappers and AI models.</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 py-8 px-4 sm:px-6 lg:px-8 mb-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Become a Capper</h2>
          <p className="text-lg text-green-100 mb-6">
            Share your expertise and earn money with 0% processing fees. 
            Referred cappers also earn their referrer 10% of sales for one year!
          </p>
          <button className="bg-white text-green-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
            Apply to Become a Capper
          </button>
        </div>
      </div>
    </div>
  );
}
