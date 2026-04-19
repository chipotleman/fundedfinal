import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { pushSubscriptions } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';

const CATS = ['catInvites', 'catInviteOutcome', 'catForfeits', 'catResults', 'catFriendsLive', 'catRematch'];

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    return res.status(200).json({
      devices: rows.map(r => ({
        id: r.id,
        endpoint: r.endpoint,
        deviceLabel: r.deviceLabel,
        enabled: r.enabled,
        catInvites: r.catInvites,
        catInviteOutcome: r.catInviteOutcome,
        catForfeits: r.catForfeits,
        catResults: r.catResults,
        catFriendsLive: r.catFriendsLive,
        catRematch: r.catRematch,
        createdAt: r.createdAt,
        lastSeen: r.lastSeen,
      })),
    });
  }

  if (req.method === 'PATCH') {
    const { endpoint, deviceId, ...rest } = req.body || {};
    const updates = {};
    for (const k of CATS) {
      if (typeof rest[k] === 'boolean') updates[k] = rest[k];
    }
    if (typeof rest.enabled === 'boolean') updates.enabled = rest.enabled;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates' });
    }

    try {
      let where;
      if (deviceId) where = and(eq(pushSubscriptions.id, deviceId), eq(pushSubscriptions.userId, userId));
      else if (endpoint) where = and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId));
      else where = eq(pushSubscriptions.userId, userId); // all devices

      const updated = await db.update(pushSubscriptions).set(updates).where(where).returning();
      return res.status(200).json({ updated: updated.length });
    } catch (e) {
      console.error('[push/preferences PATCH]', e);
      return res.status(500).json({ error: 'Failed to update preferences' });
    }
  }

  if (req.method === 'DELETE') {
    const { deviceId, endpoint } = req.body || {};
    if (!deviceId && !endpoint) return res.status(400).json({ error: 'deviceId or endpoint required' });
    try {
      const where = deviceId
        ? and(eq(pushSubscriptions.id, deviceId), eq(pushSubscriptions.userId, userId))
        : and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId));
      await db.delete(pushSubscriptions).where(where);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('[push/preferences DELETE]', e);
      return res.status(500).json({ error: 'Failed to delete device' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
