import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useBetSlip } from '../contexts/BetSlipContext';
import ShareableBetSlip from './ShareableBetSlip';
import BetReceipt from './BetReceipt';
import CoinRain from './CoinRain';

export default function BetSlip({ bankroll, onClose, isOpen, onBetPlaced }) {
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
  const [expandedBets, setExpandedBets] = useState({});

  const toggleBetExpanded = (id) => {
    setExpandedBets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateParlayOdds = () => {
    if (bets.length < 2) return null;
    let decimalOdds = 1;
    bets.forEach(bet => {
      const american = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
      let decimal;
      if (american > 0) {
        decimal = (american / 100) + 1;
      } else {
        decimal = (100 / Math.abs(american)) + 1;
      }
      decimalOdds *= decimal;
    });
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
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

    try {
      const response = await fetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bets,
          betType,
          parlayStake: betType === 'parlay' ? parlayStake : 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to place bets:', data.error);
        setIsPlacing(false);
        return;
      }

      if (onBetPlaced && data.newBankroll !== undefined) {
        const bankrollValue = Number(data.newBankroll);
        if (!isNaN(bankrollValue)) {
          onBetPlaced(bankrollValue);
        }
      }

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
    } catch (error) {
      console.error('Error placing bets:', error);
      setIsPlacing(false);
    }
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
            className="fixed inset-0 bg-black z-[98] hidden md:block"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] bg-black z-[99] flex flex-col">
            {/* Header with Piks branding */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center">
                <img src="/funderlogo/Piks.png" alt="Piks" className="h-14 object-contain -ml-4" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/50 px-2.5 py-1 rounded-full">
                  <span className="text-green-400 text-xs font-bold">${typeof bankroll === 'number' ? bankroll.toLocaleString() : parseFloat(bankroll || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/50 px-2.5 py-1 rounded-full">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-400 text-xs font-bold">{bets.length} PICK{bets.length !== 1 ? 'S' : ''}</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mode Toggle */}
            {bets.length >= 2 && (
              <div className="px-4 py-3 border-b border-gray-800/50">
                <div className="flex bg-[#1a1a1a] rounded-lg p-1">
                  <button
                    onClick={() => setBetType('single')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      betType === 'single' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Straight
                  </button>
                  <button
                    onClick={() => setBetType('parlay')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                      betType === 'parlay' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Parlay
                  </button>
                </div>
                {betType === 'parlay' && calculateParlayOdds() && (
                  <div className="mt-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300 text-sm font-medium">{bets.length}-Leg Parlay</span>
                      <span className="text-white font-bold text-lg">{formatOdds(calculateParlayOdds())}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {bets.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 font-medium text-lg mb-2">Your bet slip is empty</p>
                  <p className="text-gray-600">Click on odds to add picks</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {bets.map((bet) => {
                    const isExpanded = expandedBets[bet.id] !== false;
                    const isCollapsible = bets.length > 1;
                    
                    let borderColor = 'border-blue-500/50';
                    let flashClass = '';
                    if (bet.oddsMoved === 'up') {
                      borderColor = 'border-green-500';
                      flashClass = 'animate-pulse bg-green-500/10';
                    } else if (bet.oddsMoved === 'down') {
                      borderColor = 'border-red-500';
                      flashClass = 'animate-pulse bg-red-500/10';
                    }
                    
                    return (
                      <div key={bet.id} className={`bg-black rounded-lg border ${borderColor} overflow-hidden transition-all duration-300 ${flashClass}`}>
                        {/* Collapsible Header */}
                        <div 
                          className={`bg-slate-900/80 px-4 py-2 flex items-center justify-between ${isCollapsible ? 'cursor-pointer hover:bg-slate-800/80' : ''}`}
                          onClick={() => isCollapsible && toggleBetExpanded(bet.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {isCollapsible && (
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            <div className={`w-2 h-2 rounded-full ${
                              bet.oddsMoved === 'up' ? 'bg-green-400' : 
                              bet.oddsMoved === 'down' ? 'bg-red-400' : 'bg-blue-400 animate-pulse'
                            }`}></div>
                            <span className={`text-xs font-bold uppercase ${
                              bet.oddsMoved === 'up' ? 'text-green-400' : 
                              bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                            }`}>{bet.betType || 'Spread'}</span>
                            {!isExpanded && (
                              <span className="text-gray-300 text-xs ml-2 truncate">{bet.selection}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isExpanded && (
                              <span className={`font-bold text-sm ${
                                bet.oddsMoved === 'up' ? 'text-green-400' : 
                                bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                              }`}>{formatOdds(bet.odds)}</span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeBet(bet.id); }} className="text-gray-500 hover:text-red-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Expandable Content */}
                        {isExpanded && (
                          <>
                            {/* Selection & Odds */}
                            <div className="px-4 py-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="text-white font-bold text-base">{bet.selection}</div>
                                  <div className="text-gray-400 text-xs uppercase mt-0.5">{bet.betType}</div>
                                </div>
                                <div className={`font-bold text-xl flex items-center gap-1 ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                }`}>
                                  {bet.oddsMoved === 'up' && <span className="text-sm">▲</span>}
                                  {bet.oddsMoved === 'down' && <span className="text-sm">▼</span>}
                                  {formatOdds(bet.odds)}
                                </div>
                              </div>
                              
                              {/* Live Game Info */}
                              <div className="bg-slate-800/50 rounded-lg p-3 mt-2">
                                <div className="text-gray-500 text-[10px] uppercase mb-1">Game</div>
                                <div className="text-white text-sm font-medium">{bet.matchup}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                  <span className="text-green-400 text-xs">Live</span>
                                  <span className="text-gray-500 text-xs">|</span>
                                  <span className="text-gray-400 text-xs">Odds updating</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Stake Input - Only for straight bets */}
                            {betType === 'single' && (
                              <div className="px-4 pb-3 border-t border-gray-800/50 pt-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                      type="number"
                                      value={bet.stake || ''}
                                      onChange={(e) => updateStake(bet.id, e.target.value)}
                                      className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-base focus:outline-none focus:border-blue-500"
                                      placeholder={`Min $${minBetAmount}`}
                                    />
                                  </div>
                                  <div className="text-right min-w-[80px]">
                                    <div className="text-gray-500 text-[10px] uppercase">To Win</div>
                                    <div className="text-green-400 font-bold text-lg">
                                      ${bet.stake ? (calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2) : '0.00'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {bets.length > 0 && (
              <div className="flex-shrink-0 p-4 border-t border-gray-800/50 bg-black">
                {/* Parlay Stake Input */}
                {betType === 'parlay' && bets.length >= 2 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={parlayStake || ''}
                          onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-base focus:outline-none focus:border-blue-500"
                          placeholder={`Min $${minBetAmount}`}
                        />
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-gray-500 text-[10px] uppercase">Parlay Win</div>
                        <div className="text-green-400 font-bold text-lg">
                          ${parlayStake ? (totalPayout - parlayStake).toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Total Pikked</span>
                    <span className="text-white font-bold">${totalStake.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Potential Payout</span>
                    <span className="text-green-400 font-bold text-lg">${totalPayout.toFixed(2)}</span>
                  </div>
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
                  ) : betType === 'parlay' ? (
                    `Place ${bets.length}-Leg Parlay`
                  ) : (
                    `Place ${bets.length} Pik${bets.length > 1 ? 's' : ''}`
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
