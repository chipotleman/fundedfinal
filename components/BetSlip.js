import { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSession } from 'next-auth/react';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import ShareableBetSlip from './ShareableBetSlip';
import PiksBetCard from './PiksBetCard';
import CoinRain from './CoinRain';
import haptic from '../utils/haptics';

// Capitalize league identifiers like (w) -> (W), (m) -> (M)
const capitalizeLeagueId = (text) => {
  if (!text) return text;
  return text.replace(/\(([wm])\)/gi, (match, letter) => `(${letter.toUpperCase()})`);
};

export default function BetSlip({ bankroll, onClose, isOpen, onBetPlaced }) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const { isDarkMode } = useTheme();
  const { betSlip: bets, removeBet, updateStake, clearBetSlip, setShowBetSlip } = useBetSlip();
  const { apiGames, inplayEvents } = useGames();
  const { refresh: refreshMatchup } = useMatchup();
  const [isPlacing, setIsPlacing] = useState(false);
  const [betType, setBetType] = useState('single');
  const [parlayStake, setParlayStake] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWinningBet, setSelectedWinningBet] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [showPikPlacedBadge, setShowPikPlacedBadge] = useState(false);
  const [showCoinRain, setShowCoinRain] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedBets, setExpandedBets] = useState({});
  const [swipeStates, setSwipeStates] = useState({});
  const swipeRefs = useRef({});

  // Build live scores map from GamesContext (same source as dashboard)
  const liveScores = useMemo(() => {
    const scoresMap = {};
    
    // Normalize team names for matching (remove special chars, lowercase)
    const normalizeTeam = (name) => {
      if (!name) return '';
      return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    // Helper to add game data with multiple key variations
    const addGameKeys = (game, scoreData) => {
      if (game.id) scoresMap[game.id] = scoreData;
      if (game.gameId) scoresMap[game.gameId] = scoreData;
      
      // Matchup keys with full names
      if (game.awayTeamFull && game.homeTeamFull) {
        const fullMatchup = `${game.awayTeamFull} @ ${game.homeTeamFull}`;
        scoresMap[fullMatchup] = scoreData;
        scoresMap[fullMatchup.toLowerCase()] = scoreData;
        // Normalized key
        const normalizedFull = `${normalizeTeam(game.awayTeamFull)}@${normalizeTeam(game.homeTeamFull)}`;
        scoresMap[normalizedFull] = scoreData;
      }
      
      // Matchup keys with abbreviations
      if (game.awayTeam && game.homeTeam) {
        const abbrMatchup = `${game.awayTeam} @ ${game.homeTeam}`;
        scoresMap[abbrMatchup] = scoreData;
        scoresMap[abbrMatchup.toLowerCase()] = scoreData;
        // Normalized key
        const normalizedAbbr = `${normalizeTeam(game.awayTeam)}@${normalizeTeam(game.homeTeam)}`;
        scoresMap[normalizedAbbr] = scoreData;
      }
    };
    
    // First, add all inplay events (real-time SSE data with live scores)
    Object.entries(inplayEvents || {}).forEach(([id, event]) => {
      const scoreData = {
        isLive: true,
        awayScore: event.awayScore ?? 0,
        homeScore: event.homeScore ?? 0,
        time: event.time || event.clock || ''
      };
      scoresMap[id] = scoreData;
      addGameKeys(event, scoreData);
    });
    
    // Then add API games (for games not in inplay but might have scores)
    (apiGames || []).forEach(game => {
      // Skip if we already have inplay data for this game
      if (scoresMap[game.id]) return;
      
      const scoreData = {
        isLive: game.isLive || game.status === 'IN_PROGRESS',
        awayScore: game.scores?.away?.total ?? game.awayScore ?? 0,
        homeScore: game.scores?.home?.total ?? game.homeScore ?? 0,
        time: game.time || game.formatted_time || ''
      };
      addGameKeys(game, scoreData);
    });
    
    return scoresMap;
  }, [apiGames, inplayEvents]);

  useEffect(() => {
    if (bets.length < 2 && betType === 'parlay') {
      setBetType('single');
    }
  }, [bets.length, betType]);

  const toggleBetExpanded = (id) => {
    setExpandedBets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Swipe-to-delete handlers
  const handleTouchStart = (betId, e) => {
    const touch = e.touches[0];
    swipeRefs.current[betId] = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      isSwiping: false
    };
  };

  const handleTouchMove = (betId, e) => {
    if (!swipeRefs.current[betId]) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeRefs.current[betId].startX;
    const deltaY = Math.abs(touch.clientY - swipeRefs.current[betId].startY);
    
    // Only swipe left, and only if horizontal movement is greater than vertical
    if (deltaX < 0 && Math.abs(deltaX) > deltaY) {
      swipeRefs.current[betId].isSwiping = true;
      const swipeAmount = Math.min(Math.abs(deltaX), 100); // Max 100px
      setSwipeStates(prev => ({ ...prev, [betId]: swipeAmount }));
    }
  };

  const handleTouchEnd = (betId) => {
    if (!swipeRefs.current[betId]) return;
    const swipeAmount = swipeStates[betId] || 0;
    
    if (swipeAmount > 60) {
      // Swipe threshold reached - delete the bet
      setSwipeStates(prev => ({ ...prev, [betId]: 100 }));
      setTimeout(() => {
        removeBet(betId);
        setSwipeStates(prev => {
          const newState = { ...prev };
          delete newState[betId];
          return newState;
        });
      }, 150);
    } else {
      // Reset swipe
      setSwipeStates(prev => ({ ...prev, [betId]: 0 }));
    }
    delete swipeRefs.current[betId];
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

  // Track scroll position to restore after bet slip closes
  const savedScrollRef = useRef(0);
  
  useEffect(() => {
    // DO NOT set body.style.overflow = 'hidden' - this breaks sticky positioning
    // The bet slip overlay (z-[98] backdrop) handles blocking background interaction
    if (isOpen) {
      // Save current scroll position
      savedScrollRef.current = window.scrollY || window.pageYOffset || 0;
    } else {
      // Reset ALL modal-related state when bet slip closes to prevent stale overlays
      // These overlays with high z-index can block the docking header
      setShowReceipt(false);
      setCurrentReceipt(null);
      setShowPikPlacedBadge(false);
      setShowCoinRain(false);
      setShowShareModal(false);
      setSelectedWinningBet(null);
      
      // Restore scroll position and force refresh for sticky header
      const savedPos = savedScrollRef.current;
      requestAnimationFrame(() => {
        // Restore scroll position if we were scrolled down
        if (savedPos > 0) {
          window.scrollTo(0, savedPos);
        }
        // Always dispatch scroll event to refresh sticky positioning
        window.dispatchEvent(new Event('scroll'));
      });
    }
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
      // For single bets, only validate bets that have stakes entered
      // Bets without stakes are allowed - they just won't be placed
      const betsWithStakes = bets.filter(bet => bet.stake > 0);
      const betsWithLowStakes = bets.filter(bet => bet.stake > 0 && bet.stake < minBetAmount);
      const validBetsWithStakes = betsWithStakes.filter(bet => bet.stake >= minBetAmount);
      return {
        isValid: betsWithLowStakes.length === 0 && validBetsWithStakes.length > 0,
        hasStakes: betsWithStakes.length > 0,
        belowMinimum: betsWithLowStakes.length > 0
      };
    }
  };

  const validation = validateBets();

  const placeBets = async () => {
    if (totalStake === 0 || totalStake > bankroll) return;
    setIsPlacing(true);

    try {
      // For single bets, only send bets that have valid stakes
      const betsToPlace = betType === 'single' 
        ? bets.filter(b => b.stake && parseFloat(b.stake) >= minBetAmount)
        : bets;
      
      if (betsToPlace.length === 0) {
        setIsPlacing(false);
        return;
      }

      const response = await fetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bets: betsToPlace,
          betType,
          parlayStake: betType === 'parlay' ? parlayStake : 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to place bets:', data.error);
        haptic.error();
        setIsPlacing(false);
        return;
      }

      // Trigger haptic feedback on successful bet placement
      haptic.success();

      if (onBetPlaced && data.newBankroll !== undefined) {
        const bankrollValue = Number(data.newBankroll);
        if (!isNaN(bankrollValue)) {
          onBetPlaced(bankrollValue);
          // Emit global event so TopNavbar can update
          window.dispatchEvent(new CustomEvent('bankrollUpdated', { detail: { bankroll: bankrollValue } }));
        }
      }

      // Refresh matchup data to unlock opponent bets view
      if (refreshMatchup) {
        refreshMatchup();
      }

      if (data.bets && data.bets.length > 0) {
        const placedBet = data.bets[0];
        if (betType === 'parlay' && parlayStake > 0) {
          setCurrentReceipt({
            id: placedBet.id,
            matchup: placedBet.matchupName || `${betsToPlace.length}-Leg Parlay`,
            selection: placedBet.selection,
            betType: 'parlay',
            odds: parseInt(placedBet.odds),
            stake: parseFloat(placedBet.stake),
            status: 'open',
            legs: betsToPlace.map(bet => ({
              selection: bet.selection,
              betType: bet.betType,
              odds: typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value : bet.odds,
              matchup: bet.matchup,
              gameId: bet.gameId,
              isLive: !!bet.isLive,
              homeTeam: bet.homeTeam,
              awayTeam: bet.awayTeam,
              homeTeamFull: bet.homeTeamFull,
              awayTeamFull: bet.awayTeamFull,
              homeScore: bet.homeScore || 0,
              awayScore: bet.awayScore || 0,
              gameStart: bet.gameStart,
              gameTime: bet.gameTime
            }))
          });
        } else {
          const firstBet = betsToPlace[0];
          const live = liveScores[firstBet.gameId] || liveScores[firstBet.matchup] || {};
          const currentAwayScore = live.awayScore ?? firstBet.awayScore;
          const currentHomeScore = live.homeScore ?? firstBet.homeScore;
          setCurrentReceipt({
            id: placedBet.id,
            gameId: firstBet.gameId,
            matchup: placedBet.matchupName || firstBet.matchup,
            selection: placedBet.selection,
            betType: firstBet.betType,
            odds: parseInt(placedBet.odds),
            stake: parseFloat(placedBet.stake),
            status: 'open',
            isLive: live.isLive || !!firstBet.isLive,
            awayTeam: firstBet.awayTeam,
            homeTeam: firstBet.homeTeam,
            awayTeamFull: firstBet.awayTeamFull,
            homeTeamFull: firstBet.homeTeamFull,
            awayScore: currentAwayScore,
            homeScore: currentHomeScore,
            currentAwayScore: currentAwayScore,
            currentHomeScore: currentHomeScore,
            gameStart: firstBet.gameStart,
            gameTime: live.time || firstBet.gameTime
          });
        }
        setShowReceipt(true);
        setShowPikPlacedBadge(true);
        
        // Hide "Pik Placed!" badge after 3 seconds
        setTimeout(() => {
          setShowPikPlacedBadge(false);
        }, 3000);
      }

      setShowCoinRain(true);

      setTimeout(() => {
        const winningBet = betsToPlace[0];
        if (winningBet && winningBet.stake > 0) {
          setSelectedWinningBet(winningBet);
        }
        
        // For single bets, only remove the bets that were placed (have stakes)
        // Keep bets without stakes in the slip
        if (betType === 'single' && bets.length > betsToPlace.length) {
          // Remove only the placed bets
          const placedBetIds = betsToPlace.map(b => b.id);
          placedBetIds.forEach(id => removeBet(id));
        } else {
          // Clear all bets (parlay or all single bets had stakes)
          clearBetSlip();
        }
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

      {/* Persistent logo - always in DOM, visibility controlled */}
      <div 
        className="fixed z-[100]"
        style={{ 
          top: 0,
          left: 0,
          right: 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: 'none'
        }}
      >
        <div 
          className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px]"
          style={{ pointerEvents: 'none' }}
        >
          <div className="px-3 h-[70px] flex items-center" style={{ pointerEvents: 'none' }}>
            <div className="flex items-center justify-between w-full min-h-[70px] relative" style={{ pointerEvents: 'none' }}>
              <div className="absolute left-[-35px] top-1/2 -translate-y-1/2" style={{ pointerEvents: 'none' }}>
                <img 
                  src="/pikslogotransparent.png" 
                  alt="Piks" 
                  className="h-[140px] w-auto brightness-100"
                  style={{
                    filter: isDarkMode ? 'hue-rotate(0deg) saturate(1.2) brightness(1.1)' : 'invert(1) hue-rotate(0deg) saturate(1.2) brightness(0.1)',
                    animation: isDarkMode ? 'logoRedYellowGlow 4s infinite ease-in-out' : 'none',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Backdrop - blocks clicks but NOT body scroll (preserves sticky positioning) */}
          <div 
            className="fixed inset-0 z-[98] hidden md:block"
            style={{ backgroundColor: isDarkMode ? '#000000' : 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
          />
          
          {/* Bet slip panel - uses overscroll-behavior to contain scroll within panel */}
          <div 
            className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] z-[99] flex flex-col" 
            style={{ 
              backgroundColor: isDarkMode ? '#000000' : '#ffffff',
              overscrollBehavior: 'contain'
            }}
            onTouchStart={() => {}}
          >
            {/* Header with Piks branding - matches TopNavbar structure */}
            <div className="px-3 h-[70px] flex items-center" style={{ borderBottomWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#e5e7eb' }}>
              <div className="flex items-center justify-between w-full min-h-[70px] relative">
                {/* Logo placeholder - actual logo is in persistent layer above */}
                <div className="absolute left-[-35px] top-1/2 -translate-y-1/2 w-[140px] h-[140px]"></div>
                <div className="flex items-center gap-3 ml-auto mt-[2px]">
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
            </div>

            {/* Mode Toggle */}
            {bets.length >= 2 && (
              <div className="px-4 py-3" style={{ borderBottomWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#000000' }}>
                <div className="flex rounded-lg p-1 relative" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6' }}>
                  <div 
                    className="absolute top-1 bottom-1 rounded-md transition-all duration-200 pointer-events-none"
                    style={{
                      backgroundColor: '#2563eb',
                      width: 'calc(50% - 4px)',
                      left: betType === 'single' ? '4px' : 'calc(50% + 0px)',
                      zIndex: 0,
                    }}
                  />
                  <div
                    role="tab"
                    tabIndex={0}
                    onClick={() => setBetType('single')}
                    onKeyDown={(e) => e.key === 'Enter' && setBetType('single')}
                    className="flex-1 py-2 text-sm font-bold rounded-md transition-all relative text-center cursor-pointer select-none"
                    style={{
                      color: betType === 'single' ? '#ffffff' : '#9ca3af',
                      zIndex: 1,
                    }}
                  >
                    Straight
                  </div>
                  <div
                    role="tab"
                    tabIndex={0}
                    onClick={() => setBetType('parlay')}
                    onKeyDown={(e) => e.key === 'Enter' && setBetType('parlay')}
                    className="flex-1 py-2 text-sm font-bold rounded-md transition-all relative text-center cursor-pointer select-none"
                    style={{
                      color: betType === 'parlay' ? '#ffffff' : '#9ca3af',
                      zIndex: 1,
                    }}
                  >
                    Parlay
                  </div>
                </div>
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
              ) : betType === 'parlay' && bets.length >= 2 ? (
                /* Compact Parlay View - All legs in one container */
                <div className="px-4 pt-2 pb-4">
                  {/* Compact Legs List with Swipe-to-Delete and Connecting Line */}
                  <div className="relative">
                    {/* Vertical connecting line - positioned to run through center of circles */}
                    {bets.length > 1 && (
                      <div 
                        className="absolute bg-gray-600/50"
                        style={{ 
                          left: '7px',
                          top: '24px',
                          bottom: '24px',
                          width: '1px'
                        }}
                      />
                    )}
                    
                    <div className="divide-y divide-gray-800/30">
                      {bets.map((bet, index) => {
                        const isLive = bet.isLive || liveScores[bet.gameId]?.isLive || liveScores[bet.matchup]?.isLive;
                        const matchupDisplay = bet.matchup || (bet.awayTeam && bet.homeTeam ? `${bet.awayTeamFull || bet.awayTeam} v ${bet.homeTeamFull || bet.homeTeam}` : '');
                        const swipeOffset = swipeStates[bet.id] || 0;
                        const isFirst = index === 0;
                        const isLast = index === bets.length - 1;
                        
                        return (
                          <div key={bet.id} className="relative overflow-hidden">
                            {/* Delete background revealed on swipe */}
                            <div 
                              className="absolute inset-y-0 right-0 bg-red-600 flex items-center justify-end px-4 transition-opacity"
                              style={{ width: '100px', opacity: swipeOffset > 0 ? 1 : 0 }}
                            >
                              <span className="text-white font-bold text-sm">Delete</span>
                            </div>
                            
                            {/* Swipeable content */}
                            <div 
                              className="py-3 flex items-center gap-3 bg-black relative transition-transform"
                              style={{ transform: `translateX(-${swipeOffset}px)` }}
                              onTouchStart={(e) => handleTouchStart(bet.id, e)}
                              onTouchMove={(e) => handleTouchMove(bet.id, e)}
                              onTouchEnd={() => handleTouchEnd(bet.id)}
                            >
                              {/* Remove Button - matches arrow height (16px) with z-index to cover line */}
                              <button 
                                onClick={() => removeBet(bet.id)}
                                className="flex-shrink-0 rounded-full border border-red-500/60 flex items-center justify-center hover:bg-red-500/20 transition-colors bg-black relative z-10"
                                style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }}
                                aria-label={`Remove ${bet.selection}`}
                              >
                                <svg style={{ width: '8px', height: '8px' }} className="text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {/* Leg Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-bold text-sm leading-tight">{capitalizeLeagueId(bet.selection)}</div>
                                <div className="text-gray-500 text-xs uppercase mt-0.5">{bet.betType || 'Spread'}</div>
                                {/* Live Badge + Matchup */}
                                <div className="flex items-center gap-1.5 mt-1">
                                  {isLive && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 rounded">LIVE</span>
                                  )}
                                  {matchupDisplay && (
                                    <span className="text-gray-500 text-xs truncate">{capitalizeLeagueId(matchupDisplay)}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Odds with movement indicator */}
                              <div className="flex-shrink-0 flex items-center gap-1">
                                {bet.oddsMoved === 'down' && <span className="text-red-500 text-xs">▼</span>}
                                {bet.oddsMoved === 'up' && <span className="text-green-500 text-xs">▲</span>}
                                <span className={`font-bold text-sm ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : 'text-white'
                                }`}>
                                  {formatOdds(bet.odds)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Remove All Selections */}
                  <button 
                    onClick={() => bets.forEach(bet => removeBet(bet.id))}
                    className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 transition-colors border-t border-gray-800/50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-sm font-medium">Remove all selections</span>
                  </button>
                </div>
              ) : (
                /* Standard Single Bets View - Matching Reference Theme with Swipe-to-Delete */
                <div className="p-4 space-y-4">
                  {bets.map((bet) => {
                    const isExpanded = expandedBets[bet.id] !== false;
                    const isCollapsible = bets.length > 1;
                    const swipeOffset = swipeStates[bet.id] || 0;
                    
                    // Get live data
                    const normalizeTeam = (name) => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                    const fullMatchup = bet.awayTeamFull && bet.homeTeamFull ? `${bet.awayTeamFull} @ ${bet.homeTeamFull}` : null;
                    const abbrMatchup = bet.awayTeam && bet.homeTeam ? `${bet.awayTeam} @ ${bet.homeTeam}` : null;
                    const normalizedMatchup = bet.matchup ? `${normalizeTeam(bet.matchup.split(' @ ')[0])}@${normalizeTeam(bet.matchup.split(' @ ')[1])}` : null;
                    const live = liveScores[bet.gameId] || liveScores[bet.matchup] || liveScores[bet.matchup?.toLowerCase()] ||
                      (fullMatchup && liveScores[fullMatchup]) || (abbrMatchup && liveScores[abbrMatchup]) ||
                      (normalizedMatchup && liveScores[normalizedMatchup]) || {};
                    const isLive = live.isLive || bet.isLive;
                    const awayScore = live.awayScore ?? bet.awayScore ?? null;
                    const homeScore = live.homeScore ?? bet.homeScore ?? null;
                    const gameTime = live.time || bet.gameTime || 'Upcoming';
                    
                    return (
                      <div key={bet.id} className="relative rounded-xl overflow-hidden">
                        {/* Delete background revealed on swipe */}
                        <div 
                          className="absolute inset-y-0 right-0 bg-red-600 flex items-center justify-end px-4 rounded-r-xl transition-opacity"
                          style={{ width: '100px', opacity: swipeOffset > 0 ? 1 : 0 }}
                        >
                          <span className="text-white font-bold text-sm">Delete</span>
                        </div>
                        
                        {/* Swipeable card */}
                        <div 
                          className="bg-slate-900/40 border border-gray-800/50 rounded-xl relative transition-transform"
                          style={{ transform: `translateX(-${swipeOffset}px)` }}
                          onTouchStart={(e) => handleTouchStart(bet.id, e)}
                          onTouchMove={(e) => handleTouchMove(bet.id, e)}
                          onTouchEnd={() => handleTouchEnd(bet.id)}
                        >
                          {/* Collapsible Header */}
                          <div 
                            className={`px-4 py-3 flex items-center justify-between ${isCollapsible ? 'cursor-pointer' : ''}`}
                            onClick={() => isCollapsible && toggleBetExpanded(bet.id)}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {/* Red minus button to remove - matches arrow height (16px) */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeBet(bet.id); }}
                                className="flex-shrink-0 rounded-full border border-red-500/60 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }}
                                aria-label={`Remove ${bet.selection}`}
                              >
                                <svg style={{ width: '8px', height: '8px' }} className="text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M20 12H4" />
                                </svg>
                              </button>
                              
                              {isCollapsible && (
                                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                              <span className="text-xs font-bold uppercase text-blue-500 flex-shrink-0">{bet.betType || 'Spread'}</span>
                              {/* Show LIVE indicator and team when collapsed */}
                              {!isExpanded && (
                                <>
                                  {isLive && (
                                    <span className="flex items-center gap-1 flex-shrink-0 ml-1">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                      <span className="text-red-500 text-[10px] font-bold">LIVE</span>
                                    </span>
                                  )}
                                  <span className="text-gray-400 text-xs truncate ml-1">
                                    {capitalizeLeagueId(bet.selection)}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center flex-shrink-0">
                              {/* Show odds when collapsed */}
                              {!isExpanded && (
                                <span className={`font-bold text-sm ${
                                  bet.oddsMoved === 'up' ? 'text-green-400' : 
                                  bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                }`}>
                                  {formatOdds(bet.odds)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Expandable Content */}
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              {/* Selection & Odds Row */}
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <div className="text-white font-bold text-lg leading-tight">{capitalizeLeagueId(bet.selection)}</div>
                                  <div className="text-gray-500 text-xs uppercase mt-0.5">{bet.betType}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {bet.oddsMoved === 'down' && <span className="text-red-500 text-sm">▼</span>}
                                  {bet.oddsMoved === 'up' && <span className="text-green-500 text-sm">▲</span>}
                                  <span className={`font-bold text-xl ${
                                    bet.oddsMoved === 'up' ? 'text-green-400' : 
                                    bet.oddsMoved === 'down' ? 'text-red-400' : 'text-blue-400'
                                  }`}>
                                    {formatOdds(bet.odds)}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Game Info Box */}
                              <div className="bg-slate-800/60 rounded-lg p-3 border border-gray-700/30">
                                <div className="text-gray-500 text-[10px] uppercase mb-2 tracking-wide">Game</div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-white text-sm">{capitalizeLeagueId(bet.awayTeamFull || bet.awayTeam || bet.matchup?.split(' @ ')[0] || 'Away')}</span>
                                    {awayScore !== null && <span className="text-white font-bold text-sm">{awayScore}</span>}
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-white text-sm">{capitalizeLeagueId(bet.homeTeamFull || bet.homeTeam || bet.matchup?.split(' @ ')[1] || 'Home')}</span>
                                    {homeScore !== null && <span className="text-white font-bold text-sm">{homeScore}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2">
                                  {isLive ? (
                                    <>
                                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                      <span className="text-red-500 text-xs font-medium">LIVE</span>
                                    </>
                                  ) : (
                                    <span className="text-gray-500 text-xs">{gameTime}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Stake Input */}
                              {betType === 'single' && (
                                <div className="flex items-center gap-3 mt-4">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                      type="number"
                                      value={bet.stake || ''}
                                      onChange={(e) => updateStake(bet.id, e.target.value)}
                                      className="w-full pl-8 pr-3 py-3 rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-800/80 border border-gray-700/50 text-white placeholder-gray-500"
                                      placeholder={`Min $${minBetAmount}`}
                                    />
                                  </div>
                                  <div className="text-right min-w-[70px]">
                                    <div className="text-gray-500 text-[10px] uppercase tracking-wide">To Win</div>
                                    <div className="text-green-400 font-bold text-lg">
                                      ${bet.stake ? (calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2) : '0.00'}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {bets.length > 0 && (
              <div className="flex-shrink-0 p-4" style={{ borderTopWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#000000', backgroundColor: isDarkMode ? '#000000' : '#ffffff' }}>
                {/* Parlay Stake Input */}
                {betType === 'parlay' && bets.length >= 2 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: isDarkMode ? '#6b7280' : '#111827' }}>$</span>
                        <input
                          type="number"
                          value={parlayStake || ''}
                          onChange={(e) => setParlayStake(parseFloat(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-3 rounded-lg text-base focus:outline-none focus:border-blue-500"
                          style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#000000', color: isDarkMode ? '#ffffff' : '#111827' }}
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
                
                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : '#f3f4f6' }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span style={{ color: isDarkMode ? '#9ca3af' : '#374151' }}>Total Pikked</span>
                    <span className="font-bold" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>${totalStake.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: isDarkMode ? '#9ca3af' : '#374151' }}>Potential Payout</span>
                    <span className="text-green-400 font-bold text-lg">${totalPayout.toFixed(2)}</span>
                  </div>
                </div>

                {isLoggedIn && totalStake > bankroll && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Insufficient balance: ${bankroll.toFixed(2)}</p>
                  </div>
                )}

                {isLoggedIn && validation.belowMinimum && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3">
                    <p className="text-red-400 text-sm">Minimum bet: ${minBetAmount}</p>
                  </div>
                )}

                {!isLoggedIn ? (
                  <button
                    type="button"
                    className="no-hover-effect"
                    onClick={() => {
                      localStorage.setItem('betslip_pending_login', JSON.stringify({ redirect: 'betslip', timestamp: Date.now() }));
                      setShowBetSlip(false);
                      window.dispatchEvent(new CustomEvent('openAuthPopup'));
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '16px 0',
                      borderRadius: '12px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      cursor: 'pointer',
                      border: 'none',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'none'
                    }}
                  >
                    Sign In to Place Bets
                  </button>
                ) : (() => {
                  // For straight bets, only count bets that have stakes entered
                  const betsWithStakes = betType === 'single' ? bets.filter(b => b.stake && parseFloat(b.stake) >= minBetAmount) : bets;
                  const placeBetCount = betType === 'single' ? betsWithStakes.length : bets.length;
                  const canPlace = validation.isValid && totalStake <= bankroll && !isPlacing && totalStake > 0 && placeBetCount > 0;
                  
                  return (
                    <button
                      type="button"
                      className="no-hover-effect"
                      onClick={() => {
                        console.log('Place button clicked', { canPlace, validation, totalStake, bankroll, isPlacing, placeBetCount });
                        if (canPlace) {
                          placeBets();
                        }
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '16px 0',
                        borderRadius: '12px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundColor: canPlace ? '#2563eb' : '#4b5563',
                        color: '#ffffff',
                        cursor: canPlace ? 'pointer' : 'not-allowed',
                        border: 'none',
                        outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        transition: 'none'
                      }}
                    >
                      {isPlacing ? 'Placing...' : betType === 'parlay' ? `Place ${bets.length}-Leg Parlay` : `Place ${placeBetCount} Pik${placeBetCount !== 1 ? 's' : ''}`}
                    </button>
                  );
                })()}
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
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => {
            setShowReceipt(false);
            setCurrentReceipt(null);
            setShowPikPlacedBadge(false);
            onClose();
          }}
        >
          <div 
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowReceipt(false);
                setCurrentReceipt(null);
                setShowPikPlacedBadge(false);
                onClose();
              }}
              className="absolute -top-1 -right-1 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {showPikPlacedBadge && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-center animate-badge-fade pointer-events-none">
                <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-bold">Pik Placed!</span>
                </div>
              </div>
            )}
            <PiksBetCard 
              bet={currentReceipt}
              liveScores={liveScores}
              onCashOut={async (betId) => {
                try {
                  const response = await fetch('/api/bets/cashout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ betId: betId })
                  });
                  if (response.ok) {
                    const data = await response.json();
                    if (data.newBankroll && onBetPlaced) {
                      onBetPlaced(data.newBankroll);
                      window.dispatchEvent(new CustomEvent('bankrollUpdated', { detail: { bankroll: data.newBankroll } }));
                    }
                    // Update the receipt to show cashed out status instead of closing
                    setCurrentReceipt(prev => ({
                      ...prev,
                      status: 'cashed_out',
                      profit: parseFloat(prev.stake) * -0.2
                    }));
                  }
                } catch (error) {
                  console.error('Cashout failed:', error);
                }
              }}
              onShare={() => {}}
            />
          </div>
          <style jsx>{`
            @keyframes fade-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes badge-fade {
              0% { opacity: 1; }
              70% { opacity: 1; }
              100% { opacity: 0; }
            }
            .animate-fade-in {
              animation: fade-in 0.3s ease-out forwards;
            }
            .animate-badge-fade {
              animation: badge-fade 3s ease-out forwards;
            }
          `}</style>
        </div>
      )}
      
          </>
  );

  return ReactDOM.createPortal(content, document.body);
}
