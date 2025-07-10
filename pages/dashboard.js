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

  const pnlTarget = 1000; // Example target

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
    <div className="relative min-h-screen bg-black text-white p-4 font-mono">
      {/* ✅ Existing betting UI (do not remove, your betslip + active games rendering here) */}
      {/* KEEP YOUR EXISTING BET SLIP FUNCTIONALITY HERE */}

      <ProfileDrawer />

      {/* ✅ PnL HUD fixed in bottom-right */}
      <div className="fixed bottom-4 right-4 bg-zinc-900 border border-green-400 rounded-lg p-4 shadow-lg w-64 z-50">
        <h2 className="text-lg font-semibold text-green-400 mb-2">PnL Progress</h2>
        <p className="text-green-300 text-sm">Bankroll: ${bankroll}</p>
        <p className="text-green-300 text-sm">PnL: ${pnl}</p>
        <p className="text-green-300 text-sm">Target: ${pnlTarget}</p>
        <p className="text-green-300 text-sm">Remaining: ${remaining}</p>
        <p className="text-green-300 text-sm">Ends: {new Date(evaluation.evaluation_end_date).toLocaleDateString()}</p>
        <p className="text-green-300 text-sm mb-2">Status: {evaluation.status}</p>

        <div className="w-full bg-green-900 rounded-full h-3">
          <div
            className="bg-green-400 h-3 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-green-300 text-xs text-center mt-1">{progress}% to target</p>
      </div>
    </div>
  );
}
