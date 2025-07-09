import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { selection, stake, odds, market_type, matchup_name } = await req.json();

  if (!selection || !stake || !odds || !market_type || !matchup_name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { error } = await supabase.from('user_bets').insert({
  selection,
  stake,
  odds,
  market_type,
  matchup_name,
  status: 'open',
  teams, // add this line
});


  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bet placed successfully' });
}
