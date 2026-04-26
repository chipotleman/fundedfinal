import { isAnalyticsOptedOut } from './promoTracking';

const VALID_SHARE_PATHS = new Set(['native', 'files', 'clipboard']);

export const BADGE_SHARE_REF = 'badge_share';

function getVisitorId() {
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

function getSessionId() {
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

async function postEvent(event) {
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      keepalive: true,
    });
  } catch {
    // Best-effort tracking; never throw to the caller.
  }
}

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

  await postEvent(event);
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

  await postEvent(event);
}
