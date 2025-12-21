import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function AuthPopup({ isOpen, onClose, initialMode = 'signin' }) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login, signUp: signUpUser } = useAuth();
  const { isDarkMode } = useTheme();

  const isPasswordStrong = password.length >= 6;
  const passwordsMatch = isSignUp && confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(initialMode === 'signup');
      const savedEmail = localStorage.getItem('remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
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
  }, [isOpen, initialMode]);

  const handleAuth = async (e) => {
    e.preventDefault();

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
        await signUpUser(email.trim(), password);
        setError('');
        
        if (rememberMe) {
          localStorage.setItem('remembered_email', email.trim());
        }
        
        onClose();
        router.push('/dashboard');
      } else {
        await login(email.trim(), password, rememberMe);
        onClose();
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);

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

  const handleOAuthClick = (provider) => {
    setError(`${provider} sign-in will be available soon!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
      <div 
        className="popup-content relative bg-black rounded-3xl max-w-md w-full my-auto border-2 border-green-500"
        style={{ WebkitTapHighlightColor: 'transparent' }}
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
          <div className="text-center mb-6">
            <img src="/pikslogotransparent.png" alt="Piks Logo" className="h-28 mx-auto" style={{ filter: isDarkMode ? 'none' : 'invert(1) brightness(0.1)' }} />
          </div>

          {error && (
            <div className={`mb-4 p-3 rounded-xl border text-sm ${
              error.includes('successfully') || error.includes('created')
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : error.includes('soon')
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <button
              type="button"
              onClick={() => handleOAuthClick('Apple')}
              className="w-full flex items-center justify-center space-x-3 font-medium py-3 px-4 rounded-xl transition-all duration-200"
              style={{ WebkitTapHighlightColor: 'transparent', backgroundColor: '#000000', color: '#ffffff', border: '1px solid #333333' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span>Continue with Apple</span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black text-gray-500">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all duration-200"
                placeholder="Email address"
                required
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all duration-200"
                placeholder="Password"
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
              <p className="text-xs text-gray-400">
                Minimum 6 characters required
              </p>
            )}

            {isSignUp && (
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all duration-200"
                  placeholder="Confirm password"
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

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMePopup"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-green-500 text-green-500"
              />
              <label htmlFor="rememberMePopup" className="ml-2 text-sm text-gray-400 cursor-pointer">
                Remember my email
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3.5 rounded-xl transition-all duration-300 shadow-lg"
              style={{ 
                WebkitTapHighlightColor: 'transparent', 
                backgroundColor: loading ? '#4b5563' : '#2563eb',
                color: '#ffffff'
              }}
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

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-green-400 hover:text-green-300 font-medium transition-colors text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-3 text-center">
            <p className="text-gray-500 text-xs">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
