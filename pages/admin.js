// pages/admin.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Admin() {
  const [bets, setBets] = useState([]);
  const [pnlUpdates, setPnlUpdates] = useState({});

  useEffect(() => {
    fetchBets();
  }, []);

  const fetchBets = async () => {
    const { data, error } = await supabase.from('user_bets').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching bets:', error);
    } else {
      setBets(data);
    }
  };

  const handlePnlChange = (id, value) => {
    setPnlUpdates({ ...pnlUpdates, [id]: value });
  };

  const updatePnl = async (id) => {
    const pnlValue = parseFloat(pnlUpdates[id]);
    if (isNaN(pnlValue)) {
      alert('Please enter a valid number.');
      return;
    }

    const response = await fetch('/api/update-pnl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pnl: pnlValue }),
    });

    if (response.ok) {
      alert('✅ PnL updated successfully.');
      fetchBets();
    } else {
      const errorData = await response.json();
      alert(`❌ Failed to update PnL: ${errorData.error}`);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#a020f0' }}>Admin: PnL Tracking + Payouts</h1>
      {bets.map((bet) => (
        <div key={bet.id} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #333', borderRadius: '8px' }}>
          <div><strong>Email:</strong> {bet.email || 'N/A'}</div>
          <div><strong>Game:</strong> {bet.game || 'N/A'}</div>
          <div><strong>Odds:</strong> {bet.odds || 'N/A'}</div>
          <div><strong>Status:</strong> {bet.status || 'N/A'}</div>
          <div><strong>PnL:</strong> {bet.pnl ?? 'N/A'}</div>
          <input
            type="number"
            placeholder="Enter PnL"
            value={pnlUpdates[bet.id] || ''}
            onChange={(e) => handlePnlChange(bet.id, e.target.value)}
            style={{ marginTop: '8px', marginRight: '8px', padding: '5px', borderRadius: '4px' }}
          />
          <button onClick={() => updatePnl(bet.id)} style={{ padding: '5px 10px', borderRadius: '4px', background: '#a020f0', color: '#fff', border: 'none' }}>
            Update PnL
          </button>
        </div>
      ))}
    </div>
  );
}
