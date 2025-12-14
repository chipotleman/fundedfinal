import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  if (action === 'add') {
    const {
      userId,
      visitorId,
      sessionId,
      matchupName,
      marketType,
      selection,
      odds,
    } = req.body;

    try {
      const [result] = await sql`
        INSERT INTO unplaced_bets (user_id, visitor_id, session_id, matchup_name, market_type, selection, odds)
        VALUES (${userId || null}, ${visitorId || null}, ${sessionId || null}, ${matchupName || null}, ${marketType || null}, ${selection || null}, ${odds || null})
        RETURNING id
      `;

      return res.status(200).json({ success: true, id: result.id });
    } catch (error) {
      console.error('Failed to track unplaced bet:', error);
      return res.status(500).json({ error: 'Failed to track unplaced bet' });
    }
  }

  if (action === 'remove') {
    const { id } = req.body;

    try {
      await sql`
        UPDATE unplaced_bets
        SET removed_at = NOW()
        WHERE id = ${id}
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update unplaced bet:', error);
      return res.status(500).json({ error: 'Failed to update unplaced bet' });
    }
  }

  if (action === 'placed') {
    const { id } = req.body;

    try {
      await sql`
        UPDATE unplaced_bets
        SET was_placed = true, removed_at = NOW()
        WHERE id = ${id}
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update unplaced bet:', error);
      return res.status(500).json({ error: 'Failed to update unplaced bet' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
