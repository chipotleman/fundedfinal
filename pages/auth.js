
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [step, setStep] = useState('auth'); // 'auth' or 'challenge'
  const router = useRouter();

  const challenges = [
    {
      id: 1,
      name: "Starter Challenge",
      startingBalance: 1000,
      target: 2500,
      maxBet: 100,
      payout: 500,
      duration: "30 days",
      description: "Perfect for beginners"
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
      popular: true
    },
    {
      id: 3,
      name: "Elite Challenge",
      startingBalance: 10000,
      target: 25000,
      maxBet: 1000,
      payout: 5000,
      duration: "60 days",
      description: "The ultimate test"
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

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
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
      if (!session) throw new Error('No session');

      // Create user balance record
      const { error: balanceError } = await supabase
        .from('user_balances')
        .upsert({
          id: session.user.id,
          balance: selectedChallenge.startingBalance,
          challenge_type: selectedChallenge.name,
          target_balance: selectedChallenge.target,
          max_bet_size: selectedChallenge.maxBet
        });

      if (balanceError) throw balanceError;

      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          challenge_started_at: new Date().toISOString(),
          challenge_type: selectedChallenge.name
        });

      if (profileError) throw profileError;

      router.push('/dashboard');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'challenge') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Choose Your Challenge</h1>
            <p className="text-xl text-gray-300">Select the tier that matches your skill level</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`relative bg-slate-800 rounded-2xl p-6 border-2 cursor-pointer transition-all ${
                  challenge.popular
                    ? 'border-emerald-400 scale-105'
                    : selectedChallenge?.id === challenge.id
                    ? 'border-emerald-400'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedChallenge(challenge)}
              >
                {challenge.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-emerald-400 text-black px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">{challenge.name}</h3>
                  <p className="text-gray-400 mb-6">{challenge.description}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Starting Balance:</span>
                      <span className="text-emerald-400 font-semibold">${challenge.startingBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Profit Target:</span>
                      <span className="text-emerald-400 font-semibold">${challenge.target.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Max Bet:</span>
                      <span className="text-white">${challenge.maxBet}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">${challenge.payout.toLocaleString()}</div>
                    <div className="text-gray-300 text-sm">Payout on Success</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleChallengeStart}
              disabled={loading || !selectedChallenge}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-semibold py-4 px-8 rounded-lg transition text-lg"
            >
              {loading ? 'Starting Challenge...' : 'Start Challenge'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </h1>
            <p className="text-gray-400">
              {isLogin ? 'Sign in to your account' : 'Create your free account'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-400 hover:text-emerald-300 transition"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
