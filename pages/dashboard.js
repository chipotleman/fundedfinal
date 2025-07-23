// FULL UPDATED DASHBOARD WITH TEAM LOGOS AND LOCKED STARTED GAMES
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

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data: gamesData } = await supabase
        .from('game_slates')
        .select('*')
        .gte('game_time', startOfDay.toISOString())
        .lte('game_time', endOfDay.toISOString())
        .order('game_time', { ascending: true });

      setGames(gamesData || []);
    };
    fetchData();
  }, []);

  const handleTeamSelect = (game, team) => {
    const gameTime = new Date(game.game_time);
    const now = new Date();
    if (gameTime <= now) return; // lock betting if game started

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

  const isGameStarted = (gameTime) => new Date(gameTime) <= new Date();

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  return (
    <div className="pt-20 px-4 pb-36">
      <TopNavbar bankroll={bankroll} selectedBets={selectedBets} />
      <BannerCarousel />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {filteredGames.map((game) => {
          const [team1, team2] = game.matchup.split(" vs ");
          const gameTime = new Date(game.game_time);
          const hasStarted = isGameStarted(game.game_time);
          const selectedBet = selectedBets.find(b => b.game_id === game.id);

          const renderTeam = (team, odds) => {
            const teamAbbr = Object.keys(teamLogos).find(abbr => team.includes(abbr));
            const logoSrc = teamLogos[teamAbbr] || null;
            const locked = hasStarted;
            return (
              <div
                className={`flex flex-col items-center justify-center w-full p-3 cursor-${locked ? 'not-allowed' : 'pointer'} ${locked ? 'bg-zinc-800 opacity-50' : 'bg-zinc-900 hover:bg-zinc-700'} transition rounded-lg border border-green-600`}
                onClick={() => !locked && handleTeamSelect(game, team.trim())}
              >
                {logoSrc && <img src={logoSrc} alt={teamAbbr} className="w-12 h-12 mb-1" />}
                <div className="font-bold text-sm text-center uppercase">{team.trim()}</div>
                <div className="text-[11px] text-gray-400">Odds: {decimalToAmerican(parseFloat(odds))}</div>
                <div className="text-[10px] text-gray-500">{gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            );
          };

          return (
            <div key={game.id} className="rounded-xl border-2 border-green-600 overflow-hidden shadow-lg bg-black">
              <div className="flex flex-col sm:flex-row">
                {renderTeam(team1, game.odds_team1)}
                <div className="w-full h-[2px] sm:h-full sm:w-[2px] bg-green-500 opacity-30 sm:mx-0" />
                {renderTeam(team2, game.odds_team2)}
              </div>
            </div>
          );
        })}
      </div>

      {showBetSlipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50">
          <div className="bg-zinc-900 p-6 rounded-lg border border-green-400 w-80">
            <h2 className="text-green-400 mb-2">Parlay Slip</h2>
            {selectedBets.length === 0 ? (
              <p className="text-green-300">No bets selected.</p>
            ) : (
              selectedBets.map((bet, idx) => (
                <div key={idx} className="flex justify-between items-center text-green-300">
                  <span>{bet.team} ML ({decimalToAmerican(bet.odds)})</span>
                  <button onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))}>❌</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showBalanceModal && (
        <ChallengeModal
          pnl={bankroll - 1000}
          progressPercent={Math.min(100, Math.max(0, (bankroll / 2500) * 100))}
          challengeGoal={2500}
          onClose={() => setShowBalanceModal(false)}
        />
      )}
    </div>
  );
}
