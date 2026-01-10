import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function MockUsersPage() {
  const [mockUsers, setMockUsers] = useState([]);
  const [mockUserUrls, setMockUserUrls] = useState('');
  const [creatingMockUsers, setCreatingMockUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    fetchMockUsers();
  }, []);

  const fetchMockUsers = async () => {
    try {
      const res = await fetch('/api/admin/mock-users', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMockUsers(data.mockUsers || []);
      }
    } catch (error) {
      console.error('Error fetching mock users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMockUsers = async () => {
    if (!mockUserUrls.trim()) return;
    setCreatingMockUsers(true);
    try {
      const avatarUrls = mockUserUrls.split('\n').map(u => u.trim()).filter(u => u);
      const res = await fetch('/api/admin/mock-users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ avatarUrls }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Created ${data.created.length} mock users!`);
        setMockUserUrls('');
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create mock users');
      }
    } catch (error) {
      console.error('Error creating mock users:', error);
    }
    setCreatingMockUsers(false);
  };

  const handleDeleteMockUser = async (userId) => {
    if (!confirm('Delete this mock user?')) return;
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      }
    } catch (error) {
      console.error('Error deleting mock user:', error);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Run cleanup to fix any data integrity issues with mock users?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Cleanup complete! Removed ${data.cleaned} invalid records, fixed ${data.fixed || 0} profiles.`);
        await fetchMockUsers();
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
    }
    setCleaningUp(false);
  };

  return (
    <AdminLayout title="Mock Users" requiredPermission="users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Mock Users</h1>
        <p className="text-gray-400">Create and manage fake opponent accounts for 1v1 matchmaking.</p>
      </div>

      <div className="glass-card p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Create Mock Users</h2>
        <p className="text-gray-400 text-sm mb-4">
          Paste profile picture URLs (one per line) to create mock users. Each URL creates one fake account with a random username and stats.
        </p>
        
        <textarea
          value={mockUserUrls}
          onChange={(e) => setMockUserUrls(e.target.value)}
          placeholder="https://example.com/profile1.png&#10;https://example.com/profile2.png&#10;(paste up to 50 URLs)"
          className="w-full min-h-[150px] bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y mb-4"
        />
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleCreateMockUsers}
            disabled={creatingMockUsers || !mockUserUrls.trim()}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingMockUsers ? 'Creating...' : 'Create Mock Users'}
          </button>
          <span className="text-gray-500 text-sm">
            {mockUserUrls.trim() ? `${mockUserUrls.split('\n').filter(u => u.trim()).length} URLs entered` : ''}
          </span>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Data Cleanup</h2>
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {cleaningUp ? 'Cleaning...' : 'Run Cleanup'}
          </button>
        </div>
        <p className="text-gray-400 text-sm">
          Removes orphaned or mismatched mock user records to ensure data integrity for matchmaking.
        </p>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Existing Mock Users ({mockUsers.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : mockUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No mock users yet. Create some above!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mockUsers.map((user) => (
              <div
                key={user.id}
                className="relative bg-white/5 border border-white/10 rounded-xl p-4 text-center group hover:border-purple-500/50 transition-colors"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 border-2 border-green-500">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="40">?</text></svg>'; }}
                  />
                </div>
                <p className="text-white text-sm font-medium truncate">{user.username}</p>
                <p className="text-gray-500 text-xs">
                  {user.battleWins || 0}W - {user.battleLosses || 0}L
                </p>
                <button
                  onClick={() => handleDeleteMockUser(user.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
