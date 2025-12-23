import { useState, useEffect, useCallback, useRef } from 'react';

export function useGoalserveLive(options = {}) {
  const { gameId = null, autoConnect = true, onUpdate = null } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [liveScores, setLiveScores] = useState({});
  const [liveOdds, setLiveOdds] = useState({});
  const [ballPositions, setBallPositions] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      let url = '/api/goalserve/stream';
      if (gameId) {
        url += `?gameId=${encodeURIComponent(gameId)}`;
      }

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
            case 'score':
              setLiveScores(prev => ({
                ...prev,
                [data.data.gameId]: data.data
              }));
              break;
            
            case 'odds':
              setLiveOdds(prev => ({
                ...prev,
                [data.data.gameId]: data.data
              }));
              break;
            
            case 'position':
              setBallPositions(prev => ({
                ...prev,
                [data.data.gameId]: data.data
              }));
              break;
            
            case 'connected':
              console.log('[Goalserve Live] Initial status:', data.status);
              break;
            
            case 'heartbeat':
              break;
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
        
        if (reconnectAttempts.current < 5) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectAttempts.current++;
          console.log(`[Goalserve Live] Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) {
      console.error('[Goalserve Live] Connection error:', err);
      setError(err.message);
    }
  }, [gameId, onUpdate]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
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

  const getGameScore = useCallback((id) => {
    return liveScores[id] || null;
  }, [liveScores]);

  const getGameOdds = useCallback((id) => {
    return liveOdds[id] || null;
  }, [liveOdds]);

  const getGamePosition = useCallback((id) => {
    return ballPositions[id] || null;
  }, [ballPositions]);

  return {
    isConnected,
    liveScores,
    liveOdds,
    ballPositions,
    lastUpdate,
    error,
    connect,
    disconnect,
    getGameScore,
    getGameOdds,
    getGamePosition
  };
}

export function useLiveGame(gameId, options = {}) {
  const {
    isConnected,
    getGameScore,
    getGameOdds,
    getGamePosition,
    liveScores,
    liveOdds,
    ballPositions,
    ...rest
  } = useGoalserveLive({ ...options, gameId });

  return {
    isConnected,
    score: liveScores[gameId] || null,
    odds: liveOdds[gameId] || null,
    position: ballPositions[gameId] || null,
    ...rest
  };
}

export default useGoalserveLive;
