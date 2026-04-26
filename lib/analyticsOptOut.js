import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { db } from './db';
import { profiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function isAuthenticatedUserAnalyticsOptedOut(req, res) {
  let userId = null;
  try {
    const session = await getServerSession(req, res, authOptions);
    userId = session?.user?.id || null;
  } catch (err) {
    console.error('[analyticsOptOut] failed to resolve session:', err);
    return false;
  }

  if (!userId) return false;

  try {
    const [profile] = await db
      .select({ privacyPrefs: profiles.privacyPrefs })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    return profile?.privacyPrefs?.analyticsOptOut === true;
  } catch (err) {
    console.error('[analyticsOptOut] failed to load profile, failing closed:', err);
    return true;
  }
}
