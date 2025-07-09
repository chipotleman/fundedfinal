import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  // Mock completed games for testing
  const completedGames = [
    {
      matchup_name: "Knicks vs Lakers",
      market_type: "NBA Moneyline",
      winner: "Knicks",
      status: "completed"
    },
    {
      matchup_name: "Celtics vs Heat",
      market_type: "NBA Moneyline",
      winner: "Heat",
      status: "completed"
    }
  ];

  for (const game of completedGames) {
    const { matchup_name, market_type, winner } = game;

    const { data: bets, error } = await supabase
      .from('user_bets')
      .select('*')
      .eq('status', 'open')
      .eq('market_type', market_type)
      .eq('matchup_name', matchup_name);

    if (error) {
      console.error(`Error fetching bets for ${matchup_name}:`, error.message);
      continue;
    }

    for (const bet of bets) {
      const won = bet.selection === winner;
      const pnl = won ? bet.stake * (bet.odds - 1) : -bet.stake;

      const { error: updateError } = await supabase
        .from('user_bets')
        .update({
          status: 'settled',
          pnl,
          settled_at: new Date().toISOString()
        })
        .eq('id', bet.id);

      if (updateError) {
        console.error(`Error settling bet ${bet.id}:`, updateError.message);
      } else {
        console.log(`Bet ${bet.id} settled. Won: ${won}, PNL: ${pnl}`);
      }
    }
  }

  return NextResponse.json({ message: "Mock auto-settlement completed." });
}
