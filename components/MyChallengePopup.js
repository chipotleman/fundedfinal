import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function MyChallengePopup({ isOpen, onClose }) {
  const [challengeData, setChallengeData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      const stored = localStorage.getItem('purchased_challenge');
      if (stored) {
        setChallengeData(JSON.parse(stored));
      }

      if (session?.user?.id) {
        fetch(`/api/profiles/${session.user.id}`)
          .then(res => res.json())
          .then(profile => {
            setUserProfile(profile);
            setLoading(false);
          })
          .catch(err => {
            console.error('Error fetching profile:', err);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
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
  }, [isOpen, session]);

  if (!isOpen) return null;

  const challengeObj = typeof userProfile?.challenge === 'object' ? userProfile.challenge : null;
  const challengeName = challengeObj?.name || challengeData?.name || 'Pro Challenge';
  const userSplit = challengeObj?.userSplit || (userProfile?.profit_split ? parseFloat(userProfile.profit_split) : (challengeData?.userSplit || 80));
  const startingBalance = challengeObj?.startingBalance || (userProfile?.starting_bankroll ? parseFloat(userProfile.starting_bankroll) : (challengeData?.startingBalance || 10000));
  const currentBalance = userProfile?.bankroll ? parseFloat(userProfile.bankroll) : startingBalance;
  const profitTarget = startingBalance * 1.2;
  const pnl = currentBalance - startingBalance;
  const profitNeeded = Math.max(0, profitTarget - currentBalance);
  const actualProgress = Math.min(100, ((currentBalance - startingBalance) / (profitTarget - startingBalance)) * 100);
  const isFunded = userProfile?.phase === 'funded' || actualProgress >= 100;

  const totalBets = userProfile?.total_bets || 0;
  const wins = userProfile?.wins || 0;
  const losses = userProfile?.losses || 0;
  const winRate = totalBets > 0 ? Math.round((wins / totalBets) * 100) : 0;
  
  const challengeNameStr = challengeObj?.name || challengeData?.name || '';
  const badgeFromProfile = challengeNameStr.includes('Starter') ? 'BEGINNER' : 
                          challengeNameStr.includes('Elite') ? 'ADVANCED' : 'POPULAR';

  const badge = challengeData?.badge || badgeFromProfile;
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

  const handleGoToLab = () => {
    onClose();
    router.push('/dashboard');
  };

  const handleWithdraw = () => {
    onClose();
    router.push('/withdrawal');
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-start pt-10 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0a0a0a] rounded-2xl border border-gray-800/50 w-full max-w-2xl mx-4 mb-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <img src="/funderlogo/Piks.png" alt="Piks" className="h-10" />
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
                  (challengeData?.badge || badgeFromProfile) === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400' :
                  (challengeData?.badge || badgeFromProfile) === 'POPULAR' ? 'bg-green-500/20 text-green-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {challengeData?.badge || badgeFromProfile}
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
                <span className="text-white font-medium">{Math.max(0, actualProgress).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${isFunded ? 'bg-gradient-to-r from-green-500 to-emerald-400' : currentTier.progressGradient}`}
                  style={{ width: `${Math.max(0, Math.min(actualProgress, 100))}%` }}
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
                {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Win Rate</div>
              <div className="text-white font-bold text-lg">{winRate}%</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Total Bets</div>
              <div className="text-white font-bold text-lg">{totalBets}</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-3 border border-gray-800/50 text-center">
              <div className="text-gray-500 text-xs mb-1">Record</div>
              <div className="text-white font-bold text-lg">{wins}-{losses}</div>
            </div>
          </div>

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
                    You keep {userSplit}% of all profits. Withdraw anytime.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#111111] rounded-xl p-4 border border-gray-800/50 mb-6">
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

          <div className="flex gap-3">
            <button
              onClick={handleGoToLab}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              Go to The Lab
            </button>
            {isFunded && (
              <button
                onClick={handleWithdraw}
                className="flex-1 bg-[#111111] hover:bg-[#1a1a1a] text-white font-bold py-3 px-6 rounded-xl border border-gray-800/50 transition-all"
              >
                Withdraw
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
