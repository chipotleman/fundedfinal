import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';

const SkeletonCard = () => (
  <div className="animate-pulse bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-700"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-700 rounded w-24"></div>
        <div className="h-3 bg-gray-700 rounded w-16"></div>
      </div>
    </div>
  </div>
);

const SkeletonBattle = () => (
  <div className="animate-pulse min-w-[280px] bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
    <div className="flex justify-between items-center mb-3">
      <div className="h-3 bg-gray-700 rounded w-16"></div>
      <div className="h-3 bg-gray-700 rounded w-12"></div>
    </div>
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gray-700"></div>
        <div className="h-3 bg-gray-700 rounded w-16"></div>
      </div>
      <div className="h-6 bg-gray-700 rounded w-8"></div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gray-700"></div>
        <div className="h-3 bg-gray-700 rounded w-16"></div>
      </div>
    </div>
  </div>
);

const UserAvatar = ({ user, size = 'md', onClick }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };
  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all`}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-medium">{user?.username?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
  );
};

const LiveBattleCard = ({ battle, onWatch, onUserClick }) => {
  const remaining = battle.remainingMs || 0;
  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const user1Winning = parseFloat(battle.user1?.pnl || 0) > parseFloat(battle.user2?.pnl || 0);
  const user2Winning = parseFloat(battle.user2?.pnl || 0) > parseFloat(battle.user1?.pnl || 0);

  return (
    <div 
      onClick={() => onWatch(battle)}
      className="min-w-[280px] sm:min-w-[320px] bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:border-purple-500/50 cursor-pointer transition-all group"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-red-400 font-medium uppercase">Live</span>
        </div>
        <span className="text-xs text-gray-400">{timeDisplay} left</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-1">
          <UserAvatar user={battle.user1} onClick={(e) => { e.stopPropagation(); onUserClick(battle.user1); }} />
          <span className="text-xs font-medium truncate max-w-[80px]">{battle.user1?.username || 'Player 1'}</span>
          <span className={`text-xs font-bold ${parseFloat(battle.user1?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {parseFloat(battle.user1?.pnl || 0) >= 0 ? '+' : ''}{battle.user1?.pnlPercent || '0.0'}%
          </span>
          {user1Winning && <span className="text-[10px] text-yellow-400">LEADING</span>}
        </div>

        <div className="flex flex-col items-center px-4">
          <span className="text-lg font-bold text-gray-400">VS</span>
          <span className="text-xs text-purple-400 mt-1">${battle.potSize}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <UserAvatar user={battle.user2} onClick={(e) => { e.stopPropagation(); onUserClick(battle.user2); }} />
          <span className="text-xs font-medium truncate max-w-[80px]">{battle.user2?.username || 'Player 2'}</span>
          <span className={`text-xs font-bold ${parseFloat(battle.user2?.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {parseFloat(battle.user2?.pnl || 0) >= 0 ? '+' : ''}{battle.user2?.pnlPercent || '0.0'}%
          </span>
          {user2Winning && <span className="text-[10px] text-yellow-400">LEADING</span>}
        </div>
      </div>

      <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${battle.progressPercent || 0}%` }}></div>
      </div>
      
      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500 group-hover:text-purple-400 transition">Click to watch</span>
      </div>
    </div>
  );
};

