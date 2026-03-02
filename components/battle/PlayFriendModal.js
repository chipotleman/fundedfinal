import { useState, useEffect } from 'react';

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const DURATION_OPTIONS = [
  { label: '30 Min', value: 30 },
  { label: '1 Hour', value: 1 },
  { label: '1 Day', value: 24 },
  { label: '3 Days', value: 72 },
  { label: '1 Week', value: 168 },
];

export default function PlayFriendModal({ isOpen, onClose, friends = [], onInviteSent }) {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [buyIn, setBuyIn] = useState(10);
  const [duration, setDuration] = useState(24);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setSearchQuery('');
      setSearchResults([]);
      setSent(false);
      setError('');
    }
  }, [isOpen]);

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
      if (onInviteSent) onInviteSent();
      setTimeout(() => onClose(), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const addFriend = async (userId) => {
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: userId }),
      });
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, requestSent: true } : u));
    } catch {}
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter(f =>
    !searchQuery || f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex-shrink-0">
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
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                placeholder="Search friends or find users..."
              />
              <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Search Results</label>
                <div className="space-y-1">
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm">{user.username?.[0]?.toUpperCase()}</span>}
                        </div>
                        <span className="text-white text-sm font-medium">{user.username}</span>
                      </div>
                      <button
                        onClick={() => addFriend(user.id)}
                        disabled={user.requestSent}
                        className={`text-xs px-3 py-1 rounded-lg font-medium ${user.requestSent ? 'bg-gray-700 text-gray-500' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
                      >
                        {user.requestSent ? 'Sent' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Your Friends</label>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">
                    {friends.length === 0 ? 'No friends yet. Search for users above!' : 'No friends match your search'}
                  </p>
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
                          : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/60'
                      }`}
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
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${buyIn === amount ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${duration === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={sendInvite}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50"
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
