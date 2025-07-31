
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [step, setStep] = useState('auth');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Clear any existing sessions when component mounts
  useEffect(() => {
    const clearSession = async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('demo_user');
        localStorage.removeItem('user_session');
        sessionStorage.clear();
      }
      await supabase.auth.signOut();
    };
    clearSession();
  }, []);

  const challenges = [
    {
      id: 1,
      name: "Starter Challenge",
      startingBalance: 1000,
      target: 2500,
      maxBet: 100,
      payout: 500,
      duration: "30 days",
      description: "Perfect for beginners",
      badge: "BEGINNER"
    },
    {
      id: 2,
      name: "Pro Challenge",
      startingBalance: 5000,
      target: 12500,
      maxBet: 500,
      payout: 2500,
      duration: "45 days",
      description: "For experienced bettors",
      popular: true,
      badge: "POPULAR"
    },
    {
      id: 3,
      name: "Elite Challenge",
      startingBalance: 10000,
      target: 25000,
      maxBet: 1000,
      payout: 5000,
      duration: "60 days",
      description: "The ultimate test",
      badge: "ELITE"
    }
  ];

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && step === 'auth') {
        setStep('challenge');
      }
    });

    return () => subscription.unsubscribe();
  }, [step]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign up user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            setError('An account with this email already exists. Please sign in instead.');
            setIsSignUp(false);
          } else {
            throw error;
          }
        } else if (data.user) {
          // Account created successfully - show success message and switch to sign-in
          setError('✅ Account created successfully! Now signing you in...');
          setIsSignUp(false);
          
          // Wait a moment then try to sign in
          setTimeout(async () => {
            setLoading(true);
            try {
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (signInError) {
                if (signInError.message.includes('Email not confirmed')) {
                  // Email confirmation is still required - provide clear instructions
                  setError('Account created! Please check your email and click the confirmation link, then try signing in again.');
                } else {
                  setError('Account created! Please try signing in with your email and password.');
                }
              } else if (signInData.user) {
                setStep('challenge');
              }
            } catch (err) {
              setError('Account created! Please try signing in with your email and password.');
            } finally {
              setLoading(false);
            }
          }, 1500);
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.log('Sign-in error:', error.message);
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            setError('⚠️ Your email needs to be confirmed. Please check your email inbox (including spam) for a confirmation link, then try signing in again. If you don\'t see it, try creating a new account.');
          } else if (error.message.includes('Email link is invalid or has expired')) {
            setError('The confirmation link has expired. Please create a new account.');
            setIsSignUp(true);
          } else {
            setError(`Sign-in failed: ${error.message}`);
          }
        } else if (data.user) {
          setStep('challenge');
        }
      }
    } catch (error) {
      console.log('Auth error:', error.message);
      setError(error.message);
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Store the user's challenge selection
        const { error } = await supabase
          .from('user_challenges')
          .insert({
            user_id: session.user.id,
            challenge_id: selectedChallenge.id,
            starting_balance: selectedChallenge.startingBalance,
            target: selectedChallenge.target,
            max_bet: selectedChallenge.maxBet,
            status: 'active'
          });

        if (error) {
          console.log('Challenge storage error:', error.message);
        }
      }

      router.push('/dashboard');
    } catch (error) {
      console.log('Challenge start error:', error.message);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'challenge') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
        }}></div>

        <div className="relative flex items-center justify-center min-h-screen p-6">
          <div className="max-w-7xl w-full">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
                Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Challenge</span>
              </h1>
              <p className="text-xl text-gray-300 font-medium">Select the tier that matches your skill level and start earning</p>
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
                  <div className={`relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border-2 transition-all duration-300 ${
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
                      <h3 className="text-2xl font-bold text-white mb-3">{challenge.name}</h3>
                      <p className="text-gray-400 mb-8 text-lg">{challenge.description}</p>

                      <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium">Starting Balance</span>
                          <span className="text-green-400 font-bold text-lg">${challenge.startingBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium">Profit Target</span>
                          <span className="text-blue-400 font-bold text-lg">${challenge.target.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 px-4 bg-slate-700/50 rounded-xl">
                          <span className="text-gray-300 font-medium">Max Bet Size</span>
                          <span className="text-white font-bold text-lg">${challenge.maxBet}</span>
                        </div>
                      </div>

                      <div className="text-center p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/20">
                        <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
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
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-12 rounded-2xl transition-all duration-300 text-xl shadow-2xl transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      <div className="relative max-w-md w-full">
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-400 font-medium">
              {isSignUp ? 'Join our funded challenge platform' : 'Sign in to your account'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm font-medium">{error}</p>
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
                className="w-full px-4 py-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all duration-300 font-medium"
                placeholder="Enter your email"
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
                  className="w-full px-4 py-4 pr-12 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all duration-300 font-medium"
                  placeholder="Enter your password"
                  minLength="8"
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
              <p className="text-gray-400 text-xs mt-2">Minimum 8 characters required</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100"
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
              }}
              className="text-green-400 hover:text-green-300 font-medium transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
