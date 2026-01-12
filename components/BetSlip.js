import { useState, useEffect, useMemo } from 'react';
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
        time: event.displayClock || event.time || event.clock || '',
        displayClock: event.displayClock || '',
        period: event.timer?.q ? `Q${event.timer.q}` : event.period || '',
        quarter: event.timer?.q || event.quarter || ''
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
        time: game.time || game.formatted_time || '',
        displayClock: game.timer || game.status || '',
        period: game.status || '',
        timer: game.timer || ''
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
    // Simple overflow lock - no position:fixed which breaks iOS Safari touch events
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
            matchup: placedBet.matchupName || `${bets.length}-Leg Parlay`,
            selection: placedBet.selection,
            betType: 'parlay',
            odds: parseInt(placedBet.odds),
            stake: parseFloat(placedBet.stake),
            status: 'open',
            legs: bets.map(bet => ({
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
          const firstBet = bets[0];
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
          <div 
            className="fixed inset-0 z-[98] hidden md:block"
            style={{ backgroundColor: isDarkMode ? '#000000' : 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
          />
          
          <div 
            className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] z-[99] flex flex-col" 
            style={{ backgroundColor: isDarkMode ? '#000000' : '#ffffff' }}
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
                              <span className="text-gray-300 text-xs ml-2 truncate">{capitalizeLeagueId(bet.selection)}</span>
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
                                  <div className="text-white font-bold text-base">{capitalizeLeagueId(bet.selection)}</div>
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
                              {(() => {
                                // Normalize team names for matching
                                const normalizeTeam = (name) => {
                                  if (!name) return '';
                                  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                };
                                
                                // Try multiple matching strategies
                                const fullMatchup = bet.awayTeamFull && bet.homeTeamFull 
                                  ? `${bet.awayTeamFull} @ ${bet.homeTeamFull}` 
                                  : null;
                                const abbrMatchup = bet.awayTeam && bet.homeTeam 
                                  ? `${bet.awayTeam} @ ${bet.homeTeam}` 
                                  : null;
                                const normalizedMatchup = bet.matchup 
                                  ? `${normalizeTeam(bet.matchup.split(' @ ')[0])}@${normalizeTeam(bet.matchup.split(' @ ')[1])}`
                                  : null;
                                
                                const live = liveScores[bet.gameId] || 
                                  liveScores[bet.matchup] || 
                                  liveScores[bet.matchup?.toLowerCase()] ||
                                  (fullMatchup && liveScores[fullMatchup]) ||
                                  (fullMatchup && liveScores[fullMatchup.toLowerCase()]) ||
                                  (abbrMatchup && liveScores[abbrMatchup]) ||
                                  (abbrMatchup && liveScores[abbrMatchup.toLowerCase()]) ||
                                  (normalizedMatchup && liveScores[normalizedMatchup]) ||
                                  {};
                                const isLive = live.isLive || bet.isLive;
                                const awayScore = live.awayScore ?? bet.awayScore ?? 0;
                                const homeScore = live.homeScore ?? bet.homeScore ?? 0;
                                const gameTime = live.time || bet.gameTime || 'Upcoming';
                                
                                return (
                                  <div className="bg-slate-800/50 rounded-lg p-3 mt-2">
                                    <div className="text-gray-500 text-[10px] uppercase mb-1">Game</div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-white text-sm font-medium">{capitalizeLeagueId(bet.awayTeamFull || bet.awayTeam || bet.matchup?.split(' @ ')[0])}</span>
                                        {isLive && <span className="text-white font-bold">{awayScore}</span>}
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-white text-sm font-medium">{capitalizeLeagueId(bet.homeTeamFull || bet.homeTeam || bet.matchup?.split(' @ ')[1])}</span>
                                        {isLive && <span className="text-white font-bold">{homeScore}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      {isLive ? (
                                        <>
                                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                          <span className="text-red-500 text-xs font-medium">LIVE</span>
                                        </>
                                      ) : (
                                        <>
                                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                          <span className="text-gray-400 text-xs">{gameTime}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Stake Input - Only for straight bets */}
                            {betType === 'single' && (
                              <div className="px-4 pb-3 pt-3" style={{ borderTopWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : '#000000' }}>
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: isDarkMode ? '#6b7280' : '#111827' }}>$</span>
                                    <input
                                      type="number"
                                      value={bet.stake || ''}
                                      onChange={(e) => updateStake(bet.id, e.target.value)}
                                      className="w-full pl-8 pr-3 py-3 rounded-lg text-base focus:outline-none focus:border-blue-500"
                                      style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#000000', color: isDarkMode ? '#ffffff' : '#111827' }}
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
                  const canPlace = validation.isValid && totalStake <= bankroll && !isPlacing && totalStake > 0;
                  return (
                    <button
                      type="button"
                      className="no-hover-effect"
                      onClick={() => {
                        console.log('Place button clicked', { canPlace, validation, totalStake, bankroll, isPlacing });
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
                      {isPlacing ? 'Placing...' : betType === 'parlay' ? `Place ${bets.length}-Leg Parlay` : `Place ${bets.length} Pik${bets.length > 1 ? 's' : ''}`}
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
              className="absolute -top-2 -right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
