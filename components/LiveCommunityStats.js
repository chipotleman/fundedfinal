
import { useState, useEffect } from 'react';

export default function LiveCommunityStats() {
  const [stats, setStats] = useState({
    bettorsOnline: 1247,
    winRate: 72.3,
    gambledToday: 0,
    withdrawnToday: 0
  });

  const [selectedStat, setSelectedStat] = useState(null);

  useEffect(() => {
    const getCurrentDayKey = () => {
      const now = new Date();
      return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    };

    const initializeDailyStats = () => {
      const today = getCurrentDayKey();
      const storedDay = localStorage.getItem('statsDay');
      
      if (storedDay !== today) {
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

    const interval = setInterval(() => {
      const now = Date.now();
      const gambledPerSecond = 7000 / (40 * 60);
      const withdrawnPerSecond = 470 / (40 * 60);
      
      const gambledElapsed = (now - dailyStats.gambledStartTime) / 1000;
      const withdrawnElapsed = (now - dailyStats.withdrawnStartTime) / 1000;
      
      const newGambledToday = dailyStats.gambledToday + (gambledElapsed * gambledPerSecond);
      const newWithdrawnToday = dailyStats.withdrawnToday + (withdrawnElapsed * withdrawnPerSecond);
      
      localStorage.setItem('gambledToday', newGambledToday.toString());
      localStorage.setItem('withdrawnToday', newWithdrawnToday.toString());
      
      setStats(prev => ({
        ...prev,
        bettorsOnline: Math.floor(1200 + Math.random() * 100),
        winRate: parseFloat((70 + Math.random() * 5).toFixed(1)),
        gambledToday: newGambledToday,
        withdrawnToday: newWithdrawnToday
      }));
    }, 1000);

    const withdrawnInterval = setInterval(() => {
      const variation = (Math.random() - 0.5) * 100;
      setStats(prev => ({
        ...prev,
        withdrawnToday: prev.withdrawnToday + variation
      }));
    }, (1 + Math.random() * 2) * 60 * 1000);

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
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#0a0a0a] rounded-2xl border border-gray-800/50 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
          <div className="p-4 border-b border-gray-800/50 flex items-center justify-between sticky top-0 bg-[#0a0a0a] rounded-t-2xl">
            <h3 className="text-lg font-bold text-white truncate pr-2">{statDetails.title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-[#1a1a1a] hover:bg-[#252525] rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-[#111111] rounded-xl p-4 text-center border border-gray-800/50">
              <div className="text-2xl font-bold text-green-400 mb-1">{statDetails.data.current}</div>
              <div className="text-gray-400 text-sm">Current Value</div>
              <div className="text-xs text-green-400 mt-1">{statDetails.data.trend}</div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(statDetails.data).filter(([key]) => 
                !['current', 'trend'].includes(key)
              ).map(([key, value]) => (
                <div key={key} className="bg-[#111111] rounded-lg p-3 border border-gray-800/50">
                  <div className="text-gray-500 text-xs font-medium capitalize mb-2">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-white font-semibold text-sm">
                    {Array.isArray(value) ? (
                      <ul className="text-xs space-y-1">
                        {value.map((item, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-green-500 mr-2">•</span>
                            <span className="text-gray-300">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-300">{value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 inline-block text-sm shadow-lg hover:shadow-xl"
              >
                Join the Community
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-[#0a0a0a] rounded-2xl border border-gray-800/50 h-96 flex flex-col">
        <div className="p-4 border-b border-gray-800/50 flex items-center space-x-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="text-white font-bold">Live Community Stats</h3>
          <span className="text-gray-500 text-sm">Real-time updates</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-sm">
          <div 
            onClick={() => setSelectedStat('bettorsOnline')}
            className="bg-[#111111] hover:bg-[#1a1a1a] rounded-lg p-3 border-l-4 border-green-500 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] border-t border-r border-b border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🟢</span>
                <div>
                  <div className="text-white">
                    <span className="text-green-400 font-bold">{stats.bettorsOnline.toLocaleString()}</span> Bettors Online
                  </div>
                  <div className="text-gray-500 text-xs">Active right now</div>
                </div>
              </div>
              <div className="text-green-400 font-bold text-lg">Live</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('winRate')}
            className="bg-[#111111] hover:bg-[#1a1a1a] rounded-lg p-3 border-l-4 border-blue-500 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] border-t border-r border-b border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">⏱️</span>
                <div>
                  <div className="text-white">
                    <span className="text-blue-400 font-bold">{stats.winRate}%</span> Win Rate
                  </div>
                  <div className="text-gray-500 text-xs">Last hour performance</div>
                </div>
              </div>
              <div className="text-blue-400 font-bold text-lg">+{stats.winRate.toFixed(0)}%</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('gambledToday')}
            className="bg-[#111111] hover:bg-[#1a1a1a] rounded-lg p-3 border-l-4 border-purple-500 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] border-t border-r border-b border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="text-white">
                    <span className="text-purple-400 font-bold">{formatCurrency(stats.gambledToday)}</span> Gambled Today
                  </div>
                  <div className="text-gray-500 text-xs">Total action today</div>
                </div>
              </div>
              <div className="text-purple-400 font-bold text-lg">{formatCurrency(stats.gambledToday)}</div>
            </div>
          </div>

          <div 
            onClick={() => setSelectedStat('withdrawnToday')}
            className="bg-[#111111] hover:bg-[#1a1a1a] rounded-lg p-3 border-l-4 border-orange-500 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] border-t border-r border-b border-gray-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">💸</span>
                <div>
                  <div className="text-white">
                    <span className="text-orange-400 font-bold">{formatCurrency(stats.withdrawnToday)}</span> Withdrawn Today
                  </div>
                  <div className="text-gray-500 text-xs">Successful payouts</div>
                </div>
              </div>
              <div className="text-orange-400 font-bold text-lg">{formatCurrency(stats.withdrawnToday)}</div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-800/50 text-center">
          <div className="text-gray-500 text-xs">
            All data is live • Click any dataset to expand
          </div>
        </div>
      </div>

      {selectedStat && (
        <ResearchPopup 
          statType={selectedStat} 
          onClose={() => setSelectedStat(null)} 
        />
      )}
    </>
  );
}
