import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar: ''
  });
  const fileInputRef = useRef(null);
  const { betSlip } = useBetSlip();
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    try {
      if (session?.user) {
        setUser(session.user);
        
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setFormData({
            username: data.profile?.username || session.user.email?.split('@')[0] || 'User',
            bio: data.profile?.bio || '',
            avatar: data.profile?.avatar || ''
          });
        } else {
          const mockProfile = {
            id: session.user.id,
            username: session.user.email?.split('@')[0] || 'User',
            bio: '',
            avatar: ''
          };
          setProfile(mockProfile);
          setFormData({
            username: mockProfile.username,
            bio: mockProfile.bio || '',
            avatar: mockProfile.avatar || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      setFormData({ ...formData, avatar: objectPath });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. You can paste an image URL instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          bio: formData.bio,
          avatar: formData.avatar,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setEditing(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please log in</h2>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        user={user}
        bankroll={1000}
        pnl={250}
        betSlipCount={betSlip.length}
      />
      
      <div className="pt-20 pb-16">
        {/* Header */}
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
            <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Profile</span>
          </h1>
          <p className="text-gray-300 text-lg mb-8">Manage your account settings and preferences</p>
        </div>

        {/* Profile Content */}
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-[#0d0d0d] rounded-2xl border border-[#1a1a1a] overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-12">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="w-24 h-24 bg-[#1a1a1a] rounded-full flex items-center justify-center text-3xl">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white">👤</span>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-3xl font-bold text-white">{profile?.username || 'User'}</h2>
                  <p className="text-purple-100">{user.email}</p>
                  <p className="text-purple-200 mt-2">{profile?.bio || 'No bio added yet'}</p>
                  {(profile?.instagramHandle || profile?.facebookUrl) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      {profile?.instagramHandle && (
                        <a
                          href={`https://instagram.com/${String(profile.instagramHandle).replace(/^@+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white"
                        >
                          <span>📷</span>@{String(profile.instagramHandle).replace(/^@+/, '')}
                        </a>
                      )}
                      {profile?.facebookUrl && (
                        <a
                          href={profile.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white"
                        >
                          <span>👍</span>Facebook
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="p-8">
              {editing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Profile Picture</label>
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="w-20 h-20 bg-[#1a1a1a] rounded-full overflow-hidden flex items-center justify-center">
                        {formData.avatar ? (
                          <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl">👤</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                          {uploading ? 'Uploading...' : 'Upload Image'}
                        </button>
                        <p className="text-gray-400 text-xs mt-1">Max 5MB, JPG/PNG/GIF</p>
                      </div>
                    </div>
                    <input
                      type="url"
                      value={formData.avatar}
                      onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Or paste an image URL..."
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={saving || uploading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="bg-gray-600 hover:bg-[#1a1a1a] text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1a1a1a] rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-2">Account Info</h3>
                      <div className="space-y-2">
                        <p className="text-gray-300"><span className="font-medium">Email:</span> {user.email}</p>
                        <p className="text-gray-300"><span className="font-medium">Username:</span> {profile?.username || 'Not set'}</p>
                        <p className="text-gray-300"><span className="font-medium">Member since:</span> {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-[#1a1a1a] rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-2">Stats</h3>
                      <div className="space-y-2">
                        <p className="text-gray-300"><span className="font-medium">Total Bets:</span> 0</p>
                        <p className="text-gray-300"><span className="font-medium">Win Rate:</span> 0%</p>
                        <p className="text-gray-300"><span className="font-medium">Total Profit:</span> $0</p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
