import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const GamesContext = createContext();

export function useGames() {
  return useContext(GamesContext);
}

export function GamesProvider({ children, initialInplayEvents = null, initialApiGames = null }) {
  // Initialize apiGames with SSR data if provided - enables instant scheduled games
  const [apiGames, setApiGames] = useState(() => {
    if (initialApiGames && Array.isArray(initialApiGames)) {
      return initialApiGames;
    }
    return [];
  });
  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (initialApiGames && Array.isArray(initialApiGames)) {
      return initialApiGames.some(g => g.isSimulated);
    }
    return false;
  });
  // Track if we have SSR data for scheduled games to skip initial fetch
  const hasInitialApiGamesRef = React.useRef(initialApiGames && initialApiGames.length > 0);
  
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
  
  // Real-time possession state (updated every 5 seconds)
  const [possessionState, setPossessionState] = useState({});
  const [possessionConnected, setPossessionConnected] = useState(false);
  
  // If we have either SSR data, we're not loading
  const [loading, setLoading] = useState(!initialInplayEvents && !initialApiGames);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const pollingIntervalRef = useRef(null);
  const sseRef = useRef(null);
  const possessionSseRef = useRef(null);
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
          setIsDemoMode(data.isSimulated === true || data.dataSource === 'Demo');
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

  // Connect to possession SSE stream for real-time possession updates (5-second polling)
  const connectPossessionSSE = useCallback(() => {
    if (possessionSseRef.current) {
      possessionSseRef.current.close();
    }

    const eventSource = new EventSource('/api/goalserve/possession-stream');
    possessionSseRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (!isMountedRef.current) return;
        
        // Handle connected event
        if (data.type === 'connected') {
          setPossessionConnected(true);
        }
        // Handle initial possession states
        else if (data.type === 'initial' && data.states) {
          const statesObj = {};
          data.states.forEach(state => {
            if (state.gameId) {
              statesObj[state.gameId] = state;
            }
          });
          setPossessionState(statesObj);
        }
        // Handle possession updates
        else if (data.type === 'possession_update' && data.changes) {
          setPossessionState(prev => {
            const updated = { ...prev };
            data.changes.forEach(change => {
              if (change.gameId) {
                // Remove finished games from state
                if (change.type === 'finished') {
                  delete updated[change.gameId];
                } else {
                  updated[change.gameId] = change;
                }
              }
            });
            return updated;
          });
        }
      } catch (err) {
        console.error('[GamesContext] Possession SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setPossessionConnected(false);
      if (isMountedRef.current) {
        setTimeout(connectPossessionSSE, 5000);
      }
    };
  }, []);

  useEffect(() => {
    // Only run client-side effects in browser (not during SSR)
    if (typeof window === 'undefined') return;
    
    isMountedRef.current = true;
    
    // Only fetch immediately if we don't have SSR data for scheduled games
    // If we have SSR data, skip the initial fetch to avoid delay
    if (!hasInitialApiGamesRef.current) {
      fetchGames();
    } else {
      // Mark as not loading since we have SSR data
      setLoading(false);
      setLastUpdated(new Date());
    }
    
    // Poll for upcoming games at a slower rate (every 60 seconds)
    // This refreshes the data after the initial SSR render
    pollingIntervalRef.current = setInterval(fetchGames, 60000);
    
    // Connect SSE for live updates (this won't clear SSR data, just merges updates)
    connectSSE();
    
    // Connect possession SSE for real-time possession updates (5-second polling)
    connectPossessionSSE();

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (possessionSseRef.current) {
        possessionSseRef.current.close();
      }
    };
  }, [fetchGames, connectSSE, connectPossessionSSE]); // Note: inplayEvents intentionally excluded to avoid re-triggering

  const refetch = useCallback(() => {
    lastFetchTimeRef.current = 0;
    fetchGames();
  }, [fetchGames]);

  // Helper to get possession for a specific game ID
  const getPossession = useCallback((gameId) => {
    return possessionState[gameId] || null;
  }, [possessionState]);

  const value = useMemo(() => ({
    apiGames,
    inplayEvents,
    possessionState,
    possessionConnected,
    getPossession,
    loading,
    error,
    lastUpdated,
    refetch,
    isDemoMode
  }), [apiGames, inplayEvents, possessionState, possessionConnected, getPossession, loading, error, lastUpdated, refetch, isDemoMode]);

  return (
    <GamesContext.Provider value={value}>
      {children}
    </GamesContext.Provider>
  );
}
