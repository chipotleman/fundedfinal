import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets, matchupQueue } from '../../../shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';

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
    // Check if this user is a fake opponent (has a fake_opponents entry with this userId)
    const [fakeOpponentEntry] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.userId, userId));

    // Build the search conditions - include fake opponent ID if this is a fake account
    const userIdConditions = [
      eq(matchups.user1Id, userId),
      eq(matchups.user2Id, userId)
    ];
    
    // If this is a fake opponent, also search by their fake opponent ID
    if (fakeOpponentEntry) {
      userIdConditions.push(eq(matchups.user2Id, fakeOpponentEntry.id));
      userIdConditions.push(eq(matchups.fakeOpponentId, fakeOpponentEntry.id));
    }

    // Prioritize active battles, then matched, then waiting
    const activeMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        or(...userIdConditions),
        inArray(matchups.status, ['waiting', 'matched', 'active'])
      ))
      .orderBy(
        // Custom order: active > matched > waiting
        sql`CASE 
          WHEN status = 'active' THEN 1 
          WHEN status = 'matched' THEN 2 
          WHEN status = 'waiting' THEN 3 
          ELSE 4 
        END`
      );

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
    
    // Determine if current user is user1 or user2
    // For fake opponents, they're user2 if their fakeOpponentId matches
    const isFakeOpponentUser = fakeOpponentEntry && 
      (matchup.fakeOpponentId === fakeOpponentEntry.id || matchup.user2Id === fakeOpponentEntry.id);
    const isUser1 = !isFakeOpponentUser && matchup.user1Id === userId;
    
    let opponent = null;
    let opponentBets = [];
    let myBets = [];

    if (isFakeOpponentUser) {
      console.log('[Matchups Current] User is fake opponent, fakeOpponentId:', fakeOpponentEntry.id);
      // Current user is the fake opponent - get user1 as the opponent
      const opponentId = matchup.user1Id;
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, opponentId));

      opponent = {
        id: opponentId,
        username: profile?.username || 'Opponent',
        avatar: profile?.avatar,
        winRate: profile?.winRate,
        isReal: true,
      };

      // Get opponent's bets (user1's bets)
      const realOpponentBets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, opponentId));
      opponentBets = realOpponentBets;
      console.log('[Matchups Current] Opponent bets count:', realOpponentBets.length);

      // Get my bets (fake opponent's bets)
      const fakeBets = await db
        .select()
        .from(fakeOpponentBets)
        .where(eq(fakeOpponentBets.matchupId, matchup.id));
      myBets = fakeBets;
      console.log('[Matchups Current] My fake bets count:', fakeBets.length, 'for matchup:', matchup.id);
    } else if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
      // Current user is user1, opponent is fake
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

      // Get my bets (user1's bets)
      myBets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, userId));
    } else {
      // Real user vs real user
      const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;
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

      // Get my bets
      myBets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, userId));
    }

    const hasPlacedBets = myBets.length > 0;
    const canSeeOpponentBets = hasPlacedBets;
    console.log('[Matchups Current] hasPlacedBets:', hasPlacedBets, 'canSeeOpponentBets:', canSeeOpponentBets, 'myBets count:', myBets.length);

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
