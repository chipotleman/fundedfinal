import { useState, useEffect, Fragment } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);

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

  return (
    <AdminLayout title="Users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">View and manage all registered users</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
        />
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
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Challenges</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                    <tr className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-white">{user.email}</td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-sm">
                          {user.challenges?.length || 0} challenges
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {expandedUser === user.id ? 'Hide Details' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr key={`${user.id}-details`}>
                        <td colSpan={4} className="px-6 py-4 bg-gray-800/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-400 mb-2">User ID</h4>
                              <p className="text-white text-sm font-mono">{user.id}</p>
                            </div>
                            {user.profile && (
                              <>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">Bankroll</h4>
                                  <p className="text-white">${parseFloat(user.profile.bankroll || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">Total Bets</h4>
                                  <p className="text-white">{user.profile.totalBets || 0}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-400 mb-2">P&L</h4>
                                  <p className={parseFloat(user.profile.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    ${parseFloat(user.profile.pnl || 0).toLocaleString()}
                                  </p>
                                </div>
                              </>
                            )}
                            {user.challenges?.length > 0 && (
                              <div className="md:col-span-2">
                                <h4 className="text-sm font-medium text-gray-400 mb-2">Challenges</h4>
                                <div className="space-y-2">
                                  {user.challenges.map((challenge, idx) => (
                                    <div key={idx} className="bg-gray-800 rounded p-3 text-sm">
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
    </AdminLayout>
  );
}
