import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { isAnalyticsOptedOut } from '../lib/promoTracking';

const generateVisitorId = () => {
  if (typeof window === 'undefined') return null;
  if (isAnalyticsOptedOut()) return null;

  let visitorId = localStorage.getItem('piks_visitor_id');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('piks_visitor_id', visitorId);
  }
  return visitorId;
};

const generateSessionId = () => {
  if (typeof window === 'undefined') return null;
  if (isAnalyticsOptedOut()) return null;

  let sessionId = sessionStorage.getItem('piks_session_id');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem('piks_session_id', sessionId);
  }
  return sessionId;
};

export function useEventTracking() {
  const { data: session } = useSession();
  const eventQueue = useRef([]);
  const flushTimeout = useRef(null);
  const pageStartTime = useRef(Date.now());
  const pagesViewed = useRef(0);
  const eventsCount = useRef(0);

  const userId = session?.user?.id || null;
  const visitorId = typeof window !== 'undefined' ? generateVisitorId() : null;
  const sessionId = typeof window !== 'undefined' ? generateSessionId() : null;

  const flushEvents = useCallback(async () => {
    if (eventQueue.current.length === 0) return;
    if (isAnalyticsOptedOut()) {
      // Drop any queued events the moment opt-out becomes true.
      eventQueue.current = [];
      return;
    }

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to flush events:', error);
      eventQueue.current = [...events, ...eventQueue.current];
    }
  }, []);

  const trackEvent = useCallback((type, data = {}) => {
    if (typeof window === 'undefined') return;
    if (isAnalyticsOptedOut()) return;

    eventsCount.current++;

    const event = {
      type,
      userId,
      visitorId,
      sessionId,
      data,
      pageUrl: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    eventQueue.current.push(event);

    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }

    if (eventQueue.current.length >= 10) {
      flushEvents();
    } else {
      flushTimeout.current = setTimeout(flushEvents, 5000);
    }
  }, [userId, visitorId, sessionId, flushEvents]);

  const trackPageView = useCallback(async (pageUrl, pageTitle) => {
    if (typeof window === 'undefined') return;
    if (isAnalyticsOptedOut()) return;

    pagesViewed.current++;

    try {
      await fetch('/api/analytics/page-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          visitorId,
          sessionId,
          pageUrl: pageUrl || window.location.pathname,
          pageTitle: pageTitle || document.title,
          referrer: document.referrer,
        }),
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }, [userId, visitorId, sessionId]);

  const trackDemoBet = useCallback(async (betData) => {
    if (isAnalyticsOptedOut()) return;
    try {
      await fetch('/api/analytics/demo-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          visitorId,
          sessionId,
          ...betData,
        }),
      });
    } catch (error) {
      console.error('Failed to track demo bet:', error);
    }
  }, [userId, visitorId, sessionId]);

  const trackUnplacedBet = useCallback(async (action, betData) => {
    if (isAnalyticsOptedOut()) return null;
    try {
      const res = await fetch('/api/analytics/unplaced-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          visitorId,
          sessionId,
          ...betData,
        }),
      });
      const data = await res.json();
      return data.id;
    } catch (error) {
      console.error('Failed to track unplaced bet:', error);
      return null;
    }
  }, [userId, visitorId, sessionId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionId) return;
    if (isAnalyticsOptedOut()) return;

    fetch('/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        userId,
        visitorId,
        sessionId,
      }),
    }).catch(console.error);

    const handleBeforeUnload = () => {
      if (isAnalyticsOptedOut()) return;
      const duration = Math.floor((Date.now() - pageStartTime.current) / 1000);

      navigator.sendBeacon('/api/analytics/session', JSON.stringify({
        action: 'end',
        sessionId,
        duration,
        pagesViewed: pagesViewed.current,
        eventsCount: eventsCount.current,
      }));
    };

    const heartbeatInterval = setInterval(() => {
      if (isAnalyticsOptedOut()) return;
      fetch('/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          sessionId,
          pagesViewed: pagesViewed.current,
          eventsCount: eventsCount.current,
        }),
      }).catch(console.error);
    }, 60000);

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      flushEvents();
    };
  }, [sessionId, userId, visitorId, flushEvents]);

  return {
    trackEvent,
    trackPageView,
    trackDemoBet,
    trackUnplacedBet,
    visitorId,
    sessionId,
  };
}

export default useEventTracking;
