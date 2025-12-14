import { db } from '../../../lib/db';
import { users, profiles, userChallenges } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      const usersWithDetails = await Promise.all(
        allUsers.map(async (user) => {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1);

          const challenges = await db
            .select()
            .from(userChallenges)
            .where(eq(userChallenges.userId, user.id));

          return {
            ...user,
            profile: profile || null,
            challenges: challenges || [],
          };
        })
      );

      return res.status(200).json({ users: usersWithDetails });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
