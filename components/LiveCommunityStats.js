
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LiveCommunityStats() {
  const [stats, setStats] = useState({
    bettorsOnline: 1247,
    winRate: 72.3,
    gambledToday: 0,
    withdrawnToday: 0
  });

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

  return (
    <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 h-96 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <h3 className="text-white font-bold">Live Community Stats</h3>
        <span className="text-gray-400 text-sm">Real-time updates</span>
      </div>

      {/* Stats */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-sm">
        <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-green-400 transition-all duration-300">
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

        <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-blue-400 transition-all duration-300">
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

        <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-purple-400 transition-all duration-300">
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

        <div className="bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-3 border-l-4 border-orange-400 transition-all duration-300">
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

      
    </div>
  );
}
