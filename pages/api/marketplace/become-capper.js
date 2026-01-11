import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { cappers, userChallenges } from '../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const existingCapper = await db.select().from(cappers)
        .where(eq(cappers.userId, session.user.id))
        .limit(1);

      if (existingCapper.length > 0) {
        return res.status(200).json({ 
          status: 'already_capper',
          capper: existingCapper[0]
        });
      }

      const completedChallenges = await db.select().from(userChallenges)
        .where(and(
          eq(userChallenges.userId, session.user.id),
          or(
            eq(userChallenges.status, 'completed'),
            eq(userChallenges.status, 'reward')
          )
        ))
        .limit(1);

      const isEligible = completedChallenges.length > 0;

      return res.status(200).json({
        status: 'not_capper',
        isEligible,
        completedChallenge: completedChallenges[0] || null
      });
    } catch (error) {
      console.error('Failed to check capper eligibility:', error);
      return res.status(500).json({ error: 'Failed to check eligibility' });
    }
  }

  if (req.method === 'POST') {
    try {
      const existingCapper = await db.select().from(cappers)
        .where(eq(cappers.userId, session.user.id))
        .limit(1);

      if (existingCapper.length > 0) {
        return res.status(400).json({ error: 'Already registered as capper' });
      }

      const completedChallenges = await db.select().from(userChallenges)
        .where(and(
          eq(userChallenges.userId, session.user.id),
          or(
            eq(userChallenges.status, 'completed'),
            eq(userChallenges.status, 'reward')
          )
        ))
        .limit(1);

      if (completedChallenges.length === 0) {
        return res.status(403).json({ 
          error: 'Must complete a funded challenge to become a capper',
          requiresChallenge: true
        });
      }

      const { displayName, bio, specialties } = req.body;

      if (!displayName || displayName.length < 3) {
        return res.status(400).json({ error: 'Display name must be at least 3 characters' });
      }

      const slug = displayName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const existingSlug = await db.select().from(cappers)
        .where(eq(cappers.slug, slug))
        .limit(1);

      const finalSlug = existingSlug.length > 0 
        ? `${slug}-${Date.now().toString(36)}`
        : slug;

      const newCapper = await db.insert(cappers).values({
        userId: session.user.id,
        displayName,
        slug: finalSlug,
        bio: bio || '',
        specialties: specialties || [],
        isActive: true,
        isVerified: true,
        verifiedAt: new Date(),
      }).returning();

      return res.status(201).json({ 
        success: true, 
        capper: newCapper[0]
      });
    } catch (error) {
      console.error('Failed to create capper:', error);
      return res.status(500).json({ error: 'Failed to create capper profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
