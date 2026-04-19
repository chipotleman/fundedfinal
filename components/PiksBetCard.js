import { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import TapSurface from './TapSurface';
import { formatMoney } from '../utils/formatMoney';

export default function PiksBetCard({ bet, onCashOut, onShare, liveScores = {}, isOpponent = false, opponentName, opponentAvatar }) {
  const { isDarkMode } = useTheme();
  const [confirmingCashOut, setConfirmingCashOut] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef(null);
  
  // Get real-time scores from liveScores prop if available
  const liveData = liveScores[bet.gameId] || liveScores[bet.matchup] || {};
  const currentHomeScore = liveData.homeScore ?? bet.currentHomeScore;
  const currentAwayScore = liveData.awayScore ?? bet.currentAwayScore;
  const isLiveGame = liveData.isLive || bet.isLive;
  
  const pikId = useMemo(() => {
    if (bet.pikId) return bet.pikId;
    const seed = bet.id ? bet.id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0) : Date.now();
    return `${seed}${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`;
  }, [bet.id, bet.pikId]);

  useEffect(() => {
    if (confirmingCashOut) {
      const handleClickOutside = (e) => {
        if (buttonRef.current && !buttonRef.current.contains(e.target)) {
          setConfirmingCashOut(false);
        }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [confirmingCashOut]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const calculatePayout = (odds, stake) => {
    if (odds > 0) {
      return (stake * odds / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(odds))) + stake;
    }
  };

  // Capitalize league identifiers like (w) -> (W), (m) -> (M)
  const capitalizeLeagueId = (text) => {
    if (!text) return text;
    return text.replace(/\(([wm])\)/gi, (match, letter) => `(${letter.toUpperCase()})`);
  };

  const formatPlacedDate = () => {
    const date = bet.placedAt ? new Date(bet.placedAt) : bet.settledAt ? new Date(bet.settledAt) : new Date();
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} ${time}`;
  };

  const payout = calculatePayout(bet.odds, bet.stake);
  const isWon = bet.status === 'won';
  const isOpen = bet.status === 'open';
  const isLost = bet.status === 'lost';
  const isCashedOut = bet.status === 'cashed_out';
  const isSettled = isWon || isLost || isCashedOut;
  const didNotGradeInTime = bet.forfeitedAtBattleEnd === true && isOpen;

  const isOverUnder = bet.betType?.toLowerCase().includes('total') || 
                      bet.betType?.toLowerCase().includes('over') || 
                      bet.betType?.toLowerCase().includes('under') ||
                      bet.selection?.toLowerCase().includes('over') ||
                      bet.selection?.toLowerCase().includes('under');

  const isParlay = bet.betType?.toLowerCase().includes('parlay') || 
                   (bet.legs && bet.legs.length > 1);

  // Get full selection name for straight bets
  const getFullSelectionName = () => {
    if (bet.selectionFull) return bet.selectionFull;
    const sel = (bet.selection || '').toUpperCase();
    const matchupParts = bet.matchup?.split(' @ ') || [];
    const awayAbbr = matchupParts[0]?.toUpperCase() || '';
    const homeAbbr = matchupParts[1]?.trim().toUpperCase() || '';
    
    if (bet.awayTeamFull && sel === awayAbbr) return bet.awayTeamFull;
    if (bet.homeTeamFull && sel === homeAbbr) return bet.homeTeamFull;
    return bet.selection;
  };

  const parlayLegs = useMemo(() => {
    if (bet.legs && bet.legs.length > 0) {
      return { legs: bet.legs, hasRealData: true };
    }
    if (isParlay && bet.selection) {
      const selections = bet.selection.split(', ');
      return {
        legs: selections.map((sel) => ({
          selection: sel.trim(),
          matchup: null,
          betType: null,
          odds: null
        })),
        hasRealData: false
      };
    }
    return { legs: [], hasRealData: false };
  }, [bet.legs, bet.selection, isParlay]);

  const formatParlayTitle = useMemo(() => {
    if (!isParlay) return bet.selection;
    
    return parlayLegs.legs.map(leg => {
      const selection = leg.selection || '';
      const betType = leg.betType?.toLowerCase() || '';
      
      // Extract team nickname from selection
      // Remove spread/total numbers first to get the team name
      const selectionWithoutNumbers = selection.replace(/[+-]?\d+\.?\d*$/, '').trim();
      const words = selectionWithoutNumbers.split(' ');
      let teamName = words[words.length - 1] || selection;
      
      // If last word is a league identifier like (w), (W), (m), include the previous word too
      // Also uppercase the identifier for consistent display
      if (/^\([wWmM]\)$/.test(teamName) && words.length > 1) {
        teamName = `${words[words.length - 2]} ${teamName.toUpperCase()}`;
      }
      
      const spreadMatch = selection.match(/([+-]\d+\.?\d*)/);
      if (spreadMatch) {
        // For spreads, show "TeamName +5.5"
        return `${teamName} ${spreadMatch[1]}`;
      }
      
      if (betType.includes('spread')) {
        return `${teamName} ${spreadMatch ? spreadMatch[1] : ''}`.trim();
      }
      
      if (betType.includes('over') || selection.toLowerCase().includes('over')) {
        const pointMatch = selection.match(/(\d+\.?\d*)/);
        return pointMatch ? `Over ${pointMatch[1]}` : 'Over';
      }
      
      if (betType.includes('under') || selection.toLowerCase().includes('under')) {
        const pointMatch = selection.match(/(\d+\.?\d*)/);
        return pointMatch ? `Under ${pointMatch[1]}` : 'Under';
      }
      
      if (betType.includes('total')) {
        return selection;
      }
      
      return teamName;
    }).join(', ');
  }, [isParlay, parlayLegs.legs, bet.selection]);

  const generateScoresForLeg = (leg, index) => {
    const seed = bet.id ? (typeof bet.id === 'string' ? bet.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : bet.id) : 12345;
    const pseudoRandom = (n) => ((seed * (n + 1 + index * 10) * 9301 + 49297) % 233280) / 233280;
    return {
      homeScore: Math.floor(pseudoRandom(1) * 15 + 24),
      awayScore: Math.floor(pseudoRandom(2) * 15 + 17),
      homeQuarters: [
        Math.floor(pseudoRandom(3) * 10),
        Math.floor(pseudoRandom(4) * 12),
        Math.floor(pseudoRandom(5) * 8),
        Math.floor(pseudoRandom(6) * 10)
      ],
      awayQuarters: [
        Math.floor(pseudoRandom(7) * 8),
        Math.floor(pseudoRandom(8) * 10),
        Math.floor(pseudoRandom(9) * 6),
        Math.floor(pseudoRandom(10) * 8)
      ]
    };
  };

  const parseTeamsFromMatchup = (matchup) => {
    if (!matchup) return { homeTeam: 'Home Team', awayTeam: 'Away Team' };
    
    if (matchup.includes(' @ ')) {
      const [away, home] = matchup.split(' @ ');
      return { homeTeam: home, awayTeam: away };
    }
    if (matchup.includes(' vs ')) {
      const [home, away] = matchup.split(' vs ');
      return { homeTeam: home, awayTeam: away };
    }
    return { homeTeam: matchup, awayTeam: '' };
  };

  const getTeamNamesForLeg = (leg, index) => {
    if (leg.matchup) {
      return parseTeamsFromMatchup(leg.matchup);
    }
    const opponentTeams = ['Celtics', 'Lakers', 'Warriors', 'Heat', 'Nets', 'Bulls', 'Knicks', 'Mavericks', 'Suns', 'Bucks'];
    const seed = bet.id ? (typeof bet.id === 'string' ? bet.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : bet.id) : 12345;
    const opponentIndex = (seed + index * 7) % opponentTeams.length;
    return {
      homeTeam: leg.selection,
      awayTeam: opponentTeams[opponentIndex]
    };
  };

  const getWinHighlight = (leg, legTeams, homeScore, awayScore) => {
    const selection = leg.selection?.toLowerCase() || '';
    const betType = leg.betType?.toLowerCase() || '';
    const homeTeamLower = legTeams.homeTeam?.toLowerCase() || '';
    const awayTeamLower = legTeams.awayTeam?.toLowerCase() || '';
    
    const spreadMatch = selection.match(/([+-]?\d+\.?\d*)/);
    const spread = spreadMatch ? parseFloat(spreadMatch[0]) : null;
    
    const isHomeTeamPick = selection.includes(homeTeamLower.split(' ')[0]?.toLowerCase()) || 
                           homeTeamLower.includes(selection.split(' ')[0]?.toLowerCase());
    const isAwayTeamPick = selection.includes(awayTeamLower.split(' ')[0]?.toLowerCase()) || 
                           awayTeamLower.includes(selection.split(' ')[0]?.toLowerCase());
    
    if (betType.includes('spread') || selection.includes('+') || selection.includes('-')) {
      if (spread !== null) {
        if (isHomeTeamPick) {
          const adjustedScore = homeScore + spread;
          if (adjustedScore > awayScore) return { home: true, away: false };
        } else if (isAwayTeamPick) {
          const adjustedScore = awayScore + spread;
          if (adjustedScore > homeScore) return { home: false, away: true };
        }
      }
    }
    
    if (betType.includes('moneyline') || betType.includes('ml') || 
        (!betType.includes('spread') && !betType.includes('total') && !selection.includes('+') && !selection.includes('-'))) {
      if (isHomeTeamPick && homeScore > awayScore) {
        return { home: true, away: false };
      } else if (isAwayTeamPick && awayScore > homeScore) {
        return { home: false, away: true };
      } else if (homeScore > awayScore) {
        return { home: true, away: false };
      } else if (awayScore > homeScore) {
        return { home: false, away: true };
      }
    }
    
    if (betType.includes('over')) {
      const totalTarget = spread;
      if (totalTarget && (homeScore + awayScore) > totalTarget) {
        return { home: true, away: true };
      }
    } else if (betType.includes('under')) {
      const totalTarget = spread;
      if (totalTarget && (homeScore + awayScore) < totalTarget) {
        return { home: true, away: true };
      }
    }
    
    return { home: false, away: false };
  };

  const scores = useMemo(() => {
    if (bet.homeScore !== undefined && bet.awayScore !== undefined) {
      return {
        homeScore: bet.homeScore,
        awayScore: bet.awayScore,
        homeQuarters: bet.homeQuarters || [],
        awayQuarters: bet.awayQuarters || []
      };
    }
    if (isSettled) {
      const seed = bet.id ? (typeof bet.id === 'string' ? bet.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : bet.id) : 12345;
      const pseudoRandom = (n) => ((seed * (n + 1) * 9301 + 49297) % 233280) / 233280;
      return {
        homeScore: Math.floor(pseudoRandom(1) * 15 + 24),
        awayScore: Math.floor(pseudoRandom(2) * 15 + 17),
        homeQuarters: [
          Math.floor(pseudoRandom(3) * 10),
          Math.floor(pseudoRandom(4) * 12),
          Math.floor(pseudoRandom(5) * 8),
          Math.floor(pseudoRandom(6) * 10)
        ],
        awayQuarters: [
          Math.floor(pseudoRandom(7) * 8),
          Math.floor(pseudoRandom(8) * 10),
          Math.floor(pseudoRandom(9) * 6),
          Math.floor(pseudoRandom(10) * 8)
        ]
      };
    }
    if (isOpen && bet.currentHomeScore !== undefined) {
      return {
        homeScore: bet.currentHomeScore,
        awayScore: bet.currentAwayScore,
        homeQuarters: [],
        awayQuarters: []
      };
    }
    return { homeScore: null, awayScore: null, homeQuarters: [], awayQuarters: [] };
  }, [bet.id, bet.homeScore, bet.awayScore, bet.homeQuarters, bet.awayQuarters, bet.currentHomeScore, bet.currentAwayScore, isSettled, isOpen]);

  const getHeaderBackground = () => {
    if (isWon) {
      return 'bg-gradient-to-r from-green-600 via-green-500 to-emerald-500';
    }
    if (isLost) {
      return 'bg-gradient-to-r from-red-800 via-red-700 to-rose-700';
    }
    if (isCashedOut) {
      return 'bg-gradient-to-r from-orange-700 via-orange-600 to-amber-600';
    }
    return 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600';
  };

  const getBorderColor = () => {
    if (isWon) return 'border-yellow-500/70';
    if (isLost) return 'border-red-700/50';
    if (isCashedOut) return 'border-orange-600/50';
    return 'border-blue-600/50';
  };

  const getProgressBarData = () => {
    if (!isOpen || !isOverUnder) return null;
    
    const hasLiveScores = typeof bet.currentHomeScore === 'number' && typeof bet.currentAwayScore === 'number';
    
    if (!hasLiveScores) return null;
    
    const targetMatch = bet.selection?.match(/(\d+\.?\d*)/);
    const target = targetMatch ? parseFloat(targetMatch[1]) : 200;
    
    const currentTotal = bet.currentHomeScore + bet.currentAwayScore;
    const progress = Math.min((currentTotal / target) * 100, 100);
    
    return { currentTotal, target, progress };
  };

  const progressData = getProgressBarData();

  const { homeTeam, awayTeam } = parseTeamsFromMatchup(bet.matchup);

  const ScoreSection = ({ homeTeam, awayTeam, homeScore, awayScore, homeQuarters, awayQuarters }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{homeTeam}</span>
        <div className="flex items-center space-x-2">
          {homeQuarters && homeQuarters.length > 0 && (
            <div className="flex space-x-1.5 text-gray-400 text-xs">
              {homeQuarters.map((q, i) => <span key={i}>{q}</span>)}
            </div>
          )}
          <span className="text-white font-bold ml-2">{homeScore}</span>
        </div>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{awayTeam}</span>
        <div className="flex items-center space-x-2">
          {awayQuarters && awayQuarters.length > 0 && (
            <div className="flex space-x-1.5 text-gray-400 text-xs">
              {awayQuarters.map((q, i) => <span key={i}>{q}</span>)}
            </div>
          )}
          <span className="text-white font-bold ml-2">{awayScore}</span>
        </div>
      </div>
    </div>
  );

  const getCardBorder = () => {
    if (isOpponent) return '';
    if (isWon) return 'border-2 border-yellow-500/70';
    return '';
  };

  const getCardStyle = () => {
    const baseStyle = { backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff' };
    const shadow = isDarkMode
      ? '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)'
      : '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)';
    if (isOpponent) {
      return {
        ...baseStyle,
        border: '2px solid rgba(239,68,68,0.55)',
        boxShadow: '0 4px 18px rgba(239,68,68,0.18), 0 2px 4px rgba(0,0,0,0.3)',
      };
    }
    if (isWon) return { ...baseStyle, boxShadow: shadow };
    return {
      ...baseStyle,
      border: isDarkMode ? '1px solid #4b5563' : '1px solid #9ca3af',
      boxShadow: shadow
    };
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden mx-2 sm:mx-0 ${getCardBorder()}`} style={getCardStyle()}>
      {isOpponent && (
        <div
          className="absolute"
          style={{ top: 8, right: 8, zIndex: 30 }}
        >
          <div
            className="px-2 py-1 rounded-full uppercase"
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '0.12em',
              boxShadow: '0 2px 10px rgba(239,68,68,0.45)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            OPPONENT'S PIK
          </div>
        </div>
      )}
      <div className="relative" style={isOpponent ? { zIndex: 10 } : undefined}>
      <div className="px-4 pt-0 pb-0 bg-transparent">
        <div className="flex items-center justify-between -mt-2">
          <img src="/pikslogotransparent.png" alt="Piks" className="h-24 object-contain -ml-[24px]" style={{ filter: isDarkMode ? 'none' : 'invert(1) brightness(0.1)' }} />
          
          {isWon && (
            <div className="flex-1 flex justify-end" style={{ marginRight: -27, marginTop: -13 }}>
              <img 
                src="/trophy-winner.png" 
                alt="Winner" 
                className="h-[72px] w-auto"
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-0 pb-3 -mt-3">

        <div 
          className={`flex justify-between items-start mb-2 ${isParlay && isSettled ? 'cursor-pointer' : ''}`}
          onClick={() => isParlay && isSettled && setIsExpanded(!isExpanded)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-bold text-base" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{isParlay ? formatParlayTitle : getFullSelectionName()}</div>
              {isParlay && isSettled && (
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
            <div className="text-xs uppercase tracking-wide whitespace-nowrap" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>{bet.betType}</div>
          </div>
          <div className="font-bold text-xl" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
            {formatOdds(bet.odds)}
          </div>
        </div>

        {didNotGradeInTime && (
          <div
            className="mb-3 px-3 py-2 rounded-lg flex items-start gap-2"
            title="This pik never graded before the battle ended, so its stake was forfeited toward the battle's score."
            style={{
              background: isDarkMode ? 'rgba(234,179,8,0.10)' : 'rgba(234,179,8,0.15)',
              border: '1px solid rgba(234,179,8,0.45)',
            }}
          >
            <span className="text-base leading-none">⚠️</span>
            <div className="flex-1">
              <div className="text-yellow-400 text-xs font-bold uppercase tracking-wide">
                Did not grade in time
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
                Battle ended before this pik settled — stake was forfeited toward the battle's score.
              </div>
            </div>
          </div>
        )}

        {isParlay && isSettled && isExpanded && parlayLegs.legs.length > 0 && (
          <div className="mb-3 space-y-4 pt-3" style={{ borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db' }}>
            {parlayLegs.legs.map((leg, index) => {
              const legScores = generateScoresForLeg(leg, index);
              const legTeams = getTeamNamesForLeg(leg, index);
              const winHighlight = isWon ? getWinHighlight(leg, legTeams, legScores.homeScore, legScores.awayScore) : { home: false, away: false };
              
              return (
                <div key={index} className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-white font-bold text-base">{capitalizeLeagueId(leg.selection)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap">
                        {leg.betType || 'Moneyline'}
                      </div>
                    </div>
                    {parlayLegs.hasRealData && leg.odds && (
                      <div className="text-white font-bold text-lg">
                        {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{capitalizeLeagueId(legTeams.homeTeam)}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2 text-gray-400 text-sm">
                          {legScores.homeQuarters.map((q, i) => <span key={i}>{q}</span>)}
                        </div>
                        <span className={`font-bold text-lg w-8 text-right ${winHighlight.home ? 'text-green-400' : 'text-white'}`}>{legScores.homeScore}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{capitalizeLeagueId(legTeams.awayTeam)}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2 text-gray-400 text-sm">
                          {legScores.awayQuarters.map((q, i) => <span key={i}>{q}</span>)}
                        </div>
                        <span className={`font-bold text-lg w-8 text-right ${winHighlight.away ? 'text-green-400' : 'text-white'}`}>{legScores.awayScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isSettled && !isParlay && (
          <div className="mb-3">
            <ScoreSection 
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeScore={scores.homeScore}
              awayScore={scores.awayScore}
              homeQuarters={scores.homeQuarters}
              awayQuarters={scores.awayQuarters}
            />
          </div>
        )}

        {isOpen && !isParlay && (
          <div className="mb-3">
            {isLiveGame && typeof currentHomeScore === 'number' ? (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-500 text-xs font-medium">LIVE</span>
                {(liveData.time || liveData.period || liveData.quarter) && (
                  <span className="text-red-500/70 text-xs">{liveData.time || liveData.period || liveData.quarter}</span>
                )}
              </div>
            ) : (
              <div className="text-xs uppercase mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>Game</div>
            )}
            {isLiveGame && typeof currentHomeScore === 'number' ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{capitalizeLeagueId(bet.awayTeamFull || bet.matchup?.split(' @ ')[0])}</span>
                  <span className="text-white font-bold">{currentAwayScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{capitalizeLeagueId(bet.homeTeamFull || bet.matchup?.split(' @ ')[1])}</span>
                  <span className="text-white font-bold">{currentHomeScore}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{capitalizeLeagueId(bet.matchup)}</div>
                <div className="text-xs mt-0.5" style={{ color: isDarkMode ? '#93c5fd' : '#111827' }}>
                  {bet.gameStart ? new Date(bet.gameStart).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) : 'Upcoming'}
                </div>
              </>
            )}
          </div>
        )}

        {isOpen && isParlay && parlayLegs.legs.length > 0 && (
          <div className="mb-3">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase">
                  {parlayLegs.legs.length} Games
                </span>
                {parlayLegs.legs.some(leg => leg.isLive) && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-500 text-xs font-medium">LIVE</span>
                  </div>
                )}
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {isExpanded && (
              <div className="mt-3 space-y-4">
                {parlayLegs.legs.map((leg, index) => {
                  const legTeams = getTeamNamesForLeg(leg, index);
                  const isLegLive = leg.isLive === true;
                  
                  const isLegCompleted = leg.isCompleted === true;
                  const legWon = leg.won === true;
                  const hasScores = typeof leg.homeScore === 'number' && typeof leg.awayScore === 'number';
                  
                  // Get full selection name
                  const getFullSelection = () => {
                    if (leg.selectionFull) return leg.selectionFull;
                    const sel = leg.selection || '';
                    if (leg.awayTeamFull && sel.toUpperCase() === (leg.matchup?.split(' @ ')[0] || '').toUpperCase()) {
                      return leg.awayTeamFull;
                    }
                    if (leg.homeTeamFull && sel.toUpperCase() === (leg.matchup?.split(' @ ')[1] || '').trim().toUpperCase()) {
                      return leg.homeTeamFull;
                    }
                    return sel;
                  };
                  
                  return (
                    <div key={index} className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-white font-bold text-base">{capitalizeLeagueId(getFullSelection())}</div>
                            {isLegCompleted && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${legWon ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                {legWon ? 'WON' : 'LOST'}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap">
                            {leg.betType || 'Moneyline'}
                          </div>
                        </div>
                        {parlayLegs.hasRealData && leg.odds && (
                          <div className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                            {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{capitalizeLeagueId(leg.homeTeamFull || legTeams.homeTeam)}</span>
                          {(isLegLive || hasScores) ? (
                            <span className="text-white font-bold">{leg.homeScore}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#111827' }}>{capitalizeLeagueId(leg.awayTeamFull || legTeams.awayTeam)}</span>
                          {(isLegLive || hasScores) ? (
                            <span className="text-white font-bold">{leg.awayScore}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </div>
                      </div>
                      {isLegCompleted && (
                        <div className="text-gray-400 text-xs mt-1.5">FINAL</div>
                      )}
                      {!isLegLive && !isLegCompleted && leg.gameStart && (
                        <div className="text-blue-300 text-xs mt-1.5">
                          {new Date(leg.gameStart).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      )}
                      {isLegLive && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                          <span className="text-red-500 text-xs font-medium">LIVE</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {progressData && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Current: {progressData.currentTotal}</span>
              <span>Target: {progressData.target}</span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  bet.selection?.toLowerCase().includes('over') 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                }`}
                style={{ width: `${progressData.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-3 mt-2" style={{ borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid #9ca3af' }}>
          <div className="flex justify-between items-end">
            <div>
              <div className="font-bold text-xl" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>${formatMoney(bet.stake || 0)}</div>
              <div className="text-xs uppercase" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>Total Pikked</div>
            </div>
            {isWon && (
              <div className="text-right">
                <div className="text-green-400 font-bold text-xl">${formatMoney(payout)}</div>
                <div className="text-green-400/80 text-xs uppercase">Won on Piks</div>
              </div>
            )}
            {isOpen && (
              <div className="text-right">
                <div className="font-bold text-xl" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>${formatMoney(payout)}</div>
                <div className="text-gray-400 text-xs uppercase">Potential Payout</div>
              </div>
            )}
            {isLost && (
              <div className="text-right">
                <div className="text-gray-400 font-bold text-xl">$0.00</div>
                <div className="text-gray-500 text-xs uppercase">Payout</div>
              </div>
            )}
            {isCashedOut && (
              <div className="text-right">
                <div className="text-[#E9762B] font-bold text-xl">${formatMoney(bet.stake * 0.8)}</div>
                <div className="text-[#E9762B]/80 text-xs uppercase">Cashed Out</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mt-3 text-[10px] text-gray-500">
          <div className="font-mono">PIK ID: {pikId}</div>
          <div>PLACED: {formatPlacedDate()}</div>
        </div>

        {!isOpponent && isOpen && onCashOut && (() => {
          // Only allow cashout if NO game has started (not live, not completed)
          const now = new Date();
          let anyGameStarted = false;
          
          if (isParlay && bet.legs && bet.legs.length > 0) {
            anyGameStarted = bet.legs.some(leg => 
              leg.isLive || leg.isCompleted || 
              (leg.gameStart && new Date(leg.gameStart) <= now)
            );
          } else {
            anyGameStarted = bet.isLive || 
              (bet.gameStart && new Date(bet.gameStart) <= now);
          }
          
          if (anyGameStarted) return null;
          
          return (
            <div ref={buttonRef}>
              <TapSurface
                onTap={() => {
                  if (confirmingCashOut) {
                    onCashOut(bet.id);
                    setConfirmingCashOut(false);
                  } else {
                    setConfirmingCashOut(true);
                  }
                }}
                isActive={true}
                activeColor={confirmingCashOut ? '#dc2626' : '#2563eb'}
                activeTextColor="#ffffff"
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  fontWeight: 'bold',
                  padding: '0.625rem 1rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}
              >
                {confirmingCashOut ? `Confirm Cash Out ($${formatMoney(bet.stake * 0.8)})` : `Cash Out ($${formatMoney(bet.stake * 0.8)})`}
              </TapSurface>
            </div>
          );
        })()}

        {!isOpponent && isWon && onShare && (
          <button
            onClick={() => onShare(bet)}
            className="w-full mt-3 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2"
            style={{
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#2563eb',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.3)' : 'none',
              color: '#ffffff'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>Share Win</span>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
