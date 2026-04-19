import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import UserAvatar from '../../components/UserAvatar';

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'manager', label: 'Manager', description: 'Can manage users and view analytics' },
  { value: 'staff', label: 'Staff', description: 'Basic access to user management' },
];

const PERMISSIONS = [
  { value: 'users', label: 'Users', description: 'Manage user accounts' },
  { value: 'bets', label: 'Bets', description: 'View and manage bets' },
  { value: 'withdrawals', label: 'Withdrawals', description: 'Process withdrawals' },
  { value: 'games', label: 'Games & Odds', description: 'View games and odds' },
  { value: 'analytics', label: 'Analytics', description: 'View platform analytics' },
  { value: 'staff', label: 'Staff', description: 'Manage staff accounts' },
  { value: 'all', label: 'All Access', description: 'Full access to everything' },
];

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'staff', permissions: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/staff', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setStaff(data.staff); }
    } catch (error) { console.error('Failed to fetch staff:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const token = localStorage.getItem('admin_token');
    const method = editingStaff ? 'PUT' : 'POST';
    const body = editingStaff ? { id: editingStaff.id, ...formData } : formData;

    try {
      const res = await fetch('/api/admin-panel/staff', {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Operation failed'); return; }
      setSuccess(editingStaff ? 'Staff member updated' : 'Staff member added');
      setShowModal(false); resetForm(); fetchStaff();
    } catch (error) { setError('An error occurred'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/admin-panel/staff', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setSuccess('Staff member deleted'); fetchStaff(); }
    } catch (error) { setError('Failed to delete staff member'); }
  };

  const handleToggleActive = async (staffMember) => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch('/api/admin-panel/staff', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: staffMember.id, isActive: !staffMember.is_active }),
      });
      fetchStaff();
    } catch (error) { setError('Failed to update staff status'); }
  };

  const openEditModal = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({ email: staffMember.email, password: '', name: staffMember.name || '', role: staffMember.role, permissions: staffMember.permissions || [] });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingStaff(null);
    setFormData({ email: '', password: '', name: '', role: 'staff', permissions: [] });
    setError('');
  };

  const togglePermission = (permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission) ? prev.permissions.filter((p) => p !== permission) : [...prev.permissions, permission],
    }));
  };

  return (
    <AdminLayout title="Staff Management" requiredPermission="staff">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Staff Management</h1>
          <p className="text-gray-400">Manage admin staff accounts and permissions</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add Staff
        </button>
      </div>

      {success && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl flex items-center gap-3"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{success}</div>}
      {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex items-center gap-3"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin mx-auto"></div><p className="text-gray-400 mt-4">Loading staff...</p></div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center"><svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg><p className="text-gray-400">No staff members yet. Add your first team member.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={{ id: member.id, username: member.name || member.email, avatar: member.avatar }} size={40} />
                        <div><p className="text-white font-medium">{member.name || '-'}</p><p className="text-gray-400 text-sm">{member.email}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${member.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : member.role === 'manager' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{member.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">{(member.permissions || []).slice(0, 3).map((p, i) => <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">{p}</span>)}{(member.permissions || []).length > 3 && <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">+{member.permissions.length - 3}</span>}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleActive(member)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${member.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}>{member.is_active ? 'Active' : 'Inactive'}</button>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(member)} className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">Edit</button>
                        <button onClick={() => handleDelete(member.id)} className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" placeholder="john@piks.com" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{editingStaff ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" placeholder="Enter password" required={!editingStaff} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((role) => (
                    <button key={role.value} type="button" onClick={() => setFormData({ ...formData, role: role.value })} className={`p-3 rounded-xl border text-center transition-all ${formData.role === role.value ? 'border-purple-500/50 bg-purple-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      <p className="font-medium text-sm">{role.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSIONS.map((perm) => (
                    <button key={perm.value} type="button" onClick={() => togglePermission(perm.value)} className={`p-3 rounded-xl border text-left transition-all ${formData.permissions.includes(perm.value) ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.permissions.includes(perm.value) ? 'border-green-500 bg-green-500' : 'border-gray-500'}`}>{formData.permissions.includes(perm.value) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                        <span className={formData.permissions.includes(perm.value) ? 'text-white' : 'text-gray-400'}>{perm.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="p-3 rounded-xl text-sm bg-red-500/10 text-red-400 border border-red-500/30">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all font-medium">{editingStaff ? 'Update' : 'Add Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
