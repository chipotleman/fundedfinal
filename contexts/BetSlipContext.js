
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { triggerHaptic } from '../utils/haptics';

const BetSlipContext = createContext();

export const useBetSlip = () => {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
};

const generateVisitorId = () => {
  if (typeof window === 'undefined') return null;
  let visitorId = localStorage.getItem('piks_visitor_id');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('piks_visitor_id', visitorId);
  }
  return visitorId;
};

const generateSessionId = () => {
  if (typeof window === 'undefined') return null;
  let sessionId = sessionStorage.getItem('piks_session_id');
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem('piks_session_id', sessionId);
  }
  return sessionId;
};

export const BetSlipProvider = ({ children }) => {
  const { data: session } = useSession();
  const [betSlip, setBetSlip] = useState([]);
  const [showBetSlip, setShowBetSlip] = useState(false);

  const userId = session?.user?.id || null;

  const trackBetSlipEvent = useCallback(async (eventType, betData) => {
    if (typeof window === 'undefined') return;
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            type: eventType,
            userId,
            visitorId: generateVisitorId(),
            sessionId: generateSessionId(),
            data: betData,
            pageUrl: window.location.pathname,
          }]
        }),
      });
    } catch (error) {
      console.error('Failed to track bet slip event:', error);
    }
  }, [userId]);

  // Load bet slip from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('betSlip');
    const savedShowState = localStorage.getItem('showBetSlip');
    if (saved) {
      try {
        setBetSlip(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse saved bet slip:', error);
      }
    }
    if (savedShowState) {
      setShowBetSlip(JSON.parse(savedShowState));
    }
  }, []);

  // Save bet slip to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('betSlip', JSON.stringify(betSlip));
  }, [betSlip]);

  // Save show bet slip state to localStorage
  useEffect(() => {
    localStorage.setItem('showBetSlip', JSON.stringify(showBetSlip));
  }, [showBetSlip]);

  useEffect(() => {
    const handleOpenBetSlip = () => {
      setShowBetSlip(true);
    };

    window.addEventListener('openBetSlip', handleOpenBetSlip);
    return () => {
      window.removeEventListener('openBetSlip', handleOpenBetSlip);
    };
  }, []);

  const addToBetSlip = (game, betType, odds, selection) => {
    const betId = `${game.id}-${betType}-${selection}`;
    const existingBetIndex = betSlip.findIndex(bet => bet.id === betId);
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    
    if (existingBetIndex >= 0) {
      const removedBet = betSlip[existingBetIndex];
      setBetSlip(betSlip.filter(bet => bet.id !== betId));
      triggerHaptic('tap');
      trackBetSlipEvent('bet_removed_toggle', {
        betId,
        matchup: removedBet.matchup,
        selection: removedBet.selection,
        odds: removedBet.odds,
        betType: removedBet.betType,
      });
    } else {
      const filteredSlip = betSlip.filter(bet => {
        const isSameGameAndType = bet.gameId === game.id && bet.betType === betType;
        if (isSameGameAndType) {
          trackBetSlipEvent('bet_removed_conflict', {
            betId: bet.id,
            matchup: bet.matchup,
            selection: bet.selection,
            odds: bet.odds,
            betType: bet.betType,
            replacedBy: selection,
          });
        }
        return !isSameGameAndType;
      });
      
      const capturedIsLive = !!(game.isLive || game.status === 'IN_PROGRESS');
      const capturedAwayScore = game.awayScore ?? game.scores?.away?.total ?? 0;
      const capturedHomeScore = game.homeScore ?? game.scores?.home?.total ?? 0;
      
      console.log('[BetSlipContext] Adding bet with game data:', JSON.stringify({
        gameId: game.id,
        isLive: capturedIsLive,
        status: game.status,
        awayScore: capturedAwayScore,
        homeScore: capturedHomeScore,
        gameAwayScore: game.awayScore,
        gameHomeScore: game.homeScore,
        scoresAway: game.scores?.away?.total,
        scoresHome: game.scores?.home?.total
      }));
      
      const newBet = {
        id: betId,
        gameId: game.id,
        matchup: `${game.awayTeamFull || game.awayTeam} @ ${game.homeTeamFull || game.homeTeam}`,
        betType,
        selection,
        odds: oddsValue,
        stake: 0,
        isLive: capturedIsLive,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        awayTeamFull: game.awayTeamFull || game.awayTeam,
        homeTeamFull: game.homeTeamFull || game.homeTeam,
        awayScore: capturedAwayScore,
        homeScore: capturedHomeScore,
        gameTime: game.time || '',
        gameStart: game.startTime || null,
        sportName: game.sportName || ''
      };
      
      setBetSlip([...filteredSlip, newBet]);
      triggerHaptic('tap');
      trackBetSlipEvent('bet_added', {
        betId,
        matchup: newBet.matchup,
        selection,
        odds: oddsValue,
        betType,
        gameId: game.id,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
      });
    }
  };

  const removeBet = (betId) => {
    const removedBet = betSlip.find(bet => bet.id === betId);
    setBetSlip(betSlip.filter(bet => bet.id !== betId));
    triggerHaptic('tap');
    if (removedBet) {
      trackBetSlipEvent('bet_removed', {
        betId,
        matchup: removedBet.matchup,
        selection: removedBet.selection,
        odds: removedBet.odds,
        betType: removedBet.betType,
        stake: removedBet.stake,
      });
    }
  };

  const updateStake = (betId, stake) => {
    const bet = betSlip.find(b => b.id === betId);
    const newStake = parseFloat(stake) || 0;
    setBetSlip(betSlip.map(b => 
      b.id === betId ? { ...b, stake: newStake } : b
    ));
    if (bet && newStake > 0) {
      trackBetSlipEvent('stake_updated', {
        betId,
        matchup: bet.matchup,
        selection: bet.selection,
        oldStake: bet.stake,
        newStake,
        odds: bet.odds,
      });
    }
  };

  const clearBetSlip = () => {
    setBetSlip([]);
    setShowBetSlip(false);
  };

  const isBetInSlip = (game, betType, selection) => {
    const betId = `${game.id}-${betType}-${selection}`;
    return betSlip.some(bet => bet.id === betId);
  };

  return (
    <BetSlipContext.Provider value={{
      betSlip,
      setBetSlip,
      showBetSlip,
      setShowBetSlip,
      addToBetSlip,
      removeBet,
      updateStake,
      clearBetSlip,
      isBetInSlip
    }}>
      {children}
    </BetSlipContext.Provider>
  );
};
