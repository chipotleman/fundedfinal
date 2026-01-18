import { getScheduledGamesForSSR } from '../../../lib/schedule-cache';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Game ID required' });
  }

  try {
    const games = getScheduledGamesForSSR();
    const game = games.find(g => String(g.id) === String(id) || String(g.gameId) === String(id));
    
    if (game) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ game });
    }
    
    return res.status(404).json({ error: 'Game not found', id });
  } catch (error) {
    console.error('[Game API] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch game' });
  }
}
