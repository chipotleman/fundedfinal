import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const MERCHANT_ID = '802865';

const challenges = [
  {
    id: 'starter',
    name: 'Starter Challenge',
    startingBalance: 5000,
    price: 149,
    fanbasisProductId: '', // Add your Fanbasis product ID here
  },
  {
    id: 'pro',
    name: 'Pro Challenge',
    startingBalance: 10000,
    price: 249,
    fanbasisProductId: '', // Add your Fanbasis product ID here
  },
  {
    id: 'elite',
    name: 'Elite Challenge',
    startingBalance: 25000,
    price: 399,
    fanbasisProductId: '', // Add your Fanbasis product ID here
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
  const [selectedChallenge, setSelectedChallenge] = useState(challenges[0]);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (tier) {
      const challenge = challenges.find(c => c.id === tier);
      if (challenge) {
        setSelectedChallenge(challenge);
      }
    }
  }, [tier]);

  const handleTierChange = (challenge) => {
    setSelectedChallenge(challenge);
    router.push(`/checkout?tier=${challenge.id}`, undefined, { shallow: true });
  };

  const handleCheckout = async () => {
    if (!selectedChallenge.fanbasisProductId) {
      alert('Checkout not yet configured. Please contact support.');
      return;
    }

    setIsRedirecting(true);
    
    const successUrl = `${window.location.origin}/dashboard?checkout=success`;
    const cancelUrl = `${window.location.origin}/checkout?tier=${selectedChallenge.id}`;
    
    window.location.href = `https://fanbasis.com/challenges/checkout/${MERCHANT_ID}/${selectedChallenge.fanbasisProductId}?success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;
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

            <button
              onClick={handleCheckout}
              disabled={isRedirecting}
              style={{
                width: '100%',
                padding: '18px',
                background: isRedirecting ? '#1e40af' : '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isRedirecting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                marginBottom: '16px'
              }}
            >
              {isRedirecting ? 'Redirecting to payment...' : `Purchase for $${selectedChallenge.price}.00`}
            </button>

            <div style={{
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
