import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  hashAvatarSource,
  isGeneratableAvatar,
  generateCharacter,
} from '../../../lib/aiCharacter';

// AI battle-character endpoint.
//
// GET  -> report the cached character state for the signed-in user.
// POST -> (re)generate the character from the current profile photo if it's
//         missing or stale, then return the result. Idempotent: a fresh
//         character whose source hash still matches is returned without
//         re-calling the image model.
//
// Response shape (both verbs):
//   { status: 'ready' | 'pending' | 'failed' | 'none', url: string | null }
// 'none' means there's no real profile photo to base a character on, so the
// client should show the generic default character.

const PENDING_GRACE_MS = 90_000; // don't re-trigger a generation already in flight

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userId = session.user.id;

  let rows;
  try {
    rows = await db
      .select({
        avatar: profiles.avatar,
        aiCharacterUrl: profiles.aiCharacterUrl,
        aiCharacterStatus: profiles.aiCharacterStatus,
        aiCharacterSourceHash: profiles.aiCharacterSourceHash,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
  } catch (err) {
    console.error('[profile/character] load failed:', err);
    return res.status(500).json({ error: 'Failed to load character' });
  }

  const profile = rows?.[0];
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const avatar = profile.avatar;
  const canGenerate = isGeneratableAvatar(avatar);
  const currentHash = canGenerate ? hashAvatarSource(avatar) : null;
  const isFresh =
    profile.aiCharacterStatus === 'ready' &&
    profile.aiCharacterUrl &&
    profile.aiCharacterSourceHash === currentHash;

  if (req.method === 'GET') {
    if (!canGenerate) return res.status(200).json({ status: 'none', url: null });
    if (isFresh) return res.status(200).json({ status: 'ready', url: profile.aiCharacterUrl });
    return res.status(200).json({ status: profile.aiCharacterStatus || 'idle', url: null });
  }

  if (req.method === 'POST') {
    if (!canGenerate) return res.status(200).json({ status: 'none', url: null });
    if (isFresh) return res.status(200).json({ status: 'ready', url: profile.aiCharacterUrl });

    // A generation already in flight for this same source — don't pile on.
    const updatedAtMs = profile.updatedAt ? new Date(profile.updatedAt).getTime() : 0;
    if (
      profile.aiCharacterStatus === 'pending' &&
      profile.aiCharacterSourceHash === currentHash &&
      Date.now() - updatedAtMs < PENDING_GRACE_MS
    ) {
      return res.status(200).json({ status: 'pending', url: null });
    }

    try {
      await db
        .update(profiles)
        .set({ aiCharacterStatus: 'pending', aiCharacterSourceHash: currentHash, updatedAt: new Date() })
        .where(eq(profiles.id, userId));
    } catch (err) {
      console.error('[profile/character] mark pending failed:', err);
    }

    try {
      const url = await generateCharacter(userId, avatar);
      await db
        .update(profiles)
        .set({
          aiCharacterUrl: url,
          aiCharacterStatus: 'ready',
          aiCharacterSourceHash: currentHash,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, userId));
      return res.status(200).json({ status: 'ready', url });
    } catch (err) {
      console.error('[profile/character] generation failed:', err);
      try {
        await db
          .update(profiles)
          .set({ aiCharacterStatus: 'failed', updatedAt: new Date() })
          .where(eq(profiles.id, userId));
      } catch (e) {
        console.error('[profile/character] mark failed errored:', e);
      }
      return res.status(200).json({ status: 'failed', url: null });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
