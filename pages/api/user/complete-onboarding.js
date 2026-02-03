import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { username, sportPreferences, bettingStyle, experienceLevel } = req.body;

  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!sportPreferences?.length) {
    return res.status(400).json({ error: 'Please select at least one sport' });
  }

  if (!bettingStyle) {
    return res.status(400).json({ error: 'Betting style is required' });
  }

  if (!experienceLevel) {
    return res.status(400).json({ error: 'Experience level is required' });
  }

  try {
    const existingUsername = await db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username.trim()))
      .limit(1);

    if (existingUsername.length > 0 && existingUsername[0].id !== session.user.id) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    await db
      .update(profiles)
      .set({
        username: username.trim(),
        sportPreferences: sportPreferences,
        bettingStyle: bettingStyle,
        experienceLevel: experienceLevel,
        onboardingCompleted: true,
        bankroll: '1000',
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, session.user.id));

    return res.status(200).json({ 
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
