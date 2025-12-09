import { useState } from 'react';
import { useBetSlip } from '../contexts/BetSlipContext';
import ShareableBetSlip from './ShareableBetSlip';
import BetReceipt from './BetReceipt';
import CoinRain from './CoinRain';

export default function BetSlip({ bankroll, onClose }) {
  const { betSlip: bets, removeBet, updateStake, clearBetSlip } = useBetSlip();
  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');
  const [parlayStake, setParlayStake] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWinningBet, setSelectedWinningBet] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [showCoinRain, setShowCoinRain] = useState(false);

  // TODO: Get user's challenge from context/props - will be implemented when challenge specs are provided
  const userChallenge = 'basic'; // Placeholder - will be dynamic

  // Challenge-based minimum bet amounts (to be configured based on specifications)
  const challengeMinBets = {
    'basic': 10,
    'premium': 25,
    'pro': 50,
    'elite': 100
  };

  const getMinBetAmount = () => {
    return challengeMinBets[userChallenge] || 10;
  };



  const calculatePayout = (odds, stake) => {
    // Handle case where odds might be an object
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    if (oddsValue > 0) {
      return (stake * oddsValue / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(oddsValue))) + stake;
    }
  };

  const totalStake = betType === 'parlay' ? parlayStake : bets.reduce((sum, bet) => sum + (bet.stake || 0), 0);

  const totalPayout = betType === 'parlay' && parlayStake > 0 
    ? (() => {
        const parlayDecimal = bets.reduce((acc, bet) => {
          const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
          const decimal = oddsValue > 0 ? (oddsValue/100 + 1) : (100/Math.abs(oddsValue) + 1);
          return acc * decimal;
        }, 1);
        return parlayStake * parlayDecimal;
      })()
    : bets.reduce((sum, bet) => 
        sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0
      );

  const potentialProfit = totalPayout - totalStake;

  // Validation logic
  const minBetAmount = getMinBetAmount();

  const validateBets = () => {
    if (betType === 'parlay') {
      return {
        isValid: parlayStake >= minBetAmount,
        hasStakes: parlayStake > 0,
        belowMinimum: parlayStake > 0 && parlayStake < minBetAmount,
        invalidBets: parlayStake < minBetAmount ? ['Parlay'] : []
      };
    } else {
      const betsWithoutStakes = bets.filter(bet => !bet.stake || bet.stake === 0);
      const betsWithLowStakes = bets.filter(bet => bet.stake > 0 && bet.stake < minBetAmount);

      return {
        isValid: bets.every(bet => bet.stake >= minBetAmount),
        hasStakes: bets.every(bet => bet.stake > 0),
        belowMinimum: betsWithLowStakes.length > 0,
        invalidBets: [...betsWithoutStakes.map(bet => bet.selection), ...betsWithLowStakes.map(bet => bet.selection)]
      };
    }
  };

  const validation = validateBets();

  const placeBets = async () => {
    if (totalStake === 0 || totalStake > bankroll) return;

    setIsPlacing(true);

    // Show receipt for bet(s) placed
    if (bets.length > 0) {
      if (betType === 'parlay' && parlayStake > 0) {
        // Calculate parlay odds
        const parlayDecimal = bets.reduce((acc, bet) => {
          const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
          const decimal = oddsValue > 0 ? (oddsValue/100 + 1) : (100/Math.abs(oddsValue) + 1);
          return acc * decimal;
        }, 1);
        const americanOdds = parlayDecimal >= 2 ? Math.round((parlayDecimal - 1) * 100) : Math.round(-100 / (parlayDecimal - 1));
        
        setCurrentReceipt({
          matchup: `${bets.length}-Leg Parlay`,
          team: bets.map(b => b.selection).join(', '),
          betType: 'parlay',
          odds: americanOdds,
          stake: parlayStake
        });
      } else if (bets[0].stake > 0) {
        const firstBet = bets[0];
        setCurrentReceipt({
          matchup: firstBet.matchup,
          team: firstBet.selection,
          betType: firstBet.betType,
          odds: typeof firstBet.odds === 'object' ? firstBet.odds.odds || firstBet.odds.value : firstBet.odds,
          stake: firstBet.stake
        });
      }
      setShowReceipt(true);
    }

    // Trigger coin rain animation
    setShowCoinRain(true);

    // Simulate bet placement
    setTimeout(() => {
      // Simulate some bets winning (for demo purposes)
      const winningBet = bets[0]; // Just take the first bet as winning for demo
      if (winningBet && winningBet.stake > 0) {
        setSelectedWinningBet(winningBet);
      }
      
      clearBetSlip();
      setIsPlacing(false);
      // Don't close immediately - let receipt show
    }, 500);
  };

  const formatOdds = (odds) => {
    // Handle case where odds might be an object
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    return oddsValue > 0 ? `+${oddsValue}` : oddsValue.toString();
  };



  return (
    <>
      {/* Coin Rain Animation */}
      <CoinRain trigger={showCoinRain} onComplete={() => setShowCoinRain(false)} />

      {/* Overlay */}
      <div className="fixed inset-0 bg-black/80 z-40" onClick={onClose}></div>

      {/* Bet Slip Modal - Centered */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md mx-4 mb-4 sm:mb-0 bg-black border border-gray-800/50 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-800/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center">
              <img src="/pikslogotransparent.png" alt="Piks" className="h-5 mr-2" />
              Bet Slip ({bets.length})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        {/* Bets - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {bets.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 font-medium mb-1">Your bet slip is empty</p>
              <p className="text-gray-600 text-sm">Click on odds to add bets</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {bets.map((bet) => (
                <div key={bet.id} className="bg-[#111111] rounded-xl p-3 border border-gray-800/50">
                  {/* Bet Header - Compact */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{bet.matchup}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-300 text-xs truncate">{bet.selection}</span>
                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0">
                          {formatOdds(bet.odds)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeBet(bet.id)}
                      className="text-gray-500 hover:text-red-400 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Stake Input - Inline with To Win */}
                  {betType === 'single' && (
                    <div className="flex items-center gap-3 mt-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={bet.stake || ''}
                          onChange={(e) => updateStake(bet.id, e.target.value)}
                          className={`w-full pl-7 pr-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none transition-colors ${
                            bet.stake > 0 && bet.stake < minBetAmount
                              ? 'border-red-500'
                              : 'border-gray-700 focus:border-green-500'
                          }`}
                          placeholder={`Min $${minBetAmount}`}
                        />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-gray-500 text-[10px]">TO WIN</div>
                        <div className="text-green-400 font-bold text-sm">
                          ${bet.stake ? (calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            {/* Bet Type Toggle */}
            <div className="bg-[#111111] rounded-xl p-4 mb-3 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-3">Bet Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setBetType('single')}
                  className={`font-semibold py-2.5 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'single' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                  }`}
                >
                  Singles
                </button>
                <button 
                  onClick={() => setBetType('parlay')}
                  className={`font-semibold py-2.5 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'parlay' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-[#1a1a1a] hover:bg-[#252525] text-white'
                  }`}
                >
                  Parlay
                </button>
              </div>
              {betType === 'parlay' && bets.length > 1 && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-sm font-medium">
                    Parlay Odds: {(() => {
                      const parlayDecimal = bets.reduce((acc, bet) => {
                        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
                        const decimal = oddsValue > 0 ? (oddsValue/100 + 1) : (100/Math.abs(oddsValue) + 1);
                        return acc * decimal;
                      }, 1);
                      const parlayAmerican = Math.round((parlayDecimal - 1) * 100);
                      return parlayAmerican > 0 ? `+${parlayAmerican}` : parlayAmerican.toString();
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Parlay Stake Input */}
            {betType === 'parlay' && bets.length > 1 && (
              <div className="bg-[#111111] rounded-xl p-4 mb-3 border border-gray-800/50">
                <h3 className="text-white font-semibold mb-3">Parlay Stake</h3>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={parlayStake || ''}
                    onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-8 pr-4 py-2.5 bg-[#1a1a1a] border rounded-lg text-white focus:outline-none transition-colors ${
                      parlayStake > 0 && parlayStake < minBetAmount
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-gray-700 focus:border-green-500'
                    }`}
                    placeholder={`Min $${minBetAmount}`}
                    min={minBetAmount}
                    max={bankroll}
                    step="0.01"
                  />
                </div>
                {parlayStake > 0 && parlayStake < minBetAmount && (
                  <div className="text-red-400 text-xs mt-1">
                    Minimum bet: ${minBetAmount}
                  </div>
                )}
                {parlayStake > 0 && (
                  <div className="text-right mt-2">
                    <div className="text-green-400 text-sm font-semibold">
                      To Win: ${(totalPayout - parlayStake).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Bet Amounts */}
            <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-3">Quick Amounts</h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (bets.length >= 1) {
                        if (betType === 'parlay') {
                          setParlayStake(amount);
                        } else {
                          bets.forEach(bet => updateStake(bet.id, amount));
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-[#1a1a1a] hover:bg-green-600 disabled:bg-[#1a1a1a]/50 text-white font-semibold py-2.5 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[250, 500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (bets.length >= 1) {
                        if (betType === 'parlay') {
                          setParlayStake(amount);
                        } else {
                          bets.forEach(bet => updateStake(bet.id, amount));
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-[#1a1a1a] hover:bg-green-600 disabled:bg-[#1a1a1a]/50 text-white font-semibold py-2.5 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Always visible at bottom */}
          {bets.length > 0 && (
            <div className="flex-shrink-0 p-4 border-t border-gray-800/50 bg-[#0a0a0a] rounded-b-2xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Total Stake:</span>
                <span className="text-white font-bold">${totalStake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Potential Win:</span>
                <span className="text-green-400 font-bold">${totalPayout.toFixed(2)}</span>
              </div>

              {/* Validation Messages - Compact */}
              {totalStake > bankroll && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 mb-3">
                  <p className="text-red-400 text-xs font-medium">
                    Insufficient balance. Available: ${bankroll.toFixed(2)}
                  </p>
                </div>
              )}

              {validation.belowMinimum && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 mb-3">
                  <p className="text-red-400 text-xs font-medium">
                    Minimum bet: ${minBetAmount}
                  </p>
                </div>
              )}

              {/* Place Bet Button */}
              <button
                onClick={placeBets}
                disabled={!validation.isValid || totalStake > bankroll || isPlacing}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {isPlacing ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Placing...</span>
                  </div>
                ) : (
                  `Place ${bets.length} Bet${bets.length > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shareable Bet Slip Modal */}
      <ShareableBetSlip 
        bet={selectedWinningBet}
        isVisible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedWinningBet(null);
        }}
      />

      {/* Bet Receipt Modal */}
      {showReceipt && currentReceipt && (
        <BetReceipt 
          bet={currentReceipt} 
          isDemo={false}
          onClose={() => {
            setShowReceipt(false);
            setCurrentReceipt(null);
            onClose(); // Close bet slip after receipt is dismissed
          }}
        />
      )}
    </>
  );
}