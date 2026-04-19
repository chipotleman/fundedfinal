import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { battleInvites, matchups, profiles } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../../lib/battle-events');
const { sendPushToUsers, getAcceptedFriendIds } = require('../../../../lib/web-push');

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
        try { publishBattleEvent(battleInvite.receiverId, { type: 'notification:refresh' }); } catch (_e) {}
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
        return res.status(200).json({ message: 'Battle invite declined' });
      }

      if (action === 'accept') {
        if (battleInvite.expiresAt && new Date(battleInvite.expiresAt) < new Date()) {
          await db
            .update(battleInvites)
            .set({ status: 'expired', respondedAt: new Date() })
            .where(eq(battleInvites.id, id));
          return res.status(400).json({ error: 'This invite has expired' });
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
        const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
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

        const [senderProfile, receiverProfile] = await Promise.all([
          db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
            .from(profiles).where(eq(profiles.id, battleInvite.senderId)).then(r => r[0]),
          db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
            .from(profiles).where(eq(profiles.id, battleInvite.receiverId)).then(r => r[0]),
        ]);

        try {
          publishBattleEvent([battleInvite.senderId, battleInvite.receiverId], { type: 'notification:refresh' });
        } catch (_e) {}

        // Friends going live: tell each participant's friends a new battle started.
        try {
          const senderName = senderProfile?.username || 'Your friend';
          const receiverName = receiverProfile?.username || 'Your friend';
          const [senderFriends, receiverFriends] = await Promise.all([
            getAcceptedFriendIds(battleInvite.senderId),
            getAcceptedFriendIds(battleInvite.receiverId),
          ]);
          const targetsForSender = senderFriends.filter(id => id !== battleInvite.senderId && id !== battleInvite.receiverId);
          const targetsForReceiver = receiverFriends.filter(id => id !== battleInvite.senderId && id !== battleInvite.receiverId);
          if (targetsForSender.length > 0) {
            sendPushToUsers(targetsForSender, {
              category: 'friend_live',
              title: `${senderName} just started a battle`,
              body: 'Tap to spectate or jump into your own.',
              url: `/battle?live=${newMatchup.id}`,
              tag: `friend_live:${battleInvite.senderId}:${newMatchup.id}`,
              data: { matchupId: newMatchup.id, type: 'friend_live', friendId: battleInvite.senderId },
            }).catch(() => {});
          }
          if (targetsForReceiver.length > 0) {
            sendPushToUsers(targetsForReceiver, {
              category: 'friend_live',
              title: `${receiverName} just started a battle`,
              body: 'Tap to spectate or jump into your own.',
              url: `/battle?live=${newMatchup.id}`,
              tag: `friend_live:${battleInvite.receiverId}:${newMatchup.id}`,
              data: { matchupId: newMatchup.id, type: 'friend_live', friendId: battleInvite.receiverId },
            }).catch(() => {});
          }
        } catch (e) { console.error('[friend_live push]', e.message); }

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
