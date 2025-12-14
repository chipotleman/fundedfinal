import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingBet, setEditingBet] = useState(null);
  const [editForm, setEditForm] = useState({ odds: '', status: '' });

  useEffect(() => {
    fetchBets();
  }, []);

  const fetchBets = async () => {
    try {
      const res = await fetch('/api/admin-panel/bets');
      if (res.ok) {
        const data = await res.json();
        setBets(data.bets);
      }
    } catch (error) {
      console.error('Failed to fetch bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bet) => {
    setEditingBet(bet.id);
    setEditForm({ odds: bet.odds || '', status: bet.status || 'pending' });
  };

  const handleSave = async (betId) => {
    try {
      const res = await fetch('/api/admin-panel/bets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betId,
          odds: editForm.odds,
          status: editForm.status,
        }),
      });

      if (res.ok) {
        setBets(bets.map(bet =>
          bet.id === betId
            ? { ...bet, odds: editForm.odds, status: editForm.status }
            : bet
        ));
        setEditingBet(null);
      }
    } catch (error) {
      console.error('Failed to update bet:', error);
    }
  };

  const handleSettle = async (betId, result) => {
    const bet = bets.find(b => b.id === betId);
    if (!bet) return;

    const pnl = result === 'won'
      ? parseFloat(bet.potentialPayout) - parseFloat(bet.stake)
      : -parseFloat(bet.stake);

    try {
      const res = await fetch('/api/admin-panel/bets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId, status: result, pnl }),
      });

      if (res.ok) {
        fetchBets();
      }
    } catch (error) {
      console.error('Failed to settle bet:', error);
    }
  };

  const filteredBets = bets.filter(bet => {
    const matchesSearch =
      bet.matchupName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    pending: 'bg-yellow-600/20 text-yellow-400',
    won: 'bg-green-600/20 text-green-400',
    lost: 'bg-red-600/20 text-red-400',
    cancelled: 'bg-gray-600/20 text-gray-400',
  };

  return (
    <AdminLayout title="Bets">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Bet Management</h1>
        <p className="text-gray-400 mt-1">View and edit all user bets</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by matchup or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          </div>
        ) : filteredBets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchTerm || statusFilter !== 'all' ? 'No bets match your filters' : 'No bets found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">User</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Matchup</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Selection</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Odds</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Stake</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredBets.map((bet) => (
                  <tr key={bet.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-4 text-white text-sm">{bet.userEmail}</td>
                    <td className="px-4 py-4 text-white text-sm">{bet.matchupName}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{bet.selection}</td>
                    <td className="px-4 py-4 text-sm">
                      {editingBet === bet.id ? (
                        <input
                          type="text"
                          value={editForm.odds}
                          onChange={(e) => setEditForm({ ...editForm, odds: e.target.value })}
                          className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        />
                      ) : (
                        <span className="text-green-400">{bet.odds}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-white text-sm">${parseFloat(bet.stake || 0).toFixed(2)}</td>
                    <td className="px-4 py-4">
                      {editingBet === bet.id ? (
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="won">Won</option>
                          <option value="lost">Lost</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[bet.status] || statusColors.pending}`}>
                          {bet.status || 'pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {editingBet === bet.id ? (
                          <>
                            <button
                              onClick={() => handleSave(bet.id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingBet(null)}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(bet)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                            >
                              Edit
                            </button>
                            {bet.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleSettle(bet.id, 'won')}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                                >
                                  Win
                                </button>
                                <button
                                  onClick={() => handleSettle(bet.id, 'lost')}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                                >
                                  Lose
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
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
