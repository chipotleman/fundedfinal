import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [battleAvatars, setBattleAvatars] = useState([]);
  const [newAvatarUrls, setNewAvatarUrls] = useState('');
  const [uploadingAvatars, setUploadingAvatars] = useState(false);
  const [mockUsers, setMockUsers] = useState([]);
  const [mockUserUrls, setMockUserUrls] = useState('');
  const [creatingMockUsers, setCreatingMockUsers] = useState(false);
  const [activeTab, setActiveTab] = useState('avatars');
  const { data: session } = useSession();
  const router = useRouter();
  const adminEmail = 'mathewbaldwin13@yahoo.com';

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchBattleAvatars = async () => {
    try {
      const res = await fetch('/api/admin/battle-avatars');
      const data = await res.json();
      setBattleAvatars(data.full || []);
    } catch (error) {
      console.error('Error fetching battle avatars:', error);
    }
  };

  const fetchMockUsers = async () => {
    try {
      const res = await fetch('/api/admin/mock-users', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMockUsers(data.mockUsers || []);
      }
    } catch (error) {
      console.error('Error fetching mock users:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!session || session.user.email !== adminEmail) {
        alert('Access denied.');
        router.push('/');
        return;
      }

      try {
        setEvaluations([]);
        await fetchBattleAvatars();
        await fetchMockUsers();
      } catch (error) {
        console.error(error.message);
      }
      setLoading(false);
    };

    if (session !== undefined) {
      fetchData();
    }
  }, [session, router]);

  const handleAddAvatars = async () => {
    if (!newAvatarUrls.trim()) return;
    setUploadingAvatars(true);
    try {
      const urls = newAvatarUrls.split('\n').map(u => u.trim()).filter(u => u);
      const res = await fetch('/api/admin/battle-avatars', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ urls }),
      });
      if (res.ok) {
        setNewAvatarUrls('');
        await fetchBattleAvatars();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      }
    } catch (error) {
      console.error('Error adding avatars:', error);
    }
    setUploadingAvatars(false);
  };

  const handleDeleteAvatar = async (id) => {
    try {
      const res = await fetch('/api/admin/battle-avatars', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchBattleAvatars();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
    }
  };

  const handleCreateMockUsers = async () => {
    if (!mockUserUrls.trim()) return;
    setCreatingMockUsers(true);
    try {
      const avatarUrls = mockUserUrls.split('\n').map(u => u.trim()).filter(u => u);
      const res = await fetch('/api/admin/mock-users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ avatarUrls }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Created ${data.created.length} mock users!`);
        setMockUserUrls('');
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create mock users');
      }
    } catch (error) {
      console.error('Error creating mock users:', error);
    }
    setCreatingMockUsers(false);
  };

  const handleDeleteMockUser = async (userId) => {
    if (!confirm('Delete this mock user?')) return;
    try {
      const res = await fetch('/api/admin/mock-users', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchMockUsers();
      } else if (res.status === 401) {
        alert('Please log in to the admin panel first.');
      }
    } catch (error) {
      console.error('Error deleting mock user:', error);
    }
  };

  const markAsPaid = async (id) => {
    try {
      // TODO: Create API route to update evaluation status when admin features are needed
      alert('Admin feature requires API implementation');
    } catch (error) {
      console.error(error.message);
      alert('Error marking as paid.');
    }
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading admin panel...</div>;
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#a020f0', fontSize: '2rem', textAlign: 'center' }}>Admin Panel</h1>
      <div style={{ maxWidth: '800px', margin: '0 auto', marginTop: '20px' }}>
        
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          borderBottom: '1px solid #333',
          paddingBottom: '15px'
        }}>
          <button
            onClick={() => setActiveTab('avatars')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'avatars' ? 'linear-gradient(135deg, #a020f0, #7c3aed)' : '#222',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Battle Avatars
          </button>
          <button
            onClick={() => setActiveTab('mockUsers')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'mockUsers' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : '#222',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Mock Users
          </button>
          <button
            onClick={() => setActiveTab('evaluations')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'evaluations' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#222',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Evaluations
          </button>
        </div>
        
        {activeTab === 'avatars' && <div style={{
          backgroundColor: '#111',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '1px solid #333'
        }}>
          <h2 style={{ color: '#a020f0', marginBottom: '15px', fontSize: '1.3rem' }}>Battle Avatar Library</h2>
          <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
            Add opponent avatar URLs (one per line). These will cycle during 1v1 matchmaking.
          </p>
          
          <textarea
            value={newAvatarUrls}
            onChange={(e) => setNewAvatarUrls(e.target.value)}
            placeholder="https://example.com/avatar1.png&#10;https://example.com/avatar2.png"
            style={{
              width: '100%',
              minHeight: '100px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '12px',
              color: '#fff',
              fontSize: '0.9rem',
              resize: 'vertical',
              marginBottom: '10px'
            }}
          />
          
          <button
            onClick={handleAddAvatars}
            disabled={uploadingAvatars || !newAvatarUrls.trim()}
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: uploadingAvatars || !newAvatarUrls.trim() ? 'not-allowed' : 'pointer',
              opacity: uploadingAvatars || !newAvatarUrls.trim() ? 0.5 : 1,
              fontWeight: '600'
            }}
          >
            {uploadingAvatars ? 'Adding...' : 'Add Avatars'}
          </button>
          
          {battleAvatars.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#ccc', marginBottom: '10px', fontSize: '1rem' }}>
                Current Avatars ({battleAvatars.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '10px'
              }}>
                {battleAvatars.map((avatar) => (
                  <div
                    key={avatar.id}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '2px solid #333'
                    }}
                  >
                    <img
                      src={avatar.url}
                      alt={avatar.label || 'Avatar'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{
                      display: 'none',
                      width: '100%',
                      height: '100%',
                      background: '#222',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: '#666'
                    }}>
                      Error
                    </div>
                    <button
                      onClick={() => handleDeleteAvatar(avatar.id)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>}

        {activeTab === 'mockUsers' && <div style={{
          backgroundColor: '#111',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '1px solid #333'
        }}>
          <h2 style={{ color: '#3b82f6', marginBottom: '15px', fontSize: '1.3rem' }}>Mock User Generator</h2>
          <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
            Paste profile picture URLs (one per line) to create mock users. Each URL creates one fake account with a random username and stats.
          </p>
          
          <textarea
            value={mockUserUrls}
            onChange={(e) => setMockUserUrls(e.target.value)}
            placeholder="https://example.com/profile1.png&#10;https://example.com/profile2.png&#10;(paste up to 50 URLs)"
            style={{
              width: '100%',
              minHeight: '120px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '12px',
              color: '#fff',
              fontSize: '0.9rem',
              resize: 'vertical',
              marginBottom: '10px'
            }}
          />
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
            <button
              onClick={handleCreateMockUsers}
              disabled={creatingMockUsers || !mockUserUrls.trim()}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                cursor: creatingMockUsers || !mockUserUrls.trim() ? 'not-allowed' : 'pointer',
                opacity: creatingMockUsers || !mockUserUrls.trim() ? 0.5 : 1,
                fontWeight: '600'
              }}
            >
              {creatingMockUsers ? 'Creating...' : 'Create Mock Users'}
            </button>
            <span style={{ color: '#666', fontSize: '0.85rem' }}>
              {mockUserUrls.trim() ? `${mockUserUrls.split('\n').filter(u => u.trim()).length} URLs entered` : ''}
            </span>
          </div>
          
          {mockUsers.length > 0 && (
            <div>
              <h3 style={{ color: '#ccc', marginBottom: '10px', fontSize: '1rem' }}>
                Existing Mock Users ({mockUsers.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '12px'
              }}>
                {mockUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      position: 'relative',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '12px',
                      padding: '10px',
                      border: '1px solid #333',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      margin: '0 auto 8px',
                      border: '2px solid #3b82f6'
                    }}>
                      <img
                        src={user.avatar}
                        alt={user.username}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="40">?</text></svg>'; }}
                      />
                    </div>
                    <p style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '500', marginBottom: '4px' }}>
                      {user.username}
                    </p>
                    <p style={{ color: '#888', fontSize: '0.7rem' }}>
                      {user.battleWins || 0}W - {user.battleLosses || 0}L
                    </p>
                    <button
                      onClick={() => handleDeleteMockUser(user.id)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>}
        
        {activeTab === 'evaluations' && evaluations.map(evaluation => (
          <div key={evaluation.id} style={{
            backgroundColor: '#111',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '10px',
            border: '1px solid #333'
          }}>
            <p><strong>Email:</strong> {evaluation.email}</p>
            <p><strong>Status:</strong> {evaluation.status}</p>
            <p><strong>Payout Status:</strong> {evaluation.payout_status}</p>
            <p><strong>Evaluation Ends:</strong> {new Date(evaluation.evaluation_end_date).toLocaleDateString()}</p>
            {evaluation.payout_status === 'approved' && (
              <button
                onClick={() => markAsPaid(evaluation.id)}
                style={{
                  backgroundColor: '#a020f0',
                  color: '#fff',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Mark as Paid
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
