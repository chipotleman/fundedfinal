import { getScores, SUPPORTED_SPORTS } from '../../../lib/goalserve';

let scoresCache = null;
let scoresCacheTimestamp = null;
// Only fetch sports likely to have live games at current time
// This dramatically reduces API calls and speeds up the endpoint
let liveSportsCache = [];
const SCORES_CACHE_DURATION = 2000;  // 2s cache - good balance of freshness vs speed
const STALE_CACHE_DURATION = 30000;  // Serve stale cache for 30s while fetching fresh

// Determine which sports are likely live based on time of day
function getLikelySports() {
  const now = new Date();
  const hour = now.getUTCHours();
  const sports = [];
  
  // NBA/NCAAB games typically 17:00-05:00 UTC (evening/night US)
  if (hour >= 17 || hour <= 5) {
    sports.push('basketball_nba', 'basketball_ncaab');
  }
  // NHL games similar schedule
  if (hour >= 17 || hour <= 5) {
    sports.push('icehockey_nhl');
  }
  // NFL games primarily on weekends, but check if any live
  sports.push('americanfootball_nfl');
  
  // If we have known live sports from previous fetch, prioritize those
  if (liveSportsCache.length > 0) {
    return [...new Set([...liveSportsCache, ...sports])];
  }
  
  return sports.length > 0 ? sports : ['basketball_nba', 'basketball_ncaab', 'icehockey_nhl'];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  const now = Date.now();
  
  // Serve fresh cache
  if (scoresCache && scoresCacheTimestamp && (now - scoresCacheTimestamp) < SCORES_CACHE_DURATION) {
    return res.status(200).json({
      scores: scoresCache,
      fromCache: true,
      cacheAge: now - scoresCacheTimestamp,
      timestamp: now
    });
  }
  
  // Serve stale cache while fetching (stale-while-revalidate pattern)
  const hasStaleCache = scoresCache && scoresCacheTimestamp && (now - scoresCacheTimestamp) < STALE_CACHE_DURATION;
  
  try {
    const allScores = {};
    // Only fetch sports likely to have live games - not all 6
    const sportsToFetch = getLikelySports();
    
    // Limit to 3 concurrent fetches to prevent overload
    const batchSize = 3;
    for (let i = 0; i < sportsToFetch.length; i += batchSize) {
      const batch = sportsToFetch.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (sportKey) => {
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
    }
    
    // Update live sports cache for next request
    const liveNow = [...new Set(Object.values(allScores).map(s => s.sport))];
    if (liveNow.length > 0) {
      liveSportsCache = liveNow;
    }
    
    scoresCache = allScores;
    scoresCacheTimestamp = now;
    
    return res.status(200).json({
      scores: allScores,
      fromCache: false,
      count: Object.keys(allScores).length,
      sportsChecked: sportsToFetch,
      timestamp: now
    });
  } catch (error) {
    console.error('[Live Scores] Error:', error);
    
    // Return stale cache on error
    if (hasStaleCache) {
      return res.status(200).json({
        scores: scoresCache,
        fromCache: true,
        stale: true,
        cacheAge: now - scoresCacheTimestamp,
        timestamp: now
      });
    }
    
    return res.status(500).json({ error: error.message });
  }
}
