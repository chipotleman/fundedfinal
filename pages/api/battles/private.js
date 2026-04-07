import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { action, buyIn, duration, gameMode, code } = req.body;

  const GAME_MODES = {
    rush: { durationMinutes: 180, durationType: 'rush', coins: 10000 },
    original: { durationMinutes: 1440, durationType: 'original', coins: 10000 },
    tournament: { durationMinutes: 4320, durationType: 'tournament', coins: 100000 },
  };

  if (action === 'create') {
    const parsedBuyIn = parseFloat(buyIn) || 10;
    const validGameMode = GAME_MODES[gameMode] ? gameMode : 'original';
    const mode = GAME_MODES[validGameMode];
    const durationMinutes = mode.durationMinutes;
    const startingCoins = mode.coins;
    const potSize = parsedBuyIn * 2;
    const platformFee = potSize * 0.1;
    const winnerPayout = potSize - platformFee;

    try {
      let privateCode;
      let attempts = 0;
      while (attempts < 10) {
        privateCode = generateCode();
        const existing = await db
          .select({ id: matchups.id })
          .from(matchups)
          .where(and(eq(matchups.privateCode, privateCode), eq(matchups.status, 'waiting')))
          .limit(1);
        if (existing.length === 0) break;
        attempts++;
      }

      const [newMatchup] = await db
        .insert(matchups)
        .values({
          challengeType: 'private_battle',
          startingBalance: startingCoins.toString(),
          potSize: potSize.toString(),
          platformFee: platformFee.toString(),
          winnerPayout: winnerPayout.toString(),
          user1Id: userId,
          user1Balance: startingCoins.toString(),
          durationMinutes,
          durationType: mode.durationType,
          status: 'waiting',
          privateCode,
          matchType: 'private',
        })
        .returning();

      return res.status(201).json({
        code: privateCode,
        matchupId: newMatchup.id,
        matchup: newMatchup,
      });
    } catch (error) {
      console.error('Error creating private match:', error);
      return res.status(500).json({ error: 'Failed to create private match' });
    }
  }

  if (action === 'join') {
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid match code' });
    }

    try {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(and(eq(matchups.privateCode, code.toUpperCase()), eq(matchups.status, 'waiting')))
        .limit(1);

      if (!matchup) {
        return res.status(404).json({ error: 'Match not found or already started' });
      }

      if (matchup.user1Id === userId) {
        return res.status(400).json({ error: 'You cannot join your own match' });
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + matchup.durationMinutes * 60 * 1000);

      const [updated] = await db
        .update(matchups)
        .set({
          user2Id: userId,
          user2Balance: matchup.startingBalance,
          status: 'active',
          startsAt: now,
          endsAt,
          updatedAt: now,
        })
        .where(eq(matchups.id, matchup.id))
        .returning();

      const [p1] = await db.select({ username: profiles.username, avatar: profiles.avatar }).from(profiles).where(eq(profiles.id, matchup.user1Id));
      const [p2] = await db.select({ username: profiles.username, avatar: profiles.avatar }).from(profiles).where(eq(profiles.id, userId));

      return res.status(200).json({
        message: 'Joined match! Battle starting now.',
        matchup: updated,
        players: { player1: p1, player2: p2 },
      });
    } catch (error) {
      console.error('Error joining private match:', error);
      return res.status(500).json({ error: 'Failed to join private match' });
    }
  }

  if (action === 'cancel') {
    try {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.user1Id, userId),
          eq(matchups.status, 'waiting')
        ))
        .limit(1);

      if (!matchup) {
        return res.status(404).json({ error: 'No pending match found' });
      }

      await db
        .update(matchups)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(matchups.id, matchup.id));

      return res.status(200).json({ success: true, message: 'Match cancelled' });
    } catch (error) {
      console.error('Error cancelling private match:', error);
      return res.status(500).json({ error: 'Failed to cancel match' });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use "create", "join", or "cancel".' });
}
