import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

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
  const [loading, setLoading] = useState(true);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [fakeBets, setFakeBets] = useState([]);

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

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
      router.push('/admin-panel/login');
      return;
    }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matchupsRes, opponentsRes] = await Promise.all([
        fetch('/api/admin-panel/matchups'),
        fetch('/api/admin-panel/matchups/fake-opponents'),
      ]);

      if (matchupsRes.ok) {
        const data = await matchupsRes.json();
        setMatchups(data);
      }

      if (opponentsRes.ok) {
        const data = await opponentsRes.json();
        setFakeOpponents(data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBetsForMatchup = async (matchupId) => {
    try {
      const response = await fetch(`/api/admin-panel/matchups/fake-bets?matchupId=${matchupId}`);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Matchups & Battles</h1>
          <button
            onClick={() => router.push('/admin-panel')}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="flex gap-4 mb-6">
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
        </div>

        {activeTab === 'matchups' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="p-3">Status</th>
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
                      <td className="p-3 capitalize">{matchup.challengeType}</td>
                      <td className="p-3">{matchup.user1Info?.username || 'Unknown'}</td>
                      <td className="p-3">
                        {matchup.user2Info?.username || 'Waiting...'}
                        {matchup.isFakeOpponent && (
                          <span className="ml-2 text-xs text-yellow-500">(BOT)</span>
                        )}
                      </td>
                      <td className="p-3">${parseFloat(matchup.user1Balance || 0).toLocaleString()}</td>
                      <td className="p-3">${parseFloat(matchup.user2Balance || 0).toLocaleString()}</td>
                      <td className="p-3 text-green-400">${parseFloat(matchup.winnerPayout || 0).toLocaleString()}</td>
                      <td className="p-3">{formatDate(matchup.endsAt)}</td>
                      <td className="p-3">
                        {matchup.isFakeOpponent && matchup.status === 'active' && (
                          <button
                            onClick={() => openBetModal(matchup)}
                            className="px-3 py-1 bg-purple-600 rounded text-sm hover:bg-purple-500"
                          >
                            Manage Bets
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {matchups.length === 0 && (
                    <tr>
                      <td colSpan="9" className="p-6 text-center text-gray-500">
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
                    {opponent.avatar ? (
                      <img src={opponent.avatar} alt="" className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                        {opponent.displayName?.charAt(0)?.toUpperCase() || 'O'}
                      </div>
                    )}
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
                vs {selectedMatchup.user1Info?.username} | Prize Pool: ${parseFloat(selectedMatchup.winnerPayout || 0).toLocaleString()}
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
                      <p>${parseFloat(bet.stake).toLocaleString()} @ {bet.odds}</p>
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
      </div>
    </div>
  );
}
