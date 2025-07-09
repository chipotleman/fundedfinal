import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [balance, setBalance] = useState(0);
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

  // ✅ TEST USER ID (replace with your actual test UUID)
  const userId = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: betsData, error: betsError } = await supabase
        .from('user_bets')
        .select('*')
        .eq('id', userId)
        .order('created_at', { ascending: false });

      const { data: balanceData, error: balanceError } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', userId)
        .single();

      if (betsError) console.error('Error fetching bets:', betsError.message);
      else setBets(betsData);

      if (balanceError && balanceError.code !== 'PGRST116') {
        console.error('Error fetching balance:', balanceError.message);
      } else {
        setBalance(balanceData ? parseFloat(balanceData.balance) : 0);
      }

      setLoading(false);
    };

    fetchData();
  }, [userId]);

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

    if (parsedStake > balance) {
      setMessage('⚠️ Not enough balance.');
      return;
    }

    setPlacing(true);

    const { name, market_type, odds, teams } = selectedMatchup;
    const selectedOdds = odds[selectedTeam];

    const { error: betError } = await supabase.from('user_bets').insert({
      id: userId,
      selection: selectedTeam,
      stake: parsedStake,
      odds: selectedOdds,
      market_type,
      matchup_name: name,
      status: 'open',
      teams,
    });

    if (betError) {
      console.error(betError);
      setMessage(`❌ Error placing bet: ${betError.message}`);
    } else {
      const newBalance = balance - parsedStake;
      const { error: updateError } = await supabase
        .from('user_balances')
        .upsert({ id: userId, balance: newBalance }, { onConflict: 'id' });

      if (updateError) {
        console.error(updateError);
        setMessage(`❌ Error updating balance: ${updateError.message}`);
      } else {
        setBalance(newBalance);
        setMessage(`✅ Bet placed on ${selectedTeam} for $${parsedStake}.`);
        setStake('');
        setSelectedMatchup(null);
        setSelectedTeam('');
      }
    }

    setPlacing(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-neon-green">⚡ RollrFunded Sportsbook</h1>

      <div className="bg-gray-900 p-4 rounded mb-6 flex justify-between items-center">
        <span className="text-lg">Available Balance:</span>
        <span className="text-xl font-bold text-neon-green">${balance.toFixed(2)}</span>
      </div>

      <div className="bg-gray-900 p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-2 text-neon-blue">🎯 Place a Bet</h2>

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

      {loading ? (
        <p>Loading bets...</p>
      ) : (
        <div className="overflow-x-auto">
          <h2 className="text-lg font-bold mb-2 text-neon-blue">💰 My Bets</h2>
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
