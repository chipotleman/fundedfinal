import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

const MatchupContext = createContext(null);

const FORFEIT_ACK_KEY = 'piks_forfeit_acks_v1';

function readForfeitAcks() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(FORFEIT_ACK_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch (_e) {
    return new Set();
  }
}

function writeForfeitAcks(set) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FORFEIT_ACK_KEY, JSON.stringify([...set]));
  } catch (_e) {}
}

export function MatchupProvider({ children }) {
  const { data: session, status } = useSession();
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forfeitNotice, setForfeitNotice] = useState(null);
  const prevMatchupIdRef = useRef(null);

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

        // Forfeit-win detection: surface a one-time notice for any
        // recentForfeit we haven't ack'd yet in this session.
        if (data?.recentForfeit?.matchupId) {
          const acks = readForfeitAcks();
          if (!acks.has(data.recentForfeit.matchupId)) {
            setForfeitNotice(data.recentForfeit);
          }
        }
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

  // Track matchup id transitions so we can hit the API immediately
  // when an active battle disappears (likely an opponent forfeit).
  useEffect(() => {
    const currentId = matchupData?.matchup?.id || null;
    const prevId = prevMatchupIdRef.current;
    if (prevId && !currentId) {
      // Active matchup just went away — re-fetch shortly to pick up
      // the forfeit-completion record.
      const t = setTimeout(() => { fetchCurrentMatchup(); }, 400);
      return () => clearTimeout(t);
    }
    prevMatchupIdRef.current = currentId;
  }, [matchupData?.matchup?.id, fetchCurrentMatchup]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Background safety-fallback poll. Real-time updates arrive via the
    // SSE channel below; this only catches missed events (reconnects, etc).
    const pollInterval = hasActiveMatchup ? 20000 : (isWaiting || isQueued) ? 10000 : 30000;
    const interval = setInterval(fetchCurrentMatchup, pollInterval);
    return () => clearInterval(interval);
  }, [status, fetchCurrentMatchup, hasActiveMatchup, isWaiting, isQueued]);

  // Real-time push channel for battle events (forfeits, etc).
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    let es = null;
    let reconnectTimer = null;
    let closed = false;

    const connect = () => {
      try {
        es = new EventSource('/api/battles/stream');
      } catch (_e) {
        return;
      }

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data?.type === 'matchup:forfeit') {
            // Re-fetch immediately so the "Won by Forfeit" modal and
            // updated balances surface within the SSE round-trip.
            fetchCurrentMatchup();
          } else if (data?.type === 'matchup:bet') {
            // Opponent placed a bet — refresh so their balance and
            // bet list update without waiting for the safety poll.
            fetchCurrentMatchup();
          }
        } catch (_e) {}
      };

      es.onerror = () => {
        if (closed) return;
        try { es && es.close(); } catch (_e) {}
        es = null;
        // Reconnect with a small backoff.
        reconnectTimer = setTimeout(() => {
          if (!closed) connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { es && es.close(); } catch (_e) {}
    };
  }, [status, session?.user?.id, fetchCurrentMatchup]);

  const acknowledgeForfeit = useCallback(() => {
    if (!forfeitNotice?.matchupId) {
      setForfeitNotice(null);
      return;
    }
    const acks = readForfeitAcks();
    acks.add(forfeitNotice.matchupId);
    writeForfeitAcks(acks);
    setForfeitNotice(null);
  }, [forfeitNotice?.matchupId]);

  const matchup = matchupData?.matchup;
  const opponent = matchupData?.opponent;
  const myBalance = matchupData?.myBalance;
  const opponentBalance = matchupData?.opponentBalance;
  const myBets = matchupData?.myBets || [];
  const opponentBets = matchupData?.opponentBets || [];
  const canSeeOpponentBets = matchupData?.canSeeOpponentBets || false;
  const timeRemaining = matchupData?.timeRemaining;
  const endsAt = matchupData?.endsAt;
  const queueEntry = matchupData?.queueEntry;
  const myProfile = matchupData?.myProfile;

  const value = {
    matchupData,
    matchup,
    opponent,
    myProfile,
    myBalance,
    opponentBalance,
    myBets,
    opponentBets,
    canSeeOpponentBets,
    timeRemaining,
    endsAt,
    queueEntry,
    hasActiveMatchup,
    isWaiting,
    hasAnyMatchup,
    isQueued,
    loading,
    error,
    refresh: fetchCurrentMatchup,
    forfeitNotice,
    acknowledgeForfeit,
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
