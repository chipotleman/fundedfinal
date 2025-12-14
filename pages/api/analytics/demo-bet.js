import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    visitorId,
    sessionId,
    matchupName,
    marketType,
    selection,
    odds,
    stake,
    potentialPayout,
    result,
  } = req.body;

  try {
    await sql`
      INSERT INTO demo_bets (user_id, visitor_id, session_id, matchup_name, market_type, selection, odds, stake, potential_payout, result)
      VALUES (${userId || null}, ${visitorId || null}, ${sessionId || null}, ${matchupName || null}, ${marketType || null}, ${selection || null}, ${odds || null}, ${stake || null}, ${potentialPayout || null}, ${result || null})
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to track demo bet:', error);
    return res.status(500).json({ error: 'Failed to track demo bet' });
  }
}
