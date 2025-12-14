import { useState, useEffect, Fragment } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin-panel/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleRowClick = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const openResetModal = (userId, e) => {
    e.stopPropagation();
    setResetUserId(userId);
    setNewPassword('');
    setResetMessage('');
    setShowResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setResetMessage('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: resetUserId, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setResetMessage('Password reset successfully');
        setTimeout(() => {
          setShowResetModal(false);
          setResetUserId(null);
          setNewPassword('');
        }, 1500);
      } else {
        setResetMessage(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setResetMessage('An error occurred');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) return;
    
    if (action === 'export') {
      const selectedData = users.filter(u => selectedUsers.includes(u.id));
      const csvContent = [
        ['ID', 'Email', 'Joined', 'Bankroll', 'Total Bets', 'P&L'].join(','),
        ...selectedData.map(u => [
          u.id,
          u.email,
          new Date(u.createdAt).toLocaleDateString(),
          u.profile?.bankroll || 0,
          u.profile?.totalBets || 0,
          u.profile?.pnl || 0
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  return (
    <AdminLayout title="Users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">View and manage all registered users</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
        />
        
        {selectedUsers.length > 0 && (
          <div className="flex gap-2">
            <span className="text-gray-400 py-2">
              {selectedUsers.length} selected
            </span>
            <button
              onClick={() => handleBulkAction('export')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Export CSV
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchTerm ? 'No users match your search' : 'No users found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Bankroll</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">P&L</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                    <tr 
                      className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(user.id)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="rounded bg-gray-700 border-gray-600"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{user.email}</span>
                          {expandedUser === user.id && (
                            <span className="text-xs text-green-400">▼</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-white">
                        ${parseFloat(user.profile?.bankroll || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={parseFloat(user.profile?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${parseFloat(user.profile?.pnl || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => openResetModal(user.id, e)}
                          className="text-yellow-400 hover:text-yellow-300 text-sm"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr key={`${user.id}-details`}>
                        <td colSpan={6} className="px-6 py-4 bg-gray-800/30">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">User ID</h4>
                              <p className="text-white text-sm font-mono break-all">{user.id}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Total Bets</h4>
                              <p className="text-white">{user.profile?.totalBets || 0}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Win Rate</h4>
                              <p className="text-white">{user.profile?.winRate || 0}%</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Challenge Phase</h4>
                              <p className="text-white">Phase {user.profile?.challengePhase || 1}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Status</h4>
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.profile?.status === 'active' 
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-gray-600/20 text-gray-400'
                              }`}>
                                {user.profile?.status || 'inactive'}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">Daily Loss</h4>
                              <p className="text-red-400">${parseFloat(user.profile?.dailyLoss || 0).toLocaleString()}</p>
                            </div>
                            {user.challenges?.length > 0 && (
                              <div className="md:col-span-3">
                                <h4 className="text-sm font-medium text-gray-400 mb-2">Challenges</h4>
                                <div className="flex flex-wrap gap-2">
                                  {user.challenges.map((challenge, idx) => (
                                    <div key={idx} className="bg-gray-800 rounded px-3 py-2 text-sm">
                                      <span className="text-white">{challenge.challengeName}</span>
                                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                        challenge.status === 'active' ? 'bg-green-600/20 text-green-400' :
                                        challenge.status === 'completed' ? 'bg-blue-600/20 text-blue-400' :
                                        'bg-gray-600/20 text-gray-400'
                                      }`}>
                                        {challenge.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Reset User Password</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
                placeholder="Enter new password (min 6 chars)"
                minLength={6}
              />
            </div>

            {resetMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                resetMessage.includes('success')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {resetMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
