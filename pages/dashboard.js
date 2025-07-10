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
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);

  const userId = '00000000-0000-0000-0000-000000000001'; // replace with your user_id

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

  const handleWithdrawRequest = async () => {
    setWithdrawMessage('');
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      setWithdrawMessage('⚠️ Minimum withdrawal is $10.');
      return;
    }
    if (amount > balance) {
      setWithdrawMessage('⚠️ Amount exceeds balance.');
      return;
    }

    const { error } = await supabase.from('withdrawal_requests').insert({
      user_id: userId,
      amount,
      status: 'pending',
    });

    if (error) {
      setWithdrawMessage(`❌ ${error.message}`);
    } else {
      setWithdrawMessage(`✅ Withdrawal request for $${amount.toFixed(2)} submitted.`);
      setWithdrawAmount('');
      setShowWithdrawInput(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="p-4 flex flex-col items-center">
        <img src="/rollr-logo.png" alt="Rollr Logo" className="h-16 w-auto mb-2" />
        <p className="text-sm text-gray-400">Available Balance</p>
        <p className="text-2xl font-bold text-green-400 mb-2">${balance.toFixed(2)}</p>
        
        <button
          onClick={() => setShowWithdrawInput(!showWithdrawInput)}
          className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-300 transition mb-2"
        >
          Request Withdrawal
        </button>

        {showWithdrawInput && (
          <div className="w-full max-w-xs text-center">
            <input
              type="number"
              placeholder="Enter amount ($10 min)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full mb-2 p-2 rounded bg-black border border-gray-700 text-white placeholder-gray-400"
            />
            <button
              onClick={handleWithdrawRequest}
              className="bg-green-400 text-black px-4 py-2 rounded w-full hover:bg-green-300"
            >
              Submit Withdrawal
            </button>
            {withdrawMessage && <p className="mt-1 text-green-400">{withdrawMessage}</p>}
          </div>
        )}
      </header>

      {/* You can continue your matchups, betting, and bet history sections here unchanged */}

    </div>
  );
}
