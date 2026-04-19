import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../../components/UserAvatar';

const DURATION_OPTIONS = [
  { value: '30_min', label: '30 Minutes' },
  { value: '1_hour', label: '1 Hour' },
  { value: '3_hours', label: '3 Hours' },
  { value: '1_day', label: '1 Day' },
  { value: '3_days', label: '3 Days' },
  { value: '1_week', label: '1 Week' },
];

export default function AdminMatchups() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('matchups');
  const [matchups, setMatchups] = useState([]);
  const [fakeOpponents, setFakeOpponents] = useState([]);
  const [battleInvites, setBattleInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [fakeBets, setFakeBets] = useState([]);
  const [usersWithChallenges, setUsersWithChallenges] = useState([]);
  const [resetLoading, setResetLoading] = useState(null);

  const [newOpponent, setNewOpponent] = useState({
    username: '',
    displayName: '',
    avatar: '',
    bio: '',
    winRate: '52.5',
    totalBattles: 25,
  });

  const [newBet, setNewBet] = useState({
    matchupName: '',
    marketType: 'moneyline',
    selection: '',
    odds: '-110',
    stake: '',
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      fetchData();
    } else {
      const checkToken = setInterval(() => {
        const t = localStorage.getItem('admin_token');
        if (t) {
          clearInterval(checkToken);
          fetchData();
        }
      }, 100);
      return () => clearInterval(checkToken);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [matchupsRes, opponentsRes, challengesRes, invitesRes] = await Promise.all([
        fetch('/api/admin-panel/matchups', { headers }),
        fetch('/api/admin-panel/matchups/fake-opponents', { headers }),
        fetch('/api/admin/reset-user-challenge', { headers }),
        fetch('/api/admin-panel/matchups/invites', { headers }),
      ]);

      if (matchupsRes.ok) {
        const data = await matchupsRes.json();
        setMatchups(data);
      }

      if (opponentsRes.ok) {
        const data = await opponentsRes.json();
        setFakeOpponents(data);
      }

      if (challengesRes.ok) {
        const data = await challengesRes.json();
        setUsersWithChallenges(data.users || []);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setBattleInvites(data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAction = async (userId, action, matchupId = null, poolId = null) => {
    setResetLoading(`${userId}-${action}`);
    try {
      const res = await fetch('/api/admin/reset-user-challenge', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, action, matchupId, poolId }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to perform action');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to perform action');
    }
    setResetLoading(null);
  };

  const fetchBetsForMatchup = async (matchupId) => {
    try {
      const response = await fetch(`/api/admin-panel/matchups/fake-bets?matchupId=${matchupId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFakeBets(data);
      }
    } catch (error) {
      console.error('Fetch bets error:', error);
    }
  };

  const createFakeOpponent = async () => {
    try {
      const response = await fetch('/api/admin-panel/matchups/fake-opponents', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newOpponent),
      });

      if (response.ok) {
        setShowOpponentModal(false);
        setNewOpponent({
          username: '',
          displayName: '',
          avatar: '',
          bio: '',
          winRate: '52.5',
          totalBattles: 25,
        });
        fetchData();
      }
    } catch (error) {
      console.error('Create opponent error:', error);
    }
  };

  const toggleOpponentActive = async (opponent) => {
    try {
      await fetch('/api/admin-panel/matchups/fake-opponents', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: opponent.id, isActive: !opponent.isActive }),
      });
      fetchData();
    } catch (error) {
      console.error('Toggle opponent error:', error);
    }
  };

  const setupCredentials = async (opponent) => {
    try {
      const response = await fetch('/api/admin-panel/matchups/setup-credentials', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fakeOpponentId: opponent.id }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Credentials created!\n\nEmail: ${data.email}\nPassword: ${data.plainPassword}\n\nSave this password - it will only be shown once!`);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to set up credentials');
      }
    } catch (error) {
      console.error('Setup credentials error:', error);
      alert('Failed to set up credentials');
    }
  };

  const deleteOpponent = async (id) => {
    if (!confirm('Delete this fake opponent?')) return;
    try {
      await fetch('/api/admin-panel/matchups/fake-opponents', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch (error) {
      console.error('Delete opponent error:', error);
    }
  };

  const placeFakeBet = async () => {
    if (!selectedMatchup) return;
    try {
      const response = await fetch('/api/admin-panel/matchups/fake-bets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          matchupId: selectedMatchup.id,
          ...newBet,
        }),
      });

      if (response.ok) {
        setNewBet({
          matchupName: '',
          marketType: 'moneyline',
          selection: '',
          odds: '-110',
          stake: '',
        });
        fetchBetsForMatchup(selectedMatchup.id);
      }
    } catch (error) {
      console.error('Place bet error:', error);
    }
  };

  const updateBetStatus = async (betId, status) => {
    try {
      await fetch('/api/admin-panel/matchups/fake-bets', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: betId, status }),
      });
      if (selectedMatchup) {
        fetchBetsForMatchup(selectedMatchup.id);
      }
    } catch (error) {
      console.error('Update bet error:', error);
    }
  };

  const deleteFakeBet = async (id) => {
    try {
      await fetch('/api/admin-panel/matchups/fake-bets', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      if (selectedMatchup) {
        fetchBetsForMatchup(selectedMatchup.id);
      }
    } catch (error) {
      console.error('Delete bet error:', error);
    }
  };

  const openBetModal = (matchup) => {
    setSelectedMatchup(matchup);
    fetchBetsForMatchup(matchup.id);
    setShowBetModal(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'waiting': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const handleInviteAction = async (inviteId, action) => {
    try {
      await fetch('/api/admin-panel/matchups/invites', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: inviteId, action }),
      });
      fetchData();
    } catch (error) {
      console.error('Invite action error:', error);
    }
  };

  const getInviteStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'accepted': return 'bg-green-500';
      case 'declined': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      case 'expired': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getMatchTypeColor = (type) => {
    switch (type) {
      case 'friend': return 'bg-emerald-600';
      case 'private': return 'bg-orange-600';
      case 'random': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const [impersonating, setImpersonating] = useState(null);

  const handlePlayAs = async (matchup) => {
    const fakeOpponent = fakeOpponents.find(fo => fo.id === matchup.fakeOpponentId);
    if (!fakeOpponent?.hasCredentials) {
      alert('This fake opponent does not have login credentials. Please set up credentials first.');
      return;
    }
    setImpersonating(matchup.id);
    try {
      const response = await fetch('/api/admin-panel/battles/impersonate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fakeOpponentId: matchup.fakeOpponentId,
          matchupId: matchup.id,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to impersonate');
        return;
      }
      const { loginUrl } = await response.json();
      window.open(loginUrl, '_blank', 'width=1200,height=800');
    } catch (error) {
      console.error('Impersonate error:', error);
      alert('Failed to start impersonation');
    } finally {
      setImpersonating(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Matchups & Battles" requiredPermission="matchups">
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Matchups & Battles" requiredPermission="matchups">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Matchups & Battles</h1>
        <p className="text-gray-400 mt-1">Manage battles and fake opponents</p>
      </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('matchups')}
            className={`px-4 py-2 rounded ${activeTab === 'matchups' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Active Matchups
          </button>
          <button
            onClick={() => setActiveTab('opponents')}
            className={`px-4 py-2 rounded ${activeTab === 'opponents' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Fake Opponents
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-4 py-2 rounded ${activeTab === 'invites' ? 'bg-emerald-600' : 'bg-gray-700'}`}
          >
            Battle Invites
            {battleInvites.filter(i => i.status === 'pending').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-black text-xs rounded-full font-bold">
                {battleInvites.filter(i => i.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reset')}
            className={`px-4 py-2 rounded ${activeTab === 'reset' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Reset User Challenges
          </button>
        </div>

        {activeTab === 'matchups' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Challenge</th>
                    <th className="p-3">User 1</th>
                    <th className="p-3">User 2</th>
                    <th className="p-3">Balance 1</th>
                    <th className="p-3">Balance 2</th>
                    <th className="p-3">Prize Pool</th>
                    <th className="p-3">Ends At</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchups.map((matchup) => (
                    <tr key={matchup.id} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(matchup.status)}`}>
                          {matchup.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${getMatchTypeColor(matchup.matchType)}`}>
                          {matchup.matchType || 'random'}
                        </span>
                      </td>
                      <td className="p-3 capitalize">{matchup.challengeType}</td>
                      <td className="p-3">{matchup.user1Info?.username || 'Unknown'}</td>
                      <td className="p-3">
                        {matchup.user2Info?.username || 'Waiting...'}
                        {matchup.isFakeOpponent && (
                          <span className="ml-2 text-xs text-yellow-500">(BOT)</span>
                        )}
                      </td>
                      <td className="p-3">${formatMoney(matchup.user1Balance || 0, 0)}</td>
                      <td className="p-3">${formatMoney(matchup.user2Balance || 0, 0)}</td>
                      <td className="p-3 text-green-400">${formatMoney(parseFloat(matchup.winnerPayout || 0), 0)}</td>
                      <td className="p-3">{formatDate(matchup.endsAt)}</td>
                      <td className="p-3 space-x-2">
                        {matchup.isFakeOpponent && matchup.status === 'active' && (
                          <>
                            <button
                              onClick={() => openBetModal(matchup)}
                              className="px-3 py-1 bg-purple-600 rounded text-sm hover:bg-purple-500"
                            >
                              Manage Bets
                            </button>
                            <button
                              onClick={() => handlePlayAs(matchup)}
                              disabled={impersonating === matchup.id}
                              className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-500 disabled:opacity-50"
                            >
                              {impersonating === matchup.id ? 'Opening...' : 'Play As'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {matchups.length === 0 && (
                    <tr>
                      <td colSpan="10" className="p-6 text-center text-gray-500">
                        No matchups found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'opponents' && (
          <div>
            <button
              onClick={() => setShowOpponentModal(true)}
              className="mb-4 px-4 py-2 bg-green-600 rounded hover:bg-green-500"
            >
              + Add Fake Opponent
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fakeOpponents.map((opponent) => (
                <div key={opponent.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <UserAvatar
                      user={{ id: opponent.id, username: opponent.displayName || opponent.username, avatar: opponent.avatar }}
                      size={48}
                    />
                    <div>
                      <p className="font-semibold">{opponent.displayName}</p>
                      <p className="text-gray-400 text-sm">@{opponent.username}</p>
                    </div>
                    <span className={`ml-auto px-2 py-1 rounded text-xs ${opponent.isActive ? 'bg-green-500' : 'bg-red-500'}`}>
                      {opponent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{opponent.bio || 'No bio'}</p>
                  <div className="flex gap-4 text-sm text-gray-400 mb-3">
                    <span>Win Rate: {opponent.winRate}%</span>
                    <span>Battles: {opponent.totalBattles}</span>
                  </div>
                  <div className="mb-2">
                    {opponent.hasCredentials ? (
                      <span className="text-xs text-green-400">Login credentials set up</span>
                    ) : (
                      <span className="text-xs text-orange-400">No login credentials</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!opponent.hasCredentials && (
                      <button
                        onClick={() => setupCredentials(opponent)}
                        className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-500"
                      >
                        Setup Credentials
                      </button>
                    )}
                    <button
                      onClick={() => toggleOpponentActive(opponent)}
                      className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600"
                    >
                      {opponent.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteOpponent(opponent.id)}
                      className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {fakeOpponents.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-8">
                  No fake opponents created. Add one to start matching with users.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Sender</th>
                    <th className="p-3">Receiver</th>
                    <th className="p-3">Buy-In</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {battleInvites.map((invite) => (
                    <tr key={invite.id} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${getInviteStatusColor(invite.status)}`}>
                          {invite.status}
                        </span>
                      </td>
                      <td className="p-3">{invite.sender?.username || 'Unknown'}</td>
                      <td className="p-3">{invite.receiver?.username || 'Unknown'}</td>
                      <td className="p-3">${formatMoney(invite.buyIn || 0, 0)}</td>
                      <td className="p-3">{invite.duration}h</td>
                      <td className="p-3">{formatDate(invite.createdAt)}</td>
                      <td className="p-3">
                        {invite.expiresAt && new Date(invite.expiresAt) < new Date() ? (
                          <span className="text-red-400 text-sm">Expired</span>
                        ) : (
                          formatDate(invite.expiresAt)
                        )}
                      </td>
                      <td className="p-3 space-x-2">
                        {invite.status === 'pending' && (
                          <button
                            onClick={() => handleInviteAction(invite.id, 'cancel')}
                            className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-500"
                          >
                            Cancel
                          </button>
                        )}
                        {invite.status !== 'pending' && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this invite permanently?')) {
                                handleInviteAction(invite.id, 'delete');
                              }
                            }}
                            className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-500"
                          >
                            Delete
                          </button>
                        )}
                        {invite.matchupId && (
                          <span className="text-xs text-blue-400">Matchup: {invite.matchupId.slice(0, 8)}...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {battleInvites.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-6 text-center text-gray-500">
                        No battle invites found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reset' && (
          <div>
            <p className="text-gray-400 mb-4">
              Reset users from 1v1 matchups, queues, or pools for testing purposes. Only users with active challenges are shown.
            </p>

            {usersWithChallenges.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-500">No users are currently in active challenges or pools.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {usersWithChallenges.map((user) => (
                  <div key={user.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start flex-wrap gap-4 mb-3">
                      <div>
                        <h3 className="text-white font-semibold">{user.username || 'No username'}</h3>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                        <p className="text-gray-600 text-xs">ID: {user.id}</p>
                      </div>
                      <button
                        onClick={() => handleResetAction(user.id, 'reset_all')}
                        disabled={resetLoading === `${user.id}-reset_all`}
                        className="px-4 py-2 bg-red-600 rounded text-sm hover:bg-red-500 disabled:opacity-50"
                      >
                        {resetLoading === `${user.id}-reset_all` ? 'Resetting...' : 'Reset All'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {user.queueEntry && (
                        <div className="flex justify-between items-center p-3 bg-blue-900/30 rounded">
                          <div>
                            <span className="text-blue-400 font-semibold">In Queue</span>
                            <span className="text-gray-400 ml-2 text-sm">
                              {user.queueEntry.challengeType?.toUpperCase()} - {user.queueEntry.durationType}
                            </span>
                          </div>
                          <button
                            onClick={() => handleResetAction(user.id, 'leave_queue')}
                            disabled={resetLoading === `${user.id}-leave_queue`}
                            className="px-3 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-500 disabled:opacity-50"
                          >
                            {resetLoading === `${user.id}-leave_queue` ? '...' : 'Remove from Queue'}
                          </button>
                        </div>
                      )}

                      {user.matchup && (
                        <div className="flex justify-between items-center p-3 bg-purple-900/30 rounded">
                          <div>
                            <span className="text-purple-400 font-semibold">1v1 Matchup</span>
                            <span className="text-gray-400 ml-2 text-sm">
                              Status: {user.matchup.status} | {user.matchup.challengeType?.toUpperCase()}
                            </span>
                            <span className="text-gray-500 ml-2 text-xs">
                              Balance: ${user.matchup.user1Id === user.id 
                                ? parseFloat(user.matchup.user1Balance || 0).toFixed(2)
                                : parseFloat(user.matchup.user2Balance || 0).toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleResetAction(user.id, 'cancel_matchup', user.matchup.id)}
                            disabled={resetLoading === `${user.id}-cancel_matchup`}
                            className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-500 disabled:opacity-50"
                          >
                            {resetLoading === `${user.id}-cancel_matchup` ? '...' : 'Cancel Matchup'}
                          </button>
                        </div>
                      )}

                      {user.pool && (
                        <div className="flex justify-between items-center p-3 bg-green-900/30 rounded">
                          <div>
                            <span className="text-green-400 font-semibold">Pik Pool</span>
                            <span className="text-gray-400 ml-2 text-sm">
                              {user.pool.name} | Status: {user.pool.status}
                            </span>
                            <span className="text-gray-500 ml-2 text-xs">
                              Balance: ${formatMoney(user.poolParticipant?.balance || 0)} | 
                              Players: {user.pool.currentPlayers}/{user.pool.maxPlayers}
                            </span>
                          </div>
                          <button
                            onClick={() => handleResetAction(user.id, 'leave_pool', null, user.pool.id)}
                            disabled={resetLoading === `${user.id}-leave_pool`}
                            className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-500 disabled:opacity-50"
                          >
                            {resetLoading === `${user.id}-leave_pool` ? '...' : 'Remove from Pool'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Quick Actions Guide</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li><span className="text-yellow-400">Remove from Queue</span> - User was waiting for 1v1 match, puts them back to pre-challenge state</li>
                <li><span className="text-red-400">Cancel Matchup</span> - Ends an active or pending 1v1 battle</li>
                <li><span className="text-green-400">Remove from Pool</span> - Takes user out of a Pik Pool competition</li>
                <li><span className="text-red-400">Reset All</span> - Clears all challenges for that user at once</li>
              </ul>
            </div>
          </div>
        )}

        {showOpponentModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create Fake Opponent</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={newOpponent.username}
                    onChange={(e) => setNewOpponent({ ...newOpponent, username: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    placeholder="e.g., sharp_bettor_22"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newOpponent.displayName}
                    onChange={(e) => setNewOpponent({ ...newOpponent, displayName: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    placeholder="e.g., Marcus Sharp"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Avatar URL (optional)</label>
                  <input
                    type="text"
                    value={newOpponent.avatar}
                    onChange={(e) => setNewOpponent({ ...newOpponent, avatar: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bio (optional)</label>
                  <textarea
                    value={newOpponent.bio}
                    onChange={(e) => setNewOpponent({ ...newOpponent, bio: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    rows="2"
                    placeholder="Sharp bettor specializing in NBA..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Win Rate %</label>
                    <input
                      type="number"
                      value={newOpponent.winRate}
                      onChange={(e) => setNewOpponent({ ...newOpponent, winRate: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Total Battles</label>
                    <input
                      type="number"
                      value={newOpponent.totalBattles}
                      onChange={(e) => setNewOpponent({ ...newOpponent, totalBattles: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowOpponentModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={createFakeOpponent}
                  className="flex-1 px-4 py-2 bg-green-600 rounded hover:bg-green-500"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showBetModal && selectedMatchup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Manage Bets for {selectedMatchup.user2Info?.username || 'Opponent'}
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                vs {selectedMatchup.user1Info?.username} | Prize Pool: ${formatMoney(parseFloat(selectedMatchup.winnerPayout || 0), 0)}
              </p>

              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Place New Bet</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Game/Matchup</label>
                    <input
                      type="text"
                      value={newBet.matchupName}
                      onChange={(e) => setNewBet({ ...newBet, matchupName: e.target.value })}
                      className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                      placeholder="Lakers @ Celtics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Market Type</label>
                    <select
                      value={newBet.marketType}
                      onChange={(e) => setNewBet({ ...newBet, marketType: e.target.value })}
                      className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                    >
                      <option value="moneyline">Moneyline</option>
                      <option value="spread">Spread</option>
                      <option value="total">Total</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Selection</label>
                    <input
                      type="text"
                      value={newBet.selection}
                      onChange={(e) => setNewBet({ ...newBet, selection: e.target.value })}
                      className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                      placeholder="Lakers -3.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Odds</label>
                    <input
                      type="text"
                      value={newBet.odds}
                      onChange={(e) => setNewBet({ ...newBet, odds: e.target.value })}
                      className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                      placeholder="-110"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Stake</label>
                    <input
                      type="number"
                      value={newBet.stake}
                      onChange={(e) => setNewBet({ ...newBet, stake: e.target.value })}
                      className="w-full p-2 bg-gray-600 rounded border border-gray-500"
                      placeholder="500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={placeFakeBet}
                      className="w-full p-2 bg-blue-600 rounded hover:bg-blue-500"
                    >
                      Place Bet
                    </button>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold mb-3">Current Bets</h3>
              <div className="space-y-2">
                {fakeBets.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                    <div>
                      <p className="font-medium">{bet.selection}</p>
                      <p className="text-sm text-gray-400">{bet.matchupName} | {bet.marketType}</p>
                    </div>
                    <div className="text-right">
                      <p>${formatMoney(parseFloat(bet.stake || 0), 0)} @ {bet.odds}</p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => updateBetStatus(bet.id, 'won')}
                          className={`px-2 py-0.5 rounded text-xs ${bet.status === 'won' ? 'bg-green-600' : 'bg-gray-600 hover:bg-green-600'}`}
                        >
                          Won
                        </button>
                        <button
                          onClick={() => updateBetStatus(bet.id, 'lost')}
                          className={`px-2 py-0.5 rounded text-xs ${bet.status === 'lost' ? 'bg-red-600' : 'bg-gray-600 hover:bg-red-600'}`}
                        >
                          Lost
                        </button>
                        <button
                          onClick={() => deleteFakeBet(bet.id)}
                          className="px-2 py-0.5 rounded text-xs bg-gray-600 hover:bg-red-800"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {fakeBets.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No bets placed yet</p>
                )}
              </div>

              <button
                onClick={() => {
                  setShowBetModal(false);
                  setSelectedMatchup(null);
                  setFakeBets([]);
                }}
                className="w-full mt-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
    </AdminLayout>
  );
}
