import { useState, useEffect, Fragment } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

const CHALLENGES = [
  { type: 'starter', name: 'Starter Challenge', balance: '$5,000', price: '$149' },
  { type: 'pro', name: 'Pro Challenge', balance: '$10,000', price: '$249' },
  { type: 'elite', name: 'Elite Challenge', balance: '$25,000', price: '$399' },
];


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
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeUserId, setChallengeUserId] = useState(null);
  const [challengeUserEmail, setChallengeUserEmail] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState('');
  const [challengeMessage, setChallengeMessage] = useState('');
  const [grantingChallenge, setGrantingChallenge] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityUserEmail, setActivityUserEmail] = useState('');
  const [activityTab, setActivityTab] = useState('timeline');
  const [selectedSplit, setSelectedSplit] = useState(90);

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

  const openChallengeModal = (userId, email, e) => {
    e.stopPropagation();
    setChallengeUserId(userId);
    setChallengeUserEmail(email);
    setSelectedChallenge('');
    setSelectedSplit(90);
    setChallengeMessage('');
    setShowChallengeModal(true);
  };

  const handleGrantChallenge = async () => {
    if (!selectedChallenge) {
      setChallengeMessage('Please select a challenge type');
      return;
    }

    setGrantingChallenge(true);
    setChallengeMessage('');

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/users/grant-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          userId: challengeUserId, 
          challengeType: selectedChallenge,
          userSplit: selectedSplit
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setChallengeMessage(data.message || 'Challenge granted successfully');
        fetchUsers();
        setTimeout(() => {
          setShowChallengeModal(false);
          setChallengeUserId(null);
          setChallengeUserEmail('');
          setSelectedChallenge('');
        }, 1500);
      } else {
        setChallengeMessage(data.error || 'Failed to grant challenge');
      }
    } catch (error) {
      setChallengeMessage('An error occurred');
    } finally {
      setGrantingChallenge(false);
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

  const [activityError, setActivityError] = useState('');

  const openActivityModal = async (userId, email, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('admin_token');
    if (!token) {
      return;
    }
    
    setActivityUserEmail(email);
    setActivityTab('timeline');
    setShowActivityModal(true);
    setActivityLoading(true);
    setActivityData(null);
    setActivityError('');

    try {
      const res = await fetch(`/api/admin-panel/user-activity?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setActivityData(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setActivityError(errData.error || 'Failed to fetch user activity');
      }
    } catch (error) {
      setActivityError('Network error. Please try again.');
    } finally {
      setActivityLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'bet': return '🎯';
      case 'event': return '📍';
      case 'pageView': return '👁️';
      default: return '•';
    }
  };

  const getEventTypeLabel = (eventType) => {
    const labels = {
      'bet_added': 'Added bet to slip',
      'bet_removed': 'Removed bet from slip',
      'bet_removed_toggle': 'Toggled bet off',
      'stake_updated': 'Updated stake amount',
      'click': 'Clicked element',
      'page_view': 'Viewed page',
    };
    return labels[eventType] || eventType;
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
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => openActivityModal(user.id, user.email, e)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Activity
                          </button>
                          <button
                            onClick={(e) => openChallengeModal(user.id, user.email, e)}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Grant Challenge
                          </button>
                          <button
                            onClick={(e) => openResetModal(user.id, e)}
                            className="text-yellow-400 hover:text-yellow-300 text-sm"
                          >
                            Reset Password
                          </button>
                        </div>
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

      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Grant Free Challenge</h2>
            <p className="text-gray-400 text-sm mb-4">User: {challengeUserEmail}</p>
            
            <div className="mb-4 space-y-3">
              {CHALLENGES.map((challenge) => (
                <label
                  key={challenge.type}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedChallenge === challenge.type
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="challenge"
                      value={challenge.type}
                      checked={selectedChallenge === challenge.type}
                      onChange={(e) => setSelectedChallenge(e.target.value)}
                      className="hidden"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedChallenge === challenge.type
                        ? 'border-green-500'
                        : 'border-gray-600'
                    }`}>
                      {selectedChallenge === challenge.type && (
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{challenge.name}</p>
                      <p className="text-gray-400 text-sm">{challenge.balance} balance</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm line-through">{challenge.price}</span>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Profit Split (User's Share)</label>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-green-400">{selectedSplit}%</span>
                  <span className="text-gray-400 text-sm">Piks: {100 - selectedSplit}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="1"
                  value={selectedSplit}
                  onChange={(e) => setSelectedSplit(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  style={{
                    background: `linear-gradient(to right, #22c55e 0%, #22c55e ${(selectedSplit - 50) * 2}%, #374151 ${(selectedSplit - 50) * 2}%, #374151 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                User receives {selectedSplit}% of profits, Piks keeps {100 - selectedSplit}%
              </p>
            </div>

            {challengeMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                challengeMessage.includes('success')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {challengeMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowChallengeModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                disabled={grantingChallenge}
              >
                Cancel
              </button>
              <button
                onClick={handleGrantChallenge}
                disabled={grantingChallenge || !selectedChallenge}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {grantingChallenge ? 'Granting...' : 'Grant Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">User Activity</h2>
                  <p className="text-gray-400 text-sm">{activityUserEmail}</p>
                </div>
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              {activityData && !activityLoading && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">{activityData.stats?.totalBets || 0}</p>
                    <p className="text-xs text-gray-400">Total Bets</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{activityData.stats?.wonBets || 0}</p>
                    <p className="text-xs text-gray-400">Won</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{activityData.stats?.lostBets || 0}</p>
                    <p className="text-xs text-gray-400">Lost</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{activityData.stats?.pendingBets || 0}</p>
                    <p className="text-xs text-gray-400">Pending</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4 flex-wrap">
                {['timeline', 'bets', 'demoBets', 'withdrawals', 'events', 'sessions'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivityTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activityTab === tab
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'bets' ? 'Real Bets' : tab === 'demoBets' ? 'Demo Bets' : tab === 'withdrawals' ? 'Withdrawals' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : activityError ? (
                <div className="text-center py-12">
                  <p className="text-red-400 mb-4">{activityError}</p>
                  <button
                    onClick={() => setShowActivityModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Close
                  </button>
                </div>
              ) : !activityData ? (
                <p className="text-center text-gray-400 py-12">No data available</p>
              ) : (
                <>
                  {activityTab === 'timeline' && (
                    <div className="space-y-3">
                      {activityData.timeline?.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No activity found</p>
                      ) : (
                        activityData.timeline?.map((item, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-gray-800/50 rounded-lg">
                            <span className="text-xl">{getTimelineIcon(item.type)}</span>
                            <div className="flex-1 min-w-0">
                              {item.type === 'bet' && (
                                <>
                                  <p className="text-white font-medium truncate">
                                    {item.data.selection} @ {item.data.odds}
                                  </p>
                                  <p className="text-gray-400 text-sm truncate">{item.data.matchupName}</p>
                                  <div className="flex gap-4 mt-1 text-xs">
                                    <span className="text-gray-500">Stake: ${item.data.stake != null ? item.data.stake : '-'}</span>
                                    {item.data.balanceBefore != null && item.data.balanceAfter != null && (
                                      <span className="text-gray-500">
                                        Balance: ${parseFloat(item.data.balanceBefore).toLocaleString()} → ${parseFloat(item.data.balanceAfter).toLocaleString()}
                                      </span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded ${
                                      item.data.status === 'won' ? 'bg-green-600/20 text-green-400' :
                                      item.data.status === 'lost' ? 'bg-red-600/20 text-red-400' :
                                      'bg-yellow-600/20 text-yellow-400'
                                    }`}>{item.data.status || 'pending'}</span>
                                  </div>
                                </>
                              )}
                              {item.type === 'event' && (
                                <>
                                  <p className="text-white font-medium">{getEventTypeLabel(item.data.eventType)}</p>
                                  <p className="text-gray-400 text-sm truncate">{item.data.pageUrl}</p>
                                  {item.data.eventData && (
                                    <p className="text-gray-500 text-xs mt-1 truncate">
                                      {typeof item.data.eventData === 'string' 
                                        ? item.data.eventData 
                                        : JSON.stringify(item.data.eventData).slice(0, 100)}
                                    </p>
                                  )}
                                </>
                              )}
                              {item.type === 'pageView' && (
                                <>
                                  <p className="text-white font-medium">{item.data.pageTitle || 'Page View'}</p>
                                  <p className="text-gray-400 text-sm truncate">{item.data.pageUrl}</p>
                                </>
                              )}
                            </div>
                            <span className="text-gray-500 text-xs whitespace-nowrap">
                              {formatDate(item.timestamp)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activityTab === 'bets' && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Selection</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Odds</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Stake</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Balance Before</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Balance After</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {activityData.bets?.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No real bets found</td>
                            </tr>
                          ) : (
                            activityData.bets?.map((bet) => (
                              <tr key={bet.id} className="hover:bg-gray-800/30">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-white text-sm">{bet.selection}</p>
                                    <p className="text-gray-500 text-xs truncate max-w-[200px]">{bet.matchupName}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-white text-sm">{bet.odds || '-'}</td>
                                <td className="px-4 py-3 text-white text-sm">{bet.stake != null ? `$${bet.stake}` : '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {bet.balanceBefore ? `$${parseFloat(bet.balanceBefore).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {bet.balanceAfter ? `$${parseFloat(bet.balanceAfter).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    bet.status === 'won' ? 'bg-green-600/20 text-green-400' :
                                    bet.status === 'lost' ? 'bg-red-600/20 text-red-400' :
                                    'bg-yellow-600/20 text-yellow-400'
                                  }`}>{bet.status}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(bet.createdAt)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activityTab === 'demoBets' && (
                    <div className="overflow-x-auto">
                      <div className="mb-3 px-2">
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Demo Mode - Practice Bets</span>
                      </div>
                      <table className="w-full">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Selection</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Odds</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Stake</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Potential Payout</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {activityData.demoBets?.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No demo bets found</td>
                            </tr>
                          ) : (
                            activityData.demoBets?.map((bet) => (
                              <tr key={bet.id} className="hover:bg-gray-800/30">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-white text-sm">{bet.selection}</p>
                                    <p className="text-gray-500 text-xs truncate max-w-[200px]">{bet.matchupName}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-white text-sm">{bet.odds || '-'}</td>
                                <td className="px-4 py-3 text-white text-sm">{bet.stake != null ? `$${bet.stake}` : '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {bet.potentialPayout != null ? `$${parseFloat(bet.potentialPayout).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    bet.status === 'won' ? 'bg-green-600/20 text-green-400' :
                                    bet.status === 'lost' ? 'bg-red-600/20 text-red-400' :
                                    'bg-yellow-600/20 text-yellow-400'
                                  }`}>{bet.status}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(bet.createdAt)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activityTab === 'events' && (
                    <div className="space-y-2">
                      {activityData.events?.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No events found</p>
                      ) : (
                        activityData.events?.map((event) => (
                          <div key={event.id} className="flex justify-between items-start p-3 bg-gray-800/50 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-medium">{getEventTypeLabel(event.eventType)}</p>
                              <p className="text-gray-400 text-sm truncate">{event.pageUrl}</p>
                              {event.eventData && (
                                <p className="text-gray-500 text-xs mt-1 truncate">
                                  {typeof event.eventData === 'string' 
                                    ? event.eventData 
                                    : JSON.stringify(event.eventData).slice(0, 150)}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-500 text-xs whitespace-nowrap ml-4">
                              {formatDate(event.createdAt)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activityTab === 'withdrawals' && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Method</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Fee</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Net</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {activityData.withdrawals?.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No withdrawals found</td>
                            </tr>
                          ) : (
                            activityData.withdrawals?.map((w) => (
                              <tr key={w.id} className="hover:bg-gray-800/30">
                                <td className="px-4 py-3 text-white text-sm font-medium">${parseFloat(w.amount || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-gray-400 text-sm capitalize">{w.methodType?.replace('_', ' ') || '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-sm">{w.fee ? `$${parseFloat(w.fee).toFixed(2)}` : 'Free'}</td>
                                <td className="px-4 py-3 text-green-400 text-sm">${parseFloat(w.netAmount || 0).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    w.status === 'finalized' ? 'bg-green-600/20 text-green-400' :
                                    w.status === 'denied' ? 'bg-red-600/20 text-red-400' :
                                    w.status === 'cancelled' ? 'bg-gray-600/20 text-gray-400' :
                                    w.status === 'awaiting_processing' ? 'bg-blue-600/20 text-blue-400' :
                                    'bg-yellow-600/20 text-yellow-400'
                                  }`}>
                                    {w.status === 'under_review' ? 'Under Review' :
                                     w.status === 'awaiting_processing' ? 'Processing' :
                                     w.status === 'finalized' ? 'Completed' :
                                     w.status?.charAt(0).toUpperCase() + w.status?.slice(1) || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(w.createdAt)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activityTab === 'sessions' && (
                    <div className="space-y-3">
                      {activityData.sessions?.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No sessions found</p>
                      ) : (
                        activityData.sessions?.map((session) => (
                          <div key={session.id} className="p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-white font-medium">Session</p>
                              <span className="text-gray-500 text-xs">{formatDate(session.startedAt)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">Duration:</span>
                                <span className="text-white ml-2">
                                  {session.duration ? `${Math.round(session.duration / 60)}m` : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Pages:</span>
                                <span className="text-white ml-2">{session.pagesViewed || 0}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Events:</span>
                                <span className="text-white ml-2">{session.eventsCount || 0}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
