import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { pushSubscriptions } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';

function detectDeviceLabel(ua) {
  if (!ua) return 'Browser';
  const u = ua.toLowerCase();
  let os = 'Browser';
  if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('mac os')) os = 'macOS';
  else if (u.includes('windows')) os = 'Windows';
  else if (u.includes('linux')) os = 'Linux';
  let browser = '';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome/')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/')) browser = 'Safari';
  return browser ? `${browser} on ${os}` : os;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'POST') {
    const { subscription, deviceLabel } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const ua = req.headers['user-agent'] || '';
    const label = (deviceLabel && String(deviceLabel).slice(0, 200)) || detectDeviceLabel(ua);

    try {
      // Upsert by endpoint - re-claim it for this user if it already exists.
      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .limit(1);

      const now = new Date();
      if (existing.length > 0) {
        const [updated] = await db
          .update(pushSubscriptions)
          .set({
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            deviceLabel: label,
            userAgent: ua,
            enabled: true,
            lastSeen: now,
          })
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
          .returning();
        return res.status(200).json({ subscription: updated });
      }

      const [created] = await db.insert(pushSubscriptions).values({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceLabel: label,
        userAgent: ua,
      }).returning();
      return res.status(201).json({ subscription: created });
    } catch (e) {
      console.error('[push/subscribe]', e);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    try {
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('[push/subscribe DELETE]', e);
      return res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
