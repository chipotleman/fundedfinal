import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';
import TopNavbar from '../components/TopNavbar';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBetSlipModal, setShowBetSlipModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
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
        odds: team === game.matchup.split(" vs ")[0].trim()
          ? parseFloat(game.odds_team1)
          : parseFloat(game.odds_team2),
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

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavbar />

      <div className="flex">
        {/* Sidebar */}
        <div className="w-20 sm:w-24 md:w-28 bg-black border-r border-zinc-800 p-2 flex flex-col items-center justify-between fixed top-16 bottom-0 z-40">
          <div className="flex flex-col space-y-3 mt-6">
            {leagues.map((item) => (
              <button
                key={item.league}
                onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
                className={`text-2xl transition ${
                  item.league === selectedLeague ? 'text-[#4fe870]' : 'text-white hover:text-[#4fe870]'
                }`}
              >
                {item.emoji}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <ProfileDrawer />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-20 sm:ml-24 md:ml-28">
          {/* Header Cards */}
          <div className="flex justify-end p-4 space-x-4">
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

          <div className="px-4">
            <BannerCarousel />
          </div>

          {/* Games */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {filteredGames.map((game) => {
              const [team1, team2] = game.matchup.split(" vs ");
              const selectedBet = selectedBets.find(b => b.game_id === game.id);

              return (
                <div key={game.id} className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden flex">
                  {/* Team 1 */}
                  <div
                    onClick={() => handleTeamSelect(game, team1.trim())}
                    className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${
                      selectedBet?.team === team1.trim() ? 'bg-[#4fe870]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-black">
                      {selectedBet?.team === team1.trim() ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4fe870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-green-400 text-xl font-bold">
                          {game.odds_team1 && !isNaN(game.odds_team1)
                            ? decimalToAmerican(parseFloat(game.odds_team1))
                            : 'N/A'}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm text-center ${
                      selectedBet?.team === team1.trim() ? 'text-black' : 'text-green-300'
                    }`}>{team1.trim()}</p>
                  </div>

                  {/* Team 2 */}
                  <div
                    onClick={() => handleTeamSelect(game, team2.trim())}
                    className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${
                      selectedBet?.team === team2.trim() ? 'bg-[#4fe870]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-black">
                      {selectedBet?.team === team2.trim() ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4fe870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-green-400 text-xl font-bold">
                          {game.odds_team2 && !isNaN(game.odds_team2)
                            ? decimalToAmerican(parseFloat(game.odds_team2))
                            : 'N/A'}
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm text-center ${
                      selectedBet?.team === team2.trim() ? 'text-black' : 'text-green-300'
                    }`}>{team2.trim()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bet Slip Modal */}
      {showBetSlipModal && (
        <div onClick={() => setShowBetSlipModal(false)} className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900/95 rounded-lg border border-green-400 p-6 w-80 max-h-[80%] overflow-y-auto">
            <h2 className="text-lg font-semibold text-green-400 mb-2">Parlay Slip</h2>
            {selectedBets.length === 0 ? (
              <p className="text-green-300 text-sm">No bets selected.</p>
            ) : (
              <>
                {selectedBets.map((bet, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm text-green-300 mb-1">
                    <span>{bet.team} Moneyline ({decimalToAmerican(bet.odds)})</span>
                    <button onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))} className="text-red-400 hover:text-red-500 ml-2">❌</button>
                  </div>
                ))}
                <p className="text-green-400 mt-2">
                  Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}
                </p>
                <button onClick={placeBets} className="mt-2 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500 transition">
                  Place Parlay
                </button>
                <button onClick={clearParlay} className="mt-2 w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition">
                  Clear Parlay
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Challenge Modal */}
      {showBalanceModal && (
        <ChallengeModal
          pnl={pnl}
          progressPercent={progressPercent}
          challengeGoal={challengeGoal}
          onClose={() => setShowBalanceModal(false)}
        />
      )}
    </div>
  );
}
