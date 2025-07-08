// pages/dashboard.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase
        .from('game_slates')
        .select('*')
        .order('game_time', { ascending: true });

      if (error) {
        console.error('❌ Supabase fetch error:', error);
      } else {
        console.log('✅ Game slates fetched:', data);
        setGames(data);
      }
      setLoading(false);
    };

    fetchGames();
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#000',
      color: '#a020f0',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '20px', textShadow: '0 0 10px #a020f0' }}>
        🏈 RollrFunded Live Sportsbook
      </h1>
      {games.length === 0 ? (
        <p style={{ textAlign: 'center' }}>No games available. Fetch slates to populate games.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px'
        }}>
          {games.map((game) => (
            <div key={game.id} style={{
              backgroundColor: '#111',
              border: '1px solid #a020f0',
              borderRadius: '8px',
              padding: '15px',
              textAlign: 'center',
              boxShadow: '0 0 15px #a020f0'
            }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#fff' }}>{game.sport}</h2>
              <p style={{ margin: '5px 0', fontSize: '1.1rem', color: '#ccc' }}>{game.matchup}</p>
              <p style={{ margin: '5px 0', fontSize: '1rem', color: '#a020f0' }}>Odds: {game.odds}</p>
              <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#888' }}>{new Date(game.game_time).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
