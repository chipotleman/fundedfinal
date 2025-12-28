import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, failed: 0 });

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/admin-panel/challenges');
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
        setStats(data.stats || { total: 0, active: 0, completed: 0, failed: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChallenges = challenges.filter(c => {
    const matchesSearch = (c.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesTier = tierFilter === 'all' || c.tier === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'phase1': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'phase2': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'reward': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'starter': return 'from-blue-500 to-cyan-500';
      case 'pro': return 'from-purple-500 to-pink-500';
      case 'elite': return 'from-yellow-500 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const statCards = [
    { label: 'Total Challenges', value: stats.total, color: 'from-blue-500 to-cyan-500', glow: 'bg-blue-500/20' },
    { label: 'Active', value: stats.active, color: 'from-green-500 to-emerald-500', glow: 'bg-green-500/20' },
    { label: 'Completed', value: stats.completed, color: 'from-purple-500 to-pink-500', glow: 'bg-purple-500/20' },
    { label: 'Failed', value: stats.failed, color: 'from-red-500 to-orange-500', glow: 'bg-red-500/20' },
  ];

  return (
    <AdminLayout title="Challenges" requiredPermission="challenges">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Challenge Management</h1>
        <p className="text-gray-400">View and manage all user challenges</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className="glass-card p-5 relative overflow-hidden">
            <div className={`absolute -top-8 -right-8 w-24 h-24 ${stat.glow} rounded-full blur-2xl`}></div>
            <div className="relative">
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
            <option value="all">All Status</option>
            <option value="phase1">Phase 1</option>
            <option value="phase2">Phase 2</option>
            <option value="reward">Reward</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
            <option value="all">All Tiers</option>
            <option value="starter">Starter ($5K)</option>
            <option value="pro">Pro ($10K)</option>
            <option value="elite">Elite ($25K)</option>
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading challenges...</p>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <p className="text-gray-500">No challenges found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Bankroll</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">P/L</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Picks</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredChallenges.map((challenge) => (
                  <tr key={challenge.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {(challenge.userName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{challenge.userName || 'Unknown'}</p>
                          <p className="text-gray-500 text-sm">{challenge.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r ${getTierColor(challenge.tier)}`}>
                        {(challenge.tier || 'unknown').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(challenge.status)}`}>
                        {challenge.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white font-medium">${(challenge.bankroll || 0).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span className={(challenge.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {(challenge.profitLoss || 0) >= 0 ? '+' : ''}${(challenge.profitLoss || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-300">{challenge.picksCount || 0}</td>
                    <td className="px-4 py-4 text-gray-400 text-sm">{challenge.startedAt ? new Date(challenge.startedAt).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
