import { useState, useEffect, useRef, useMemo } from 'react';

export default function PiksBetCard({ bet, onCashOut, onShare }) {
  const [confirmingCashOut, setConfirmingCashOut] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef(null);
  
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

  const formatMoney = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const isOverUnder = bet.betType?.toLowerCase().includes('total') || 
                      bet.betType?.toLowerCase().includes('over') || 
                      bet.betType?.toLowerCase().includes('under') ||
                      bet.selection?.toLowerCase().includes('over') ||
                      bet.selection?.toLowerCase().includes('under');

  const isParlay = bet.betType?.toLowerCase().includes('parlay') || 
                   (bet.legs && bet.legs.length > 1);

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
    if (isWon) return 'border-green-500/50';
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
        <span className="text-white/90">{homeTeam}</span>
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
        <span className="text-white/90">{awayTeam}</span>
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

  return (
    <div className={`relative rounded-2xl overflow-hidden mx-2 sm:mx-0 border bg-[#0a0a0a] ${getBorderColor()}`}>
      <div className={`px-4 py-3 ${getHeaderBackground()}`}>
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-xl tracking-tight">piks</span>
          
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-black/30 border border-white/20 text-white">
            <div className={`w-2 h-2 rounded-full ${
              isWon ? 'bg-green-300' : isOpen ? 'bg-white animate-pulse' : isCashedOut ? 'bg-orange-300' : 'bg-red-300'
            }`}></div>
            <span>{isWon ? 'WON' : isOpen ? 'OPEN' : isCashedOut ? 'CASHED OUT' : 'LOST'}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4">

        <div 
          className={`flex justify-between items-start mb-2 ${isParlay && isSettled ? 'cursor-pointer' : ''}`}
          onClick={() => isParlay && isSettled && setIsExpanded(!isExpanded)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-white font-bold text-base">{bet.selection}</div>
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
            <div className="text-gray-400 text-xs uppercase tracking-wide">{bet.betType}</div>
          </div>
          <div className="font-bold text-xl text-white">
            {formatOdds(bet.odds)}
          </div>
        </div>

        {isParlay && isSettled && isExpanded && parlayLegs.legs.length > 0 && (
          <div className="mb-3 space-y-4 border-t border-white/10 pt-3">
            {parlayLegs.legs.map((leg, index) => {
              const legScores = generateScoresForLeg(leg, index);
              const legTeams = getTeamNamesForLeg(leg, index);
              const winHighlight = isWon ? getWinHighlight(leg, legTeams, legScores.homeScore, legScores.awayScore) : { home: false, away: false };
              
              return (
                <div key={index} className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="text-white font-bold text-base">
                        {leg.selection} {leg.betType ? '' : 'Moneyline'}
                      </div>
                      {parlayLegs.hasRealData && leg.betType && (
                        <div className="text-gray-500 text-xs">{leg.betType}</div>
                      )}
                    </div>
                    {parlayLegs.hasRealData && leg.odds && (
                      <div className="text-white font-bold text-lg">
                        {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${winHighlight.home ? 'text-green-400 font-semibold' : 'text-white/90'}`}>{legTeams.homeTeam}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2 text-gray-400 text-sm">
                          {legScores.homeQuarters.map((q, i) => <span key={i}>{q}</span>)}
                        </div>
                        <span className={`font-bold text-lg w-8 text-right ${winHighlight.home ? 'text-green-400' : 'text-white'}`}>{legScores.homeScore}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${winHighlight.away ? 'text-green-400 font-semibold' : 'text-white/90'}`}>{legTeams.awayTeam}</span>
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
            <div className="text-right pt-1">
              <span className="text-gray-400 text-xs">Finished</span>
            </div>
          </div>
        )}

        {isOpen && !isParlay && (
          <div className="mb-3">
            <div className="text-gray-400 text-xs uppercase mb-1">Game</div>
            <div className="text-white text-sm font-medium">{bet.matchup}</div>
            <div className="text-blue-300 text-xs mt-0.5">
              {bet.gameStart ? new Date(bet.gameStart).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }) : 'Upcoming'}
            </div>
          </div>
        )}

        {isOpen && isParlay && parlayLegs.legs.length > 0 && (
          <div className="mb-3">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="text-gray-400 text-xs uppercase">
                {parlayLegs.legs.length} Games
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
                  const hasLiveData = leg.homeScore !== undefined && leg.awayScore !== undefined;
                  
                  return (
                    <div key={index} className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-white font-bold text-base">
                            {leg.selection} {leg.betType ? '' : 'Moneyline'}
                          </div>
                          {parlayLegs.hasRealData && leg.betType && (
                            <div className="text-gray-500 text-xs">{leg.betType}</div>
                          )}
                        </div>
                        {parlayLegs.hasRealData && leg.odds && (
                          <div className="text-blue-400 font-bold text-lg">
                            {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-white/90 text-sm">{legTeams.homeTeam}</span>
                          {hasLiveData ? (
                            <span className="text-white font-bold">{leg.homeScore}</span>
                          ) : (
                            <span className="text-blue-400 text-xs">-</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/90 text-sm">{legTeams.awayTeam}</span>
                          {hasLiveData ? (
                            <span className="text-white font-bold">{leg.awayScore}</span>
                          ) : (
                            <span className="text-blue-400 text-xs">-</span>
                          )}
                        </div>
                      </div>
                      {leg.gameStart && (
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
                      {hasLiveData && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-green-400 text-xs font-medium">LIVE</span>
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

        <div className="border-t border-white/20 pt-3 mt-2">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-white font-bold text-xl">${formatMoney(bet.stake || 0)}</div>
              <div className="text-gray-400 text-xs uppercase">Total Pikked</div>
            </div>
            {isWon && (
              <div className="text-right">
                <div className="text-green-400 font-bold text-xl">${formatMoney(payout)}</div>
                <div className="text-green-400/80 text-xs uppercase">Won on Piks</div>
              </div>
            )}
            {isOpen && (
              <div className="text-right">
                <div className="text-blue-400 font-bold text-xl">${formatMoney(payout)}</div>
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
                <div className="text-orange-400 font-bold text-xl">${formatMoney(bet.stake * 0.8)}</div>
                <div className="text-orange-400/80 text-xs uppercase">Cashed Out</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mt-3 text-[10px] text-gray-500">
          <div className="font-mono">PIK ID: {pikId}</div>
          <div>PLACED: {formatPlacedDate()}</div>
        </div>

        {isOpen && onCashOut && (
          <button
            ref={buttonRef}
            onClick={() => {
              if (confirmingCashOut) {
                onCashOut(bet.id);
                setConfirmingCashOut(false);
              } else {
                setConfirmingCashOut(true);
              }
            }}
            className={`w-full mt-3 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all ${
              confirmingCashOut 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            }`}
          >
            {confirmingCashOut ? `Confirm Cash Out ($${formatMoney(bet.stake * 0.8)})` : `Cash Out ($${formatMoney(bet.stake * 0.8)})`}
          </button>
        )}

        {isWon && onShare && (
          <button
            onClick={() => onShare(bet)}
            className="w-full mt-3 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>Share Win</span>
          </button>
        )}
      </div>
    </div>
  );
}
