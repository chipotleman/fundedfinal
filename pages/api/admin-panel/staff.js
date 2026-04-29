import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../lib/adminAuth';

const sql = neon(process.env.DATABASE_URL);

function hasPermission(admin, requiredPermission) {
  if (!admin) return false;
  if (admin.type === 'admin') return true;
  if (admin.role === 'admin') return true;
  const perms = admin.permissions || [];
  if (perms.includes('all')) return true;
  return perms.includes(requiredPermission);
}

async function handler(req, res) {
  const auth = req.admin;

  if (req.method === 'GET') {
    if (!hasPermission(auth, 'staff:read')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const staff = await sql`
        SELECT id, email, name, role, permissions, is_active, created_at, last_login
        FROM admin_staff
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ staff });
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      return res.status(500).json({ error: 'Failed to fetch staff' });
    }
  }

  if (req.method === 'POST') {
    if (!hasPermission(auth, 'staff:write')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { email, password, name, role, permissions } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const existing = await sql`SELECT id FROM admin_staff WHERE email = ${email}`;
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [newStaff] = await sql`
        INSERT INTO admin_staff (email, password, name, role, permissions)
        VALUES (${email}, ${hashedPassword}, ${name || null}, ${role || 'staff'}, ${JSON.stringify(permissions || [])})
        RETURNING id, email, name, role, permissions, is_active, created_at
      `;

      return res.status(201).json({ staff: newStaff });
    } catch (error) {
      console.error('Failed to create staff:', error);
      return res.status(500).json({ error: 'Failed to create staff member' });
    }
  }

  if (req.method === 'PUT') {
    if (!hasPermission(auth, 'staff:write')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id, name, role, permissions, isActive, password } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }

    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await sql`
          UPDATE admin_staff
          SET name = COALESCE(${name}, name),
              role = COALESCE(${role}, role),
              permissions = COALESCE(${JSON.stringify(permissions)}, permissions),
              is_active = COALESCE(${isActive}, is_active),
              password = ${hashedPassword}
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE admin_staff
          SET name = COALESCE(${name}, name),
              role = COALESCE(${role}, role),
              permissions = COALESCE(${permissions ? JSON.stringify(permissions) : null}, permissions),
              is_active = COALESCE(${isActive}, is_active)
          WHERE id = ${id}
        `;
      }

      const [updated] = await sql`
        SELECT id, email, name, role, permissions, is_active, created_at, last_login
        FROM admin_staff WHERE id = ${id}
      `;

      return res.status(200).json({ staff: updated });
    } catch (error) {
      console.error('Failed to update staff:', error);
      return res.status(500).json({ error: 'Failed to update staff member' });
    }
  }

  if (req.method === 'DELETE') {
    if (!hasPermission(auth, 'staff:write')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }

    try {
      await sql`DELETE FROM admin_staff WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete staff:', error);
      return res.status(500).json({ error: 'Failed to delete staff member' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
