import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
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
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const router = useRouter();
  const { login, signUp } = useAuth();

  // Password strength check
  const isPasswordStrong = password.length >= 6;
  const passwordsMatch = isSignUp && confirmPassword.length > 0 && password === confirmPassword;

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

  // Load purchased challenge from localStorage if it exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const purchasedChallenge = localStorage.getItem('purchased_challenge');
      if (purchasedChallenge) {
        try {
          const challengeData = JSON.parse(purchasedChallenge);
          setSelectedChallenge(challengeData);
          // If user already authenticated, go straight to challenge start
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              setStep('challenge');
            }
          });
        } catch (error) {
          console.error('Error loading purchased challenge:', error);
          localStorage.removeItem('purchased_challenge');
        }
      }
    }
  }, []);

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

  const handleOAuth = async (provider) => {
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setError(`Failed to sign in with ${provider}. Please try again.`);
      setLoading(false);
    }
  };

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
        // Sign up with Supabase using email
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          if (data.user.email_confirmed_at) {
            // User is auto-confirmed, redirect to dashboard
            router.push('/dashboard');
          } else {
            // User needs email confirmation
            setError('✅ Account created successfully! Please check your email for a verification link.');
            setStep('auth');
            setIsSignUp(false);
            // Clear form
            setEmail('');
            setPassword('');
            setConfirmPassword('');
          }
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          router.push('/dashboard');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);

      // Handle network and configuration errors
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('Invalid API key') || error.message?.includes('Invalid URL')) {
        setError('Configuration error. Please contact support.');
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message?.includes('Email not confirmed')) {
        setError('Please check your email and verify your account before signing in.');
      } else if (error.message?.includes('User already registered')) {
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


  const handleChallengeStart = async () => {
    if (!selectedChallenge) {
      alert('Please select a challenge');
      return;
    }

    setLoading(true);

    try {
      // Get current user from Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setError('You must be logged in to start a challenge.');
        setLoading(false);
        return;
      }

      // Fetch current user profile data from Supabase
      const { data: currentUser, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;
      if (!currentUser) throw new Error('User profile not found.');

      // Use selected package data or fallback to default challenge
      const challengeData = {
        id: selectedChallenge.id,
        name: selectedChallenge.name,
        startingBalance: selectedChallenge.startingBalance,
        target: selectedChallenge.target,
        maxBet: selectedChallenge.maxBet,
        payout: selectedChallenge.payout,
        price: selectedChallenge.adjustedPrice || selectedChallenge.price,
        userSplit: selectedChallenge.userSplit || 80,
        licenseKey: selectedChallenge.licenseKey,
        purchaseDate: selectedChallenge.purchaseDate
      };

      // Update user profile with challenge info
      const updatedUserProfile = {
        ...currentUser,
        challenge: challengeData,
        bankroll: challengeData.startingBalance,
        challengeStartDate: new Date().toISOString(),
        status: 'active',
        pnl: 0,
        totalBets: 0,
        winRate: 0,
        betsHistory: [],
        challengePhase: 1,
        dailyLoss: 0,
        maxDailyLoss: challengeData.startingBalance * 0.08,
        profitTarget: challengeData.target,
        lastBetDate: null,
        bettingDays: 0,
        achievements: [],
        profileStats: {
          totalWins: 0,
          totalLosses: 0,
          biggestWin: 0,
          biggestLoss: 0,
          averageBetSize: 0,
          longestWinStreak: 0,
          currentWinStreak: 0
        }
      };

      // Update user profile in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatedUserProfile)
        .eq('id', userId);

      if (updateError) throw updateError;

      // Clear the purchased challenge from localStorage after successful save
      localStorage.removeItem('purchased_challenge');

      router.push('/dashboard');
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
                Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Challenge</span>
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
                  <div className={`relative bg-slate-800/50 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 transition-all duration-300 ${
                    challenge.popular
                      ? 'border-green-400 shadow-2xl shadow-green-400/20'
                      : selectedChallenge?.id === challenge.id
                      ? 'border-blue-400 shadow-2xl shadow-blue-400/20'
                      : 'border-slate-700 hover:border-slate-600 group-hover:shadow-xl'
                  }`}>

                    {challenge.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-green-400 to-green-500 text-black px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="absolute top-6 right-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        challenge.badge === 'BEGINNER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        challenge.badge === 'POPULAR' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {challenge.badge}
                      </span>
                    </div>

                    <div className="text-center pt-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{challenge.name}</h3>
                      <p className="text-gray-400 mb-6 sm:mb-8 text-base sm:text-lg">{challenge.description}</p>

                      <div className="space-y-4 mb-6 sm:mb-8">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Starting Balance</span>
                          <span className="text-green-400 font-bold text-base sm:text-lg">${challenge.startingBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Profit Target</span>
                          <span className="text-blue-400 font-bold text-base sm:text-lg">${challenge.target.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium text-sm sm:text-base">Max Bet Size</span>
                          <span className="text-white font-bold text-base sm:text-lg">${challenge.maxBet}</span>
                        </div>
                      </div>

                      <div className="text-center p-4 sm:p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/20">
                        <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
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
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-8 sm:px-12 rounded-xl sm:rounded-2xl transition-all duration-300 text-lg sm:text-xl shadow-2xl transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
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
    <div className="min-h-screen bg-black text-white">
      <TopNavbar 
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      {/* Main Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative max-w-md w-full">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-2xl">
            <div className="text-center mb-8">
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </h2>
                <p className="text-gray-400 font-medium text-sm sm:text-base mb-6">
                  {isSignUp ? 'Join our funded challenge platform' : 'Sign in to your account'}
                </p>
                
                {/* Social Login Buttons */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-gray-300 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth('apple')}
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-3 bg-black hover:bg-gray-900 disabled:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-gray-700 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span>Continue with Apple</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth('facebook')}
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-[#155CB8] text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Continue with Facebook</span>
                  </button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-slate-800/50 text-gray-400">Or continue with email</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className={`mb-6 p-4 rounded-xl border ${
                error.includes('✅') || error.includes('successfully') || error.includes('created')
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 sm:py-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all duration-300 font-medium text-sm sm:text-base"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 sm:py-4 pr-12 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all duration-300 font-medium text-sm sm:text-base"
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
                {password.length > 0 && (
                  <p className={`text-xs mt-2 ${isPasswordStrong ? 'text-green-400' : 'text-gray-400'}`}>
                    {isPasswordStrong ? '✓ Password is strong enough' : 'Minimum 6 characters required'}
                  </p>
                )}
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 sm:py-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all duration-300 font-medium text-sm sm:text-base"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 sm:py-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 text-sm sm:text-base"
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

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-green-400 hover:text-green-300 font-medium transition-colors text-sm sm:text-base"
              >
                {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-gray-400 hover:text-gray-300 font-medium transition-colors text-sm"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bet Slip */}
      {showBetSlip && (
        <BetSlip
          bankroll={10000}
          onClose={() => setShowBetSlip(false)}
        />
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