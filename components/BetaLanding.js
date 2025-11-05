import { useState } from 'react';
import Image from 'next/image';

export default function BetaLanding({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const BETA_PASSWORD = 'piks2025';

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === BETA_PASSWORD) {
      localStorage.setItem('beta_access', 'true');
      onAuthenticated();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    await new Promise(resolve => setTimeout(resolve, 800));

    const existingSignups = JSON.parse(localStorage.getItem('beta_signups') || '[]');
    existingSignups.push({
      email,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('beta_signups', JSON.stringify(existingSignups));

    setSignupSuccess(true);
    setLoading(false);
    setEmail('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      <div className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mb-8 flex justify-center">
            <Image 
              src="/pikslogotransparent.png" 
              alt="Piks Logo" 
              width={140}
              height={140}
              priority
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Piks</span>
          </h1>
          <p className="text-lg text-gray-300 font-medium">
            The future of funded sports betting challenges
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-2xl">
          {!showSignup ? (
            <>
              <div className="text-center mb-6">
                <div className="inline-block bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-6">
                  <span className="text-green-400 font-bold text-sm uppercase tracking-wide">Private Beta</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Enter Access Code</h2>
                <p className="text-gray-400 text-sm">Have a beta access code? Enter it below</p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all font-medium text-center text-lg tracking-widest"
                    placeholder="Enter access code"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg transform hover:scale-105"
                >
                  Enter Platform
                </button>
              </form>

              <div className="mt-6 text-center">
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-slate-800/50 text-gray-400">Don't have access?</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignup(true)}
                  className="text-green-400 hover:text-green-300 font-semibold transition-colors"
                >
                  Request Beta Access →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <button
                  onClick={() => {
                    setShowSignup(false);
                    setSignupSuccess(false);
                    setError('');
                  }}
                  className="text-gray-400 hover:text-gray-300 mb-4 inline-flex items-center text-sm transition-colors"
                >
                  ← Back to login
                </button>
                <h2 className="text-2xl font-bold text-white mb-2">Request Beta Access</h2>
                <p className="text-gray-400 text-sm">Join the waitlist for early access</p>
              </div>

              {signupSuccess && (
                <div className="mb-6 p-4 rounded-xl border bg-green-500/10 border-green-500/20 text-green-400">
                  <p className="text-sm font-medium">✅ Success! We'll send you an access code soon.</p>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSignupSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-all font-medium"
                    placeholder="Enter your email"
                    required
                    disabled={signupSuccess}
                  />
                </div>

                {!signupSuccess && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      'Request Access'
                    )}
                  </button>
                )}
              </form>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Piks &copy; {new Date().getFullYear()} - All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
