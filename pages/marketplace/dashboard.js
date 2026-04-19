import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { formatMoney } from '../../utils/formatMoney';

const durationOptions = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'monthly', label: 'Monthly', days: 30 },
  { value: 'yearly', label: 'Yearly', days: 365 },
  { value: 'lifetime', label: 'Lifetime', days: 36500 },
];

export default function CapperDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    duration: 'monthly',
    price: '',
    features: [],
    includesDiscord: true,
  });
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboard();
    } else if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent('/marketplace/dashboard'));
    }
  }, [status]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/marketplace/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else if (res.status === 403) {
        router.push('/marketplace/become-capper');
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setProductForm(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index) => {
    setProductForm(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const durationDays = durationOptions.find(d => d.value === productForm.duration)?.days || 30;
    
    try {
      const res = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          durationDays,
        }),
      });

      if (res.ok) {
        setShowProductModal(false);
        setProductForm({
          name: '',
          description: '',
          duration: 'monthly',
          price: '',
          features: [],
          includesDiscord: true,
        });
        fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleProductStatus = async (productId, isActive) => {
    try {
      await fetch('/api/marketplace/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, isActive: !isActive }),
      });
      fetchDashboard();
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { capper, products, stats, recentSubscriptions, reviews } = dashboard;

  return (
    <>
      <Head>
        <title>Seller Dashboard | Piks</title>
      </Head>

      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold">
                {capper.avatarUrl ? (
                  <img src={capper.avatarUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  capper.displayName[0].toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{capper.displayName}</h1>
                  {capper.isVerified && (
                    <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  )}
                </div>
                <Link href={`/marketplace/${capper.slug}`} className="text-gray-400 hover:text-purple-400 text-sm">
                  View public profile →
                </Link>
              </div>
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:opacity-90 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Product
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="text-gray-400 text-sm mb-1">Active Subscribers</div>
              <div className="text-3xl font-bold text-white">{stats.totalSubscribers}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="text-gray-400 text-sm mb-1">Monthly Revenue</div>
              <div className="text-3xl font-bold text-green-400">${formatMoney(stats.monthlyRevenue, 0)}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="text-gray-400 text-sm mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-white">${formatMoney(stats.totalRevenue, 0)}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="text-gray-400 text-sm mb-1">Avg Rating</div>
              <div className="text-3xl font-bold text-yellow-400">{parseFloat(stats.averageRating).toFixed(1)} ★</div>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b border-white/10">
            {['overview', 'products', 'subscribers', 'reviews'].map(tab => (
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

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Performance Stats</h2>
                {dashboard.performance ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="text-2xl font-bold text-green-400">{parseFloat(stats.winRate).toFixed(1)}%</div>
                      <div className="text-gray-400 text-sm">Win Rate</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className={`text-2xl font-bold ${parseFloat(stats.roi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(stats.roi) >= 0 ? '+' : ''}{parseFloat(stats.roi).toFixed(1)}%
                      </div>
                      <div className="text-gray-400 text-sm">ROI</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No performance data yet. Place bets to build your stats.</p>
                )}
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Recent Subscribers</h2>
                {recentSubscriptions.length > 0 ? (
                  <div className="space-y-3">
                    {recentSubscriptions.slice(0, 5).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <div className="font-medium">New subscriber</div>
                          <div className="text-gray-400 text-sm">{new Date(sub.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-green-400 font-bold">+${formatMoney(sub.amountPaid, 0)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No subscribers yet. Share your profile to get started!</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <div key={product.id} className={`bg-white/5 backdrop-blur-xl border rounded-2xl p-6 ${product.isActive ? 'border-white/10' : 'border-red-500/30 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{product.name}</h3>
                      <div className="text-gray-400 text-sm">{product.duration} access</div>
                    </div>
                    <div className="text-2xl font-bold">${formatMoney(product.price, 0)}</div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{product.description || 'No description'}</p>
                  
                  {product.features && product.features.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {product.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <span className="text-gray-400 text-sm">{product.totalSales || 0} sales</span>
                    <button
                      onClick={() => toggleProductStatus(product.id, product.isActive)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        product.isActive
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {product.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}

              {products.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-400 mb-4">No products yet. Create your first product to start selling!</p>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold"
                  >
                    Create Product
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subscribers' && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              {recentSubscriptions.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Subscriber</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentSubscriptions.map(sub => (
                      <tr key={sub.id} className="hover:bg-white/5">
                        <td className="px-4 py-4 text-white">User #{sub.buyerId.slice(-6)}</td>
                        <td className="px-4 py-4 text-gray-300">{products.find(p => p.id === sub.productId)?.name || 'Unknown'}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>{sub.status}</span>
                        </td>
                        <td className="px-4 py-4 text-green-400 font-medium">${formatMoney(sub.amountPaid, 0)}</td>
                        <td className="px-4 py-4 text-gray-400">{new Date(sub.expiresAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-400">No subscribers yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map(review => (
                  <div key={review.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center font-medium">
                          U
                        </div>
                        <div>
                          <div className="font-medium">User #{review.buyerId.slice(-6)}</div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          review.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          review.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{review.status}</span>
                        <span className="text-gray-500 text-sm">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {review.title && <h4 className="font-medium mb-2">{review.title}</h4>}
                    <p className="text-gray-300">{review.comment}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {showProductModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Create Product</h2>
                  <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Product Name *</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="e.g. Monthly All-Access Pass"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="What's included in this product..."
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Duration *</label>
                      <select
                        value={productForm.duration}
                        onChange={(e) => setProductForm({ ...productForm, duration: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        {durationOptions.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Price ($) *</label>
                      <input
                        type="number"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="29.99"
                        required
                        min="1"
                        step="0.01"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Features</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                        placeholder="Add a feature..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                      <button
                        type="button"
                        onClick={addFeature}
                        className="px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {productForm.features.map((feature, i) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 rounded-lg text-sm">
                          {feature}
                          <button type="button" onClick={() => removeFeature(i)} className="text-gray-400 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.includesDiscord}
                      onChange={(e) => setProductForm({ ...productForm, includesDiscord: e.target.checked })}
                      className="w-5 h-5 rounded bg-white/5 border-white/10 text-purple-500"
                    />
                    <span className="text-gray-300">Includes Discord access</span>
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !productForm.name || !productForm.price}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 rounded-xl font-bold transition-all"
                  >
                    {saving ? 'Creating...' : 'Create Product'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
