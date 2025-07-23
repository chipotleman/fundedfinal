import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import teamLogos from '../utils/teamLogos';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';
import TopNavbar from '../components/TopNavbar';

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
    return decimal >= 2
      ? `+${Math.round((decimal - 1) * 100)}`
      : `${Math.round(-100 / (decimal - 1))}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return (window.location.href = '/login');
      setUser(session.user);

      const { data: balanceData } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', session.user.id)
        .single();
      setBankroll(balanceData?.balance || 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: gamesData } = await supabase
        .from('game_slates')
        .select('*')
        .gte('game_time', todayStart.toISOString())
        .lte('game_time', todayEnd.toISOString());

      if (gamesData) {
        const now = new Date();
        const sorted = [...gamesData].sort((a, b) => {
          const aStarted = new Date(a.game_time) < now;
          const bStarted = new Date(b.game_time) < now;
          if (aStarted === bStarted) {
            return new Date(a.game_time) - new Date(b.game_time);
          }
          return aStarted ? 1 : -1;
        });
        setGames(sorted);
      }
    };
    fetchData();
  }, []);

  const handleTeamSelect = (game, team) => {
    const now = new Date();
    if (new Date(game.game_time) < now) return;

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

  const clearParlay = () => setSelectedBets([]);

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
  const progressPercent = Math.min(100, (bankroll / challengeGoal) * 100);

  return (
    <div className="bg-black text-white min-h-screen font-mono pt-20 flex">
      {/* Sidebar */}
      <div className="hidden sm:flex transition-all bg-black p-2 flex-col items-center w-44 sm:w-48 md:w-56">
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
              <span>{item.league}</span>
            </button>
          ))}
        </div>
        <div className="fixed bottom-4 z-50 transition-all left-20">
          <ProfileDrawer />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <TopNavbar
          selectedBets={selectedBets}
          bankroll={bankroll}
          onShowBetSlip={() => setShowBetSlipModal(true)}
          onShowBalance={() => setShowBalanceModal(true)}
        />

        {/* Mobile League Bubbles */}
        <div className="sm:hidden px-4 mt-4">
          <div className="flex space-x-4 overflow-x-auto scrollbar-hide">
            {leagues.map((item) => (
              <button
                key={item.league}
                onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
                className={`flex-shrink-0 w-14 h-14 rounded-full text-2xl flex items-center justify-center transition border-2 ${
                  item.league === selectedLeague
                    ? 'bg-green-700 text-black border-green-400'
                    : 'bg-zinc-800 text-green-300 border-zinc-700'
                }`}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Banner */}
        <div className="px-4 mt-4 mb-6">
          <div className="rounded-lg overflow-hidden border border-zinc-700">
            <BannerCarousel />
          </div>
        </div>

        {/* Matchups */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const isStarted = new Date(game.game_time) < new Date();
            const selectedBet = selectedBets.find(b => b.game_id === game.id);
            const isSelected = (team) => selectedBet?.team === team;

            const renderTeamBox = (team, odds, isTeam1) => (
              <div
                onClick={() => handleTeamSelect(game, team.trim())}
                className={`flex flex-col items-center justify-center w-full p-3 sm:w-1/2 cursor-pointer transition rounded-b-lg sm:rounded-none ${
                  isSelected(team.trim()) ? 'bg-[#4fe870] text-black' : 'bg-zinc-900 text-green-300'
                } ${isTeam1 ? 'rounded-tl-lg sm:rounded-none' : 'rounded-tr-lg sm:rounded-none'} ${
                  isStarted ? 'opacity-30 pointer-events-none' : ''
                }`}
              >
                <img
                  src={teamLogos[team.trim()] || '/logos/mlb/default.png'}
                  alt={team}
                  className="w-10 h-10 object-contain mb-1"
                />
                <div className="mt-1 font-bold text-xs text-center uppercase">{team.trim()}</div>
                <div className="text-[11px] text-gray-400">Odds: {decimalToAmerican(parseFloat(odds))}</div>
              </div>
            );

            return (
              <div key={game.id} className="rounded-xl border-2 border-green-600 overflow-hidden shadow-lg sm:flex bg-zinc-900">
                <div className="flex sm:flex-row flex-col w-full">
                  {renderTeamBox(team1, game.odds_team1, true)}
                  <div className="w-full h-[2px] sm:h-full sm:w-[2px] bg-green-500 opacity-30 sm:mx-0" />
                  {renderTeamBox(team2, game.odds_team2, false)}
                </div>
                <div className="text-center text-xs text-gray-400 py-1">
                  {new Date(game.game_time).toLocaleString()}
                  {isStarted && <span className="text-red-400 ml-2">Game Started</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modals */}
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
                    <p>Estimated Payout: ${(selectedBets[0]?.amount || 0 * selectedBets.reduce((acc, bet) => acc * bet.odds, 1)).toFixed(2)}</p>
                    <p>Progress: {progressPercent.toFixed(2)}%</p>
                  </div>
                  <button onClick={placeBets} className="mt-3 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500 transition">
                    Place Parlay
                  </button>
                  <button onClick={clearParlay} className="mt-2 w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition">
                    Clear Slip
                  </button>
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
