import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
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
  const [rememberMe, setRememberMe] = useState(false);
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

  // Load purchased challenge from localStorage if it exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const purchasedChallenge = localStorage.getItem('purchased_challenge');
      if (purchasedChallenge) {
        try {
          const challengeData = JSON.parse(purchasedChallenge);
          setSelectedChallenge(challengeData);
          // If user already authenticated, go straight to challenge start
          if (session?.user) {
            setStep('challenge');
          }
        } catch (error) {
          console.error('Error loading purchased challenge:', error);
          localStorage.removeItem('purchased_challenge');
        }
      }
    }
  }, [session]);

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
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        // Sign in
        await login(email.trim(), password, rememberMe);
        router.push('/dashboard');
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

      const userId = session.user.id;

      // Fetch current user profile data from database
      const response = await fetch(`/api/profiles/${userId}`);
      if (!response.ok) throw new Error('User profile not found');
      
      const currentUser = await response.json();

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

      // Update user profile in database
      const updateResponse = await fetch(`/api/profiles/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedUserProfile),
      });

      if (!updateResponse.ok) throw new Error('Failed to update profile');

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
      <div className="min-h-screen bg-base-300" data-theme="business">
        <div className="container mx-auto px-6 py-8">
          <Link href="/" className="btn btn-ghost text-2xl">
            sign in
          </Link>
        </div>

        <div className="container mx-auto px-6 py-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black mb-4">
              Choose Your <span className="text-primary">Challenge</span>
            </h1>
            <p className="text-lg text-base-content/70">Select the tier that matches your skill level and start earning</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`card bg-base-200 shadow-xl cursor-pointer transition-all hover:scale-105 relative ${
                  selectedChallenge?.id === challenge.id ? 'ring-2 ring-primary scale-105' : ''
                }`}
                onClick={() => setSelectedChallenge(challenge)}
              >
                <div className="card-body">
                  {challenge.popular && (
                    <div className="badge badge-success absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="card-title text-2xl">{challenge.name}</h3>
                      <p className="text-base-content/70">{challenge.description}</p>
                    </div>
                    <div className={`badge ${
                      challenge.badge === 'BEGINNER' ? 'badge-info' :
                      challenge.badge === 'POPULAR' ? 'badge-success' :
                      'badge-secondary'
                    }`}>
                      {challenge.badge}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-base-300 rounded-lg">
                      <span className="font-medium">Starting Balance</span>
                      <span className="text-success font-bold">${challenge.startingBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-base-300 rounded-lg">
                      <span className="font-medium">Profit Target</span>
                      <span className="text-info font-bold">${challenge.target.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-base-300 rounded-lg">
                      <span className="font-medium">Max Bet Size</span>
                      <span className="font-bold">${challenge.maxBet}</span>
                    </div>
                  </div>

                  <div className="card bg-gradient-to-r from-success/20 to-info/20 mt-4">
                    <div className="card-body items-center">
                      <div className="text-3xl font-black text-primary">
                        ${challenge.payout.toLocaleString()}
                      </div>
                      <p className="text-sm">Payout on Success</p>
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
              className="btn btn-primary btn-lg"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Starting Challenge...
                </>
              ) : (
                'Start Challenge'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-300" data-theme="business">
      <TopNavbar 
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      {/* Main Auth Form */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-3xl font-bold justify-center mb-2">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
            <p className="text-center text-base-content/70 mb-6">
              {isSignUp ? 'Join our funded challenge platform' : 'Sign in to your account'}
            </p>

            {error && (
              <div className={`alert ${
                error.includes('✅') || error.includes('successfully') || error.includes('created')
                  ? 'alert-success'
                  : 'alert-error'
              } mb-4`}>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input input-bordered w-full pr-12"
                    placeholder="Enter your password"
                    minLength="6"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-ghost btn-sm absolute right-0 top-0 h-full"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {password.length > 0 && (
                  <label className="label">
                    <span className={`label-text-alt ${isPasswordStrong ? 'text-success' : 'text-base-content/60'}`}>
                      {isPasswordStrong ? '✓ Password is strong enough' : 'Minimum 6 characters required'}
                    </span>
                  </label>
                )}
              </div>

              {isSignUp && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Confirm Password</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="Confirm your password"
                    minLength="6"
                    required
                  />
                  {confirmPassword.length > 0 && (
                    <label className="label">
                      <span className={`label-text-alt ${passwordsMatch ? 'text-success' : 'text-base-content/60'}`}>
                        {passwordsMatch ? '✓ Passwords match' : 'Passwords must match'}
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="checkbox checkbox-success checkbox-sm"
                  />
                  <span className="label-text">Remember my email</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>

            <div className="divider"></div>

            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="btn btn-link"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>

            <Link href="/" className="btn btn-ghost btn-sm">
              ← Back to Home
            </Link>
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
    </div>
  );
}