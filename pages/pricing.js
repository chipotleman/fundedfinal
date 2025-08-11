// pages/pricing.js

import { useRouter } from 'next/router';

export default function Pricing() {
  const router = useRouter();

  const handleCheckout = async () => {
    // Redirect to your Stripe checkout or Pass Purchase URL
    window.location.href = 'https://buy.stripe.com/test_bJe3cv6Af8kvfjwdkU0kE00';
  };

  const packages = [
    {
      id: 1,
      name: "Starter Challenge",
      startingBalance: "$5,000",
      price: "$149",
      target: "$1,000",
      dailyLoss: "15%",
      features: [
        "15% daily loss limit",
        "$1,000 profit target",
        "80% profit share",
        "No overnight holds",
        "All major sports",
        "Real-time tracking"
      ]
    },
    {
      id: 2,
      name: "Pro Challenge",
      startingBalance: "$10,000",
      price: "$249",
      target: "$2,000",
      dailyLoss: "15%",
      features: [
        "15% daily loss limit",
        "$2,000 profit target",
        "80% profit share",
        "Priority support",
        "All major sports",
        "Advanced analytics"
      ]
    },
    {
      id: 3,
      name: "Elite Challenge",
      startingBalance: "$25,000",
      price: "$399",
      target: "$5,000",
      dailyLoss: "15%",
      features: [
        "15% daily loss limit",
        "$5,000 profit target",
        "80% profit share",
        "VIP support",
        "All major sports",
        "Weekly payouts"
      ]
    }
  ];

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ color: '#a020f0' }}>Get Your Funded Pass</h1>
      <p style={{ maxWidth: '400px', textAlign: 'center' }}>Purchase your 2-week evaluation pass to start your funded betting challenge and qualify for payouts when you hit your target.</p>
      <button
        onClick={handleCheckout}
        style={{ padding: '15px 30px', backgroundColor: '#a020f0', color: '#fff', border: 'none', borderRadius: '5px', marginTop: '20px' }}
      >
        Buy Pass - $249
      </button>
    </div>
  );
}