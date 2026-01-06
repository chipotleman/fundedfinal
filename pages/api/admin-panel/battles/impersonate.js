import { db } from '../../../../lib/db';
import { fakeOpponents, matchups } from '../../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const IMPERSONATE_SECRET = process.env.NEXTAUTH_SECRET || 'impersonate-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fakeOpponentId, matchupId } = req.body;

    if (!fakeOpponentId) {
      return res.status(400).json({ error: 'Fake opponent ID required' });
    }

    const [fakeOpponent] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.id, fakeOpponentId));

    if (!fakeOpponent) {
      return res.status(404).json({ error: 'Fake opponent not found' });
    }

    if (!fakeOpponent.userId) {
      return res.status(400).json({ error: 'Fake opponent has no login credentials. Please update their credentials first.' });
    }

    if (matchupId) {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(eq(matchups.id, matchupId));

      if (!matchup) {
        return res.status(404).json({ error: 'Matchup not found' });
      }

      if (matchup.status !== 'active') {
        return res.status(400).json({ error: 'Battle is not active' });
      }
    }

    await db
      .update(fakeOpponents)
      .set({
        lastImpersonatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fakeOpponents.id, fakeOpponentId));

    const token = jwt.sign(
      {
        fakeOpponentId,
        userId: fakeOpponent.userId,
        matchupId: matchupId || null,
        exp: Math.floor(Date.now() / 1000) + (5 * 60),
      },
      IMPERSONATE_SECRET
    );

    return res.status(200).json({
      token,
      loginUrl: `/fake-login?token=${token}`,
    });
  } catch (error) {
    console.error('Impersonate error:', error);
    return res.status(500).json({ error: 'Failed to generate impersonation token' });
  }
}
