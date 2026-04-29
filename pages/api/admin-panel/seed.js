import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { adminUsers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Bootstrap endpoint to create or rotate the password for the seeded admin
// account. Disabled in production. Requires ADMIN_SETUP_SECRET env var.
// Body: { secretKey, email, password }
//   - email defaults to "admin@piks.com" for backwards-compat
//   - if the admin row already exists, the password is rotated (no longer
//     silently a no-op)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(410).json({
      error:
        'Admin seed endpoint is disabled in production. Use scripts/rotate-admin-password.js to rotate passwords.',
    });
  }

  const expectedSecret = process.env.ADMIN_SETUP_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({
      error:
        'ADMIN_SETUP_SECRET is not configured. Set it in your environment before using this endpoint.',
    });
  }

  const { secretKey, email, password, name } = req.body || {};

  if (!secretKey || secretKey !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetEmail = (email || 'admin@piks.com').toLowerCase();

  if (!password || typeof password !== 'string' || password.length < 12) {
    return res
      .status(400)
      .json({ error: 'A password of at least 12 characters is required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, targetEmail))
      .limit(1);

    if (existing) {
      await db
        .update(adminUsers)
        .set({ password: hashedPassword })
        .where(eq(adminUsers.id, existing.id));
      return res
        .status(200)
        .json({ message: 'Admin password rotated', email: targetEmail });
    }

    await db.insert(adminUsers).values({
      email: targetEmail,
      password: hashedPassword,
      name: name || 'Piks Admin',
    });

    return res
      .status(201)
      .json({ message: 'Admin account created', email: targetEmail });
  } catch (error) {
    console.error('Error seeding admin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
