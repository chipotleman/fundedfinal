import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

const statusColors = {
  under_review: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
  awaiting_processing: 'bg-blue-400/10 text-blue-400 border-blue-400/30',
  finalized: 'bg-green-400/10 text-green-400 border-green-400/30',
  denied: 'bg-red-400/10 text-red-400 border-red-400/30',
};

const statusLabels = {
  under_review: 'Under Review',
  awaiting_processing: 'Processing',
  finalized: 'Completed',
  denied: 'Denied',
};

const methodLabels = {
  bank_transfer: 'Bank Transfer (ACH)',
  instant_transfer: 'Instant Transfer',
  venmo: 'Venmo',
  wire: 'Wire Transfer',
  check: 'Check',
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

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/withdrawals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    filterStatus === 'all' || w.status === filterStatus
  );

  const openActionModal = (withdrawal, action) => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
    setDenialReason('');
    setAdminNotes('');
    setMessage('');
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!selectedWithdrawal) return;
    setProcessing(true);
    setMessage('');

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/withdrawals', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedWithdrawal.id,
          action: actionType,
          denialReason: actionType === 'deny' ? denialReason : undefined,
          adminNotes,
        }),
      });

      if (res.ok) {
        setMessage('Withdrawal updated successfully');
        fetchWithdrawals();
        setTimeout(() => {
          setShowActionModal(false);
          setSelectedWithdrawal(null);
        }, 1000);
      } else {
        const data = await res.json();
        setMessage(data.message || 'Failed to update withdrawal');
      }
    } catch (error) {
      setMessage('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const getActionButtons = (withdrawal) => {
    switch (withdrawal.status) {
      case 'under_review':
        return (
          <>
            <button
              onClick={() => openActionModal(withdrawal, 'approve')}
              className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => openActionModal(withdrawal, 'deny')}
              className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
            >
              Deny
            </button>
          </>
        );
      case 'awaiting_processing':
        return (
          <>
            <button
              onClick={() => openActionModal(withdrawal, 'process')}
              className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/20 transition-colors"
            >
              Mark Complete
            </button>
            <button
              onClick={() => openActionModal(withdrawal, 'deny')}
              className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
            >
              Deny
            </button>
          </>
        );
      default:
        return null;
    }
  };

  const pendingCount = withdrawals.filter(w => w.status === 'under_review').length;
  const processingCount = withdrawals.filter(w => w.status === 'awaiting_processing').length;
  const totalPending = withdrawals
    .filter(w => w.status === 'under_review' || w.status === 'awaiting_processing')
    .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
            <p className="text-gray-400">Review and process user withdrawal requests</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">Pending Review</div>
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">Processing</div>
            <div className="text-2xl font-bold text-blue-400">{processingCount}</div>
          </div>
          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800">
            <div className="text-gray-400 text-sm">Total Pending Amount</div>
            <div className="text-2xl font-bold text-white">${totalPending.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-[#111111] rounded-xl border border-gray-800">
          <div className="p-4 border-b border-gray-800 flex items-center gap-4">
            <span className="text-gray-400 text-sm">Filter:</span>
            <div className="flex gap-2">
              {['all', 'under_review', 'awaiting_processing', 'finalized', 'denied'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filterStatus === status
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {status === 'all' ? 'All' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Method</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Date</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No withdrawals found
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="py-3 px-4">
                        <div className="text-white">{withdrawal.userEmail}</div>
                        <div className="text-gray-500 text-xs">{withdrawal.userId?.slice(0, 8)}...</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">${parseFloat(withdrawal.amount).toLocaleString()}</div>
                        {parseFloat(withdrawal.fee) > 0 && (
                          <div className="text-gray-500 text-xs">Fee: ${parseFloat(withdrawal.fee).toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300">{methodLabels[withdrawal.methodType] || withdrawal.methodType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-lg text-xs border ${statusColors[withdrawal.status]}`}>
                          {statusLabels[withdrawal.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-300">{new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                        <div className="text-gray-500 text-xs">{new Date(withdrawal.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getActionButtons(withdrawal)}
                          <button
                            onClick={() => { setSelectedWithdrawal(withdrawal); }}
                            className="px-3 py-1 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showActionModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111111] rounded-xl border border-gray-800 w-full max-w-md">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">
                  {actionType === 'approve' && 'Approve Withdrawal'}
                  {actionType === 'process' && 'Complete Withdrawal'}
                  {actionType === 'deny' && 'Deny Withdrawal'}
                </h2>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <div className="text-gray-400 text-sm">Amount</div>
                  <div className="text-white text-xl font-bold">${parseFloat(selectedWithdrawal.amount).toLocaleString()}</div>
                </div>
                <div className="mb-4">
                  <div className="text-gray-400 text-sm">User</div>
                  <div className="text-white">{selectedWithdrawal.userEmail}</div>
                </div>

                {actionType === 'deny' && (
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-1">Denial Reason</label>
                    <textarea
                      value={denialReason}
                      onChange={(e) => setDenialReason(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500"
                      rows={3}
                      placeholder="Enter reason for denial..."
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-1">Admin Notes (Optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500"
                    rows={2}
                    placeholder="Internal notes..."
                  />
                </div>

                {message && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${
                    message.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {message}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={processing || (actionType === 'deny' && !denialReason)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    actionType === 'deny'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {processing ? 'Processing...' : (
                    actionType === 'approve' ? 'Approve' :
                    actionType === 'process' ? 'Mark Complete' : 'Deny'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedWithdrawal && !showActionModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111111] rounded-xl border border-gray-800 w-full max-w-lg">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Withdrawal Details</h2>
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-400 text-sm">Amount</div>
                    <div className="text-white text-xl font-bold">${parseFloat(selectedWithdrawal.amount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Net Amount</div>
                    <div className="text-white text-xl font-bold">${parseFloat(selectedWithdrawal.netAmount).toLocaleString()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-400 text-sm">Fee</div>
                    <div className="text-white">${parseFloat(selectedWithdrawal.fee || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Method</div>
                    <div className="text-white">{methodLabels[selectedWithdrawal.methodType]}</div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">User</div>
                  <div className="text-white">{selectedWithdrawal.userEmail}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Status</div>
                  <span className={`inline-block px-2 py-1 rounded-lg text-xs border ${statusColors[selectedWithdrawal.status]}`}>
                    {statusLabels[selectedWithdrawal.status]}
                  </span>
                </div>
                {selectedWithdrawal.paymentDetails && (
                  <div>
                    <div className="text-gray-400 text-sm mb-2">Payment Details</div>
                    <div className="bg-[#0a0a0a] rounded-lg p-3 text-sm">
                      <pre className="text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(selectedWithdrawal.paymentDetails, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                {selectedWithdrawal.denialReason && (
                  <div>
                    <div className="text-gray-400 text-sm">Denial Reason</div>
                    <div className="text-red-400">{selectedWithdrawal.denialReason}</div>
                  </div>
                )}
                {selectedWithdrawal.adminNotes && (
                  <div>
                    <div className="text-gray-400 text-sm">Admin Notes</div>
                    <div className="text-gray-300">{selectedWithdrawal.adminNotes}</div>
                  </div>
                )}
                <div>
                  <div className="text-gray-400 text-sm">Submitted</div>
                  <div className="text-white">{new Date(selectedWithdrawal.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-800 flex gap-3">
                {getActionButtons(selectedWithdrawal)}
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
