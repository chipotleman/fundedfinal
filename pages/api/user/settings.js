import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles, users } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';

const ALLOWED_ODDS_FORMATS = ['american', 'decimal'];
const ALLOWED_NOTIF_KEYS = ['betResults', 'challengeUpdates', 'promotions', 'weeklyReports'];
const ALLOWED_PRIVACY_KEYS = ['profileVisible', 'showStats', 'showInLeaderboard', 'analyticsOptOut'];
const ALLOWED_NOTIF_FILTERS = ['all', 'invite', 'rematch', 'result', 'friend'];

const DEFAULT_NOTIFS = {
  betResults: true,
  challengeUpdates: true,
  promotions: false,
  weeklyReports: true,
};
const DEFAULT_PRIVACY = {
  profileVisible: true,
  showStats: true,
  showInLeaderboard: true,
  analyticsOptOut: false,
};

function sanitizeInstagramHandle(value) {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (!v) return '';
  v = v.replace(/^@+/, '');
  if (v.length > 50) v = v.slice(0, 50);
  if (!/^[A-Za-z0-9._]+$/.test(v)) return null;
  return v;
}

function sanitizeFacebookUrl(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return '';
  let url;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(url.hostname)) return null;
  return url.toString().slice(0, 500);
}

function sanitizeAvatar(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().slice(0, 500);
  if (!v) return '';
  if (v.startsWith('/objects/') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:image/')) {
    return v;
  }
  return null;
}

function sanitizeBanner(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().slice(0, 1000);
  if (!v) return '';
  if (v.startsWith('/objects/') || v.startsWith('/banners/') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:image/')) {
    return v;
  }
  return null;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
      const [authUser] = await db.select({ id: users.id, email: users.email })
        .from(users).where(eq(users.id, userId)).limit(1);

      return res.status(200).json({
        settings: {
          email: authUser?.email || session.user.email || '',
          username: profile?.username || '',
          bio: profile?.bio || '',
          avatar: profile?.avatar || '',
          bannerUrl: profile?.bannerUrl || '',
          instagramHandle: profile?.instagramHandle || '',
          facebookUrl: profile?.facebookUrl || '',
          oddsFormat: profile?.oddsFormat || 'american',
          notifications: { ...DEFAULT_NOTIFS, ...(profile?.notificationPrefs || {}) },
          notificationsFilter: ALLOWED_NOTIF_FILTERS.includes(profile?.notificationsFilter)
            ? profile.notificationsFilter
            : 'all',
          privacy: { ...DEFAULT_PRIVACY, ...(profile?.privacyPrefs || {}) },
        },
      });
    } catch (err) {
      console.error('[settings GET]', err);
      return res.status(500).json({ error: 'Failed to load settings' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const updates = {};

      if (typeof body.username === 'string') {
        const u = body.username.trim().toLowerCase().slice(0, 100);
        if (u.length < 2) {
          return res.status(400).json({ error: 'Username must be at least 2 characters' });
        }
        const taken = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.username, u), ne(profiles.id, userId)))
          .limit(1);
        if (taken.length > 0) {
          return res.status(409).json({ error: 'Username is already taken' });
        }
        updates.username = u;
      }

      if (typeof body.bio === 'string') {
        updates.bio = body.bio.trim().slice(0, 500);
      }

      if (body.avatar !== undefined) {
        const a = sanitizeAvatar(body.avatar);
        if (a === null) return res.status(400).json({ error: 'Invalid avatar' });
        updates.avatar = a;
      }

      if (body.bannerUrl !== undefined) {
        const b = sanitizeBanner(body.bannerUrl);
        if (b === null) return res.status(400).json({ error: 'Invalid banner' });
        updates.bannerUrl = b;
      }

      if (body.instagramHandle !== undefined) {
        const h = sanitizeInstagramHandle(body.instagramHandle);
        if (h === null) return res.status(400).json({ error: 'Invalid Instagram handle' });
        updates.instagramHandle = h;
      }

      if (body.facebookUrl !== undefined) {
        const f = sanitizeFacebookUrl(body.facebookUrl);
        if (f === null) return res.status(400).json({ error: 'Facebook link must be a facebook.com URL' });
        updates.facebookUrl = f;
      }

      if (body.oddsFormat !== undefined) {
        if (!ALLOWED_ODDS_FORMATS.includes(body.oddsFormat)) {
          return res.status(400).json({ error: 'Invalid odds format' });
        }
        updates.oddsFormat = body.oddsFormat;
      }

      if (body.notificationsFilter !== undefined) {
        if (!ALLOWED_NOTIF_FILTERS.includes(body.notificationsFilter)) {
          return res.status(400).json({ error: 'Invalid notifications filter' });
        }
        updates.notificationsFilter = body.notificationsFilter;
      }

      if (body.notifications && typeof body.notifications === 'object') {
        const cleaned = {};
        for (const k of ALLOWED_NOTIF_KEYS) {
          if (typeof body.notifications[k] === 'boolean') cleaned[k] = body.notifications[k];
        }
        const [existing] = await db.select({ notificationPrefs: profiles.notificationPrefs })
          .from(profiles).where(eq(profiles.id, userId)).limit(1);
        updates.notificationPrefs = { ...DEFAULT_NOTIFS, ...(existing?.notificationPrefs || {}), ...cleaned };
      }

      if (body.privacy && typeof body.privacy === 'object') {
        const cleaned = {};
        for (const k of ALLOWED_PRIVACY_KEYS) {
          if (typeof body.privacy[k] === 'boolean') cleaned[k] = body.privacy[k];
        }
        const [existing] = await db.select({ privacyPrefs: profiles.privacyPrefs })
          .from(profiles).where(eq(profiles.id, userId)).limit(1);
        updates.privacyPrefs = { ...DEFAULT_PRIVACY, ...(existing?.privacyPrefs || {}), ...cleaned };
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const [existing] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
      let saved;
      if (existing) {
        [saved] = await db.update(profiles)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(profiles.id, userId))
          .returning();
      } else {
        [saved] = await db.insert(profiles)
          .values({
            id: userId,
            username: updates.username || session.user.email?.split('@')[0] || 'User',
            bio: updates.bio || '',
            avatar: updates.avatar || '',
            bankroll: '0',
            ...updates,
          })
          .returning();
      }

      return res.status(200).json({
        settings: {
          username: saved.username || '',
          bio: saved.bio || '',
          avatar: saved.avatar || '',
          bannerUrl: saved.bannerUrl || '',
          instagramHandle: saved.instagramHandle || '',
          facebookUrl: saved.facebookUrl || '',
          oddsFormat: saved.oddsFormat || 'american',
          notifications: { ...DEFAULT_NOTIFS, ...(saved.notificationPrefs || {}) },
          notificationsFilter: ALLOWED_NOTIF_FILTERS.includes(saved.notificationsFilter)
            ? saved.notificationsFilter
            : 'all',
          privacy: { ...DEFAULT_PRIVACY, ...(saved.privacyPrefs || {}) },
        },
      });
    } catch (err) {
      console.error('[settings PATCH]', err);
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
