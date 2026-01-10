import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function MockUsersPage() {
  const [mockUsers, setMockUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [count, setCount] = useState(50);
  const fileInputRef = useRef(null);

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    fetchMockUsers();
  }, []);

  const fetchMockUsers = async () => {
    try {
      const res = await fetch('/api/admin/mock-users', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMockUsers(data.mockUsers || []);
      }
    } catch (error) {
      console.error('Error fetching mock users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRandom = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ count }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Created ${data.created.length} mock users with random avatars!`);
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create mock users');
      }
    } catch (error) {
      console.error('Error creating mock users:', error);
    }
    setCreating(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    const uploadedUrls = [];

    for (const file of files) {
      try {
        const urlRes = await fetch('/api/uploads/request-url', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            folder: 'mock-avatars',
          }),
        });

        if (!urlRes.ok) {
          console.error('Failed to get upload URL for', file.name);
          continue;
        }

        const { uploadUrl, objectKey, publicUrl } = await urlRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (uploadRes.ok) {
          uploadedUrls.push(publicUrl);
        } else {
          console.error('Failed to upload', file.name);
        }
      } catch (err) {
        console.error('Upload error for', file.name, err);
      }
    }

    if (uploadedUrls.length > 0) {
      try {
        const res = await fetch('/api/admin/mock-users', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ avatarUrls: uploadedUrls }),
        });
        if (res.ok) {
          const data = await res.json();
          alert(`Created ${data.created.length} mock users from uploaded images!`);
          await fetchMockUsers();
        }
      } catch (error) {
        console.error('Error creating mock users from uploads:', error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploading(false);
  };

  const handleDeleteMockUser = async (userId) => {
    if (!confirm('Delete this mock user?')) return;
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      }
    } catch (error) {
      console.error('Error deleting mock user:', error);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Run cleanup to fix any data integrity issues with mock users?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Cleanup complete! Removed ${data.cleaned} invalid records, fixed ${data.fixed || 0} profiles.`);
        await fetchMockUsers();
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
    }
    setCleaningUp(false);
  };

  return (
    <AdminLayout title="Mock Users" requiredPermission="users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Mock Users</h1>
        <p className="text-gray-400">Create and manage fake opponent accounts for 1v1 matchmaking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Generate Random Avatars</h2>
          <p className="text-gray-400 text-sm mb-4">
            Automatically create mock users with diverse randomly generated profile pictures.
          </p>
          
          <div className="flex items-center gap-4 mb-4">
            <label className="text-gray-300 text-sm">Number to create:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <button
            onClick={handleGenerateRandom}
            disabled={creating}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : `Generate ${count} Random Mock Users`}
          </button>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Upload Custom Avatars</h2>
          <p className="text-gray-400 text-sm mb-4">
            Upload your own images from your computer. Each image creates one mock user.
          </p>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            className="hidden"
            id="avatar-upload"
          />
          
          <label
            htmlFor="avatar-upload"
            className={`w-full flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-purple-500/50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-400 text-sm text-center">
              {uploading ? 'Uploading...' : 'Click to select images or drag & drop'}
            </span>
            <span className="text-gray-500 text-xs mt-1">Supports JPG, PNG, GIF, WebP</span>
          </label>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Data Cleanup</h2>
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {cleaningUp ? 'Cleaning...' : 'Run Cleanup'}
          </button>
        </div>
        <p className="text-gray-400 text-sm">
          Removes orphaned or mismatched mock user records to ensure data integrity for matchmaking.
        </p>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Existing Mock Users ({mockUsers.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : mockUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No mock users yet. Generate some above!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mockUsers.map((user) => (
              <div
                key={user.id}
                className="relative bg-white/5 border border-white/10 rounded-xl p-4 text-center group hover:border-purple-500/50 transition-colors"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 border-2 border-green-500">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="40">?</text></svg>'; }}
                  />
                </div>
                <p className="text-white text-sm font-medium truncate">{user.username}</p>
                <p className="text-gray-500 text-xs">
                  {user.battleWins || 0}W - {user.battleLosses || 0}L
                </p>
                <button
                  onClick={() => handleDeleteMockUser(user.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
