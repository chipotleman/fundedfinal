// app/api/settleBets/route.ts

import { supabase } from '../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const bets = await req.json();

    for (const bet of bets) {
      // Fetch current balance
      const { data: balanceData, error: balanceFetchError } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', bet.user_id) // ✅ fixed from 'user_id' to 'id'
        .single();

      if (balanceFetchError) {
        console.error(`Error fetching balance for user ${bet.user_id}:`, balanceFetchError.message);
        continue;
      }

      const currentBalance = balanceData?.balance ?? 0;
      const updatedBalance = currentBalance + bet.payout;

      // Update user balance
      const { error: balanceUpdateError } = await supabase
        .from('user_balances')
        .update({ balance: updatedBalance })
        .eq('id', bet.user_id); // ✅ fixed

      if (balanceUpdateError) {
        console.error(`Error updating balance for user ${bet.user_id}:`, balanceUpdateError.message);
        continue;
      }

      // Update PnL tracking
      const { data: pnlData, error: pnlFetchError } = await supabase
        .from('user_pnl')
        .select('total_pnl')
        .eq('id', bet.user_id) // ✅ fixed from 'user_id' to 'id'
        .single();

      if (pnlFetchError && pnlFetchError.code !== 'PGRST116') {
        console.error(`Error fetching PnL for user ${bet.user_id}:`, pnlFetchError.message);
        continue;
      }

      const currentPnL = pnlData?.total_pnl ?? 0;
      const updatedPnL = currentPnL + bet.payout;

      if (pnlData) {
        const { error: pnlUpdateError } = await supabase
          .from('user_pnl')
          .update({ total_pnl: updatedPnL })
          .eq('id', bet.user_id); // ✅ fixed

        if (pnlUpdateError) {
          console.error(`Error updating PnL for user ${bet.user_id}:`, pnlUpdateError.message);
          continue;
        }
      } else {
        const { error: pnlInsertError } = await supabase
          .from('user_pnl')
          .insert({
            id: bet.user_id, // ✅ fixed from 'user_id' to 'id'
            total_pnl: bet.payout,
          });

        if (pnlInsertError) {
          console.error(`Error inserting PnL for user ${bet.user_id}:`, pnlInsertError.message);
          continue;
        }
      }

      // Mark bet as settled
      const { error: settleError } = await supabase
        .from('bets')
        .update({ status: 'settled' })
        .eq('id', bet.id);

      if (settleError) {
        console.error(`Error settling bet ${bet.id}:`, settleError.message);
      }
    }

    return new Response(JSON.stringify({ message: 'Bets settled successfully' }), { status: 200 });
  } catch (error) {
    console.error('Error in settleBets route:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
