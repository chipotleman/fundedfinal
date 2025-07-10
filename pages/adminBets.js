// pages/adminBets.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const adminEmail = 'mathewbaldwin13@yahoo.com'; // your admin email

  useEffect(() => {
    const fetchBets = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || session.user.email !== adminEmail) {
        alert('Access denied.');
        window.location.href = '/';
        return;
      }

      const { data, error } = await supabase
        .from('bets')
        .select('id, user_id, game_id, amount, odds, status')
        .eq('status', 'open');

      if (error) {
        console.error(error.message);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  const gradeBet = async (betId, didWin) => {
    const res = await fetch('/api/admin/settleSingleBet', {
      method: 'POST',
      body: JSON.stringify({ betId, didWin }),
    });
    const data = await res.json();
    alert(data.message);
    location.reload();
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#a020f0', fontSize: '2rem', textAlign: 'center' }}>Admin Bet Grading Panel</h1>
      <div style={{ maxWidth: '800px', margin: '0 auto', marginTop: '20px' }}>
        {bets.length > 0 ? bets.map(bet => (
          <div key={bet.id} style={{
            backgroundColor: '#111',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '10px',
            border: '1px solid #333'
          }}>
            <p><strong>Bet ID:</strong> {bet.id}</p>
            <p><strong>User ID:</strong> {bet.user_id}</p>
            <p><strong>Game ID:</strong> {bet.game_id}</p>
            <p><strong>Amount:</strong> ${bet.amount}</p>
            <p><strong>Odds:</strong> {bet.odds}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => gradeBet(bet.id, true)}
                style={{
                  backgroundColor: '#00ff00',
                  color: '#000',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Mark as Won
              </button>
              <button
                onClick={() => gradeBet(bet.id, false)}
                style={{
                  backgroundColor: '#ff0000',
                  color: '#fff',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Mark as Lost
              </button>
            </div>
          </div>
        )) : (
          <p>No open bets to grade.</p>
        )}
      </div>
    </div>
  );
}
