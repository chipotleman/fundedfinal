import { useState, useEffect, useCallback, useRef } from 'react';

// HTTPS-only approach: This hook now only returns empty state
// All live data comes from the /api/games endpoint directly
// which merges inplay feed data server-side

export function useGoalserveLive(options = {}) {
  // Return disconnected state - all live data comes from /api/games REST endpoint
  const [isConnected] = useState(false);
  const [events] = useState({});
  const [availableEvents] = useState({});
  const [lastUpdate] = useState(null);
  const [error] = useState(null);
  const [activeSports] = useState([]);
  
  // Helper functions that return data in expected format
  const liveScores = {};
  const liveOdds = {};
  
  return {
    isConnected,
    events,
    availableEvents,
    liveScores,
    liveOdds,
    lastUpdate,
    error,
    activeSports,
    usingRestFallback: false,
    connect: () => {},
    disconnect: () => {},
    subscribe: () => {},
    unsubscribe: () => {}
  };
}

// Backward compatibility exports
export function useLiveEvent(eventId) {
  return {
    event: null,
    isLive: false,
    scores: null,
    odds: null,
    error: null
  };
}

export function useLiveSport(sport) {
  return {
    events: [],
    isConnected: false,
    lastUpdate: null,
    error: null
  };
}

export default useGoalserveLive;
