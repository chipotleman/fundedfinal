import { db } from '../../../lib/db';
import { fakeOpponents } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const IMPERSONATE_SECRET = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!IMPERSONATE_SECRET) {
    console.error('[Validate Impersonation] NEXTAUTH_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error - missing secret' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      console.error('[Validate Impersonation] No token provided');
      return res.status(400).json({ error: 'Token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, IMPERSONATE_SECRET);
      console.log('[Validate Impersonation] Token decoded successfully:', { fakeOpponentId: decoded.fakeOpponentId, userId: decoded.userId });
    } catch (err) {
      console.error('[Validate Impersonation] JWT verify error:', err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please try again from admin panel.' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { fakeOpponentId, userId } = decoded;

    if (!fakeOpponentId || !userId) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    console.log('[Validate Impersonation] Looking up fake opponent:', fakeOpponentId);
    const [fakeOpponent] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.id, fakeOpponentId));

    if (!fakeOpponent) {
      console.error('[Validate Impersonation] Fake opponent not found:', fakeOpponentId);
      return res.status(404).json({ error: 'Fake opponent not found' });
    }

    console.log('[Validate Impersonation] Found fake opponent:', { 
      id: fakeOpponent.id, 
      userId: fakeOpponent.userId, 
      email: fakeOpponent.email,
      hasCredentials: !!fakeOpponent.hashedPassword 
    });

    if (fakeOpponent.userId !== userId) {
      console.error('[Validate Impersonation] Token mismatch - expected:', fakeOpponent.userId, 'got:', userId);
      return res.status(401).json({ error: 'Token mismatch' });
    }

    if (!fakeOpponent.email || !fakeOpponent.hashedPassword) {
      console.error('[Validate Impersonation] No credentials for fake opponent');
      return res.status(400).json({ error: 'Fake opponent has no credentials' });
    }

    const tempPassword = `impersonate_${fakeOpponentId}_${Date.now()}`;
    
    const bcrypt = require('bcryptjs');
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    
    console.log('[Validate Impersonation] Updating user password for userId:', userId);
    const { users } = require('../../../shared/schema');
    await db
      .update(users)
      .set({ password: hashedTempPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db
      .update(fakeOpponents)
      .set({ hashedPassword: hashedTempPassword, updatedAt: new Date() })
      .where(eq(fakeOpponents.id, fakeOpponentId));

    console.log('[Validate Impersonation] Success - returning credentials for:', fakeOpponent.email);
    return res.status(200).json({
      email: fakeOpponent.email,
      password: tempPassword,
    });
  } catch (error) {
    console.error('[Validate Impersonation] Error:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to validate token' });
  }
}
