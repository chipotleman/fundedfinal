import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchups, setMatchups] = useState([
    {
      name: "Knicks vs Lakers",
      market_type: "NBA Moneyline",
      teams: ["Knicks", "Lakers"],
      odds: { Knicks: 1.9, Lakers: 2.1 },
    },
    {
      name: "Celtics vs Heat",
      market_type: "NBA Moneyline",
      teams: ["Celtics", "Heat"],
      odds: { Celtics: 1.8, Heat: 2.2 },
    },
  ]);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [stake, setStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_bets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching bets:', error.message);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  const handlePlaceBet = async () => {
    setMessage('');
    if (!selectedMatchup || !selectedTeam) {
      setMessage('⚠️ Please select a matchup and team.');
      return;
    }
    const parsedStake = parseFloat(stake);
    if (isNaN(parsedStake) || parsedStake < 10 || parsedStake > 100) {
      setMessage('⚠️ Stake must be between $10 and $100.');
      return;
    }

    setPlacing(true);

    const { name, market_type, odds } = selectedMatchup;
    const selectedOdds = odds[selectedTeam];

    const { error } = await supabase.from('user_bets').insert({
      selection: selectedTeam,
      stake: parsedStake,
      odds: selectedOdds,
      market_type,
      matchup_name: name,
      status: 'open',
    });

    if (error) {
      console.error(error);
      setMessage(`❌ Error placing bet: ${error.message}`);
    } else {
      setMessage(`✅ Bet placed on ${selectedTeam} for $${parsedStake}.`);
      setStake('');
      setSelectedMatchup(null);
      setSelectedTeam('');
    }

    setPlacing(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-neon-green">⚡ RollrFunded Dashboard</h1>

      {/* BET PLACEMENT AREA */}
      <div className="bg-gray-900 p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-2 text-neon-blue">🎯 Place a Bet</h2>

        {/* MATCHUP SELECTION */}
        <div className="flex flex-wrap gap-2 mb-3">
          {matchups.map((m) => (
            <button
              key={m.name}
              onClick={() => {
                setSelectedMatchup(m);
                setSelectedTeam('');
              }}
              className={`px-3 py-1 rounded border ${
                selectedMatchup?.name === m.name
                  ? 'bg-neon-green text-black'
                  : 'bg-black text-white border-gray-700'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* TEAM SELECTION */}
        {selectedMatchup && (
          <div className="flex gap-2 mb-3">
            {selectedMatchup.teams.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`px-3 py-1 rounded border ${
                  selectedTeam === team
                    ? 'bg-neon-blue text-black'
                    : 'bg-black text-white border-gray-700'
                }`}
              >
                {team} ({selectedMatchup.odds[team]})
              </button>
            ))}
          </div>
        )}

        {/* STAKE INPUT */}
        <input
          type="number"
          placeholder="Enter stake ($10 - $100)"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-black border border-gray-700 text-white placeholder-gray-400"
        />

        <button
          onClick={handlePlaceBet}
          disabled={placing}
          className="bg-neon-green text-black px-4 py-2 rounded w-full hover:bg-green-400"
        >
          {placing ? 'Placing...' : 'Place Bet'}
        </button>

        {message && <p className="mt-2 text-center">{message}</p>}
      </div>

      {/* EXISTING BETS TABLE */}
      {loading ? (
        <p>Loading bets...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-800 text-neon-green">
              <tr>
                <th className="px-2 py-1 border">Created</th>
                <th className="px-2 py-1 border">Status</th>
                <th className="px-2 py-1 border">PNL</th>
                <th className="px-2 py-1 border">Selection</th>
                <th className="px-2 py-1 border">Stake</th>
                <th className="px-2 py-1 border">Odds</th>
                <th className="px-2 py-1 border">Market Type</th>
                <th className="px-2 py-1 border">Matchup</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <tr key={bet.id} className="text-center">
                  <td className="border px-2 py-1">{new Date(bet.created_at).toLocaleString()}</td>
                  <td className="border px-2 py-1">{bet.status}</td>
                  <td className="border px-2 py-1">
                    {bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}
                  </td>
                  <td className="border px-2 py-1">{bet.selection || '-'}</td>
                  <td className="border px-2 py-1">{bet.stake !== null ? `$${bet.stake}` : '-'}</td>
                  <td className="border px-2 py-1">{bet.odds !== null ? bet.odds : '-'}</td>
                  <td className="border px-2 py-1">{bet.market_type || '-'}</td>
                  <td className="border px-2 py-1">{bet.matchup_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
