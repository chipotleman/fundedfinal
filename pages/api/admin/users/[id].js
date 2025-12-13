import { db } from '../../../../lib/db';
import { users, userChallenges, profiles } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../../../../lib/adminAuth';

export default async function handler(req, res) {
  if (!await requireAdmin(req, res)) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const user = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const challenges = await db
        .select()
        .from(userChallenges)
        .where(eq(userChallenges.userId, id));

      const profile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, id))
        .limit(1);

      return res.status(200).json({
        ...user[0],
        challenges,
        profile: profile[0] || null
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { email, role } = req.body;

      const updateData = { updatedAt: new Date() };
      if (email) updateData.email = email;
      if (role && ['user', 'admin'].includes(role)) updateData.role = role;

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db.delete(userChallenges).where(eq(userChallenges.userId, id));
      await db.delete(profiles).where(eq(profiles.id, id));
      await db.delete(users).where(eq(users.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
