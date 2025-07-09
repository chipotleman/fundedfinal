'use client';

import { useState } from 'react';

export default function PlaceBet({ matchup }) {
  const [selection, setSelection] = useState('');
  const [stake, setStake] = useState('');

  const handlePlaceBet = async () => {
    const parsedStake = parseFloat(stake);
    if (!selection) {
      alert('Please select a team/player to bet on.');
      return;
    }
    if (isNaN(parsedStake) || parsedStake < 10 || parsedStake > 100) {
      alert('Stake must be between $10 and $100.');
      return;
    }

    const res = await fetch('/api/placeBet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection,
        stake: parsedStake,
        odds: matchup.odds[selection],
        market_id: matchup.id,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      alert('Bet placed successfully!');
    } else {
      alert(`Error: ${data.error}`);
    }
  };

  return (
    <div className="p-4 rounded border">
      <h2 className="text-lg font-bold mb-2">{matchup.name}</h2>
      <div className="flex space-x-2 mb-2">
        {matchup.teams.map((team) => (
          <button
            key={team}
            onClick={() => setSelection(team)}
            className={`px-3 py-1 rounded ${
              selection === team ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            {team}
          </button>
        ))}
      </div>
      <input
        type="number"
        placeholder="Enter stake ($10-$100)"
        value={stake}
        onChange={(e) => setStake(e.target.value)}
        className="border rounded px-2 py-1 mb-2 w-full"
      />
      <button
        onClick={handlePlaceBet}
        className="bg-green-500 text-white px-4 py-2 rounded w-full"
      >
        Place Bet
      </button>
    </div>
  );
}
