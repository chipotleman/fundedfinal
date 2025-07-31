import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [step, setStep] = useState('auth');
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

  const handleQuickAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create a temporary user account with email only
      const tempPassword = Math.random().toString(36).substring(2, 15);
      const { error } = await supabase.auth.signUp({
        email,
        password: tempPassword,
      });

      if (error && error.message.includes('already registered')) {
        // If user exists, sign them in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: tempPassword,
        });

        if (signInError) {
          // Try magic link as fallback
          const { error: magicError } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true
            }
          });
          if (!magicError) {
            alert('Check your email for the login link!');
          }
        }
      } else if (error) {
        throw error;
      }
    } catch (error) {
      console.log('Auth error:', error.message);
      // Continue anyway for demo purposes
      setStep('challenge');
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
      // Create demo user data
      const userId = 'demo_' + Math.random().toString(36).substring(2, 15);

      router.push('/dashboard');
    } catch (error) {
      console.log('Challenge start error:', error.message);
      // Continue to dashboard anyway for demo
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
      <div className="absolute inset-0 opacity-10" style={{
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
            <h1 className="text-3xl font-black text-white mb-2">Get Started</h1>
            <p className="text-gray-400 font-medium">Enter your email to begin your funded challenge</p>
          </div>

          <form onSubmit={handleQuickAuth} className="space-y-6">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Please wait...</span>
                </div>
              ) : (
                'Continue to Challenges'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              No passwords required • Start trading in seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}