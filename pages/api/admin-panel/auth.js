import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { adminUsers, adminStaff } from '../../../shared/schema';
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

      // First check admin_users table
      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.toLowerCase()))
        .limit(1);

      if (admin) {
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
            type: 'admin',
          },
          token: Buffer.from(JSON.stringify({
            id: admin.id,
            email: admin.email,
            type: 'admin',
            exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
          })).toString('base64'),
        });
      }

      // If not found in admin_users, check admin_staff table
      const [staff] = await db
        .select()
        .from(adminStaff)
        .where(eq(adminStaff.email, email.toLowerCase()))
        .limit(1);

      if (!staff) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!staff.isActive) {
        return res.status(401).json({ error: 'Account is disabled' });
      }

      const isValidPassword = await bcrypt.compare(password, staff.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await db
        .update(adminStaff)
        .set({ lastLogin: new Date() })
        .where(eq(adminStaff.id, staff.id));

      return res.status(200).json({
        success: true,
        admin: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          type: 'staff',
          role: staff.role,
        },
        token: Buffer.from(JSON.stringify({
          id: staff.id,
          email: staff.email,
          type: 'staff',
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

        // Check admin_users first
        if (decoded.type === 'admin' || !decoded.type) {
          const [admin] = await db
            .select()
            .from(adminUsers)
            .where(eq(adminUsers.id, decoded.id))
            .limit(1);

          if (admin) {
            return res.status(200).json({
              valid: true,
              admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                type: 'admin',
              },
            });
          }
        }

        // Check admin_staff
        if (decoded.type === 'staff' || !decoded.type) {
          const [staff] = await db
            .select()
            .from(adminStaff)
            .where(eq(adminStaff.id, decoded.id))
            .limit(1);

          if (staff && staff.isActive) {
            return res.status(200).json({
              valid: true,
              admin: {
                id: staff.id,
                email: staff.email,
                name: staff.name,
                type: 'staff',
                role: staff.role,
              },
            });
          }
        }

        return res.status(401).json({ error: 'User not found' });
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
