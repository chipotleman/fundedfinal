import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { bet_id } = await req.json();

  if (!bet_id) {
    return NextResponse.json({ error: 'bet_id is required' }, { status: 400 });
  }

  // ✅ Corrected: Fetch from user_bets
  const { data: bet, error } = await supabase
    .from('user_bets')
    .select('*')
    .eq('id', bet_id)
    .single();

  if (error || !bet) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  }

  if (bet.status === 'settled') {
    return NextResponse.json({ message: 'Bet already settled' });
  }

  const odds = bet.odds;
  const stake = bet.stake ?? 10;
  const pnl = stake * (odds - 1);

  const { error: updateError } = await supabase
    .from('user_bets')
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
