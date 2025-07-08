// pages/pricing.js

import { useRouter } from 'next/router';

export default function Pricing() {
  const router = useRouter();

  const handleCheckout = async () => {
    // Redirect to your Stripe checkout or Pass Purchase URL
    window.location.href = 'https://buy.stripe.com/test_bJe3cv6Af8kvfjwdkU0kE00;
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ color: '#a020f0' }}>Get Your Funded Pass</h1>
      <p style={{ maxWidth: '400px', textAlign: 'center' }}>Purchase your 2-week evaluation pass to start your funded betting challenge and qualify for payouts when you hit your target.</p>
      <button
        onClick={handleCheckout}
        style={{ padding: '15px 30px', backgroundColor: '#a020f0', color: '#fff', border: 'none', borderRadius: '5px', marginTop: '20px' }}
      >
        Buy Pass - $199
      </button>
    </div>
  );
}
