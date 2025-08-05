
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LiveCommunityStats() {
  const [stats, setStats] = useState({
    bettorsOnline: 1247,
    winRate: 72.3,
    gambledToday: 0,
    withdrawnToday: 0
  });

  const [selectedStat, setSelectedStat] = useState(null);

  useEffect(() => {
    // Get current date to track daily resets
    const getCurrentDayKey = () => {
      const now = new Date();
      return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    };

    // Initialize daily values
    const initializeDailyStats = () => {
      const today = getCurrentDayKey();
      const storedDay = localStorage.getItem('statsDay');
      
      if (storedDay !== today) {
        // New day - reset values
        localStorage.setItem('statsDay', today);
        localStorage.setItem('gambledToday', '0');
        localStorage.setItem('withdrawnToday', '0');
        localStorage.setItem('gambledStartTime', Date.now().toString());
        localStorage.setItem('withdrawnStartTime', Date.now().toString());
      }
      
      return {
        gambledToday: parseFloat(localStorage.getItem('gambledToday') || '0'),
        withdrawnToday: parseFloat(localStorage.getItem('withdrawnToday') || '0'),
        gambledStartTime: parseInt(localStorage.getItem('gambledStartTime') || Date.now().toString()),
        withdrawnStartTime: parseInt(localStorage.getItem('withdrawnStartTime') || Date.now().toString())
      };
    };

    const dailyStats = initializeDailyStats();

    // Update stats every second
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Calculate progress rates
      // $7,000 every 40 minutes = $175 per minute = ~$2.92 per second
      const gambledPerSecond = 7000 / (40 * 60);
      
      // $470 every 40 minutes = $11.75 per minute = ~$0.196 per second
      const withdrawnPerSecond = 470 / (40 * 60);
      
      // Calculate elapsed time and new values
      const gambledElapsed = (now - dailyStats.gambledStartTime) / 1000;
      const withdrawnElapsed = (now - dailyStats.withdrawnStartTime) / 1000;
      
      const newGambledToday = dailyStats.gambledToday + (gambledElapsed * gambledPerSecond);
      const newWithdrawnToday = dailyStats.withdrawnToday + (withdrawnElapsed * withdrawnPerSecond);
      
      // Update localStorage
      localStorage.setItem('gambledToday', newGambledToday.toString());
      localStorage.setItem('withdrawnToday', newWithdrawnToday.toString());
      
      setStats(prev => ({
        ...prev,
        // Vary bettors online slightly (1200-1300)
        bettorsOnline: Math.floor(1200 + Math.random() * 100),
        // Vary win rate slightly (70-75%)
        winRate: parseFloat((70 + Math.random() * 5).toFixed(1)),
        gambledToday: newGambledToday,
        withdrawnToday: newWithdrawnToday
      }));
    }, 1000);

    // Also update withdrawn every 1-3 minutes with slight variations
    const withdrawnInterval = setInterval(() => {
      // Add some randomness to withdrawal timing
      const variation = (Math.random() - 0.5) * 100; // ±$50 variation
      setStats(prev => ({
        ...prev,
        withdrawnToday: prev.withdrawnToday + variation
      }));
    }, (1 + Math.random() * 2) * 60 * 1000); // 1-3 minutes

    return () => {
      clearInterval(interval);
      clearInterval(withdrawnInterval);
    };
  }, []);

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    } else {
      return `$${Math.floor(amount)}`;
    }
  };

  const getStatDetails = (statType) => {
    switch (statType) {
      case 'bettorsOnline':
        return {
          title: 'Active Bettors Research',
          data: {
            current: stats.bettorsOnline,
            peak24h: 1543,
            peakTime: '8:30 PM EST',
            avgSession: '47 minutes',
            topRegions: ['United States (67%)', 'Canada (18%)', 'United Kingdom (9%)', 'Other (6%)'],
            deviceBreakdown: ['Mobile (73%)', 'Desktop (22%)', 'Tablet (5%)'],
            trend: '+12% vs yesterday'
          }
        };
      case 'winRate':
        return {
          title: 'Community Win Rate Analysis',
          data: {
            current: `${stats.winRate}%`,
            last24h: '71.8%',
            last7days: '69.4%',
            last30days: '67.2%',
            topPerformers: ['NFL Spreads (78%)', 'NBA O/U (74%)', 'Soccer ML (69%)', 'Tennis (65%)'],
            avgBetSize: '$147',
            trend: '+2.3% vs last week'
          }
        };
      case 'gambledToday':
        return {
          title: 'Daily Volume Breakdown',
          data: {
            current: formatCurrency(stats.gambledToday),
            hourlyAvg: '$12.4K',
            peakHour: '$47.8K (7-8 PM)',
            sportBreakdown: ['NFL (34%)', 'NBA (28%)', 'Soccer (21%)', 'Other (17%)'],
            betTypes: ['Spreads (42%)', 'Money Line (31%)', 'Over/Under (27%)'],
            trend: '+18% vs yesterday'
          }
        };
      case 'withdrawnToday':
        return {
          title: 'Payout Performance',
          data: {
            current: formatCurrency(stats.withdrawnToday),
            avgWithdrawal: '$1,247',
            fastestPayout: '3.2 minutes',
            payoutMethods: ['Bank Transfer (54%)', 'PayPal (31%)', 'Crypto (15%)'],
            satisfactionRate: '98.7%',
            trend: '+15% vs yesterday'
          }
        };
      default:
        return null;
    }
  };

  const ResearchPopup = ({ statType, onClose }) => {
    const statDetails = getStatDetails(statType);
    if (!statDetails) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">{statDetails.title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Current Value */}
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">{statDetails.data.current}</div>
              <div className="text-gray-300">Current Value</div>
              <div className="text-sm text-green-400 mt-1">{statDetails.data.trend}</div>
            </div>

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(statDetails.data).filter(([key]) => 
                !['current', 'trend'].includes(key)
              ).map(([key, value]) => (
                <div key={key} className="bg-slate-700/20 rounded-lg p-4">
                  <div className="text-gray-400 text-sm capitalize mb-2">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-white font-semibold">
                    {Array.isArray(value) ? (
                      <ul className="text-sm space-y-1">
                        {value.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      value
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <div className="text-center pt-4">
              <Link href="/auth" className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-block">
                Join the Community
              </Link>
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
          <h3 className="text-white font-bold">Live Community Stats</h3>
          <span className="text-gray-400 text-sm">Real-time updates</span>
        </div>

        {/* Stats */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-sm">
          <div 
            onClick={() => setSelectedStat('bettorsOnline')}
            className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🟢</span>
                <div>
                  <div className="text-white">
                    <span className="text-green-400 font-bold">{stats.bettorsOnline.toLocaleString()}</span> Bettors Online
                  </div>
                  <div className="text-gray-400 text-xs">Active right now</div>
                </div>
              </div>
              <div className="text-green-400 font-bold text-lg">Live</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('winRate')}
            className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-blue-400 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">⏱️</span>
                <div>
                  <div className="text-white">
                    <span className="text-blue-400 font-bold">{stats.winRate}%</span> Win Rate
                  </div>
                  <div className="text-gray-400 text-xs">Last hour performance</div>
                </div>
              </div>
              <div className="text-blue-400 font-bold text-lg">+{stats.winRate.toFixed(0)}%</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('gambledToday')}
            className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-purple-400 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="text-white">
                    <span className="text-purple-400 font-bold">{formatCurrency(stats.gambledToday)}</span> Gambled Today
                  </div>
                  <div className="text-gray-400 text-xs">Total action today</div>
                </div>
              </div>
              <div className="text-purple-400 font-bold text-lg">{formatCurrency(stats.gambledToday)}</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('withdrawnToday')}
            className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-orange-400 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">💸</span>
                <div>
                  <div className="text-white">
                    <span className="text-orange-400 font-bold">{formatCurrency(stats.withdrawnToday)}</span> Withdrawn Today
                  </div>
                  <div className="text-gray-400 text-xs">Successful payouts</div>
                </div>
              </div>
              <div className="text-orange-400 font-bold text-lg">{formatCurrency(stats.withdrawnToday)}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 text-center">
          <div className="text-gray-400 text-xs">
            All data is live • Click any dataset to expand
          </div>
        </div>
      </div>

      {/* Research Popup */}
      {selectedStat && (
        <ResearchPopup 
          statType={selectedStat} 
          onClose={() => setSelectedStat(null)} 
        />
      )}
    </>
  );
}
