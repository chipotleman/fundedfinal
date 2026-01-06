import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    pendingBets: 0,
    activeChallenges: 0,
    pendingWithdrawals: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin-panel/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.recentActivity) {
          setRecentActivity(data.recentActivity);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Total Users', 
      value: stats.totalUsers, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-cyan-500',
      bgGlow: 'bg-blue-500/20',
    },
    { 
      label: 'Total Bets', 
      value: stats.totalBets, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      gradient: 'from-purple-500 to-pink-500',
      bgGlow: 'bg-purple-500/20',
    },
    { 
      label: 'Pending Bets', 
      value: stats.pendingBets, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-yellow-500 to-orange-500',
      bgGlow: 'bg-yellow-500/20',
    },
    { 
      label: 'Active Challenges', 
      value: stats.activeChallenges, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-500',
      bgGlow: 'bg-green-500/20',
    },
  ];


  return (
    <AdminLayout title="Dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Welcome back! Here's an overview of your platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="glass-card p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
          >
            <div className={`absolute -top-10 -right-10 w-32 h-32 ${stat.bgGlow} rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.gradient} text-white`}>
                  {stat.icon}
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <div className="text-3xl font-bold text-white">
                {loading ? (
                  <div className="animate-pulse bg-white/10 h-9 w-20 rounded-lg"></div>
                ) : (
                  stat.value.toLocaleString()
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">System Status</h2>
            <div className="p-2 rounded-lg bg-green-500/20">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <span className="text-gray-300">Database</span>
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium">Online</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-gray-300">API Status</span>
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium">Healthy</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-gray-300">Sports Data Feed</span>
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium">Connected</span>
              </div>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
}
