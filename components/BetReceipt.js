import { useEffect, useState } from 'react';

export default function BetReceipt({ bet, isDemo = false, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateProfit = (odds, stake) => {
    if (odds > 0) {
      return stake * odds / 100;
    } else {
      return stake * (100 / Math.abs(odds));
    }
  };

  const calculatePayout = (odds, stake) => {
    return stake + calculateProfit(odds, stake);
  };

  const toWin = bet.stake ? calculateProfit(bet.odds, bet.stake) : 0;
  const potentialPayout = bet.stake ? calculatePayout(bet.odds, bet.stake) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pointer-events-none">
      <div 
        className={`pointer-events-auto w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border-2 ${isDemo ? 'border-orange-500' : 'border-green-500'} rounded-2xl shadow-2xl transform transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}
      >
        {/* Header */}
        <div className={`${isDemo ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gradient-to-r from-green-500 to-blue-500'} px-6 py-4 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h2 className="text-xl font-bold text-white">Bet Placed</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {isDemo && (
            <div className="mt-2 inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-white font-bold text-sm">DEMO BET</span>
            </div>
          )}
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-4">
          {/* Matchup */}
          <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
            <div className="text-gray-400 text-xs mb-1">MATCHUP</div>
            <div className="text-white font-bold text-lg">{bet.matchup}</div>
          </div>

          {/* Bet Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
              <div className="text-gray-400 text-xs mb-1">SELECTION</div>
              <div className="text-white font-semibold">{bet.team}</div>
              <div className="text-gray-400 text-xs mt-1 capitalize">{bet.betType}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
              <div className="text-gray-400 text-xs mb-1">ODDS</div>
              <div className="text-green-400 font-bold text-2xl">
                {bet.odds > 0 ? '+' : ''}{bet.odds}
              </div>
            </div>
          </div>

          {/* Wager and Payout */}
          <div className="bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-xl p-4 border border-slate-500">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-gray-400 text-xs mb-1">WAGER</div>
                <div className="text-white font-bold text-xl">${bet.stake?.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs mb-1">TO WIN</div>
                <div className="text-green-400 font-bold text-xl">${toWin.toFixed(2)}</div>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-500/50">
              <div className="text-gray-400 text-xs mb-1">POTENTIAL PAYOUT</div>
              <div className={`font-bold text-2xl ${isDemo ? 'text-orange-400' : 'text-green-400'}`}>
                ${potentialPayout.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Bet ID and Timestamp */}
          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-slate-700">
            <div>
              <span className="font-mono">BET #{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
            </div>
            <div>{formatDate()}</div>
          </div>

          {isDemo && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
              <p className="text-orange-400 text-sm text-center font-medium">
                This is a demo bet. Sign up for a real funded challenge to win real money!
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Close
          </button>
          {isDemo && (
            <button
              onClick={() => window.location.href = '/auth'}
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all"
            >
              Get Funded
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
