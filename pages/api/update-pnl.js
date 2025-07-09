import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, pnl } = req.body;

  if (!id || pnl === undefined) {
    return res.status(400).json({ error: 'Missing id or pnl' });
  }

  // Determine new status
  let newStatus = 'open';
  if (pnl >= 20) {
    newStatus = 'paid';
  } else if (pnl <= -10) {
    newStatus = 'failed';
  }

  const { data, error } = await supabase
    .from('user_bets')
    .update({ pnl, status: newStatus })
    .eq('id', id)
    .select();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update PnL' });
  }

  res.status(200).json({ success: true, data });
}
