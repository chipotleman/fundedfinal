import { db } from '../../../lib/db';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(200).json({ available: false, reason: 'invalid_format' });
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    return res.status(200).json({ available: existing.length === 0 });
  } catch (error) {
    console.error('Check email error:', error);
    return res.status(500).json({ error: 'Failed to check email' });
  }
}
