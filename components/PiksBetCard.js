import { useState, useEffect, useRef, useMemo } from 'react';

export default function PiksBetCard({ bet, onCashOut, onShare }) {
  const [confirmingCashOut, setConfirmingCashOut] = useState(false);
  const buttonRef = useRef(null);
  
  const pikId = useMemo(() => {
    if (bet.pikId) return bet.pikId;
    return `${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
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

  // Memoize scores - will use real data from bet object when API is connected
  const scores = useMemo(() => {
    // If bet has real score data, use it
    if (bet.homeScore !== undefined && bet.awayScore !== undefined) {
      return {
        homeScore: bet.homeScore,
        awayScore: bet.awayScore,
        homeQuarters: bet.homeQuarters || [],
        awayQuarters: bet.awayQuarters || []
      };
    }
    // Generate placeholder scores for finished games (won/lost)
    if (isWon || isLost) {
      const seed = bet.id ? bet.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 12345;
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
    return { homeScore: null, awayScore: null, homeQuarters: [], awayQuarters: [] };
  }, [bet.id, bet.homeScore, bet.awayScore, bet.homeQuarters, bet.awayQuarters, isWon, isLost]);

  return (
    <div 
      className="relative bg-black rounded-lg overflow-hidden mx-2 sm:mx-0 border border-gray-800 outline-none focus:outline-none focus:ring-0"
    >
            
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between -mt-1">
          <div className="flex items-center">
            <img src="/funderlogo/Piks.png" alt="Piks" className="h-20 object-contain -ml-[30px]" />
          </div>
          
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] ${
            isWon ? 'bg-green-500/20 border border-green-500/50' :
            isOpen ? 'bg-blue-500/20 border border-blue-500/50' :
            isCashedOut ? 'bg-orange-500/20 border border-orange-500/50' :
            'bg-red-500/20 border border-red-500/50'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isWon ? 'bg-green-400' : isOpen ? 'bg-blue-400 animate-pulse' : isCashedOut ? 'bg-orange-400' : 'bg-red-400'
            }`}></div>
            <span className={`font-bold ${
              isWon ? 'text-green-400' : isOpen ? 'text-blue-400' : isCashedOut ? 'text-orange-400' : 'text-red-400'
            }`}>
              {isWon ? 'WON' : isOpen ? 'OPEN' : isCashedOut ? 'CASHED OUT' : 'LOST'}
            </span>
          </div>
        </div>

        <div className="pt-1 mt-1">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="text-white font-bold text-sm">{bet.selection}</div>
              <div className="text-gray-400 text-xs uppercase">{bet.betType}</div>
            </div>
            <div className={`font-bold text-lg ${isOpen ? 'text-blue-400' : 'text-white'}`}>
              {formatOdds(bet.odds)}
            </div>
          </div>

          {(isWon || isLost) && (
            <div className="mt-1 space-y-0.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white">{bet.matchup?.split(' @ ')[1] || bet.matchup?.split(' vs ')[0] || 'Home Team'}</span>
                <div className="flex items-center space-x-2">
                  {scores.homeQuarters.length > 0 && (
                    <div className="flex space-x-1 text-gray-400">
                      {scores.homeQuarters.map((q, i) => <span key={i}>{q}</span>)}
                    </div>
                  )}
                  <span className="text-white font-bold">{scores.homeScore}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white">{bet.matchup?.split(' @ ')[0] || bet.matchup?.split(' vs ')[1] || 'Away Team'}</span>
                <div className="flex items-center space-x-2">
                  {scores.awayQuarters.length > 0 && (
                    <div className="flex space-x-1 text-gray-400">
                      {scores.awayQuarters.map((q, i) => <span key={i}>{q}</span>)}
                    </div>
                  )}
                  <span className="text-white font-bold">{scores.awayScore}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-gray-400 text-[10px]">Finished</span>
              </div>
            </div>
          )}

          {isOpen && (
            <div className="mt-1 bg-slate-800/50 rounded p-1.5">
              <div className="text-gray-400 text-[10px] uppercase">Game</div>
              <div className="text-white text-xs font-medium">{bet.matchup}</div>
              <div className="text-blue-400 text-[10px]">
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
        </div>

        <div className="border-t border-white/30 mt-1 pt-1">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-white font-bold text-lg">${formatMoney(bet.stake || 0)}</div>
              <div className="text-gray-400 text-[10px] uppercase">Total Pikked</div>
            </div>
            {isWon && (
              <div className="text-right">
                <div className="text-green-400 font-bold text-lg">${formatMoney(payout)}</div>
                <div className="text-green-400 text-[10px] uppercase">Won on Piks</div>
              </div>
            )}
            {isOpen && (
              <div className="text-right">
                <div className="text-blue-400 font-bold text-lg">${formatMoney(payout)}</div>
                <div className="text-gray-400 text-[10px] uppercase">Potential Payout</div>
              </div>
            )}
            {isLost && (
              <div className="text-right">
                <div className="text-red-400 font-bold text-lg">$0.00</div>
                <div className="text-gray-400 text-[10px] uppercase">Payout</div>
              </div>
            )}
            {isCashedOut && (
              <div className="text-right">
                <div className="text-orange-400 font-bold text-lg">${formatMoney(bet.profit || (bet.stake * 0.8))}</div>
                <div className="text-gray-400 text-[10px] uppercase">Cashed Out</div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/30 mt-1 pt-1 flex justify-between items-center">
          <div className="text-gray-500 text-[10px] font-mono">PIK ID: {pikId}</div>
          <div className="text-gray-500 text-[10px]">PLACED: {formatPlacedDate()}</div>
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
            className={`w-full mt-1 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all ${
              confirmingCashOut 
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600'
            }`}
          >
            {confirmingCashOut ? `Confirm Cash Out ($${formatMoney(bet.stake * 0.8)})` : `Cash Out ($${formatMoney(bet.stake * 0.8)})`}
          </button>
        )}

        {isWon && onShare && (
          <button
            onClick={() => onShare(bet)}
            className="w-full mt-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center justify-center space-x-1"
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
