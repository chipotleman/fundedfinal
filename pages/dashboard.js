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
      const { data: betsData } = await supabase
        .from('user_bets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', userId)
        .single();

      setBets(betsData || []);
      setBalance(balanceData ? parseFloat(balanceData.balance) : 0);
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
      setMessage('⚠️ Stake must be between $10 - $100.');
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
      user_id: userId,
      selection: selectedTeam,
      stake: parsedStake,
      odds: selectedOdds,
      market_type,
      matchup_name: name,
      status: 'open',
      teams,
    });

    if (betError) {
      setMessage(`❌ Error placing bet: ${betError.message}`);
    } else {
      const newBalance = balance - parsedStake;
      const { error: updateError } = await supabase
        .from('user_balances')
        .upsert({ id: userId, balance: newBalance }, { onConflict: 'id' });

      if (updateError) {
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
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 bg-black bg-opacity-80 backdrop-blur p-4 flex justify-between items-center shadow-md z-50">
        <h1 className="text-2xl font-bold text-green-400">⚡ RollrFunded</h1>
        <div className="text-right">
          <p className="text-xs text-gray-400">Available Balance</p>
          <p className="text-lg font-bold text-green-400">${balance.toFixed(2)}</p>
        </div>
      </header>

      {/* Matchup Grid */}
      <div className="max-w-5xl mx-auto p-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matchups.map((m) => (
          <div
            key={m.name}
            className={`bg-gray-800 rounded-lg shadow hover:shadow-lg transition-transform transform hover:-translate-y-1 border border-gray-700 hover:border-green-400 cursor-pointer p-4`}
            onClick={() => {
              setSelectedMatchup(m);
              setSelectedTeam('');
            }}
          >
            <h2 className="text-lg font-bold mb-2 text-center">{m.name}</h2>
            <div className="flex justify-center gap-2">
              {m.teams.map((team) => (
                <button
                  key={team}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMatchup(m);
                    setSelectedTeam(team);
                  }}
                  className={`flex-1 py-2 rounded font-semibold transition border ${
                    selectedTeam === team && selectedMatchup?.name === m.name
                      ? 'bg-green-400 text-black border-green-400'
                      : 'bg-gray-900 text-white border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {team} <br /> ({decimalToAmerican(m.odds[team])})
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bet Slip Drawer */}
      {selectedMatchup && selectedTeam && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 border-t border-green-400 z-50 shadow-lg">
          <h3 className="text-lg font-bold text-green-400 mb-2 text-center">🎟️ Bet Slip</h3>
          <div className="text-center mb-2">
            <p>
              <span className="font-bold">{selectedTeam}</span> @{' '}
              <span className="text-green-400">{decimalToAmerican(selectedMatchup.odds[selectedTeam])}</span>
            </p>
          </div>
          <div className="flex justify-center">
            <input
              type="number"
              placeholder="Enter stake ($10 - $100)"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-40 p-2 rounded bg-black border border-gray-600 text-center text-white"
            />
          </div>
          {stake && (
            <p className="text-center text-sm text-gray-400 mt-1">
              Potential Payout:{' '}
              <span className="text-green-400 font-bold">${calculatePotentialPayout()}</span>
            </p>
          )}
          <button
            onClick={handlePlaceBet}
            disabled={placing}
            className="mt-3 w-full py-2 rounded bg-green-400 text-black font-bold hover:bg-green-300 transition"
          >
            {placing ? 'Placing...' : 'Place Bet'}
          </button>
          {message && <p className="text-center mt-2">{message}</p>}
        </div>
      )}

      {/* My Bets Section */}
      <div className="max-w-5xl mx-auto p-4">
        <h2 className="text-lg font-bold text-green-400 mb-2">📄 My Bets</h2>
        {loading ? (
          <p>Loading bets...</p>
        ) : (
          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full text-sm bg-gray-800 rounded">
              <thead className="bg-gray-700 text-green-400">
                <tr>
                  <th className="px-2 py-1">Created</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">PNL</th>
                  <th className="px-2 py-1">Selection</th>
                  <th className="px-2 py-1">Stake</th>
                  <th className="px-2 py-1">Odds</th>
                  <th className="px-2 py-1">Matchup</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="text-center border-t border-gray-700">
                    <td className="px-2 py-1">{new Date(bet.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1">{bet.status}</td>
                    <td className="px-2 py-1">{bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}</td>
                    <td className="px-2 py-1">{bet.selection || '-'}</td>
                    <td className="px-2 py-1">{bet.stake !== null ? `$${bet.stake}` : '-'}</td>
                    <td className="px-2 py-1">{bet.odds ? decimalToAmerican(bet.odds) : '-'}</td>
                    <td className="px-2 py-1">{bet.matchup_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
