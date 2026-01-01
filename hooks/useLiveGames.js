import { useState, useEffect, useCallback, useRef } from 'react';

const FAST_POLL_INTERVAL = 5000;
const SLOW_POLL_INTERVAL = 30000;
const IDLE_POLL_INTERVAL = 60000;

export function useLiveGames(options = {}) {
  const { 
    sport = null, 
    autoStart = true,
    onUpdate = null 
  } = options;

  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pollInterval, setPollInterval] = useState(FAST_POLL_INTERVAL);
  const [hasLiveGames, setHasLiveGames] = useState(false);

  const pollingRef = useRef(null);
  const isMountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);

  const fetchLiveGames = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sport) params.set('sport', sport);
      
      const response = await fetch(`/api/live?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!isMountedRef.current) return;

      if (data.success) {
        setGames(data.games || []);
        setLastUpdate(data.timestamp);
        setError(null);
        consecutiveErrorsRef.current = 0;

        const liveCount = data.games?.length || 0;
        setHasLiveGames(liveCount > 0);

        if (liveCount > 0) {
          setPollInterval(FAST_POLL_INTERVAL);
        } else {
          setPollInterval(SLOW_POLL_INTERVAL);
        }

        if (onUpdate) {
          onUpdate(data.games);
        }
      }
    } catch (err) {
      console.error('[useLiveGames] Fetch error:', err);
      consecutiveErrorsRef.current += 1;
      
      if (isMountedRef.current) {
        setError(err.message);
        
        if (consecutiveErrorsRef.current >= 3) {
          setPollInterval(IDLE_POLL_INTERVAL);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sport, onUpdate]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    fetchLiveGames();

    pollingRef.current = setInterval(() => {
      fetchLiveGames();
    }, pollInterval);
  }, [fetchLiveGames, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return fetchLiveGames();
  }, [fetchLiveGames]);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = setInterval(fetchLiveGames, pollInterval);
    }
  }, [pollInterval, fetchLiveGames]);

  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart) {
      startPolling();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [autoStart, startPolling, stopPolling]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (autoStart) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoStart, startPolling, stopPolling]);

  return {
    games,
    isLoading,
    error,
    lastUpdate,
    pollInterval,
    hasLiveGames,
    refresh,
    startPolling,
    stopPolling
  };
}

export function useLiveGame(gameId, sport = null) {
  const { games, ...rest } = useLiveGames({ sport });
  
  const game = games.find(g => 
    g.id === gameId || g.id?.toString() === gameId?.toString()
  );

  return {
    game,
    ...rest
  };
}
