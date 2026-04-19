import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    await db
      .update(profiles)
      .set({ lastSeenAt: now })
      .where(eq(profiles.id, session.user.id));

    return res.status(200).json({ ok: true, lastSeenAt: now.toISOString() });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    return res.status(500).json({ error: 'Failed to update heartbeat' });
  }
}
