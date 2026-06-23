import { generateSimulatedGames, getSimulatedGameById } from '../../../../lib/simulated-games';

// Resolve a single game by id. The homepage feed (`/api/games`) only returns a
// trimmed window of live/soon/recent games, so a game linked from My Piks that
// has ended (or aged out) falls out of that list. This endpoint resolves it
// directly so the game page can still render a summary instead of "not found":
//   - Simulated games (`sim-*`) are reconstructed deterministically by id,
//     including their final score, even when long over.
//   - Real games are matched against the current simulated set as a
//     best-effort (real Goalserve ids aren't reconstructable once aged out).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing game id', game: null });
  }

  try {
    if (id.startsWith('sim-')) {
      const game = getSimulatedGameById(id);
      if (game) {
        return res.status(200).json({ game });
      }
    }

    const found = generateSimulatedGames().find(g => String(g.id) === String(id));
    return res.status(200).json({ game: found || null });
  } catch (error) {
    console.error('Error resolving game by id:', error);
    return res.status(200).json({ game: null });
  }
}
