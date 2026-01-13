import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../../components/TopNavbar';
import { useBetSlip } from '../../contexts/BetSlipContext';

export default function PublicProfile() {
  const [profile, setProfile] = useState(null);
  const [battleHistory, setBattleHistory] = useState([]);
  const [battleStats, setBattleStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ username: '', bio: '', avatar: '' });
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });
  const [saving, setSaving] = useState(false);
  
  const { betSlip } = useBetSlip();
  const { data: session } = useSession();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchProfile();
    }
  }, [id, session]);

  const fetchProfile = async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch(`/api/profiles/${id}`, { credentials: 'include' }),
        fetch(`/api/profiles/battle-history?userId=${id}`, { credentials: 'include' }),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setFormData({
          username: profileData.username || '',
          bio: profileData.bio || '',
          avatar: profileData.avatar || '',
        });
        setIsOwnProfile(session?.user?.id === id);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setBattleHistory(historyData.battles || []);
        setBattleStats(historyData.stats);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, error: 'Username must be at least 3 characters' });
      return;
    }

    setUsernameStatus({ checking: true, available: null, error: null });

    try {
      const res = await fetch(`/api/profiles/check-username?username=${encodeURIComponent(username)}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (data.available) {
        setUsernameStatus({ checking: false, available: true, error: null });
      } else {
        setUsernameStatus({ checking: false, available: false, error: data.error || 'Username is taken' });
      }
    } catch (error) {
      setUsernameStatus({ checking: false, available: null, error: 'Failed to check username' });
    }
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, username: value });
    
    if (value !== profile?.username) {
      const timeoutId = setTimeout(() => checkUsername(value), 500);
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameStatus({ checking: false, available: true, error: null });
    }
  };

  const handleSave = async () => {
    if (usernameStatus.available === false) return;

    setSaving(true);
    try {
      const res = await fetch('/api/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setEditing(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, avatar: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'tie': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const winRate = battleStats && battleStats.totalBattles > 0 
    ? Math.round((battleStats.wins / battleStats.totalBattles) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Profile not found</h2>
          <Link href="/">
            <button className="bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-6 rounded-lg">
              Go to Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        user={session?.user}
        bankroll={0}
        pnl={0}
        betSlipCount={betSlip?.length || 0}
      />
      
      <div className="pt-20 pb-24 px-4 max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/20 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-4xl overflow-hidden">
                  {editing ? (
                    <label className="cursor-pointer w-full h-full flex items-center justify-center">
                      {formData.avatar ? (
                        <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white/50 text-sm">Click to upload</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </label>
                  ) : profile.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                {winRate >= 60 && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                    TOP PLAYER
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={handleUsernameChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={20}
                      />
                      {usernameStatus.checking && (
                        <p className="text-gray-400 text-sm mt-1">Checking...</p>
                      )}
                      {usernameStatus.available === true && formData.username !== profile.username && (
                        <p className="text-green-400 text-sm mt-1">Username available!</p>
                      )}
                      {usernameStatus.error && (
                        <p className="text-red-400 text-sm mt-1">{usernameStatus.error}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Bio</label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        maxLength={200}
                        placeholder="Tell others about yourself..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saving || usernameStatus.available === false}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black font-bold py-2 px-6 rounded-lg transition-all"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setFormData({
                            username: profile.username || '',
                            bio: profile.bio || '',
                            avatar: profile.avatar || '',
                          });
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-black text-white mb-2">
                      {profile.username || 'Anonymous'}
                    </h1>
                    <p className="text-gray-400 mb-4">{profile.bio || 'No bio yet'}</p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                      >
                        Edit Profile
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-700/50">
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">Battles</p>
              <p className="text-2xl font-black text-white">{battleStats?.totalBattles || 0}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-2xl font-black text-green-400">{winRate}%</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">Wins</p>
              <p className="text-2xl font-black text-green-400">{battleStats?.wins || 0}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">Total Winnings</p>
              <p className="text-2xl font-black text-green-400">{formatCurrency(battleStats?.totalWinnings)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Battle History</h2>
          
          {battleHistory.length > 0 ? (
            <div className="space-y-3">
              {battleHistory.map((battle) => (
                <div 
                  key={battle.id} 
                  className="bg-slate-900/50 rounded-xl border border-slate-700 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        {battle.opponent?.avatar ? (
                          <img src={battle.opponent.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          '🎯'
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          vs {battle.opponent?.username || battle.opponent?.displayName || 'Unknown'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {battle.challengeType?.toUpperCase()} • {battle.durationType?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold uppercase ${getResultColor(battle.result)}`}>
                        {battle.result === 'pending' ? 'In Progress' : battle.result}
                      </p>
                      {battle.result !== 'pending' && (
                        <p className={`text-lg font-bold ${battle.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {battle.pnl >= 0 ? '+' : ''}{formatCurrency(battle.pnl)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No battle history yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
