import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const challenges = [
  {
    id: 1,
    name: "Starter Challenge",
    description: "Perfect for beginners looking to get started",
    startingBalance: 5000,
    target: 1000,
    maxBet: 250,
    badge: "BEGINNER"
  },
  {
    id: 2,
    name: "Pro Challenge",
    description: "For experienced bettors ready to scale up",
    startingBalance: 10000,
    target: 2000,
    maxBet: 500,
    badge: "POPULAR"
  },
  {
    id: 3,
    name: "Elite Challenge",
    description: "Maximum stakes for serious professionals",
    startingBalance: 25000,
    target: 5000,
    maxBet: 1250,
    badge: "ADVANCED"
  }
];

export default function DemoPopup({ isOpen, onClose, initialIndex = 1 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userSplit, setUserSplit] = useState(70);
  const [showRules, setShowRules] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
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
  }, [isOpen, initialIndex]);

  const handleChallengeSelect = (index) => {
    setCurrentIndex(index);
    setShowDropdown(false);
  };

  const handleStartDemo = () => {
    const demoChallenge = {
      ...currentChallenge,
      userSplit,
      isDemoMode: true,
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('demo_challenge', JSON.stringify(demoChallenge));
    onClose();
    router.push('/demo-dashboard');
  };

  if (!isOpen) return null;

  const currentChallenge = challenges[currentIndex];

  const getThemeColors = () => {
    if (currentChallenge.badge === 'BEGINNER') {
      return {
        primary: 'blue',
        border: 'border-blue-500',
        borderColor: '#3b82f6',
        borderLight: 'border-blue-400/50',
        shadow: 'shadow-blue-400/20',
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        gradient: 'from-blue-500 to-blue-600',
        gradientHover: 'hover:from-blue-600 hover:to-blue-700',
        splitGradient: 'from-blue-500/10 to-blue-600/10',
        splitBorder: 'border-blue-500/30',
        splitBar: 'from-blue-400 to-blue-500'
      };
    } else if (currentChallenge.badge === 'POPULAR') {
      return {
        primary: 'green',
        border: 'border-green-500',
        borderColor: '#22c55e',
        borderLight: 'border-green-400/50',
        shadow: 'shadow-green-400/20',
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        gradient: 'from-green-500 to-blue-500',
        gradientHover: 'hover:from-green-600 hover:to-blue-600',
        splitGradient: 'from-green-500/10 to-blue-500/10',
        splitBorder: 'border-green-500/30',
        splitBar: 'from-green-400 to-green-500'
      };
    } else {
      return {
        primary: 'purple',
        border: 'border-purple-500',
        borderColor: '#a855f7',
        borderLight: 'border-purple-400/50',
        shadow: 'shadow-purple-400/20',
        bg: 'bg-purple-500/20',
        text: 'text-purple-400',
        gradient: 'from-purple-500 to-purple-600',
        gradientHover: 'hover:from-purple-600 hover:to-purple-700',
        splitGradient: 'from-purple-500/10 to-purple-600/10',
        splitBorder: 'border-purple-500/30',
        splitBar: 'from-purple-400 to-purple-500'
      };
    }
  };

  const theme = getThemeColors();

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
      <div 
        className="popup-content relative bg-black rounded-3xl max-w-md w-full my-auto border-2"
        style={{ 
          borderColor: theme.borderColor,
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 pt-8">
          <div className="text-center mb-4">
            <div className="mb-4">
              <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="inline-flex items-center bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-500/30 mb-3">
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
              </svg>
              FREE DEMO MODE
            </div>
            <p className="text-gray-400 text-xs">Practice with virtual funds - No payment required</p>
          </div>

          <div className="text-center mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              currentChallenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              currentChallenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {currentChallenge.badge}
            </span>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">{currentChallenge.name}</h3>
            <p className="text-gray-400 text-sm">{currentChallenge.description}</p>
          </div>

          <div className="space-y-3 mb-6" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <div className="relative">
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-xl border-2 ${theme.borderLight} cursor-pointer hover:${theme.border} transition-all duration-300 shadow-lg ${theme.shadow}`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div>
                  <span className="text-gray-300 font-medium text-sm">Starting Balance</span>
                  <div className={`text-xs ${theme.text} font-medium`}>Click to change</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`${theme.text} font-bold`}>${currentChallenge.startingBalance.toLocaleString()}</span>
                  <svg className={`w-4 h-4 ${theme.text} transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-20" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  {challenges.map((challenge, index) => (
                    <div
                      key={challenge.id}
                      onClick={() => handleChallengeSelect(index)}
                      className={`flex justify-between items-center py-3 px-4 cursor-pointer hover:bg-slate-700/50 transition-all duration-200 ${
                        index === currentIndex ? `${theme.bg} border-l-4 ${theme.border}` : ''
                      } ${index === 0 ? 'rounded-t-xl' : ''} ${index === challenges.length - 1 ? 'rounded-b-xl' : ''}`}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div>
                        <span className="text-white font-medium text-sm">{challenge.name}</span>
                        <div className="text-xs text-gray-400">{challenge.badge}</div>
                      </div>
                      <span className={`${theme.text} font-bold`}>${challenge.startingBalance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowRules(!showRules)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <h4 className="text-white font-semibold text-sm">Challenge Rules</h4>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {showRules && (
                <div className="space-y-1 text-xs mt-2 pb-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pick Minimum</span>
                    <span className="text-white font-medium">20 picks</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Risk Range</span>
                    <span className="text-white font-medium">1% - 5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Max Daily Loss</span>
                    <span className="text-white font-medium">10%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Max Drawdown</span>
                    <span className="text-white font-medium">15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Profit Target (Phase 1 & 2)</span>
                    <span className="text-green-400 font-medium">20%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Pick Cashout Fee</span>
                    <span className="text-white font-medium">10%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Reward Split (After Phase 2)</span>
                    <span className="text-blue-400 font-medium">90%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Same Game Parlays</span>
                    <span className="text-green-400 font-medium">YES</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!showRules && (
            <div className={`p-4 bg-gradient-to-r ${theme.splitGradient} rounded-2xl border ${theme.splitBorder} mb-4 relative`} style={{ WebkitTapHighlightColor: 'transparent' }}>
              <button
                onClick={() => setUserSplit(70)}
                className="absolute top-2 right-2 w-6 h-6 bg-slate-700/80 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                title="Reset to 70%"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <div className="text-center mb-3">
                <div className="text-sm font-medium text-gray-300">Split Boost</div>
                <div className="text-xs text-gray-400">Drag anywhere on the bar to boost your split</div>
              </div>

              <div
                className="flex h-10 rounded-xl overflow-hidden border border-slate-600 cursor-grab active:cursor-grabbing relative"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const startX = e.clientX;
                  const startSplit = userSplit;

                  const handleMouseMove = (e) => {
                    const deltaX = e.clientX - startX;
                    const deltaPercent = (deltaX / rect.width) * 100;
                    const newSplit = Math.max(70, Math.min(90, startSplit + deltaPercent));
                    setUserSplit(Math.round(newSplit));
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                onTouchStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const startX = e.touches[0].clientX;
                  const startSplit = userSplit;

                  const handleTouchMove = (e) => {
                    const deltaX = e.touches[0].clientX - startX;
                    const deltaPercent = (deltaX / rect.width) * 100;
                    const newSplit = Math.max(70, Math.min(90, startSplit + deltaPercent));
                    setUserSplit(Math.round(newSplit));
                  };

                  const handleTouchEnd = () => {
                    document.removeEventListener('touchmove', handleTouchMove);
                    document.removeEventListener('touchend', handleTouchEnd);
                  };

                  document.addEventListener('touchmove', handleTouchMove);
                  document.addEventListener('touchend', handleTouchEnd);
                }}
              >
                <div
                  className={`bg-gradient-to-r ${theme.splitBar} flex items-center justify-center text-white text-xs font-bold transition-all duration-150`}
                  style={{ width: `${userSplit}%` }}
                >
                  You {userSplit}%
                </div>
                <div
                  className="bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold transition-all duration-150"
                  style={{ width: `${100 - userSplit}%` }}
                >
                  Us {100 - userSplit}%
                </div>
              </div>
            </div>
          )}

          {!showRules && (
            <div className="text-center mb-4 p-3 bg-slate-800/30 rounded-xl border border-slate-600" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <div className="flex items-center justify-center space-x-2">
                <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">FREE</div>
              </div>
              <div className="text-gray-400 text-xs">
                Demo experience - practice mode
              </div>
            </div>
          )}

          <button
            onClick={handleStartDemo}
            className={`w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} text-white font-bold py-3 px-6 rounded-xl shadow-2xl mb-4 transform hover:scale-105 transition-all duration-300`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Start Demo Challenge
          </button>

          <div className="flex justify-center space-x-2 mb-4" style={{ WebkitTapHighlightColor: 'transparent' }}>
            {challenges.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors cursor-pointer`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  backgroundColor: index === currentIndex ? theme.borderColor : '#4b5563'
                }}
              />
            ))}
          </div>

          <div className="text-center pt-2 border-t border-slate-700/50">
            <p className="text-gray-500 text-xs mb-2">
              This is a simulated experience with virtual funds.
            </p>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('openChallengePopup'));
              }}
              className={`${theme.text} hover:opacity-80 text-sm font-medium transition-colors`}
            >
              Ready for the real thing? Get Funded →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
