import { db } from '../../../lib/db';
import { matchups, profiles, userBets, fakeOpponentBets } from '../../../shared/schema';
import { eq, or, and, gte, lte, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const activeBattles = await db
      .select({
        id: matchups.id,
        challengeType: matchups.challengeType,
        potSize: matchups.potSize,
        user1Id: matchups.user1Id,
        user2Id: matchups.user2Id,
        user1Balance: matchups.user1Balance,
        user2Balance: matchups.user2Balance,
        startingBalance: matchups.startingBalance,
        startsAt: matchups.startsAt,
        endsAt: matchups.endsAt,
        status: matchups.status,
        durationMinutes: matchups.durationMinutes,
        durationType: matchups.durationType,
        isFakeOpponent: matchups.isFakeOpponent,
      })
      .from(matchups)
      .where(eq(matchups.status, 'active'))
      .orderBy(desc(matchups.startsAt))
      .limit(50);

    const userIds = [
      ...new Set(
        activeBattles.flatMap(b => [b.user1Id, b.user2Id].filter(Boolean))
      ),
    ];

    let userProfiles = [];
    if (userIds.length > 0) {
      userProfiles = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
        })
        .from(profiles)
        .where(or(...userIds.map(id => eq(profiles.id, id))));
    }

    const profileMap = Object.fromEntries(userProfiles.map(p => [p.id, p]));

    const filteredBattles = activeBattles.filter(battle => {
      if (!battle.startsAt || !battle.endsAt) return false;
      const endTime = new Date(battle.endsAt).getTime();
      return endTime > Date.now();
    });

    const enrichedBattles = await Promise.all(filteredBattles.map(async (battle) => {
      const startTime = new Date(battle.startsAt).getTime();
      const endTime = new Date(battle.endsAt).getTime();
      const now = Date.now();
      const totalDuration = endTime - startTime;
      const elapsed = now - startTime;
      const remaining = Math.max(0, endTime - now);
      const progressPercent = totalDuration > 0 
        ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
        : 0;

      const user1StartBalance = parseFloat(battle.startingBalance) || 0;
      const user1Current = parseFloat(battle.user1Balance) || 0;
      const user1PnL = user1StartBalance > 0 ? user1Current - user1StartBalance : 0;
      const user1PnLPercent = user1StartBalance > 0 
        ? ((user1PnL / user1StartBalance) * 100).toFixed(1)
        : '0.0';

      const user2StartBalance = parseFloat(battle.startingBalance) || 0;
      const user2Current = parseFloat(battle.user2Balance) || 0;
      const user2PnL = user2StartBalance > 0 ? user2Current - user2StartBalance : 0;
      const user2PnLPercent = user2StartBalance > 0
        ? ((user2PnL / user2StartBalance) * 100).toFixed(1)
        : '0.0';

      let user1Picks = [];
      let user2Picks = [];

      try {
        const battleStart = new Date(battle.startsAt);
        const battleEnd = new Date(battle.endsAt);

        if (battle.user1Id) {
          const u1Bets = await db
            .select({
              selection: userBets.selection,
              marketType: userBets.marketType,
              odds: userBets.odds,
              stake: userBets.stake,
              status: userBets.status,
            })
            .from(userBets)
            .where(and(
              eq(userBets.userId, battle.user1Id),
              gte(userBets.placedAt, battleStart),
              lte(userBets.placedAt, battleEnd)
            ))
            .limit(5);
          user1Picks = u1Bets.map(b => ({
            team: b.selection || 'Pick',
            type: b.marketType || '',
            odds: b.odds || '',
            status: b.status || 'pending',
            amount: parseFloat(b.stake) || 0,
          }));
        }

        if (battle.user2Id && battle.isFakeOpponent) {
          const fakeBets = await db
            .select({
              selection: fakeOpponentBets.selection,
              marketType: fakeOpponentBets.marketType,
              odds: fakeOpponentBets.odds,
              stake: fakeOpponentBets.stake,
              status: fakeOpponentBets.status,
            })
            .from(fakeOpponentBets)
            .where(eq(fakeOpponentBets.matchupId, battle.id))
            .limit(5);
          user2Picks = fakeBets.map(b => ({
            team: b.selection || 'Pick',
            type: b.marketType || '',
            odds: b.odds || '',
            status: b.status || 'pending',
            amount: parseFloat(b.stake) || 0,
          }));
        } else if (battle.user2Id) {
          const u2Bets = await db
            .select({
              selection: userBets.selection,
              marketType: userBets.marketType,
              odds: userBets.odds,
              stake: userBets.stake,
              status: userBets.status,
            })
            .from(userBets)
            .where(and(
              eq(userBets.userId, battle.user2Id),
              gte(userBets.placedAt, battleStart),
              lte(userBets.placedAt, battleEnd)
            ))
            .limit(5);
          user2Picks = u2Bets.map(b => ({
            team: b.selection || 'Pick',
            type: b.marketType || '',
            odds: b.odds || '',
            status: b.status || 'pending',
            amount: parseFloat(b.stake) || 0,
          }));
        }
      } catch (err) {
        console.error('Error fetching picks for battle', battle.id, err);
      }

      return {
        id: battle.id,
        challengeType: battle.challengeType,
        potSize: battle.potSize || '0',
        status: battle.status,
        startsAt: battle.startsAt,
        endsAt: battle.endsAt,
        remainingMs: remaining,
        progressPercent: isNaN(progressPercent) ? 0 : progressPercent,
        picks: (user1Picks.length > 0 || user2Picks.length > 0) ? { user1: user1Picks, user2: user2Picks } : null,
        user1: {
          ...(profileMap[battle.user1Id] || { username: 'Player 1', avatar: null, battleWins: 0, battleLosses: 0 }),
          id: battle.user1Id,
          balance: isNaN(user1Current) ? 0 : user1Current,
          pnl: isNaN(user1PnL) ? 0 : user1PnL,
          pnlPercent: user1PnLPercent,
        },
        user2: battle.user2Id ? {
          ...(profileMap[battle.user2Id] || { username: 'Player 2', avatar: null, battleWins: 0, battleLosses: 0 }),
          id: battle.user2Id,
          balance: isNaN(user2Current) ? 0 : user2Current,
          pnl: isNaN(user2PnL) ? 0 : user2PnL,
          pnlPercent: user2PnLPercent,
          isFake: battle.isFakeOpponent || false,
        } : null,
      };
    }));

    return res.status(200).json({ battles: enrichedBattles });
  } catch (error) {
    console.error('Error fetching live battles:', error);
    return res.status(500).json({ error: 'Failed to fetch live battles' });
  }
}
