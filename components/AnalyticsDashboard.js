
import { useState, useEffect } from 'react';

export default function AnalyticsDashboard({ user }) {
  const [analyticsData, setAnalyticsData] = useState({
    profitByDay: [
      { day: 'Mon', profit: 150 },
      { day: 'Tue', profit: -75 },
      { day: 'Wed', profit: 200 },
      { day: 'Thu', profit: 100 },
      { day: 'Fri', profit: -50 },
      { day: 'Sat', profit: 300 },
      { day: 'Sun', profit: 125 }
    ],
    betTypePerformance: {
      spread: { wins: 12, losses: 8, profit: 450 },
      moneyline: { wins: 15, losses: 5, profit: 800 },
      total: { wins: 8, losses: 12, profit: -200 }
    },
    streaks: {
      currentWin: 3,
      longestWin: 7,
      currentLoss: 0,
      longestLoss: 4
    }
  });

  const maxProfit = Math.max(...analyticsData.profitByDay.map(d => d.profit));
  const minProfit = Math.min(...analyticsData.profitByDay.map(d => d.profit));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">ROI</p>
              <p className="text-2xl font-bold text-green-400">+15.2%</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Win Streak</p>
              <p className="text-2xl font-bold text-blue-400">{analyticsData.streaks.currentWin}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Avg Odds</p>
              <p className="text-2xl font-bold text-purple-400">-105</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Sharp Score</p>
              <p className="text-2xl font-bold text-yellow-400">8.7/10</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Daily P&L Chart */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">Daily Profit & Loss</h3>
        <div className="flex items-end space-x-2 h-40">
          {analyticsData.profitByDay.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full rounded-t-lg ${day.profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{
                  height: `${Math.abs(day.profit) / Math.max(Math.abs(maxProfit), Math.abs(minProfit)) * 120}px`,
                  minHeight: '4px'
                }}
              ></div>
              <div className="text-xs text-gray-400 mt-2">{day.day}</div>
              <div className={`text-xs font-medium ${day.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${day.profit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet Type Performance */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">Performance by Bet Type</h3>
        <div className="space-y-4">
          {Object.entries(analyticsData.betTypePerformance).map(([type, data]) => {
            const winRate = (data.wins / (data.wins + data.losses) * 100).toFixed(1);
            return (
              <div key={type} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div className="flex items-center space-x-4">
                  <div className="capitalize text-white font-medium">{type}</div>
                  <div className="text-sm text-gray-400">
                    {data.wins}W - {data.losses}L ({winRate}%)
                  </div>
                </div>
                <div className={`font-bold ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.profit >= 0 ? '+' : ''}${data.profit}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heat Map */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">Betting Heat Map</h3>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }, (_, i) => {
            const intensity = Math.random();
            return (
              <div
                key={i}
                className={`w-8 h-8 rounded ${
                  intensity > 0.7 ? 'bg-green-500' :
                  intensity > 0.4 ? 'bg-green-400' :
                  intensity > 0.2 ? 'bg-green-300' :
                  'bg-slate-700'
                }`}
                title={`Day ${i + 1}`}
              ></div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>Less</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-slate-700 rounded"></div>
            <div className="w-3 h-3 bg-green-300 rounded"></div>
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <div className="w-3 h-3 bg-green-500 rounded"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
