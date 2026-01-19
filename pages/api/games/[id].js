import { getScheduledGamesForSSR } from '../../../lib/schedule-cache';
import { getInplayService } from '../../../lib/goalserve-inplay';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Game ID required' });
  }

  try {
    // Strip inplay_ prefix if present for matching
    const isInplayId = String(id).startsWith('inplay_');
    const strippedId = isInplayId ? String(id).replace(/^inplay_/, '') : String(id);
    const normalizedId = strippedId.toLowerCase();
    
    // First check scheduled games cache
    const scheduledGames = getScheduledGamesForSSR();
    let game = scheduledGames.find(g => 
      String(g.id) === String(id) || 
      String(g.gameId) === String(id) ||
      String(g.id) === strippedId ||
      String(g.gameId) === strippedId
    );
    
    if (game) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ game });
    }
    
    // Also check inplay cache for live games
    const inplayService = getInplayService();
    const inplayEvents = inplayService.getEvents();
    
    // Match by exact ID, stripped ID, or case-insensitive comparison
    game = inplayEvents.find(g => {
      const eventId = String(g.id || '');
      const gameId = String(g.gameId || '');
      return eventId === String(id) || 
             eventId === strippedId ||
             eventId.toLowerCase() === normalizedId ||
             gameId === String(id) ||
             gameId === strippedId ||
             gameId.toLowerCase() === normalizedId;
    });
    
    if (game) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ game, source: 'inplay' });
    }
    
    // Fallback: try to match by team names extracted from slug ID
    // Slug format: sport_team1_name_vs_team2_name
    if (isInplayId && strippedId.includes('_vs_')) {
      const vsIndex = strippedId.indexOf('_vs_');
      const beforeVs = strippedId.substring(0, vsIndex);
      const afterVs = strippedId.substring(vsIndex + 4);
      
      // Extract team names (remove sport prefix)
      const sportPrefixes = ['basketball_', 'hockey_', 'amfootball_', 'baseball_', 'soccer_'];
      let team1Part = beforeVs;
      for (const prefix of sportPrefixes) {
        if (team1Part.startsWith(prefix)) {
          team1Part = team1Part.substring(prefix.length);
          break;
        }
      }
      
      // Normalize: convert underscores to spaces, lowercase
      const normalizeTeam = (name) => name.replace(/_/g, ' ').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const team1Normalized = normalizeTeam(team1Part);
      const team2Normalized = normalizeTeam(afterVs);
      
      game = inplayEvents.find(g => {
        const home = normalizeTeam(g.homeTeam || g.homeTeamFull || '');
        const away = normalizeTeam(g.awayTeam || g.awayTeamFull || '');
        return (home.includes(team1Normalized) || team1Normalized.includes(home) ||
                home.includes(team2Normalized) || team2Normalized.includes(home)) &&
               (away.includes(team1Normalized) || team1Normalized.includes(away) ||
                away.includes(team2Normalized) || team2Normalized.includes(away));
      });
      
      if (game) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).json({ game, source: 'inplay', matchedBy: 'teamNames' });
      }
    }
    
    return res.status(404).json({ error: 'Game not found', id, strippedId, inplayEventCount: inplayEvents.length });
  } catch (error) {
    console.error('[Game API] Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch game' });
  }
}
