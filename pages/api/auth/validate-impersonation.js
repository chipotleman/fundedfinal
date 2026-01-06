import { db } from '../../../lib/db';
import { fakeOpponents, users, profiles, matchups } from '../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';
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

    // Get the active matchup for this fake opponent to sync profile data
    const matchupId = decoded.matchupId;
    if (matchupId) {
      console.log('[Validate Impersonation] Syncing profile data from matchup:', matchupId);
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(eq(matchups.id, matchupId));

      if (matchup) {
        // Determine the fake opponent's bankroll from the matchup
        const challengeBankrolls = {
          starter: 5000,
          pro: 10000,
          elite: 25000
        };
        const bankroll = challengeBankrolls[matchup.challengeType] || 5000;

        // Update the profile to be active with correct challenge data
        await db
          .update(profiles)
          .set({
            status: 'active',
            bankroll: bankroll.toString(),
            challenge: { type: matchup.challengeType, phase: 1 },
            challengePhase: 1,
            updatedAt: new Date()
          })
          .where(eq(profiles.id, userId));

        console.log('[Validate Impersonation] Profile synced - status: active, bankroll:', bankroll);
      }
    } else {
      // No matchup - just set profile to active
      await db
        .update(profiles)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(profiles.id, userId));
      console.log('[Validate Impersonation] Profile set to active (no matchup)');
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
