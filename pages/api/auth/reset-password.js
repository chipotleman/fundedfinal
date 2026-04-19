import crypto from 'crypto';
import { db } from '../../../lib/db';
import { users, passwordResets } from '../../../shared/schema';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { hashPassword } from '../../../lib/auth/service';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) return res.status(400).json({ valid: false, error: 'Missing token' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      const [row] = await db
        .select({ id: passwordResets.id })
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, tokenHash),
            isNull(passwordResets.consumedAt),
            gt(passwordResets.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!row) return res.status(400).json({ valid: false, error: 'This reset link is invalid or has expired.' });
      return res.status(200).json({ valid: true });
    } catch (err) {
      console.error('[reset-password GET]', err);
      return res.status(500).json({ valid: false, error: 'Could not verify link.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing reset token' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const hashed = await hashPassword(password);
    const now = new Date();

    // Atomically claim the token: only succeeds if it exists, hasn't been
    // consumed, and hasn't expired. This prevents two concurrent submissions
    // from both succeeding with the same link.
    const claimed = await db
      .update(passwordResets)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          isNull(passwordResets.consumedAt),
          gt(passwordResets.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResets.userId });

    if (claimed.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    await db
      .update(users)
      .set({ password: hashed, updatedAt: now })
      .where(eq(users.id, claimed[0].userId));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[reset-password POST]', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
