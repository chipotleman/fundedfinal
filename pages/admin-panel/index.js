import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    pendingBets: 0,
    activeChallenges: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin-panel/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'bg-blue-600' },
    { label: 'Total Bets', value: stats.totalBets, icon: '🎲', color: 'bg-purple-600' },
    { label: 'Pending Bets', value: stats.pendingBets, icon: '⏳', color: 'bg-yellow-600' },
    { label: 'Active Challenges', value: stats.activeChallenges, icon: '🏆', color: 'bg-green-600' },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome to the Piks admin panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{stat.icon}</span>
              <span className={`${stat.color} px-3 py-1 rounded-full text-xs font-medium`}>
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <div className="animate-pulse bg-gray-700 h-8 w-16 rounded"></div>
              ) : (
                stat.value.toLocaleString()
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span>👥</span>
              <span>Manage Users</span>
            </a>
            <a
              href="/admin/bets"
              className="flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span>🎲</span>
              <span>View & Edit Bets</span>
            </a>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Database</span>
              <span className="flex items-center gap-2 text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">API Status</span>
              <span className="flex items-center gap-2 text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
