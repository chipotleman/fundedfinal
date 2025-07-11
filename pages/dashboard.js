import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProfileDrawer from '../components/ProfileDrawer';
import ChallengeModal from '../components/ChallengeModal';
import Image from 'next/image';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [games, setGames] = useState([]);
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBetSlipModal, setShowBetSlipModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // collapsed by default
  const [teamLogos, setTeamLogos] = useState({});

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

  // Fetch team logos automatically
  useEffect(() => {
    const fetchLogos = async () => {
      const logos = {};
      for (const game of games) {
        const [team1, team2] = game.matchup.split(" vs ");
        for (const team of [team1, team2]) {
          if (!logos[team]) {
            try {
              const res = await fetch("/api/fetch-team-logo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ team_name: team }),
              });
              const data = await res.json();
              logos[team] = data.logo_url || "/team-logos/default.png";
            } catch {
              logos[team] = "/team-logos/default.png";
            }
          }
        }
      }
      setTeamLogos(logos);
    };
    if (games.length) fetchLogos();
  }, [games]);

  const handleBetSelect = (game) => {
    if (selectedBets.find(b => b.id === game.id)) {
      setSelectedBets(selectedBets.filter(b => b.id !== game.id));
    } else {
      setSelectedBets([...selectedBets, { ...game, odds: parseFloat(game.odds) }]);
    }
  };

  const removeBetLeg = (id) => {
    setSelectedBets(selectedBets.filter(b => b.id !== id));
  };

  const clearParlay = () => {
    setSelectedBets([]);
  };

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
      parlay_games: selectedBets.map(b => b.id)
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
    <div className="flex bg-black text-white min-h-screen font-mono">

      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-44 sm:w-48 md:w-56" : "w-16"} bg-black p-2 flex flex-col items-center transition-all relative`}>

        {/* League Filters */}
        <div className="flex flex-col space-y-2 mt-12">
          {leagues.map((item) => (
            <button
              key={item.league}
              onClick={() =>
                setSelectedLeague(item.league === selectedLeague ? null : item.league)
              }
              className={`flex items-center space-x-2 p-2 rounded transition ${
                item.league === selectedLeague
                  ? 'bg-green-900 text-green-300'
                  : 'text-white hover:bg-zinc-900'
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              {sidebarOpen && <span>{item.league}</span>}
            </button>
          ))}

          {/* Expansion Arrow */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mt-6 self-center text-green-400 text-2xl transition"
            style={{ background: 'transparent', border: 'none' }}
          >
            {sidebarOpen ? '⇤' : '⇥'}
          </button>
        </div>

        {/* ProfileDrawer pinned bottom-center */}
        <div
          className="fixed bottom-4 z-50 transition-all"
          style={{
            left: sidebarOpen ? '6rem' : '2rem',
            transform: 'translateX(-50%)'
          }}
        >
          <ProfileDrawer />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">

        {/* Header with clickable balance */}
        <div className="flex justify-between items-center p-4 relative">
          <Image src="/rollr-logo.png" alt="Rollr Logo" width={130} height={40} priority />
          <div
            onClick={() => setShowBalanceModal(true)}
            className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
          >
            <div className="text-sm text-green-300">Balance</div>
            <div className="text-xl font-semibold">${bankroll}</div>
          </div>
        </div>

        {/* Games */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {filteredGames.map((game) => {
            const isSelected = selectedBets.find(b => b.id === game.id);
            const [team1, team2] = game.matchup.split(" vs ");
            return (
              <div
                key={game.id}
                onClick={() => handleBetSelect(game)}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  isSelected ? 'border-green-400 bg-zinc-800' : 'border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Image
                    src={teamLogos[team1] || "/team-logos/default.png"}
                    alt={team1}
                    width={36}
                    height={36}
                    className="rounded-full bg-zinc-800 p-1"
                  />
                  <span className="text-green-400">vs</span>
                  <Image
                    src={teamLogos[team2] || "/team-logos/default.png"}
                    alt={team2}
                    width={36}
                    height={36}
                    className="rounded-full bg-zinc-800 p-1"
                  />
                </div>
                <p className="text-sm text-green-300 text-center">{game.matchup}</p>
                <p className="text-sm text-gray-400 text-center">Odds: {decimalToAmerican(parseFloat(game.odds))}</p>
                <p className="text-xs text-gray-500 text-center">{new Date(game.game_time).toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        {/* Bet slip floating button */}
        {selectedBets.length > 0 && !showBetSlipModal && (
          <button
            onClick={() => setShowBetSlipModal(true)}
            className="fixed bottom-6 right-6 text-7xl text-green-400 hover:scale-105 transition-transform z-50"
          >
            🧾
          </button>
        )}

        {/* Bet slip modal */}
        {showBetSlipModal && (
          <div
            onClick={() => setShowBetSlipModal(false)}
            className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900/95 rounded-lg border border-green-400 p-6 w-80 max-h-[80%] overflow-y-auto"
            >
              <h2 className="text-lg font-semibold text-green-400 mb-2">Parlay Slip</h2>
              {selectedBets.length === 0 ? (
                <p className="text-green-300 text-sm">No bets selected.</p>
              ) : (
                <>
                  {selectedBets.map((bet, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm text-green-300 mb-1">
                      <span>{bet.matchup} ({decimalToAmerican(bet.odds)})</span>
                      <button
                        onClick={() => removeBetLeg(bet.id)}
                        className="text-red-400 hover:text-red-500 ml-2"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                  <p className="text-green-400 mt-2">
                    Combined Odds: {decimalToAmerican(selectedBets.reduce((acc, bet) => acc * bet.odds, 1))}
                  </p>
                  <button
                    onClick={placeBets}
                    className="mt-2 w-full bg-green-400 text-black font-bold py-2 rounded hover:bg-green-500 transition"
                  >
                    Place Parlay
                  </button>
                  <button
                    onClick={clearParlay}
                    className="mt-2 w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition"
                  >
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
    </div>
  );
}
