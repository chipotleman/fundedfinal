import jwt from 'jsonwebtoken';
import { db } from './db';
import { adminUsers, adminStaff } from '../shared/schema';
import { eq } from 'drizzle-orm';

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = 'piks-admin';

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'ADMIN_JWT_SECRET (or NEXTAUTH_SECRET) must be set to sign admin tokens'
    );
  }
  return secret;
}

export function signAdminToken(payload) {
  const { id, type, email } = payload;
  if (!id || !type) {
    throw new Error('signAdminToken requires id and type');
  }
  return jwt.sign(
    { sub: String(id), type, email: email || null },
    getSecret(),
    { issuer: ISSUER, expiresIn: TOKEN_TTL_SECONDS }
  );
}

function decodeBearer(req) {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.adminToken) {
    return req.cookies.adminToken;
  }
  return null;
}

export async function verifyAdminAuth(req) {
  const token = decodeBearer(req);
  if (!token) {
    return { valid: false, error: 'No authorization token provided' };
  }

  let claims;
  try {
    claims = jwt.verify(token, getSecret(), { issuer: ISSUER });
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: false, error: 'Invalid token' };
  }

  const id = claims.sub;
  const type = claims.type;

  if (!id || !type) {
    return { valid: false, error: 'Invalid token payload' };
  }

  if (type === 'admin') {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    if (!admin) {
      return { valid: false, error: 'Admin no longer exists' };
    }
    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        type: 'admin',
        role: 'admin',
        permissions: ['all'],
      },
    };
  }

  if (type === 'staff') {
    const [staff] = await db
      .select()
      .from(adminStaff)
      .where(eq(adminStaff.id, id))
      .limit(1);
    if (!staff) {
      return { valid: false, error: 'Staff account no longer exists' };
    }
    if (!staff.isActive) {
      return { valid: false, error: 'Staff account disabled' };
    }
    const permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
    return {
      valid: true,
      admin: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        type: 'staff',
        role: staff.role,
        permissions,
      },
    };
  }

  return { valid: false, error: 'Unknown principal type' };
}

function staffHasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.type === 'admin') return true;
  if (admin.role === 'admin') return true;
  const perms = admin.permissions || [];
  if (perms.includes('all')) return true;
  if (!permission) return true;
  if (perms.includes(permission)) return true;
  if (perms.some((p) => typeof p === 'string' && p.startsWith(permission + ':'))) {
    return true;
  }
  return false;
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

export function requireAdminPermission(permission) {
  return (handler) => async (req, res) => {
    const auth = await verifyAdminAuth(req);
    if (!auth.valid) {
      return res.status(401).json({ error: auth.error || 'Unauthorized' });
    }
    if (!staffHasPermission(auth.admin, permission)) {
      return res.status(403).json({ error: 'Forbidden: missing permission' });
    }
    req.admin = auth.admin;
    return handler(req, res);
  };
}
