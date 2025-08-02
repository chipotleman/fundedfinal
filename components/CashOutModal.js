
import { useState } from 'react';

export default function CashOutModal({ isOpen, onClose, bet, onCashOut }) {
  const [cashOutAmount, setCashOutAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate cash out value based on current odds and game state
  const calculateCashOut = () => {
    const originalStake = bet?.stake || 0;
    const profit = originalStake * 0.85; // 85% of original potential win
    return Math.round(profit * 100) / 100;
  };

  useState(() => {
    if (bet) {
      setCashOutAmount(calculateCashOut());
    }
  }, [bet]);

  const handleCashOut = async () => {
    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      onCashOut(bet.id, cashOutAmount);
      setIsProcessing(false);
      onClose();
    }, 1500);
  };

  if (!isOpen || !bet) return null;

  const profitLoss = cashOutAmount - bet.stake;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Cash Out Bet</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bet Details */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-700/30 rounded-xl p-4">
            <div className="text-white font-semibold mb-2">{bet.matchup}</div>
            <div className="text-gray-300 text-sm">{bet.selection}</div>
            <div className="text-gray-400 text-xs">{bet.betType}</div>
          </div>

          {/* Cash Out Details */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Original Stake:</span>
              <span className="text-white font-semibold">${bet.stake}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Cash Out Amount:</span>
              <span className="text-green-400 font-bold text-lg">${cashOutAmount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Profit/Loss:</span>
              <span className={`font-bold ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profitLoss >= 0 ? '+' : ''}${profitLoss}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-yellow-400 text-sm font-medium">
                Cash out is final and cannot be undone
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Keep Bet
            </button>
            <button
              onClick={handleCashOut}
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                `Cash Out $${cashOutAmount}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
