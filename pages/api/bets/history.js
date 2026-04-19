import { db } from '../../../lib/db';
import { userBets, fakeOpponents, fakeOpponentBets, matchups, profiles, users } from '../../../shared/schema';
import { eq, desc, or, inArray, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    // Check if this user is a fake opponent
    const [fakeOpponent] = await db
      .select()
      .from(fakeOpponents)
      .where(or(
        eq(fakeOpponents.userId, userId),
        eq(fakeOpponents.id, userId)
      ));

    let bets = [];

    if (fakeOpponent) {
      bets = await db
        .select()
        .from(fakeOpponentBets)
        .where(eq(fakeOpponentBets.fakeOpponentId, fakeOpponent.id))
        .orderBy(desc(fakeOpponentBets.placedAt));
    } else {
      bets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, userId))
        .orderBy(desc(userBets.placedAt));
    }

    const formattedBets = bets.map(bet => ({
      id: bet.id,
      matchupId: bet.matchupId || null,
      matchup: bet.matchupName,
      selection: bet.selection,
      betType: bet.marketType,
      odds: parseInt(bet.odds) || 0,
      stake: parseFloat(bet.stake) || 0,
      status: bet.status === 'pending' ? 'open' : bet.status,
      placedAt: bet.placedAt,
      settledAt: bet.settledAt,
      profit: bet.status === 'won'
        ? (parseFloat(bet.potentialPayout) - parseFloat(bet.stake))
        : bet.status === 'cashed_out'
        ? parseFloat(bet.pnl) || (parseFloat(bet.stake) * -0.2)
        : bet.status === 'lost'
        ? -parseFloat(bet.stake)
        : 0,
      potentialPayout: parseFloat(bet.potentialPayout) || 0,
      legs: bet.legs || null,
      homeScore: bet.homeScore,
      awayScore: bet.awayScore,
      homeTeamFull: bet.homeTeamFull,
      awayTeamFull: bet.awayTeamFull
    }));

    formattedBets.sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      return new Date(b.placedAt) - new Date(a.placedAt);
    });

    // Backfill matchupId for any bets without one by matching placedAt to a
    // matchup's time window (the user participated in). Applies only to real
    // user bets — fake-opponent bets already carry matchupId in their table.
    if (!fakeOpponent) {
      const userMatchups = await db
        .select()
        .from(matchups)
        .where(or(eq(matchups.user1Id, userId), eq(matchups.user2Id, userId)));

      for (const bet of formattedBets) {
        if (bet.matchupId) continue;
        if (!bet.placedAt) continue;
        const placed = new Date(bet.placedAt).getTime();
        const m = userMatchups.find(mm => {
          const start = mm.startsAt ? new Date(mm.startsAt).getTime() : (mm.createdAt ? new Date(mm.createdAt).getTime() : null);
          const end = mm.endsAt ? new Date(mm.endsAt).getTime() : (mm.status === 'completed' ? (mm.updatedAt ? new Date(mm.updatedAt).getTime() : null) : Date.now());
          if (!start) return false;
          return placed >= start && placed <= (end || Date.now());
        });
        if (m) bet.matchupId = m.id;
      }
    }

    // Build battles map for any bets that have a matchupId
    const matchupIds = [...new Set(formattedBets.map(b => b.matchupId).filter(Boolean))];
    const battles = {};

    const formatRawBet = (bet) => ({
      id: bet.id,
      matchupId: bet.matchupId || null,
      matchup: bet.matchupName,
      selection: bet.selection,
      betType: bet.marketType,
      odds: parseInt(bet.odds) || 0,
      stake: parseFloat(bet.stake) || 0,
      status: bet.status === 'pending' ? 'open' : bet.status,
      placedAt: bet.placedAt,
      settledAt: bet.settledAt,
      profit: bet.status === 'won'
        ? (parseFloat(bet.potentialPayout) - parseFloat(bet.stake))
        : bet.status === 'cashed_out'
        ? parseFloat(bet.pnl) || (parseFloat(bet.stake) * -0.2)
        : bet.status === 'lost'
        ? -parseFloat(bet.stake)
        : 0,
      potentialPayout: parseFloat(bet.potentialPayout) || 0,
      legs: bet.legs || null,
      homeScore: bet.homeScore,
      awayScore: bet.awayScore,
      homeTeamFull: bet.homeTeamFull,
      awayTeamFull: bet.awayTeamFull,
    });

    if (matchupIds.length > 0) {
      const matchupRows = await db
        .select()
        .from(matchups)
        .where(inArray(matchups.id, matchupIds));

      // Collect opponent IDs (real users + fake opponents)
      const opponentUserIds = [];
      const opponentFakeIds = [];
      for (const m of matchupRows) {
        const oppId = m.user1Id === userId ? m.user2Id : m.user1Id;
        if (!oppId) continue;
        if (m.isFakeOpponent && m.fakeOpponentId) {
          opponentFakeIds.push(m.fakeOpponentId);
        } else {
          opponentUserIds.push(oppId);
        }
      }

      const oppProfiles = opponentUserIds.length
        ? await db.select().from(profiles).where(inArray(profiles.id, opponentUserIds))
        : [];
      const oppUsers = opponentUserIds.length
        ? await db.select().from(users).where(inArray(users.id, opponentUserIds))
        : [];
      const fakeOpps = opponentFakeIds.length
        ? await db.select().from(fakeOpponents).where(inArray(fakeOpponents.id, opponentFakeIds))
        : [];

      // Fetch opponent bets for each matchup so we can show what they piked
      const opponentBetsByMatchup = {};
      if (opponentUserIds.length) {
        const oppBetRows = await db
          .select()
          .from(userBets)
          .where(and(
            inArray(userBets.userId, opponentUserIds),
            inArray(userBets.matchupId, matchupIds)
          ));
        for (const b of oppBetRows) {
          if (!opponentBetsByMatchup[b.matchupId]) opponentBetsByMatchup[b.matchupId] = [];
          opponentBetsByMatchup[b.matchupId].push(formatRawBet(b));
        }
      }
      if (opponentFakeIds.length) {
        const fakeBetRows = await db
          .select()
          .from(fakeOpponentBets)
          .where(and(
            inArray(fakeOpponentBets.fakeOpponentId, opponentFakeIds),
            inArray(fakeOpponentBets.matchupId, matchupIds)
          ));
        for (const b of fakeBetRows) {
          if (!opponentBetsByMatchup[b.matchupId]) opponentBetsByMatchup[b.matchupId] = [];
          opponentBetsByMatchup[b.matchupId].push(formatRawBet(b));
        }
      }
      // Sort opponent bets newest-first
      for (const mid of Object.keys(opponentBetsByMatchup)) {
        opponentBetsByMatchup[mid].sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));
      }

      const profileMap = Object.fromEntries(oppProfiles.map(p => [p.id, p]));
      const userMap = Object.fromEntries(oppUsers.map(u => [u.id, u]));
      const fakeMap = Object.fromEntries(fakeOpps.map(f => [f.id, f]));

      for (const m of matchupRows) {
        const isUser1 = m.user1Id === userId;
        const oppId = isUser1 ? m.user2Id : m.user1Id;
        let opponent = { id: oppId, username: 'Opponent', avatar: null };

        if (m.isFakeOpponent && m.fakeOpponentId && fakeMap[m.fakeOpponentId]) {
          const f = fakeMap[m.fakeOpponentId];
          opponent = {
            id: f.id,
            username: f.displayName || f.username || 'Opponent',
            avatar: f.avatar || null,
            equippedFrame: null,
          };
        } else if (oppId) {
          const p = profileMap[oppId];
          const u = userMap[oppId];
          opponent = {
            id: oppId,
            username: p?.username || (u?.email ? u.email.split('@')[0] : 'Opponent'),
            avatar: p?.avatar || u?.image || null,
            equippedFrame: p?.equippedFrame || null,
          };
        }

        const myBalance = parseFloat((isUser1 ? m.user1FinalBalance : m.user2FinalBalance) ?? (isUser1 ? m.user1Balance : m.user2Balance) ?? 0);
        const oppBalance = parseFloat((isUser1 ? m.user2FinalBalance : m.user1FinalBalance) ?? (isUser1 ? m.user2Balance : m.user1Balance) ?? 0);

        let outcome = 'active';
        if (m.status === 'completed') {
          if (m.winnerType === 'tie') outcome = 'tie';
          else if (m.winnerId === userId) outcome = 'won';
          else outcome = 'lost';
        }

        const oppBets = opponentBetsByMatchup[m.id] || [];
        let myPendingCount = 0;
        let opponentPendingCount = 0;
        if (m.status === 'completed') {
          for (const ob of oppBets) {
            if (ob.status === 'open') {
              ob.forfeitedAtBattleEnd = true;
              opponentPendingCount++;
            }
          }
          for (const mb of formattedBets) {
            if (mb.matchupId === m.id && mb.status === 'open') myPendingCount++;
          }
        }

        battles[m.id] = {
          id: m.id,
          opponent,
          startingBalance: parseFloat(m.startingBalance ?? 0),
          potSize: parseFloat(m.potSize ?? 0),
          winnerPayout: parseFloat(m.winnerPayout ?? 0),
          myBalance,
          oppBalance,
          durationMinutes: m.durationMinutes,
          durationType: m.durationType,
          status: m.status,
          outcome,
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          createdAt: m.createdAt,
          challengeType: m.challengeType,
          isFakeOpponent: !!m.isFakeOpponent,
          opponentBets: oppBets,
          myPendingCount,
          opponentPendingCount,
        };
      }
    }

    // Mark bets that were still pending when their battle ended as
    // "did not grade in time (forfeited toward battle's score)" so the
    // UI can show a badge and the user can reconcile their balance.
    for (const bet of formattedBets) {
      if (!bet.matchupId) continue;
      const battle = battles[bet.matchupId];
      if (!battle) continue;
      if (battle.status === 'completed' && bet.status === 'open') {
        bet.forfeitedAtBattleEnd = true;
      }
    }

    return res.status(200).json({ bets: formattedBets, battles });
  } catch (error) {
    console.error('Error fetching bet history:', error);
    return res.status(500).json({ error: 'Failed to fetch bet history' });
  }
}
