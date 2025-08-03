
import React, { useState } from 'react';

export default function AnalyticsDashboard({ userStats }) {
  const [timeframe, setTimeframe] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('profit');

  // Mock analytics data
  const analyticsData = {
    profit: {
      '7d': [120, -45, 78, 156, -23, 89, 234],
      '30d': [1200, 890, 1456, 1123, 1789, 1345, 1567, 1234, 1456, 1789],
      '90d': [3400, 3789, 4123, 3567, 4234, 4567, 3890, 4123, 4456, 4789]
    },
    winRate: {
      '7d': [65, 70, 68, 72, 69, 74, 71],
      '30d': [68, 71, 69, 73, 70, 72, 74, 71, 69, 72],
      '90d': [70, 72, 71, 74, 72, 73, 71, 70, 72, 74]
    },
    volume: {
      '7d': [850, 920, 780, 1100, 650, 890, 1200],
      '30d': [12000, 10500, 11200, 13400, 9800, 11600, 12800, 10900, 11400, 12200],
      '90d': [35000, 38000, 32000, 41000, 29000, 36000, 39000, 33000, 37000, 40000]
    }
  };

  const metrics = [
    { key: 'profit', label: 'Profit/Loss', icon: '💰', color: 'green' },
    { key: 'winRate', label: 'Win Rate', icon: '📈', color: 'blue' },
    { key: 'volume', label: 'Betting Volume', icon: '📊', color: 'purple' }
  ];

  const currentData = analyticsData[selectedMetric][timeframe];
  const latest = currentData[currentData.length - 1];
  const previous = currentData[currentData.length - 2];
  const change = ((latest - previous) / previous * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <div className="flex space-x-2">
          {['7d', '30d', '90d'].map(period => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeframe === period
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/50 text-gray-400 hover:text-white hover:bg-slate-600/50'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map(metric => {
          const data = analyticsData[metric.key][timeframe];
          const current = data[data.length - 1];
          const prev = data[data.length - 2];
          const metricChange = ((current - prev) / prev * 100).toFixed(1);
          const isPositive = metricChange >= 0;

          return (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`text-left p-6 rounded-2xl border transition-all ${
                selectedMetric === metric.key
                  ? `border-${metric.color}-500 bg-${metric.color}-500/10`
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{metric.icon}</span>
                <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                  isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {isPositive ? '+' : ''}{metricChange}%
                </div>
              </div>
              <h3 className="text-gray-400 text-sm mb-2">{metric.label}</h3>
              <div className="text-2xl font-bold text-white">
                {metric.key === 'profit' ? `$${current.toLocaleString()}` :
                 metric.key === 'winRate' ? `${current}%` :
                 `$${current.toLocaleString()}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart Visualization */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">
            {metrics.find(m => m.key === selectedMetric)?.label} Trend
          </h3>
        </div>

        {/* Simple Chart Visualization */}
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-between space-x-1">
            {currentData.map((value, index) => {
              const maxValue = Math.max(...currentData);
              const minValue = Math.min(...currentData);
              const range = maxValue - minValue;
              const normalizedHeight = range === 0 ? 50 : ((value - minValue) / range) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-400 mb-2">
                    {selectedMetric === 'profit' ? `$${value}` :
                     selectedMetric === 'winRate' ? `${value}%` :
                     `$${value.toLocaleString()}`}
                  </div>
                  <div
                    className={`w-full bg-gradient-to-t ${
                      selectedMetric === 'profit' 
                        ? value >= 0 ? 'from-green-500 to-green-400' : 'from-red-500 to-red-400'
                        : 'from-blue-500 to-blue-400'
                    } rounded-t-sm transition-all hover:opacity-80`}
                    style={{ height: `${Math.max(normalizedHeight, 5)}%` }}
                  ></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-gray-400 text-sm mb-1">Best Day</div>
          <div className="text-white font-bold">
            ${Math.max(...analyticsData.profit[timeframe]).toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-gray-400 text-sm mb-1">Worst Day</div>
          <div className="text-white font-bold">
            ${Math.min(...analyticsData.profit[timeframe]).toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-gray-400 text-sm mb-1">Avg Win Rate</div>
          <div className="text-white font-bold">
            {(analyticsData.winRate[timeframe].reduce((a, b) => a + b, 0) / analyticsData.winRate[timeframe].length).toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-gray-400 text-sm mb-1">Total Volume</div>
          <div className="text-white font-bold">
            ${analyticsData.volume[timeframe].reduce((a, b) => a + b, 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
