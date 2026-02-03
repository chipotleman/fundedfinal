import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages } from '../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const unreadCount = await db
      .select({ count: sql`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, session.user.id),
          eq(messages.read, false)
        )
      );

    return res.status(200).json({ unreadCount: parseInt(unreadCount[0]?.count || 0) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}
