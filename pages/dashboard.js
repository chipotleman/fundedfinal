
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
  const [userStats, setUserStats] = useState({
    totalBets: 0,
    winRate: 0,
    totalPnL: 0,
    currentStreak: 0
  });

  const leagues = [
    { league: 'MLB', emoji: '⚾', color: 'bg-orange-500' },
    { league: 'NBA', emoji: '🏀', color: 'bg-orange-600' },
    { league: 'MLS', emoji: '⚽', color: 'bg-green-600' },
    { league: 'WTA', emoji: '🎾', color: 'bg-yellow-500' },
    { league: 'KBO', emoji: '⚾', color: 'bg-red-500' },
    { league: 'NFL', emoji: '🏈', color: 'bg-purple-600' },
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
      setBankroll(balanceData?.balance || 1000);

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
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white min-h-screen">
      {/* Top Navigation */}
      <TopNavbar
        selectedBets={selectedBets}
        bankroll={bankroll}
        onShowBetSlip={() => setShowBetSlipModal(true)}
        onShowBalance={() => setShowBalanceModal(true)}
        progressPercent={progressPercent}
      />

      <div className="flex pt-20">
        {/* Sidebar */}
        <div className="hidden lg:flex w-64 bg-slate-800/50 min-h-screen flex-col p-6">
          {/* Challenge Progress */}
          <div className="bg-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Challenge Progress</h3>
            <div className="relative h-3 bg-slate-700 rounded-full mb-3">
              <div 
                className="absolute h-3 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">${startingBankroll}</span>
              <span className="text-emerald-400 font-semibold">${bankroll}</span>
              <span className="text-gray-400">${challengeGoal}</span>
            </div>
            <div className="mt-4 p-3 bg-slate-700 rounded-lg">
              <div className="text-center">
                <div className={`text-2xl font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}${pnl}
                </div>
                <div className="text-gray-400 text-sm">Current P&L</div>
              </div>
            </div>
          </div>

          {/* League Filter */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Sports</h3>
            <div className="space-y-2">
              {leagues.map((item) => (
                <button
                  key={item.league}
                  onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                    item.league === selectedLeague 
                      ? 'bg-emerald-500 text-white' 
                      : 'text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="font-medium">{item.league}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Stats */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Your Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Bets:</span>
                <span className="text-white font-medium">{userStats.totalBets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Win Rate:</span>
                <span className="text-emerald-400 font-medium">{userStats.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total P&L:</span>
                <span className={`font-medium ${userStats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {userStats.totalPnL >= 0 ? '+' : ''}${userStats.totalPnL}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Streak:</span>
                <span className="text-white font-medium">{userStats.currentStreak}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Mobile League Filter */}
          <div className="lg:hidden mb-6">
            <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2">
              {leagues.map((item) => (
                <button
                  key={item.league}
                  onClick={() => setSelectedLeague(item.league === selectedLeague ? null : item.league)}
                  className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    item.league === selectedLeague
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span className="font-medium">{item.league}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGames.map((game) => {
              const [team1, team2] = game.matchup.split(" vs ");
              const gameStarted = new Date(game.game_time) <= new Date();
              const gameTime = new Date(game.game_time);

              return (
                <div key={game.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-all">
                  {/* Game Header */}
                  <div className="p-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                        {game.sport}
                      </span>
                      <span className="text-xs text-gray-400">
                        {gameStarted ? 'Live' : gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="p-4 space-y-3">
                    {[team1.trim(), team2.trim()].map((team, index) => {
                      const odds = index === 0 ? parseFloat(game.odds_team1) : parseFloat(game.odds_team2);
                      const isSelected = selectedBets.find(b => b.game_id === game.id)?.team === team;
                      const logo = getTeamLogo(team);

                      return (
                        <button
                          key={team}
                          onClick={() => handleTeamSelect(game, team)}
                          disabled={gameStarted}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-white scale-105'
                              : gameStarted
                              ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                              : 'bg-slate-700 text-white hover:bg-slate-600 hover:scale-102'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
                              {logo ? (
                                <img src={logo} alt={team} className="w-6 h-6 object-contain" />
                              ) : (
                                <span className="text-xs text-white">?</span>
                              )}
                            </div>
                            <span className="font-medium">{team}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              {gameStarted ? "Started" : decimalToAmerican(odds)}
                            </div>
                            {!gameStarted && (
                              <div className="text-xs opacity-75">
                                Decimal: {odds?.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-xl font-semibold text-white mb-2">No games available</h3>
              <p className="text-gray-400">Check back later for more betting opportunities</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Drawer */}
      <div className="fixed bottom-6 left-6 z-50">
        <ProfileDrawer />
      </div>

      {/* Modals */}
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
