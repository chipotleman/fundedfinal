import { db } from '../../../../lib/db';
import { fakeOpponents } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const opponents = await db.select().from(fakeOpponents).orderBy(fakeOpponents.createdAt);
      return res.status(200).json(opponents);
    } catch (error) {
      console.error('Get fake opponents error:', error);
      return res.status(500).json({ error: 'Failed to fetch fake opponents' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { username, displayName, avatar, bio, winRate, totalBattles } = req.body;

      if (!username || !displayName) {
        return res.status(400).json({ error: 'Username and display name required' });
      }

      const [newOpponent] = await db.insert(fakeOpponents).values({
        username,
        displayName,
        avatar: avatar || null,
        bio: bio || null,
        winRate: winRate?.toString() || '52.5',
        totalBattles: totalBattles || Math.floor(Math.random() * 50) + 10,
        isActive: true,
      }).returning();

      return res.status(201).json(newOpponent);
    } catch (error) {
      console.error('Create fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to create fake opponent' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, username, displayName, avatar, bio, winRate, totalBattles, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (bio !== undefined) updateData.bio = bio;
      if (winRate !== undefined) updateData.winRate = winRate.toString();
      if (totalBattles !== undefined) updateData.totalBattles = totalBattles;
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(fakeOpponents)
        .set(updateData)
        .where(eq(fakeOpponents.id, id))
        .returning();

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to update fake opponent' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      await db.delete(fakeOpponents).where(eq(fakeOpponents.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Delete fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to delete fake opponent' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
