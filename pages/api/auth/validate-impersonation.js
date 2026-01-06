import { db } from '../../../lib/db';
import { fakeOpponents } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const IMPERSONATE_SECRET = process.env.NEXTAUTH_SECRET || 'impersonate-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, IMPERSONATE_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please try again from admin panel.' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { fakeOpponentId, userId } = decoded;

    if (!fakeOpponentId || !userId) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const [fakeOpponent] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.id, fakeOpponentId));

    if (!fakeOpponent) {
      return res.status(404).json({ error: 'Fake opponent not found' });
    }

    if (fakeOpponent.userId !== userId) {
      return res.status(401).json({ error: 'Token mismatch' });
    }

    if (!fakeOpponent.email || !fakeOpponent.hashedPassword) {
      return res.status(400).json({ error: 'Fake opponent has no credentials' });
    }

    const tempPassword = `impersonate_${fakeOpponentId}_${Date.now()}`;
    
    const bcrypt = require('bcryptjs');
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    
    const { users } = require('../../../shared/schema');
    await db
      .update(users)
      .set({ password: hashedTempPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db
      .update(fakeOpponents)
      .set({ hashedPassword: hashedTempPassword, updatedAt: new Date() })
      .where(eq(fakeOpponents.id, fakeOpponentId));

    return res.status(200).json({
      email: fakeOpponent.email,
      password: tempPassword,
    });
  } catch (error) {
    console.error('Validate impersonation error:', error);
    return res.status(500).json({ error: 'Failed to validate token' });
  }
}
