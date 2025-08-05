
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import TopNavbar from '../../components/TopNavbar';
import { useBetSlip } from '../../contexts/BetSlipContext';

export default function CapperProfile() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const router = useRouter();
  const { id } = router.query;
  const [capper, setCapper] = useState(null);
  const [picks, setPicks] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('picks');

  // Mock data for now
  const mockCapper = {
    id: 1,
    name: "BetMaster Pro",
    type: "human",
    avatar: "https://via.placeholder.com/120",
    bio: "15+ years of NFL betting experience. Started as a college football analyst and moved into professional sports betting. Known for deep statistical analysis and situational betting strategies.",
    winRate: 68.2,
    followers: 2847,
    monthlyPrice: 49.99,
    categories: ["NFL", "NBA"],
    verified: true,
    rating: 4.8,
    totalPicks: 1249,
    roi: 15.3,
    joinDate: "2020-03-15",
    streak: 7
  };

  const mockPicks = [
    {
      id: 1,
      game: "Cowboys vs Eagles",
      pick: "Cowboys +3.5",
      odds: "-110",
      confidence: "High",
      reasoning: "Cowboys have been undervalued in division games this season. Eagles struggling with injuries on both sides of the ball.",
      timestamp: "2024-01-15T14:30:00Z",
      result: "pending",
      sport: "NFL"
    },
    {
      id: 2,
      game: "Lakers vs Warriors", 
      pick: "Under 225.5",
      odds: "-115",
      confidence: "Medium",
      reasoning: "Both teams playing second night of back-to-back. Expect slower pace and defensive focus.",
      timestamp: "2024-01-15T12:00:00Z",
      result: "won",
      sport: "NBA"
    }
  ];

  useEffect(() => {
    if (id) {
      // TODO: Fetch actual capper data from Supabase
      setCapper(mockCapper);
      setPicks(mockPicks);
      setLoading(false);
    }
  }, [id]);

  const handleSubscribe = () => {
    // TODO: Implement subscription logic
    setIsSubscribed(true);
    alert(`Subscribed to ${capper.name} for $${capper.monthlyPrice}/month`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading capper profile...</p>
        </div>
      </div>
    );
  }

  if (!capper) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Capper Not Found</h1>
          <button
            onClick={() => router.push('/marketplace')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
          >
            Back to Marketplace
          </button>
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

      <div className="pt-20 pb-8">
        {/* Capper Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
              <div className="relative">
                <img
                  src={capper.avatar}
                  alt={capper.name}
                  className="w-32 h-32 rounded-full border-4 border-purple-500"
                />
                {capper.type === 'ai' && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-sm">🤖</span>
                  </div>
                )}
                {capper.verified && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-sm">✓</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">{capper.name}</h1>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center">
                    <span className="text-yellow-400 text-lg">★</span>
                    <span className="text-gray-300 ml-1">{capper.rating}</span>
                  </div>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">{capper.followers.toLocaleString()} followers</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">Joined {new Date(capper.joinDate).getFullYear()}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {capper.categories.map(cat => (
                    <span key={cat} className="px-3 py-1 bg-purple-600/20 text-purple-300 text-sm rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>
                <p className="text-gray-400 max-w-2xl">{capper.bio}</p>
              </div>

              <div className="flex flex-col space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">${capper.monthlyPrice}</div>
                  <div className="text-gray-400">per month</div>
                </div>
                {!isSubscribed ? (
                  <button
                    onClick={handleSubscribe}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 whitespace-nowrap"
                  >
                    Subscribe Now
                  </button>
                ) : (
                  <div className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg text-center">
                    ✓ Subscribed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-400">{capper.winRate}%</div>
              <div className="text-gray-400 text-sm">Win Rate</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-blue-400">+{capper.roi}%</div>
              <div className="text-gray-400 text-sm">ROI</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-purple-400">{capper.totalPicks}</div>
              <div className="text-gray-400 text-sm">Total Picks</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-yellow-400">{capper.streak}</div>
              <div className="text-gray-400 text-sm">Win Streak</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-700 mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('picks')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'picks'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Recent Picks
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'analysis'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'about'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                About
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'picks' && (
            <div className="space-y-6">
              {isSubscribed ? (
                picks.map(pick => (
                  <div key={pick.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2">{pick.game}</h3>
                        <div className="flex items-center space-x-4">
                          <span className="text-purple-400 font-bold">{pick.pick}</span>
                          <span className="text-gray-400">{pick.odds}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            pick.confidence === 'High' ? 'bg-red-600/20 text-red-400' :
                            pick.confidence === 'Medium' ? 'bg-yellow-600/20 text-yellow-400' :
                            'bg-green-600/20 text-green-400'
                          }`}>
                            {pick.confidence} Confidence
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          pick.result === 'won' ? 'bg-green-600/20 text-green-400' :
                          pick.result === 'lost' ? 'bg-red-600/20 text-red-400' :
                          'bg-gray-600/20 text-gray-400'
                        }`}>
                          {pick.result === 'pending' ? 'Pending' : pick.result === 'won' ? 'Won' : 'Lost'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(pick.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300">{pick.reasoning}</p>
                  </div>
                ))
              ) : (
                <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Subscribe to Access Picks</h3>
                  <p className="text-gray-400 mb-6">Get access to all picks, analysis, and real-time notifications.</p>
                  <button
                    onClick={handleSubscribe}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300"
                  >
                    Subscribe for ${capper.monthlyPrice}/month
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              {isSubscribed ? (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Weekly Analysis</h3>
                  <p className="text-gray-300 mb-4">
                    This week's focus is on divisional matchups in the NFL. Historical data shows that home underdogs in division games have covered at a 58% rate over the past 3 seasons when the line is between 3-7 points.
                  </p>
                  <div className="bg-slate-700 rounded-lg p-4">
                    <h4 className="font-bold text-white mb-2">Key Trends to Watch:</h4>
                    <ul className="text-gray-300 space-y-1">
                      <li>• Teams coming off bye weeks are 12-4 ATS this season</li>
                      <li>• Road favorites of 3+ points in cold weather games are 6-15 ATS</li>
                      <li>• Division games with totals under 45 have gone over 67% of the time</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <h3 className="text-xl font-bold text-white mb-2">Premium Analysis</h3>
                  <p className="text-gray-400">Subscribe to access detailed weekly analysis and betting trends.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">About {capper.name}</h3>
              <p className="text-gray-300 mb-4">{capper.bio}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-white mb-2">Specialties:</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li>• NFL Point Spreads</li>
                    <li>• NBA Totals</li>
                    <li>• Live Betting</li>
                    <li>• Prop Betting</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-2">Track Record:</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li>• 3 Years Profitable</li>
                    <li>• 68.2% Win Rate</li>
                    <li>• 15.3% ROI</li>
                    <li>• 1,249 Documented Picks</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
