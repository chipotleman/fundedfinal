import { db } from '../../../lib/db';
import { fakeOpponents, users, profiles, matchups } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  console.log('[Validate Impersonation] Received request');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const IMPERSONATE_SECRET = process.env.NEXTAUTH_SECRET;
  console.log('[Validate Impersonation] NEXTAUTH_SECRET exists:', !!IMPERSONATE_SECRET);

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
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    
    console.log('[Validate Impersonation] Updating user password for userId:', userId);
    await db
      .update(users)
      .set({ password: hashedTempPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db
      .update(fakeOpponents)
      .set({ hashedPassword: hashedTempPassword, updatedAt: new Date() })
      .where(eq(fakeOpponents.id, fakeOpponentId));

    // Get ALL active/matched matchups for this fake opponent to sync profile data
    // Calculate total balance across all battles (includes active and matched statuses)
    const allActiveMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        or(
          eq(matchups.fakeOpponentId, fakeOpponentId),
          eq(matchups.user2Id, fakeOpponentId)
        ),
        inArray(matchups.status, ['active', 'matched'])
      ));

    console.log('[Validate Impersonation] Found', allActiveMatchups.length, 'active matchups for fake opponent');

    if (allActiveMatchups.length > 0) {
      // Calculate total balance across all active matchups
      // The fake opponent is always user2, so use user2Balance
      // Use the actual balance from the matchup, which reflects current state after bets
      let totalBalance = 0;
      for (const m of allActiveMatchups) {
        // user2Balance is the fake opponent's current balance in this matchup
        // It starts at startingBalance and changes as bets are placed
        const balance = parseFloat(m.user2Balance || m.startingBalance || '0');
        totalBalance += balance;
        console.log('[Validate Impersonation] Matchup', m.id, '- user2Balance:', balance, 'starting:', m.startingBalance, 'pot:', m.potSize);
      }

      // Update the profile to be active with aggregated balance
      await db
        .update(profiles)
        .set({
          status: 'active',
          bankroll: totalBalance.toString(),
          challenge: { type: 'battle', phase: 1 },
          challengePhase: 1,
          updatedAt: new Date()
        })
        .where(eq(profiles.id, userId));

      console.log('[Validate Impersonation] Profile synced - status: active, total bankroll:', totalBalance, 'from', allActiveMatchups.length, 'battles');
    } else {
      // No active matchups - set profile to active with zero balance
      await db
        .update(profiles)
        .set({
          status: 'active',
          bankroll: '0',
          updatedAt: new Date()
        })
        .where(eq(profiles.id, userId));
      console.log('[Validate Impersonation] Profile set to active (no active matchups)');
    }

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
