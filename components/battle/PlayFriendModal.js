import { useState, useEffect, useRef } from 'react';

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const DURATION_OPTIONS = [
  { label: '30 Min', value: 30 },
  { label: '1 Hour', value: 1 },
  { label: '1 Day', value: 24 },
  { label: '3 Days', value: 72 },
  { label: '1 Week', value: 168 },
];

const INVITE_EXPIRY_HOURS = 24;

export default function PlayFriendModal({ isOpen, onClose, friends = [], onInviteSent, onSwitchToPrivate }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [buyIn, setBuyIn] = useState(10);
  const [duration, setDuration] = useState(24);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [inviteCountdown, setInviteCountdown] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setSearchQuery('');
      setSearchResults([]);
      setSent(false);
      setError('');
      setInviteCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const friendIds = friends.map(f => f.id);

  const isFriend = (userId) => friendIds.includes(userId);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch {} finally {
      setSearching(false);
    }
  };

  const sendInvite = async () => {
    if (!selectedFriend) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/battles/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedFriend.id,
          buyIn,
          duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send invite');
        return;
      }
      setSent(true);
      const expirySeconds = INVITE_EXPIRY_HOURS * 3600;
      setInviteCountdown(expirySeconds);
      countdownRef.current = setInterval(() => {
        setInviteCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      if (onInviteSent) onInviteSent();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const addFriend = async (userId) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: userId }),
      });
      if (res.ok) {
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, requestSent: true } : u));
      }
    } catch {}
  };

  const handleSwitchToPrivate = () => {
    onClose();
    if (onSwitchToPrivate) onSwitchToPrivate();
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter(f =>
    !searchQuery || f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const nonFriendResults = searchResults.filter(u => !isFriend(u.id));
  const friendResults = searchResults.filter(u => isFriend(u.id));

  const formatCountdown = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }} onClick={e => e.stopPropagation()}>
        <div className="p-5 flex-shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Play a Friend</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-white font-bold text-lg">Invite Sent!</h3>
            <p className="text-gray-400 text-sm mt-1">Waiting for {selectedFriend?.username} to accept</p>
            {inviteCountdown > 0 ? (
              <div className="mt-4">
                <div className="w-full rounded-full h-1.5 mb-2" style={{ backgroundColor: '#1a1a1a' }}>
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(inviteCountdown / (INVITE_EXPIRY_HOURS * 3600)) * 100}%` }}
                  ></div>
                </div>
                <p className="text-gray-500 text-xs">Expires in {formatCountdown(inviteCountdown)}</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-yellow-400 text-sm">Invite expired. Your friend may be offline.</p>
                <button
                  onClick={() => { setSent(false); setError(''); }}
                  className="mt-3 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-3 text-gray-500 text-xs hover:text-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                style={{ backgroundColor: '#111', border: '1px solid #1a1a1a', fontSize: '16px' }}
                placeholder="Search friends or find users..."
              />
              <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {searching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {searchQuery.length >= 2 && friendResults.length > 0 && (
              <div>
                <label className="text-xs font-medium text-green-400 uppercase tracking-wider mb-2 block">Friends Found</label>
                <div className="space-y-1">
                  {friendResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedFriend(user)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all ${
                        selectedFriend?.id === user.id
                          ? 'bg-blue-600/20 border border-blue-500/40'
                          : 'border border-transparent'
                      }`}
                      style={selectedFriend?.id !== user.id ? { backgroundColor: '#111' } : {}}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm">{user.username?.[0]?.toUpperCase()}</span>}
                      </div>
                      <span className="text-white text-sm font-medium flex-1 text-left">{user.username}</span>
                      {selectedFriend?.id === user.id && (
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchQuery.length >= 2 && nonFriendResults.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Other Users</label>
                <div className="space-y-1.5">
                  {nonFriendResults.map(user => (
                    <div key={user.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm">{user.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div>
                            <span className="text-white text-sm font-medium">{user.username}</span>
                            <span className="text-gray-500 text-xs block">Not a friend</span>
                          </div>
                        </div>
                        <button
                          onClick={() => addFriend(user.id)}
                          disabled={user.requestSent}
                          className={`text-xs px-3 py-1 rounded-lg font-medium ${user.requestSent ? 'bg-gray-700 text-gray-500' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
                        >
                          {user.requestSent ? 'Request Sent' : 'Add Friend'}
                        </button>
                      </div>
                      {!user.requestSent && (
                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
                          <p className="text-gray-500 text-xs mb-1.5">Want to play now without adding?</p>
                          <button
                            onClick={handleSwitchToPrivate}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 transition-colors flex items-center gap-1.5"
                          >
                            <span>🔑</span>
                            <span>Create Private Match Code</span>
                          </button>
                        </div>
                      )}
                      {user.requestSent && (
                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
                          <p className="text-gray-500 text-xs">Friend request sent! Once accepted, you can challenge them. Or use a Private Match code instead:</p>
                          <button
                            onClick={handleSwitchToPrivate}
                            className="mt-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 transition-colors flex items-center gap-1.5"
                          >
                            <span>🔑</span>
                            <span>Create Private Match Code</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">No users found for "{searchQuery}"</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Your Friends</label>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-2">
                    {friends.length === 0 ? 'No friends yet. Search for users above!' : 'No friends match your search'}
                  </p>
                  {friends.length === 0 && (
                    <button
                      onClick={handleSwitchToPrivate}
                      className="text-orange-400 text-xs hover:text-orange-300 transition-colors"
                    >
                      Or create a Private Match code to share →
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredFriends.map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => setSelectedFriend(friend)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        selectedFriend?.id === friend.id
                          ? 'bg-blue-600/20 border border-blue-500/40'
                          : 'border border-transparent'
                      }`}
                      style={selectedFriend?.id !== friend.id ? { backgroundColor: '#111' } : {}}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm">{friend.username?.[0]?.toUpperCase()}</span>}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{friend.username}</div>
                        <div className="text-gray-500 text-xs">{friend.battleWins || 0}W - {friend.battleLosses || 0}L</div>
                      </div>
                      {selectedFriend?.id === friend.id && (
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFriend && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => (
                      <button
                        key={amount}
                        onClick={() => setBuyIn(amount)}
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${buyIn === amount ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                        style={buyIn !== amount ? { backgroundColor: '#111', border: '1px solid #1a1a1a' } : {}}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Duration</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${duration === opt.value ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                        style={duration !== opt.value ? { backgroundColor: '#111', border: '1px solid #1a1a1a' } : {}}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={sendInvite}
                  disabled={sending}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {sending ? 'Sending...' : `Challenge ${selectedFriend.username}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
