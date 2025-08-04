
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar_url: ''
  });
  const { betSlip } = useBetSlip();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        // Fetch or create profile
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: session.user.id,
              username: session.user.email?.split('@')[0] || 'User',
              bio: '',
              avatar_url: ''
            }])
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
          } else {
            setProfile(newProfile);
            setFormData({
              username: newProfile.username,
              bio: newProfile.bio || '',
              avatar_url: newProfile.avatar_url || ''
            });
          }
        } else if (!error) {
          setProfile(profileData);
          setFormData({
            username: profileData.username,
            bio: profileData.bio || '',
            avatar_url: profileData.avatar_url || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          bio: formData.bio,
          avatar_url: formData.avatar_url
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile');
      } else {
        setProfile(data);
        setEditing(false);
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating profile');
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
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-12">
              <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-3xl">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white">👤</span>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-3xl font-bold text-white">{profile?.username || 'User'}</h2>
                  <p className="text-purple-100">{user.email}</p>
                  <p className="text-purple-200 mt-2">{profile?.bio || 'No bio added yet'}</p>
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
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Avatar URL</label>
                    <input
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-2">Account Info</h3>
                      <div className="space-y-2">
                        <p className="text-gray-300"><span className="font-medium">Email:</span> {user.email}</p>
                        <p className="text-gray-300"><span className="font-medium">Username:</span> {profile?.username || 'Not set'}</p>
                        <p className="text-gray-300"><span className="font-medium">Member since:</span> {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-700/50 rounded-lg p-4">
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
