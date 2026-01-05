import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets, matchupQueue } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const activeMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        or(
          eq(matchups.user1Id, userId),
          eq(matchups.user2Id, userId)
        ),
        inArray(matchups.status, ['waiting', 'matched', 'active'])
      ));

    if (activeMatchups.length === 0) {
      const [queueEntry] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.userId, userId),
          eq(matchupQueue.status, 'waiting')
        ));

      if (queueEntry) {
        return res.status(200).json({
          status: 'queued',
          queueEntry,
          matchup: null,
        });
      }

      return res.status(200).json({
        status: 'none',
        matchup: null,
      });
    }

    const matchup = activeMatchups[0];
    const isUser1 = matchup.user1Id === userId;
    let opponent = null;
    let opponentBets = [];
    const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;

    if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
      const [fake] = await db
        .select()
        .from(fakeOpponents)
        .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
      
      if (fake) {
        opponent = {
          id: fake.id,
          username: fake.displayName,
          avatar: fake.avatar,
          winRate: fake.winRate,
          totalBattles: fake.totalBattles,
          bio: fake.bio,
          isReal: false,
        };
      }

      const fakeBets = await db
        .select()
        .from(fakeOpponentBets)
        .where(eq(fakeOpponentBets.matchupId, matchup.id));
      
      opponentBets = fakeBets;
    } else if (opponentId) {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, opponentId));

      opponent = {
        id: opponentId,
        username: profile?.username || 'Opponent',
        winRate: profile?.winRate,
        isReal: true,
      };

      const realOpponentBets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, opponentId));
      
      opponentBets = realOpponentBets;
    }

    const myBets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.userId, userId));

    const hasPlacedBets = myBets.length > 0;
    const canSeeOpponentBets = hasPlacedBets;

    const myBalance = isUser1 
      ? parseFloat(matchup.user1Balance || matchup.startingBalance)
      : parseFloat(matchup.user2Balance || matchup.startingBalance);

    const opponentBalance = isUser1
      ? parseFloat(matchup.user2Balance || matchup.startingBalance)
      : parseFloat(matchup.user1Balance || matchup.startingBalance);

    const timeRemaining = matchup.endsAt 
      ? Math.max(0, new Date(matchup.endsAt).getTime() - Date.now())
      : null;

    return res.status(200).json({
      status: matchup.status,
      matchup,
      opponent,
      myBets,
      opponentBets: canSeeOpponentBets ? opponentBets : [],
      canSeeOpponentBets,
      isUser1,
      myBalance,
      opponentBalance,
      timeRemaining,
      endsAt: matchup.endsAt,
      startsAt: matchup.startsAt,
    });

  } catch (error) {
    console.error('Get current matchup error:', error);
    return res.status(500).json({ error: 'Failed to get current matchup' });
  }
}
