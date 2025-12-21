import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CREATOR_ID = process.env.NEXT_PUBLIC_FANBASIS_CREATOR_ID || '802865';

const challenges = [
  {
    id: 'starter',
    name: 'Starter Challenge',
    startingBalance: 5000,
    price: 149,
  },
  {
    id: 'pro',
    name: 'Pro Challenge',
    startingBalance: 10000,
    price: 249,
  },
  {
    id: 'elite',
    name: 'Elite Challenge',
    startingBalance: 25000,
    price: 399,
  },
];

const phaseData = [
  { label: 'Reward', phase1: '$15', phase2: '$50', reward: '90%' },
  { label: 'Min Picks', phase1: '20 picks', phase2: '20 picks', reward: '20 picks' },
  { label: 'Profit Target', phase1: '20%', phase2: '20%', reward: 'None' },
  { label: 'Max Drawdown', phase1: '15%', phase2: '15%', reward: '15%' },
  { label: 'Min Risk', phase1: '1%', phase2: '1%', reward: '1%' },
  { label: 'Max Risk', phase1: '5%', phase2: '5%', reward: '5%' },
  { label: 'Cashout Fee', phase1: '10%', phase2: '10%', reward: '10%' },
];

export default function Checkout() {
  const router = useRouter();
  const { tier } = router.query;
  const checkoutContainerRef = useRef(null);
  const checkoutInstanceRef = useRef(null);
  const [selectedChallenge, setSelectedChallenge] = useState(challenges[0]);
  const [checkoutState, setCheckoutState] = useState('idle');
  const [error, setError] = useState(null);
  const [sessionSecret, setSessionSecret] = useState(null);

  useEffect(() => {
    if (tier) {
      const challenge = challenges.find(c => c.id === tier);
      if (challenge) {
        setSelectedChallenge(challenge);
      }
    }
  }, [tier]);

  const createCheckoutSession = useCallback(async (challenge) => {
    setCheckoutState('creating');
    setError(null);
    
    try {
      const response = await fetch('/api/fanbasis/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: challenge.price * 100,
          productName: `${challenge.name} - $${challenge.startingBalance.toLocaleString()} Funded Account`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      setSessionSecret(data.checkoutSessionSecret);
      setCheckoutState('ready');
      return data.checkoutSessionSecret;
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      setError(err.message);
      setCheckoutState('error');
      return null;
    }
  }, []);

  const initializeCheckout = useCallback(async (secret) => {
    if (!checkoutContainerRef.current || !secret) return;

    try {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current = null;
        checkoutContainerRef.current.innerHTML = '';
      }

      const { createEmbeddedCheckout } = await import('@fanbasis/checkout-core');
      
      const checkout = createEmbeddedCheckout(checkoutContainerRef.current, {
        creatorId: CREATOR_ID,
        checkoutSessionSecret: secret,
        environment: 'production',
        theme: {
          theme: 'dark',
          accent_color: '#2563eb',
          background_color: '#1a1a1a',
          surface_color: '#111111',
          border_color: '#333333',
          label_color: '#888888',
          heading_color: '#ffffff',
          product_text_color: '#ffffff',
          show_product_info: false,
          show_coupon_row: true,
        },
        containerOptions: {
          width: '100%',
          height: 'auto',
        },
        redirectSettings: {
          success_redirect_url: `${window.location.origin}/dashboard?checkout=success&tier=${selectedChallenge.id}`,
          failure_redirect_url: `${window.location.origin}/checkout?tier=${selectedChallenge.id}&error=payment_failed`,
        },
      });

      checkoutInstanceRef.current = checkout;

      checkout.on('checkout:loaded', () => {
        setCheckoutState('loaded');
      });

      checkout.on('checkout:error', (err) => {
        console.error('Checkout error:', err);
        setError(err.message || 'Checkout error occurred');
        setCheckoutState('error');
      });

      checkout.on('checkout:success', (data) => {
        console.log('Payment successful:', data);
        router.push(`/dashboard?checkout=success&tier=${selectedChallenge.id}`);
      });

    } catch (err) {
      console.error('Failed to initialize checkout:', err);
      setError('Failed to load checkout. Please try again.');
      setCheckoutState('error');
    }
  }, [selectedChallenge, router]);

  useEffect(() => {
    if (selectedChallenge && checkoutState === 'idle') {
      createCheckoutSession(selectedChallenge);
    }
  }, [selectedChallenge, checkoutState, createCheckoutSession]);

  useEffect(() => {
    if (sessionSecret && checkoutState === 'ready') {
      initializeCheckout(sessionSecret);
    }
  }, [sessionSecret, checkoutState, initializeCheckout]);

  const handleTierChange = async (challenge) => {
    if (challenge.id === selectedChallenge.id) return;
    
    setSelectedChallenge(challenge);
    setSessionSecret(null);
    setCheckoutState('idle');
    router.push(`/checkout?tier=${challenge.id}`, undefined, { shallow: true });
  };

  const handleRetry = () => {
    setError(null);
    setCheckoutState('idle');
    setSessionSecret(null);
  };

  return (
    <>
      <Head>
        <title>Checkout - Piks Challenge</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #222',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <a href="/" style={{ display: 'inline-block' }}>
              <img 
                src="/pikslogotransparent.png" 
                alt="Piks" 
                style={{ height: '32px' }}
              />
            </a>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 20px',
            maxWidth: '900px',
            margin: '0 auto',
            width: '100%',
          }}>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#888', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                marginBottom: '16px'
              }}>
                Select Your Challenge
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginBottom: '24px',
                flexWrap: 'wrap'
              }}>
                {challenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    onClick={() => handleTierChange(challenge)}
                    style={{
                      padding: '14px 28px',
                      background: selectedChallenge.id === challenge.id ? '#2563eb' : '#1a1a1a',
                      border: `1px solid ${selectedChallenge.id === challenge.id ? '#2563eb' : '#333'}`,
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '16px',
                      fontFamily: 'inherit',
                    }}
                  >
                    ${challenge.startingBalance.toLocaleString()}
                  </button>
                ))}
              </div>

              <div style={{ 
                fontSize: '36px', 
                fontWeight: '700', 
                color: '#2563eb',
                marginBottom: '8px'
              }}>
                ${selectedChallenge.price}.00
              </div>
              <div style={{ color: '#888', fontSize: '14px' }}>
                {selectedChallenge.name} with 90% profit split
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #222',
                      color: '#888',
                      fontWeight: '500',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}></th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #222',
                      color: '#888',
                      fontWeight: '500',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>Phase 1</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #222',
                      color: '#888',
                      fontWeight: '500',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>Phase 2</th>
                    <th style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #222',
                      color: '#888',
                      fontWeight: '500',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #222',
                        color: '#fff',
                        fontWeight: '500'
                      }}>{row.label}</td>
                      <td style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #222',
                        color: row.label === 'Reward' ? '#2563eb' : '#fff'
                      }}>{row.phase1}</td>
                      <td style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #222',
                        color: row.label === 'Reward' ? '#2563eb' : '#fff'
                      }}>{row.phase2}</td>
                      <td style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid #222',
                        color: row.label === 'Reward' ? '#22c55e' : '#fff'
                      }}>{row.reward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <img 
                  src="/pikslogotransparent.png" 
                  alt="Piks" 
                  style={{ height: '24px' }}
                />
                <div>
                  <div style={{ fontWeight: '600' }}>Piks Challenge - ${selectedChallenge.startingBalance.toLocaleString()}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>{selectedChallenge.name}</div>
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#888' }}>Starting Balance</span>
                <span style={{ fontWeight: '600' }}>${selectedChallenge.startingBalance.toLocaleString()}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <span style={{ color: '#888' }}>Profit Split</span>
                <span style={{ fontWeight: '600', color: '#22c55e' }}>90%</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #333'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '600' }}>Total due</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb' }}>
                  ${selectedChallenge.price}.00
                </span>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#7f1d1d',
                border: '1px solid #dc2626',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
                color: '#fca5a5',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>{error}</span>
                <button
                  onClick={handleRetry}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            <div 
              ref={checkoutContainerRef}
              style={{
                minHeight: checkoutState === 'loaded' ? 'auto' : '300px',
                background: '#111',
                borderRadius: '12px',
                display: checkoutState === 'loaded' ? 'block' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {(checkoutState === 'idle' || checkoutState === 'creating' || checkoutState === 'ready') && (
                <div style={{ 
                  color: '#888', 
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '40px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #333',
                    borderTopColor: '#2563eb',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Loading secure checkout...
                </div>
              )}
            </div>

            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>

            <div style={{
              marginTop: '24px',
              textAlign: 'center',
              color: '#666',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
                Secure payment powered by Fanbasis
              </div>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <a href="/terms" style={{ color: '#666', textDecoration: 'none' }}>Terms</a>
                <a href="/privacy" style={{ color: '#666', textDecoration: 'none' }}>Privacy</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
