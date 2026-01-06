import { db } from '../../../../lib/db';
import { matchups, profiles, fakeOpponents } from '../../../../shared/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status = 'active' } = req.query;

    let statusFilter;
    if (status === 'all') {
      statusFilter = inArray(matchups.status, ['active', 'pending', 'completed']);
    } else if (status === 'open') {
      statusFilter = inArray(matchups.status, ['active', 'pending']);
    } else {
      statusFilter = eq(matchups.status, status);
    }

    const allMatchups = await db
      .select()
      .from(matchups)
      .where(statusFilter)
      .orderBy(desc(matchups.createdAt));

    const allFakeOpponents = await db.select().from(fakeOpponents);
    const fakeOpponentMap = {};
    allFakeOpponents.forEach(fo => {
      if (fo.userId) {
        fakeOpponentMap[fo.userId] = fo;
      }
    });

    const enrichedMatchups = await Promise.all(
      allMatchups.map(async (matchup) => {
        let user1Profile = null;
        let user2Profile = null;
        let user1FakeOpponent = null;
        let user2FakeOpponent = null;

        if (matchup.user1Id) {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, matchup.user1Id));
          user1Profile = profile;
          user1FakeOpponent = fakeOpponentMap[matchup.user1Id] || null;
        }

        if (matchup.user2Id) {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, matchup.user2Id));
          user2Profile = profile;
          user2FakeOpponent = fakeOpponentMap[matchup.user2Id] || null;
        }

        let fakeOpponentInBattle = null;
        if (matchup.fakeOpponentId) {
          const [fo] = await db
            .select()
            .from(fakeOpponents)
            .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
          fakeOpponentInBattle = fo;
        }

        const hasFakeOpponent = !!matchup.fakeOpponentId || !!user1FakeOpponent || !!user2FakeOpponent;
        const fakeOpponentData = fakeOpponentInBattle || user1FakeOpponent || user2FakeOpponent;

        return {
          ...matchup,
          user1: user1Profile ? {
            id: user1Profile.id,
            username: user1Profile.username,
            avatar: user1Profile.avatar,
            isFake: !!user1FakeOpponent,
          } : null,
          user2: user2Profile ? {
            id: user2Profile.id,
            username: user2Profile.username,
            avatar: user2Profile.avatar,
            isFake: !!user2FakeOpponent,
          } : null,
          hasFakeOpponent,
          fakeOpponent: fakeOpponentData ? {
            id: fakeOpponentData.id,
            username: fakeOpponentData.username,
            displayName: fakeOpponentData.displayName,
            avatar: fakeOpponentData.avatar,
            userId: fakeOpponentData.userId,
            hasCredentials: !!fakeOpponentData.userId,
          } : null,
        };
      })
    );

    return res.status(200).json(enrichedMatchups);
  } catch (error) {
    console.error('Fetch battles error:', error);
    return res.status(500).json({ error: 'Failed to fetch battles' });
  }
}
