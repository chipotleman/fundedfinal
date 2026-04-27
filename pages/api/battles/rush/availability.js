// Lightweight check used by the Quick Match / pre-match popup to decide
// whether Rush mode can be selected. Per product: Rush requires a live
// game (the 6 prop questions are pulled from a live game's odds), so
// when no live games are available the mode is disabled in the chooser.
//
// We deliberately reuse `getLiveGames()` from the existing Goalserve
// helper so this endpoint stays consistent with the live-games data
// the rest of the app (and the future Rush backend) reads from. The
// helper is already cached behind `getScores`, so calling this on
// popup-open is cheap.
const { getLiveGames } = require('../../../../lib/goalserve');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Short client-cache so rapid popup re-opens don't hammer the API.
  // 30s is short enough that "a game just kicked off" appears quickly
  // without making every popup open block on a fresh fetch.
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

  try {
    const liveGames = await getLiveGames();
    const count = Array.isArray(liveGames) ? liveGames.length : 0;
    return res.status(200).json({
      available: count > 0,
      liveGameCount: count,
      // Suggested client refresh cadence; the popup uses this to
      // re-poll if the user lingers on the mode step without picking.
      refreshAfterMs: 60_000,
    });
  } catch (err) {
    // Fail open: if Goalserve is hiccuping we'd rather let the user
    // try to start Rush (and surface a clean error inside the match
    // start flow) than silently lock them out of the mode entirely.
    console.error('[rush/availability] error:', err?.message || err);
    return res.status(200).json({
      available: true,
      liveGameCount: null,
      refreshAfterMs: 60_000,
      degraded: true,
    });
  }
}
