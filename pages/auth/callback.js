import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    // NextAuth.js handles OAuth callbacks automatically via /api/auth/callback/[provider]
    // This page is no longer needed with NextAuth.js, redirecting to auth page
    if (router.isReady) {
      router.push('/auth');
    }
  }, [router.isReady, router]);

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
