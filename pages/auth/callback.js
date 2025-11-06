import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { code } = router.query;

        if (code) {
          // Exchange the code for a session (client-side)
          const { data, error } = await supabase.auth.exchangeCodeForSession({ 
            authCode: code 
          });

          if (error) {
            console.error('OAuth callback error:', error);
            setError('Authentication failed. Redirecting...');
            setTimeout(() => router.push('/auth?error=oauth_failed'), 2000);
            return;
          }

          if (data.session) {
            // Successfully authenticated - redirect to dashboard
            router.push('/dashboard');
          }
        } else {
          // No code present, redirect to auth
          router.push('/auth');
        }
      } catch (error) {
        console.error('OAuth callback exception:', error);
        setError('Something went wrong. Redirecting...');
        setTimeout(() => router.push('/auth?error=oauth_exception'), 2000);
      }
    };

    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div>
            <div className="text-red-400 text-xl mb-4">{error}</div>
            <div className="text-gray-400">Please wait...</div>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-white text-xl mb-2">Completing sign in...</div>
            <div className="text-gray-400">Please wait while we authenticate you</div>
          </div>
        )}
      </div>
    </div>
  );
}
