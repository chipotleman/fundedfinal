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
