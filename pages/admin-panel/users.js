import { useState, useEffect, Fragment } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import UserAvatar from '../../components/UserAvatar';

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
  const [activityError, setActivityError] = useState('');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchUser, setMatchUser] = useState(null);
  const [matchAmount, setMatchAmount] = useState('100');
  const [matchMessage, setMatchMessage] = useState('');
  const [matchSubmitting, setMatchSubmitting] = useState(false);

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
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: resetUserId, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setResetMessage('Password reset successfully');
        setTimeout(() => { setShowResetModal(false); setResetUserId(null); setNewPassword(''); }, 1500);
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: challengeUserId, challengeType: selectedChallenge, userSplit: selectedSplit }),
      });

      const data = await res.json();
      if (res.ok) {
        setChallengeMessage(data.message || 'Challenge granted successfully');
        fetchUsers();
        setTimeout(() => { setShowChallengeModal(false); setChallengeUserId(null); setChallengeUserEmail(''); setSelectedChallenge(''); }, 1500);
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
        ...selectedData.map(u => [u.id, u.email, new Date(u.createdAt).toLocaleDateString(), u.profile?.bankroll || 0, u.profile?.totalBets || 0, u.profile?.pnl || 0].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  const openMatchModal = (user, e) => {
    e.stopPropagation();
    setMatchUser(user);
    const existing = parseFloat(user.profile?.firstDepositMatchAmount || 0);
    setMatchAmount(existing > 0 ? existing.toString() : '100');
    setMatchMessage('');
    setShowMatchModal(true);
  };

  const handleGrantMatch = async () => {
    if (!matchUser) return;
    const amt = parseFloat(matchAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setMatchMessage('Enter an amount greater than $0');
      return;
    }
    if (amt > 100) {
      setMatchMessage('Amount cannot exceed $100');
      return;
    }
    setMatchSubmitting(true);
    setMatchMessage('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/users/first-deposit-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: matchUser.id, amount: amt }),
      });
      const data = await res.json();
      if (res.ok) {
        setMatchMessage(data.message || 'First-deposit match granted');
        await fetchUsers();
        setTimeout(() => { setShowMatchModal(false); setMatchUser(null); }, 1500);
      } else {
        setMatchMessage(data.error || 'Failed to grant match');
      }
    } catch (error) {
      setMatchMessage('An error occurred');
    } finally {
      setMatchSubmitting(false);
    }
  };

  const handleRevokeMatch = async () => {
    if (!matchUser) return;
    if (!confirm('Revoke this user\'s first-deposit match? Their balance will be debited by the same amount.')) {
      return;
    }
    setMatchSubmitting(true);
    setMatchMessage('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/users/first-deposit-match', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: matchUser.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMatchMessage(data.message || 'First-deposit match revoked');
        await fetchUsers();
        setTimeout(() => { setShowMatchModal(false); setMatchUser(null); }, 1500);
      } else {
        setMatchMessage(data.error || 'Failed to revoke match');
      }
    } catch (error) {
      setMatchMessage('An error occurred');
    } finally {
      setMatchSubmitting(false);
    }
  };

  const openActivityModal = async (userId, email, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    
    setActivityUserEmail(email);
    setActivityTab('timeline');
    setShowActivityModal(true);
    setActivityLoading(true);
    setActivityData(null);
    setActivityError('');

    try {
      const res = await fetch(`/api/admin-panel/user-activity?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  return (
    <AdminLayout title="Users" requiredPermission="users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400">View and manage all registered users</p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all duration-200"
          />
        </div>
        
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">
              {selectedUsers.length} selected
            </span>
            <button
              onClick={() => handleBulkAction('export')}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="relative w-12 h-12 mx-auto">
              <div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-400 mt-4">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-gray-400">{searchTerm ? 'No users match your search' : 'No users found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Bankroll</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">P&L</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                    <tr 
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(user.id)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            user={{ id: user.id, username: user.username || user.email, avatar: user.avatar }}
                            size={32}
                          />
                          <span className="text-white font-medium">{user.email}</span>
                          {expandedUser === user.id && (
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">
                        ${parseFloat(user.profile?.bankroll || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${parseFloat(user.profile?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {parseFloat(user.profile?.pnl || 0) >= 0 ? '+' : ''}${parseFloat(user.profile?.pnl || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => openActivityModal(user.id, user.email, e)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                          >
                            Activity
                          </button>
                          <button
                            onClick={(e) => openChallengeModal(user.id, user.email, e)}
                            className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                          >
                            Grant
                          </button>
                          <button
                            onClick={(e) => openMatchModal(user, e)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              user.profile?.firstDepositMatchGrantedAt
                                ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                : 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20'
                            }`}
                            title="First-deposit match"
                          >
                            {user.profile?.firstDepositMatchGrantedAt ? 'Match ✓' : 'Match'}
                          </button>
                          <button
                            onClick={(e) => openResetModal(user.id, e)}
                            className="px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr key={`${user.id}-details`}>
                        <td colSpan={6} className="px-6 py-6 bg-white/5">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Bets</p>
                              <p className="text-xl font-bold text-white">{user.profile?.totalBets || 0}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Win Rate</p>
                              <p className="text-xl font-bold text-white">{user.profile?.winRate || 0}%</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phase</p>
                              <p className="text-xl font-bold text-white">Phase {user.profile?.challengePhase || 1}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                              <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
                                user.profile?.status === 'active' 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              }`}>
                                {user.profile?.status || 'inactive'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">First-Deposit Match</p>
                                {user.profile?.firstDepositMatchGrantedAt ? (
                                  <div className="text-white">
                                    <p className="text-lg font-bold text-emerald-400">
                                      ${parseFloat(user.profile.firstDepositMatchAmount || 0).toFixed(2)} granted
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {formatDate(user.profile.firstDepositMatchGrantedAt)}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">Not granted</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => openMatchModal(user, e)}
                                className="px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                              >
                                {user.profile?.firstDepositMatchGrantedAt ? 'Manage' : 'Grant match'}
                              </button>
                            </div>
                          </div>
                          {user.challenges?.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Challenges</p>
                              <div className="flex flex-wrap gap-2">
                                {user.challenges.map((challenge, idx) => (
                                  <div key={idx} className="bg-white/5 rounded-lg px-3 py-2 text-sm border border-white/5">
                                    <span className="text-white">{challenge.challengeName}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                      challenge.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                      challenge.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      {challenge.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Reset User Password</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                placeholder="Enter new password (min 6 chars)"
                minLength={6}
              />
            </div>

            {resetMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
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
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-xl transition-all font-medium"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Grant Free Challenge</h2>
            <p className="text-gray-400 text-sm mb-4">User: {challengeUserEmail}</p>
            
            <div className="mb-4 space-y-3">
              {CHALLENGES.map((challenge) => (
                <label
                  key={challenge.type}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedChallenge === challenge.type
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input type="radio" name="challenge" value={challenge.type} checked={selectedChallenge === challenge.type} onChange={(e) => setSelectedChallenge(e.target.value)} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedChallenge === challenge.type ? 'border-purple-500' : 'border-gray-600'}`}>
                      {selectedChallenge === challenge.type && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
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
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-purple-400">{selectedSplit}%</span>
                  <span className="text-gray-400 text-sm">Piks: {100 - selectedSplit}%</span>
                </div>
                <input
                  type="range" min="50" max="100" step="1" value={selectedSplit}
                  onChange={(e) => setSelectedSplit(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>

            {challengeMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                challengeMessage.includes('success') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>{challengeMessage}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowChallengeModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10">Cancel</button>
              <button onClick={handleGrantChallenge} disabled={grantingChallenge} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl transition-all font-medium">
                {grantingChallenge ? 'Granting...' : 'Grant Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMatchModal && matchUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">First-Deposit Match</h2>
            <p className="text-gray-400 text-sm mb-4">User: {matchUser.email}</p>

            {matchUser.profile?.firstDepositMatchGrantedAt ? (
              <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <p className="text-xs text-emerald-300 uppercase tracking-wider mb-1">Currently granted</p>
                <p className="text-lg font-bold text-emerald-400">
                  ${parseFloat(matchUser.profile.firstDepositMatchAmount || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Granted {formatDate(matchUser.profile.firstDepositMatchGrantedAt)}
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  Revoking will debit the same amount from the user's most recent active challenge balance.
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Match amount (max $100)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">$</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    value={matchAmount}
                    onChange={(e) => setMatchAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Credits the user's most recent active challenge balance and marks the bonus as granted so it can't be auto-issued again.
                </p>
              </div>
            )}

            {matchMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                matchMessage.toLowerCase().includes('granted') || matchMessage.toLowerCase().includes('revoked')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>{matchMessage}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowMatchModal(false); setMatchUser(null); }}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10"
              >
                Close
              </button>
              {matchUser.profile?.firstDepositMatchGrantedAt ? (
                <button
                  onClick={handleRevokeMatch}
                  disabled={matchSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white rounded-xl transition-all font-medium"
                >
                  {matchSubmitting ? 'Revoking...' : 'Revoke match'}
                </button>
              ) : (
                <button
                  onClick={handleGrantMatch}
                  disabled={matchSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl transition-all font-medium"
                >
                  {matchSubmitting ? 'Granting...' : 'Grant match'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">User Activity</h2>
                <p className="text-gray-400 text-sm">{activityUserEmail}</p>
              </div>
              <button onClick={() => setShowActivityModal(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 mb-4 border-b border-white/10 pb-4">
              {['timeline', 'bets', 'withdrawals'].map(tab => (
                <button key={tab} onClick={() => setActivityTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activityTab === tab ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                </div>
              ) : activityError ? (
                <div className="text-center py-12">
                  <p className="text-red-400">{activityError}</p>
                </div>
              ) : activityData ? (
                <div className="space-y-3">
                  {activityTab === 'timeline' && activityData.timeline?.map((item, idx) => (
                    <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                          {item.type === 'bet' ? '🎯' : item.type === 'pageView' ? '👁️' : '📍'}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{item.description || item.eventType || 'Activity'}</p>
                          <p className="text-gray-500 text-xs mt-1">{formatDate(item.createdAt || item.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activityTab === 'bets' && activityData.bets?.map((bet, idx) => (
                    <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{bet.matchup}</p>
                          <p className="text-gray-400 text-sm">{bet.betType} @ {bet.odds}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${bet.status === 'won' ? 'bg-green-500/20 text-green-400' : bet.status === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{bet.status}</span>
                      </div>
                    </div>
                  ))}
                  {activityTab === 'withdrawals' && activityData.withdrawals?.map((w, idx) => (
                    <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">${parseFloat(w.amount).toLocaleString()}</p>
                          <p className="text-gray-400 text-sm">{w.paymentMethod} - {formatDate(w.createdAt)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${w.status === 'finalized' ? 'bg-green-500/20 text-green-400' : w.status === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{w.status}</span>
                      </div>
                    </div>
                  ))}
                  {((activityTab === 'timeline' && (!activityData.timeline || activityData.timeline.length === 0)) ||
                    (activityTab === 'bets' && (!activityData.bets || activityData.bets.length === 0)) ||
                    (activityTab === 'withdrawals' && (!activityData.withdrawals || activityData.withdrawals.length === 0))) && (
                    <div className="text-center py-8 text-gray-500">No {activityTab} found</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
