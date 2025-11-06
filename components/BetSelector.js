import { useEffect, useState } from 'react';

export default function BetSelector({ user }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      // TODO: Implement with new database
      setLoading(false);
    };

    fetchBets();
  }, []);

  const handleSelect = async (bet) => {
    // TODO: Implement with new database
    alert('Bet selection coming soon!');
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
