import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import TopNavbar from '../components/TopNavbar';

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
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
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
          <h1 className="text-3xl font-bold mb-6">Friends</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('friends')}
                  className={`flex-1 py-2 rounded-lg font-medium transition ${activeTab === 'friends' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  Friends ({friends.length})
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex-1 py-2 rounded-lg font-medium transition relative ${activeTab === 'requests' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  Requests
                  {requests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                      {requests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 py-2 rounded-lg font-medium transition ${activeTab === 'search' ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}
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
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
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
                            className={`flex items-center gap-3 p-4 cursor-pointer transition ${selectedChat?.id === friend.id ? 'bg-purple-600/20' : 'hover:bg-gray-800'}`}
                          >
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                              {friend.avatar ? (
                                <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xl">{friend.username?.charAt(0)?.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{friend.username}</p>
                              <p className="text-sm text-gray-400">{friend.battleWins || 0}W - {friend.battleLosses || 0}L</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/profile/${friend.id}`); }}
                              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg"
                            >
                              View
                            </button>
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
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                                {request.sender?.avatar ? (
                                  <img src={request.sender.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  request.sender?.username?.charAt(0)?.toUpperCase()
                                )}
                              </div>
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
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                                {request.receiver?.avatar ? (
                                  <img src={request.receiver.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  request.receiver?.username?.charAt(0)?.toUpperCase()
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{request.receiver?.username}</p>
                                <p className="text-xs text-gray-500">Pending</p>
                              </div>
                              <button onClick={() => handleWithdrawRequest(request.id)} className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">Withdraw</button>
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                              {user.avatar ? (
                                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                user.username?.charAt(0)?.toUpperCase()
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{user.username}</p>
                              <p className="text-xs text-gray-400">{user.battleWins || 0}W - {user.battleLosses || 0}L</p>
                            </div>
                            <button onClick={() => handleAddFriend(user.id)} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm">Add</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl h-[600px] flex flex-col">
                {selectedChat ? (
                  <>
                    <div className="flex items-center gap-3 p-4 border-b border-gray-800">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center overflow-hidden">
                        {selectedChat.avatar ? (
                          <img src={selectedChat.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          selectedChat.username?.charAt(0)?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedChat.username}</p>
                        <p className="text-xs text-gray-400">{selectedChat.battleWins || 0}W - {selectedChat.battleLosses || 0}L</p>
                      </div>
                      <button
                        onClick={() => router.push(`/battle?invite=${selectedChat.id}`)}
                        className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
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
                                  ? 'bg-purple-600 rounded-br-md'
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
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
                        />
                        <button
                          type="submit"
                          disabled={!messageInput.trim() || sendingMessage}
                          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition"
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
