import { isAnalyticsOptedOut } from './promoTracking';

/**
 * Generic client-side share tracking helper.
 *
 * Use this for any "user shared a thing" surface in the app — profile
 * frame share, battle/bet result share, pik pool invite, etc. — so the
 * admin analytics page can aggregate them with consistent fields.
 *
 * Each share emits a single `item_share` event into `user_events` with
 * `event_data` shaped as:
 *
 *   {
 *     itemType:        string,            // e.g. 'bet', 'profile_frame', 'pik_pool'
 *     itemId:          string | null,     // stable id within the itemType
 *     sharePath:       string,            // how the user shared — see VALID_SHARE_PATHS
 *     sharerProfileId: string | null,     // who initiated the share, if known
 *     ...extra,                            // surface-specific extras
 *   }
 *
 * The badge share tracker (`lib/badgeShareTracking.js`) keeps its own
 * dedicated `badge_share` / `badge_share_profile_visit` event types so
 * existing aggregations and historical data remain unchanged. It reuses
 * the visitor/session id helpers exported from this module to stay DRY.
 */

export const VALID_SHARE_PATHS = new Set([
  'native',
  'files',
  'clipboard',
  'twitter',
  'image_download',
  'copy_text',
]);

export function getVisitorId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.localStorage.getItem('piks_visitor_id');
    if (!id) {
      id =
        'v_' +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      window.localStorage.setItem('piks_visitor_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

export function getSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.sessionStorage.getItem('piks_session_id');
    if (!id) {
      id =
        's_' +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      window.sessionStorage.setItem('piks_session_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

export async function postAnalyticsEvent(event) {
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      // keepalive lets clicks-that-trigger-navigation finish posting
      keepalive: true,
    });
  } catch {
    // Best-effort tracking; never throw to the caller.
  }
}

/**
 * Record a share event for any shareable surface.
 *
 * @param {object} args
 * @param {string} args.itemType        — e.g. 'bet', 'profile_frame'
 * @param {string|number|null} [args.itemId]
 * @param {string} args.sharePath       — must be in VALID_SHARE_PATHS
 * @param {string|number|null} [args.sharerProfileId]
 * @param {object} [args.extra]         — extra surface-specific fields
 */
export async function trackShare({
  itemType,
  itemId,
  sharePath,
  sharerProfileId,
  extra,
}) {
  if (typeof window === 'undefined') return;
  if (isAnalyticsOptedOut()) return;
  if (!itemType || typeof itemType !== 'string') return;
  if (!VALID_SHARE_PATHS.has(sharePath)) return;

  const data = {
    itemType,
    itemId: itemId != null && itemId !== '' ? String(itemId) : null,
    sharePath,
    sharerProfileId:
      sharerProfileId != null && sharerProfileId !== ''
        ? String(sharerProfileId)
        : null,
  };

  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) continue;
      // Only store JSON-safe primitives so the row stays small and
      // queryable.
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
      ) {
        data[k] = v;
      }
    }
  }

  const event = {
    type: 'item_share',
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    data,
    pageUrl: window.location?.pathname || null,
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
  };

  await postAnalyticsEvent(event);
}

/**
 * Record a profile/destination visit that originated from a generic
 * share link. Mirrors `trackBadgeShareProfileVisit` for non-badge
 * surfaces (e.g. someone landing on a profile via a frame share link).
 *
 * @param {object} args
 * @param {string} args.itemType
 * @param {string|number|null} [args.itemId]
 * @param {string|number|null} [args.profileId]
 */
export async function trackShareLandingVisit({
  itemType,
  itemId,
  profileId,
}) {
  if (typeof window === 'undefined') return;
  if (isAnalyticsOptedOut()) return;
  if (!itemType || typeof itemType !== 'string') return;

  const event = {
    type: 'item_share_landing',
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    data: {
      itemType,
      itemId: itemId != null && itemId !== '' ? String(itemId) : null,
      profileId:
        profileId != null && profileId !== '' ? String(profileId) : null,
    },
    pageUrl: window.location?.pathname || null,
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
  };

  await postAnalyticsEvent(event);
}
