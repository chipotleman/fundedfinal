import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import {
  matchups,
  profiles,
  userBets,
  fakeOpponentBets,
  battleLikes,
} from '../../../../shared/schema';
import { and, eq, gte, lte, or, sql } from 'drizzle-orm';

function shortenTeamName(name) {
  if (!name) return 'Pick';
  const parts = String(name).split(' ');
  if (parts.length > 2) return parts.slice(-1)[0];
  return name;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'matchupId required' });
  }

  let viewerId = null;
  try {
    const session = await getServerSession(req, res, authOptions);
    viewerId = session?.user?.id || null;
  } catch {
    // unauthenticated viewer is fine — likedByMe just stays false
  }

  try {
    const [battle] = await db
      .select({
        id: matchups.id,
        challengeType: matchups.challengeType,
        potSize: matchups.potSize,
        winnerPayout: matchups.winnerPayout,
        user1Id: matchups.user1Id,
        user2Id: matchups.user2Id,
        user1Balance: matchups.user1Balance,
        user2Balance: matchups.user2Balance,
        user1FinalBalance: matchups.user1FinalBalance,
        user2FinalBalance: matchups.user2FinalBalance,
        startingBalance: matchups.startingBalance,
        startsAt: matchups.startsAt,
        endsAt: matchups.endsAt,
        status: matchups.status,
        durationMinutes: matchups.durationMinutes,
        durationType: matchups.durationType,
        isFakeOpponent: matchups.isFakeOpponent,
        winnerId: matchups.winnerId,
        winnerType: matchups.winnerType,
      })
      .from(matchups)
      .where(eq(matchups.id, id))
      .limit(1);

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    const userIds = [battle.user1Id, battle.user2Id].filter(Boolean);
    let userProfiles = [];
    if (userIds.length > 0) {
      userProfiles = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
        })
        .from(profiles)
        .where(or(...userIds.map((uid) => eq(profiles.id, uid))));
    }
    const profileMap = Object.fromEntries(userProfiles.map((p) => [p.id, p]));

    const startTime = battle.startsAt ? new Date(battle.startsAt).getTime() : null;
    const endTime = battle.endsAt ? new Date(battle.endsAt).getTime() : null;
    const now = Date.now();
    const totalDuration = startTime && endTime ? endTime - startTime : 0;
    const elapsed = startTime ? Math.max(0, now - startTime) : 0;
    const isCompleted =
      battle.status === 'completed' ||
      battle.status === 'cancelled' ||
      (endTime !== null && endTime <= now);
    const remaining = isCompleted
      ? 0
      : endTime
        ? Math.max(0, endTime - now)
        : 0;
    const progressPercent = isCompleted
      ? 100
      : totalDuration > 0
        ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
        : 0;

    const u1Start = parseFloat(battle.startingBalance) || 0;
    const u1Current =
      isCompleted && battle.user1FinalBalance != null
        ? parseFloat(battle.user1FinalBalance) || 0
        : parseFloat(battle.user1Balance) || 0;
    const u1Pnl = u1Start > 0 ? u1Current - u1Start : 0;
    const u1PnlPct = u1Start > 0 ? ((u1Pnl / u1Start) * 100).toFixed(1) : '0.0';

    const u2Start = parseFloat(battle.startingBalance) || 0;
    const u2Current =
      isCompleted && battle.user2FinalBalance != null
        ? parseFloat(battle.user2FinalBalance) || 0
        : parseFloat(battle.user2Balance) || 0;
    const u2Pnl = u2Start > 0 ? u2Current - u2Start : 0;
    const u2PnlPct = u2Start > 0 ? ((u2Pnl / u2Start) * 100).toFixed(1) : '0.0';

    let user1Picks = [];
    let user2Picks = [];
    // Don't expose picks until the battle has actually started — pre-game
    // we'd be leaking either side's strategy and enabling copy-betting.
    const picksVisible =
      battle.status === 'active' ||
      battle.status === 'completed' ||
      battle.status === 'cancelled';
    try {
      if (picksVisible && battle.startsAt && battle.endsAt) {
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
            .where(
              and(
                eq(userBets.userId, battle.user1Id),
                gte(userBets.placedAt, battleStart),
                lte(userBets.placedAt, battleEnd),
              ),
            )
            .limit(10);
          user1Picks = u1Bets.map((b) => ({
            team: shortenTeamName(b.selection || 'Pick'),
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
            .limit(10);
          user2Picks = fakeBets.map((b) => ({
            team: shortenTeamName(b.selection || 'Pick'),
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
            .where(
              and(
                eq(userBets.userId, battle.user2Id),
                gte(userBets.placedAt, battleStart),
                lte(userBets.placedAt, battleEnd),
              ),
            )
            .limit(10);
          user2Picks = u2Bets.map((b) => ({
            team: shortenTeamName(b.selection || 'Pick'),
            type: b.marketType || '',
            odds: b.odds || '',
            status: b.status || 'pending',
            amount: parseFloat(b.stake) || 0,
          }));
        }
      }
    } catch (err) {
      console.error('[battles/[id]] picks fetch failed', battle.id, err);
    }

    let likeCount = 0;
    let likedByMe = false;
    try {
      const [{ count }] = await db
        .select({ count: sql`COUNT(*)::int`.as('count') })
        .from(battleLikes)
        .where(eq(battleLikes.matchupId, battle.id));
      likeCount = Number(count) || 0;
      if (viewerId) {
        const mine = await db
          .select({ id: battleLikes.id })
          .from(battleLikes)
          .where(and(eq(battleLikes.matchupId, battle.id), eq(battleLikes.userId, viewerId)))
          .limit(1);
        likedByMe = mine.length > 0;
      }
    } catch (err) {
      console.error('[battles/[id]] likes fetch failed', battle.id, err);
    }

    const enriched = {
      id: battle.id,
      likeCount,
      likedByMe,
      challengeType: battle.challengeType,
      potSize: battle.potSize || '0',
      winnerPayout: battle.winnerPayout || '0',
      status: battle.status,
      isCompleted,
      startsAt: battle.startsAt,
      endsAt: battle.endsAt,
      remainingMs: remaining,
      progressPercent: isNaN(progressPercent) ? 0 : progressPercent,
      winnerId: battle.winnerId || null,
      winnerType: battle.winnerType || null,
      picks:
        user1Picks.length > 0 || user2Picks.length > 0
          ? { user1: user1Picks, user2: user2Picks }
          : null,
      user1: {
        ...(profileMap[battle.user1Id] || {
          username: 'Player 1',
          avatar: null,
          battleWins: 0,
          battleLosses: 0,
        }),
        id: battle.user1Id,
        balance: isNaN(u1Current) ? 0 : u1Current,
        pnl: isNaN(u1Pnl) ? 0 : u1Pnl,
        pnlPercent: u1PnlPct,
      },
      user2: battle.user2Id
        ? {
            ...(profileMap[battle.user2Id] || {
              username: 'Player 2',
              avatar: null,
              battleWins: 0,
              battleLosses: 0,
            }),
            id: battle.user2Id,
            balance: isNaN(u2Current) ? 0 : u2Current,
            pnl: isNaN(u2Pnl) ? 0 : u2Pnl,
            pnlPercent: u2PnlPct,
            isFake: battle.isFakeOpponent || false,
          }
        : null,
    };

    return res.status(200).json({ battle: enriched });
  } catch (err) {
    console.error('[battles/[id]] error', err);
    return res.status(500).json({ error: 'Failed to load battle' });
  }
}
