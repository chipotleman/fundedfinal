import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [step, setStep] = useState('auth');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const router = useRouter();
  const { login, signUp: signUpUser } = useAuth();
  const { data: session } = useSession();

  // Password strength check
  const isPasswordStrong = password.length >= 6;
  const passwordsMatch = isSignUp && confirmPassword.length > 0 && password === confirmPassword;

  // Load saved email from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // Scroll to top when component mounts
  useEffect(() => {
    // Scroll immediately
    window.scrollTo(0, 0);
    // And also after a short delay to ensure it sticks
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Decide whether to show the challenge-start step. We intentionally do NOT
  // trust localStorage.purchased_challenge as authoritative — a stale or
  // forged entry would otherwise drop the user on the start screen, where
  // /api/challenges/start will just 404. Instead, once the user is signed
  // in we verify with the server that they actually have an active/pending
  // purchased challenge before flipping to the challenge step.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const purchasedChallenge = localStorage.getItem('purchased_challenge');
    if (!purchasedChallenge) return;

    // Wait until we know who the user is. If they're not signed in yet,
    // leave them on the auth form so they can sign in/up first.
    if (!session?.user) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/challenges/active');
        if (cancelled) return;

        // Only treat a clean 200 response as authoritative. Transient
        // failures (5xx, network errors) shouldn't strand the user on
        // /packages — leave them on the auth form so they can retry.
        if (!response.ok) {
          console.error(
            'Failed to verify purchased challenge: status',
            response.status,
          );
          return;
        }

        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!data || data.challenge === undefined) {
          console.error(
            'Failed to verify purchased challenge: malformed response',
          );
          return;
        }

        const activeChallenge = data.challenge;

        if (!activeChallenge) {
          // Server explicitly says there is no active/pending challenge —
          // clear the stale localStorage breadcrumb and send the user
          // somewhere they can actually buy one instead of a misleading
          // start screen.
          localStorage.removeItem('purchased_challenge');
          if (cancelled) return;
          router.replace('/packages');
          return;
        }

        const startingBalance = Number(activeChallenge.startingBalance);
        const profitTarget =
          activeChallenge.profitTarget !== null &&
          activeChallenge.profitTarget !== undefined
            ? Number(activeChallenge.profitTarget)
            : null;

        // Match the server's challenge to one of the visible tiers so the
        // matching card is highlighted. We match on challengeType (e.g.
        // "starter"/"pro"/"elite") and fall back to challenge name.
        const tierKey =
          typeof activeChallenge.challengeType === 'string'
            ? activeChallenge.challengeType.toLowerCase()
            : '';
        const matchedTier = challenges.find((tier) => {
          const tierName = tier.name.toLowerCase();
          return (
            (tierKey && tierName.startsWith(tierKey)) ||
            (typeof activeChallenge.challengeName === 'string' &&
              tierName === activeChallenge.challengeName.toLowerCase())
          );
        });

        setSelectedChallenge({
          ...(matchedTier ?? {}),
          id: matchedTier?.id ?? activeChallenge.id,
          purchasedId: activeChallenge.id,
          name: matchedTier?.name ?? activeChallenge.challengeName,
          startingBalance: Number.isFinite(startingBalance)
            ? startingBalance
            : matchedTier?.startingBalance ?? null,
          target: Number.isFinite(profitTarget)
            ? profitTarget
            : matchedTier?.target ?? null,
        });
        setStep('challenge');
      } catch (error) {
        if (cancelled) return;
        console.error('Error verifying purchased challenge:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  const challenges = [
    {
      id: 1,
      name: "Starter Challenge",
      description: "Perfect for beginners",
      startingBalance: 5000,
      target: 1000,
      maxBet: 250,
      payout: 800,
      price: 149,
      badge: "BEGINNER",
      popular: false
    },
    {
      id: 2,
      name: "Pro Challenge",
      description: "For experienced bettors",
      startingBalance: 10000,
      target: 2000,
      maxBet: 500,
      payout: 1600,
      price: 249,
      badge: "POPULAR",
      popular: true
    },
    {
      id: 3,
      name: "Elite Challenge",
      description: "Maximum stakes for pros",
      startingBalance: 25000,
      target: 5000,
      maxBet: 1250,
      payout: 4000,
      price: 399,
      badge: "ADVANCED",
      popular: false
    }
  ];


  const handleAuth = async (e) => {
    e.preventDefault();

    // Validation
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // Sign up with our API
        await signUpUser(email.trim(), password);
        
        // Success - account created and logged in
        setError('✅ Account created successfully!');
        
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('remembered_email', email.trim());
        }
        
        // Check if returning to checkout flow
        const returnTo = router.query.returnTo;
        setTimeout(() => {
          if (returnTo === 'checkout') {
            router.push('/checkout-redirect');
          } else {
            router.push('/');
          }
        }, 1000);
      } else {
        // Sign in
        await login(email.trim(), password, rememberMe);
        
        // Check if returning to checkout flow
        const returnTo = router.query.returnTo;
        if (returnTo === 'checkout') {
          router.push('/checkout-redirect');
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);

      // Handle network and configuration errors
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('Invalid email or password')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message?.includes('Email already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (error.message?.includes('Unable to validate email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(error.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      setForgotError('Please enter your email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setForgotError(data.error || 'Too many requests. Please try again later.');
      } else if (!response.ok) {
        setForgotError(data.error || 'Something went wrong. Please try again.');
      } else {
        setForgotMessage(
          data.message ||
            'If an account exists for that email, we have sent a password reset link.'
        );
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(email.trim());
    setForgotError('');
    setForgotMessage('');
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(false);
  };

  const handleChallengeStart = async () => {
    if (!selectedChallenge) {
      alert('Please select a challenge');
      return;
    }

    setLoading(true);

    try {
      // Get current user from session
      if (!session?.user?.id) {
        setError('You must be logged in to start a challenge.');
        setLoading(false);
        return;
      }

      // Server-side initialization. The endpoint reads the user's purchased
      // challenge row from the database and writes the financial fields
      // itself — the client is intentionally not trusted to set bankroll,
      // pnl, betsHistory, etc. We only forward the purchased-challenge id
      // (when known) so the server can pick the right row.
      const purchasedId =
        selectedChallenge && typeof selectedChallenge.purchasedId === 'string'
          ? selectedChallenge.purchasedId
          : null;

      const updateResponse = await fetch('/api/challenges/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchasedId ? { challengeId: purchasedId } : {}),
      });

      if (!updateResponse.ok) {
        const data = await updateResponse.json().catch(() => ({}));
        throw new Error(data?.message || 'Failed to start challenge');
      }

      // Clear the purchased challenge from localStorage after successful save
      localStorage.removeItem('purchased_challenge');

      router.push('/');
    } catch (error) {
      console.log('Challenge start error:', error.message);
      setError('Failed to start challenge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'challenge') {
    return (
      <div className="min-h-screen bg-black">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
        }}></div>

        {/* Header with Logo */}
        <div className="relative z-10 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <Link href="/" className="flex items-center justify-center">
              <h1 className="text-5xl sm:text-6xl font-bold text-white lowercase tracking-tight">
                sign in
              </h1>
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center min-h-[calc(100vh-120px)] p-6">
          <div className="max-w-7xl w-full">
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">
                Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Challenge</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 font-medium">Select the tier that matches your skill level and start earning</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`relative group cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                    selectedChallenge?.id === challenge.id ? 'scale-105' : ''
                  }`}
                  onClick={() => setSelectedChallenge(challenge)}
                >
                  <div className={`relative bg-[#111] backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 transition-all duration-300 ${
                    challenge.popular
                      ? 'border-blue-400 shadow-2xl shadow-blue-400/20'
                      : selectedChallenge?.id === challenge.id
                      ? 'border-blue-400 shadow-2xl shadow-blue-400/20'
                      : 'border-[#1a1a1a] hover:border-[#1a1a1a] group-hover:shadow-xl'
                  }`}>

                    {challenge.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="absolute top-6 right-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        challenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        challenge.badge === 'POPULAR' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {challenge.badge}
                      </span>
                    </div>

                    <div className="text-center pt-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{challenge.name}</h3>
                      <p className="text-gray-400 mb-6 sm:mb-8 text-base sm:text-lg">{challenge.description}</p>

                      <div className="space-y-4 mb-6 sm:mb-8">
                        <div className="flex justify-between items-center py-3 px-4 bg-[#1a1a1a] rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Starting Balance</span>
                          <span className="text-green-400 font-bold text-base sm:text-lg">${challenge.startingBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-[#1a1a1a] rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Profit Target</span>
                          <span className="text-blue-400 font-bold text-base sm:text-lg">${challenge.target.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-[#1a1a1a] rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Max Bet Size</span>
                          <span className="text-white font-bold text-base sm:text-lg">${challenge.maxBet}</span>
                        </div>
                      </div>

                      <div className="text-center p-4 sm:p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20">
                        <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                          ${challenge.payout.toLocaleString()}
                        </div>
                        <div className="text-gray-300 text-sm font-medium mt-1">Payout on Success</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={handleChallengeStart}
                disabled={loading || !selectedChallenge}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-8 sm:px-12 rounded-xl sm:rounded-2xl transition-all duration-300 text-lg sm:text-xl shadow-2xl transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Starting Challenge...</span>
                  </div>
                ) : (
                  'Start Challenge'
                )}
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes logoRedYellowGlow {
            0% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
            50% { filter: hue-rotate(30deg) saturate(1.3) brightness(1.2); }
            100% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <TopNavbar 
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Main Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 pt-8">
        <div className="relative max-w-md w-full">
          <div className="bg-black rounded-3xl p-6 sm:p-8 border-2 border-blue-500">
            {/* Logo */}
            <div className="text-center mb-6">
              <img src="/pikslogotransparent.png" alt="Piks Logo" className="h-28 mx-auto mb-4" />
            </div>

            {/* Toggle Tabs */}
            <div className="flex bg-[#111] rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  !isSignUp ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  isSignUp ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div className={`mb-6 p-4 rounded-xl border ${
                error.includes('✅') || error.includes('successfully') || error.includes('created')
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter your password"
                    minLength="6"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
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
                {isSignUp && password.length > 0 && !isPasswordStrong && (
                  <p className="text-xs mt-2 text-gray-400">
                    Minimum 6 characters required
                  </p>
                )}
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                    placeholder="Confirm your password"
                    minLength="6"
                    required
                  />
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs mt-2 ${passwordsMatch ? 'text-green-400' : 'text-gray-400'}`}>
                      {passwordsMatch ? '✓ Passwords match' : 'Passwords must match'}
                    </p>
                  )}
                </div>
              )}

              {/* Remember Me + Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 bg-[#1a1a1a] border border-[#1a1a1a] rounded focus:ring-2 focus:ring-blue-500 text-blue-500"
                  />
                  <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-400 cursor-pointer">
                    Remember my email
                  </label>
                </div>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </div>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#1a1a1a] text-center">
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-400 font-medium transition-colors text-sm"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeForgotPassword}
        >
          <div
            className="relative w-full max-w-md bg-black border-2 border-blue-500 rounded-3xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeForgotPassword}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
            <p className="text-sm text-gray-400 mb-6">
              Enter your account email and we'll send you a link to choose a new password.
            </p>

            {forgotMessage && (
              <div className="mb-4 p-4 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400">
                <p className="text-sm font-medium">{forgotMessage}</p>
              </div>
            )}
            {forgotError && (
              <div className="mb-4 p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400">
                <p className="text-sm font-medium">{forgotError}</p>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading || !!forgotMessage}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3.5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 shadow-lg"
              >
                {forgotLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : forgotMessage ? (
                  'Email sent'
                ) : (
                  'Send reset link'
                )}
              </button>

              <button
                type="button"
                onClick={closeForgotPassword}
                className="w-full text-sm text-gray-500 hover:text-gray-300 font-medium transition-colors"
              >
                Back to sign in
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes logoRedYellowGlow {
          0% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
          50% { filter: hue-rotate(30deg) saturate(1.3) brightness(1.2); }
          100% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
        }
      `}</style>
    </div>
  );
}