
import React, { useState } from 'react';

export default function CashOutModal({ isOpen, onClose, bet, onCashOut }) {
  const [cashOutAmount, setCashOutAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !bet) return null;

  // Mock cash out calculation
  const originalStake = bet.stake || 100;
  const originalPayout = bet.potentialPayout || 250;
  const currentValue = originalStake * 1.3; // Mock 30% profit available

  const handleCashOut = async () => {
    setLoading(true);
    try {
      await onCashOut(bet.id, currentValue);
      onClose();
    } catch (error) {
      console.error('Cash out failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Cash Out</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Bet Details */}
          <div className="bg-slate-700/50 rounded-xl p-4">
            <div className="text-white font-medium mb-2">{bet.matchup}</div>
            <div className="text-gray-400 text-sm mb-3">{bet.description}</div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Original Stake</div>
                <div className="text-white font-bold">${originalStake.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400">Potential Payout</div>
                <div className="text-white font-bold">${originalPayout.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Cash Out Offer */}
          <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-500/30">
            <div className="text-center">
              <div className="text-gray-300 mb-2">Cash Out Available</div>
              <div className="text-3xl font-bold text-white mb-4">
                ${currentValue.toFixed(2)}
              </div>
              
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-400">Profit/Loss:</span>
                <span className={`font-bold ${currentValue > originalStake ? 'text-green-400' : 'text-red-400'}`}>
                  {currentValue > originalStake ? '+' : ''}${(currentValue - originalStake).toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-400 mb-1">
                  If you cash out now, you'll receive this amount regardless of the final outcome.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all"
            >
              Keep Bet
            </button>
            <button
              onClick={handleCashOut}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                'Cash Out Now'
              )}
            </button>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
            <div className="text-yellow-400 text-sm">
              ⚠️ Cash out values may change rapidly based on live game events.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
