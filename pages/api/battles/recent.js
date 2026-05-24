import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles, battleLikes, battleSpectatorMessages } from '../../../shared/schema';
import { eq, desc, or, inArray, sql, and } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 3), 10);

  try {
    const session = await getServerSession(req, res, authOptions);
    const viewerId = session?.user?.id || null;

    const recent = await db
      .select({
        id: matchups.id,
        user1Id: matchups.user1Id,
        user2Id: matchups.user2Id,
        user1FinalBalance: matchups.user1FinalBalance,
        user2FinalBalance: matchups.user2FinalBalance,
        startingBalance: matchups.startingBalance,
        potSize: matchups.potSize,
        winnerId: matchups.winnerId,
        winnerType: matchups.winnerType,
        isFakeOpponent: matchups.isFakeOpponent,
        endsAt: matchups.endsAt,
        createdAt: matchups.createdAt,
      })
      .from(matchups)
      .where(eq(matchups.status, 'completed'))
      .orderBy(desc(matchups.endsAt))
      .limit(limit * 3);

    const visible = recent.filter(m => !m.isFakeOpponent && m.winnerType !== 'tie' && m.winnerId).slice(0, limit);

    const userIds = [...new Set(visible.flatMap(m => [m.user1Id, m.user2Id]).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const profs = await db
        .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar, equippedFrame: profiles.equippedFrame })
        .from(profiles)
        .where(or(...userIds.map(id => eq(profiles.id, id))));
      profileMap = Object.fromEntries(profs.map(p => [p.id, p]));
    }

    // Batch like-count + commentCount so the result card matches the
    // live-battle card's first-paint social affordances. The viewer's
    // own likedByMe is fetched in a second tiny query (skipped if the
    // viewer is unauthenticated).
    const battleIds = visible.map((m) => m.id);
    const likeCounts = new Map();
    const commentCounts = new Map();
    const likedByMe = new Set();
    if (battleIds.length > 0) {
      try {
        const lc = await db
          .select({ matchupId: battleLikes.matchupId, count: sql`COUNT(*)::int`.as('count') })
          .from(battleLikes)
          .where(inArray(battleLikes.matchupId, battleIds))
          .groupBy(battleLikes.matchupId);
        lc.forEach((r) => likeCounts.set(r.matchupId, Number(r.count) || 0));
      } catch (_e) {}
      try {
        const cc = await db
          .select({ matchupId: battleSpectatorMessages.matchupId, count: sql`COUNT(*)::int`.as('count') })
          .from(battleSpectatorMessages)
          .where(inArray(battleSpectatorMessages.matchupId, battleIds))
          .groupBy(battleSpectatorMessages.matchupId);
        cc.forEach((r) => commentCounts.set(r.matchupId, Number(r.count) || 0));
      } catch (_e) {}
      if (viewerId) {
        try {
          const mine = await db
            .select({ matchupId: battleLikes.matchupId })
            .from(battleLikes)
            .where(and(eq(battleLikes.userId, viewerId), inArray(battleLikes.matchupId, battleIds)));
          mine.forEach((r) => likedByMe.add(r.matchupId));
        } catch (_e) {}
      }
    }

    const battles = visible.map(m => {
      const winner = profileMap[m.winnerId] || null;
      const loserId = m.winnerId === m.user1Id ? m.user2Id : m.user1Id;
      const loser = profileMap[loserId] || null;
      return {
        id: m.id,
        winner: winner ? { id: winner.id, username: winner.username, avatar: winner.avatar, equippedFrame: winner.equippedFrame } : null,
        loser: loser ? { id: loser.id, username: loser.username, avatar: loser.avatar, equippedFrame: loser.equippedFrame } : null,
        potSize: parseFloat(m.potSize) || 0,
        winnerPayout: parseFloat(m.potSize) || 0,
        endedAt: m.endsAt || m.createdAt,
        likeCount: likeCounts.get(m.id) || 0,
        commentCount: commentCounts.get(m.id) || 0,
        likedByMe: likedByMe.has(m.id),
      };
    }).filter(b => b.winner && b.loser);

    // Cache-Control short-circuited because the response is now per-viewer
    // (likedByMe). We still keep it cacheable per-session via private cache.
    if (viewerId) {
      res.setHeader('Cache-Control', 'private, max-age=10');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15');
    }
    return res.status(200).json({ battles });
  } catch (error) {
    console.error('Error fetching recent battles:', error);
    return res.status(500).json({ error: 'Failed to fetch recent battles' });
  }
}
