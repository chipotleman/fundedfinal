import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const STATUS_COLORS = {
  active: 'bg-green-500',
  pending: 'bg-yellow-500',
  completed: 'bg-zinc-500',
};

const STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending',
  completed: 'Completed',
};

export default function AdminBattles() {
  const router = useRouter();
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [impersonating, setImpersonating] = useState(null);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    if (!isLoggedIn) {
      router.push('/admin-panel/login');
      return;
    }
    fetchBattles();
  }, [router, statusFilter]);

  const fetchBattles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin-panel/battles?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setBattles(data);
      }
    } catch (error) {
      console.error('Fetch battles error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAs = async (battle, fakeOpponent) => {
    if (!fakeOpponent?.hasCredentials) {
      alert('This fake opponent does not have login credentials. Please set up credentials in the Matchups tab first.');
      return;
    }

    setImpersonating(fakeOpponent.id);

    try {
      const response = await fetch('/api/admin-panel/battles/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fakeOpponentId: fakeOpponent.id,
          matchupId: battle.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to impersonate');
        return;
      }

      const { loginUrl } = await response.json();

      window.open(loginUrl, '_blank', 'width=1200,height=800');
    } catch (error) {
      console.error('Impersonate error:', error);
      alert('Failed to start impersonation');
    } finally {
      setImpersonating(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const formatBalance = (value) => {
    if (!value) return '$0';
    return `$${parseFloat(value).toLocaleString()}`;
  };

  const getTimeRemaining = (endsAt) => {
    if (!endsAt) return '-';
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Battle Management</h1>
            <p className="text-zinc-400 mt-1">View and manage all battles, play as fake opponents</p>
          </div>
          <button
            onClick={() => router.push('/admin-panel')}
            className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Back to Admin
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {['open', 'active', 'completed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-green-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {status === 'open' ? 'Open Battles' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : battles.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-12 text-center">
            <p className="text-zinc-400">No battles found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {battles.map((battle) => (
              <div
                key={battle.id}
                className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[battle.status]} text-black`}>
                      {STATUS_LABELS[battle.status]}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {battle.challengeType} | {battle.durationType?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-zinc-400">Time Remaining</p>
                    <p className="text-white font-medium">{getTimeRemaining(battle.endsAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-xs text-zinc-400 mb-2">Player 1</p>
                    <div className="flex items-center gap-3">
                      {battle.user1?.avatar ? (
                        <img
                          src={battle.user1.avatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                          {battle.user1?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {battle.user1?.username || 'Unknown'}
                          {battle.user1?.isFake && (
                            <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">FAKE</span>
                          )}
                        </p>
                        <p className="text-sm text-zinc-400">Balance: {formatBalance(battle.user1FinalBalance || battle.startingBalance)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">VS</p>
                      <p className="text-sm text-zinc-400 mt-1">Pot: {formatBalance(battle.potSize)}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <p className="text-xs text-zinc-400 mb-2">Player 2</p>
                    <div className="flex items-center gap-3">
                      {(battle.user2?.avatar || battle.fakeOpponent?.avatar) ? (
                        <img
                          src={battle.user2?.avatar || battle.fakeOpponent?.avatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400">
                          {(battle.user2?.username || battle.fakeOpponent?.username)?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {battle.user2?.username || battle.fakeOpponent?.displayName || 'Unknown'}
                          {(battle.user2?.isFake || battle.fakeOpponent) && (
                            <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">FAKE</span>
                          )}
                        </p>
                        <p className="text-sm text-zinc-400">Balance: {formatBalance(battle.user2FinalBalance || battle.startingBalance)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">
                    Started: {formatDate(battle.startsAt)} | Ends: {formatDate(battle.endsAt)}
                  </div>

                  {battle.hasFakeOpponent && battle.fakeOpponent && battle.status === 'active' && (
                    <button
                      onClick={() => handlePlayAs(battle, battle.fakeOpponent)}
                      disabled={impersonating === battle.fakeOpponent.id}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        battle.fakeOpponent.hasCredentials
                          ? 'bg-green-500 text-black hover:bg-green-400'
                          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      {impersonating === battle.fakeOpponent.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          Opening...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          PLAY AS {battle.fakeOpponent.displayName || battle.fakeOpponent.username}
                        </>
                      )}
                    </button>
                  )}

                  {battle.hasFakeOpponent && battle.fakeOpponent && !battle.fakeOpponent.hasCredentials && (
                    <span className="text-xs text-orange-400">
                      No credentials - Set up in Matchups tab
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
