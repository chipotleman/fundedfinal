import { db } from '../../../lib/db';
import { matchups, profiles } from '../../../shared/schema';
import { eq, desc, or } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 3), 10);

  try {
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
        .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
        .from(profiles)
        .where(or(...userIds.map(id => eq(profiles.id, id))));
      profileMap = Object.fromEntries(profs.map(p => [p.id, p]));
    }

    const battles = visible.map(m => {
      const winner = profileMap[m.winnerId] || null;
      const loserId = m.winnerId === m.user1Id ? m.user2Id : m.user1Id;
      const loser = profileMap[loserId] || null;
      return {
        id: m.id,
        winner: winner ? { id: winner.id, username: winner.username, avatar: winner.avatar } : null,
        loser: loser ? { id: loser.id, username: loser.username, avatar: loser.avatar } : null,
        potSize: parseFloat(m.potSize) || 0,
        winnerPayout: parseFloat(m.potSize) || 0,
        endedAt: m.endsAt || m.createdAt,
      };
    }).filter(b => b.winner && b.loser);

    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15');
    return res.status(200).json({ battles });
  } catch (error) {
    console.error('Error fetching recent battles:', error);
    return res.status(500).json({ error: 'Failed to fetch recent battles' });
  }
}
