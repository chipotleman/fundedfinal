import { db } from '../../../../lib/db';
import { battleInvites, profiles } from '../../../../shared/schema';
import { eq, desc, or, and } from 'drizzle-orm';
import { requireAdmin } from '../../../../lib/adminAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allInvites = await db
        .select()
        .from(battleInvites)
        .orderBy(desc(battleInvites.createdAt))
        .limit(200);

      const userIds = [...new Set(
        allInvites.flatMap(i => [i.senderId, i.receiverId]).filter(Boolean)
      )];

      let userProfiles = [];
      if (userIds.length > 0) {
        userProfiles = await db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
          })
          .from(profiles)
          .where(or(...userIds.map(id => eq(profiles.id, id))));
      }

      const enriched = allInvites.map(invite => ({
        ...invite,
        sender: userProfiles.find(p => p.id === invite.senderId) || { id: invite.senderId, username: 'Unknown' },
        receiver: userProfiles.find(p => p.id === invite.receiverId) || { id: invite.receiverId, username: 'Unknown' },
      }));

      return res.status(200).json(enriched);
    } catch (error) {
      console.error('Get admin invites error:', error);
      return res.status(500).json({ error: 'Failed to fetch invites' });
    }
  }

  if (req.method === 'PATCH') {
    const { id, action } = req.body;
    if (!id || !['cancel', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      if (action === 'cancel') {
        const result = await db
          .update(battleInvites)
          .set({ status: 'cancelled', respondedAt: new Date() })
          .where(and(eq(battleInvites.id, id), eq(battleInvites.status, 'pending')))
          .returning();
        if (result.length === 0) {
          return res.status(400).json({ error: 'Invite is not pending or not found' });
        }
        return res.status(200).json({ message: 'Invite cancelled' });
      }

      if (action === 'delete') {
        await db
          .delete(battleInvites)
          .where(eq(battleInvites.id, id));
        return res.status(200).json({ message: 'Invite deleted' });
      }
    } catch (error) {
      console.error('Admin invite action error:', error);
      return res.status(500).json({ error: 'Failed to update invite' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
