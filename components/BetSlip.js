import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useBetSlip } from '../contexts/BetSlipContext';
import ShareableBetSlip from './ShareableBetSlip';
import BetReceipt from './BetReceipt';
import CoinRain from './CoinRain';

export default function BetSlip({ bankroll, onClose, isOpen }) {
  const { betSlip: bets, removeBet, updateStake, clearBetSlip } = useBetSlip();
  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');
  const [parlayStake, setParlayStake] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWinningBet, setSelectedWinningBet] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const userChallenge = 'basic';
  const challengeMinBets = {
    'basic': 10,
    'premium': 25,
    'pro': 50,
    'elite': 100
  };

  const getMinBetAmount = () => challengeMinBets[userChallenge] || 10;
  const minBetAmount = getMinBetAmount();

  const calculatePayout = (odds, stake) => {
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
    : bets.reduce((sum, bet) => sum + (bet.stake ? calculatePayout(bet.odds, bet.stake) : 0), 0);

  const validateBets = () => {
    if (betType === 'parlay') {
      return {
        isValid: parlayStake >= minBetAmount,
        hasStakes: parlayStake > 0,
        belowMinimum: parlayStake > 0 && parlayStake < minBetAmount
      };
    } else {
      const betsWithLowStakes = bets.filter(bet => bet.stake > 0 && bet.stake < minBetAmount);
      return {
        isValid: bets.every(bet => bet.stake >= minBetAmount),
        hasStakes: bets.every(bet => bet.stake > 0),
        belowMinimum: betsWithLowStakes.length > 0
      };
    }
  };

  const validation = validateBets();

  const placeBets = async () => {
    if (totalStake === 0 || totalStake > bankroll) return;
    setIsPlacing(true);

    if (bets.length > 0) {
      if (betType === 'parlay' && parlayStake > 0) {
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

    setShowCoinRain(true);

    setTimeout(() => {
      const winningBet = bets[0];
      if (winningBet && winningBet.stake > 0) {
        setSelectedWinningBet(winningBet);
      }
      clearBetSlip();
      setIsPlacing(false);
    }, 500);
  };

  const formatOdds = (odds) => {
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    return oddsValue > 0 ? `+${oddsValue}` : oddsValue.toString();
  };

  if (!mounted) return null;

  const content = (
    <>
      <CoinRain trigger={showCoinRain} onComplete={() => setShowCoinRain(false)} />

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 z-[98] hidden md:block"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-96 bg-black md:border-l border-gray-800/50 z-[99] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
              <h2 className="text-white font-bold text-xl flex items-center">
                <img src="/pikslogotransparent.png" alt="Piks" className="h-6 mr-2" />
                Bet Slip ({bets.length})
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bets.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 font-medium text-lg mb-2">Your bet slip is empty</p>
                  <p className="text-gray-600">Click on odds to add bets</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {bets.map((bet) => (
                    <div key={bet.id} className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-base">{bet.matchup}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-gray-300 text-sm">{bet.selection}</span>
                            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-sm font-bold">
                              {formatOdds(bet.odds)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeBet(bet.id)} className="text-gray-500 hover:text-red-400 p-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {betType === 'single' && (
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={bet.stake || ''}
                              onChange={(e) => updateStake(bet.id, e.target.value)}
                              className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-xl text-white text-base focus:outline-none focus:border-green-500"
                              placeholder={`Min $${minBetAmount}`}
                            />
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-gray-500 text-xs mb-0.5">TO WIN</div>
                            <div className="text-green-400 font-bold text-lg">
                              ${bet.stake ? (calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2) : '0.00'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {bets.length > 1 && (
                    <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
                      <div className="flex gap-2 mb-4">
                        <button 
                          onClick={() => setBetType('single')}
                          className={`flex-1 py-3 rounded-xl text-base font-semibold transition-colors ${
                            betType === 'single' ? 'bg-green-600 text-white' : 'bg-[#1a1a1a] text-gray-300'
                          }`}
                        >
                          Singles
                        </button>
                        <button 
                          onClick={() => setBetType('parlay')}
                          className={`flex-1 py-3 rounded-xl text-base font-semibold transition-colors ${
                            betType === 'parlay' ? 'bg-green-600 text-white' : 'bg-[#1a1a1a] text-gray-300'
                          }`}
                        >
                          Parlay
                        </button>
                      </div>
                      
                      {betType === 'parlay' && (
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={parlayStake || ''}
                              onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                              className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-xl text-white text-base focus:outline-none focus:border-green-500"
                              placeholder="Enter parlay stake"
                            />
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-gray-500 text-xs mb-0.5">TO WIN</div>
                            <div className="text-green-400 font-bold text-lg">
                              ${parlayStake ? (totalPayout - parlayStake).toFixed(2) : '0.00'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {bets.length > 0 && (
              <div className="p-4 border-t border-gray-800/50 bg-[#0a0a0a]">
                <div className="flex justify-between text-base mb-2">
                  <span className="text-gray-400">Total Stake</span>
                  <span className="text-white font-bold">${totalStake.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base mb-4">
                  <span className="text-gray-400">Potential Win</span>
                  <span className="text-green-400 font-bold text-lg">${totalPayout.toFixed(2)}</span>
                </div>

                {totalStake > bankroll && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Insufficient balance: ${bankroll.toFixed(2)}</p>
                  </div>
                )}

                {validation.belowMinimum && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Minimum bet: ${minBetAmount}</p>
                  </div>
                )}

                <button
                  onClick={placeBets}
                  disabled={!validation.isValid || totalStake > bankroll || isPlacing || totalStake === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed text-lg"
                >
                  {isPlacing ? (
                    <div className="flex items-center justify-center gap-2">
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
        </>
      )}

      <ShareableBetSlip 
        bet={selectedWinningBet}
        isVisible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedWinningBet(null);
        }}
      />

      {showReceipt && currentReceipt && (
        <BetReceipt 
          bet={currentReceipt} 
          isDemo={false}
          onClose={() => {
            setShowReceipt(false);
            setCurrentReceipt(null);
            onClose();
          }}
        />
      )}
    </>
  );

  return ReactDOM.createPortal(content, document.body);
}
