// pages/dashboard.js

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [balance, setBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);

  const userId = '00000000-0000-0000-0000-000000000001'; // replace with your real user_id if needed

  useEffect(() => {
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', userId)
        .single();

      if (data) {
        setBalance(parseFloat(data.balance));
      }
    };

    fetchBalance();
  }, []);

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">

      <img src="/rollr-logo.png" alt="Rollr Logo" className="h-24 w-auto mb-4" />
      <p className="text-[#39FF14] text-sm">Available Balance</p>
      <p className="text-[#39FF14] text-4xl font-bold mb-6">${balance.toFixed(2)}</p>

      <button
        onClick={() => setShowWithdrawInput(!showWithdrawInput)}
        className="bg-[#39FF14] text-black px-6 py-3 rounded-lg text-lg font-semibold hover:bg-green-300 transition mb-4"
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
            className="w-full mb-3 p-3 rounded bg-black border border-[#39FF14] text-[#39FF14] placeholder-gray-400"
          />
          <button
            onClick={handleWithdrawRequest}
            className="bg-[#39FF14] text-black px-4 py-2 rounded w-full hover:bg-green-300"
          >
            Submit Withdrawal
          </button>
          {withdrawMessage && <p className="mt-2 text-[#39FF14]">{withdrawMessage}</p>}
        </div>
      )}
    </div>
  );
}
