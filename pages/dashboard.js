// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [bankroll, setBankroll] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [loading, setLoading] = useState(true);

  const pnlTarget = 1000; // example target

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

      // Fetch evaluation
      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('email', user.email)
        .order('evaluation_end_date', { ascending: false })
        .limit(1);
      setEvaluation(evalData ? evalData[0] : null);

      // Fetch bankroll
      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', user.id)
        .single();
      setBankroll(balanceData?.balance || 0);

      // Fetch PnL
      const { data: pnlData } = await supabase
        .from('user_pnl')
        .select('pnl')
        .eq('id', user.id)
        .single();
      setPnl(pnlData?.pnl || 0);

      // Fetch active games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'active');
      setGames(gamesData || []);

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleBetSelect = (game) => {
    if (selectedBets.find(b => b.id === game.id)) {
      setSelectedBets(selectedBets.filter(b => b.id !== game.id));
    } else {
      setSelectedBets([...selectedBets, { ...game, amount: 10 }]);
    }
  };

  const placeBets = async () => {
    if (!selectedBets.length) {
      alert("No bets selected.");
      return;
    }
    for (const bet of selectedBets) {
      const { error } = await supabase.from('bets').insert([{
        user_id: user.id,
        game_id: bet.id,
        amount: bet.amount,
        odds: bet.odds,
        status: 'open'
      }]);
      if (error) {
        console.error("Error placing bet:", error.message);
        alert(`Error placing bet on ${bet.team1} vs ${bet.team2}`);
      }
    }
    alert("Bets placed!");
    setSelectedBets([]);
  };

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
      {/* Logo in top-left */}
      <div className="absolute top-4 left-4 text-purple-400 text-xl font-bold">
        fundedfinal
      </div>

      {/* Profile Drawer in top-right */}
      <div className="absolute top-4 right-4">
        <ProfileDrawer />
      </div>

      {/* Games display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-16">
        {games.map((game) => (
          <div
            key={game.id}
            className={`p-4 rounded-lg border cursor-pointer ${selectedBets.find(b => b.id === game.id) ? 'border-green-400' : 'border-zinc-700'} hover:border-green-400`}
            onClick={() => handleBetSelect(game)}
          >
            <h3 className="text-lg text-green-400">{game.team1} vs {game.team2}</h3>
            <p className="text-sm text-gray-400">Odds: {game.odds}</p>
          </div>
        ))}
      </div>

      {/* Bet Slip */}
      {selectedBets.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-zinc-900 border border-green-400 rounded-lg p-4 w-72">
          <h2 className="text-lg font-semibold text-green-400 mb-2">Bet Slip</h2>
          {selectedBets.map((bet, index) => (
            <div key={index} className="flex justify-between text-sm text-green-300 mb-1">
              <span>{bet.team1} vs {bet.team2}</span>
              <span>Odds: {bet.odds}</span>
            </div>
          ))}
          <button
            onClick={placeBets}
            className="mt-2 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500"
          >
            Place Bets
          </button>
        </div>
      )}

      {/* PnL HUD */}
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
