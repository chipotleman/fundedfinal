// Full updated dashboard.js with full-height #4fe870 highlight and consistent aesthetic

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBetSlipModal, setShowBetSlipModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    };
    fetchData();
  }, []);

  const handleTeamSelect = (game, team) => {
    const existingBet = selectedBets.find(b => b.game_id === game.id);

    if (existingBet && existingBet.team === team) {
      setSelectedBets(selectedBets.filter(b => b.game_id !== game.id));
    } else {
      const newBet = {
        game_id: game.id,
        team: team,
        matchup: game.matchup,
        odds: parseFloat(game.odds),
      };
      setSelectedBets(prev =>
        existingBet
          ? prev.map(b => (b.game_id === game.id ? newBet : b))
          : [...prev, newBet]
      );
    }
  };

  const clearParlay = () => setSelectedBets([]);

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
      parlay_games: selectedBets.map(b => b.game_id),
      teams: selectedBets.map(b => b.team),
    }]);
    if (error) {
      alert("Error placing parlay bet.");
    } else {
      alert("Parlay bet placed!");
      clearParlay();
      setShowBetSlipModal(false);
    }
  };

  const filteredGames = selectedLeague ? games.filter((game) => game.sport === selectedLeague) : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

  return (
    <div className="flex bg-black text-white min-h-screen font-mono">
      {/* Sidebar */}
      {/* ... Sidebar code remains unchanged ... */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {/* ... Header code remains unchanged ... */}

        {/* Games */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const selectedBet = selectedBets.find(b => b.game_id === game.id);
            return (
              <div key={game.id} className="rounded-lg border border-zinc-700 transition overflow-hidden">
                <div className="flex h-full">
                  {/* Team 1 Half */}
                  <div
                    onClick={() => handleTeamSelect(game, team1.trim())}
                    style={{ backgroundColor: selectedBet?.team === team1.trim() ? '#4fe870' : 'transparent' }}
                    className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${selectedBet?.team === team1.trim() ? 'text-black' : ''}`}
                  >
                    <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 text-2xl font-bold ${selectedBet?.team === team1.trim() ? 'text-black' : 'text-green-400'}`}>
                      {team1.trim().charAt(0)}
                    </div>
                    <p className="mt-1 text-xs text-center">{team1.trim()}</p>
                  </div>

                  {/* Team 2 Half */}
                  <div
                    onClick={() => handleTeamSelect(game, team2.trim())}
                    style={{ backgroundColor: selectedBet?.team === team2.trim() ? '#4fe870' : 'transparent' }}
                    className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${selectedBet?.team === team2.trim() ? 'text-black' : ''}`}
                  >
                    <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 text-2xl font-bold ${selectedBet?.team === team2.trim() ? 'text-black' : 'text-green-400'}`}>
                      {team2.trim().charAt(0)}
                    </div>
                    <p className="mt-1 text-xs text-center">{team2.trim()}</p>
                  </div>
                </div>
                <div className="text-center p-2">
                  <p className="text-sm text-green-300">{game.matchup}</p>
                  <p className="text-sm text-gray-400">Odds: {decimalToAmerican(parseFloat(game.odds))}</p>
                  <p className="text-xs text-gray-500">{new Date(game.game_time).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ... Bet slip and modals remain unchanged ... */}
      </div>
    </div>
  );
}
