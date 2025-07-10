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
  const [showBetSlip, setShowBetSlip] = useState(false);
  const [showPnL, setShowPnL] = useState(false);

  const pnlTarget = 1000;

  const decimalToAmerican = (decimal) => {
    if (!decimal || isNaN(decimal)) return "N/A";
    if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
    return `${Math.round(-100 / (decimal - 1))}`;
  };

  const getLeagueEmoji = (league) => {
    if (league.includes('NBA') || league.includes('WNBA')) return '🏀';
    if (league === 'KBO' || league === 'MLB') return '⚾️';
    if (league === 'MLS') return '⚽️';
    if (league.includes('WTA')) return '🎾';
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
      setSelectedBets([...selectedBets, { ...game, amount: 10, odds }]);
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
      alert("Error placing parlay bet.");
    } else {
      alert("Parlay bet placed!");
      setSelectedBets([]);
      setShowBetSlip(false);
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
      <div className="flex flex-wrap items-center justify-between p-4 space-y-2 sm:space-y-0 sm:space-x-4">
        {/* Logo */}
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={120} height={40} />

        {/* League Selector */}
        <div className="flex overflow-x-auto space-x-2 bg-zinc-800/70 backdrop-blur-md rounded-lg border border-green-400/20 p-1 flex-grow justify-center">
          {leagues.map((league) => (
            <button
              key={league}
              onClick={() => setSelectedLeague(league === selectedLeague ? null : league)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
                selectedLeague === league ? 'bg-green-600' : 'bg-zinc-700 hover:bg-zinc-600'
              }`}
            >
              {getLeagueEmoji(league)} {league}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* User Balance */}
          <div className="flex items-center space-x-1 bg-zinc-800 px-3 py-1 rounded-full border border-green-500">
            <span className="text-green-400">💰</span>
            <span className="text-green-300 text-sm">${bankroll}</span>
          </div>

          {/* BETSLIP Button */}
          <button
            onClick={() => setShowBetSlip(!showBetSlip)}
            className={`px-3 py-1 rounded flex items-center space-x-1 ${showBetSlip ? 'bg-green-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}
          >
            <span>BETSLIP</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Progress Button */}
          <button
            onClick={() => setShowPnL(!showPnL)}
            className={`px-3 py-1 rounded flex items-center space-x-1 ${showPnL ? 'bg-green-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}
          >
            <span>Progress</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <ProfileDrawer />
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className={`p-4 rounded-lg border cursor-pointer ${
              selectedBets.find(b => b.id === game.id) ? 'border-green-400' : 'border-zinc-700'
            } hover:border-green-400`}
            onClick={() => handleBetSelect(game)}
          >
            <h3 className="text-lg text-green-400">{game.matchup}</h3>
            <p className="text-sm text-gray-400">Odds: {decimalToAmerican(parseFloat(game.odds))}</p>
            <p className="text-xs text-gray-500">{new Date(game.game_time).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* BETSLIP Modal */}
      {showBetSlip && (
        <div
          onClick={() => setShowBetSlip(false)}
          className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex justify-center items-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900/90 rounded-lg border border-green-400 p-6 w-80 max-h-[80%] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold text-green-400 mb-2">Parlay Slip</h2>
            {selectedBets.length === 0 ? (
              <p className="text-green-300 text-sm">No bets selected.</p>
            ) : (
              <>
                {selectedBets.map((bet, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-green-300 mb-1">
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
              </>
            )}
          </div>
        </div>
      )}

      {/* PnL Modal */}
      {showPnL && (
        <div
          onClick={() => setShowPnL(false)}
          className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex justify-center items-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900/90 rounded-lg border border-green-400 p-6 w-80"
          >
            <h2 className="text-lg font-semibold text-green-400 mb-2">PnL Progress</h2>
            <p className="text-green-300 text-sm">Bankroll: ${bankroll}</p>
            <p className="text-green-300 text-sm">PnL: ${pnl}</p>
            <p className="text-green-300 text-sm">Target: ${pnlTarget}</p>
            <p className="text-green-300 text-sm">Remaining: ${remaining}</p>
            <p className="text-green-300 text-sm mb-2">Status: {evaluation?.status || 'N/A'}</p>
            <div className="w-full bg-green-900 rounded-full h-3 mt-2">
              <div className="bg-green-400 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-green-300 text-xs text-center mt-1">{progress}% to target</p>
          </div>
        </div>
      )}
    </div>
  );
}
