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
        .eq('id', userId)
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
    <div className="bg-gradient-to-b from-black to-gray-900 min-h-screen text-white p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-neon-green">⚡ RollrFunded</h1>
        <div className="text-right">
          <p className="text-sm text-gray-400">Balance</p>
          <p className="text-xl font-bold text-neon-green">${balance.toFixed(2)}</p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {matchups.map((m) => (
          <div
            key={m.name}
            className={`rounded-lg p-4 bg-gray-800 hover:bg-gray-700 transition cursor-pointer ${
              selectedMatchup?.name === m.name ? 'ring-2 ring-neon-green' : ''
            }`}
            onClick={() => {
              setSelectedMatchup(m);
              setSelectedTeam('');
            }}
          >
            <h2 className="text-lg font-bold mb-2">{m.name}</h2>
            <div className="flex gap-2">
              {m.teams.map((team) => (
                <button
                  key={team}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMatchup(m);
                    setSelectedTeam(team);
                  }}
                  className={`flex-1 py-2 rounded border ${
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
      </div>

      {selectedMatchup && selectedTeam && (
        <div className="sticky bottom-0 bg-gray-900 p-4 rounded-t-lg shadow-xl">
          <h3 className="text-lg font-bold text-neon-blue mb-2">🎟️ Bet Slip</h3>
          <p>
            <span className="font-semibold">{selectedTeam}</span> @{' '}
            <span className="text-neon-green">{decimalToAmerican(selectedMatchup.odds[selectedTeam])}</span>
          </p>
          <input
            type="number"
            placeholder="Enter stake ($10 - $100)"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full mt-2 mb-2 p-2 rounded bg-black border border-gray-600 text-white"
          />
          {stake && (
            <p className="text-sm text-gray-400">
              Potential Payout: <span className="text-neon-green">${calculatePotentialPayout()}</span>
            </p>
          )}
          <button
            onClick={handlePlaceBet}
            disabled={placing}
            className="bg-neon-green text-black w-full mt-2 py-2 rounded hover:bg-green-400 transition"
          >
            {placing ? 'Placing...' : 'Place Bet'}
          </button>
          {message && <p className="text-center mt-2">{message}</p>}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold te
