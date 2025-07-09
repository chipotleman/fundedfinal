import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
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
        continue;
      }

      // ✅ Payout logic using correct identifier
      if (bet.ID && pnl !== 0) {
        const { data: existingBalance, error: fetchBalanceError } = await supabase
          .from('user_balances')
          .select('balance')
          .eq('ID', bet.ID)
          .single();

        if (fetchBalanceError && fetchBalanceError.code !== 'PGRST116') {
          console.error(`Error fetching balance for ID ${bet.ID}:`, fetchBalanceError.message);
          continue;
        }

        const currentBalance = existingBalance ? parseFloat(existingBalance.balance) : 0;
        const newBalance = currentBalance + pnl;

        const { error: updateBalanceError } = await supabase
          .from('user_balances')
          .upsert({ ID: bet.ID, balance: newBalance }, { onConflict: 'ID' });

        if (updateBalanceError) {
          console.error(`Error updating balance for ID ${bet.ID}:`, updateBalanceError.message);
        } else {
          console.log(`✅ Updated balance for ID ${bet.ID}: $${newBalance.toFixed(2)}`);
        }
      }

      console.log(`✅ Bet ${bet.id} settled. Won: ${won}, PNL: ${pnl}`);
    }

    return NextResponse.json({ message: `Settlement completed for ${matchup_name}.` });
  } catch (err) {
    console.error("Server error in adminSettle:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
