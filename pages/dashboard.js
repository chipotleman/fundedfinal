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

  const userId = '00000000-0000-0000-0000-000000000001';

  const decimalToAmerican = (decimal) => {
    if (decimal >= 2) {
      return `+${Math.round((decimal - 1) * 100)}`;
    } else {
      return `${Math.round(-100 / (decimal - 1))}`;
    }
  };

  const calculatePotentialPayout = () => {
    if (!selectedMatchup || !selectedTeam || !stake) return 0;
    const decimal = selectedMatchup.odds[selectedTeam];
    return (parseFloat(stake) * decimal).toFixed(2);
  };

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
    <div className="max-w-4xl mx-auto p-4 text-white bg-black min-h-screen">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-neon-green">⚡ RollrFunded Sportsbook</h1>
        <div className="text-right">
          <p className="text-sm text-gray-400">Available Balance</p>
          <p className="text-lg font-bold text-neon-green">${balance.toFixed(2)}</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {matchups.map((m) => (
          <div
            key={m.name}
            className={`border rounded p-4 cursor-pointer transition ${
              selectedMatchup?.name === m.name ? 'border-neon-green bg-gray-900' : 'border-gray-700 bg-black'
            }`}
            onClick={() => {
              setSelectedMatchup(m);
              setSelectedTeam('');
            }}
          >
            <h2 className="text-lg font-bold mb-2">{m.name}</h2>
            <div className="flex justify-between">
              {m.teams.map((team) => (
                <button
                  key={team}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMatchup(m);
                    setSelectedTeam(team);
                  }}
                  className={`px-3 py-1 rounded border text-sm ${
                    selectedTeam === team && selectedMatchup?.name === m.name
                      ? 'bg-neon-blue text-black border-neon-blue'
                      : 'border-gray-600 text-white'
                  }`}
                >
                  {team} ({decimalToAmerican(m.odds[team])})
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {selectedMatchup && selectedTeam && (
        <div className="bg-gray-900 p-4 rounded mb-4">
          <h3 className="text-lg font-bold text-neon-blue mb-2">📝 Bet Slip</h3>
          <p>
            <span className="font-semibold">{selectedTeam}</span> @{' '}
            <span className="text-neon-green">{decimalToAmerican(selectedMatchup.odds[selectedTeam])}</span>
          </p>
          <input
            type="number"
            placeholder="Enter stake ($10 - $100)"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full mb-2 mt-2 p-2 rounded bg-black border border-gray-700 text-white placeholder-gray-400"
          />
          {stake && (
            <p className="text-sm text-gray-400 mb-2">
              Potential Payout: <span className="text-neon-green">${calculatePotentialPayout()}</span>
            </p>
          )}
          <button
            onClick={handlePlaceBet}
            disabled={placing}
            className="bg-neon-green text-black px-4 py-2 rounded w-full hover:bg-green-400"
          >
            {placing ? 'Placing...' : 'Place Bet'}
          </button>
          {message && <p className="mt-2 text-center">{message}</p>}
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-neon-blue mb-2">💰 My Bets</h2>
        {loading ? (
          <p>Loading bets...</p>
        ) : (
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-800 text-neon-green">
              <tr>
                <th className="px-2 py-1 border">Created</th>
                <th className="px-2 py-1 border">Status</th>
                <th className="px-2 py-1 border">PNL</th>
                <th className="px-2 py-1 border">Selection</th>
                <th className="px-2 py-1 border">Stake</th>
                <th className="px-2 py-1 border">Odds</th>
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
                  <td className="border px-2 py-1">
                    {bet.odds ? decimalToAmerican(bet.odds) : '-'}
                  </td>
                  <td className="border px-2 py-1">{bet.matchup_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
