import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets } from '../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Matchup ID required' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(eq(matchups.id, id));

      if (!matchup) {
        return res.status(404).json({ error: 'Matchup not found' });
      }

      const isUser1 = matchup.user1Id === userId;
      const isUser2 = matchup.user2Id === userId;

      if (!isUser1 && !isUser2) {
        return res.status(403).json({ error: 'Not a participant in this matchup' });
      }

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
            isReal: false,
          };
        }

        const fakeBets = await db
          .select()
          .from(fakeOpponentBets)
          .where(eq(fakeOpponentBets.matchupId, id));
        
        opponentBets = fakeBets;
      } else if (opponentId) {
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, opponentId));

        opponent = {
          id: opponentId,
          username: profile?.username || 'Opponent',
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

      // Cash P&L computation. potSize / winnerPayout are stored in real cash;
      // startingBalance is the play-money score (e.g. $10,000 coins).
      const potSize = parseFloat(matchup.potSize || 0);
      const winnerPayout = parseFloat(matchup.winnerPayout || 0);
      const cashBuyIn = potSize / 2;
      const startingBal = parseFloat(matchup.startingBalance || 0);
      const myFinal = parseFloat(
        (isUser1 ? matchup.user1FinalBalance : matchup.user2FinalBalance) ?? startingBal
      );
      const opponentFinal = parseFloat(
        (isUser1 ? matchup.user2FinalBalance : matchup.user1FinalBalance) ?? startingBal
      );

      let cashPnl = 0;
      if (matchup.status === 'completed') {
        if (matchup.winnerType === 'tie') {
          // Tie refunds 90% of half-pot — player loses 10% of their half (the fee).
          cashPnl = -(cashBuyIn * 0.1);
        } else if (matchup.winnerId === userId) {
          cashPnl = winnerPayout - cashBuyIn;
        } else {
          cashPnl = -cashBuyIn;
        }
      }

      const rematchState = {
        user1Rematch: matchup.user1RematchDeclinedAt ? 'declined' : (matchup.user1RematchAt ? 'accepted' : 'pending'),
        user2Rematch: matchup.user2RematchDeclinedAt ? 'declined' : (matchup.user2RematchAt ? 'accepted' : 'pending'),
        rematchMatchupId: matchup.rematchMatchupId || null,
      };

      return res.status(200).json({
        matchup,
        opponent,
        myBets,
        opponentBets: canSeeOpponentBets ? opponentBets : [],
        canSeeOpponentBets,
        isUser1,
        myBalance,
        opponentBalance,
        cashBuyIn,
        cashPnl,
        myScore: myFinal,
        opponentScore: opponentFinal,
        winnerPayout,
        potSize,
        rematchState,
        timeRemaining: matchup.endsAt ? new Date(matchup.endsAt).getTime() - Date.now() : null,
      });

    } catch (error) {
      console.error('Get matchup error:', error);
      return res.status(500).json({ error: 'Failed to get matchup' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
