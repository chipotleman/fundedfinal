import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { battleInvites, matchups, profiles, matchupQueue, matchmakingQueue } from '../../../../shared/schema';
import { eq, and, or, ne, inArray, isNotNull } from 'drizzle-orm';
const { publishBattleEvent, publishMatchupStart } = require('../../../../lib/battle-events');
const { sendPushToUsers, sendFriendLivePush } = require('../../../../lib/web-push');
const { computeBattleEndsAt } = require('../../../../lib/battleEndTime');

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const rows = await db
        .select({
          id: battleInvites.id,
          senderId: battleInvites.senderId,
          receiverId: battleInvites.receiverId,
          status: battleInvites.status,
          expiresAt: battleInvites.expiresAt,
          respondedAt: battleInvites.respondedAt,
          // matchupId + gameMode let the sender's waiting-screen poll
          // transition straight into the started battle the instant it
          // detects an accept — without waiting on the SSE matchup:start
          // push or a second /api/matchups/current round-trip.
          matchupId: battleInvites.matchupId,
          gameMode: battleInvites.gameMode,
        })
        .from(battleInvites)
        .where(eq(battleInvites.id, id))
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Battle invite not found' });
      }
      const row = rows[0];
      if (row.senderId !== userId && row.receiverId !== userId) {
        return res.status(403).json({ error: 'Not your invite' });
      }
      // Reflect server-side expiry without writing — the existing accept path
      // and the notifications cleanup already persist the state transition.
      let status = row.status;
      if (status === 'pending' && row.expiresAt && new Date(row.expiresAt) < new Date()) {
        status = 'expired';
      }
      return res.status(200).json({ invite: { ...row, status } });
    } catch (error) {
      console.error('Error fetching battle invite:', error);
      return res.status(500).json({ error: 'Failed to fetch battle invite' });
    }
  }

  if (req.method === 'PATCH') {
    const { action } = req.body;

    if (!['accept', 'decline', 'cancel'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const invite = await db
        .select()
        .from(battleInvites)
        .where(eq(battleInvites.id, id))
        .limit(1);

      if (invite.length === 0) {
        return res.status(404).json({ error: 'Battle invite not found' });
      }

      const battleInvite = invite[0];

      if (battleInvite.status !== 'pending') {
        return res.status(400).json({ error: 'This invite is no longer pending' });
      }

      if (action === 'cancel') {
        if (battleInvite.senderId !== userId) {
          return res.status(403).json({ error: 'Only the sender can cancel this invite' });
        }
        await db
          .update(battleInvites)
          .set({ status: 'cancelled', respondedAt: new Date() })
          .where(eq(battleInvites.id, id));
        // Belt-and-suspenders: also clear the sender's matchmaking queue
        // rows. The Play-a-Friend flow only writes to battle_invites, but a
        // user who chained Quick Match → Play Friend (or vice-versa) can
        // end up with stale `waiting` queue rows that make the UI keep
        // saying "Searching for a game" even after they cancel the invite.
        try {
          await db
            .update(matchupQueue)
            .set({ status: 'expired' })
            .where(and(
              eq(matchupQueue.userId, userId),
              eq(matchupQueue.status, 'waiting'),
            ));
          await db
            .delete(matchmakingQueue)
            .where(and(
              eq(matchmakingQueue.userId, userId),
              eq(matchmakingQueue.status, 'waiting'),
            ));
        } catch (_e) {}
        try {
          publishBattleEvent(
            [battleInvite.senderId, battleInvite.receiverId],
            { type: 'notification:refresh' }
          );
        } catch (_e) {}
        return res.status(200).json({ message: 'Battle invite cancelled' });
      }

      if (battleInvite.receiverId !== userId) {
        return res.status(403).json({ error: 'You are not the recipient of this invite' });
      }

      if (action === 'decline') {
        await db
          .update(battleInvites)
          .set({ status: 'declined', respondedAt: new Date() })
          .where(eq(battleInvites.id, id));
        try {
          publishBattleEvent([battleInvite.senderId, battleInvite.receiverId], { type: 'notification:refresh' });
        } catch (_e) {}
        try {
          const [receiverProfile] = await db
            .select({ username: profiles.username })
            .from(profiles)
            .where(eq(profiles.id, battleInvite.receiverId))
            .limit(1);
          const receiverName = receiverProfile?.username || 'Your friend';
          const buyInLabel = battleInvite.buyIn ? ` $${parseFloat(battleInvite.buyIn)}` : '';
          sendPushToUsers(battleInvite.senderId, {
            category: 'invite_outcome',
            title: 'Battle invite declined',
            body: `${receiverName} declined your${buyInLabel} battle invite`,
            url: '/battle',
            tag: `invite_declined:${battleInvite.id}`,
            data: { inviteId: battleInvite.id, type: 'invite_declined' },
          }).catch(() => {});
        } catch (e) { console.error('[invite_declined push]', e.message); }
        return res.status(200).json({ message: 'Battle invite declined' });
      }

      if (action === 'accept') {
        if (battleInvite.expiresAt && new Date(battleInvite.expiresAt) < new Date()) {
          await db
            .update(battleInvites)
            .set({ status: 'expired', respondedAt: new Date() })
            .where(eq(battleInvites.id, id));
          try {
            publishBattleEvent(
              [battleInvite.senderId, battleInvite.receiverId],
              { type: 'notification:refresh' }
            );
          } catch (_e) {}
          return res.status(400).json({ error: 'This invite has expired' });
        }

        // Active-matchup conflict guard. Without this, a recipient who
        // accepts while the sender is mid-battle (or vice versa) creates
        // a SECOND active matchup that lies dormant — invisible until the
        // first battle ends, at which point MatchupContext sees it as
        // "the active battle" and teleports the user into it. That's the
        // "phantom auto-accept after a forfeit/end" bug. We cancel the
        // invite here (rather than leaving it pending) so it can't be
        // re-accepted later against the same stale state, and we surface
        // a clear error so the receiver knows why.
        const conflictCheck = await db
          .select({ id: matchups.id, user1Id: matchups.user1Id, user2Id: matchups.user2Id })
          .from(matchups)
          .where(and(
            or(
              eq(matchups.user1Id, battleInvite.senderId),
              eq(matchups.user2Id, battleInvite.senderId),
              eq(matchups.user1Id, battleInvite.receiverId),
              eq(matchups.user2Id, battleInvite.receiverId),
            ),
            or(
              inArray(matchups.status, ['active', 'matched']),
              and(
                eq(matchups.status, 'waiting'),
                isNotNull(matchups.user1Id),
                isNotNull(matchups.user2Id),
              ),
            ),
          ))
          .limit(1);

        if (conflictCheck.length > 0) {
          const conflict = conflictCheck[0];
          const senderInBattle = conflict.user1Id === battleInvite.senderId || conflict.user2Id === battleInvite.senderId;
          await db
            .update(battleInvites)
            .set({ status: 'cancelled', respondedAt: new Date() })
            .where(eq(battleInvites.id, id));
          try {
            publishBattleEvent(
              [battleInvite.senderId, battleInvite.receiverId],
              { type: 'notification:refresh' }
            );
          } catch (_e) {}
          return res.status(409).json({
            error: senderInBattle
              ? "The sender is already in another battle. This invite was cancelled."
              : "You're already in another battle. Finish it before accepting a new one.",
          });
        }

        const claimed = await db
          .update(battleInvites)
          .set({ status: 'accepted', respondedAt: new Date() })
          .where(and(eq(battleInvites.id, id), eq(battleInvites.status, 'pending')))
          .returning();

        if (claimed.length === 0) {
          return res.status(409).json({ error: 'This invite has already been handled' });
        }

        const GAME_MODES = {
          rush: { durationMinutes: 180, durationType: 'rush', coins: 10000 },
          original: { durationMinutes: 1440, durationType: 'original', coins: 10000 },
          tournament: { durationMinutes: 4320, durationType: 'tournament', coins: 100000 },
        };

        const buyIn = parseFloat(battleInvite.buyIn);
        let inviteGameMode = battleInvite.gameMode;
        if (!inviteGameMode || !GAME_MODES[inviteGameMode]) {
          const legacyDuration = battleInvite.duration;
          if (legacyDuration <= 3) inviteGameMode = 'rush';
          else if (legacyDuration <= 24) inviteGameMode = 'original';
          else inviteGameMode = 'tournament';
        }
        const mode = GAME_MODES[inviteGameMode];
        const durationMinutes = mode.durationMinutes;
        const startingCoins = mode.coins;

        const now = new Date();
        const endsAt = computeBattleEndsAt({
          durationType: mode.durationType,
          durationMinutes,
        }, now);
        const potSize = buyIn * 2;
        const platformFee = potSize * 0.1;
        const winnerPayout = potSize - platformFee;

        let newMatchup;
        try {
          [newMatchup] = await db
            .insert(matchups)
            .values({
              challengeType: 'friend_battle',
              matchType: 'friend',
              startingBalance: startingCoins.toString(),
              potSize: potSize.toString(),
              platformFee: platformFee.toString(),
              winnerPayout: winnerPayout.toString(),
              user1Id: battleInvite.senderId,
              user2Id: battleInvite.receiverId,
              user1Balance: startingCoins.toString(),
              user2Balance: startingCoins.toString(),
              durationMinutes,
              durationType: mode.durationType,
              startsAt: now,
              endsAt,
              status: 'active',
            })
            .returning();
        } catch (matchupError) {
          await db
            .update(battleInvites)
            .set({ status: 'pending', respondedAt: null })
            .where(eq(battleInvites.id, id));
          console.error('Matchup creation failed, rolled back invite:', matchupError);
          return res.status(500).json({ error: 'Failed to create battle matchup' });
        }

        await db
          .update(battleInvites)
          .set({ matchupId: newMatchup.id })
          .where(eq(battleInvites.id, id));

        // Defense-in-depth: now that BOTH parties are committed to this
        // matchup, auto-cancel any OTHER pending invites either of them
        // has open. Without this, a sender who has multiple invites out
        // (or a recipient with stacked invites from other friends) can
        // still see them auto-accept later. Cancelled invites push a
        // refresh event so both sides' UIs update instantly.
        try {
          const otherPending = await db
            .update(battleInvites)
            .set({ status: 'cancelled', respondedAt: new Date() })
            .where(and(
              ne(battleInvites.id, id),
              eq(battleInvites.status, 'pending'),
              or(
                eq(battleInvites.senderId, battleInvite.senderId),
                eq(battleInvites.receiverId, battleInvite.senderId),
                eq(battleInvites.senderId, battleInvite.receiverId),
                eq(battleInvites.receiverId, battleInvite.receiverId),
              ),
            ))
            .returning({ id: battleInvites.id, senderId: battleInvites.senderId, receiverId: battleInvites.receiverId });
          if (otherPending.length > 0) {
            const affected = [...new Set(otherPending.flatMap(r => [r.senderId, r.receiverId]).filter(Boolean))];
            if (affected.length > 0) {
              publishBattleEvent(affected, { type: 'notification:refresh' });
            }
          }
        } catch (_e) {}

        const [senderProfile, receiverProfile] = await Promise.all([
          db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
            .from(profiles).where(eq(profiles.id, battleInvite.senderId)).then(r => r[0]),
          db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
            .from(profiles).where(eq(profiles.id, battleInvite.receiverId)).then(r => r[0]),
        ]);

        try {
          publishBattleEvent([battleInvite.senderId, battleInvite.receiverId], { type: 'notification:refresh' });
        } catch (_e) {}

        // Push the dedicated `matchup:start` event so /battle can swap the
        // sender's pending-invite UI for the lobby within ~1s instead of
        // waiting up to 5s for the safety poll.
        try {
          publishMatchupStart(newMatchup, { reason: 'invite_accepted', inviteId: battleInvite.id });
        } catch (_e) {}

        // Friends going live: tell each participant's friends a new battle started.
        sendFriendLivePush({
          matchupId: newMatchup.id,
          user1Id: battleInvite.senderId,
          user2Id: battleInvite.receiverId,
        });

        return res.status(200).json({ 
          message: 'Battle started!',
          matchupId: newMatchup.id,
          matchup: {
            ...newMatchup,
            player1: senderProfile || { id: battleInvite.senderId, username: 'Player 1' },
            player2: receiverProfile || { id: battleInvite.receiverId, username: 'Player 2' },
          },
        });
      }
    } catch (error) {
      console.error('Error updating battle invite:', error);
      return res.status(500).json({ error: 'Failed to update battle invite' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
