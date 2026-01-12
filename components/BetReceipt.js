import { useEffect, useState, useMemo } from 'react';

export default function BetReceipt({ bet, isDemo = false, onClose }) {
  console.log('[BetReceipt v2.0] Received bet:', { isLive: bet?.isLive, awayScore: bet?.awayScore, homeScore: bet?.homeScore });
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const pikId = useMemo(() => {
    return `${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  }, [bet]);

  useEffect(() => {
    if (!bet) return;
    setIsVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, 8000);

    return () => clearTimeout(timer);
  }, [bet]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const formatPlacedDate = () => {
    const date = new Date();
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} ${time}`;
  };

  const formatGameTime = (gameStart) => {
    if (!gameStart) return null;
    const date = new Date(gameStart);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculatePayout = (odds, stake) => {
    if (odds > 0) {
      return (stake * odds / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(odds))) + stake;
    }
  };

  if (!bet) return null;

  const payout = bet.stake ? calculatePayout(bet.odds, bet.stake) : 0;
  
  const status = bet.status || 'open';
  const isWon = status === 'won';
  const isOpen = status === 'open';
  const isLost = status === 'lost';
  const isCashedOut = status === 'cashed_out';

  const isParlay = bet.legs && Array.isArray(bet.legs) && bet.legs.length > 1;
  const hasAnyLiveLeg = isParlay 
    ? bet.legs.some(leg => !!leg.isLive)
    : !!bet.isLive;

  const getStatusColor = () => {
    if (isDemo) return 'orange';
    if (isWon) return 'green';
    if (isLost) return 'red';
    if (isCashedOut) return 'cashedout';
    return 'white';
  };
  
  const statusColor = getStatusColor();
  
  const colorClasses = {
    green: {
      border: 'border-green-500',
      badge: 'bg-green-500/20 border-green-500/50',
      dot: 'bg-green-400',
      text: 'text-green-400',
      payout: 'text-green-400'
    },
    white: {
      border: 'border-white/50',
      badge: 'bg-white/10 border-white/30',
      dot: 'bg-white',
      text: 'text-white',
      payout: 'text-white'
    },
    cashedout: {
      border: 'border-white/50',
      badge: 'bg-[#E9762B]/20 border-[#E9762B]/50',
      dot: 'bg-[#E9762B]',
      text: 'text-[#E9762B]',
      payout: 'text-[#E9762B]'
    },
    red: {
      border: 'border-red-500',
      badge: 'bg-red-500/20 border-red-500/50',
      dot: 'bg-red-400',
      text: 'text-red-400',
      payout: 'text-red-400'
    },
    orange: {
      border: 'border-orange-500',
      badge: 'bg-orange-500/20 border-orange-500/50',
      dot: 'bg-orange-400',
      text: 'text-orange-400',
      payout: 'text-orange-400'
    }
  };
  
  const colors = colorClasses[statusColor];
  
  const getStatusLabel = () => {
    if (isWon) return 'WON';
    if (isLost) return 'LOST';
    if (isCashedOut) return 'CASHED OUT';
    return 'OPEN';
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 transition-all duration-300 ${isVisible ? 'backdrop-blur-sm bg-black/50' : ''}`} onClick={handleClose}>
      <div 
        className={`w-full max-w-md transform transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className={`relative bg-black rounded-lg overflow-hidden border ${colors.border}`}
        >
          {isDemo && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-30deg] pointer-events-none z-10">
              <div className="text-orange-500/20 text-6xl font-black tracking-widest whitespace-nowrap">
                DEMO
              </div>
            </div>
          )}
          
          <div className="px-4 pt-2 pb-3 relative">
            <div className="flex items-center justify-between -mt-1">
              <div className="flex items-center">
                <img src="/pikslogotransparent.png" alt="Piks" className="h-[120px] object-contain -ml-[31px]" />
              </div>
              
              <div className="flex items-center gap-2">
                {isDemo && (
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] bg-orange-500/20 border border-orange-500/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                    <span className="font-bold text-orange-400">DEMO</span>
                  </div>
                )}
                <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] ${colors.badge} border`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${isOpen ? 'animate-pulse' : ''}`}></div>
                  <span className={`font-bold ${colors.text}`}>{getStatusLabel()}</span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white transition-colors ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {isParlay ? (
              <div className="pt-1 mt-1">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm">{bet.legs.length} Leg Parlay</div>
                    <div className="text-gray-400 text-xs uppercase">Parlay</div>
                  </div>
                  <div className={`font-bold text-lg ${isOpen ? colors.text : 'text-white'}`}>
                    {formatOdds(bet.odds)}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs uppercase">
                      {bet.legs.length} Games
                    </span>
                    {hasAnyLiveLeg && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-500 text-xs font-medium">LIVE</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="text-gray-400"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-3">
                    {bet.legs.map((leg, index) => {
                      const isLegLive = !!leg.isLive;
                      const hasLegLiveScores = isLegLive && (typeof leg.awayScore === 'number' || typeof leg.homeScore === 'number');
                      const gameTime = formatGameTime(leg.gameStart);
                      
                      return (
                        <div key={index} className="bg-slate-800/50 rounded p-2">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1">
                              <div className="text-white font-bold text-xs">{leg.selection}</div>
                              <div className="text-gray-400 text-[10px] uppercase">{leg.betType || 'Moneyline'}</div>
                            </div>
                            {leg.odds && (
                              <div className="font-bold text-sm text-blue-400">
                                {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                              </div>
                            )}
                          </div>
                          {hasLegLiveScores ? (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-white text-sm font-medium">{leg.awayTeamFull || leg.awayTeam || leg.matchup?.split(' @ ')[0]}</span>
                                <span className="text-white font-bold">{leg.awayScore}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-white text-sm font-medium">{leg.homeTeamFull || leg.homeTeam || leg.matchup?.split(' @ ')[1]}</span>
                                <span className="text-white font-bold">{leg.homeScore}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-500 text-xs font-medium">LIVE</span>
                                {(leg.displayClock || leg.time || leg.period || leg.quarter) && (
                                  <span className="text-red-500/70 text-xs">{leg.displayClock || leg.time || leg.period || leg.quarter}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-white">{leg.matchup}</div>
                              <div className="text-xs mt-0.5 text-blue-300">
                                {gameTime || 'Upcoming'}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (() => {
              const isLive = bet.isLive === true;
              const hasScores = typeof bet.homeScore === 'number' && typeof bet.awayScore === 'number';
              const showLiveDisplay = isLive || hasScores;
              
              return (
                <div className="pt-1 mt-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-white font-bold text-sm">{bet.team || bet.selection}</div>
                      <div className="text-gray-400 text-xs uppercase">{bet.betType}</div>
                    </div>
                    <div className={`font-bold text-lg ${isOpen ? colors.text : 'text-white'}`}>
                      {formatOdds(bet.odds)}
                    </div>
                  </div>

                  <div className="mt-1 bg-slate-800/50 rounded p-2">
                    <div className="text-gray-400 text-[10px] uppercase mb-1">Game</div>
                    {showLiveDisplay ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-white text-sm font-medium">{bet.homeTeamFull || bet.homeTeam || bet.matchup?.split(' @ ')[1]}</span>
                          <span className="text-white font-bold">{bet.homeScore}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white text-sm font-medium">{bet.awayTeamFull || bet.awayTeam || bet.matchup?.split(' @ ')[0]}</span>
                          <span className="text-white font-bold">{bet.awayScore}</span>
                        </div>
                        {isLive && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-red-500 text-xs font-medium">LIVE</span>
                            {(bet.displayClock || bet.time || bet.period || bet.quarter) && (
                              <span className="text-red-500/70 text-xs">{bet.displayClock || bet.time || bet.period || bet.quarter}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-white">{bet.matchup}</div>
                        <div className="text-xs mt-0.5 text-blue-300">
                          {isWon || isLost || isCashedOut ? 'Finished' : (formatGameTime(bet.gameStart) || bet.gameTime || 'Upcoming')}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-white/30 mt-2 pt-2">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-white font-bold text-lg">${bet.stake?.toFixed(2)}</div>
                  <div className="text-gray-400 text-[10px] uppercase">Total Pikked</div>
                </div>
                <div className="text-right">
                  {isWon && (
                    <>
                      <div className="text-green-400 font-bold text-lg">${payout.toFixed(2)}</div>
                      <div className="text-green-400 text-[10px] uppercase">Won on Piks</div>
                    </>
                  )}
                  {isOpen && (
                    <>
                      <div className={`font-bold text-lg ${colors.payout}`}>${payout.toFixed(2)}</div>
                      <div className="text-gray-400 text-[10px] uppercase">Potential Payout</div>
                    </>
                  )}
                  {isLost && (
                    <>
                      <div className="text-red-400 font-bold text-lg">$0.00</div>
                      <div className="text-gray-400 text-[10px] uppercase">Payout</div>
                    </>
                  )}
                  {isCashedOut && (
                    <>
                      <div className="text-[#E9762B] font-bold text-lg">${(bet.profit || bet.stake * 0.8).toFixed(2)}</div>
                      <div className="text-gray-400 text-[10px] uppercase">Cashed Out</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/30 mt-1 pt-1 flex justify-between items-center">
              <div className="text-gray-500 text-[10px] font-mono">PIK ID: {pikId}</div>
              <div className="text-gray-500 text-[10px]">PLACED: {formatPlacedDate()}</div>
            </div>

            {isDemo && (
              <div className="mt-3 bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
                <p className="text-orange-400 text-xs text-center font-medium">
                  Demo bet placed! Sign up for a real funded challenge to win real money.
                </p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              {isDemo && (
                <button
                  onClick={() => window.location.href = '/auth'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all"
                >
                  Get Funded
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
