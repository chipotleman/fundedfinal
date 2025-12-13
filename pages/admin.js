import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftForm, setGiftForm] = useState({
    userId: '',
    challengeType: 'STARTER',
    challengeName: 'Starter Challenge',
    startingBalance: 5000,
    userSplit: 90
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchAnalytics();
      fetchUsers();
      fetchChallenges();
    }
  }, [session]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.status === 403) {
        setError('You do not have admin access');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchUsers = async (search = '') => {
    try {
      const res = await fetch(`/api/admin/users?search=${search}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/admin/challenges');
      if (!res.ok) return;
      const data = await res.json();
      setChallenges(data.challenges || []);
    } catch (err) {
      console.error('Error fetching challenges:', err);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    fetchUsers(e.target.value);
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchUsers(searchTerm);
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete their challenges.')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers(searchTerm);
        fetchChallenges();
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleUpdateChallenge = async (challengeId, updates) => {
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchChallenges();
        setSelectedChallenge(null);
      }
    } catch (err) {
      console.error('Error updating challenge:', err);
    }
  };

  const handleDeleteChallenge = async (challengeId) => {
    if (!confirm('Are you sure you want to delete this challenge?')) return;
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchChallenges();
        setSelectedChallenge(null);
      }
    } catch (err) {
      console.error('Error deleting challenge:', err);
    }
  };

  const handleGiftChallenge = async () => {
    try {
      const res = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(giftForm)
      });
      if (res.ok) {
        fetchChallenges();
        setShowGiftModal(false);
        setGiftForm({
          userId: '',
          challengeType: 'STARTER',
          challengeName: 'Starter Challenge',
          startingBalance: 5000,
          userSplit: 90
        });
      }
    } catch (err) {
      console.error('Error gifting challenge:', err);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - Piks</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          
          <div className="flex gap-4 mb-8 border-b border-gray-800 pb-4">
            {['overview', 'users', 'challenges'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg capitalize ${
                  activeTab === tab 
                    ? 'bg-white text-black' 
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && analytics && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Total Users" value={analytics.overview.totalUsers} />
                <StatCard title="Total Challenges" value={analytics.overview.totalChallenges} />
                <StatCard title="Active Challenges" value={analytics.overview.activeChallenges} />
                <StatCard title="Total Revenue" value={`$${analytics.overview.totalRevenue.toFixed(2)}`} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="New Users (30d)" value={analytics.last30Days.newUsers} />
                <StatCard title="New Challenges (30d)" value={analytics.last30Days.newChallenges} />
                <StatCard title="Revenue (30d)" value={`$${analytics.last30Days.revenue.toFixed(2)}`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-900 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Challenges by Tier</h3>
                  {analytics.challengesByTier.map(tier => (
                    <div key={tier.tier} className="flex justify-between py-2 border-b border-gray-800">
                      <span>{tier.tier || 'Unknown'}</span>
                      <span>{tier.active} active / {tier.total} total</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-gray-900 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Challenges by Status</h3>
                  {analytics.challengesByStatus.map(status => (
                    <div key={status.status} className="flex justify-between py-2 border-b border-gray-800">
                      <span className="capitalize">{status.status}</span>
                      <span>{status.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full md:w-96 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                />
              </div>
              
              <div className="bg-gray-900 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-t border-gray-800 hover:bg-gray-800">
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-sm ${
                            user.role === 'admin' ? 'bg-yellow-600' : 'bg-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1 bg-blue-600 rounded mr-2 hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setGiftForm(prev => ({ ...prev, userId: user.id }));
                              setShowGiftModal(true);
                            }}
                            className="px-3 py-1 bg-green-600 rounded mr-2 hover:bg-green-700"
                          >
                            Gift
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'challenges' && (
            <div>
              <div className="mb-6">
                <button
                  onClick={() => setShowGiftModal(true)}
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Gift New Challenge
                </button>
              </div>
              
              <div className="bg-gray-900 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Balance</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Phase</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challenges.map(challenge => (
                      <tr key={challenge.id} className="border-t border-gray-800 hover:bg-gray-800">
                        <td className="px-4 py-3">{challenge.userEmail || 'Unknown'}</td>
                        <td className="px-4 py-3">{challenge.challengeType}</td>
                        <td className="px-4 py-3">${parseFloat(challenge.currentBalance).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-sm ${
                            challenge.status === 'active' ? 'bg-green-600' :
                            challenge.status === 'completed' ? 'bg-blue-600' :
                            challenge.status === 'failed' ? 'bg-red-600' : 'bg-gray-600'
                          }`}>
                            {challenge.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{challenge.phase}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedChallenge(challenge)}
                            className="px-3 py-1 bg-blue-600 rounded mr-2 hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteChallenge(challenge.id)}
                            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {selectedUser && (
          <Modal onClose={() => setSelectedUser(null)} title="Edit User">
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Role</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={() => handleUpdateUser(selectedUser.id, { email: selectedUser.email, role: selectedUser.role })}
                className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </Modal>
        )}

        {selectedChallenge && (
          <Modal onClose={() => setSelectedChallenge(null)} title="Edit Challenge">
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Status</label>
                <select
                  value={selectedChallenge.status}
                  onChange={(e) => setSelectedChallenge({ ...selectedChallenge, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Phase</label>
                <select
                  value={selectedChallenge.phase}
                  onChange={(e) => setSelectedChallenge({ ...selectedChallenge, phase: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                >
                  <option value={1}>Phase 1</option>
                  <option value={2}>Phase 2</option>
                  <option value={3}>Reward Phase</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Current Balance</label>
                <input
                  type="number"
                  value={selectedChallenge.currentBalance}
                  onChange={(e) => setSelectedChallenge({ ...selectedChallenge, currentBalance: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                />
              </div>
              <button
                onClick={() => handleUpdateChallenge(selectedChallenge.id, {
                  status: selectedChallenge.status,
                  phase: selectedChallenge.phase,
                  currentBalance: selectedChallenge.currentBalance
                })}
                className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </Modal>
        )}

        {showGiftModal && (
          <Modal onClose={() => setShowGiftModal(false)} title="Gift Challenge">
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">User ID</label>
                <input
                  type="text"
                  value={giftForm.userId}
                  onChange={(e) => setGiftForm({ ...giftForm, userId: e.target.value })}
                  placeholder="Enter user ID"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Challenge Type</label>
                <select
                  value={giftForm.challengeType}
                  onChange={(e) => {
                    const type = e.target.value;
                    const configs = {
                      STARTER: { name: 'Starter Challenge', balance: 5000 },
                      PRO: { name: 'Pro Challenge', balance: 10000 },
                      ELITE: { name: 'Elite Challenge', balance: 25000 }
                    };
                    setGiftForm({
                      ...giftForm,
                      challengeType: type,
                      challengeName: configs[type].name,
                      startingBalance: configs[type].balance
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                >
                  <option value="STARTER">Starter ($5,000)</option>
                  <option value="PRO">Pro ($10,000)</option>
                  <option value="ELITE">Elite ($25,000)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">User Split (%)</label>
                <input
                  type="number"
                  value={giftForm.userSplit}
                  onChange={(e) => setGiftForm({ ...giftForm, userSplit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                />
              </div>
              <button
                onClick={handleGiftChallenge}
                disabled={!giftForm.userId}
                className="w-full py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                Gift Challenge
              </button>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="text-gray-400 text-sm mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
