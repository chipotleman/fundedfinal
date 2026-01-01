import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.thepiks.com';
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL = 30000;

export function useHybridWebSocket({ autoConnect = true, onEvent } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      console.log('[Hybrid WS] Connecting to:', WS_URL);
      
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        
        console.log('[Hybrid WS] Connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            return;
          }

          if (data.type === 'connected') {
            console.log('[Hybrid WS] Server acknowledged connection');
            return;
          }

          if (data.type === 'initial' || data.type === 'update') {
            const newEvents = {};
            (data.events || []).forEach(evt => {
              newEvents[evt.id] = evt;
            });
            
            setEvents(prev => ({ ...prev, ...newEvents }));
            setLastUpdate(data.timestamp || Date.now());
            
            if (onEvent) {
              onEvent(data);
            }
          }
        } catch (e) {
          console.error('[Hybrid WS] Message parse error:', e);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        console.log('[Hybrid WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current);
          console.log(`[Hybrid WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setConnectionStatus('failed');
          console.log('[Hybrid WS] Max reconnect attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('[Hybrid WS] Error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('[Hybrid WS] Connection error:', error);
      setConnectionStatus('error');
    }
  }, [onEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const subscribe = useCallback((sports) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        sports: Array.isArray(sports) ? sports : [sports]
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (autoConnect) {
      connect();
    }
    
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    events,
    lastUpdate,
    connect,
    disconnect,
    subscribe,
    eventCount: Object.keys(events).length
  };
}

export default useHybridWebSocket;
