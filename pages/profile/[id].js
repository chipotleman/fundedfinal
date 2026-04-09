import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../../components/TopNavbar';
import { useBetSlip } from '../../contexts/BetSlipContext';
import { useTheme } from '../../contexts/ThemeContext';

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
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showBattleInvite, setShowBattleInvite] = useState(false);
  const [battleInviteLoading, setBattleInviteLoading] = useState(false);
  const [inviteBuyIn, setInviteBuyIn] = useState(100);
  const [inviteDuration, setInviteDuration] = useState(24);
  
  const { betSlip } = useBetSlip();
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchProfile();
      if (session?.user?.id && session.user.id !== id) {
        checkFriendStatus();
      }
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

  const checkFriendStatus = async () => {
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const isFriend = data.friends?.some(f => f.id === id);
        if (isFriend) {
          setFriendStatus('friends');
          return;
        }
      }
      const reqRes = await fetch('/api/friends/requests', { credentials: 'include' });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        const hasPendingFromThem = reqData.requests?.some(r => r.sender?.id === id);
        if (hasPendingFromThem) {
          setFriendStatus('pending_received');
          return;
        }
      }
      const sentRes = await fetch('/api/friends/sent', { credentials: 'include' });
      if (sentRes.ok) {
        const sentData = await sentRes.json();
        const sentToThem = sentData.requests?.find(r => r.receiver?.id === id);
        if (sentToThem) {
          setFriendStatus('pending_sent');
          setFriendRequestId(sentToThem.id);
          return;
        }
      }
      setFriendStatus('none');
    } catch (error) {
      console.error('Error checking friend status:', error);
      setFriendStatus('none');
    }
  };

  const handleAddFriend = async () => {
    setFriendActionLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFriendStatus(data.status === 'accepted' ? 'friends' : 'pending_sent');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!friendRequestId) return;
    setFriendActionLoading(true);
    try {
      const res = await fetch(`/api/friends/${friendRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      if (res.ok) {
        setFriendStatus('none');
        setFriendRequestId(null);
      }
    } catch (error) {
      console.error('Error withdrawing friend request:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    setFriendActionLoading(true);
    try {
      await fetch(`/api/friends/${id}`, { method: 'DELETE', credentials: 'include' });
      setFriendStatus('none');
    } catch (error) {
      console.error('Error removing friend:', error);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleSendBattleInvite = async () => {
    setBattleInviteLoading(true);
    try {
      const res = await fetch('/api/battles/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: id,
          buyIn: inviteBuyIn,
          duration: inviteDuration,
        }),
      });
      if (res.ok) {
        setShowBattleInvite(false);
        alert('Battle invite sent!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Error sending battle invite:', error);
      alert('Failed to send battle invite');
    } finally {
      setBattleInviteLoading(false);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDarkMode ? '#000' : '#f5f5f5' }}>
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDarkMode ? '#000' : '#f5f5f5' }}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Profile not found</h2>
          <Link href="/">
            <button className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg">
              Go to Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: isDarkMode ? '#000' : '#f5f5f5' }}>
      <TopNavbar 
        user={session?.user}
        bankroll={0}
        pnl={0}
        betSlipCount={betSlip?.length || 0}
      />
      
      <div className="pt-16 pb-24 px-4 max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              <div className="relative">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl overflow-hidden" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', border: `2px solid ${isDarkMode ? '#333' : '#d1d5db'}` }}>
                  {editing ? (
                    <label className="cursor-pointer w-full h-full flex items-center justify-center">
                      {formData.avatar ? (
                        <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-500 text-xs">Upload</span>
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
                    <span className={`font-bold text-2xl ${isDarkMode ? 'text-white' : 'text-gray-600'}`}>{profile.username?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                {winRate >= 60 && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    TOP
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={handleUsernameChange}
                        className={`w-full rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, fontSize: '16px' }}
                        maxLength={20}
                      />
                      {usernameStatus.checking && (
                        <p className="text-gray-400 text-xs mt-1">Checking...</p>
                      )}
                      {usernameStatus.available === true && formData.username !== profile.username && (
                        <p className="text-green-400 text-xs mt-1">Available</p>
                      )}
                      {usernameStatus.error && (
                        <p className="text-red-400 text-xs mt-1">{usernameStatus.error}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Bio</label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className={`w-full rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, fontSize: '16px' }}
                        rows={3}
                        maxLength={200}
                        placeholder="Tell others about yourself..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saving || usernameStatus.available === false}
                        className="bg-blue-600 disabled:opacity-40 text-white font-bold py-2 px-6 rounded-lg transition-all text-sm"
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
                        className={`font-semibold py-2 px-6 rounded-lg transition-all text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                        style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className={`text-2xl font-black mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {profile.username || 'Anonymous'}
                    </h1>
                    <p className="text-gray-500 text-sm mb-3">{profile.bio || 'No bio yet'}</p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className={`font-medium py-1.5 px-4 rounded-lg transition-all text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                        style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
                      >
                        Edit Profile
                      </button>
                    )}
                    
                    {!isOwnProfile && session?.user && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {friendStatus === 'none' && (
                          <button
                            onClick={handleAddFriend}
                            disabled={friendActionLoading}
                            className="bg-blue-600 disabled:opacity-40 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                          >
                            {friendActionLoading ? 'Sending...' : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Add Friend
                              </>
                            )}
                          </button>
                        )}
                        
                        {friendStatus === 'pending_sent' && (
                          <button
                            onClick={handleWithdrawRequest}
                            disabled={friendActionLoading}
                            className="bg-red-600/20 disabled:opacity-40 text-red-400 font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                          >
                            {friendActionLoading ? 'Cancelling...' : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel Friend Request
                              </>
                            )}
                          </button>
                        )}
                        
                        {friendStatus === 'pending_received' && (
                          <button
                            onClick={handleAddFriend}
                            disabled={friendActionLoading}
                            className="bg-green-600 disabled:opacity-40 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                          >
                            {friendActionLoading ? 'Accepting...' : 'Accept Request'}
                          </button>
                        )}
                        
                        {friendStatus === 'friends' && (
                          <>
                            <button
                              onClick={() => setShowBattleInvite(true)}
                              className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Challenge to Battle
                            </button>
                            <button
                              onClick={handleRemoveFriend}
                              disabled={friendActionLoading}
                              className="bg-red-600/20 text-red-400 font-semibold py-2 px-4 rounded-lg transition-all text-sm"
                            >
                              {friendActionLoading ? '...' : 'Remove Friend'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Battles</p>
              <p className={`text-xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{battleStats?.totalBattles || 0}</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Win Rate</p>
              <p className="text-xl font-black text-green-500 mt-1">{winRate}%</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Wins</p>
              <p className="text-xl font-black text-green-500 mt-1">{battleStats?.wins || 0}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Winnings</p>
              <p className="text-xl font-black text-green-500 mt-1">{formatCurrency(battleStats?.totalWinnings)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Battle History</h2>
          
          {battleHistory.length > 0 ? (
            <div className="space-y-2">
              {battleHistory.map((battle) => (
                <div 
                  key={battle.id} 
                  className="rounded-xl p-3.5"
                  style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#e5e7eb' }}>
                        {battle.opponent?.avatar ? (
                          <img src={battle.opponent.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-gray-600'}`}>{battle.opponent?.username?.[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          vs {battle.opponent?.username || battle.opponent?.displayName || 'Unknown'}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {battle.challengeType?.toUpperCase()} {battle.durationType && `\u00B7 ${battle.durationType.replace('_', ' ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold uppercase ${getResultColor(battle.result)}`}>
                        {battle.result === 'pending' ? 'In Progress' : battle.result}
                      </p>
                      {battle.result !== 'pending' && (
                        <p className={`text-sm font-bold ${battle.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {battle.pnl >= 0 ? '+' : ''}{formatCurrency(battle.pnl)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8 text-sm">No battle history yet</p>
          )}
        </div>
      </div>

      {showBattleInvite && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowBattleInvite(false)}
          />
          <div className="relative rounded-2xl p-5 max-w-md w-full" style={{ backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, boxShadow: isDarkMode ? 'none' : '0 25px 50px rgba(0,0,0,0.15)' }}>
            <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Challenge {profile?.username || 'User'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Buy-in</label>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 250, 500].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setInviteBuyIn(amount)}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                        inviteBuyIn === amount 
                          ? 'bg-blue-600 text-white' 
                          : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                      style={inviteBuyIn !== amount ? { backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` } : {}}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: 1, label: '1 Hour' }, { value: 24, label: '24 Hours' }, { value: 72, label: '3 Days' }].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInviteDuration(opt.value)}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                        inviteDuration === opt.value 
                          ? 'bg-blue-600 text-white' 
                          : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}
                      style={inviteDuration !== opt.value ? { backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="rounded-lg p-3" style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">Prize Pool</span>
                  <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${inviteBuyIn * 2}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Winner Takes (90%)</span>
                  <span className="text-green-500 font-bold">${(inviteBuyIn * 2 * 0.9).toFixed(0)}</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowBattleInvite(false)}
                  className={`flex-1 py-2.5 font-semibold rounded-lg transition-all text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  style={{ backgroundColor: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendBattleInvite}
                  disabled={battleInviteLoading}
                  className="flex-1 py-2.5 bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-lg transition-all text-sm"
                >
                  {battleInviteLoading ? 'Sending...' : 'Send Challenge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
