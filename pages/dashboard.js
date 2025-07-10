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
  const [loading, setLoading] = useState(true);
  const [matchups, setMatchups] = useState([]);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [stake, setStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');

  const userId = '00000000-0000-0000-0000-000000000001'; // Replace with your user's id for testing

  const decimalToAmerican = (decimal) => {
    const d = parseFloat(decimal);
    if (isNaN(d) || d <= 1) return 'N/A';
    if (d >= 2) {
      return `+${Math.round((d - 1) * 100)}`;
    } else {
      return `${Math.round(-100 / (d - 1))}`;
    }
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
      setMessage('⚠️ Insufficient balance.');
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

  const handleWithdrawRequest = async () => {
    setWithdrawMessage('');
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      setWithdrawMessage('⚠️ Withdrawal must be at least $10.');
      return;
    }
    if (amount > balance) {
      setWithdrawMessage('⚠️ Withdrawal amount exceeds available balance.');
      return;
    }

    const { error } = await supabase.from('withdrawal_requests').insert({
      user_id: userId,
      amount,
      status: 'pending',
    });

    if (error) {
      setWithdrawMessage(`❌ Error submitting withdrawal: ${error.message}`);
    } else {
      setWithdrawMessage(`✅ Withdrawal request for $${amount.toFixed(2)} submitted.`);
      setWithdrawAmount('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <header className="sticky top-0 bg-black bg-opacity-90 p-4 flex flex-col items-center shadow z-50">
        <img src="/rollr-logo.png" alt="Rollr Logo" className="h-16 md:h-20 w-auto mb-2" />
        <div className="text-center">
          <p className="text-xs text-gray-400">Available Balance</p>
          <p className="text-lg font-bold text-green-400">${balance.toFixed(2)}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {matchups.length === 0 ? (
          <p className="text-center text-gray-400">No live games available.</p>
        ) : (
          matchups.map((m) => (
            <div key={m.name} className="bg-gray-800 rounded p-4 mb-4 shadow">
              <h2 className="text-lg font-bold text-green-400 mb-2">{m.name}</h2>
              <div className="flex flex-wrap gap-2">
                {m.teams.map((team) => (
                  <button
                    key={team}
                    onClick={() => {
                      setSelectedMatchup(m);
                      setSelectedTeam(team);
                    }}
                    className={`px-3 py-1 rounded border ${
                      selectedMatchup?.name === m.name && selectedTeam === team
                        ? 'bg-green-400 text-black'
                        : 'bg-black text-white border-gray-700'
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
        <div className="max-w-md mx-auto p-4 bg-gray-800 rounded shadow mb-4">
          <h3 className="text-green-400 font-bold mb-2">
            Bet on {selectedTeam} ({selectedMatchup.odds[selectedTeam]})
          </h3>
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
            className="bg-green-400 text-black px-4 py-2 rounded w-full hover:bg-green-300"
          >
            {placing ? 'Placing...' : 'Place Bet'}
          </button>
          {message && <p className="mt-2 text-center">{message}</p>}
        </div>
      )}

      <section className="max-w-md mx-auto p-4 bg-gray-800 rounded shadow mb-8">
        <h2 className="text-green-400 font-bold mb-2">💸 Request Withdrawal</h2>
        <input
          type="number"
          placeholder="Enter amount ($10 min)"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-black border border-gray-700 text-white placeholder-gray-400"
        />
        <button
          onClick={handleWithdrawRequest}
          className="bg-green-400 text-black px-4 py-2 rounded w-full hover:bg-green-300"
        >
          Request Withdrawal
        </button>
        {withdrawMessage && <p className="mt-2 text-center">{withdrawMessage}</p>}
      </section>

      <section className="max-w-6xl mx-auto p-4 mt-8">
        <h2 className="text-lg font-bold text-green-400 mb-2">📄 My Bets</h2>
        {loading ? (
          <p>Loading bets...</p>
        ) : (
          <div className="overflow-x-auto rounded shadow">
            <table className="min-w-full text-sm bg-gray-800 rounded">
              <thead className="bg-gray-700 text-green-400">
                <tr>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">PNL</th>
                  <th className="px-2 py-2">Selection</th>
                  <th className="px-2 py-2">Stake</th>
                  <th className="px-2 py-2">Odds</th>
                  <th className="px-2 py-2">Matchup</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="text-center border-t border-gray-700">
                    <td className="px-2 py-2">{new Date(bet.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2">{bet.status}</td>
                    <td className="px-2 py-2">{bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}</td>
                    <td className="px-2 py-2">{bet.selection || '-'}</td>
                    <td className="px-2 py-2">{bet.stake !== null ? `$${bet.stake}` : '-'}</td>
                    <td className="px-2 py-2">{bet.odds ? bet.odds : '-'}</td>
                    <td className="px-2 py-2">{bet.matchup_name || '-'}</td>
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
