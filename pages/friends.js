import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';
import UserAvatar from '../components/UserAvatar';
import { useProfileCache } from '../contexts/ProfileCacheContext';

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const profileCache = useProfileCache();

  const goToProfile = (user) => {
    if (!user?.id) return;
    profileCache.prefetchProfile(user.id, {
      id: user.id,
      username: user.username,
      avatar: user.avatar || null,
    });
    router.push(`/profile/${user.id}`);
  };
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriends();
      fetchRequests();
      fetchSentRequests();
    }
  }, [session]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => fetchMessages(selectedChat.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setLoading(false);
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

  const fetchSentRequests = async () => {
    try {
      const res = await fetch('/api/friends/sent', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSentRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    }
  };

  const handleWithdrawRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      if (res.ok) {
        fetchSentRequests();
      }
    } catch (error) {
      console.error('Error withdrawing request:', error);
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
      console.error('Error searching:', error);
    }
  };

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
        alert('Friend request sent!');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PATCH',
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject' }),
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
        body: JSON.stringify({
          receiverId: selectedChat.id,
          content: messageInput.trim(),
        }),
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>Friends | Piks</title>
      </Head>
      <div className="min-h-screen bg-black text-white">
        <TopNavbar />
        <div className="max-w-6xl mx-auto px-4 pb-8" style={{ paddingTop: 'calc(var(--top-nav-height, 64px) + 24px)' }}>
          <h1 className="text-2xl font-bold text-white mb-6">Friends</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="flex gap-2 mb-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('friends')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'friends' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Friends ({friends.length})
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all relative ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Requests
                  {requests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {requests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Find
                </button>
              </div>

              {activeTab === 'search' && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              )}

              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
                {activeTab === 'friends' && (
                  <>
                    {friends.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No friends yet. Search for users to add!</p>
                    ) : (
                      <div className="divide-y divide-gray-800">
                        {friends.map((friend) => (
                          <div
                            key={friend.id}
                            onClick={() => setSelectedChat(friend)}
                            className={`flex items-center gap-3 p-4 cursor-pointer transition ${selectedChat?.id === friend.id ? 'bg-blue-600/20' : 'hover:bg-[#1a1a1a]'}`}
                          >
                            <UserAvatar user={friend} size={48} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{friend.username}</p>
                              <p className="text-sm text-gray-400">{friend.battleWins || 0}W - {friend.battleLosses || 0}L</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Mobile: icon-only message */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedChat(friend); }}
                                className="sm:hidden p-2 rounded-lg text-blue-400 hover:bg-blue-500/15"
                                title="Message"
                                aria-label="Message"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                              </button>
                              {/* Desktop: text message button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedChat(friend); }}
                                className="hidden sm:inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-400 hover:bg-blue-500/15"
                              >
                                Message
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); goToProfile(friend); }}
                                className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg text-gray-300 hover:bg-white/10"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/battle?play=${friend.id}`); }}
                                className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg text-purple-400 hover:bg-purple-500/15"
                              >
                                Play
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'requests' && (
                  <>
                    {requests.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Received</p>
                        <div className="divide-y divide-gray-800">
                          {requests.map((request) => (
                            <div key={request.id} className="flex items-center gap-3 p-4">
                              <UserAvatar user={request.sender} size={40} />
                              <div className="flex-1">
                                <p className="font-medium">{request.sender?.username}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleAcceptRequest(request.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm">Accept</button>
                                <button onClick={() => handleDeclineRequest(request.id)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Decline</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sentRequests.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider px-4 pt-3 pb-1">Sent</p>
                        <div className="divide-y divide-gray-800">
                          {sentRequests.map((request) => (
                            <div key={request.id} className="flex items-center gap-3 p-4">
                              <UserAvatar user={request.receiver} size={40} />
                              <div className="flex-1">
                                <p className="font-medium">{request.receiver?.username}</p>
                                <p className="text-xs text-gray-500">Pending</p>
                              </div>
                              <button onClick={() => handleWithdrawRequest(request.id)} className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">Cancel</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {requests.length === 0 && sentRequests.length === 0 && (
                      <p className="text-gray-400 text-center py-8">No pending requests</p>
                    )}
                  </>
                )}

                {activeTab === 'search' && (
                  <>
                    {searchQuery.length < 2 ? (
                      <p className="text-gray-400 text-center py-8">Type to search for users</p>
                    ) : searchResults.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No users found</p>
                    ) : (
                      <div className="divide-y divide-gray-800">
                        {searchResults.map((user) => (
                          <div key={user.id} className="flex items-center gap-3 p-4">
                            <UserAvatar user={user} size={40} />
                            <div className="flex-1">
                              <p className="font-medium">{user.username}</p>
                              <p className="text-xs text-gray-400">{user.battleWins || 0}W - {user.battleLosses || 0}L</p>
                            </div>
                            <button onClick={() => handleAddFriend(user.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">Add</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl h-[600px] flex flex-col">
                {selectedChat ? (
                  <>
                    <div className="flex items-center gap-3 p-4 border-b border-[#1a1a1a]">
                      <UserAvatar user={selectedChat} size={40} />
                      <div>
                        <p className="font-semibold">{selectedChat.username}</p>
                        <p className="text-xs text-gray-400">{selectedChat.battleWins || 0}W - {selectedChat.battleLosses || 0}L</p>
                      </div>
                      <button
                        onClick={() => router.push(`/battle?invite=${selectedChat.id}`)}
                        className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                      >
                        Challenge to Battle
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">No messages yet. Say hi!</p>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.senderId === session.user.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                                msg.senderId === session.user.id
                                  ? 'bg-blue-600 rounded-br-md'
                                  : 'bg-gray-700 rounded-bl-md'
                              }`}
                            >
                              <p>{msg.content}</p>
                              <p className="text-xs opacity-50 mt-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-[#1a1a1a]">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-3 bg-[#111] border border-[#1a1a1a] rounded-xl focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={!messageInput.trim() || sendingMessage}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition"
                        >
                          Send
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p className="text-xl mb-2">Select a friend to chat</p>
                      <p className="text-sm">Or search for new friends to add</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
