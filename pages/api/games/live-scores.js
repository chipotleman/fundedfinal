import { getScores, SUPPORTED_SPORTS } from '../../../lib/goalserve';

let scoresCache = null;
let scoresCacheTimestamp = null;
const SCORES_CACHE_DURATION = 500; // 500ms cache for subsecond latency

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  const now = Date.now();
  
  // Return cached scores if fresh (500ms)
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
    
    // REST API for live scores
    const sportKeys = Object.keys(SUPPORTED_SPORTS);
    
    await Promise.all(
      sportKeys.map(async (sportKey) => {
        try {
          const scores = await getScores(sportKey);
          if (scores && scores.length > 0) {
            scores.forEach(game => {
              if (game.isLive) {
                const gameId = `${sportKey}_${game.id}`;
                allScores[gameId] = {
                  id: gameId,
                  sport: sportKey,
                  homeTeam: game.home_team,
                  awayTeam: game.away_team,
                  homeScore: game.scores?.home?.total || 0,
                  awayScore: game.scores?.away?.total || 0,
                  period: game.period,
                  clock: game.clock,
                  isLive: true,
                  status: game.status,
                  source: 'rest',
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
    
    scoresCache = allScores;
    scoresCacheTimestamp = now;
    
    return res.status(200).json({
      scores: allScores,
      fromCache: false,
      count: Object.keys(allScores).length,
      source: 'rest',
      timestamp: now
    });
  } catch (error) {
    console.error('[Live Scores] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
