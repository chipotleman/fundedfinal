// pages/dashboard.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [balance, setBalance] = useState(0);
  const [matchups, setMatchups] = useState([]);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [stake, setStake] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const userId = '00000000-0000-0000-0000-000000000001'; // replace with your UUID

  const decimalToAmerican = (decimal) => {
    const d = parseFloat(decimal);
    if (isNaN(d) || d <= 1) return 'N/A';
    if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
    return `${Math.round(-100 / (d - 1))}`;
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

      const { data: slatesData } = await supabase
        .from('game_slates')
        .select('*')
        .order('game_time', { ascending: true });

      if (slatesData) {
        const formatted = slatesData.map((game) => {
          const oddsObj = {};
          if (game.odds) {
            game.odds.split(',').forEach((pair) => {
              const [team, odd] = pair.trim().split(':');
              if (team && odd) {
                oddsObj[team.trim()] = decimalToAmerican(odd.trim());
              }
            });
          }
          return {
            name: game.matchup,
            market_type: game.sport,
            teams: Object.keys(oddsObj),
            odds: oddsObj,
          };
        });
        setMatchups(formatted);
      }

      setBets(betsData || []);
      setBalance(balanceData ? parseFloat(balanceData.balance) : 0);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const handlePlaceBet = async () => {
    setMessage('');
    const parsedStake = parseFloat(stake);
    if (!selectedMatchup || !selectedTeam || isNaN(parsedStake) || parsedStake < 10 || parsedStake > 100) {
      setMessage('⚠️ Please fill all fields correctly.');
      return;
    }
    if (parsedStake > balance) {
      setMessage('⚠️ Insufficient balance.');
      return;
    }

    const { name, market_type, odds } = selectedMatchup;
    const selectedOdds = odds[selectedTeam];

    const { error: betError } = await supabase.from('user_bets').insert({
      user_id: userId,
      selection: selectedTeam,
      stake: parsedStake,
      odds: selectedOdds,
      market_type,
      matchup_name: name,
      status: 'open',
    });

    if (betError) {
      setMessage(`❌ Error placing bet: ${betError.message}`);
      return;
    }

    const newBalance = balance - parsedStake;
    const { error: updateError } = await supabase
      .from('user_balances')
      .upsert({ id: userId, balance: newBalance }, { onConflict: 'id' });

    if (updateError) {
      setMessage(`❌ Error updating balance: ${updateError.message}`);
    } else {
      setBalance(newBalance);
      setStake('');
      setSelectedMatchup(null);
      setSelectedTeam('');
      setMessage(`✅ Bet placed on ${selectedTeam} for $${parsedStake}.`);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    const withdrawAmount = 10;
    if (balance < withdrawAmount) {
      setMessage('⚠️ Insufficient balance to withdraw.');
      setWithdrawing(false);
      return;
    }
    const newBalance = balance - withdrawAmount;
    const { error } = await supabase
      .from('user_balances')
      .update({ balance: newBalance })
      .eq('id', userId);
    if (error) {
      setMessage(`❌ Withdrawal error: ${error.message}`);
    } else {
      setBalance(newBalance);
      setMessage('✅ $10 withdrawal processed.');
    }
    setWithdrawing(false);
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-sans">
      <header className="p-4 flex flex-col items-center">
        <img src="/rollr-logo.png" alt="Rollr Logo" className="h-16 mb-2" />
        <p className="text-lg font-bold">Available Balance: ${balance.toFixed(2)}</p>
        <button
          onClick={handleWithdraw}
          disabled={withdrawing}
          className="mt-2 bg-green-400 text-black font-bold px-4 py-2 rounded hover:bg-green-300 transition"
        >
          {withdrawing ? 'Withdrawing...' : 'Withdraw $10'}
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {matchups.length === 0 ? (
          <p className="text-center text-gray-400">No live games available.</p>
        ) : (
          matchups.map((m) => (
            <div key={m.name} className="bg-gray-900 rounded p-4 mb-4 shadow-md">
              <h2 className="text-lg font-bold mb-2">{m.name}</h2>
              <div className="flex flex-wrap gap-2">
                {m.teams.map((team) => (
                  <button
                    key={team}
                    onClick={() => {
                      setSelectedMatchup(m);
                      setSelectedTeam(team);
                    }}
                    className={`px-3 py-1 rounded border font-semibold ${
                      selectedMatchup?.name === m.name && selectedTeam === team
                        ? 'bg-green-400 text-black'
                        : 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black transition'
                    }`}
                  >
                    {team} ({m.odds[team]})
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {selectedMatchup && selectedTeam && (
        <div className="max-w-md mx-auto bg-gray-900 rounded p-4 my-4">
          <h3 className="font-bold mb-2">
            Place Bet on {selectedTeam} ({selectedMatchup.odds[selectedTeam]})
          </h3>
          <input
            type="number"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder="Enter stake ($10 - $100)"
            className="w-full mb-3 p-2 rounded bg-black border border-green-400 text-green-400 placeholder-gray-500"
          />
          <button
            onClick={handlePlaceBet}
            className="bg-green-400 text-black font-bold w-full py-2 rounded hover:bg-green-300 transition"
          >
            Place Bet
          </button>
          {message && <p className="mt-2 text-center text-green-300">{message}</p>}
        </div>
      )}

      <section className="max-w-4xl mx-auto p-4 mt-6">
        <h2 className="text-lg font-bold mb-2">📄 My Bets</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-900 text-green-400 rounded">
              <thead className="bg-gray-800">
                <tr>
                  <th className="p-2">Created</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">PNL</th>
                  <th className="p-2">Selection</th>
                  <th className="p-2">Stake</th>
                  <th className="p-2">Odds</th>
                  <th className="p-2">Matchup</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="text-center border-t border-green-400">
                    <td className="p-2">{new Date(bet.created_at).toLocaleString()}</td>
                    <td className="p-2">{bet.status}</td>
                    <td className="p-2">{bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}</td>
                    <td className="p-2">{bet.selection || '-'}</td>
                    <td className="p-2">{bet.stake !== null ? `$${bet.stake}` : '-'}</td>
                    <td className="p-2">{bet.odds || '-'}</td>
                    <td className="p-2">{bet.matchup_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
