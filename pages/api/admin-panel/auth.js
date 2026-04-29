import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { adminUsers, adminStaff } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { signAdminToken, verifyAdminAuth } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password } = req.body || {};

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

        const token = signAdminToken({ id: admin.id, type: 'admin', email: admin.email });

        return res.status(200).json({
          success: true,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            type: 'admin',
          },
          token,
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

      const staffPermissions = Array.isArray(staff.permissions) ? staff.permissions : [];
      const token = signAdminToken({ id: staff.id, type: 'staff', email: staff.email });

      return res.status(200).json({
        success: true,
        admin: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          type: 'staff',
          role: staff.role,
          permissions: staffPermissions,
        },
        token,
      });
    }

    if (action === 'verify') {
      const { token } = req.body || {};
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      // Re-use the central verifier so token format and trust rules stay in sync.
      const proxyReq = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
      const result = await verifyAdminAuth(proxyReq);
      if (!result.valid) {
        return res.status(401).json({ error: result.error || 'Invalid token' });
      }
      return res.status(200).json({ valid: true, admin: result.admin });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
