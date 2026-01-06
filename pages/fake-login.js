import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';

export default function FakeLogin() {
  const router = useRouter();
  const [status, setStatus] = useState('Authenticating...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const { token } = router.query;

    if (!token) {
      return;
    }

    async function handleLogin() {
      try {
        setStatus('Validating token...');

        const validateRes = await fetch('/api/auth/validate-impersonation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!validateRes.ok) {
          const error = await validateRes.json();
          throw new Error(error.error || 'Invalid token');
        }

        const { email, password } = await validateRes.json();

        setStatus('Signing in...');

        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          throw new Error('Authentication failed');
        }

        setStatus('Redirecting to dashboard...');
        
        // Use full page reload to ensure session is properly established
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } catch (err) {
        console.error('Fake login error:', err);
        setError(err.message || 'Authentication failed');
      }
    }

    handleLogin();
  }, [router.query.token, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full mx-4 text-center">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Login Failed</h1>
            <p className="text-zinc-400 mb-6">{error}</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Close Window
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Logging In</h1>
            <p className="text-zinc-400">{status}</p>
            <div className="mt-6">
              <div className="w-48 h-1 mx-auto bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
