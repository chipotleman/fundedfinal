import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../../components/UserAvatar';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingBet, setEditingBet] = useState(null);
  const [editForm, setEditForm] = useState({ odds: '', status: '' });

  useEffect(() => { fetchBets(); }, []);

  const fetchBets = async () => {
    try {
      const res = await fetch('/api/admin-panel/bets');
      if (res.ok) { const data = await res.json(); setBets(data.bets); }
    } catch (error) { console.error('Failed to fetch bets:', error); }
    finally { setLoading(false); }
  };

  const handleEdit = (bet) => {
    setEditingBet(bet.id);
    setEditForm({ odds: bet.odds || '', status: bet.status || 'pending' });
  };

  const handleSave = async (betId) => {
    try {
      const res = await fetch('/api/admin-panel/bets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId, odds: editForm.odds, status: editForm.status }),
      });
      if (res.ok) {
        setBets(bets.map(bet => bet.id === betId ? { ...bet, odds: editForm.odds, status: editForm.status } : bet));
        setEditingBet(null);
      }
    } catch (error) { console.error('Failed to update bet:', error); }
  };

  const handleSettle = async (betId, result) => {
    const bet = bets.find(b => b.id === betId);
    if (!bet) return;
    const pnl = result === 'won' ? parseFloat(bet.potentialPayout) - parseFloat(bet.stake) : -parseFloat(bet.stake);
    try {
      const res = await fetch('/api/admin-panel/bets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId, status: result, pnl }),
      });
      if (res.ok) { fetchBets(); }
    } catch (error) { console.error('Failed to settle bet:', error); }
  };

  const filteredBets = bets.filter(bet => {
    const matchesSearch = bet.matchupName?.toLowerCase().includes(searchTerm.toLowerCase()) || bet.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    won: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    lost: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
    push: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  };

  return (
    <AdminLayout title="Bets" requiredPermission="bets">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Bet Management</h1>
        <p className="text-gray-400">View and manage all user bets</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input type="text" placeholder="Search by matchup or user..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="push">Push</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div><p className="text-gray-400 mt-4">Loading bets...</p></div>
        ) : filteredBets.length === 0 ? (
          <div className="p-12 text-center"><svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg><p className="text-gray-400">{searchTerm || statusFilter !== 'all' ? 'No bets match your filters' : 'No bets found'}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Matchup</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Selection</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Odds</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Stake</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBets.map((bet) => {
                  const status = statusConfig[bet.status] || statusConfig.pending;
                  return (
                    <tr key={bet.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={{ id: bet.userId, username: bet.userEmail }} size={28} />
                          <span className="text-white text-sm">{bet.userEmail}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white text-sm">{bet.matchupName}</td>
                      <td className="px-4 py-4 text-gray-300 text-sm">{bet.selection}</td>
                      <td className="px-4 py-4">
                        {editingBet === bet.id ? (
                          <input type="text" value={editForm.odds} onChange={(e) => setEditForm({ ...editForm, odds: e.target.value })} className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                        ) : (
                          <span className="text-green-400 font-medium">{bet.odds}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-white font-medium text-sm">${formatMoney(bet.stake || 0)}</td>
                      <td className="px-4 py-4">
                        {editingBet === bet.id ? (
                          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-500/50">
                            <option value="pending">Pending</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="push">Push</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>{bet.status || 'pending'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {editingBet === bet.id ? (
                            <>
                              <button onClick={() => handleSave(bet.id)} className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors">Save</button>
                              <button onClick={() => setEditingBet(null)} className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEdit(bet)} className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">Edit</button>
                              {bet.status === 'pending' && (
                                <>
                                  <button onClick={() => handleSettle(bet.id, 'won')} className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors">Win</button>
                                  <button onClick={() => handleSettle(bet.id, 'lost')} className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">Lose</button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
