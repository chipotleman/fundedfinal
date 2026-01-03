import { useState, useEffect, useRef, useCallback } from 'react';

export function useLiveScoreStream() {
  const [scores, setScores] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const eventSource = new EventSource('/api/games/stream');
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('[LiveScore] Connected to stream');
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'init' || data.type === 'scores') {
          setScores(data.scores || {});
          setLastUpdate(data.timestamp);
        }
      } catch (err) {
        console.error('[LiveScore] Parse error:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('[LiveScore] Connection error');
      setIsConnected(false);
      eventSource.close();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[LiveScore] Reconnecting...');
        connect();
      }, 3000);
    };
  }, []);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);
  
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  const getGameScore = useCallback((gameId, sport) => {
    const key = `${sport}_${gameId}`;
    return scores[key] || null;
  }, [scores]);
  
  return {
    scores,
    isConnected,
    lastUpdate,
    getGameScore,
    reconnect: connect
  };
}

export default useLiveScoreStream;
