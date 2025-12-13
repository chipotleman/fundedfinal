import { getServerSession } from 'next-auth';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function isAdmin(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.email) {
    return false;
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (user.length === 0) {
    return false;
  }

  return user[0].role === 'admin';
}

export async function requireAdmin(req, res) {
  const isAdminUser = await isAdmin(req, res);
  
  if (!isAdminUser) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  
  return true;
}
