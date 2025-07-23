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
    const now = new Date();
    const gameTime = new Date(game.game_time);
    if (gameTime <= now) return; // prevent selecting started games

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

  const filteredGames = selectedLeague
    ? games.filter((game) => game.sport === selectedLeague)
    : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

  return (
    <div className="bg-black text-white min-h-screen font-mono pt-20 flex">
      {/* Sidebar */}
      <div className="hidden sm:flex bg-black p-2 flex-col items-center w-44 sm:w-48 md:w-56">
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
        <div className="fixed bottom-4 z-50 left-20">
          <ProfileDrawer />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <TopNavbar
          selectedBets={selectedBets}
          bankroll={bankroll}
          onShowBetSlip={() => setShowBetSlipModal(true)}
          onShowBalance={() => setShowBalanceModal(true)}
        />

        {/* League Bubbles (Mobile) */}
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

        {/* Games */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const selectedBet = selectedBets.find(b => b.game_id === game.id);
            const gameStarted = new Date(game.game_time) <= new Date();

            const renderTeamBox = (team, odds, isTeam1) => {
              const isSelected = selectedBet?.team === team;
              const teamAbbr = Object.keys(teamLogos).find(abbr => team.includes(abbr)) || '';
              const logo = teamLogos[teamAbbr];

              return (
                <div
                  onClick={() => {
                    if (!gameStarted) handleTeamSelect(game, team.trim());
                  }}
                  className={`flex flex-col items-center justify-center w-full p-3 sm:w-1/2 cursor-pointer transition rounded-b-lg sm:rounded-none ${
                    isSelected ? 'bg-[#4fe870] text-black' : 'bg-zinc-900 text-green-300'
                  } ${isTeam1 ? 'rounded-tl-lg sm:rounded-none' : 'rounded-tr-lg sm:rounded-none'} ${
                    gameStarted ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {logo && (
                    <img src={logo} alt={teamAbbr} className="w-10 h-10 mb-1" />
                  )}
                  <div className="font-bold text-sm text-center uppercase">{team.trim()}</div>
                  <div className="text-[11px] text-gray-400">Odds: {decimalToAmerican(parseFloat(odds))}</div>
                  <div className="text-[10px] text-gray-500">{new Date(game.game_time).toLocaleString()}</div>
                </div>
              );
            };

            return (
              <div key={game.id} className="rounded-xl border-2 border-green-600 overflow-hidden shadow-lg sm:flex bg-zinc-900">
                <div className="flex sm:flex-row flex-col w-full">
                  {renderTeamBox(team1, game.odds_team1, true)}
                  <div className="w-full h-[2px] sm:h-full sm:w-[2px] bg-green-500 opacity-30 sm:mx-0" />
                  {renderTeamBox(team2, game.odds_team2, false)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
