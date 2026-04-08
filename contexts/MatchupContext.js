import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const MatchupContext = createContext(null);

export function MatchupProvider({ children }) {
  const { data: session, status } = useSession();
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentMatchup = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/matchups/current');
      const data = await response.json();
      
      if (response.ok) {
        setMatchupData(data);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Fetch matchup error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCurrentMatchup();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setMatchupData(null);
    }
  }, [status, fetchCurrentMatchup]);

  const hasActiveMatchup = matchupData?.status === 'active' || matchupData?.status === 'matched';
  const isWaiting = matchupData?.status === 'waiting';
  const hasAnyMatchup = hasActiveMatchup || isWaiting;
  const isQueued = matchupData?.status === 'queued';

  useEffect(() => {
    if (status !== 'authenticated') return;

    const pollInterval = hasActiveMatchup ? 5000 : isWaiting ? 10000 : 30000;
    const interval = setInterval(fetchCurrentMatchup, pollInterval);
    return () => clearInterval(interval);
  }, [status, fetchCurrentMatchup, hasActiveMatchup, isWaiting]);
  const matchup = matchupData?.matchup;
  const opponent = matchupData?.opponent;
  const myBalance = matchupData?.myBalance;
  const opponentBalance = matchupData?.opponentBalance;
  const myBets = matchupData?.myBets || [];
  const opponentBets = matchupData?.opponentBets || [];
  const canSeeOpponentBets = matchupData?.canSeeOpponentBets || false;
  const timeRemaining = matchupData?.timeRemaining;
  const endsAt = matchupData?.endsAt;

  const value = {
    matchupData,
    matchup,
    opponent,
    myBalance,
    opponentBalance,
    myBets,
    opponentBets,
    canSeeOpponentBets,
    timeRemaining,
    endsAt,
    hasActiveMatchup,
    isWaiting,
    hasAnyMatchup,
    isQueued,
    loading,
    error,
    refresh: fetchCurrentMatchup,
  };

  return (
    <MatchupContext.Provider value={value}>
      {children}
    </MatchupContext.Provider>
  );
}

export function useMatchup() {
  const context = useContext(MatchupContext);
  if (!context) {
    throw new Error('useMatchup must be used within MatchupProvider');
  }
  return context;
}
