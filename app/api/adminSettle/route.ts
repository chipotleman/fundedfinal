import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { matchup_name, market_type, winner } = await req.json();

  if (!matchup_name || !market_type || !winner) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { data: bets, error } = await supabase
    .from('user_bets')
    .select('*')
    .eq('status', 'open')
    .eq('market_type', market_type)
    .eq('matchup_name', matchup_name);

  if (error) {
    console.error(`Error fetching bets for ${matchup_name}:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({ message: `Settlement completed for ${matchup_name}.` });
}
