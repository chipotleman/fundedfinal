import { useState } from 'react';
import Head from 'next/head';

const challenges = [
  {
    id: 1,
    name: 'Starter Challenge',
    startingBalance: 5000,
    price: 149,
    phases: [
      { phase: 'Phase 1', reward: '$15', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Phase 2', reward: '$50', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Reward', reward: '90%', picks: '20 picks', target: 'None', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
    ]
  },
  {
    id: 2,
    name: 'Pro Challenge',
    startingBalance: 10000,
    price: 249,
    phases: [
      { phase: 'Phase 1', reward: '$25', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Phase 2', reward: '$100', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Reward', reward: '90%', picks: '20 picks', target: 'None', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
    ]
  },
  {
    id: 3,
    name: 'Elite Challenge',
    startingBalance: 25000,
    price: 399,
    phases: [
      { phase: 'Phase 1', reward: '$40', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Phase 2', reward: '$200', picks: '20 picks', target: '20%', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
      { phase: 'Reward', reward: '90%', picks: '20 picks', target: 'None', drawdown: '15%', minRisk: '1%', maxRisk: '5%', cashout: '10%', live: 'YES', sgp: 'YES' },
    ]
  },
];

export default function CheckoutDesign() {
  const [selectedChallenge, setSelectedChallenge] = useState(challenges[0]);
  const [promoCode, setPromoCode] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExportCode = () => {
    setShowExportModal(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Piks Challenge Checkout</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .checkout-container { display: flex; min-height: 100vh; }
    .left-panel { flex: 1; padding: 40px; background: #0a0a0a; }
    .right-panel { width: 420px; padding: 40px; background: #111; border-left: 1px solid #222; }
    .logo { height: 48px; margin-bottom: 32px; }
    .challenge-title { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .tier-selector { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .tier-btn { padding: 12px 24px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 500; transition: all 0.2s; }
    .tier-btn.active, .tier-btn:hover { background: #2563eb; border-color: #2563eb; }
    .price-display { font-size: 32px; font-weight: 700; color: #2563eb; margin-bottom: 32px; }
    .phase-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .phase-table th, .phase-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #222; }
    .phase-table th { color: #888; font-weight: 500; font-size: 12px; text-transform: uppercase; }
    .phase-table td { color: #fff; font-size: 14px; }
    .phase-table tr:hover { background: #1a1a1a; }
    .buy-btn { width: 100%; padding: 16px; background: #2563eb; border: none; border-radius: 8px; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
    .order-summary { background: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .order-item { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .order-label { color: #888; }
    .order-value { font-weight: 600; }
    .total-row { border-top: 1px solid #333; padding-top: 12px; margin-top: 12px; }
    .total-row .order-value { color: #2563eb; font-size: 20px; }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; color: #888; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; }
    .form-input { width: 100%; padding: 12px 16px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 14px; }
    .form-input:focus { outline: none; border-color: #2563eb; }
    .promo-row { display: flex; gap: 8px; }
    .promo-btn { padding: 12px 20px; background: #333; border: none; border-radius: 8px; color: #fff; cursor: pointer; }
    .payment-methods { display: flex; gap: 8px; margin-bottom: 16px; }
    .payment-method { flex: 1; padding: 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; text-align: center; cursor: pointer; }
    .payment-method.active { border-color: #2563eb; }
    .secure-badge { display: flex; align-items: center; gap: 8px; color: #888; font-size: 12px; margin-top: 16px; }
    .footer-links { display: flex; gap: 16px; margin-top: 24px; }
    .footer-links a { color: #888; font-size: 12px; text-decoration: none; }
    @media (max-width: 900px) {
      .checkout-container { flex-direction: column; }
      .right-panel { width: 100%; border-left: none; border-top: 1px solid #222; }
    }
  </style>
</head>
<body>
  <div class="checkout-container">
    <div class="left-panel">
      <img src="YOUR_LOGO_URL" alt="Piks" class="logo">
      <div class="challenge-title">Select Your Challenge</div>
      <div class="tier-selector">
        <button class="tier-btn active">$5,000</button>
        <button class="tier-btn">$10,000</button>
        <button class="tier-btn">$25,000</button>
      </div>
      <div class="price-display">$149.00</div>
      <table class="phase-table">
        <thead>
          <tr>
            <th></th>
            <th>Phase 1</th>
            <th>Phase 2</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Reward</td><td>$15</td><td>$50</td><td>90%</td></tr>
          <tr><td>Min Picks</td><td>20 picks</td><td>20 picks</td><td>20 picks</td></tr>
          <tr><td>Profit Target</td><td>20%</td><td>20%</td><td>None</td></tr>
          <tr><td>Max Drawdown</td><td>15%</td><td>15%</td><td>15%</td></tr>
          <tr><td>Min Risk</td><td>1%</td><td>1%</td><td>1%</td></tr>
          <tr><td>Max Risk</td><td>5%</td><td>5%</td><td>5%</td></tr>
          <tr><td>Cashout Fee</td><td>10%</td><td>10%</td><td>10%</td></tr>
          <tr><td>Live Picking</td><td>YES</td><td>YES</td><td>YES</td></tr>
          <tr><td>Same Game Parlays</td><td>YES</td><td>YES</td><td>YES</td></tr>
        </tbody>
      </table>
      <button class="buy-btn">Buy Now</button>
    </div>
    <div class="right-panel">
      <div class="order-summary">
        <h3 style="margin-bottom: 16px; font-size: 16px;">Piks Challenge - $5,000</h3>
        <div class="order-item">
          <span class="order-label">Starting Balance</span>
          <span class="order-value">$5,000</span>
        </div>
        <div class="order-item">
          <span class="order-label">Profit Split</span>
          <span class="order-value" style="color: #22c55e;">90%</span>
        </div>
        <div class="order-item">
          <span class="order-label">Subtotal</span>
          <span class="order-value">$149.00</span>
        </div>
        <div class="order-item total-row">
          <span class="order-label">Total due</span>
          <span class="order-value">$149.00</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input type="tel" class="form-input" placeholder="+1 (555) 123-4567">
      </div>
      <div class="form-group promo-row">
        <input type="text" class="form-input" placeholder="Promo or Affiliate Code">
        <button class="promo-btn">Apply</button>
      </div>
      <div class="form-label" style="margin-bottom: 8px;">Payment Method</div>
      <div class="payment-methods">
        <div class="payment-method active">Card</div>
        <div class="payment-method">Cash App</div>
        <div class="payment-method">Bank</div>
      </div>
      <div class="form-group">
        <input type="text" class="form-input" placeholder="Card number">
      </div>
      <div style="display: flex; gap: 12px;">
        <div class="form-group" style="flex: 1;">
          <input type="text" class="form-input" placeholder="MM / YY">
        </div>
        <div class="form-group" style="flex: 1;">
          <input type="text" class="form-input" placeholder="CVV">
        </div>
      </div>
      <div class="form-group">
        <input type="text" class="form-input" placeholder="Country">
      </div>
      <div class="form-group">
        <input type="text" class="form-input" placeholder="ZIP code">
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <input type="checkbox" id="terms">
        <label for="terms" style="color: #888; font-size: 12px;">I have read and agree to the Terms and Privacy Policy.</label>
      </div>
      <button class="buy-btn">Pay $149.00</button>
      <div class="secure-badge">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
        Secure payment powered by Stripe
      </div>
      <div class="footer-links">
        <a href="#">Terms</a>
        <a href="#">Privacy</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return (
    <>
      <Head>
        <title>Checkout Design - Piks</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ fontFamily: "'Inter', sans-serif", background: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          background: '#1a1a1a', 
          padding: '12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #333',
          zIndex: 1000
        }}>
          <span style={{ color: '#888', fontSize: '14px' }}>Checkout Page Design Preview</span>
          <button
            onClick={handleExportCode}
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Export HTML/CSS Code
          </button>
        </div>

        <div style={{ display: 'flex', minHeight: '100vh', paddingTop: '56px' }}>
          <div style={{ flex: 1, padding: '40px', background: '#0a0a0a' }}>
            <img 
              src="/pikslogotransparent.png" 
              alt="Piks" 
              style={{ height: '48px', marginBottom: '32px' }}
            />
            
            <div style={{ 
              fontSize: '14px', 
              color: '#888', 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              marginBottom: '16px' 
            }}>
              Select Your Challenge
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {challenges.map((challenge) => (
                <button
                  key={challenge.id}
                  onClick={() => setSelectedChallenge(challenge)}
                  style={{
                    padding: '12px 24px',
                    background: selectedChallenge.id === challenge.id ? '#2563eb' : '#1a1a1a',
                    border: `1px solid ${selectedChallenge.id === challenge.id ? '#2563eb' : '#333'}`,
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                >
                  ${challenge.startingBalance.toLocaleString()}
                </button>
              ))}
            </div>
            
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#2563eb', marginBottom: '32px' }}>
              ${selectedChallenge.price}.00
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #222', color: '#888', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase' }}></th>
                  {selectedChallenge.phases.map((phase) => (
                    <th key={phase.phase} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #222', color: '#888', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase' }}>
                      {phase.phase}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Reward</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#2563eb', fontSize: '14px', fontWeight: '600' }}>{phase.reward}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Min Picks</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.picks}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Profit Target</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.target}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Max Drawdown</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.drawdown}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Min Risk</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.minRisk}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Max Risk</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.maxRisk}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Cashout Fee</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>{phase.cashout}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Live Picking</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#22c55e', fontSize: '14px' }}>{phase.live}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#fff', fontSize: '14px' }}>Same Game Parlays</td>
                  {selectedChallenge.phases.map((phase) => (
                    <td key={phase.phase} style={{ padding: '12px 16px', borderBottom: '1px solid #222', color: '#22c55e', fontSize: '14px' }}>{phase.sgp}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            
            <button style={{
              width: '100%',
              padding: '16px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
              Buy Now
            </button>
          </div>
          
          <div style={{ 
            width: '420px', 
            padding: '40px', 
            background: '#111', 
            borderLeft: '1px solid #222',
            minHeight: '100vh'
          }}>
            <div style={{ 
              background: '#1a1a1a', 
              borderRadius: '12px', 
              padding: '24px', 
              marginBottom: '24px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <img src="/pikslogotransparent.png" alt="Piks" style={{ height: '32px' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Piks Challenge - ${selectedChallenge.startingBalance.toLocaleString()}</h3>
                  <span style={{ fontSize: '12px', color: '#888' }}>{selectedChallenge.name}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#888' }}>Starting Balance</span>
                <span style={{ fontWeight: '600' }}>${selectedChallenge.startingBalance.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#888' }}>Profit Split</span>
                <span style={{ fontWeight: '600', color: '#22c55e' }}>90%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#888' }}>Subtotal</span>
                <span style={{ fontWeight: '600' }}>${selectedChallenge.price}.00</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                borderTop: '1px solid #333', 
                paddingTop: '12px', 
                marginTop: '12px' 
              }}>
                <span style={{ color: '#888' }}>Total due</span>
                <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '20px' }}>${selectedChallenge.price}.00</span>
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase' }}>
                Email
              </label>
              <input 
                type="email" 
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase' }}>
                Phone
              </label>
              <input 
                type="tel" 
                placeholder="+1 (555) 123-4567"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Promo or Affiliate Code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              <button style={{
                padding: '12px 20px',
                background: '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}>
                Apply
              </button>
            </div>
            
            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>
              Payment Method
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ 
                flex: 1, 
                padding: '12px', 
                background: '#1a1a1a', 
                border: '1px solid #2563eb', 
                borderRadius: '8px', 
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Card
              </div>
              <div style={{ 
                flex: 1, 
                padding: '12px', 
                background: '#1a1a1a', 
                border: '1px solid #333', 
                borderRadius: '8px', 
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Cash App
              </div>
              <div style={{ 
                flex: 1, 
                padding: '12px', 
                background: '#1a1a1a', 
                border: '1px solid #333', 
                borderRadius: '8px', 
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                Bank
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Card number"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="MM / YY"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              <input 
                type="text" 
                placeholder="CVV"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="Country"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="ZIP code"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="terms" />
              <label htmlFor="terms" style={{ color: '#888', fontSize: '12px' }}>
                I have read and agree to the <a href="#" style={{ color: '#2563eb' }}>Terms</a> and <a href="#" style={{ color: '#2563eb' }}>Privacy Policy</a>.
              </label>
            </div>
            
            <button style={{
              width: '100%',
              padding: '16px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
              Pay ${selectedChallenge.price}.00
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '12px', marginTop: '16px' }}>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
              </svg>
              Secure payment powered by Stripe
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <a href="#" style={{ color: '#888', fontSize: '12px', textDecoration: 'none' }}>Terms</a>
              <a href="#" style={{ color: '#888', fontSize: '12px', textDecoration: 'none' }}>Privacy</a>
            </div>
          </div>
        </div>
        
        {showExportModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Export HTML/CSS Code</h2>
                <button 
                  onClick={() => setShowExportModal(false)}
                  style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
              <p style={{ color: '#888', marginBottom: '16px', fontSize: '14px' }}>
                Copy this code and send it to Fanbasis to have them build your custom checkout page with your exact design.
              </p>
              <div style={{ 
                background: '#0a0a0a', 
                borderRadius: '8px', 
                padding: '16px', 
                marginBottom: '16px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <pre style={{ 
                  color: '#22c55e', 
                  fontSize: '12px', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  fontFamily: 'monospace'
                }}>
                  {htmlCode}
                </pre>
              </div>
              <button
                onClick={() => copyToClipboard(htmlCode)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
