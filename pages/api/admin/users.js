import { db } from '../../../lib/db';
import { users, userChallenges } from '../../../shared/schema';
import { eq, ilike, desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users);

      if (search) {
        query = query.where(ilike(users.email, `%${search}%`));
      }

      const allUsers = await query
        .orderBy(desc(users.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(users);
      const totalCount = parseInt(countResult[0].count);

      return res.status(200).json({
        users: allUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
