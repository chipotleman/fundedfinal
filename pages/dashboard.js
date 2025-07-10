// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [bankroll, setBankroll] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);

  const pnlTarget = 1000; // Example target for challenge completion

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const user = session.user;
      setUser(user);
      console.log('Logged in user:', user);

      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('email', user.email)
        .order('evaluation_end_date', { ascending: false })
        .limit(1);

      console.log('Evaluation data:', evalData);
      setEvaluation(evalData ? evalData[0] : null);

      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', user.id)
        .single();

      console.log('Bankroll fetched:', balanceData);
      setBankroll(balanceData?.balance || 0);

      const { data: pnlData } = await supabase
        .from('user_pnl')
        .select('pnl')
        .eq('id', user.id)
        .single();

      console.log('PnL fetched:', pnlData);
      setPnl(pnlData?.pnl || 0);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center text-green-400 mt-10">Loading your dashboard...</div>;
  }

  if (!evaluation) {
    return <div className="text-center text-red-400 mt-10">No funded evaluation found for your account.</div>;
  }

  const progress = Math.min((pnl / pnlTarget) * 100, 100).toFixed(1);
  const remaining = pnlTarget - pnl;

  return (
    <div className="min-h-screen bg-black text-green-400 flex flex-col items-center p-4 font-mono">
      <div className="w-full max-w-2xl flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-purple-400 drop-shadow">Funded Dashboard</h1>
        <ProfileDrawer />
      </div>

      <div className="w-full max-w-md bg-zinc-900 rounded-xl p-6 shadow-lg">
        <h2 className="text-xl text-purple-400 font-semibold text-center mb-4">Welcome, {user.email}</h2>
        <p className="text-green-300 text-center">Funded Balance: ${bankroll}</p>
        <p className="text-green-300 text-center mt-1">Current PnL: ${pnl}</p>
        <p className="text-green-300 text-center mt-1">PnL Target: ${pnlTarget}</p>
        <p className="text-green-300 text-center mt-1">Remaining to Target: ${remaining}</p>
        <p className="text-green-300 text-center mt-1">
          Evaluation Ends: {new Date(evaluation.evaluation_end_date).toLocaleDateString()}
        </p>
        <p className="text-green-300 text-center mt-1">Status: {evaluation.status}</p>

        <div className="mt-4">
          <div className="w-full bg-green-900 rounded-full h-4">
            <div
              className="bg-green-400 h-4 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center mt-1 text-sm text-green-300">{progress}% to target</p>
        </div>
      </div>
    </div>
  );
}
