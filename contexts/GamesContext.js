import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const GamesContext = createContext();

export function useGames() {
  return useContext(GamesContext);
}

export function GamesProvider({ children, initialInplayEvents = null }) {
  const [apiGames, setApiGames] = useState([]);
  // Initialize with SSR data if provided - this enables zero-delay rendering
  const [inplayEvents, setInplayEvents] = useState(() => {
    if (initialInplayEvents && Array.isArray(initialInplayEvents)) {
      const eventsObj = {};
      initialInplayEvents.forEach(evt => {
        if (evt.id) eventsObj[evt.id] = evt;
      });
      return eventsObj;
    }
    return initialInplayEvents || {};
  });
  // If we have SSR data, we're not loading
  const [loading, setLoading] = useState(!initialInplayEvents);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const pollingIntervalRef = useRef(null);
  const sseRef = useRef(null);
  const currentIntervalRef = useRef(5000);
  const lastFetchTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  const fetchGames = useCallback(async () => {
    try {
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 3000) {
        return;
      }
      
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setApiGames(data.games || []);
          setLoading(false);
          setLastUpdated(new Date());
          lastFetchTimeRef.current = Date.now();
          
          const recommendedInterval = data.polling?.recommendedInterval || 60000;
          if (recommendedInterval !== currentIntervalRef.current) {
            currentIntervalRef.current = recommendedInterval;
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            pollingIntervalRef.current = setInterval(fetchGames, recommendedInterval);
          }
        }
      } else {
        if (isMountedRef.current) {
          setError('Failed to load games');
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('[GamesContext] Error fetching games:', err);
      if (isMountedRef.current) {
        setError('Failed to load games');
        setLoading(false);
      }
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    const eventSource = new EventSource('/api/goalserve/stream');
    sseRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (!isMountedRef.current) return;
        
        // Handle initial events (array format from inplay)
        if (data.type === 'initial' && data.events) {
          const eventsObj = {};
          if (Array.isArray(data.events)) {
            data.events.forEach(evt => {
              if (evt.id) eventsObj[evt.id] = evt;
            });
          } else {
            Object.assign(eventsObj, data.events);
          }
          setInplayEvents(eventsObj);
          setLastUpdated(new Date());
        }
        // Handle 'events' type with changes array (from inplay polling)
        else if (data.type === 'events' && data.changes) {
          setInplayEvents(prev => {
            const updated = { ...prev };
            data.changes.forEach(change => {
              if (change.event && change.event.id) {
                updated[change.event.id] = change.event;
              }
            });
            return updated;
          });
          setLastUpdated(new Date());
        }
        // Handle 'update' type with events object
        else if (data.type === 'update' && data.events) {
          setInplayEvents(prev => {
            const updated = { ...prev };
            Object.entries(data.events).forEach(([id, eventData]) => {
              updated[id] = eventData;
            });
            return updated;
          });
          setLastUpdated(new Date());
        }
        // Handle single event update
        else if (data.type === 'update' && data.data) {
          setInplayEvents(prev => {
            const updated = { ...prev };
            if (data.data.id) {
              updated[data.data.id] = data.data;
            }
            return updated;
          });
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('[GamesContext] SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (isMountedRef.current) {
        setTimeout(connectSSE, 5000);
      }
    };
  }, []);

  useEffect(() => {
    // Only run client-side effects in browser (not during SSR)
    if (typeof window === 'undefined') return;
    
    isMountedRef.current = true;
    
    // If we have SSR data, skip initial fetch - SSE will handle updates
    const hasSSRData = Object.keys(inplayEvents).length > 0;
    
    if (!hasSSRData) {
      // No SSR data - fetch games via REST API
      fetchGames();
      pollingIntervalRef.current = setInterval(fetchGames, 5000);
    }
    
    // Connect SSE for live updates (this won't clear SSR data, just merges updates)
    connectSSE();

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [fetchGames, connectSSE]); // Note: inplayEvents intentionally excluded to avoid re-triggering

  const refetch = useCallback(() => {
    lastFetchTimeRef.current = 0;
    fetchGames();
  }, [fetchGames]);

  const value = useMemo(() => ({
    apiGames,
    inplayEvents,
    loading,
    error,
    lastUpdated,
    refetch
  }), [apiGames, inplayEvents, loading, error, lastUpdated, refetch]);

  return (
    <GamesContext.Provider value={value}>
      {children}
    </GamesContext.Provider>
  );
}
