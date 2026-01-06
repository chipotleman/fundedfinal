import { db } from './db';
import { adminUsers, adminStaff } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || req.cookies?.adminToken;

  if (!token) {
    return { valid: false, error: 'No authorization token provided' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    if (decoded.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    if (decoded.type === 'admin' || !decoded.type) {
      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, decoded.id))
        .limit(1);

      if (admin) {
        return {
          valid: true,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            type: 'admin',
          },
        };
      }
    }

    if (decoded.type === 'staff') {
      const [staff] = await db
        .select()
        .from(adminStaff)
        .where(eq(adminStaff.id, decoded.id))
        .limit(1);

      if (staff && staff.isActive) {
        const staffPermissions = Array.isArray(staff.permissions) ? staff.permissions : [];
        return {
          valid: true,
          admin: {
            id: staff.id,
            email: staff.email,
            name: staff.name,
            type: 'staff',
            role: staff.role,
            permissions: staffPermissions,
          },
        };
      }
    }

    return { valid: false, error: 'User not found' };
  } catch (error) {
    return { valid: false, error: 'Invalid token' };
  }
}

export function requireAdmin(handler) {
  return async (req, res) => {
    const auth = await verifyAdminAuth(req);
    
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error || 'Unauthorized' });
    }

    req.admin = auth.admin;
    return handler(req, res);
  };
}
