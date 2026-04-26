import { isAnalyticsOptedOut } from './promoTracking';
import {
  getVisitorId,
  getSessionId,
  postAnalyticsEvent,
} from './shareTracking';

// Badge shares predate the generic `item_share` event type and have a
// dedicated event type so the existing analytics aggregations and any
// historical rows in `user_events` keep working unchanged. The generic
// `lib/shareTracking.js` helper is used for newer surfaces (profile
// frames, bet result shares, etc.) — both helpers reuse the same
// visitor/session id plumbing exported from `shareTracking.js`.

const VALID_SHARE_PATHS = new Set(['native', 'files', 'clipboard']);

export const BADGE_SHARE_REF = 'badge_share';

export async function trackBadgeShare({
  achievementId,
  rarity,
  sharePath,
  sharerProfileId,
}) {
  if (typeof window === 'undefined') return;
  if (isAnalyticsOptedOut()) return;
  if (!achievementId || !VALID_SHARE_PATHS.has(sharePath)) return;

  const event = {
    type: 'badge_share',
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    data: {
      achievementId: String(achievementId),
      rarity: rarity ? String(rarity) : null,
      sharePath,
      sharerProfileId:
        sharerProfileId != null ? String(sharerProfileId) : null,
    },
    pageUrl: window.location?.pathname || null,
    referrer:
      typeof document !== 'undefined' ? document.referrer : null,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
  };

  await postAnalyticsEvent(event);
}

export async function trackBadgeShareProfileVisit({
  profileId,
  achievementId,
}) {
  if (typeof window === 'undefined') return;
  if (isAnalyticsOptedOut()) return;
  if (!profileId) return;

  const event = {
    type: 'badge_share_profile_visit',
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    data: {
      profileId: String(profileId),
      achievementId:
        achievementId != null && achievementId !== ''
          ? String(achievementId)
          : null,
    },
    pageUrl: window.location?.pathname || null,
    referrer:
      typeof document !== 'undefined' ? document.referrer : null,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
  };

  await postAnalyticsEvent(event);
}
