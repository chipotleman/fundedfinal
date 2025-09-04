import { useState } from 'react';
import { useBetSlip } from '../contexts/BetSlipContext';
import ShareableBetSlip from './ShareableBetSlip';

export default function BetSlip({ bankroll, onClose }) {
  const { betSlip: bets, removeBet, updateStake, clearBetSlip } = useBetSlip();
  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');
  const [parlayStake, setParlayStake] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWinningBet, setSelectedWinningBet] = useState(null);

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

    // Simulate bet placement
    setTimeout(() => {
      // Simulate some bets winning (for demo purposes)
      const winningBet = bets[0]; // Just take the first bet as winning for demo
      if (winningBet && winningBet.stake > 0) {
        setSelectedWinningBet(winningBet);
        setShowShareModal(true);
      }
      
      alert(`${bets.length} bet(s) placed successfully!`);
      clearBetSlip();
      setIsPlacing(false);
      onClose();
    }, 1500);
  };

  const formatOdds = (odds) => {
    // Handle case where odds might be an object
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    return oddsValue > 0 ? `+${oddsValue}` : oddsValue.toString();
  };



  return (
    <>
      {/* Desktop Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>

      {/* Bet Slip Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm lg:max-w-md lg:w-96 bg-slate-800 border-l border-slate-700 flex flex-col z-50 transform translate-x-0 transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Bet Slip ({bets.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bets */}
      <div className="flex-1 overflow-y-auto">
        {bets.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-lg font-medium mb-2">Your bet slip is empty</p>
            <p className="text-gray-500 text-sm">Click on odds to add bets</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {bets.map((bet) => (
              <div key={bet.id} className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                {/* Bet Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm mb-1">{bet.matchup}</div>
                    <div className="text-gray-300 text-sm">{bet.selection}</div>
                    <div className="text-gray-400 text-xs">{bet.betType}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-semibold">
                      {formatOdds(bet.odds)}
                    </span>
                    <button
                      onClick={() => removeBet(bet.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Stake Input - Only show for singles */}
                {betType === 'single' && (
                  <div className="space-y-2">
                    <label className="text-gray-300 text-sm font-medium">Stake</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={bet.stake || ''}
                        onChange={(e) => updateStake(bet.id, e.target.value)}
                        className={`w-full pl-8 pr-4 py-2 bg-slate-800 border rounded-lg text-white focus:outline-none transition-colors ${
                          bet.stake > 0 && bet.stake < minBetAmount
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-slate-600 focus:border-green-400'
                        }`}
                        placeholder={`Min $${minBetAmount}`}
                        min={minBetAmount}
                        max={bankroll}
                        step="0.01"
                      />
                    </div>
                    {bet.stake > 0 && bet.stake < minBetAmount && (
                      <div className="text-red-400 text-xs mt-1">
                        Minimum bet: ${minBetAmount}
                      </div>
                    )}
                    {bet.stake > 0 && (
                      <div className="text-right">
                        <div className="text-green-400 text-sm font-semibold">
                          To Win: ${(calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Bet Type Toggle */}
            <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
              <h3 className="text-white font-semibold mb-3">Bet Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setBetType('single')}
                  className={`font-semibold py-2 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'single' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  Singles
                </button>
                <button 
                  onClick={() => setBetType('parlay')}
                  className={`font-semibold py-2 px-3 rounded-lg text-sm transition-colors ${
                    betType === 'parlay' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  Parlay
                </button>
              </div>
              {betType === 'parlay' && bets.length > 1 && (
                <div className="mt-3 p-3 bg-blue-500/20 rounded-lg">
                  <p className="text-blue-400 text-sm font-medium">
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
              <div className="bg-slate-700/50 rounded-xl p-4 mb-4">
                <h3 className="text-white font-semibold mb-3">Parlay Stake</h3>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={parlayStake || ''}
                    onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                    className={`w-full pl-8 pr-4 py-2 bg-slate-800 border rounded-lg text-white focus:outline-none transition-colors ${
                      parlayStake > 0 && parlayStake < minBetAmount
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-slate-600 focus:border-green-400'
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
            <div className="bg-slate-700/50 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3">Quick Amounts</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      if (bets.length >= 1) {
                        if (betType === 'parlay') {
                          // For parlay, set the parlay stake
                          setParlayStake(amount);
                        } else {
                          // For singles, set amount on all bets
                          bets.forEach(bet => updateStake(bet.id, amount));
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-slate-800 hover:bg-green-500 disabled:bg-slate-800/50 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
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
                          // For parlay, set the parlay stake
                          setParlayStake(amount);
                        } else {
                          // For singles, set amount on all bets
                          bets.forEach(bet => updateStake(bet.id, amount));
                        }
                      }
                    }}
                    disabled={bets.length === 0}
                    className="bg-slate-800 hover:bg-green-500 disabled:bg-slate-800/50 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {bets.length > 0 && (
        <div className="p-6 border-t border-slate-700 space-y-4">
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Total Stake:</span>
              <span className="font-semibold">${totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Potential Payout:</span>
              <span className="font-semibold">${totalPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-400 font-bold text-lg border-t border-slate-600 pt-2">
              <span>Potential Profit:</span>
              <span>${potentialProfit.toFixed(2)}</span>
            </div>
          </div>

          {/* Validation Messages */}
          {totalStake > bankroll && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-medium">
                Insufficient balance. Available: ${bankroll.toFixed(2)}
              </p>
            </div>
          )}

          {!validation.hasStakes && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-400 text-sm font-medium">
                Please enter a stake amount for all bets
              </p>
            </div>
          )}

          {validation.belowMinimum && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm font-medium">
                Minimum bet amount is ${minBetAmount} for your challenge level
              </p>
              {validation.invalidBets.length > 0 && (
                <p className="text-red-300 text-xs mt-1">
                  Invalid: {validation.invalidBets.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Place Bet Button */}
          <button
            onClick={placeBets}
            disabled={!validation.isValid || totalStake > bankroll || isPlacing}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isPlacing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Placing Bets...</span>
              </div>
            ) : (
              `Place ${bets.length} Bet${bets.length > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
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
    </>
  );
}