import { useState } from 'react';
import Image from 'next/image';
import Head from 'next/head';

export default function BetaLanding({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const BETA_PASSWORD = 'baldwin';

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('Please agree to the terms to continue');
      return;
    }
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
    <>
      <Head>
        <meta name="theme-color" content="#000000" />
      </Head>
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-black">
        <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')"
      }}></div>

      <div className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mb-8 flex justify-center">
            <img
              src="/funderlogo/Piks.png?v=5"
              alt="Piks"
              className="h-[90px] sm:h-[115px] w-auto"
            />
          </div>
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
                    className="w-full px-4 py-4 bg-black border-2 rounded-xl text-white placeholder-gray-400 focus:outline-none transition-all font-medium text-center text-lg tracking-widest"
                    style={{
                      borderImage: 'linear-gradient(135deg, #7B3FF2, #5227FF, #FF9FFC) 1',
                      boxShadow: '0 0 20px rgba(123, 63, 242, 0.5), 0 0 40px rgba(82, 39, 255, 0.3)'
                    }}
                    placeholder="Enter access code"
                    required
                    autoFocus
                  />
                </div>

                {/* Terms Agreement Checkbox */}
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      setError('');
                    }}
                    className="mt-1 h-5 w-5 rounded border-gray-600 bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-400 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-gray-400 text-sm cursor-pointer select-none">
                    I agree to the{' '}
                    <a href="#" className="text-green-400 hover:text-green-300 underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-green-400 hover:text-green-300 underline">
                      Privacy Policy
                    </a>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!agreedToTerms}
                  className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg ${
                    agreedToTerms
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white transform hover:scale-105 cursor-pointer'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  Enter Platform
                </button>
              </form>

              <div className="mt-8 text-center">
                <div className="w-full border-t border-gray-600 mb-4"></div>
                <p className="text-gray-400 text-sm mb-3">Don't have access?</p>
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
    </>
  );
}
