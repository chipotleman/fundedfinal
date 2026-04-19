import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../../components/TopNavbar';
import UserAvatar from '../../components/UserAvatar';
import ActiveStatus from '../../components/ActiveStatus';
import ProfileEditPanel from '../../components/ProfileEditPanel';
import { useBetSlip } from '../../contexts/BetSlipContext';
import { formatMoney } from '../../utils/formatMoney';
import { getFrameById } from '../../lib/profileFrames';

export default function PublicProfile() {
  const [profile, setProfile] = useState(null);
  const [battleHistory, setBattleHistory] = useState([]);
  const [battleStats, setBattleStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    avatar: '',
    bannerUrl: '',
    favoriteTeams: [],
    equippedFrame: null,
  });
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });
  const [saving, setSaving] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showBattleInvite, setShowBattleInvite] = useState(false);
  const [battleInviteLoading, setBattleInviteLoading] = useState(false);
  const [inviteBuyIn, setInviteBuyIn] = useState(100);
  const [inviteDuration, setInviteDuration] = useState(24);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingInline, setSavingInline] = useState(null);
  const [inlineError, setInlineError] = useState(null);
  const avatarFileRef = useRef(null);
  const bannerFileRef = useRef(null);
  
  const { betSlip } = useBetSlip();
  const { data: session } = useSession();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      setEditingUsername(false);
      setEditingBio(false);
      setInlineError(null);
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
          bannerUrl: profileData.bannerUrl || '',
          favoriteTeams: Array.isArray(profileData.favoriteTeams)
            ? profileData.favoriteTeams.map((t) => ({ league: t.league, teamId: t.teamId }))
            : [],
          equippedFrame: profileData.equippedFrame || null,
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
        setEditing(false);
        await fetchProfile();
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

  const uploadFileToObjectStorage = async (file) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be smaller than 5MB');
    }
    const urlRes = await fetch('/api/uploads/request-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!urlRes.ok) {
      const data = await urlRes.json().catch(() => ({}));
      throw new Error(data.error || 'Could not start upload');
    }
    const { uploadURL, objectPath } = await urlRes.json();
    const putRes = await fetch(uploadURL, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!putRes.ok) throw new Error('Upload failed');
    return objectPath;
  };

  const persistProfile = async (payload) => {
    const res = await fetch('/api/profiles/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not save changes');
    }
    return res.json();
  };

  const handleInlineAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingInline('avatar');
    setInlineError(null);
    try {
      const path = await uploadFileToObjectStorage(file);
      await persistProfile({ avatar: path });
      setProfile((p) => ({ ...p, avatar: path }));
      setFormData((f) => ({ ...f, avatar: path }));
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const handleInlineBannerChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingInline('banner');
    setInlineError(null);
    try {
      const path = await uploadFileToObjectStorage(file);
      await persistProfile({ bannerUrl: path });
      setProfile((p) => ({ ...p, bannerUrl: path }));
      setFormData((f) => ({ ...f, bannerUrl: path }));
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const startEditUsername = () => {
    setUsernameDraft(profile?.username || '');
    setInlineError(null);
    setEditingUsername(true);
  };

  const saveUsername = async () => {
    const next = usernameDraft.trim();
    if (!next) {
      setInlineError('Username cannot be empty');
      return;
    }
    if (next === (profile?.username || '')) {
      setEditingUsername(false);
      return;
    }
    setSavingInline('username');
    setInlineError(null);
    try {
      await persistProfile({ username: next });
      setProfile((p) => ({ ...p, username: next }));
      setFormData((f) => ({ ...f, username: next }));
      setEditingUsername(false);
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
  };

  const startEditBio = () => {
    setBioDraft(profile?.bio || '');
    setInlineError(null);
    setEditingBio(true);
  };

  const saveBio = async () => {
    const next = bioDraft.trim();
    if (next === (profile?.bio || '')) {
      setEditingBio(false);
      return;
    }
    setSavingInline('bio');
    setInlineError(null);
    try {
      await persistProfile({ bio: next });
      setProfile((p) => ({ ...p, bio: next }));
      setFormData((f) => ({ ...f, bio: next }));
      setEditingBio(false);
    } catch (err) {
      setInlineError(err.message);
    } finally {
      setSavingInline(null);
    }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${'text-white'}`}>Profile not found</h2>
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
    <div className="min-h-screen" style={{ background: '#000' }}>
      <TopNavbar 
        user={session?.user}
        bankroll={0}
        pnl={0}
        betSlipCount={betSlip?.length || 0}
      />
      
      <div className="pt-16 pb-24 px-4 max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}>
          <div
            className={`relative w-full group ${isOwnProfile ? 'cursor-pointer' : ''}`}
            style={{
              height: '160px',
              background: profile.bannerUrl
                ? `url(${profile.bannerUrl}) center/cover`
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            }}
            onClick={isOwnProfile ? () => bannerFileRef.current?.click() : undefined}
            role={isOwnProfile ? 'button' : undefined}
            aria-label={isOwnProfile ? 'Change cover photo' : undefined}
          >
            {isOwnProfile && (
              <>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInlineBannerChange}
                />
                <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${profile.bannerUrl ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {savingInline === 'banner' ? 'Uploading...' : (profile.bannerUrl ? 'Change cover' : 'Add cover photo')}
                  </div>
                </div>
                {savingInline === 'banner' && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-[10px] font-semibold">
                    Saving...
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-6 sm:p-8 -mt-12 relative">
            {editing ? (
              <ProfileEditPanel
                profile={profile}
                formData={formData}
                setFormData={setFormData}
                usernameStatus={usernameStatus}
                onUsernameChange={handleUsernameChange}
                onSave={handleSave}
                onCancel={() => {
                  setEditing(false);
                  setFormData({
                    username: profile.username || '',
                    bio: profile.bio || '',
                    avatar: profile.avatar || '',
                    bannerUrl: profile.bannerUrl || '',
                    favoriteTeams: Array.isArray(profile.favoriteTeams)
                      ? profile.favoriteTeams.map((t) => ({ league: t.league, teamId: t.teamId }))
                      : [],
                    equippedFrame: profile.equippedFrame || null,
                  });
                }}
                saving={saving}
              />
            ) : (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
              <div className="relative">
                <div
                  className={`rounded-full p-1 group relative ${isOwnProfile ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: '#0d0d0d',
                  }}
                  onClick={isOwnProfile ? () => avatarFileRef.current?.click() : undefined}
                  role={isOwnProfile ? 'button' : undefined}
                  aria-label={isOwnProfile ? 'Change profile picture' : undefined}
                >
                  <UserAvatar
                    avatar={profile.avatar}
                    username={profile.username}
                    frameId={profile.equippedFrame}
                    size={96}
                    bgColor={'#1a1a1a'}
                    textColor={'#fff'}
                    isOnline={!profile.isFakeOpponent && !!profile.isOnline}
                    onlineDotBorderColor={'#0d0d0d'}
                  />
                  {isOwnProfile && (
                    <>
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleInlineAvatarChange}
                      />
                      <div className="absolute inset-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-[10px] font-semibold text-center px-1">
                          {savingInline === 'avatar' ? 'Saving...' : (profile.avatar ? 'Change' : 'Add photo')}
                        </span>
                      </div>
                      <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 border-2 border-[#0d0d0d] flex items-center justify-center pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
                {winRate >= 60 && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    TOP
                  </div>
                )}
              </div>

              <div className="flex-1 text-center md:text-left">
                <>
                  {editingUsername ? (
                    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                      <input
                        type="text"
                        value={usernameDraft}
                        onChange={(e) => setUsernameDraft(e.target.value)}
                        autoFocus
                        maxLength={32}
                        className="bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-1.5 text-white text-xl font-bold focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={saveUsername}
                        disabled={savingInline === 'username'}
                        className="bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                      >
                        {savingInline === 'username' ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingUsername(false); setInlineError(null); }}
                        className="text-gray-400 text-xs font-semibold py-1.5 px-3 rounded-lg bg-[#111] border border-[#1a1a1a]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                      <h1 className={`text-2xl font-black ${'text-white'}`}>
                        {profile.username || 'Anonymous'}
                      </h1>
                      {isOwnProfile && (
                        <button
                          onClick={startEditUsername}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                          aria-label="Edit username"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {!profile.isFakeOpponent && (
                    <div className="mb-2 flex justify-center md:justify-start">
                      <ActiveStatus
                        isOnline={profile.isOnline}
                        lastSeenAt={profile.lastSeenAt}
                        size="md"
                      />
                    </div>
                  )}
                  {editingBio ? (
                    <div className="mb-3">
                      <textarea
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        autoFocus
                        maxLength={200}
                        rows={3}
                        className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                        placeholder="Tell people about yourself..."
                      />
                      <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                        <button
                          onClick={saveBio}
                          disabled={savingInline === 'bio'}
                          className="bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                        >
                          {savingInline === 'bio' ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingBio(false); setInlineError(null); }}
                          className="text-gray-400 text-xs font-semibold py-1.5 px-3 rounded-lg bg-[#111] border border-[#1a1a1a]"
                        >
                          Cancel
                        </button>
                        <span className="text-[10px] text-gray-500 ml-auto">{bioDraft.length}/200</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 mb-3 justify-center md:justify-start">
                      <p className="text-gray-500 text-sm">{profile.bio || (isOwnProfile ? 'Add a bio' : 'No bio yet')}</p>
                      {isOwnProfile && (
                        <button
                          onClick={startEditBio}
                          className="text-gray-500 hover:text-blue-400 transition-colors p-1 mt-[-2px]"
                          aria-label="Edit bio"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {isOwnProfile && inlineError && (
                    <p className="text-red-400 text-xs mb-2">{inlineError}</p>
                  )}
                  {(() => {
                    const equipped = profile.equippedFrame ? getFrameById(profile.equippedFrame) : null;
                    if (!equipped) return null;
                    return (
                      <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
                        <span className="mr-1">{equipped.icon}</span>
                        Wearing <span style={{ color: '#fff' }}>{equipped.name}</span>
                      </p>
                    );
                  })()}
                  {Array.isArray(profile.favoriteTeams) && profile.favoriteTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center md:justify-start mb-3">
                      {profile.favoriteTeams.map((t) => (
                        <span
                          key={`${t.league}:${t.teamId}`}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: '#111',
                            border: `1px solid ${'#1a1a1a'}`,
                            color: '#e5e7eb',
                          }}
                        >
                          {t.logo ? (
                            <img src={t.logo} alt="" className="w-4 h-4 object-contain" />
                          ) : (
                            <span
                              className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[8px] font-bold"
                              style={{ backgroundColor: '#1a1a1a' }}
                            >
                              {t.teamId?.slice(0, 3)}
                            </span>
                          )}
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-500">{t.league}</span>
                        </span>
                      ))}
                    </div>
                  )}
                    {isOwnProfile && (
                      <button
                        onClick={() => setEditing(true)}
                        className={`font-medium py-1.5 px-4 rounded-lg transition-all text-xs ${'text-gray-400'}`}
                        style={{ backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` }}
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
              </div>
            </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderTop: `1px solid ${'#1a1a1a'}` }}>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${'#1a1a1a'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Battles</p>
              <p className={`text-xl font-black mt-1 ${'text-white'}`}>{battleStats?.totalBattles || 0}</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${'#1a1a1a'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Win Rate</p>
              <p className="text-xl font-black text-green-500 mt-1">{winRate}%</p>
            </div>
            <div className="p-4 text-center" style={{ borderRight: `1px solid ${'#1a1a1a'}` }}>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Wins</p>
              <p className="text-xl font-black text-green-500 mt-1">{battleStats?.wins || 0}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Winnings</p>
              <p className="text-xl font-black text-green-500 mt-1">{formatCurrency(battleStats?.totalWinnings)}</p>
            </div>
          </div>
        </div>

        {Array.isArray(profile.frames) && profile.frames.length > 0 && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: '#0d0d0d',
              border: `1px solid ${'#1a1a1a'}`,
              boxShadow: 'none',
            }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Achievements
              </h2>
              <span className="text-xs text-gray-500">
                {profile.frames.filter((f) => f.unlocked).length} / {profile.frames.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {profile.frames.map((f) => {
                const isEquipped = profile.equippedFrame === f.id;
                return (
                  <div
                    key={f.id}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{
                      backgroundColor: '#111',
                      border: `1px solid ${isEquipped ? '#3b82f6' : '#1a1a1a'}`,
                      opacity: f.unlocked ? 1 : 0.55,
                    }}
                  >
                    <UserAvatar
                      avatar={profile.avatar}
                      username={profile.username}
                      frame={f.unlocked ? f : null}
                      size={40}
                      bgColor={'#1a1a1a'}
                      textColor={'#fff'}
                    />
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${'text-white'}`}>
                        <span className="mr-1">{f.icon}</span>
                        {f.name}
                      </div>
                      <div className="text-[10px] text-gray-500 leading-snug">
                        {f.unlocked ? f.description : `Locked · ${f.description}`}
                      </div>
                      {isEquipped && (
                        <div className="text-[10px] text-blue-400 font-semibold mt-0.5">Equipped</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-5" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Battle History</h2>
          
          {battleHistory.length > 0 ? (
            <div className="space-y-2">
              {battleHistory.map((battle) => (
                <div 
                  key={battle.id} 
                  className="rounded-xl p-3.5"
                  style={{ backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
                        {battle.opponent?.avatar ? (
                          <img src={battle.opponent.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className={`font-bold text-xs ${'text-white'}`}>{battle.opponent?.username?.[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${'text-white'}`}>
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
          <div className="relative rounded-2xl p-5 max-w-md w-full" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}>
            <h3 className={`text-lg font-bold mb-4 ${'text-white'}`}>
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
                          : 'text-gray-300'
                      }`}
                      style={inviteBuyIn !== amount ? { backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` } : {}}
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
                          : 'text-gray-300'
                      }`}
                      style={inviteDuration !== opt.value ? { backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="rounded-lg p-3" style={{ backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` }}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">Prize Pool</span>
                  <span className={`font-bold ${'text-white'}`}>${inviteBuyIn * 2}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Winner Takes (90%)</span>
                  <span className="text-green-500 font-bold">${formatMoney(inviteBuyIn * 2 * 0.9, 0)}</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowBattleInvite(false)}
                  className={`flex-1 py-2.5 font-semibold rounded-lg transition-all text-sm ${'text-gray-400'}`}
                  style={{ backgroundColor: '#111', border: `1px solid ${'#1a1a1a'}` }}
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
