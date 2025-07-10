import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { betId, didWin } = await req.json();

    const { data: bet, error: fetchError } = await supabase
      .from('bets')
      .select('*')
      .eq('id', betId)
      .single();

    if (fetchError || !bet) {
      return NextResponse.json({ message: 'Bet not found.' }, { status: 404 });
    }

    const payout = didWin ? bet.amount * bet.odds : 0;
    const pnl = payout - bet.amount;

    // Update bet status and payout
    const { error: betUpdateError } = await supabase
      .from('bets')
      .update({ status: didWin ? 'won' : 'lost', payout })
      .eq('id', betId);

    if (betUpdateError) {
      return NextResponse.json({ message: 'Error updating bet.' }, { status: 500 });
    }

    // Update bankroll
    const { data: bankrollData, error: bankrollFetchError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('id', bet.user_id)
      .single();

    const newBalance = Number(bankrollData?.balance || 0) + payout;

    const { error: bankrollUpdateError } = await supabase
      .from('user_balances')
      .update({ balance: newBalance })
      .eq('id', bet.user_id);

    if (bankrollUpdateError) {
      return NextResponse.json({ message: 'Error updating bankroll.' }, { status: 500 });
    }

    // Update PnL
    const { data: pnlData, error: pnlFetchError } = await supabase
      .from('user_pnl')
      .select('total_pnl')
      .eq('id', bet.user_id)
      .single();

    const newPnL = Number(pnlData?.total_pnl || 0) + pnl;

    const { error: pnlUpdateError } = await supabase
      .from('user_pnl')
      .upsert({ id: bet.user_id, total_pnl: newPnL });

    if (pnlUpdateError) {
      return NextResponse.json({ message: 'Error updating PnL.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bet settled successfully.' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