const UserCard = ({ user, isFriend, session, onAction, compact = false }) => {
  const router = useRouter();
  
  const goToProfile = () => router.push(`/profile/${user.id}`);
  
  return (
    <div className={`bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-purple-500/30 transition-all ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size={compact ? 'md' : 'lg'} onClick={goToProfile} />
        <div className="flex-1 min-w-0">
          <p 
            onClick={goToProfile}
            className="font-medium truncate cursor-pointer hover:text-purple-400 transition"
          >
            {user.username}
          </p>
          <p className="text-xs text-gray-400">
            <span className="text-green-400">{user.battleWins || 0}W</span>
            {' - '}
            <span className="text-red-400">{user.battleLosses || 0}L</span>
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={goToProfile}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            title="View Profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          
          {isFriend ? (
            <>
              <button
                onClick={() => onAction('message', user)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-purple-600 transition"
                title="Message"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              <button
                onClick={() => onAction('battle', user)}
                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
                title="Challenge to Battle"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </>
          ) : session?.user?.id !== user.id && (
            <button
              onClick={() => onAction('add', user)}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
              title="Add Friend"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatModal = ({ friend, messages, onClose, onSend, messageInput, setMessageInput, sending, session }) => {
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <UserAvatar user={friend} />
          <div className="flex-1">
            <p className="font-semibold">{friend.username}</p>
            <p className="text-xs text-gray-400">{friend.battleWins || 0}W - {friend.battleLosses || 0}L</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No messages yet. Say hi!</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === session?.user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.senderId === session?.user?.id ? 'bg-purple-600 rounded-br-md' : 'bg-gray-700 rounded-bl-md'}`}>
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[10px] opacity-50 mt-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={onSend} className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 text-sm"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || sending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition text-sm"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WatchBattleModal = ({ battle, onClose }) => {
  if (!battle) return null;

  const remaining = battle.remainingMs || 0;
  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;

  const user1Balance = parseFloat(battle.user1?.balance || 0);
  const user2Balance = parseFloat(battle.user2?.balance || 0);
  const user1Pnl = parseFloat(battle.user1?.pnl || 0);
  const user2Pnl = parseFloat(battle.user2?.pnl || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-white font-semibold">LIVE BATTLE</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="text-center mb-6">
            <p className="text-3xl font-bold text-green-400">${battle.potSize}</p>
            <p className="text-gray-400 text-sm mt-1">Prize Pool</p>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 border-2 border-blue-500 flex items-center justify-center overflow-hidden mb-2">
                {battle.user1?.avatar ? (
                  <img src={battle.user1.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-blue-400">{battle.user1?.username?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>
              <p className="font-medium text-sm truncate">{battle.user1?.username || 'Player 1'}</p>
              <p className="text-lg font-bold mt-1">${user1Balance.toFixed(2)}</p>
              <p className={`text-sm ${user1Pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {user1Pnl >= 0 ? '+' : ''}{battle.user1?.pnlPercent || '0.0'}%
              </p>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-gray-500">VS</span>
            </div>

            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 border-2 border-pink-500 flex items-center justify-center overflow-hidden mb-2">
                {battle.user2?.avatar ? (
                  <img src={battle.user2.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-pink-400">{battle.user2?.username?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>
              <p className="font-medium text-sm truncate">{battle.user2?.username || 'Player 2'}</p>
              <p className="text-lg font-bold mt-1">${user2Balance.toFixed(2)}</p>
              <p className={`text-sm ${user2Pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {user2Pnl >= 0 ? '+' : ''}{battle.user2?.pnlPercent || '0.0'}%
              </p>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Time Remaining</span>
              <span className="font-mono text-white">{timeDisplay}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" 
                style={{ width: `${battle.progressPercent || 0}%` }}
              ></div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">{Math.round(battle.progressPercent || 0)}% complete</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SocialPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [liveBattles, setLiveBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [loadingBattles, setLoadingBattles] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [watchBattle, setWatchBattle] = useState(null);
  
  const [activeTab, setActiveTab] = useState('friends');

  const friendIds = new Set(friends.map(f => f.id));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    fetchLiveBattles();
    const battleInterval = setInterval(fetchLiveBattles, 10000);
    return () => clearInterval(battleInterval);
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriends();
      fetchRequests();
    }
  }, [session]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => fetchMessages(selectedChat.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  const fetchLiveBattles = async () => {
    try {
      const res = await fetch('/api/battles/live');
      if (res.ok) {
        const data = await res.json();
        setLiveBattles(data.battles || []);
      }
    } catch (error) {
      console.error('Error fetching live battles:', error);
    } finally {
      setLoadingBattles(false);
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
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/friends/requests', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const debounceRef = useRef(null);
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleAddFriend = async (userId) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: userId }),
      });
      if (res.ok) {
        setSearchResults(prev => prev.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        fetchFriends();
        fetchRequests();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await fetch(`/api/friends/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'decline' }),
      });
      fetchRequests();
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  const fetchMessages = async (friendId) => {
    try {
      const res = await fetch(`/api/messages?friendId=${friendId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChat) return;
    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: selectedChat.id, content: messageInput.trim() }),
      });
      if (res.ok) {
        setMessageInput('');
        fetchMessages(selectedChat.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUserAction = (action, user) => {
    switch (action) {
      case 'message':
        setSelectedChat(user);
        break;
      case 'battle':
        router.push(`/battle?invite=${user.id}`);
        break;
      case 'add':
        handleAddFriend(user.id);
        break;
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black">
        <TopNavbar />
        <div className="max-w-6xl mx-auto px-4 pt-20">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-48"></div>
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3].map(i => <SkeletonBattle key={i} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>Battle Hub | Piks</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <TopNavbar />
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">Battle Hub</h1>

          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">Live Battles</h2>
              {liveBattles.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  {liveBattles.length} live
                </span>
              )}
            </div>
            
            {loadingBattles ? (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[1, 2, 3].map(i => <SkeletonBattle key={i} />)}
              </div>
            ) : liveBattles.length === 0 ? (
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-400 mb-3">No live battles right now</p>
                <button
                  onClick={() => router.push('/battle')}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
                >
                  Start a Battle
                </button>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {liveBattles.map(battle => (
                  <LiveBattleCard
                    key={battle.id}
                    battle={battle}
                    onWatch={setWatchBattle}
                    onUserClick={(user) => user?.id && router.push(`/profile/${user.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 placeholder-gray-500"
              />
            </div>

            {searchQuery.length >= 2 && (
              <div className="mb-6">
                <h3 className="text-sm text-gray-400 mb-3">Search Results</h3>
                {searching ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-gray-500 text-sm">No users found</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {searchResults.map(user => (
                      <UserCard
                        key={user.id}
                        user={user}
                        isFriend={friendIds.has(user.id)}
                        session={session}
                        onAction={handleUserAction}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-2.5 rounded-xl font-medium transition text-sm ${activeTab === 'friends' ? 'bg-purple-600' : 'bg-gray-800/60 hover:bg-gray-700/60'}`}
              >
                Friends ({friends.length})
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-2.5 rounded-xl font-medium transition text-sm relative ${activeTab === 'requests' ? 'bg-purple-600' : 'bg-gray-800/60 hover:bg-gray-700/60'}`}
              >
                Requests
                {requests.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                    {requests.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'friends' && (
              loadingFriends ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : friends.length === 0 ? (
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-gray-400">No friends yet. Search for users above!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {friends.map(friend => (
                    <UserCard
                      key={friend.id}
                      user={friend}
                      isFriend={true}
                      session={session}
                      onAction={handleUserAction}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'requests' && (
              requests.length === 0 ? (
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map(request => (
                    <div key={request.id} className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 flex items-center gap-3">
                      <UserAvatar user={request.sender} />
                      <div className="flex-1">
                        <p className="font-medium">{request.sender?.username}</p>
                        <p className="text-xs text-gray-400">wants to be friends</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        </div>

        {selectedChat && (
          <ChatModal
            friend={selectedChat}
            messages={messages}
            onClose={() => setSelectedChat(null)}
            onSend={handleSendMessage}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            sending={sendingMessage}
            session={session}
          />
        )}

        {watchBattle && (
          <WatchBattleModal
            battle={watchBattle}
            onClose={() => setWatchBattle(null)}
          />
        )}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
