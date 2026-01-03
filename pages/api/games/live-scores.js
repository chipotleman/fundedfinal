import { getScores, SUPPORTED_SPORTS } from '../../../lib/goalserve';

let scoresCache = null;
let scoresCacheTimestamp = null;
let liveSportsCache = ['basketball_nba', 'basketball_ncaab', 'icehockey_nhl'];
const SCORES_CACHE_DURATION = 800;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  const now = Date.now();
  
  if (scoresCache && scoresCacheTimestamp && (now - scoresCacheTimestamp) < SCORES_CACHE_DURATION) {
    return res.status(200).json({
      scores: scoresCache,
      fromCache: true,
      cacheAge: now - scoresCacheTimestamp,
      timestamp: now
    });
  }
  
  try {
    const allScores = {};
    const sportsToFetch = liveSportsCache.length > 0 ? liveSportsCache : Object.keys(SUPPORTED_SPORTS);
    
    await Promise.all(
      sportsToFetch.map(async (sportKey) => {
        try {
          const scores = await getScores(sportKey);
          if (scores && scores.length > 0) {
            scores.forEach(game => {
              if (game.isLive) {
                const gameId = `${sportKey}_${game.id}`;
                allScores[gameId] = {
                  id: gameId,
                  originalId: game.id,
                  sport: sportKey,
                  homeTeam: game.home_team,
                  awayTeam: game.away_team,
                  homeScore: game.scores?.home?.total || 0,
                  awayScore: game.scores?.away?.total || 0,
                  period: game.period,
                  clock: game.clock,
                  isLive: true,
                  status: game.status,
                  timestamp: now
                };
              }
            });
          }
        } catch (err) {
          console.error(`[Live Scores] Error fetching ${sportKey}:`, err.message);
        }
      })
    );
    
    const liveNow = Object.values(allScores).map(s => s.sport);
    if (liveNow.length > 0) {
      liveSportsCache = [...new Set(liveNow)];
    }
    
    scoresCache = allScores;
    scoresCacheTimestamp = now;
    
    return res.status(200).json({
      scores: allScores,
      fromCache: false,
      count: Object.keys(allScores).length,
      timestamp: now
    });
  } catch (error) {
    console.error('[Live Scores] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
