import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';

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
    const odds = team === game.matchup.split(" vs ")[0].trim()
      ? parseFloat(game.odds_team1)
      : parseFloat(game.odds_team2);
    const newBet = { game_id: game.id, team, odds, matchup: game.matchup };

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

  const filteredGames = selectedLeague
    ? games.filter(game => game.sport === selectedLeague)
    : games;

  const startingBankroll = 1000;
  const challengeGoal = 2500;
  const pnl = bankroll - startingBankroll;
  const progressPercent = Math.min(100, (bankroll / challengeGoal) * 100);

  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavbar
        bankroll={bankroll}
        selectedBets={selectedBets}
        setShowBalanceModal={setShowBalanceModal}
        setShowBetSlipModal={setShowBetSlipModal}
      />

      <div className="flex pt-[80px]">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-16" : "w-0"} flex flex-col items-center px-2`}>
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() =>
                setSelectedLeague(item.league === selectedLeague ? null : item.league)
              }
              className="text-2xl my-1"
            >
              {item.emoji}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4">
          <BannerCarousel />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {filteredGames.map((game) => {
              const [team1, team2] = game.matchup.split(' vs ');
              const selectedBet = selectedBets.find(b => b.game_id === game.id);
              return (
                <div key={game.id} className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
                  <div className="flex justify-between items-center mb-2">
                    {[team1.trim(), team2.trim()].map((team, idx) => {
                      const isSelected = selectedBet?.team === team;
                      const odds = idx === 0 ? game.odds_team1 : game.odds_team2;
                      return (
                        <button
                          key={team}
                          onClick={() => handleTeamSelect(game, team)}
                          className={`flex flex-col items-center justify-center w-[48%] py-3 rounded-lg transition ${
                            isSelected ? 'bg-green-500 text-black' : 'bg-black text-green-400'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold">
                            {decimalToAmerican(parseFloat(odds))}
                          </div>
                          <span className="text-xs mt-1">{team}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {new Date(game.game_time).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showBalanceModal && (
        <ChallengeModal
          pnl={pnl}
          progressPercent={progressPercent}
          challengeGoal={challengeGoal}
          onClose={() => setShowBalanceModal(false)}
        />
      )}

      {showBetSlipModal && (
        <div onClick={() => setShowBetSlipModal(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-green-400 rounded-lg p-6 w-80 max-h-[80%] overflow-y-auto">
            <h2 className="text-green-400 font-bold text-lg mb-2">Bet Slip</h2>
            {selectedBets.length === 0 ? (
              <p className="text-green-200">No bets selected.</p>
            ) : (
              <>
                {selectedBets.map((bet, idx) => (
                  <div key={idx} className="flex justify-between items-center mb-1 text-green-300">
                    <span>{bet.team} ({decimalToAmerican(bet.odds)})</span>
                    <button
                      onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))}
                      className="text-red-400 hover:text-red-600"
                    >
                      ❌
                    </button>
                  </div>
                ))}
                <p className="mt-2 text-green-400">
                  Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
