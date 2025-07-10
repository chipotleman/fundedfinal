// app/api/settleBets/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const betsToSettle = await req.json();

    for (const bet of betsToSettle) {
      // Fetch game result
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('winner, odds')
        .eq('id', bet.game_id)
        .single();

      if (gameError || !game) {
        console.error(`Error fetching game data:`, gameError?.message);
        continue;
      }

      // Determine win/loss
      const won = bet.pick === game.winner;
      const payout = won ? bet.amount * bet.odds : 0;
      const pnl = payout - bet.amount;

      // Update bet status
      const { error: betUpdateError } = await supabase
        .from('bets')
        .update({ status: won ? 'won' : 'lost', payout })
        .eq('id', bet.id);

      if (betUpdateError) {
        console.error(`Error updating bet:`, betUpdateError.message);
        continue;
      }

      // Update bankroll
      const { data: bankrollData, error: bankrollFetchError } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('id', bet.user_id)
        .single();

      if (bankrollFetchError) {
        console.error(`Error fetching balance:`, bankrollFetchError.message);
        continue;
      }

      const newBalance = Number(bankrollData.balance) + payout;
      const { error: bankrollUpdateError } = await supabase
        .from('user_balances')
        .update({ balance: newBalance })
        .eq('id', bet.user_id);

      if (bankrollUpdateError) {
        console.error(`Error updating balance:`, bankrollUpdateError.message);
        continue;
      }

      // Update PnL
      const { data: pnlData, error: pnlFetchError } = await supabase
        .from('user_pnl')
        .select('total_pnl')
        .eq('id', bet.user_id)
        .single();

      const currentPnL = pnlData?.total_pnl || 0;
      const newPnL = Number(currentPnL) + pnl;

      if (pnlFetchError) {
        console.error(`Error fetching PnL:`, pnlFetchError.message);
        continue;
      }

      const { error: pnlUpdateError } = await supabase
        .from('user_pnl')
        .upsert({ id: bet.user_id, total_pnl: newPnL });

      if (pnlUpdateError) {
        console.error(`Error updating PnL:`, pnlUpdateError.message);
        continue;
      }

      // Check for payout eligibility
      const challengeTarget = 1000; // Change as needed
      if (newPnL >= challengeTarget) {
        const { error: payoutStatusError } = await supabase
          .from('evaluations')
          .update({ payout_status: 'approved', status: 'eligible_for_payout' })
          .eq('email', bet.user_email);

        if (payoutStatusError) {
          console.error(`Error updating payout eligibility:`, payoutStatusError.message);
        }
      }
    }

    return NextResponse.json({ message: 'Bets settled and PnL updated.' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
