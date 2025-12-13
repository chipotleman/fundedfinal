import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function CheckoutRedirect() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/auth?returnTo=checkout');
      return;
    }

    const pendingChallenge = localStorage.getItem('pending_challenge');
    if (!pendingChallenge) {
      router.push('/');
      return;
    }

    const createCheckout = async () => {
      try {
        const challengeData = JSON.parse(pendingChallenge);
        
        const response = await fetch('/api/fanbasis-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            challengeType: challengeData.badge,
            challengeName: challengeData.name,
            startingBalance: challengeData.startingBalance,
            userSplit: challengeData.userSplit,
            adjustedPrice: challengeData.adjustedPrice,
            userId: session.user.id,
            userEmail: session.user.email || ''
          })
        });

        const data = await response.json();

        if (data.success && data.paymentLink) {
          window.location.href = data.paymentLink;
        } else {
          setError(data.error || 'Failed to create checkout session');
          setLoading(false);
        }
      } catch (err) {
        console.error('Checkout error:', err);
        setError('Failed to initialize checkout. Please try again.');
        setLoading(false);
      }
    };

    createCheckout();
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {loading && !error ? (
          <>
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Preparing Checkout...</h2>
            <p className="text-gray-400">You'll be redirected to complete your payment</p>
          </>
        ) : error ? (
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-red-500/30 max-w-md">
            <div className="text-red-400 text-lg font-bold mb-4">Checkout Error</div>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
            >
              Return Home
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
