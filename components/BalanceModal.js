
import { useState, useEffect } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock';

export default function BalanceModal({ 
  isOpen, 
  onClose, 
  bankroll, 
  pnl, 
  challengePhase, 
  totalChallenges,
  progressPercent,
  challengeGoal,
  startingBankroll,
  themeColor = 'green'
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [challengeData, setChallengeData] = useState(null);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('purchased_challenge');
      if (stored) {
        setChallengeData(JSON.parse(stored));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const challengeName = challengeData?.name || 'Pro Challenge';
  const userSplit = challengeData?.userSplit || 80;
  const isFunded = progressPercent >= 100;
  const isEvaluationPhase = !isFunded;
  const currentBalance = bankroll || 10000;
  const profitTarget = challengeGoal || 12000;
  const profitNeeded = Math.max(0, profitTarget - currentBalance);
  const actualProgress = Math.min(100, ((currentBalance - startingBankroll) / (profitTarget - startingBankroll)) * 100);

  const challenges = [
    { name: 'Starter Challenge', balance: 5000, target: 6000, price: 149, badge: 'BEGINNER' },
    { name: 'Pro Challenge', balance: 10000, target: 12000, price: 249, badge: 'POPULAR' },
    { name: 'Elite Challenge', balance: 25000, target: 30000, price: 399, badge: 'ADVANCED' }
  ];

  const currentChallengeIndex = challenges.findIndex(c => c.name === challengeName);
  const canUpgrade = currentChallengeIndex < challenges.length - 1;
  const nextChallenge = canUpgrade ? challenges[currentChallengeIndex + 1] : null;

  const badge = challengeData?.badge || 'POPULAR';
  const tierColors = {
    BEGINNER: {
      statusBg: 'bg-blue-500/10 border border-blue-500/30',
      dot: 'bg-blue-500',
      text: 'text-blue-400',
      progressGradient: 'bg-gradient-to-r from-blue-500 to-cyan-400'
    },
    POPULAR: {
      statusBg: 'bg-green-500/10 border border-green-500/30',
      dot: 'bg-green-500',
      text: 'text-green-400',
      progressGradient: 'bg-gradient-to-r from-green-500 to-emerald-400'
    },
    ADVANCED: {
      statusBg: 'bg-purple-500/10 border border-purple-500/30',
      dot: 'bg-purple-500',
      text: 'text-purple-400',
      progressGradient: 'bg-gradient-to-r from-purple-500 to-violet-400'
    }
  };
  const currentTier = tierColors[badge] || tierColors.POPULAR;

  const handleUpgrade = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('openChallengePopup'));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 overflow-y-auto p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0a0a0a] rounded-2xl border border-gray-800/50 w-full max-w-2xl my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <img src="/pikslogotransparent.png" alt="Piks" className="h-20" />
            <div className={`flex-1 flex items-center gap-2 px-4 py-2 rounded-xl ${isFunded ? 'bg-green-500/10 border border-green-500/30' : currentTier.statusBg}`}>
              {isFunded ? (
                <>
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-bold text-sm">FUNDED ACCOUNT</span>
                </>
              ) : (
                <>
                  <div className={`w-2.5 h-2.5 ${currentTier.dot} rounded-full animate-pulse`}></div>
                  <span className={`${currentTier.text} font-bold text-sm`}>EVALUATION PHASE</span>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-10 h-10 bg-[#1a1a1a] hover:bg-[#252525] rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-[#111111] rounded-xl p-5 border border-gray-800/50 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  challengeData?.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400' :
                  challengeData?.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {challengeData?.badge || 'POPULAR'}
                </span>
                <h3 className="text-white font-bold text-xl mt-2">{challengeName}</h3>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-xs">Your Split</div>
                <div className="text-green-400 font-bold text-lg">{userSplit}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-gray-800/50">
                <div className="text-gray-500 text-xs mb-1">Current Balance</div>
                <div className="text-white font-bold text-xl">${currentBalance.toLocaleString()}</div>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-gray-800/50">
                <div className="text-gray-500 text-xs mb-1">Profit Target</div>
                <div className="text-green-400 font-bold text-xl">${profitTarget.toLocaleString()}</div>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Challenge Progress</span>
                <span className="text-white font-medium">{actualProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${isFunded ? 'bg-gradient-to-r from-green-500 to-emerald-400' : currentTier.progressGradient}`}
                  style={{ width: `${Math.min(actualProgress, 100)}%` }}
                ></div>
              </div>
              <div className="text-gray-500 text-xs mt-1">
                {isFunded ? 'Target achieved! You are funded.' : `$${profitNeeded.toLocaleString()} more profit needed`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Total P&L</div>
              <div className={`font-bold text-lg ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}${(pnl || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Win Rate</div>
              <div className="text-white font-bold text-lg">67%</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Total Bets</div>
              <div className="text-white font-bold text-lg">42</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Days Active</div>
              <div className="text-white font-bold text-lg">8</div>
            </div>
          </div>

          {canUpgrade && (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/30 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-bold mb-1">Ready to Level Up?</div>
                  <div className="text-gray-400 text-sm">
                    Upgrade to <span className="text-purple-400 font-medium">{nextChallenge?.name}</span> with ${nextChallenge?.balance.toLocaleString()} bankroll
                  </div>
                </div>
                <button
                  onClick={handleUpgrade}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm whitespace-nowrap"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          {isFunded && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/30 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-green-400 font-bold">You're Funded!</div>
                  <div className="text-gray-400 text-sm">
                    You keep {userSplit}% of all profits. Withdraw anytime from your dashboard.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50">
            <h4 className="text-white font-bold mb-3">Challenge Rules</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-400">15% daily loss limit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-400">Reach profit target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-400">All sports betting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-400">{userSplit}% profit share</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
