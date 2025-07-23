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
        .lte('game_time', end.toISOString());

      if (gamesData) {
        const now = new Date();
        const sorted = [...gamesData].sort((a, b) => {
          const aStarted = new Date(a.game_time) <= now;
          const bStarted = new Date(b.game_time) <= now;
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
    const gameStarted = new Date(game.game_time) <= new Date();
    if (gameStarted) return;

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
    ? games.filter((g) => g.sport === selectedLeague)
    : games;

  const getTeamLogo = (team) => {
    return teamLogos[team] || null;
  };

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, Math.max(0, (bankroll / challengeGoal) * 100));

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

        {/* Mobile League Filter */}
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

        {/* Games Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const [team1, team2] = game.matchup.split(" vs ");
            const gameStarted = new Date(game.game_time) <= new Date();

            const renderTeamBox = (team, odds) => {
              const isSelected = selectedBets.find(b => b.game_id === game.id)?.team === team;
              const logo = getTeamLogo(team);

              return (
                <div
                  onClick={() => handleTeamSelect(game, team)}
                  className={`flex flex-col items-center justify-center w-full p-3 cursor-pointer transition ${
                    isSelected ? 'bg-[#4fe870] text-black' : 'bg-zinc-900 text-green-300'
                  } ${gameStarted ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-800'}`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-green-500 bg-black shadow-md overflow-hidden mb-1">
                    {logo ? (
                      <img src={logo} alt={team} className="object-contain w-10 h-10" />
                    ) : (
                      <span className="text-xs text-white">?</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-center">{team}</div>
                  <div className="text-[11px] text-gray-400">{gameStarted ? "Game Started" : `Odds: ${decimalToAmerican(odds)}`}</div>
                </div>
              );
            };

            return (
              <div key={game.id} className="rounded-xl border border-green-600 overflow-hidden shadow-lg bg-zinc-900">
                <div className="grid grid-cols-2">
                  {renderTeamBox(team1.trim(), parseFloat(game.odds_team1))}
                  {renderTeamBox(team2.trim(), parseFloat(game.odds_team2))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
