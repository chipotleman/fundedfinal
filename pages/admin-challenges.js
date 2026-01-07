import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function AdminChallenges() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const { data: session } = useSession();
  const router = useRouter();
  const adminEmail = 'mathewbaldwin13@yahoo.com';

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/reset-user-challenge', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session === undefined) return;
    
    if (!session || session.user.email !== adminEmail) {
      alert('Access denied.');
      router.push('/');
      return;
    }

    fetchUsers();
  }, [session, router]);

  const handleAction = async (userId, action, matchupId = null, poolId = null) => {
    setActionLoading(`${userId}-${action}`);
    try {
      const res = await fetch('/api/admin/reset-user-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, action, matchupId, poolId }),
      });

      if (res.ok) {
        await fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to perform action');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to perform action');
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#a020f0', fontSize: '2rem' }}>Challenge Manager</h1>
          <button
            onClick={() => router.push('/admin')}
            style={{
              backgroundColor: '#333',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Back to Admin
          </button>
        </div>

        <p style={{ color: '#888', marginBottom: '20px' }}>
          Reset users from 1v1 matchups, queues, or pools for testing purposes. Only users with active challenges are shown.
        </p>

        {users.length === 0 ? (
          <div style={{
            backgroundColor: '#111',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px solid #333'
          }}>
            <p style={{ color: '#888' }}>No users are currently in active challenges or pools.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  backgroundColor: '#111',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #333',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h3 style={{ color: '#fff', margin: '0 0 5px 0' }}>
                      {user.username || 'No username'}
                    </h3>
                    <p style={{ color: '#888', margin: '0', fontSize: '14px' }}>{user.email}</p>
                    <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '12px' }}>ID: {user.id}</p>
                  </div>

                  <button
                    onClick={() => handleAction(user.id, 'reset_all')}
                    disabled={actionLoading === `${user.id}-reset_all`}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#fff',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      opacity: actionLoading === `${user.id}-reset_all` ? 0.5 : 1,
                    }}
                  >
                    {actionLoading === `${user.id}-reset_all` ? 'Resetting...' : 'Reset All'}
                  </button>
                </div>

                <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {user.queueEntry && (
                    <div style={{
                      backgroundColor: '#1a1a2e',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>In Queue</span>
                        <span style={{ color: '#888', marginLeft: '10px' }}>
                          {user.queueEntry.challengeType?.toUpperCase()} - {user.queueEntry.durationType}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAction(user.id, 'leave_queue')}
                        disabled={actionLoading === `${user.id}-leave_queue`}
                        style={{
                          backgroundColor: '#f59e0b',
                          color: '#000',
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          opacity: actionLoading === `${user.id}-leave_queue` ? 0.5 : 1,
                        }}
                      >
                        {actionLoading === `${user.id}-leave_queue` ? '...' : 'Remove from Queue'}
                      </button>
                    </div>
                  )}

                  {user.matchup && (
                    <div style={{
                      backgroundColor: '#1e1a2e',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>1v1 Matchup</span>
                        <span style={{ color: '#888', marginLeft: '10px' }}>
                          Status: {user.matchup.status} | {user.matchup.challengeType?.toUpperCase()}
                        </span>
                        <span style={{ color: '#666', marginLeft: '10px', fontSize: '12px' }}>
                          Balance: ${user.matchup.user1Id === user.id 
                            ? parseFloat(user.matchup.user1Balance || 0).toFixed(2)
                            : parseFloat(user.matchup.user2Balance || 0).toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAction(user.id, 'cancel_matchup', user.matchup.id)}
                        disabled={actionLoading === `${user.id}-cancel_matchup`}
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          opacity: actionLoading === `${user.id}-cancel_matchup` ? 0.5 : 1,
                        }}
                      >
                        {actionLoading === `${user.id}-cancel_matchup` ? '...' : 'Cancel Matchup'}
                      </button>
                    </div>
                  )}

                  {user.pool && (
                    <div style={{
                      backgroundColor: '#1a2e1a',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>Pik Pool</span>
                        <span style={{ color: '#888', marginLeft: '10px' }}>
                          {user.pool.name} | Status: {user.pool.status}
                        </span>
                        <span style={{ color: '#666', marginLeft: '10px', fontSize: '12px' }}>
                          Balance: ${parseFloat(user.poolParticipant?.balance || 0).toFixed(2)} | 
                          Players: {user.pool.currentPlayers}/{user.pool.maxPlayers}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAction(user.id, 'leave_pool', null, user.pool.id)}
                        disabled={actionLoading === `${user.id}-leave_pool`}
                        style={{
                          backgroundColor: '#22c55e',
                          color: '#000',
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          opacity: actionLoading === `${user.id}-leave_pool` ? 0.5 : 1,
                        }}
                      >
                        {actionLoading === `${user.id}-leave_pool` ? '...' : 'Remove from Pool'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #333' }}>
          <h3 style={{ color: '#fff', marginTop: 0 }}>Quick Actions</h3>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Use these actions to test different UI states:
          </p>
          <ul style={{ color: '#888', fontSize: '14px', paddingLeft: '20px' }}>
            <li><strong>Remove from Queue</strong> - User was waiting for 1v1 match, puts them back to pre-challenge state</li>
            <li><strong>Cancel Matchup</strong> - Ends an active or pending 1v1 battle</li>
            <li><strong>Remove from Pool</strong> - Takes user out of a Pik Pool competition</li>
            <li><strong>Reset All</strong> - Clears all challenges for that user at once</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
