import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [wager, setWager] = useState(10);
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
    const newOdds = team === game.matchup.split(" vs ")[0].trim()
      ? parseFloat(game.odds_team1)
      : parseFloat(game.odds_team2);

    const newBet = {
      game_id: game.id,
      team: team,
      matchup: game.matchup,
      odds: newOdds,
    };

    if (existingBet && existingBet.team === team) {
      setSelectedBets(selectedBets.filter(b => b.game_id !== game.id));
    } else {
      setSelectedBets(prev =>
        existingBet
          ? prev.map(b => (b.game_id === game.id ? newBet : b))
          : [...prev, newBet]
      );
    }
  };

  const clearParlay = () => setSelectedBets([]);

  const placeBets = async () => {
    if (!selectedBets.length) return alert("No bets selected.");
    const combinedDecimal = selectedBets.reduce((acc, bet) => acc * bet.odds, 1);
    const { error } = await supabase.from('bets').insert([{
      user_id: user.id,
      game_id: null,
      amount: wager,
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
      setWager(10);
      setShowBetSlipModal(false);
    }
  };

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));
  const combinedDecimal = selectedBets.reduce((acc, bet) => acc * bet.odds, 1);
  const payout = (combinedDecimal * wager).toFixed(2);
  const simulatedProgress = ((parseFloat(payout) + bankroll - startingBankroll) / (challengeGoal - startingBankroll)) * 100;
  const progressChange = Math.max(0, Math.min(100, simulatedProgress)) - progressPercent;

  return (
    <div className="flex bg-black text-white min-h-screen font-mono">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-44 sm:w-48 md:w-56" : "w-16"} bg-black p-2 flex flex-col items-center transition-all relative`}>
        <div className="flex flex-col space-y-2 mt-12">
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
              className={`flex items-center space-x-2 p-2 rounded transition ${
                item.league === selectedLeague ? 'bg-green-900 text-green-300' : 'text-white hover:bg-zinc-900'
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              {sidebarOpen && <span>{item.league}</span>}
            </button>
          ))}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mt-6 self-center text-green-400 text-2xl transition"
          >
            {sidebarOpen ? '⇤' : '⇥'}
          </button>
        </div>
        <div className="fixed bottom-4 z-50 transition-all"
          style={{ left: sidebarOpen ? '6rem' : '2rem', transform: 'translateX(-50%)' }}>
          <ProfileDrawer />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <Image src="/rollr-logo.png" alt="Rollr Logo" width={130} height={40} priority />
          <div className="flex space-x-4 items-center">
            {selectedBets.length > 0 && (
              <div
                onClick={() => setShowBetSlipModal(true)}
                className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
              >
                <div className="text-sm text-green-300">Slip</div>
                <div className="text-xl font-semibold">{selectedBets.length}</div>
              </div>
            )}
            <div
              onClick={() => setShowBalanceModal(true)}
              className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
            >
              <div className="text-sm text-green-300">Balance</div>
              <div className="text-xl font-semibold">${bankroll}</div>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="px-4">
          <BannerCarousel />
        </div>

        {/* Game Matchups */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const selectedBet = selectedBets.find(b => b.game_id === game.id);

            return (
              <div key={game.id} className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden flex">
                {[team1, team2].map((team, index) => {
                  const isSelected = selectedBet?.team === team.trim();
                  const odds = index === 0 ? game.odds_team1 : game.odds_team2;

                  return (
                    <div
                      key={team}
                      onClick={() => handleTeamSelect(game, team.trim())}
                      className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${
                        isSelected ? 'bg-[#4fe870]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-black">
                        {isSelected ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4fe870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-green-400 text-xl font-bold">
                            {odds ? decimalToAmerican(parseFloat(odds)) : 'N/A'}
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-sm text-center ${isSelected ? 'text-black' : 'text-green-300'}`}>
                        {team.trim()}
                      </p>
                      <p className={`text-xs ${isSelected ? 'text-black' : 'text-gray-400'}`}>
                        Odds: {odds ? decimalToAmerican(parseFloat(odds)) : 'N/A'}
                      </p>
                      <p className={`text-[10px] ${isSelected ? 'text-black' : 'text-gray-500'}`}>
                        {new Date(game.game_time).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Bet Slip Modal */}
        {showBetSlipModal && (
          <div onClick={() => setShowBetSlipModal(false)} className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50">
            <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900/95 rounded-lg border border-green-400 p-6 w-[360px] max-h-[80%] overflow-y-auto">
              <h2 className="text-lg font-semibold text-green-400 mb-2">Parlay Slip</h2>
              {selectedBets.length === 0 ? (
                <p className="text-green-300 text-sm">No bets selected.</p>
              ) : (
                <>
                  {selectedBets.map((bet, idx) => (
                    <div key={idx} className="border border-zinc-700 rounded p-2 mb-2 text-green-300 flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold">{bet.team} Moneyline</span>
                        <span className="text-xs text-gray-400">{decimalToAmerican(bet.odds)}</span>
                      </div>
                      <button onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))} className="text-red-400 hover:text-red-500 text-lg">×</button>
                    </div>
                  ))}
                  <div className="mt-3 space-y-2">
                    <label className="text-green-300 text-sm">Wager:</label>
                    <input
                      type="number"
                      min="1"
                      value={wager}
                      onChange={(e) => setWager(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-zinc-800 text-green-300 border border-green-400 focus:outline-none"
                    />
                    <p className="text-green-400 text-sm">Payout: ${payout}</p>
                    <p className="text-green-500 text-xs">
                      {progressChange >= 0
                        ? `🏆 +${progressChange.toFixed(1)}% closer to funded`
                        : `💸 ${progressChange.toFixed(1)}% loss`}
                    </p>
                    <button onClick={placeBets} className="w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500 transition">
                      Place Parlay
                    </button>
                    <button onClick={clearParlay} className="w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition">
                      Clear Parlay
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showBalanceModal && (
          <ChallengeModal
            pnl={pnl}
            progressPercent={progressPercent}
            challengeGoal={challengeGoal}
            onClose={() => setShowBalanceModal(false)}
          />
        )}
      </div>
    </div>
  );
}
