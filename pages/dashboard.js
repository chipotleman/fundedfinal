import { useEffect } from 'react';
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

    fetchUserBalance();
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

  const sampleMatchups = [
    {
      id: 'matchup-1',
      teamA: 'Yankees',
      teamB: 'Red Sox',
      oddsA: '+120',
      oddsB: '-140',
    },
    {
      id: 'matchup-2',
      teamA: 'Dodgers',
      teamB: 'Giants',
      oddsA: '-110',
      oddsB: '+105',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 sm:px-8">
      <h1 className="text-3xl font-bold text-green-400 mb-6 font-mono">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleMatchups.map((matchup) => (
          <div
            key={matchup.id}
            className="bg-zinc-900 border border-green-700 rounded-xl p-4 shadow-lg"
          >
            <div className="text-green-300 font-mono text-sm mb-2">
              {matchup.teamA} vs {matchup.teamB}
            </div>
            <div className="flex flex-col gap-4">
              <button
                onClick={() =>
                  handleSelectBet(matchup.id, matchup.teamA, matchup.oddsA)
                }
                className={`${
                  selectedBets.some(
                    (b) => b.matchupId === matchup.id && b.team === matchup.teamA
                  )
                    ? 'bg-green-600 text-black'
                    : 'bg-black text-green-300'
                } border border-green-600 rounded-full px-6 py-3 text-lg font-bold font-mono hover:bg-green-500 hover:text-black transition`}
              >
                {matchup.teamA} ({matchup.oddsA})
              </button>
              <button
                onClick={() =>
                  handleSelectBet(matchup.id, matchup.teamB, matchup.oddsB)
                }
                className={`${
                  selectedBets.some(
                    (b) => b.matchupId === matchup.id && b.team === matchup.teamB
                  )
                    ? 'bg-green-600 text-black'
                    : 'bg-black text-green-300'
                } border border-green-600 rounded-full px-6 py-3 text-lg font-bold font-mono hover:bg-green-500 hover:text-black transition`}
              >
                {matchup.teamB} ({matchup.oddsB})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
