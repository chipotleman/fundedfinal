// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [bankroll, setBankroll] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagues, setLeagues] = useState([]);

  const pnlTarget = 1000;

  const decimalToAmerican = (decimal) => {
    if (!decimal || isNaN(decimal)) return "N/A";
    if (decimal >= 2) {
      return `+${Math.round((decimal - 1) * 100)}`;
    } else {
      return `${Math.round(-100 / (decimal - 1))}`;
    }
  };

  const getLeagueEmoji = (league) => {
    if (league.includes('NBA')) return '🏀';
    if (league === 'KBO' || league === 'MLB') return '⚾️';
    if (league === 'MLS') return '⚽️';
    if (league === 'WTA') return '🎾';
    return '';
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const user = session.user;
      setUser(user);

      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('email', user.email)
        .order('evaluation_end_date', { ascending: false })
        .limit(1);
      setEvaluation(evalData ? evalData[0] : null);

      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', user.id)
        .single();
      setBankroll(balanceData?.balance || 0);

      const { data: pnlData } = await supabase
        .from('user_pnl')
        .select('pnl')
        .eq('id', user.id)
        .single();
      setPnl(pnlData?.pnl || 0);

      const { data: gamesData } = await supabase
        .from('game_slates')
        .select('*')
        .order('game_time', { ascending: true });
      setGames(gamesData || []);

      const uniqueLeagues = [...new Set((gamesData || []).map(game => game.sport))];
      setLeagues(uniqueLeagues);

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleBetSelect = (game) => {
    if (selectedBets.find(b => b.id === game.id)) {
      setSelectedBets(selectedBets.filter(b => b.id !== game.id));
    } else {
      const odds = parseFloat(game.odds);
      setSelectedBets([...selectedBets, { ...game, amount: 10, odds: odds }]);
    }
  };

  const getCombinedDecimal = () => {
    return selectedBets.reduce((acc, bet) => acc * bet.odds, 1);
  };

  const placeBets = async () => {
    if (!selectedBets.length) {
      alert("No bets selected.");
      return;
    }

    const combinedDecimal = getCombinedDecimal();

    const { error } = await supabase.from('bets').insert([{
      user_id: user.id,
      game_id: null,
      amount: selectedBets[0].amount,
      odds: combinedDecimal,
      status: 'open',
      type: 'parlay',
      parlay_games: selectedBets.map(b => b.id)
    }]);

    if (error) {
      console.error("Error placing parlay:", error.message);
      alert("Error placing parlay bet.");
    } else {
      alert("Parlay bet placed!");
      setSelectedBets([]);
    }
  };

  if (loading) {
    return <div className="text-center text-green-400 mt-10">Loading your dashboard...</div>;
  }

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  const progress = Math.min((pnl / pnlTarget) * 100, 100).toFixed(1);
  const remaining = pnlTarget - pnl;
  const combinedDecimal = getCombinedDecimal();
  const combinedUS = decimalToAmerican(combinedDecimal);

  return (
    <div className="relative min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={120} height={40} />
        <ProfileDrawer />
      </div>

      {/* Top Menu Bar */}
      <div className="flex overflow-x-auto space-x-2 p-2 mx-4 mt-2 bg-zinc-800/70 backdrop-blur-md rounded-lg border border-green-400/20">
        {leagues.map((league) => (
          <button
            key={league}
            onClick={() => setSelectedLeague(league === selectedLeague ? null : league)}
            className={`px-4 py-2 rounded whitespace-nowrap transition transform ${
              selectedLeague === league ? 'bg-green-600 scale-105' : 'bg-zinc-700 hover:bg-zinc-600'
            }`}
          >
            <span className="text-lg">{getLeagueEmoji(league)}</span> {league}
          </button>
        ))}
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 mt-6">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className={`p-4 rounded-lg border cursor-pointer ${
              selectedBets.find(b => b.id === game.id) ? 'border-green-400' : 'border-zinc-700'
            } hover:border-green-400`}
            onClick={() => handleBetSelect(game)}
          >
            <h3 className="text-lg text-green-400">{game.matchup}</h3>
            <p className="text-sm text-gray-400">
              Odds: {decimalToAmerican(parseFloat(game.odds))}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(game.game_time).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Parlay Bet Slip */}
      {selectedBets.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-zinc-900 border border-green-400 rounded-lg p-4 w-72 z-50">
          <h2 className="text-lg font-semibold text-green-400 mb-2">Parlay Slip</h2>
          {selectedBets.map((bet, index) => (
            <div key={index} className="flex justify-between text-sm text-green-300 mb-1">
              <span>{bet.matchup}</span>
              <span>{decimalToAmerican(bet.odds)}</span>
            </div>
          ))}
          <p className="text-green-400 mt-2">Combined Odds: {combinedUS}</p>
          <button
            onClick={placeBets}
            className="mt-2 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500"
          >
            Place Parlay
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
