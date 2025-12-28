import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

const statusConfig = {
  under_review: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Under Review' },
  awaiting_processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Processing' },
  finalized: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Completed' },
  denied: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Denied' },
};

const methodLabels = {
  bank_transfer: 'Bank Transfer (ACH)', instant_transfer: 'Instant Transfer', venmo: 'Venmo', wire: 'Wire Transfer', check: 'Check',
};

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { fetchWithdrawals(); }, []);

  const fetchWithdrawals = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/withdrawals', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setWithdrawals(data); }
    } catch (error) { console.error('Failed to fetch withdrawals:', error); }
    finally { setLoading(false); }
  };

  const filteredWithdrawals = withdrawals.filter(w => filterStatus === 'all' || w.status === filterStatus);

  const openActionModal = (withdrawal, action) => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
    setDenialReason(''); setAdminNotes(''); setMessage('');
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!selectedWithdrawal) return;
    setProcessing(true); setMessage('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selectedWithdrawal.id, action: actionType, denialReason: actionType === 'deny' ? denialReason : undefined, adminNotes }),
      });
      if (res.ok) {
        setMessage('Withdrawal updated successfully');
        fetchWithdrawals();
        setTimeout(() => { setShowActionModal(false); setSelectedWithdrawal(null); }, 1000);
      } else { const data = await res.json(); setMessage(data.message || 'Failed to update withdrawal'); }
    } catch (error) { setMessage('An error occurred'); }
    finally { setProcessing(false); }
  };

  const getActionButtons = (withdrawal) => {
    switch (withdrawal.status) {
      case 'under_review':
        return (<>
          <button onClick={() => openActionModal(withdrawal, 'approve')} className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors border border-green-500/30">Approve</button>
          <button onClick={() => openActionModal(withdrawal, 'deny')} className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30">Deny</button>
        </>);
      case 'awaiting_processing':
        return (<>
          <button onClick={() => openActionModal(withdrawal, 'process')} className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/30">Complete</button>
          <button onClick={() => openActionModal(withdrawal, 'deny')} className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30">Deny</button>
        </>);
      default: return null;
    }
  };

  const pendingCount = withdrawals.filter(w => w.status === 'under_review').length;
  const processingCount = withdrawals.filter(w => w.status === 'awaiting_processing').length;
  const totalPending = withdrawals.filter(w => w.status === 'under_review' || w.status === 'awaiting_processing').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

  return (
    <AdminLayout title="Withdrawals" requiredPermission="withdrawals">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Withdrawal Management</h1>
        <p className="text-gray-400">Review and process user withdrawal requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-yellow-500/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white w-fit mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
          </div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white w-fit mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Processing</p>
            <p className="text-2xl font-bold text-blue-400">{processingCount}</p>
          </div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-green-500/20 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white w-fit mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Pending</p>
            <p className="text-2xl font-bold text-white">${totalPending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-3">
          <span className="text-gray-400 text-sm">Filter:</span>
          <div className="flex flex-wrap gap-2">
            {['all', 'under_review', 'awaiting_processing', 'finalized', 'denied'].map((status) => (
              <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === status ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div></div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center"><svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-gray-500">No withdrawals found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Method</th>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWithdrawals.map((withdrawal) => {
                  const status = statusConfig[withdrawal.status] || statusConfig.under_review;
                  return (
                    <tr key={withdrawal.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium">{withdrawal.userEmail?.charAt(0).toUpperCase()}</div>
                          <div><p className="text-white font-medium">{withdrawal.userEmail}</p><p className="text-gray-500 text-xs">{withdrawal.userId?.slice(0, 8)}...</p></div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-white font-bold">${parseFloat(withdrawal.amount).toLocaleString()}</p>
                        {parseFloat(withdrawal.fee) > 0 && <p className="text-gray-500 text-xs">Fee: ${parseFloat(withdrawal.fee).toFixed(2)}</p>}
                      </td>
                      <td className="py-4 px-4 text-gray-300">{methodLabels[withdrawal.methodType] || withdrawal.methodType}</td>
                      <td className="py-4 px-4"><span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>{status.label}</span></td>
                      <td className="py-4 px-4"><p className="text-gray-300">{new Date(withdrawal.createdAt).toLocaleDateString()}</p><p className="text-gray-500 text-xs">{new Date(withdrawal.createdAt).toLocaleTimeString()}</p></td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getActionButtons(withdrawal)}
                          <button onClick={() => { setSelectedWithdrawal(withdrawal); }} className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">View</button>
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

      {showActionModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              {actionType === 'approve' && 'Approve Withdrawal'}
              {actionType === 'process' && 'Complete Withdrawal'}
              {actionType === 'deny' && 'Deny Withdrawal'}
            </h2>
            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 text-sm">Amount</p>
              <p className="text-2xl font-bold text-white">${parseFloat(selectedWithdrawal.amount).toLocaleString()}</p>
              <p className="text-gray-400 text-sm mt-2">User: {selectedWithdrawal.userEmail}</p>
            </div>
            {actionType === 'deny' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Denial Reason</label>
                <textarea value={denialReason} onChange={(e) => setDenialReason(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" rows={3} placeholder="Enter reason for denial..." />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Admin Notes (Optional)</label>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" rows={2} placeholder="Internal notes..." />
            </div>
            {message && <div className={`mb-4 p-3 rounded-xl text-sm ${message.includes('success') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{message}</div>}
            <div className="flex gap-3">
              <button onClick={() => setShowActionModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10">Cancel</button>
              <button onClick={handleAction} disabled={processing || (actionType === 'deny' && !denialReason)} className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${actionType === 'deny' ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'}`}>
                {processing ? 'Processing...' : (actionType === 'approve' ? 'Approve' : actionType === 'process' ? 'Complete' : 'Deny')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWithdrawal && !showActionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Withdrawal Details</h2>
              <button onClick={() => setSelectedWithdrawal(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Amount</p><p className="text-xl font-bold text-white">${parseFloat(selectedWithdrawal.amount).toLocaleString()}</p></div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Net Amount</p><p className="text-xl font-bold text-white">${parseFloat(selectedWithdrawal.netAmount || selectedWithdrawal.amount).toLocaleString()}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Fee</p><p className="text-white">${parseFloat(selectedWithdrawal.fee || 0).toFixed(2)}</p></div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Method</p><p className="text-white">{methodLabels[selectedWithdrawal.methodType] || selectedWithdrawal.methodType}</p></div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">User</p><p className="text-white">{selectedWithdrawal.userEmail}</p></div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Status</p><span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium mt-1 ${statusConfig[selectedWithdrawal.status]?.bg} ${statusConfig[selectedWithdrawal.status]?.text} border ${statusConfig[selectedWithdrawal.status]?.border}`}>{statusConfig[selectedWithdrawal.status]?.label}</span></div>
              {selectedWithdrawal.denialReason && <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Denial Reason</p><p className="text-red-400">{selectedWithdrawal.denialReason}</p></div>}
              {selectedWithdrawal.adminNotes && <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Admin Notes</p><p className="text-gray-300">{selectedWithdrawal.adminNotes}</p></div>}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5"><p className="text-gray-500 text-xs uppercase">Submitted</p><p className="text-white">{new Date(selectedWithdrawal.createdAt).toLocaleString()}</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              {getActionButtons(selectedWithdrawal)}
              <button onClick={() => setSelectedWithdrawal(null)} className="px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors border border-white/10 ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
