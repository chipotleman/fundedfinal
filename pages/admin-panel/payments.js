import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, revenue: 0, pending: 0, refunded: 0 });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/admin-panel/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setStats(data.stats || { total: 0, revenue: 0, pending: 0, refunded: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.transactionId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'refunded': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const statCards = [
    { label: 'Total Payments', value: stats.total, color: 'from-blue-500 to-cyan-500', glow: 'bg-blue-500/20', prefix: '' },
    { label: 'Total Revenue', value: stats.revenue, color: 'from-green-500 to-emerald-500', glow: 'bg-green-500/20', prefix: '$' },
    { label: 'Pending', value: stats.pending, color: 'from-yellow-500 to-orange-500', glow: 'bg-yellow-500/20', prefix: '' },
    { label: 'Refunded', value: stats.refunded, color: 'from-red-500 to-pink-500', glow: 'bg-red-500/20', prefix: '$' },
  ];

  return (
    <AdminLayout title="Payments" requiredPermission="payments">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Payment History</h1>
        <p className="text-gray-400">View all payment transactions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className="glass-card p-5 relative overflow-hidden">
            <div className={`absolute -top-8 -right-8 w-24 h-24 ${stat.glow} rounded-full blur-2xl`}></div>
            <div className="relative">
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.prefix}{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by user or transaction ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading payments...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-gray-500">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-medium text-sm">
                          {(payment.userName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{payment.userName || 'Unknown'}</p>
                          <p className="text-gray-500 text-sm">{payment.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white font-bold text-lg">${(payment.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-gray-300">{payment.product || 'Challenge'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(payment.status)}`}>
                        {payment.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-400 font-mono text-xs">{payment.transactionId || '-'}</td>
                    <td className="px-4 py-4 text-gray-400 text-sm">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}</td>
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
