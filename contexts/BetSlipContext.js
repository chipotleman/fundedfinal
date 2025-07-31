
import { createContext, useContext, useState, useEffect } from 'react';

const BetSlipContext = createContext();

export const useBetSlip = () => {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
};

export const BetSlipProvider = ({ children }) => {
  const [betSlip, setBetSlip] = useState([]);
  const [showBetSlip, setShowBetSlip] = useState(false);

  // Load bet slip from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('betSlip');
    if (saved) {
      try {
        setBetSlip(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse saved bet slip:', error);
      }
    }
  }, []);

  // Save bet slip to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('betSlip', JSON.stringify(betSlip));
  }, [betSlip]);

  const addToBetSlip = (game, betType, odds, selection) => {
    const betId = `${game.id}-${betType}-${selection}`;
    const existingBetIndex = betSlip.findIndex(bet => bet.id === betId);
    
    if (existingBetIndex >= 0) {
      // Remove bet if it already exists (toggle off)
      setBetSlip(betSlip.filter(bet => bet.id !== betId));
    } else {
      // Add new bet
      const newBet = {
        id: betId,
        gameId: game.id,
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        betType,
        selection,
        odds,
        stake: 0
      };
      
      setBetSlip([...betSlip, newBet]);
      setShowBetSlip(true);
    }
  };

  const removeBet = (betId) => {
    setBetSlip(betSlip.filter(bet => bet.id !== betId));
  };

  const updateStake = (betId, stake) => {
    setBetSlip(betSlip.map(bet => 
      bet.id === betId ? { ...bet, stake: parseFloat(stake) || 0 } : bet
    ));
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
