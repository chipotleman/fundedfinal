import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const REST_POLLING_INTERVAL = 30000; // 30 seconds

export function useGoalserveLive(options = {}) {
  const { sport = null, eventId = null, autoConnect = true, onUpdate = null, enableRestFallback = true } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState({});
  const [availableEvents, setAvailableEvents] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [activeSports, setActiveSports] = useState([]);
  const [usingRestFallback, setUsingRestFallback] = useState(false);
  
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const fetchRestData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sport) params.set('sport', sport);
      params.set('connect', 'false'); // Don't try WebSocket connection
      
      const response = await fetch(`/api/goalserve/live?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.games) {
        setEvents(prev => {
          const updated = { ...prev };
          data.games.forEach(game => {
            updated[game.id] = game;
          });
          return updated;
        });
        setLastUpdate(Date.now());
      }
    } catch (err) {
      console.error('[Goalserve Live] REST polling error:', err);
    }
  }, [sport]);

  const startRestPolling = useCallback(() => {
    console.log('[Goalserve Live] Starting REST API polling fallback');
    setUsingRestFallback(true);
    setError(null);
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Fetch immediately
    fetchRestData();
    
    // Then poll every 30 seconds
    pollingIntervalRef.current = setInterval(fetchRestData, REST_POLLING_INTERVAL);
  }, [fetchRestData]);

  const stopRestPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setUsingRestFallback(false);
  }, []);

  const connect = useCallback(() => {
    // Stop REST polling if switching to WebSocket
    stopRestPolling();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const params = new URLSearchParams();
      if (sport) params.set('sport', sport);
      if (eventId) params.set('eventId', eventId);
      
      const url = `/api/goalserve/stream${params.toString() ? '?' + params.toString() : ''}`;

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[Goalserve Live] SSE connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastUpdate(data.timestamp || Date.now());

          switch (data.type) {
            case 'connected':
              console.log('[Goalserve Live] Initial status:', data.status);
              setUsingRestFallback(false);
              if (data.status?.activeSports) {
                setActiveSports(data.status.activeSports);
              }
              break;
            
            case 'connection_failed':
              console.log('[Goalserve Live] Connection failed, falling back to REST:', data.message);
              setIsConnected(false);
              setError(data.message);
              eventSource.close();
              eventSourceRef.current = null;
              // Start REST polling fallback if enabled
              if (enableRestFallback) {
                startRestPolling();
              }
              break;
            
            case 'available':
              if (data.data?.events) {
                setAvailableEvents(prev => {
                  const updated = { ...prev };
                  data.data.events.forEach(evt => {
                    updated[evt.id] = {
                      id: evt.id,
                      mid: evt.mid,
                      competitionId: evt.cmp_id,
                      competitionName: evt.cmp_name,
                      team1: evt.t1?.n,
                      team2: evt.t2?.n,
                      sport: data.data.sport,
                      providerId: evt.fi
                    };
                  });
                  return updated;
                });
              }
              break;
            
            case 'update':
              if (data.data?.id) {
                setEvents(prev => ({
                  ...prev,
                  [data.data.id]: data.data
                }));
              }
              break;
            
            case 'disconnected':
              console.log('[Goalserve Live] Sport disconnected:', data.data?.sport);
              if (data.data?.sport) {
                setActiveSports(prev => prev.filter(s => s !== data.data.sport));
              }
              break;
            
            case 'error':
              setError(data.data?.error || 'Unknown error');
              break;
            
            case 'heartbeat':
              break;
            
            case 'initial':
              // Handle initial events from inplay polling
              if (data.events && Array.isArray(data.events)) {
                setEvents(prev => {
                  const updated = { ...prev };
                  data.events.forEach(evt => {
                    if (evt.id) updated[evt.id] = evt;
                  });
                  console.log('[Goalserve Live] Initial events loaded:', data.events.length);
                  return updated;
                });
              }
              break;
              
            case 'events':
              // Handle event updates from inplay polling - format: { changes: [{ type, event }] }
              if (data.changes && Array.isArray(data.changes)) {
                setEvents(prev => {
                  const updated = { ...prev };
                  data.changes.forEach(change => {
                    if (change.event?.id) {
                      updated[change.event.id] = change.event;
                    }
                  });
                  return updated;
                });
              }
              // Also support direct events array
              if (data.events && Array.isArray(data.events)) {
                setEvents(prev => {
                  const updated = { ...prev };
                  data.events.forEach(evt => {
                    if (evt.id) updated[evt.id] = evt;
                  });
                  return updated;
                });
              }
              break;
              
            default:
              console.log('[Goalserve Live] Unknown event type:', data.type);
          }

          if (onUpdate) {
            onUpdate(data);
          }
        } catch (err) {
          console.error('[Goalserve Live] Parse error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[Goalserve Live] SSE error:', err);
        setIsConnected(false);
        setError('Connection lost');
        
        eventSource.close();
        eventSourceRef.current = null;
        
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(Math.pow(2, reconnectAttempts.current) * 1000, 30000);
          reconnectAttempts.current++;
          console.log(`[Goalserve Live] Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) {
      console.error('[Goalserve Live] Connection error:', err);
      setError(err.message);
    }
  }, [sport, eventId, onUpdate, enableRestFallback, startRestPolling, stopRestPolling]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    stopRestPolling();
    setIsConnected(false);
  }, [stopRestPolling]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const getEvent = useCallback((id) => {
    return events[id] || null;
  }, [events]);

  const getEventsBySport = useCallback((sportType) => {
    return Object.values(events).filter(e => e.sport === sportType);
  }, [events]);

  const getAvailableEventsBySport = useCallback((sportType) => {
    return Object.values(availableEvents).filter(e => e.sport === sportType);
  }, [availableEvents]);

  const liveScores = Object.fromEntries(
    Object.entries(events).map(([id, event]) => [
      id,
      {
        homeScore: event.homeScore || event.scores?.home?.total || 0,
        awayScore: event.awayScore || event.scores?.away?.total || 0,
        status: event.status,
        isLive: event.status === 'live' || event.isLive,
        quarter: event.quarter || event.period || null,
        elapsedTime: event.elapsedTime || null,
        period: event.period || null,
        stateCode: event.stateCode || null,
        displayClock: event.displayClock || event.elapsedTime || null,
        comments: event.comments || []
      }
    ])
  );

  const liveOdds = Object.fromEntries(
    Object.entries(events).map(([id, event]) => [
      id,
      event.odds || null
    ])
  );

  return {
    isConnected,
    events,
    availableEvents,
    activeSports,
    lastUpdate,
    error,
    usingRestFallback,
    liveScores,
    liveOdds,
    connect,
    disconnect,
    startRestPolling,
    stopRestPolling,
    getEvent,
    getEventsBySport,
    getAvailableEventsBySport
  };
}

