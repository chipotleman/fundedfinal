import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { battleInvites, matchups, profiles } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { id } = req.query;

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

        const buyIn = parseFloat(battleInvite.buyIn);
        const duration = battleInvite.duration;
        const durationMinutes = duration * 60;

        const now = new Date();
        const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
        const potSize = buyIn * 2;
        const platformFee = potSize * 0.1;
        const winnerPayout = potSize - platformFee;

        const [newMatchup] = await db
          .insert(matchups)
          .values({
            challengeType: 'friend_battle',
            matchType: 'friend',
            startingBalance: buyIn.toString(),
            potSize: potSize.toString(),
            platformFee: platformFee.toString(),
            winnerPayout: winnerPayout.toString(),
            user1Id: battleInvite.senderId,
            user2Id: battleInvite.receiverId,
            user1Balance: buyIn.toString(),
            user2Balance: buyIn.toString(),
            durationMinutes,
            durationType: `${duration}_hours`,
            startsAt: now,
            endsAt,
            status: 'active',
          })
          .returning();

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
