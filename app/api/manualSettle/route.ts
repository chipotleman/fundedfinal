import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ensure you use service role for write access
);

export async function POST(req: Request) {
  const { bet_id } = await req.json();

  if (!bet_id) {
    return NextResponse.json({ error: 'bet_id is required' }, { status: 400 });
  }

  // Fetch the bet
  const { data: bet, error } = await supabase
    .from('bets')
    .select('*')
    .eq('id', bet_id)
    .single();

  if (error || !bet) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  }

  if (bet.status === 'settled') {
    return NextResponse.json({ message: 'Bet already settled' });
  }

  // PnL calculation example
  const odds = bet.odds; // e.g., 2.5
  const stake = bet.stake ?? 10; // default stake
  const pnl = stake * (odds - 1); // e.g., 10 * (2.5 - 1) = 15 profit

  // Update the bet to settled
  const { error: updateError } = await supabase
    .from('bets')
    .update({
      status: 'settled',
      pnl: pnl,
      settled_at: new Date().toISOString(),
    })
    .eq('id', bet_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Bet settled successfully',
    bet_id,
    pnl,
  });
}
