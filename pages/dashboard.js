import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';
import TopNavbar from '../components/TopNavbar';
import teamLogos from '../utils/teamLogos';

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

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data: gamesData } = await supabase
        .from('game_slates')
        .select('*')
        .gte('game_time', start.toISOString())
        .lte('game_time', end.toISOString())
        .order('game_time', { ascending: true });

      setGames(gamesData || []);
    };
    fetchData();
  }, []);

  const handleTeamSelect = (game, team) => {
    if (new Date(game.game_time) <= new Date()) return;
    const existingBet = selectedBets.find(b => b.game_id === game.id);
    const odds = team === game.matchup.split(" vs ")[0].trim()
      ? parseFloat(game.odds_team1)
      : parseFloat(game.odds_team2);

    if (existingBet && existingBet.team === team) {
      setSelectedBets(selectedBets.filter(b => b.game_id !== game.id));
    } else {
      const newBet = { game_id: game.id, team, odds };
      setSelectedBets(existingBet
        ? selectedBets.map(b => b.game_id === game.id ? newBet : b)
        : [...selectedBets, newBet]);
    }
  };

  const placeBets = async () => {
    if (!selectedBets.length) return alert("No bets selected.");
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
    if (error) alert("Error placing parlay bet.");
    else {
      alert("Parlay placed!");
      setSelectedBets([]);
      setShowBetSlipModal(false);
    }
  };

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

  const filteredGames = (selectedLeague
    ? games.filter(g => g.sport === selectedLeague)
    : games
  ).sort((a, b) => {
    const now = new Date();
    const aStarted = new Date(a.game_time) <= now;
    const bStarted = new Date(b.game_time) <= now;
    return aStarted - bStarted || new Date(a.game_time) - new Date(b.game_time);
  });

  return (
    <div className="bg-black text-white min-h-screen font-mono pt-20 flex">
      {/* Sidebar */}
      <div className="hidden sm:flex flex-col bg-black p-4 w-48">
        <div className="mt-12 space-y-2">
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
              className={`w-full p-2 rounded text-left ${
                item.league === selectedLeague ? 'bg-green-900 text-green-300' : 'hover:bg-zinc-800'
              }`}
            >
              {item.emoji} {item.league}
            </button>
          ))}
        </div>
        <div className="fixed bottom-4 left-6">
          <ProfileDrawer />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <TopNavbar
          selectedBets={selectedBets}
          bankroll={bankroll}
          onShowBetSlip={() => setShowBetSlipModal(true)}
          onShowBalance={() => setShowBalanceModal(true)}
        />

        {/* Mobile League Buttons */}
        <div className="sm:hidden px-4 mt-4">
          <div className="flex space-x-3 overflow-x-auto">
            {leagues.map((item) => (
              <button
                key={item.league}
                onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
                className={`w-14 h-14 flex items-center justify-center rounded-full text-xl ${
                  item.league === selectedLeague ? 'bg-green-600 text-black' : 'bg-zinc-800 text-green-300'
                }`}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Banner */}
        <div className="px-4 mt-4">
          <BannerCarousel />
        </div>

        {/* Matchup cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const now = new Date();
            const gameStarted = new Date(game.game_time) <= now;
            const selectedBet = selectedBets.find(b => b.game_id === game.id);
            const isSelected = (team) => selectedBet?.team === team;

            const renderTeamBox = (team, odds) => (
              <div
                onClick={() => handleTeamSelect(game, team.trim())}
                className={`w-full text-center cursor-pointer transition p-2 rounded-lg ${
                  isSelected(team.trim())
                    ? 'bg-[#4fe870] text-black'
                    : gameStarted
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-900 text-green-300 hover:bg-zinc-700'
                }`}
              >
                <img
                  src={teamLogos[team.trim()]}
                  alt={team}
                  className="w-10 h-10 object-contain mx-auto mb-1"
                />
                <div className="font-bold text-sm">{team.trim()}</div>
                <div className="text-xs">
                  {gameStarted ? 'Game Started' : decimalToAmerican(parseFloat(odds))}
                </div>
              </div>
            );

            return (
              <div key={game.id} className="border border-green-700 rounded-lg overflow-hidden">
                <div className="bg-zinc-900 flex">
                  <div className="w-1/2">{renderTeamBox(team1, game.odds_team1)}</div>
                  <div className="w-[2px] bg-green-500 opacity-30" />
                  <div className="w-1/2">{renderTeamBox(team2, game.odds_team2)}</div>
                </div>
              </div>
            );
          })}
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
                      <span>{bet.team} ML ({decimalToAmerican(bet.odds)})</span>
                      <button onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))} className="text-red-400 hover:text-red-500 ml-2">❌</button>
                    </div>
                  ))}
                  <div className="mt-2 text-green-300 text-sm space-y-1">
                    <label htmlFor="wager" className="block text-green-400 font-semibold">Wager:</label>
                    <input
                      id="wager"
                      type="number"
                      min="1"
                      placeholder="Enter amount"
                      className="w-full px-3 py-1 rounded bg-black border border-green-500 text-white"
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value);
                        setSelectedBets(selectedBets.map(b => ({ ...b, amount })));
                      }}
                    />
                    <p>Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}</p>
                    <p>Estimated Payout: ${(selectedBets[0]?.amount || 0) * selectedBets.reduce((acc, bet) => acc * bet.odds, 1)}</p>
                    <p>Progress: {progressPercent.toFixed(2)}%</p>
                  </div>
                  <button onClick={placeBets} className="mt-3 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500 transition">
                    Place Parlay
                  </button>
                  <button onClick={() => setSelectedBets([])} className="mt-2 w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition">
                    Clear Slip
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Balance Modal */}
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
