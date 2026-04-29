import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const GamesContext = createContext();

export function useGames() {
  return useContext(GamesContext);
}

const STORAGE_KEYS = {
  apiGames: 'gamesContext.apiGames.v1',
  inplayEvents: 'gamesContext.inplayEvents.v1',
  isDemoMode: 'gamesContext.isDemoMode.v1',
};

const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function readCache(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), value })
    );
  } catch {
    // Ignore quota / serialization errors — cache is best-effort.
  }
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
  // Tracks whether at least one /api/games fetch has actually completed
  // successfully in this session. Used by the dashboard to decide whether
  // an empty list is "still loading" (show skeletons) or "genuinely empty"
  // (allow the empty-state copy).
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
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
          // Never wipe visible games on a transient empty payload — only
          // replace state when the new payload actually contains games.
          // This keeps the dashboard populated through quiet moments and
          // upstream API hiccups.
          if (Array.isArray(data.games) && data.games.length > 0) {
            setApiGames(data.games);
            setIsDemoMode(data.isSimulated === true || data.dataSource === 'Demo');
          }
          setHasFetchedOnce(true);
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
          // Don't clear apiGames on a failed fetch — keep whatever the
          // user was already seeing on screen.
          setError('Failed to load games');
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('[GamesContext] Error fetching games:', err);
      if (isMountedRef.current) {
        // Same as above: keep prior games visible across transient errors.
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
          // Don't wipe a populated set of inplay events with an empty
          // initial snapshot — that just creates the "blank flash" we're
          // trying to eliminate. Only replace when there's something to
          // replace it with.
          if (Object.keys(eventsObj).length > 0) {
            setInplayEvents(eventsObj);
            setLastUpdated(new Date());
          }
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

    // Hydrate from local storage cache when SSR didn't provide data.
    // This makes returning to the dashboard (or a cold reload between
    // sessions) show games instantly instead of going through a blank
    // flash while the first fetch is in flight. Only writes to state
    // if our current state is still empty so we don't stomp anything
    // newer that already arrived.
    let hydratedFromCache = false;
    if (!hasInitialApiGamesRef.current) {
      const cachedApiGames = readCache(STORAGE_KEYS.apiGames);
      if (Array.isArray(cachedApiGames) && cachedApiGames.length > 0) {
        setApiGames(prev => (prev && prev.length > 0 ? prev : cachedApiGames));
        const cachedDemo = readCache(STORAGE_KEYS.isDemoMode);
        if (typeof cachedDemo === 'boolean') {
          setIsDemoMode(cachedDemo);
        }
        // We have something visible now, so we're no longer "loading".
        setLoading(false);
        hydratedFromCache = true;
      }
    }

    if (!initialInplayEvents) {
      const cachedInplay = readCache(STORAGE_KEYS.inplayEvents);
      if (
        cachedInplay &&
        typeof cachedInplay === 'object' &&
        !Array.isArray(cachedInplay) &&
        Object.keys(cachedInplay).length > 0
      ) {
        setInplayEvents(prev =>
          prev && Object.keys(prev).length > 0 ? prev : cachedInplay
        );
        setLoading(false);
        hydratedFromCache = true;
      }
    }

    // If we successfully hydrated *anything* from the local cache, mark
    // the "first fetch" gate as satisfied so the dashboard can show the
    // genuine empty-state copy for filtered tabs that don't intersect
    // the cached games — instead of perma-skeletoning while we wait for
    // the first API response. The next /api/games fetch will still set
    // this independently and will replace the cached payload as soon as
    // a non-empty response lands.
    if (hydratedFromCache) {
      setHasFetchedOnce(true);
    }

    // Only fetch immediately if we don't have SSR data for scheduled games
    // If we have SSR data, skip the initial fetch to avoid delay
    if (!hasInitialApiGamesRef.current) {
      fetchGames();
    } else {
      // Mark as not loading since we have SSR data
      setLoading(false);
      setHasFetchedOnce(true);
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

  // Mirror non-empty state to local storage so subsequent navigations and
  // tab reloads can hydrate instantly. We deliberately skip writing when
  // the current state is empty so a transient empty render can never wipe
  // out a previously-cached set of games.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Array.isArray(apiGames) && apiGames.length > 0) {
      writeCache(STORAGE_KEYS.apiGames, apiGames);
      writeCache(STORAGE_KEYS.isDemoMode, isDemoMode);
    }
  }, [apiGames, isDemoMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (inplayEvents && Object.keys(inplayEvents).length > 0) {
      writeCache(STORAGE_KEYS.inplayEvents, inplayEvents);
    }
  }, [inplayEvents]);

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
    hasFetchedOnce,
    error,
    lastUpdated,
    refetch,
    isDemoMode
  }), [apiGames, inplayEvents, possessionState, possessionConnected, getPossession, loading, hasFetchedOnce, error, lastUpdated, refetch, isDemoMode]);

  return (
    <GamesContext.Provider value={value}>
      {children}
    </GamesContext.Provider>
  );
}