export function useLiveEvent(eventId, options = {}) {
  const { events, isConnected, lastUpdate, error, ...rest } = useGoalserveLive({ 
    ...options, 
    eventId 
  });

  // Create a unique key based on events object to ensure useMemo recalculates
  const eventsKey = useMemo(() => {
    const entries = Object.entries(events);
    // Create a hash of event IDs and their possession values to detect changes
    return entries.map(([id, e]) => `${id}:${e.possession || ''}`).join('|');
  }, [events]);

  // Find event with flexible ID matching - useMemo ensures React detects changes
  const event = useMemo(() => {
    // Try exact match first
    if (events[eventId]) return events[eventId];
    if (!eventId) return null;
    
    const strippedId = String(eventId).replace(/^inplay_/, '');
    const normalizedId = strippedId.toLowerCase();
    
    // Try stripped ID
    if (events[strippedId]) return events[strippedId];
    
    // Search through all events for a match
    const allEvents = Object.values(events);
    let found = allEvents.find(e => {
      const eId = String(e.id || '').toLowerCase();
      const eGameId = String(e.gameId || '').toLowerCase();
      
      // Match by exact ID, stripped ID, or case-insensitive
      return eId === normalizedId || 
             eGameId === normalizedId ||
             eId === String(eventId).toLowerCase() ||
             eGameId === String(eventId).toLowerCase();
    }) || null;
    
    // Also try matching by team names if ID matching fails
    if (!found && strippedId.includes('_vs_')) {
      const vsIndex = strippedId.indexOf('_vs_');
      const beforeVs = strippedId.substring(0, vsIndex);
      const afterVs = strippedId.substring(vsIndex + 4);
      
      // Extract team names (remove sport prefix)
      const sportPrefixes = ['basketball_', 'hockey_', 'amfootball_', 'baseball_', 'soccer_'];
      let team1Part = beforeVs;
      for (const prefix of sportPrefixes) {
        if (team1Part.startsWith(prefix)) {
          team1Part = team1Part.substring(prefix.length);
          break;
        }
      }
      
      const normalizeTeam = (name) => name.replace(/_/g, ' ').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const team1 = normalizeTeam(team1Part);
      const team2 = normalizeTeam(afterVs);
      
      found = allEvents.find(e => {
        const home = normalizeTeam(e.homeTeam || e.homeTeamFull || '');
        const away = normalizeTeam(e.awayTeam || e.awayTeamFull || '');
        return (home.includes(team1) || team1.includes(home) || 
                home.includes(team2) || team2.includes(home)) &&
               (away.includes(team1) || team1.includes(away) ||
                away.includes(team2) || team2.includes(away));
      }) || null;
    }
    
    return found;
  }, [events, eventId, eventsKey]);

  // Extract derived values with useMemo for proper change detection  
  const possession = useMemo(() => event?.possession, [event?.possession]);
  const ballPosition = useMemo(() => event?.xy || event?.ballPosition, [event?.xy, event?.ballPosition]);

  return {
    event,
    isConnected,
    lastUpdate,
    error,
    possession,
    ballPosition,
    team1: event?.team1,
    team2: event?.team2,
    score: event ? `${event.team1?.score || 0}-${event.team2?.score || 0}` : null,
    odds: event?.odds || [],
    stats: event?.stats || {},
    comments: event?.comments || [],
    ...rest
  };
}

export function useLiveSport(sport, options = {}) {
  const { events, availableEvents, isConnected, getEventsBySport, getAvailableEventsBySport, ...rest } = useGoalserveLive({ 
    ...options, 
    sport 
  });

  return {
    events: getEventsBySport(sport),
    availableEvents: getAvailableEventsBySport(sport),
    eventCount: getEventsBySport(sport).length,
    isConnected,
    ...rest
  };
}

export default useGoalserveLive;
