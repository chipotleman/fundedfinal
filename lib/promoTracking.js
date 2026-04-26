import {
  getVisitorId,
  getSessionId,
  postAnalyticsEvent,
} from './shareTracking';

export const ANALYTICS_OPT_OUT_KEY = 'piks_analytics_opt_out';

export function isAnalyticsOptedOut() {
  if (typeof window === 'undefined') return true;
  try {
    if (window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'true') {
      return true;
    }
  } catch {
    // localStorage may be unavailable (private mode); fall through
  }
  const dnt =
    (typeof navigator !== 'undefined' &&
      (navigator.doNotTrack ||
        navigator.msDoNotTrack ||
        window.doNotTrack)) ||
    null;
  if (dnt === '1' || dnt === 'yes') return true;
  return false;
}

export async function trackPromoEvent(type, { slotIndex, containerType }) {
  if (typeof window === 'undefined') return;
  if (isAnalyticsOptedOut()) return;
  if (type !== 'promo_impression' && type !== 'promo_click') return;
  if (typeof slotIndex !== 'number' || !containerType) return;

  const event = {
    type,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    data: { slotIndex, containerType },
    pageUrl: window.location?.pathname || null,
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
  };

  await postAnalyticsEvent(event);
}
