import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function BetSelector({ user }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      const { data, error } = await supabase
        .from('available_bets')
        .select('*')
        .order('commence_time', { ascending: true });

      if (error) {
        console.error('Error fetching available bets:', error);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  const handleSelect = async (bet) => {
    const { error } = await supabase.from('user_bets').insert([
      {
        user_email: user.email,
        evaluation_id: bet.evaluation_id || null,
        bet_id: bet.id,
        market_type: bet.market_type,
        selection: bet.home_team,
        stake: 0
      }
    ]);

    if (error) {
      console.error('Error saving user bet:', error);
      alert('Error saving bet');
    } else {
      alert('Bet selected!');
    }
  };

  if (loading) return <p style={{ color: "#fff" }}>Loading bets...</p>;

  return (
    <div>
      <h2 style={{ color: '#a020f0' }}>Select Your Bets</h2>
      {bets.map((bet) => (
        <div key={bet.id} style={{ background: '#111', color: '#fff', padding: '10px', margin: '10px 0' }}>
          <p>{bet.home_team} vs {bet.away_team}</p>
          <p>Market: {bet.market_type}</p>
          <button onClick={() => handleSelect(bet)} style={{ background: '#a020f0', color: '#fff', padding: '5px 10px' }}>
            Select Bet
          </button>
        </div>
      ))}
    </div>
  );
}
