// app/api/settleBets/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { matchup_name, winner } = await req.json();

    if (!matchup_name || !winner) {
      return NextResponse.json({ error: 'Missing matchup_name or winner' }, { status: 400 });
    }

    const { data: openBets, error } = await supabase
      .from('user_bets')
      .select('*')
      .eq('matchup_name', matchup_name)
      .eq('status', 'open');

    if (error) {
      console.error('Error fetching open bets:', error.message);
      return NextResponse.json({ error: 'Error fetching open bets' }, { status: 500 });
    }

    for (const bet of openBets) {
      const won = bet.selection === winner;
      const pnl = won ? bet.stake * (parseInt(bet.odds.replace('+', '')) / 100) : -bet.stake;
      const status = 'settled';

      const { error: updateError } = await supabase
        .from('user_bets')
        .update({ status, pnl, settled_at: new Date().toISOString() })
        .eq('id', bet.id);

      if (updateError) {
        console.error(`Error updating bet ${bet.id}:`, updateError.message);
        continue;
      }

      const { data: userBalanceData, error: balanceFetchError } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', bet.user_id)
        .single();

      if (balanceFetchError) {
        console.error(`Error fetching balance for user ${bet.user_id}:`, balanceFetchError.message);
        continue;
      }

      const newBalance = (userBalanceData?.balance || 0) + pnl;

      const { error: balanceUpdateError } = await supabase
        .from('user_balances')
        .update({ balance: newBalance })
        .eq('id', bet.user_id);

      if (balanceUpdateError) {
        console.error(`Error updating balance for user ${bet.user_id}:`, balanceUpdateError.message);
      }
    }

    return NextResponse.json({ message: 'Bets settled successfully' });
  } catch (error: any) {
    console.error('❌ Settle error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
