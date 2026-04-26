import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, matchupQueue, fakeOpponents, profiles, userChallenges, poolParticipants, pikPools } from '../../../shared/schema';
import { eq, and, ne, or, inArray } from 'drizzle-orm';
const { sendPushToUsers, getAcceptedFriendIds } = require('../../../lib/web-push');
const { publishMatchupStart } = require('../../../lib/battle-events');

const DURATION_CONFIGS = {
  '30_min': { minutes: 30, label: '30 Minutes' },
  '1_hour': { minutes: 60, label: '1 Hour' },
  '3_hours': { minutes: 180, label: '3 Hours' },
  '1_day': { minutes: 1440, label: '1 Day' },
  '3_days': { minutes: 4320, label: '3 Days' },
  '1_week': { minutes: 10080, label: '1 Week' },
};

const CHALLENGE_CONFIGS = {
  starter: { balance: 5000, price: 149 },
  pro: { balance: 10000, price: 249 },
  elite: { balance: 25000, price: 399 },
};

const PLATFORM_FEE_PERCENT = 0.10;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'POST') {
    try {
      const { challengeType: bodyType, bankroll: bodyBankroll, durationType = '1_day' } = req.body;

      const durationConfig = DURATION_CONFIGS[durationType];
      if (!durationConfig) {
        return res.status(400).json({ error: 'Invalid duration type' });
      }

      const [userProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));

      if (!userProfile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      let challengeType = bodyType || 'starter';
      let startingBalance = bodyBankroll || parseFloat(userProfile.bankroll) || 5000;

      if (userProfile.challenge) {
        const challengeData = typeof userProfile.challenge === 'string' 
          ? JSON.parse(userProfile.challenge) 
          : userProfile.challenge;
        challengeType = challengeData?.challengeType || challengeType;
      }

      const [activePoolParticipation] = await db
        .select({
          participant: poolParticipants,
          pool: pikPools,
        })
        .from(poolParticipants)
        .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
        .where(
          and(
            eq(poolParticipants.userId, userId),
            inArray(pikPools.status, ["open", "filling", "active"])
          )
        )
        .limit(1);

      if (activePoolParticipation) {
        return res.status(409).json({
          error: 'You are already in an active pool',
          code: 'ACTIVE_CHALLENGE_EXISTS',
          challengeType: 'pool',
        });
      }

      const [existingQueue] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.userId, userId),
          eq(matchupQueue.status, 'waiting')
        ));

      if (existingQueue) {
        return res.status(400).json({ error: 'Already in queue' });
      }

      const [existingMatchup] = await db
        .select()
        .from(matchups)
        .where(and(
          or(
            eq(matchups.user1Id, userId),
            eq(matchups.user2Id, userId)
          ),
          inArray(matchups.status, ['waiting', 'matched', 'active'])
        ));

      if (existingMatchup) {
        return res.status(400).json({ error: 'Already in an active matchup', matchupId: existingMatchup.id });
      }

      const [potentialMatch] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.challengeType, challengeType),
          eq(matchupQueue.status, 'waiting'),
          ne(matchupQueue.userId, userId)
        ))
        .limit(1);

      if (potentialMatch) {
        const potSize = startingBalance * 2;
        const platformFee = potSize * PLATFORM_FEE_PERCENT;
        const winnerPayout = potSize - platformFee;
        const now = new Date();
        const endsAt = new Date(now.getTime() + durationConfig.minutes * 60 * 1000);

        const [newMatchup] = await db.insert(matchups).values({
          challengeType,
          startingBalance: startingBalance.toString(),
          potSize: potSize.toString(),
          platformFee: platformFee.toString(),
          winnerPayout: winnerPayout.toString(),
          user1Id: potentialMatch.userId,
          user1Balance: startingBalance.toString(),
          user2Id: userId,
          user2Balance: startingBalance.toString(),
          isFakeOpponent: false,
          durationMinutes: durationConfig.minutes,
          durationType,
          startsAt: now,
          endsAt,
          status: 'active',
        }).returning();

        await db
          .update(matchupQueue)
          .set({ status: 'matched', matchupId: newMatchup.id, matchedAt: now })
          .where(eq(matchupQueue.id, potentialMatch.id));

        // Push the dedicated `matchup:start` event so the user who was
        // already waiting in the queue (and therefore stuck on /battle's
        // "looking for opponent" view) flips into the lobby within ~1s
        // instead of waiting for the safety poll.
        try {
          publishMatchupStart(newMatchup, { reason: 'queue_matched' });
        } catch (_e) {}

        const [matchedProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, potentialMatch.userId));

        // Friends going live: notify both players' friends.
        try {
          const [friendsOfA, friendsOfB] = await Promise.all([
            getAcceptedFriendIds(potentialMatch.userId),
            getAcceptedFriendIds(userId),
          ]);
          const exclude = new Set([potentialMatch.userId, userId]);
          const targetsA = friendsOfA.filter(id => !exclude.has(id));
          const targetsB = friendsOfB.filter(id => !exclude.has(id));
          const [profA] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, userId));
          if (targetsA.length > 0) {
            sendPushToUsers(targetsA, {
              category: 'friend_live',
              title: `${matchedProfile?.username || 'Your friend'} just started a battle`,
              body: 'Tap to spectate or jump into your own.',
              url: `/battle?live=${newMatchup.id}`,
              tag: `friend_live:${potentialMatch.userId}:${newMatchup.id}`,
              data: { matchupId: newMatchup.id, type: 'friend_live', friendId: potentialMatch.userId },
            }).catch(() => {});
          }
          if (targetsB.length > 0) {
            sendPushToUsers(targetsB, {
              category: 'friend_live',
              title: `${profA?.username || 'Your friend'} just started a battle`,
              body: 'Tap to spectate or jump into your own.',
              url: `/battle?live=${newMatchup.id}`,
              tag: `friend_live:${userId}:${newMatchup.id}`,
              data: { matchupId: newMatchup.id, type: 'friend_live', friendId: userId },
            }).catch(() => {});
          }
        } catch (e) { console.error('[queue friend_live push]', e.message); }

        return res.status(200).json({
          status: 'matched',
          matchup: newMatchup,
          opponent: {
            id: potentialMatch.userId,
            username: matchedProfile?.username || 'Opponent',
            avatar: matchedProfile?.avatar || null,
            isReal: true,
          }
        });
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const [queueEntry] = await db.insert(matchupQueue).values({
        userId,
        challengeType,
        startingBalance: startingBalance.toString(),
        durationType,
        status: 'waiting',
        expiresAt,
      }).returning();

      return res.status(200).json({
        status: 'queued',
        queueEntry,
        message: 'Looking for opponent...',
      });

    } catch (error) {
      console.error('Queue error:', error);
      return res.status(500).json({ error: 'Failed to queue for matchup' });
    }
  }

  if (req.method === 'GET') {
    try {
      const [queueEntry] = await db
        .select()
        .from(matchupQueue)
        .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

      const [activeMatchup] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'active'),
          eq(matchups.user1Id, userId)
        ));

      const [activeMatchup2] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'active'),
          eq(matchups.user2Id, userId)
        ));

      const matchup = activeMatchup || activeMatchup2;

      if (matchup) {
        let opponent = null;
        const isUser1 = matchup.user1Id === userId;
        const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;

        if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
          const [fake] = await db
            .select()
            .from(fakeOpponents)
            .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
          
          if (fake) {
            let avatarUrl = fake.avatar;
            if (!avatarUrl) {
              const profileId = fake.userId || fake.id;
              const [fakeProfile] = await db
                .select({ avatar: profiles.avatar })
                .from(profiles)
                .where(eq(profiles.id, profileId));
              if (fakeProfile?.avatar) avatarUrl = fakeProfile.avatar;
            }
            opponent = {
              id: fake.id,
              username: fake.displayName,
              avatar: avatarUrl,
              winRate: fake.winRate,
              isReal: false,
            };
          }
        } else if (opponentId) {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, opponentId));

          opponent = {
            id: opponentId,
            username: profile?.username || 'Opponent',
            avatar: profile?.avatar || null,
            isReal: true,
          };
        }

        return res.status(200).json({
          status: 'matched',
          matchup,
          opponent,
          isUser1,
        });
      }

      if (queueEntry) {
        return res.status(200).json({
          status: 'queued',
          queueEntry,
        });
      }

      return res.status(200).json({
        status: 'none',
      });

    } catch (error) {
      console.error('Queue status error:', error);
      return res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db
        .update(matchupQueue)
        .set({ status: 'expired' })
        .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Cancel queue error:', error);
      return res.status(500).json({ error: 'Failed to cancel queue' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
