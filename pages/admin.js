// pages/admin.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Admin() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pnlUpdates, setPnlUpdates] = useState({});

  useEffect(() => {
    const fetchBets = async () => {
      const { data, error } = await supabase
        .from('user_bets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase fetch error:', error);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  const handlePnlChange = (id, value) => {
    setPnlUpdates({ ...pnlUpdates, [id]: value });
  };

  const updatePnl = async (id) => {
    const pnl = parseFloat(pnlUpdates[id]);
    if (isNaN(pnl)) {
      alert("Invalid PnL value.");
      return;
    }

    const { error } = await supabase
      .from('user_bets')
      .update({ pnl })
      .eq('id', id);

    if (error) {
      console.error('❌ Update PnL error:', error);
    } else {
      alert("PnL updated.");
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: '#a020f0' }}>Admin PnL Tracking Panel</h1>
      {bets.length === 0 ? (
        <p style={{ textAlign: 'center' }}>No bets found.</p>
      ) : (
        bets.map(bet => (
          <div key={bet.id} style={{ background: '#111', margin: '10px 0', padding: '10px', borderRadius: '5px' }}>
            <p><strong>Email:</strong> {bet.email}</p>
            <p><strong>Game:</strong> {bet.game}</p>
            <p><strong>Odds:</strong> {bet.odds}</p>
            <p><strong>Status:</strong> {bet.status}</p>
            <p><strong>PnL:</strong> {bet.pnl}</p>
            <input
              type="number"
              placeholder="Enter PnL"
              value={pnlUpdates[bet.id] || ""}
              onChange={(e) => handlePnlChange(bet.id, e.target.value)}
              style={{ marginRight: '10px' }}
            />
            <button onClick={() => updatePnl(bet.id)} style={{ background: '#a020f0', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '3px' }}>
              Update PnL
            </button>
          </div>
        ))
      )}
    </div>
  );
}
