import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import FindingMatchup from '../components/FindingMatchup';

const DURATION_OPTIONS = [
  { value: '30_min', label: '30 Min Flash', description: 'Quick battle', icon: '⚡', hours: 0.5 },
  { value: '1_hour', label: '1 Hour', description: 'Fast paced', icon: '🔥', hours: 1 },
  { value: '1_day', label: '1 Day', description: 'Standard battle', icon: '📅', recommended: true, hours: 24 },
  { value: '3_days', label: '3 Days', description: 'Extended battle', icon: '📆', hours: 72 },
  { value: '1_week', label: '1 Week', description: 'Tournament style', icon: '🏆', hours: 168 },
];

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];

export default function BattlePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [step, setStep] = useState('select');
  const [battleMode, setBattleMode] = useState('random');
  const [selectedDuration, setSelectedDuration] = useState('1_day');
  const [buyIn, setBuyIn] = useState(10);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMatchup, setActiveMatchup] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (session?.user?.id) {
      fetchProfileAndMatchup();
      fetchFriends();
      fetchPendingInvites();
    }
  }, [session, status, router]);

  const fetchProfileAndMatchup = async () => {
    try {
      const [profileRes, matchupRes] = await Promise.all([
        fetch(`/api/profiles/${session.user.id}`),
        fetch('/api/matchups/current')
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      if (matchupRes.ok) {
        const matchupData = await matchupRes.json();
        if (matchupData.matchup) {
          setActiveMatchup(matchupData.matchup);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const res = await fetch('/api/battles/invite', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(data.invites || []);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedFriend) return;
    setSending(true);
    const durationHours = DURATION_OPTIONS.find(d => d.value === selectedDuration)?.hours || 24;
    try {
      const res = await fetch('/api/battles/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: selectedFriend.id,
          buyIn,
          duration: durationHours,
        }),
      });
      if (res.ok) {
        setSelectedFriend(null);
        fetchPendingInvites();
        alert('Battle invite sent!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      const res = await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        fetchPendingInvites();
        router.push('/');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await fetch(`/api/battles/invite/${inviteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'decline' }),
      });
      fetchPendingInvites();
    } catch (error) {
      console.error('Error declining invite:', error);
    }
  };

  const startBattle = () => {
    if (!profile) return;
    setStep('finding');
  };

  const handleMatchFound = (matchup, opponent) => {
    router.push('/');
  };

  const handleCancel = () => {
    setStep('select');
  };

  const receivedInvites = pendingInvites.filter(inv => inv.receiverId === session?.user?.id);
  const sentInvites = pendingInvites.filter(inv => inv.senderId === session?.user?.id);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (activeMatchup) {
    return (
      <div className="min-h-screen bg-black">
        <TopNavbar />
        <div className="pt-20 px-4 text-center max-w-md mx-auto">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30 mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Battle In Progress</h1>
            <p className="text-gray-400 mb-4">You already have an active battle</p>
            <div className="text-sm text-gray-500 mb-4">
              Ends: {new Date(activeMatchup.endsAt).toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === 'finding' && profile) {
    return (
      <FindingMatchup
        userId={session.user.id}
        profile={profile}
        durationType={selectedDuration}
        onMatchFound={handleMatchFound}
        onCancel={handleCancel}
      />
    );
  }

  if (!profile || !profile.challenge) {
    return (
      <div className="min-h-screen bg-black">
        <TopNavbar />
        <div className="pt-20 px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Active Challenge</h1>
          <p className="text-gray-400 mb-6">Purchase a challenge to start battling other players.</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            View Challenges
          </button>
        </div>
      </div>
    );
  }

  const challengeData = typeof profile.challenge === 'string' 
    ? JSON.parse(profile.challenge) 
    : profile.challenge;
  
  const bankroll = parseFloat(profile.bankroll) || 0;
  const challengeType = challengeData?.challengeType || 'Starter';

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar />
      
      <div className="pt-20 px-4 max-w-2xl mx-auto pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Start a Battle</h1>
          <p className="text-gray-400">Challenge a friend or find a random opponent</p>
        </div>

        {receivedInvites.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Incoming Battle Invites
            </h2>
            <div className="space-y-2">
              {receivedInvites.map((invite) => (
                <div key={invite.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-lg overflow-hidden">
                      {invite.sender?.avatar ? (
                        <img src={invite.sender.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        invite.sender?.username?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{invite.sender?.username || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">${invite.buyIn} • {invite.duration}h</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptInvite(invite.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">Accept</button>
                    <button onClick={() => handleDeclineInvite(invite.id)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setBattleMode('random')}
            className={`flex-1 py-3 rounded-xl font-medium transition ${battleMode === 'random' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            🎲 Random Match
          </button>
          <button
            onClick={() => setBattleMode('friend')}
            className={`flex-1 py-3 rounded-xl font-medium transition ${battleMode === 'friend' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            👥 Challenge Friend
          </button>
        </div>

        {battleMode === 'friend' && (
          <>
            <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">Select Opponent</h3>
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 mb-3"
              />
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => { setSelectedFriend(user); setSearchResults([]); setSearchQuery(''); }}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                        {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.username?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-white">{user.username}</span>
                    </div>
                  ))}
                </div>
              )}
              {friends.length > 0 && !searchQuery && (
                <>
                  <p className="text-sm text-gray-400 mb-2">Your Friends</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        onClick={() => setSelectedFriend(friend)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedFriend?.id === friend.id ? 'bg-purple-600/30 border border-purple-500' : 'bg-gray-800 hover:bg-gray-700'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                          {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-white">{friend.username}</span>
                        <span className="text-xs text-gray-400 ml-auto">{friend.battleWins || 0}W-{friend.battleLosses || 0}L</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {selectedFriend && (
                <div className="mt-3 p-3 bg-purple-600/20 border border-purple-500 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                      {selectedFriend.avatar ? <img src={selectedFriend.avatar} alt="" className="w-full h-full object-cover" /> : selectedFriend.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{selectedFriend.username}</p>
                      <p className="text-xs text-gray-400">{selectedFriend.battleWins || 0}W - {selectedFriend.battleLosses || 0}L</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedFriend(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">Buy-In Amount</h3>
              <div className="flex flex-wrap gap-2">
                {BUY_IN_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBuyIn(amount)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${buyIn === amount ? 'bg-green-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-gray-400">Prize Pool: <span className="text-green-400 font-semibold">${buyIn * 2}</span></span>
                <span className="text-gray-400">Winner Takes: <span className="text-yellow-400 font-semibold">${(buyIn * 2 * 0.9).toFixed(0)}</span></span>
              </div>
            </div>
          </>
        )}

        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3">Battle Duration</h3>
          <div className="space-y-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedDuration(option.value)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                  selectedDuration === option.value ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{option.icon}</span>
                  <div className="text-left">
                    <p className={`font-medium ${selectedDuration === option.value ? 'text-white' : 'text-gray-300'}`}>
                      {option.label}
                      {option.recommended && <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Recommended</span>}
                    </p>
                  </div>
                </div>
                {selectedDuration === option.value && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {battleMode === 'random' ? (
          <button
            onClick={startBattle}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-blue-500 hover:to-purple-500 transition"
          >
            Find Random Opponent
          </button>
        ) : (
          <button
            onClick={handleSendInvite}
            disabled={!selectedFriend || sending}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition ${selectedFriend && !sending ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700' : 'bg-gray-700 cursor-not-allowed text-gray-400'}`}
          >
            {sending ? 'Sending...' : selectedFriend ? `Send Invite to ${selectedFriend.username}` : 'Select an Opponent'}
          </button>
        )}

        <button onClick={() => router.push('/')} className="w-full mt-3 py-3 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 transition">
          Cancel
        </button>

        {sentInvites.length > 0 && (
          <div className="mt-6">
            <h3 className="text-white font-semibold mb-3">Pending Invites Sent</h3>
            <div className="space-y-2">
              {sentInvites.map((invite) => (
                <div key={invite.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                      {invite.receiver?.avatar ? <img src={invite.receiver.avatar} alt="" className="w-full h-full object-cover" /> : invite.receiver?.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-white">{invite.receiver?.username}</span>
                  </div>
                  <span className="text-yellow-400 text-sm">Waiting...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
