import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { profiles, users, friendships } from '../../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

// Lightweight payload for the site-wide UserPreviewPopover. Returns the
// minimum fields the popover needs (avatar, username, W/L, online dot,
// bio snippet) plus the viewer's relationship to this user so the
// popover can render the right CTA (Add Friend / Friends / Pending /
// Accept Request / Self).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const viewerId = session.user.id;
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing id' });
  }

  try {
    const [profile] = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
        bio: profiles.bio,
        battleWins: profiles.battleWins,
        battleLosses: profiles.battleLosses,
        lastSeenAt: profiles.lastSeenAt,
      })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    let user = null;
    if (!profile) {
      const [u] = await db
        .select({ id: users.id, email: users.email, image: users.image })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      user = u || null;
      if (!user) return res.status(404).json({ error: 'User not found' });
    } else {
      const [u] = await db
        .select({ id: users.id, email: users.email, image: users.image })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      user = u || null;
    }

    let friendStatus = 'none'; // 'self' | 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends'
    if (viewerId === id) {
      friendStatus = 'self';
    } else {
      const rows = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.userId, viewerId), eq(friendships.friendId, id)),
            and(eq(friendships.userId, id), eq(friendships.friendId, viewerId)),
          ),
        )
        .limit(1);
      const f = rows[0];
      if (f) {
        if (f.status === 'accepted') friendStatus = 'friends';
        else if (f.status === 'pending') {
          friendStatus =
            f.userId === viewerId ? 'pending_outgoing' : 'pending_incoming';
        }
      }
    }

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const lastSeen = profile?.lastSeenAt ? new Date(profile.lastSeenAt) : null;
    const isOnline = lastSeen
      ? Date.now() - lastSeen.getTime() <= ONLINE_THRESHOLD_MS
      : false;
    const emailHandle = user?.email ? user.email.split('@')[0] : null;
    const wins = profile?.battleWins ?? 0;
    const losses = profile?.battleLosses ?? 0;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

    return res.status(200).json({
      user: {
        id,
        username: profile?.username || emailHandle || 'Player',
        avatar: profile?.avatar || user?.image || null,
        bio: profile?.bio || null,
        battleWins: wins,
        battleLosses: losses,
        winRate,
        isOnline,
        lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
        friendStatus,
        canMessage: friendStatus === 'friends',
      },
    });
  } catch (e) {
    console.error('user preview error', e);
    return res.status(500).json({ error: 'Failed to load user preview' });
  }
}
