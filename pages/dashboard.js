import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      if (!session) return (window.location.href = '/login');
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

    // Collapse sidebar on small screens
    const handleResize = () => setSidebarOpen(window.innerWidth >= 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTeamSelect = (game, team) => {
    const existing = selectedBets.find(b => b.game_id === game.id);
    const odds = team === game.matchup.split(" vs ")[0].trim()
      ? parseFloat(game.odds_team1)
      : parseFloat(game.odds_team2);

    if (existing && existing.team === team) {
      setSelectedBets(selectedBets.filter(b => b.game_id !== game.id));
    } else {
      const newBet = { game_id: game.id, team, odds };
      setSelectedBets(existing
        ? selectedBets.map(b => b.game_id === game.id ? newBet : b)
        : [...selectedBets, newBet]);
    }
  };

  const clearParlay = () => setSelectedBets([]);

  const placeBets = async () => {
    if (!selectedBets.length) return alert("No bets selected.");
    const combinedDecimal = selectedBets.reduce((acc, b) => acc * b.odds, 1);
    const { error } = await supabase.from('bets').insert([{
      user_id: user.id,
      game_id: null,
      amount: selectedBets[0]?.amount || 10,
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
    ? games.filter(g => g.sport === selectedLeague)
    : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

  return (
    <div className="bg-black text-white min-h-screen font-mono pt-20 flex flex-col sm:flex-row">
      {/* Sidebar */}
      <div className={`transition-all ${sidebarOpen ? "w-full sm:w-48 md:w-56" : "w-16"} bg-black p-2 flex sm:flex-col items-center sm:items-start`}>
        <div className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 mt-4 sm:mt-12 w-full justify-center sm:justify-start">
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
              className={`flex items-center space-x-2 p-2 rounded w-full justify-center sm:justify-start transition ${
                item.league === selectedLeague ? 'bg-green-900 text-green-300' : 'text-white hover:bg-zinc-900'
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              {sidebarOpen && <span>{item.league}</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 sm:mt-6 sm:self-center text-green-400 text-2xl">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '⇤' : '⇥'}
          </button>
        </div>
        <div className="fixed bottom-4 z-50"
          style={{ left: sidebarOpen ? '6rem' : '2rem', transform: 'translateX(-50%)' }}>
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

        <div className="px-4 mt-4">
          <BannerCarousel />
        </div>

        {/* Matchups */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const selectedBet = selectedBets.find(b => b.game_id === game.id);

            const isSelected = (team) => selectedBet?.team === team;

            const renderTeamBox = (team, odds) => (
              <div
                onClick={() => handleTeamSelect(game, team.trim())}
                className={`flex flex-col items-center justify-center w-full sm:w-1/2 p-3 cursor-pointer transition ${
                  isSelected(team.trim()) ? 'bg-[#4fe870]' : ''
                }`}
              >
                <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black">
                  {isSelected(team.trim()) ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 text-[#4fe870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-green-400 text-base sm:text-xl font-bold">
                      {odds && !isNaN(odds) ? decimalToAmerican(parseFloat(odds)) : 'N/A'}
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-xs sm:text-sm text-center ${isSelected(team.trim()) ? 'text-black' : 'text-green-300'}`}>
                  {team.trim()}
                </p>
                <p className={`text-[10px] sm:text-xs ${isSelected(team.trim()) ? 'text-black' : 'text-gray-400'}`}>
                  Odds: {decimalToAmerican(odds)}
                </p>
                <p className={`text-[10px] ${isSelected(team.trim()) ? 'text-black' : 'text-gray-500'}`}>
                  {new Date(game.game_time).toLocaleString()}
                </p>
              </div>
            );

            return (
              <div key={game.id} className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden flex flex-col sm:flex-row">
                {renderTeamBox(team1, game.odds_team1)}
                {renderTeamBox(team2, game.odds_team2)}
              </div>
            );
          })}
        </div>

        {/* Modals */}
        {showBetSlipModal && (
          <div onClick={() => setShowBetSlipModal(false)} className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50">
            <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900/95 rounded-lg border border-green-400 p-6 w-[90vw] max-w-sm max-h-[80%] overflow-y-auto">
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
