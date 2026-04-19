import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getBattleStreamClient } from '../lib/battleStreamClient';

const MatchupContext = createContext(null);

export function MatchupProvider({ children }) {
  const { data: session, status } = useSession();
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forfeitNotice, setForfeitNotice] = useState(null);
  const prevMatchupIdRef = useRef(null);
  // Per-tab in-memory guard: tracks matchupIds the user has just dismissed
  // so a duplicate forfeit event arriving from another channel before the
  // server ack POST is processed doesn't reopen the modal. Cleared on reload.
  const dismissedForfeitIdsRef = useRef(new Set());

  const surfaceForfeitNotice = useCallback((notice) => {
    if (!notice?.matchupId) return;
    if (dismissedForfeitIdsRef.current.has(notice.matchupId)) return;
    setForfeitNotice(notice);
  }, []);

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

        // Forfeit-win detection: the server only returns recentForfeit
        // when the persistent flag is set and not yet acknowledged, so
        // surface it directly. Dismissal is persisted via /api/battles/forfeit-ack.
        if (data?.recentForfeit?.matchupId) {
          surfaceForfeitNotice(data.recentForfeit);
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
  }, [session?.user?.id, status, surfaceForfeitNotice]);

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
      // Active matchup just went away — re-fetch immediately to pick up
      // the forfeit-completion record. (The SSE forfeit event already
      // surfaces the modal directly; this reconciles balances/bets.)
      fetchCurrentMatchup();
    }
    prevMatchupIdRef.current = currentId;
  }, [matchupData?.matchup?.id, fetchCurrentMatchup]);

  // Fallback poll while SSE is unhealthy. We do NOT poll on a fixed clock
  // when the stream is connected — the SSE channel below pushes every state
  // change and re-fetches on reconnect. This effect is triggered by the SSE
  // client emitting `piks:disconnected` (see handler below) which sets
  // `sseHealthy` to false. Once SSE comes back, we clear the interval.
  const [sseHealthy, setSseHealthy] = useState(true);
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (sseHealthy) return;

    // SSE has been broken — start a fallback poll after a short grace period
    // (so quick blips don't cause an immediate fetch on top of the normal
    // reconnect re-fetch), then keep polling at a steady cadence until the
    // stream recovers.
    const FALLBACK_GRACE_MS = 15000;
    const FALLBACK_INTERVAL_MS = hasActiveMatchup ? 20000 : (isWaiting || isQueued) ? 10000 : 30000;

    let interval = null;
    const grace = setTimeout(() => {
      fetchCurrentMatchup();
      interval = setInterval(fetchCurrentMatchup, FALLBACK_INTERVAL_MS);
    }, FALLBACK_GRACE_MS);

    return () => {
      clearTimeout(grace);
      if (interval) clearInterval(interval);
    };
  }, [status, sseHealthy, fetchCurrentMatchup, hasActiveMatchup, isWaiting, isQueued]);

  // Real-time push channel for battle events (forfeits, etc).
  // Uses the shared SSE singleton so only ONE EventSource connection is opened
  // per browser tab regardless of how many contexts subscribe.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (typeof window === 'undefined') return;

    const client = getBattleStreamClient();
    if (!client) return;

    const myId = session.user.id;

    const handleEvent = (data) => {
      // SSE re-established after a drop — immediately re-fetch so any event
      // that arrived during the reconnect window is caught without waiting for
      // the safety poll.
      if (data?.type === 'piks:reconnected') {
        setSseHealthy(true);
        fetchCurrentMatchup();
        return;
      }
      if (data?.type === 'piks:disconnected') {
        setSseHealthy(false);
        return;
      }
      if (data?.type === 'connected') {
        // If we were previously unhealthy (e.g. initial connect failed and
        // fallback polling has been running), fetch immediately on recovery
        // so the user sees fresh state without waiting for the next poll.
        setSseHealthy(prev => {
          if (prev === false) fetchCurrentMatchup();
          return true;
        });
        return;
      }
      if (data?.type === 'matchup:forfeit') {
        // If this user is the winner, surface the "Won by Forfeit"
        // modal immediately from the push payload — don't wait on
        // the /api/matchups/current round-trip.
        if (data.winnerId === myId && data.matchupId) {
          surfaceForfeitNotice({
            matchupId: data.matchupId,
            winnerPayout: Number(data.winnerPayout) || 0,
            opponent: data.loser || { username: 'Opponent', avatar: null },
            endedAt: new Date().toISOString(),
          });
        }
        // Still re-fetch in the background so balances/bets reconcile.
        fetchCurrentMatchup();
      } else if (data?.type === 'matchup:bet') {
        // Opponent placed a bet — refresh so their balance and
        // bet list update without waiting for the safety poll.
        fetchCurrentMatchup();
      } else if (data?.type === 'matchup:completed') {
        // Battle ended naturally at timer expiry — re-fetch so
        // the result modal and final balances appear without
        // waiting for the next safety poll.
        fetchCurrentMatchup();
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('piks:firstBattleCompleted'));
          }
        } catch (_e) {}
      } else if (data?.type === 'matchup:pnl') {
        // Push-based live PnL. If the payload carries
        // mark-to-market live balances, merge them into local
        // state directly so the opponent's PnL truly tracks odds
        // movement without an API round-trip. For payloads that
        // signal a state change (bet placed/graded), still
        // re-fetch so bet lists/statuses come along too.
        const reason = data.reason;
        const hasLiveFields =
          data.user1LiveBalance != null || data.user2LiveBalance != null;

        if (reason === 'mark-to-market' && hasLiveFields) {
          setMatchupData(prev => {
            if (!prev || !prev.matchup || prev.matchup.id !== data.matchupId) {
              return prev;
            }
            const isU1Side = prev.isUser1 === true;
            const myLive = parseFloat(
              isU1Side ? data.user1LiveBalance : data.user2LiveBalance
            );
            const oppLive = parseFloat(
              isU1Side ? data.user2LiveBalance : data.user1LiveBalance
            );
            const myUnreal = parseFloat(
              isU1Side ? data.user1UnrealizedPnl : data.user2UnrealizedPnl
            );
            const oppUnreal = parseFloat(
              isU1Side ? data.user2UnrealizedPnl : data.user1UnrealizedPnl
            );
            return {
              ...prev,
              myLiveBalance: Number.isFinite(myLive) ? myLive : prev.myLiveBalance,
              opponentLiveBalance: Number.isFinite(oppLive) ? oppLive : prev.opponentLiveBalance,
              myUnrealizedPnl: Number.isFinite(myUnreal) ? myUnreal : prev.myUnrealizedPnl,
              opponentUnrealizedPnl: Number.isFinite(oppUnreal) ? oppUnreal : prev.opponentUnrealizedPnl,
            };
          });
        } else {
          fetchCurrentMatchup();
        }
      }
    };

    // Initialize health from the shared client's current state, so a late-
    // mounting subscriber (the SSE singleton may already be connected by
    // the time this provider mounts) doesn't incorrectly start in an
    // unhealthy state and trigger fallback polling.
    if (typeof client.getState === 'function') {
      const initialState = client.getState();
      if (initialState === 'connected') {
        setSseHealthy(true);
      } else if (initialState === 'disconnected') {
        setSseHealthy(false);
      }
    }

    const unsubscribe = client.subscribe(handleEvent);

    // Connect watchdog: if after this window the client still hasn't
    // reached a 'connected' state, mark the stream unhealthy so the
    // fallback poll engages. Polling the explicit getState() avoids the
    // late-subscriber pitfall of relying on replayed lifecycle events.
    const CONNECT_WATCHDOG_MS = 10000;
    const connectWatchdog = setTimeout(() => {
      const s = typeof client.getState === 'function' ? client.getState() : null;
      if (s !== 'connected') {
        setSseHealthy(false);
      }
    }, CONNECT_WATCHDOG_MS);

    // Second push path: NotificationsContext dispatches this when it receives
    // a notification:forfeit event, giving two independent delivery channels.
    const handleForfeitWin = (e) => {
      const data = e.detail;
      if (!data?.matchupId || !data?.winnerId || data.winnerId !== myId) return;
      surfaceForfeitNotice({
        matchupId: data.matchupId,
        winnerPayout: Number(data.winnerPayout) || 0,
        opponent: data.loser || { username: 'Opponent', avatar: null },
        endedAt: new Date().toISOString(),
      });
      // Background reconcile.
      fetchCurrentMatchup();
    };
    window.addEventListener('piks:forfeit:win', handleForfeitWin);

    // Catch-up: when the tab becomes active after being backgrounded, immediately
    // reconnect the SSE and re-fetch matchup state — no more 20-second wait.
    const handleVisibility = () => {
      if (!document.hidden) {
        client.reconnectNow();
        fetchCurrentMatchup();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(connectWatchdog);
      unsubscribe();
      window.removeEventListener('piks:forfeit:win', handleForfeitWin);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, session?.user?.id, fetchCurrentMatchup, surfaceForfeitNotice]);

  const acknowledgeForfeit = useCallback(() => {
    const matchupId = forfeitNotice?.matchupId;
    if (!matchupId) {
      setForfeitNotice(null);
      return;
    }
    dismissedForfeitIdsRef.current.add(matchupId);
    setForfeitNotice(null);
    // Persist the acknowledgement server-side so the modal doesn't
    // resurface on the next /api/matchups/current or /api/notifications
    // poll. The persistent matchups.forfeitAcknowledgedAt flag is the
    // single source of truth.
    fetch('/api/battles/forfeit-ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchupId }),
    }).catch(() => {});
  }, [forfeitNotice?.matchupId]);

  const matchup = matchupData?.matchup;
  const opponent = matchupData?.opponent;
  const myBalance = matchupData?.myBalance;
  const opponentBalance = matchupData?.opponentBalance;
  const myLiveBalance = matchupData?.myLiveBalance;
  const opponentLiveBalance = matchupData?.opponentLiveBalance;
  const myUnrealizedPnl = matchupData?.myUnrealizedPnl;
  const opponentUnrealizedPnl = matchupData?.opponentUnrealizedPnl;
  const myPendingAtRiskCount = matchupData?.myPendingAtRiskCount || 0;
  const opponentPendingAtRiskCount = matchupData?.opponentPendingAtRiskCount || 0;
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
    myLiveBalance,
    opponentLiveBalance,
    myUnrealizedPnl,
    opponentUnrealizedPnl,
    myPendingAtRiskCount,
    opponentPendingAtRiskCount,
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
    sseHealthy,
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
