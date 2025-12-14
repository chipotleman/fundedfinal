import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SessionSummaryPopup({ isOpen, onClose, sessionData }) {
  const router = useRouter();
  
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !sessionData) return null;

  const formatDuration = (ms) => {
    if (!ms || ms < 0) return '0m';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleClose = () => {
    onClose();
    router.push('/');
  };

  const {
    duration = 0,
    betsPlaced = 0,
    wins = 0,
    losses = 0,
    pending = 0,
    profitLoss = 0,
    challengePhase = null,
    challengeTier = null,
    isDemo = false
  } = sessionData;

  const winRate = betsPlaced > 0 ? Math.round((wins / (wins + losses)) * 100) || 0 : 0;
  const isProfitable = profitLoss >= 0;

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto"
    >
      <div 
        className="relative bg-black rounded-3xl max-w-md w-full my-auto border border-gray-800/50"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 pt-8">
          <div className="text-center mb-6">
            <div className="mb-4">
              <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
            </div>
            {isDemo && (
              <span className="inline-block px-3 py-1 mb-2 rounded-full text-xs font-bold uppercase tracking-wide bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Demo Session
              </span>
            )}
            <h3 className="text-xl font-bold text-white mb-2">Session Summary</h3>
            <p className="text-gray-400 text-sm">Here's what you accomplished</p>
          </div>

          <div className="bg-slate-800/30 rounded-2xl p-4 mb-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Session Duration</span>
              <span className="text-white font-bold text-lg">{formatDuration(duration)}</span>
            </div>
            
            {challengeTier && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Challenge</span>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    challengeTier === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    challengeTier === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {challengeTier}
                  </span>
                  {challengePhase && (
                    <span className="text-gray-400 text-xs">Phase {challengePhase}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-300 font-medium">Bets Placed</span>
              </div>
              <span className="text-white font-bold">{betsPlaced}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="py-3 px-3 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
                <div className="text-green-400 font-bold text-lg">{wins}</div>
                <div className="text-gray-400 text-xs">Wins</div>
              </div>
              <div className="py-3 px-3 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                <div className="text-red-400 font-bold text-lg">{losses}</div>
                <div className="text-gray-400 text-xs">Losses</div>
              </div>
              <div className="py-3 px-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                <div className="text-blue-400 font-bold text-lg">{pending}</div>
                <div className="text-gray-400 text-xs">Pending</div>
              </div>
            </div>

            {betsPlaced > 0 && (
              <div className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-300 font-medium">Win Rate</span>
                </div>
                <span className={`font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winRate}%</span>
              </div>
            )}

            <div className={`flex justify-between items-center py-4 px-4 rounded-xl border ${
              isProfitable 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isProfitable ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <svg className={`w-4 h-4 ${isProfitable ? 'text-green-400' : 'text-red-400'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-300 font-medium">Session P/L</span>
              </div>
              <span className={`font-bold text-lg ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '+' : ''}{profitLoss.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300"
          >
            Done
          </button>

          <p className="text-center text-gray-500 text-xs mt-4">
            See you next time!
          </p>
        </div>
      </div>
    </div>
  );
}