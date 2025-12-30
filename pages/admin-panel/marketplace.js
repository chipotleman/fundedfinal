import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminMarketplace() {
  const [cappers, setCappers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cappers');
  const [stats, setStats] = useState({ totalCappers: 0, totalRevenue: 0, activeSubscriptions: 0, pendingReviews: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin-panel/marketplace');
      if (res.ok) {
        const data = await res.json();
        setCappers(data.cappers || []);
        setSubscriptions(data.subscriptions || []);
        setReviews(data.reviews || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Failed to fetch marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCapperStatus = async (capperId, isActive) => {
    try {
      await fetch('/api/admin-panel/marketplace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_capper', capperId, isActive: !isActive }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update capper:', error);
    }
  };

  const moderateReview = async (reviewId, status) => {
    try {
      await fetch('/api/admin-panel/marketplace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moderate_review', reviewId, status }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to moderate review:', error);
    }
  };

  const statCards = [
    { label: 'Total Cappers', value: stats.totalCappers, color: 'from-purple-500 to-blue-500', glow: 'bg-purple-500/20' },
    { label: 'Total Revenue', value: `$${(stats.totalRevenue || 0).toLocaleString()}`, color: 'from-green-500 to-emerald-500', glow: 'bg-green-500/20' },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions, color: 'from-blue-500 to-cyan-500', glow: 'bg-blue-500/20' },
    { label: 'Pending Reviews', value: stats.pendingReviews, color: 'from-yellow-500 to-orange-500', glow: 'bg-yellow-500/20' },
  ];

  return (
    <AdminLayout title="Marketplace" requiredPermission="marketplace">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Marketplace Management</h1>
        <p className="text-gray-400">Manage cappers, subscriptions, and reviews</p>
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

      <div className="flex gap-2 mb-6 border-b border-white/10">
        {['cappers', 'subscriptions', 'reviews'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium capitalize transition-all ${
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      ) : (
        <>
          {activeTab === 'cappers' && (
            <div className="glass-card overflow-hidden">
              {cappers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No cappers registered yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Capper</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Subscribers</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Revenue</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Rating</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cappers.map(capper => (
                        <tr key={capper.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                                {capper.displayName[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{capper.displayName}</span>
                                  {capper.isVerified && (
                                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-gray-500 text-sm">@{capper.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-white">{capper.totalSubscribers || 0}</td>
                          <td className="px-4 py-4 text-green-400 font-medium">${parseFloat(capper.totalRevenue || 0).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className="text-yellow-400">{parseFloat(capper.averageRating || 0).toFixed(1)} ★</span>
                            <span className="text-gray-500 ml-1">({capper.totalReviews || 0})</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                              capper.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {capper.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleCapperStatus(capper.id, capper.isActive)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                capper.isActive
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                            >
                              {capper.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="glass-card overflow-hidden">
              {subscriptions.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No subscriptions yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Buyer</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Capper</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Amount</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Expires</th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {subscriptions.map(sub => (
                        <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4 text-white">#{sub.buyerId.slice(-6)}</td>
                          <td className="px-4 py-4 text-gray-300">{sub.capperName || sub.capperId.slice(-6)}</td>
                          <td className="px-4 py-4 text-green-400 font-medium">${parseFloat(sub.amountPaid).toFixed(0)}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                              sub.status === 'active' ? 'bg-green-500/20 text-green-400' :
                              sub.status === 'expired' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-400">{new Date(sub.expiresAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4 text-gray-400">{new Date(sub.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="glass-card p-12 text-center text-gray-500">No reviews yet</div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="glass-card p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white font-medium">User #{review.buyerId.slice(-6)}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-gray-300">{review.capperName || 'Capper'}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                          ))}
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                            review.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            review.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {review.status}
                          </span>
                        </div>
                        {review.title && <h4 className="font-medium text-white mb-1">{review.title}</h4>}
                        <p className="text-gray-400">{review.comment}</p>
                      </div>
                      {review.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => moderateReview(review.id, 'approved')}
                            className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => moderateReview(review.id, 'rejected')}
                            className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
