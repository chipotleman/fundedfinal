// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBetSlipModal, setShowBetSlipModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState(null);

  const leagues = [
    { league: 'MLB', emoji: '⚾' },
    { league: 'NBA', emoji: '🏀' },
    { league: 'MLS', emoji: '⚽' },
    { league: 'WTA', emoji: '🎾' },
    { league: 'KBO', emoji: '⚾' },
    { league: 'NFL', emoji: '🏈' },
  ];

  const decimalToAmerican = (decimal) => {
    if (!decimal || isNaN(decimal)) return "N/A";
    if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
    return `${Math.round(-100 / (decimal - 1))}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      setUser(session.user);

      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', session.user.id)
        .single();
      setBankroll(balanceData?.balance || 0);

      const { data: gamesData } = await supabase
        .from('game_slates')
        .select('*')
        .order('game_time', { ascending: true });
      setGames(gamesData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleBetSelect = (game) => {
    if (selectedBets.find(b => b.id === game.id)) {
      setSelectedBets(selectedBets.filter(b => b.id !== game.id));
    } else {
      setSelectedBets([...selectedBets, { ...game, odds: parseFloat(game.odds) }]);
    }
  };

  const placeBets = async () => {
    if (!selectedBets.length) {
      alert("No bets selected.");
      return;
    }
    const combinedDecimal = selectedBets.reduce((acc, bet) => acc * bet.odds, 1);
    const { error } = await supabase.from('bets').insert([{
      user_id: user.id,
      game_id: null,
      amount: selectedBets[0].amount || 10,
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
      setShowBetSlipModal(false);
    }
  };

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  if (loading) {
    return <div className="text-center text-green-400 mt-10">Loading your dashboard...</div>;
  }

  return (
    <div className="relative min-h-screen bg-black text-white font-mono flex">

      {/* Sidebar */}
      <div className="w-48 bg-zinc-900 border-r border-zinc-700 flex flex-col p-4 space-y-3">
        {leagues.map((item) => (
          <button
            key={item.league}
            onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
            className={`flex items-center space-x-2 text-left text-sm p-2 rounded hover:bg-zinc-800 transition ${
              item.league === selectedLeague ? 'bg-green-800 text-green-300' : 'text-white'
            }`}
          >
            <span className="text-xl">{item.emoji}</span>
            <span>{item.league}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <Image src="/rollr-logo.png" alt="Rollr Logo" width={120} height={40} />

          <div className="text-center text-green-300 text-2xl font-semibold">
            💰 ${bankroll}
          </div>

          <ProfileDrawer />
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const isSelected = selectedBets.find(b => b.id === game.id);
            return (
              <div
                key={game.id}
                onClick={() => handleBetSelect(game)}
                className={`p-4 rounded-lg border transition cursor-pointer ${
                  isSelected ? 'border-green-400 bg-zinc-800' : 'border-zinc-700 hover:border-green-600'
                }`}
              >
                <h3 className="text-lg text-green-400">{game.matchup}</h3>
                <p className="text-sm text-gray-400">Odds: {decimalToAmerican(parseFloat(game.odds))}</p>
                <p className="text-xs text-gray-500">{new Date(game.game_time).toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        {/* Enlarged Rocket Floating Button */}
        {selectedBets.length > 0 && !showBetSlipModal && (
          <button
            onClick={() => setShowBetSlipModal(true)}
            className="fixed bottom-6 right-6 text-7xl text-green-400 hover:scale-105 transition-transform"
          >
            🚀
          </button>
        )}

        {/* Betslip Modal */}
        {showBetSlipModal && (
          <div
            onClick={() => setShowBetSlipModal(false)}
            className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900/95 rounded-lg border border-green-400 p-6 w-80 max-h-[80%] overflow-y-auto"
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
                  <p className="text-green-400 mt-2">
                    Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}
                  </p>
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
      </div>
    </div>
  );
}
