import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { adminUsers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password } = req.body;

  try {
    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.toLowerCase()))
        .limit(1);

      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await db
        .update(adminUsers)
        .set({ lastLogin: new Date() })
        .where(eq(adminUsers.id, admin.id));

      return res.status(200).json({
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        },
        token: Buffer.from(JSON.stringify({
          id: admin.id,
          email: admin.email,
          exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
        })).toString('base64'),
      });
    }

    if (action === 'verify') {
      const { token } = req.body;
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (decoded.exp < Date.now()) {
          return res.status(401).json({ error: 'Token expired' });
        }

        const [admin] = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.id, decoded.id))
          .limit(1);

        if (!admin) {
          return res.status(401).json({ error: 'Admin not found' });
        }

        return res.status(200).json({
          valid: true,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
          },
        });
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
