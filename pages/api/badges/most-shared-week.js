import { neon } from '@neondatabase/serverless';
import {
  getBadgeForAchievement,
  ACHIEVEMENT_BADGES,
} from '../../../lib/achievementBadges';

const sql = neon(process.env.DATABASE_URL);

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { expiresAt: 0, payload: null };

async function loadTopShared(limit = 3) {
  const rows = await sql`
    SELECT
      event_data->>'achievementId' AS achievement_id,
      COUNT(*) AS share_count
    FROM user_events
    WHERE event_type = 'badge_share'
      AND created_at >= NOW() - INTERVAL '7 days'
      AND event_data ? 'achievementId'
      AND NULLIF(event_data->>'achievementId', '') IS NOT NULL
    GROUP BY achievement_id
    ORDER BY share_count DESC, achievement_id ASC
    LIMIT ${limit}
  `;

  return rows
    .map((r) => {
      const achievementId = r.achievement_id;
      if (!achievementId) return null;
      const isKnown = Object.prototype.hasOwnProperty.call(
        ACHIEVEMENT_BADGES,
        achievementId,
      );
      if (!isKnown) return null;
      const badge = getBadgeForAchievement(achievementId);
      return {
        achievementId,
        name: badge.name,
        rarity: badge.rarity,
        count: parseInt(r.share_count, 10) || 0,
      };
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    if (!cache.payload || cache.expiresAt <= now) {
      const badges = await loadTopShared(3);
      cache = {
        expiresAt: now + CACHE_TTL_MS,
        payload: { badges, generatedAt: new Date(now).toISOString() },
      };
    }

    res.setHeader(
      'Cache-Control',
      'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    );
    return res.status(200).json(cache.payload);
  } catch (err) {
    console.error('Failed to load most-shared badges:', err);
    return res.status(200).json({ badges: [], generatedAt: null });
  }
}
