import { db } from '../../../../lib/db';
import { matchups, fakeOpponents, profiles, users } from '../../../../shared/schema';
import { eq, desc, or } from 'drizzle-orm';
import { requireAdmin } from '../../../../lib/adminAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allMatchups = await db
        .select()
        .from(matchups)
        .orderBy(desc(matchups.createdAt))
        .limit(100);

      const enrichedMatchups = await Promise.all(allMatchups.map(async (m) => {
        let user1Info = null;
        let user2Info = null;

        const [profile1] = await db.select().from(profiles).where(eq(profiles.id, m.user1Id));
        const [user1] = await db.select().from(users).where(eq(users.id, m.user1Id));
        user1Info = {
          id: m.user1Id,
          username: profile1?.username || user1?.email?.split('@')[0] || 'User',
          email: user1?.email,
        };

        if (m.isFakeOpponent && m.fakeOpponentId) {
          const [fake] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, m.fakeOpponentId));
          user2Info = {
            id: m.fakeOpponentId,
            username: fake?.displayName || 'Opponent',
            isFake: true,
          };
        } else if (m.user2Id) {
          const [profile2] = await db.select().from(profiles).where(eq(profiles.id, m.user2Id));
          const [user2] = await db.select().from(users).where(eq(users.id, m.user2Id));
          user2Info = {
            id: m.user2Id,
            username: profile2?.username || user2?.email?.split('@')[0] || 'User',
            email: user2?.email,
            isFake: false,
          };
        }

        return {
          ...m,
          user1Info,
          user2Info,
        };
      }));

      return res.status(200).json(enrichedMatchups);
    } catch (error) {
      console.error('Get matchups error:', error);
      return res.status(500).json({ error: 'Failed to fetch matchups' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, status, winnerId, winnerType } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Matchup ID required' });
      }

      const updateData = { updatedAt: new Date() };
      if (status !== undefined) updateData.status = status;
      if (winnerId !== undefined) updateData.winnerId = winnerId;
      if (winnerType !== undefined) updateData.winnerType = winnerType;

      const [updated] = await db
        .update(matchups)
        .set(updateData)
        .where(eq(matchups.id, id))
        .returning();

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update matchup error:', error);
      return res.status(500).json({ error: 'Failed to update matchup' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
