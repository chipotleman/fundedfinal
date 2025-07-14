import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard({
  bankroll,
  setBankroll,
  selectedBets,
  setSelectedBets,
  showWalletModal,
  setShowWalletModal,
  showBetSlip,
  setShowBetSlip,
}) {
  const [matchups, setMatchups] = useState([]);

  useEffect(() => {
    const fetchUserBalance = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("No logged-in user found");
        return;
      }

      const { data, error } = await supabase
        .from('user_balances')
        .select('Balance')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error("Failed to fetch user balance:", error.message);
        return;
      }

      if (data?.Balance !== undefined) {
        setBankroll(data.Balance);
      }
    };

    const fetchMatchups = async () => {
      const { data, error } = await supabase
        .from('matchups')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching matchups:', error.message);
      } else {
        setMatchups(data);
      }
    };

    fetchUserBalance();
    fetchMatchups();
  }, []);

  const handleSelectBet = (matchupId, team, odds) => {
    const isSelected = selectedBets.some(
      (bet) => bet.matchupId === matchupId && bet.team === team
    );

    if (isSelected) {
      setSelectedBets((prev) =>
        prev.filter(
          (bet) => !(bet.matchupId === matchupId && bet.team === team)
        )
      );
    } else {
      setSelectedBets((prev) => [
        ...prev,
        { matchupId, team, odds, id: `${matchupId}-${team}` },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 sm:px-8">
      <h1 className="text-3xl font-bold text-green-400 mb-6 font-mono">Dashboard</h1>

      {matchups.length === 0 ? (
        <div className="text-center text-zinc-400">Loading matchups...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matchups.map((matchup) => (
            <div
              key={matchup.id}
              className="bg-zinc-900 border border-green-700 rounded-xl p-4 shadow-lg"
            >
              <div className="text-green-300 font-mono text-sm mb-2">
                {matchup.team_a} vs {matchup.team_b}
              </div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() =>
                    handleSelectBet(matchup.id, matchup.team_a, matchup.odds_a)
                  }
                  className={`${
                    selectedBets.some(
                      (b) => b.matchupId === matchup.id && b.team === matchup.team_a
                    )
                      ? 'bg-green-600 text-black'
                      : 'bg-black text-green-300'
                  } border border-green-600 rounded-full px-6 py-3 text-lg font-bold font-mono hover:bg-green-500 hover:text-black transition`}
                >
                  {matchup.team_a} ({matchup.odds_a})
                </button>
                <button
                  onClick={() =>
                    handleSelectBet(matchup.id, matchup.team_b, matchup.odds_b)
                  }
                  className={`${
                    selectedBets.some(
                      (b) => b.matchupId === matchup.id && b.team === matchup.team_b
                    )
                      ? 'bg-green-600 text-black'
                      : 'bg-black text-green-300'
                  } border border-green-600 rounded-full px-6 py-3 text-lg font-bold font-mono hover:bg-green-500 hover:text-black transition`}
                >
                  {matchup.team_b} ({matchup.odds_b})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
