import { useState, useEffect, useCallback, useRef } from 'react';

export function useGoalserveLive(options = {}) {
  const { sport = null, eventId = null, autoConnect = true, onUpdate = null } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState({});
  const [availableEvents, setAvailableEvents] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [activeSports, setActiveSports] = useState([]);
  
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
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
              if (data.status?.activeSports) {
                setActiveSports(data.status.activeSports);
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
  }, [sport, eventId, onUpdate]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

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

  return {
    isConnected,
    events,
    availableEvents,
    activeSports,
    lastUpdate,
    error,
    connect,
    disconnect,
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

  const event = events[eventId] || null;

  return {
    event,
    isConnected,
    lastUpdate,
    error,
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
