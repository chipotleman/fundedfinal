import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { selection, stake, odds, market_id } = await req.json();

  if (!selection || !stake || !odds || !market_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Insert into user_bets
  const { error } = await supabase.from('user_bets').insert({
    selection,
    stake,
    odds,
    market_id,
    status: 'open',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bet placed successfully' });
}
