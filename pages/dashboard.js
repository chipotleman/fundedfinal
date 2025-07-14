import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
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

    const newBet = {
      game_id: game.id,
      team,
      matchup: game.matchup,
      odds,
    };

    if (existingBet && existingBet.team === team) {
      setSelectedBets(prev => prev.filter(b => b.game_id !== game.id));
    } else {
      setSelectedBets(prev => {
        const withoutOld = prev.filter(b => b.game_id !== game.id);
        return [...withoutOld, newBet];
      });
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
    <div className="min-h-screen bg-black text-white font-mono">
      <TopNavbar
        bankroll={bankroll}
        selectedBets={selectedBets}
        setShowBetSlipModal={setShowBetSlipModal}
        setShowBalanceModal={setShowBalanceModal}
      />

      <div className="flex pt-20">
        {/* Sidebar */}
        <div className="w-16 sm:w-20 md:w-24 bg-black px-2 flex flex-col items-center">
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() =>
                setSelectedLeague(
                  item.league === selectedLeague ? null : item.league
                )
              }
              className={`my-2 text-2xl transition ${
                item.league === selectedLeague
                  ? 'text-green-300'
                  : 'text-white hover:text-green-400'
              }`}
            >
              {item.emoji}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-x-hidden">
          <div className="p-4 pt-0">
            <BannerCarousel />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {filteredGames.map((game) => {
              const [team1, team2] = game.matchup.split(' vs ');
              const selected = selectedBets.find((b) => b.game_id === game.id);

              const renderTeam = (team, odds, isSelected) => (
                <div
                  onClick={() => handleTeamSelect(game, team.trim())}
                  className={`flex flex-col items-center justify-center w-1/2 p-4 cursor-pointer transition ${
                    isSelected ? 'bg-[#4fe870]' : ''
                  }`}
                >
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-black text-xl font-bold">
                    {isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4fe870]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-green-400">{decimalToAmerican(odds)}</span>
                    )}
                  </div>
                  <p className={`mt-1 text-sm ${isSelected ? 'text-black' : 'text-green-300'}`}>{team}</p>
                  <p className={`text-xs ${isSelected ? 'text-black' : 'text-gray-400'}`}>Odds: {decimalToAmerican(odds)}</p>
                </div>
              );

              return (
                <div key={game.id} className="flex rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden">
                  {renderTeam(team1.trim(), parseFloat(game.odds_team1), selected?.team === team1.trim())}
                  {renderTeam(team2.trim(), parseFloat(game.odds_team2), selected?.team === team2.trim())}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bet Slip Modal */}
      {showBetSlipModal && (
        <div onClick={() => setShowBetSlipModal(false)} className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-green-400 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-green-400 mb-2">Your Parlay</h2>
            {selectedBets.length === 0 ? (
              <p className="text-green-300">No bets added.</p>
            ) : (
              <>
                {selectedBets.map((bet, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm mb-2">
                    <span className="text-green-300">{bet.team} ({decimalToAmerican(bet.odds)})</span>
                    <button onClick={() => setSelectedBets(selectedBets.filter(b => b.game_id !== bet.game_id))} className="text-red-500 hover:text-red-600">✖</button>
                  </div>
                ))}
                <div className="mt-4">
                  <label className="text-sm text-green-300">Wager Amount</label>
                  <input type="number" className="w-full mt-1 p-2 bg-black text-white border border-green-400 rounded" placeholder="10" />
                </div>
                <p className="text-green-400 mt-2">Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}</p>
                <p className="text-green-400 mt-1">Estimated Payout: $XX</p>
                <div className="w-full bg-zinc-700 rounded-full h-2 mt-4">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: '40%' }}></div>
                </div>
                <p className="text-xs text-green-300 mt-1">Progress: +40 towards challenge</p>
                <button className="mt-4 w-full bg-green-500 text-black font-bold py-2 rounded hover:bg-green-600 transition">Place Bet</button>
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
  );
}
