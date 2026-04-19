import { useEffect, useState } from 'react';

export default function AdminSettle() {
  const [matchups, setMatchups] = useState([]);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [winner, setWinner] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchMatchups = async () => {
      try {
        // TODO: Create API route to fetch open bets when admin features are needed
        console.log("✅ Admin settle page loaded (requires API implementation)");
        setMatchups([]);
      } catch (error) {
        console.error("❌ Error fetching open bets:", error);
      }
    };

    fetchMatchups();
  }, []);

  const handleSettle = async () => {
    if (!selectedMatchup || !winner) {
      setMessage('⚠️ Please select a matchup and winner.');
      return;
    }

    const [matchup_name, market_type] = selectedMatchup.split('|').map(s => s.trim());

    const res = await fetch('/api/adminSettle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchup_name, market_type, winner })
    });

    const data = await res.json();

    if (res.ok) {
      setMessage(`✅ ${data.message}`);
      setSelectedMatchup(null);
      setWinner('');
    } else {
      setMessage(`❌ ${data.error || 'Error settling bets.'}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-blue-400">🛠️ Admin Settlement Panel</h1>

      {/* MATCHUP SELECT */}
      <label className="block mb-2">Select Matchup:</label>
      <select
        className="w-full p-2 mb-4 bg-gray-900 border border-gray-700 rounded text-white"
        value={selectedMatchup || ''}
        onChange={(e) => { setSelectedMatchup(e.target.value); setWinner(''); }}
      >
        <option value="">-- Select a matchup --</option>
        {matchups.map((m, idx) => (
          <option key={idx} value={`${m.matchup_name} | ${m.market_type}`}>
            {m.matchup_name} ({m.market_type})
          </option>
        ))}
      </select>

      {/* WINNER SELECT */}
      {selectedMatchup && (
        <>
          <label className="block mb-2">Select Winner:</label>
          <select
            className="w-full p-2 mb-4 bg-gray-900 border border-gray-700 rounded text-white"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
          >
            <option value="">-- Select winning team/player --</option>
            {matchups.find(m => `${m.matchup_name} | ${m.market_type}` === selectedMatchup)
              ?.teams.map((team, idx) => (
                <option key={idx} value={team}>{team}</option>
              ))}
          </select>
        </>
      )}

      <button
        onClick={handleSettle}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-400 mb-4"
      >
        Settle Bets
      </button>

      {message && (
        <p className="text-center">{message}</p>
      )}
    </div>
  );
}
