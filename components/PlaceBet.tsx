'use client';

import { useState } from 'react';

export default function PlaceBet({ matchup }) {
  const [selection, setSelection] = useState('');
  const [stake, setStake] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePlaceBet = async () => {
    setMessage('');
    const parsedStake = parseFloat(stake);

    if (!selection) {
      setMessage('⚠️ Please select a team/player.');
      return;
    }

    if (isNaN(parsedStake) || parsedStake < 10 || parsedStake > 100) {
      setMessage('⚠️ Stake must be between $10 and $100.');
      return;
    }

    setLoading(true);
    
console.log("matchup.teams:", matchup.teams);

    try {
      const res = await fetch('/api/placeBet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    selection,
    stake: parsedStake,
    odds: matchup.odds[selection],
    market_type: matchup.market_type,
    matchup_name: matchup.name,
    teams: matchup.teams, // ✅ add this
  }),
});


      const data = await res.json();

      if (res.ok) {
        setMessage('✅ Bet placed successfully!');
        setStake('');
        setSelection('');
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      setMessage('❌ An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-bold mb-3">{matchup.name}</h2>
      <p className="text-sm text-gray-600 mb-2">{matchup.market_type}</p>

      <div className="flex space-x-2 mb-4">
        {matchup.teams.map((team) => (
          <button
            key={team}
            onClick={() => setSelection(team)}
            className={`px-3 py-1 rounded border ${
              selection === team ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            {team}
          </button>
        ))}
      </div>

      <input
        type="number"
        min="10"
        max="100"
        placeholder="Enter stake ($10-$100)"
        value={stake}
        onChange={(e) => setStake(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-3"
      />

      <button
        onClick={handlePlaceBet}
        disabled={loading}
        className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
      >
        {loading ? 'Placing Bet...' : 'Place Bet'}
      </button>

      {message && (
        <p className="mt-3 text-center text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
