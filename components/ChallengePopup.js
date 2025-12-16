import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';

const challenges = [
  {
    id: 1,
    name: "Starter Challenge",
    description: "Perfect for beginners looking to get started",
    startingBalance: 5000,
    target: 1000, // 20% of 5000
    maxBet: 250,
    payout: 800,
    price: 149,
    badge: "BEGINNER",
    popular: false
  },
  {
    id: 2,
    name: "Pro Challenge",
    description: "For experienced bettors ready to scale up",
    startingBalance: 10000,
    target: 2000, // 20% of 10000
    maxBet: 500,
    payout: 1600,
    price: 249,
    badge: "POPULAR",
    popular: true
  },
  {
    id: 3,
    name: "Elite Challenge",
    description: "Maximum stakes for serious professionals",
    startingBalance: 25000,
    target: 5000, // 20% of 25000
    maxBet: 1250,
    payout: 4000,
    price: 399,
    badge: "ADVANCED",
    popular: false
  }
];

export default function ChallengePopup({ isOpen, onClose, initialIndex = 1 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDropdown, setShowDropdown] = useState(false);
  const [step, setStep] = useState('selection'); // 'selection', 'checkout', or 'receipt'
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [userSplit, setUserSplit] = useState(70); // Default 70% user split (base)
  const [loading, setLoading] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showTargetExplainer, setShowTargetExplainer] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [termsAccepted, setTermsAccepted] = useState({ gambling: false, propFirm: false });
  const [showGamblingTerms, setShowGamblingTerms] = useState(false);
  const [showPropFirmTerms, setShowPropFirmTerms] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();

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

  const handleNext = async () => {
    setLoading(true);
    setCheckoutError(null);
    
    const challengeData = {
      ...currentChallenge,
      userSplit,
      adjustedPrice
    };
    
    localStorage.setItem('pending_challenge', JSON.stringify(challengeData));
    
    if (!session?.user) {
      setStep('auth');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/fanbasis-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          challengeType: currentChallenge.badge,
          challengeName: currentChallenge.name,
          startingBalance: currentChallenge.startingBalance,
          userSplit: userSplit,
          adjustedPrice: adjustedPrice,
          userId: session.user.id,
          userEmail: session.user.email || ''
        })
      });

      const data = await response.json();
      console.log('Fanbasis response:', data);

      if (data.success && data.paymentLink) {
        setCheckoutUrl(data.paymentLink);
        setStep('checkout');
      } else {
        setCheckoutError(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'auth') {
      setStep('selection');
      setAuthError('');
    } else {
      setStep('selection');
    }
  };

  const proceedToCheckout = async (userSession) => {
    setLoading(true);
    try {
      const response = await fetch('/api/fanbasis-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          challengeType: currentChallenge.badge,
          challengeName: currentChallenge.name,
          startingBalance: currentChallenge.startingBalance,
          userSplit: userSplit,
          adjustedPrice: adjustedPrice,
          userId: userSession.user.id,
          userEmail: userSession.user.email || ''
        })
      });

      const data = await response.json();
      console.log('Fanbasis response:', data);

      if (data.success && data.paymentLink) {
        setCheckoutUrl(data.paymentLink);
        setStep('checkout');
      } else {
        setCheckoutError(data.error || 'Failed to create checkout session');
        setStep('selection');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError('Failed to initialize checkout. Please try again.');
      setStep('selection');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    if (!authEmail.trim()) {
      setAuthError('Please enter an email address');
      setLoading(false);
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (isSignUp && authPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const signupRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
        });
        const signupData = await signupRes.json();
        if (!signupRes.ok) throw new Error(signupData.error || 'Signup failed');
      }

      const result = await signIn('credentials', {
        redirect: false,
        email: authEmail.trim(),
        password: authPassword
      });

      if (result?.error) {
        throw new Error('Invalid email or password');
      }

      const updatedSession = await updateSession();
      if (updatedSession?.user) {
        await proceedToCheckout(updatedSession);
      } else {
        setTimeout(async () => {
          const res = await fetch('/api/auth/session');
          const sess = await res.json();
          if (sess?.user) {
            await proceedToCheckout(sess);
          } else {
            setAuthError('Session error. Please try again.');
            setLoading(false);
          }
        }, 500);
      }
    } catch (error) {
      setAuthError(error.message || 'Authentication failed');
      setLoading(false);
    }
  };

  const handleBeginChallenge = () => {
    onClose();
    router.push('/auth');
  };

  if (!isOpen) return null;

  const currentChallenge = challenges[currentIndex];

  // Calculate price based on split (70% is base price)
  const baseSplit = 70;
  let priceMultiplier;

  if (userSplit > baseSplit) {
    // Surcharge for splits above 70% - 8% increase per percentage point
    priceMultiplier = 1 + ((userSplit - baseSplit) * 0.08);
  } else if (userSplit < baseSplit) {
    // Discount for splits below 70% - 3% decrease per percentage point (less aggressive than increases)
    priceMultiplier = 1 - ((baseSplit - userSplit) * 0.03);
  } else {
    // Base price at 70%
    priceMultiplier = 1;
  }

  const adjustedPrice = Math.round(currentChallenge.price * priceMultiplier);
  
  // Calculate lightness based on split (50% = lighter, 90% = darker)
  // Progress: 0 at 50%, 1 at 90%
  const splitColorProgress = (userSplit - 50) / 40;
  
  // Get theme-based color with lightness adjustment
  const getThemeBarColor = () => {
    // Lightness: 70% at 50 split, 45% at 90 split (darker as split increases)
    const lightness = 70 - (splitColorProgress * 25);
    
    if (currentChallenge.badge === 'BEGINNER') {
      // Blue theme
      return `hsl(217, 91%, ${lightness}%)`;
    } else if (currentChallenge.badge === 'POPULAR') {
      // Green theme
      return `hsl(142, 71%, ${lightness}%)`;
    } else {
      // Purple theme
      return `hsl(270, 70%, ${lightness}%)`;
    }
  };
  const splitBarColor = getThemeBarColor();

  // Theme colors based on challenge badge
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
    <div 
      className="challenge-popup-container fixed inset-0 bg-black/90 backdrop-blur-md flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto"
    >
      <div 
        className="popup-content relative bg-black rounded-3xl max-w-md w-full my-auto"
        style={{ 
          '--theme-border-color': theme.borderColor,
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {/* Close Button - Always visible */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Back Button - Visible on selection, checkout, and auth steps */}
        {(step === 'selection' || step === 'checkout' || step === 'auth') && (
          <button
            onClick={step === 'checkout' || step === 'auth' ? handleBack : () => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
              }
            }}
            className="absolute top-4 left-4 z-20 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {step === 'auth' ? (
          <div className="p-6 pt-12">
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h3>
              <p className="text-gray-400 text-sm">
                {isSignUp ? 'Create an account to start your challenge' : 'Sign in to continue to checkout'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{authError}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none transition-all auth-input"
                    style={{ 
                      '--focus-color': theme.borderColor
                    }}
                    placeholder="Enter your email"
                    required
                  />
                  {authEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail) && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-20 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none transition-all auth-input"
                    style={{ 
                      '--focus-color': theme.borderColor
                    }}
                    placeholder="Enter your password"
                    minLength="6"
                    required
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                    {authPassword.length >= 6 && (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none transition-all auth-input"
                      style={{ 
                        '--focus-color': theme.borderColor
                      }}
                      placeholder="Confirm your password"
                      minLength="6"
                      required
                    />
                    {confirmPassword.length >= 6 && confirmPassword === authPassword && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </div>
                ) : (
                  isSignUp ? 'Create Account & Continue' : 'Sign In & Continue'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError('');
                  setAuthPassword('');
                  setConfirmPassword('');
                }}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Selected:</span>
                <span className={`${theme.text} font-medium`}>{currentChallenge.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">Your Split:</span>
                <span className="text-green-400 font-medium">{userSplit}%</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">Price:</span>
                <span className="text-white font-bold">${adjustedPrice}</span>
              </div>
            </div>
          </div>
        ) : step === 'selection' ? (
          <>
            {/* Challenge Selection */}
            <div className="p-6 pt-8 relative">
              {/* Floating Price Badge - Top Right */}
              <div 
                className="absolute top-20 right-4 z-10"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div 
                  className="px-4 py-2 rounded-xl shadow-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.borderColor}, ${theme.borderColor}dd)`,
                    boxShadow: `0 4px 15px ${theme.borderColor}40`
                  }}
                >
                  <div className="text-white font-bold text-lg">${adjustedPrice}</div>
                  {adjustedPrice !== currentChallenge.price && (
                    <div className="text-xs text-white/80 text-center">
                      {adjustedPrice > currentChallenge.price ? `+$${adjustedPrice - currentChallenge.price}` : `-$${currentChallenge.price - adjustedPrice}`}
                    </div>
                  )}
                </div>
              </div>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="mb-4">
                  <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
                </div>
              </div>

              {/* Badge */}
              <div className="text-center mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  currentChallenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  currentChallenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                }`}>
                  {currentChallenge.badge}
                </span>
              </div>

              {/* Title and Description */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{currentChallenge.name}</h3>
                <p className="text-gray-400 text-sm">{currentChallenge.description}</p>
              </div>

              {/* Challenge Details */}
              <div className="space-y-3 mb-6" style={{ WebkitTapHighlightColor: 'transparent' }}>
                {/* Starting Balance with Dropdown */}
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

                  {/* Dropdown */}
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-20" style={{ WebkitTapHighlightColor: 'transparent' }}>
                      {challenges.map((challenge, index) => (
                        <div
                          key={challenge.id}
                          onClick={() => handleChallengeSelect(index)}
                          className={`flex justify-between items-center py-3 px-4 cursor-pointer hover:bg-slate-700/50 transition-all duration-200 ${
                            index === currentIndex ? `${theme.bg} border-l-4` : ''
                          } ${index === 0 ? 'rounded-t-xl' : ''} ${index === challenges.length - 1 ? 'rounded-b-xl' : ''}`}
                          style={{ 
                            WebkitTapHighlightColor: 'transparent',
                            borderLeftColor: index === currentIndex ? theme.borderColor : 'transparent'
                          }}
                        >
                          <div>
                            <span className="text-white font-medium text-sm">{challenge.name}</span>
                            <div className="text-xs text-gray-400">{challenge.badge} • ${challenge.price}</div>
                          </div>
                          <span className={`${theme.text} font-bold`}>${challenge.startingBalance.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Challenge Rules */}
                <div 
                  className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-4" 
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setShowRules(!showRules)}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <h4 className="text-white font-semibold text-sm">Challenge Rules</h4>
                    <div className="flex items-center space-x-2">
                      <svg 
                        className={`w-5 h-5 transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke={theme.borderColor}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
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
                        <span className={`font-medium`} style={{ color: theme.borderColor }}>{userSplit}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Same Game Parlays</span>
                        <span className="text-green-400 font-medium">YES</span>
                      </div>
                      {/* Learn More button - at the end of rules */}
                      <div className="flex justify-center mt-3 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTargetExplainer(true);
                          }}
                          className="px-4 py-1.5 hover:opacity-80 rounded-full flex items-center justify-center transition-colors border text-xs font-medium"
                          style={{ 
                            WebkitTapHighlightColor: 'transparent',
                            backgroundColor: `${theme.borderColor}20`,
                            borderColor: theme.borderColor,
                            color: theme.borderColor
                          }}
                        >
                          Learn More
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modern Split Slider - Hidden when rules are expanded */}
              {!showRules && (
                <div className="mb-6" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  {/* Header with labels */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm text-gray-400">Your Profit Split</div>
                    <button
                      onClick={() => setUserSplit(70)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Value Display */}
                  <div className="flex justify-center mb-4">
                    <div 
                      className="px-6 py-2 rounded-full font-bold text-2xl text-white"
                      style={{ backgroundColor: splitBarColor }}
                    >
                      {userSplit}%
                    </div>
                  </div>

                  {/* Modern Slider Track */}
                  <div className="relative px-2">
                    {/* Track Background */}
                    <div 
                      className="h-2 rounded-full bg-slate-700 relative cursor-pointer"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const percentage = (clickX / rect.width) * 40 + 50;
                        setUserSplit(Math.round(Math.max(50, Math.min(90, percentage))));
                        
                        const handleMouseMove = (e) => {
                          const moveX = e.clientX - rect.left;
                          const newPercentage = (moveX / rect.width) * 40 + 50;
                          setUserSplit(Math.round(Math.max(50, Math.min(90, newPercentage))));
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
                        const touchX = e.touches[0].clientX - rect.left;
                        const percentage = (touchX / rect.width) * 40 + 50;
                        setUserSplit(Math.round(Math.max(50, Math.min(90, percentage))));
                        
                        const handleTouchMove = (e) => {
                          const moveX = e.touches[0].clientX - rect.left;
                          const newPercentage = (moveX / rect.width) * 40 + 50;
                          setUserSplit(Math.round(Math.max(50, Math.min(90, newPercentage))));
                        };

                        const handleTouchEnd = () => {
                          document.removeEventListener('touchmove', handleTouchMove);
                          document.removeEventListener('touchend', handleTouchEnd);
                        };

                        document.addEventListener('touchmove', handleTouchMove);
                        document.addEventListener('touchend', handleTouchEnd);
                      }}
                    >
                      {/* Filled Track */}
                      <div 
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-100"
                        style={{ 
                          width: `${((userSplit - 50) / 40) * 100}%`,
                          backgroundColor: splitBarColor
                        }}
                      />
                      {/* Thumb */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-100"
                        style={{ 
                          left: `calc(${((userSplit - 50) / 40) * 100}% - 12px)`,
                          boxShadow: `0 0 12px ${splitBarColor}`
                        }}
                      />
                    </div>

                    {/* Min/Max Labels */}
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>50%</span>
                      <span>90%</span>
                    </div>
                  </div>

                  {/* Split Explanation */}
                  <div className="text-center mt-3 text-xs text-gray-500">
                    You keep <span className="text-white font-medium">{userSplit}%</span> of profits • We keep <span className="text-white font-medium">{100 - userSplit}%</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleNext}
                disabled={loading}
                className={`w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl shadow-2xl mb-4 transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:cursor-not-allowed`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading Checkout...</span>
                  </div>
                ) : (
                  'Continue'
                )}
              </button>
              
              {checkoutError && (
                <div className="text-red-400 text-sm text-center mb-4">
                  {checkoutError}
                </div>
              )}

              {/* Challenge indicator */}
              <div className="flex justify-center space-x-2" style={{ WebkitTapHighlightColor: 'transparent' }}>
                {challenges.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? theme.text : 'bg-gray-600'
                    }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : step === 'checkout' ? (
          /* Fanbasis Checkout - Redirect to New Tab */
          <div className="p-6 pt-12" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Complete Your Purchase</h2>
              <p className={`${theme.text} text-sm font-medium mb-1`}>
                {currentChallenge.name} • ${adjustedPrice}
              </p>
              <p className="text-green-400 text-xs font-medium">
                {userSplit}% profit split
              </p>
            </div>
            
            {checkoutUrl ? (
              <div className="space-y-4">
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} text-white font-bold py-4 px-6 rounded-xl text-center text-lg shadow-lg transition-all duration-300`}
                >
                  Continue to Checkout →
                </a>
                <p className="text-gray-500 text-xs text-center">
                  Opens secure payment page in a new tab
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin`} style={{ borderColor: theme.borderColor, borderTopColor: 'transparent' }}></div>
              </div>
            )}
            
            <button
              onClick={() => {
                setStep('selection');
                setCheckoutUrl(null);
              }}
              className={`w-full mt-6 py-3 px-6 bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 font-medium rounded-xl border ${theme.borderLight}`}
            >
              Back
            </button>
          </div>
        ) : (
          /* Receipt Step */
          <div className="p-6 pt-12">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-8 mx-auto" />
              </div>
              <div className={`w-16 h-16 bg-gradient-to-r ${theme.gradient} rounded-full flex items-center justify-center mb-4 mx-auto`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Payment Successful!</h2>
              <p className="text-gray-400 text-sm">Your challenge is ready to begin</p>
            </div>

            {/* License Key */}
            <div className={`bg-gradient-to-r ${theme.splitGradient} rounded-xl border ${theme.splitBorder} p-4 mb-6`}>
              <div className="text-center">
                <div className="text-gray-300 text-xs font-medium mb-1">License Key</div>
                <div className={`${theme.text} font-mono font-bold text-lg tracking-wider`}>{licenseKey}</div>
                <div className="text-gray-400 text-xs mt-1">Keep this safe - you'll need it to access your challenge</div>
              </div>
            </div>

            {/* Challenge Details */}
            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <h3 className="text-white font-bold text-lg mb-3">{currentChallenge.name}</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Starting Balance</span>
                    <span className={`${theme.text} font-bold`}>${currentChallenge.startingBalance.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Target Balance (Phase 1)</span>
                    <span className={`${theme.text} font-bold`}>${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Target Balance (Phase 2)</span>
                    <span className={`${theme.text} font-bold`}>${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-600 pt-2 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Minimum Balance (Phase 1)</span>
                      <span className="text-red-400 font-bold">${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Minimum Balance (Phase 2)</span>
                      <span className="text-red-400 font-bold">${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-2 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Max Bet Size</span>
                      <span className="text-white font-bold">${currentChallenge.maxBet}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Profit Split</span>
                      <span className={`${theme.text} font-bold`}>{userSplit}% / {100 - userSplit}%</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Challenge Fee</span>
                      <span className="text-white font-bold">${adjustedPrice}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-3 mb-6">
              <div className="text-white font-medium text-sm mb-3">Please accept the following terms:</div>
              
              {/* Gambling Risk Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="gambling-terms"
                  checked={termsAccepted.gambling}
                  onChange={(e) => setTermsAccepted(prev => ({ ...prev, gambling: e.target.checked }))}
                  className="mt-1 w-4 h-4 bg-slate-800 border-slate-600 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="gambling-terms" className="text-gray-300 text-sm cursor-pointer">
                    I understand the gambling risks and responsibilities
                  </label>
                  <button
                    onClick={() => setShowGamblingTerms(true)}
                    className={`${theme.text} hover:opacity-80 text-xs ml-2 underline`}
                  >
                    (Read Full Terms)
                  </button>
                </div>
              </div>

              {/* Prop Firm Terms */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="propfirm-terms"
                  checked={termsAccepted.propFirm}
                  onChange={(e) => setTermsAccepted(prev => ({ ...prev, propFirm: e.target.checked }))}
                  className="mt-1 w-4 h-4 bg-slate-800 border-slate-600 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="propfirm-terms" className="text-gray-300 text-sm cursor-pointer">
                    I understand this is a proprietary trading firm simulation
                  </label>
                  <button
                    onClick={() => setShowPropFirmTerms(true)}
                    className={`${theme.text} hover:opacity-80 text-xs ml-2 underline`}
                  >
                    (Read Full Terms)
                  </button>
                </div>
              </div>
            </div>

            {/* Begin Challenge Button */}
            <button
              onClick={handleBeginChallenge}
              disabled={!termsAccepted.gambling || !termsAccepted.propFirm}
              className={`w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:transform-none disabled:cursor-not-allowed`}
            >
              {(!termsAccepted.gambling || !termsAccepted.propFirm) ? 
                'Please Accept Terms to Continue' : 
                'Begin Challenge'
              }
            </button>
          </div>
        )}
      </div>

      {/* Account Info Modal */}
      {showAccountInfo && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border-2 border-gray-800 rounded-2xl max-w-md w-full p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => setShowAccountInfo(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-900/70 hover:bg-gray-800 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-20 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">How Do I Get My Account?</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300">
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">New Users</h4>
                    <p className="text-sm">Your account details will be sent to the email on file immediately after payment completion.</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Existing Users</h4>
                    <p className="text-sm">If you already have an account, your new challenge will be automatically added to your existing account.</p>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">
                  Check your spam folder if you don't see the email within 5 minutes.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowAccountInfo(false)}
              className="w-full mt-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Gambling Terms Modal */}
      {showGamblingTerms && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowGamblingTerms(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Gambling Risk Disclosure</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300 text-sm">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-red-400 mb-2">⚠️ Important Warning</h4>
                <p>Gambling can be addictive and should be done responsibly. Never bet more than you can afford to lose.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">No Profit Guarantee</h4>
                <p>There is absolutely no guarantee that you will make money from this challenge. Sports betting involves significant risk and most participants lose money.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Personal Responsibility</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You are solely responsible for your betting decisions</li>
                  <li>You acknowledge the risks involved in sports betting</li>
                  <li>You agree to gamble responsibly and within your means</li>
                  <li>You understand that past performance does not guarantee future results</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Limitation of Liability</h4>
                <p>Funder is not responsible for any financial losses you may incur. This is a skill-based challenge with inherent risks.</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3">
                <p className="text-xs text-gray-400">
                  If you or someone you know has a gambling problem, please seek help:
                  <br />• National Problem Gambling Helpline: 1-800-522-4700
                  <br />• Visit ncpgambling.org for resources
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowGamblingTerms(false)}
              className="w-full mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              I Understand the Risks
            </button>
          </div>
        </div>
      )}

      {/* Prop Firm Terms Modal */}
      {showPropFirmTerms && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowPropFirmTerms(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Proprietary Firm Terms</h3>
            </div>

            {/* Content */}
            <div className="space-y-4 text-gray-300 text-sm">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">📋 Challenge Structure</h4>
                <p>This is a proprietary trading firm evaluation process designed to assess your sports betting skills.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Challenge Rules</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>You must complete 2 phases to receive funding</li>
                  <li>Strict adherence to maximum bet sizes is required</li>
                  <li>Daily and overall drawdown limits must be respected</li>
                  <li>All betting activity is monitored and evaluated</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Evaluation Criteria</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Consistent profit generation within risk parameters</li>
                  <li>Proper risk management and position sizing</li>
                  <li>Adherence to all challenge rules and guidelines</li>
                  <li>Professional trading behavior and discipline</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Firm Discretion</h4>
                <p>Funder reserves the right to evaluate, modify, or terminate challenges based on our internal risk management policies. All decisions are final.</p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">No Guaranteed Outcomes</h4>
                <p>Completion of challenge phases does not guarantee funding. All evaluations are subject to final approval by our risk management team.</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowPropFirmTerms(false)}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              I Understand the Terms
            </button>
          </div>
        </div>
      )}

      {/* Target Explainer Modal */}
      {showTargetExplainer && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="bg-black rounded-2xl max-w-md w-full p-6 pt-8"
            style={{ border: 'none' }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowTargetExplainer(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/70 hover:bg-slate-700 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <img src="/funderlogo/Piks.png" alt="Piks Logo" className="h-16 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Challenge Phases</h3>
              <p className="text-gray-400 text-sm">You must complete 2 phases to get funded</p>
            </div>

            {/* Phase 1 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Phase 1 - Evaluation</h4>
                <span className={`text-xs ${theme.bg} ${theme.text} px-2 py-1 rounded-full border ${theme.splitBorder}`}>CURRENT</span>
              </div>
              
              {/* Phase 1 Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Minimum: ${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                  <span>Target: ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 relative overflow-hidden">
                  {/* Danger Zone (Red) */}
                  <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500 w-[15%]"></div>
                  {/* Safe Zone (Gray) */}
                  <div className="absolute left-[15%] top-0 h-full bg-slate-600 w-[65%]"></div>
                  {/* Target Zone (Themed) */}
                  <div className={`absolute right-0 top-0 h-full bg-gradient-to-r ${theme.splitBar} w-[20%]`}></div>
                  {/* Current Position Indicator */}
                  <div className="absolute left-[15%] top-0 h-full w-1 bg-white shadow-lg"></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-400">Fail Zone</span>
                  <span className="text-gray-400">Starting: ${currentChallenge.startingBalance.toLocaleString()}</span>
                  <span className={theme.text}>Pass Zone</span>
                </div>
              </div>

              <div className="text-sm text-gray-300 space-y-1">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${theme.text.replace('text-', 'bg-')} rounded-full`}></div>
                  <span>Reach ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()} to advance</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Don't fall below ${(currentChallenge.startingBalance * 0.85).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Phase 2 - Verification</h4>
                <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full border border-gray-500/30">LOCKED</span>
              </div>
              
              {/* Phase 2 Progress Bar */}
              <div className="mb-3 opacity-50">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Minimum: ${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                  <span>Target: ${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 relative overflow-hidden">
                  {/* Danger Zone (Red) */}
                  <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500 w-[15%]"></div>
                  {/* Safe Zone (Gray) */}
                  <div className="absolute left-[15%] top-0 h-full bg-slate-600 w-[65%]"></div>
                  {/* Target Zone (Themed) */}
                  <div className={`absolute right-0 top-0 h-full bg-gradient-to-r ${theme.splitBar} w-[20%]`}></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-red-400">Fail Zone</span>
                  <span className="text-gray-400">Starting: ${(currentChallenge.startingBalance + currentChallenge.target).toLocaleString()}</span>
                  <span className={theme.text}>Pass Zone</span>
                </div>
              </div>

              <div className="text-sm text-gray-300 space-y-1 opacity-50">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${theme.text.replace('text-', 'bg-')} rounded-full`}></div>
                  <span>Reach ${(currentChallenge.startingBalance + currentChallenge.target * 2).toLocaleString()} to get funded</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Don't fall below ${(currentChallenge.startingBalance + currentChallenge.target * 0.85).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowTargetExplainer(false)}
              className={`w-full bg-gradient-to-r ${theme.gradient} ${theme.gradientHover} text-white font-bold py-3 px-6 rounded-xl transition-all duration-300`}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Create border using pseudo-element - immune to tap highlights */
        .popup-content::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 2px solid var(--theme-border-color);
          border-radius: 1.5rem;
          pointer-events: none;
          z-index: 9999;
        }
        
        /* Disable tap highlight on the popup and all its contents */
        .popup-content,
        .popup-content *,
        .challenge-popup-container,
        .challenge-popup-container * {
          -webkit-tap-highlight-color: transparent !important;
          -webkit-touch-callout: none !important;
        }
        
        /* Prevent user select on non-input elements */
        .popup-content {
          -webkit-user-select: none;
          user-select: none;
        }
        
        .popup-content input,
        .popup-content textarea {
          -webkit-user-select: text;
          user-select: text;
        }
        
        /* Remove outlines on focus but preserve borders */
        .popup-content *:focus,
        .popup-content:focus {
          outline: none !important;
        }
        
        /* Hide scrollbar */
        .challenge-popup-container::-webkit-scrollbar {
          display: none;
        }
        
        .challenge-popup-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #3b82f6);
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #3b82f6);
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }

        .slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }
      `}</style>
    </div>
  );
}