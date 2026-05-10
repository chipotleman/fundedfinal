import { useRouter } from 'next/router';
import TopNavbar from './TopNavbar';

// Cartoon-themed "Coming Soon" page used during the public beta to gate
// real-money flows (deposits + withdrawals). Doubles as a platform
// explainer so first-time visitors who tap the navigation pills land on
// a page that actually tells them how Piks works and what they can do
// today.  Style guardrails: 2.5–3px #0a0a0a borders, 4px hard shadows,
// blue / orange / emerald accents, no purple, hover gated to lg:hover.

const KIND_COPY = {
  withdraw: {
    eyebrow: 'Cashouts',
    title: 'Withdrawals open after beta',
    sub: "We're not moving real money in or out during the beta — every battle is for your ranking, not your wallet.",
    icon: '🏦',
    accent: '#fb923c',
  },
  deposit: {
    eyebrow: 'Deposits',
    title: 'Deposits open after beta',
    sub: "No need to fund anything yet. Every player gets the same coin stack and battles for ranking.",
    icon: '💳',
    accent: '#3b82f6',
  },
};

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Battle 1v1',
    body: 'Match up against a friend or random opponent. Both players start with the same 10,000 coin stack.',
    color: '#3b82f6',
  },
  {
    n: '02',
    title: 'Pik all day',
    body: 'Place picks across every live and upcoming game until the last one settles — just like a real sportsbook.',
    color: '#fb923c',
  },
  {
    n: '03',
    title: 'Highest balance wins',
    body: 'When the last game grades, whoever ended the day with the bigger coin balance takes the W and climbs the leaderboard.',
    color: '#10b981',
  },
];

const TODAY_VS_LATER = {
  today: [
    'Play unlimited 1v1 Original battles',
    'Build your win/loss record + ranking',
    'Climb the public leaderboard',
    'Challenge friends with private rooms',
  ],
  later: [
    'Real-money entry fees',
    'Cash withdrawals to your bank or card',
    'RUSH (6-prop sprint) game mode',
    'Multi-day TOURNAMENT brackets',
  ],
};

export default function ComingSoonExplainer({ kind = 'withdraw' }) {
  const router = useRouter();
  const copy = KIND_COPY[kind] || KIND_COPY.withdraw;

  return (
    <>
      <TopNavbar />
      <div className="cs-root">
        <div className="cs-container">
          {/* Hero card */}
          <div className="cs-hero">
            <div className="cs-hero-icon" style={{ background: copy.accent }}>
              <span aria-hidden="true">{copy.icon}</span>
            </div>
            <span className="cs-eyebrow">{copy.eyebrow}</span>
            <h1 className="cs-title">{copy.title}</h1>
            <p className="cs-sub">{copy.sub}</p>
            <div className="cs-beta-pill">
              <span className="cs-beta-dot" />
              PIKS BETA — RANKING ONLY
            </div>
          </div>

          {/* How it works */}
          <div className="cs-section">
            <div className="cs-section-head">
              <span className="cs-section-eyebrow">How Piks works</span>
              <h2 className="cs-section-title">As close to a real sportsbook as you can get</h2>
              <p className="cs-section-sub">
                Same lines, same odds, same pressure — without putting your wallet on the line. Every match runs on coins so the only thing on the table is your ranking.
              </p>
            </div>
            <div className="cs-steps">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.n} className="cs-step" style={{ '--step-accent': step.color }}>
                  <span className="cs-step-num">{step.n}</span>
                  <h3 className="cs-step-title">{step.title}</h3>
                  <p className="cs-step-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Today vs Later */}
          <div className="cs-grid">
            <div className="cs-list cs-list-today">
              <div className="cs-list-head">
                <span className="cs-list-tag" style={{ background: '#10b981' }}>BETA</span>
                <h3 className="cs-list-title">What you can do today</h3>
              </div>
              <ul className="cs-list-items">
                {TODAY_VS_LATER.today.map((item) => (
                  <li key={item}>
                    <span className="cs-check" aria-hidden="true">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="cs-list cs-list-later">
              <div className="cs-list-head">
                <span className="cs-list-tag" style={{ background: '#fb923c' }}>SOON</span>
                <h3 className="cs-list-title">What's coming after launch</h3>
              </div>
              <ul className="cs-list-items">
                {TODAY_VS_LATER.later.map((item) => (
                  <li key={item}>
                    <span className="cs-clock" aria-hidden="true">◷</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="cs-cta">
            <button type="button" className="cs-cta-primary no-hover-effect" onClick={() => router.push('/dashboard')}>
              Start a Battle
            </button>
            <button type="button" className="cs-cta-secondary no-hover-effect" onClick={() => router.push('/battle')}>
              Browse the lounge
            </button>
          </div>

          <p className="cs-fineprint">
            Heads up — during the public beta, Piks is for ranking only. No real money goes in or out. We'll flip on real-money battles + cashouts the moment beta wraps.
          </p>
        </div>

        <style jsx>{`
          .cs-root {
            min-height: 100vh;
            background: #000;
            padding: 80px 16px 80px;
            color: #f5f7fb;
          }
          @media (min-width: 768px) {
            .cs-root { padding: 96px 24px 120px; }
          }
          .cs-container {
            max-width: 980px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 28px;
          }
          /* HERO */
          .cs-hero {
            position: relative;
            background: #0d0d0d;
            border: 3px solid #0a0a0a;
            border-radius: 24px;
            box-shadow: 0 6px 0 #0a0a0a, 0 0 0 1px rgba(255,255,255,0.04) inset;
            padding: 32px 24px 28px;
            text-align: center;
            overflow: hidden;
          }
          .cs-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 18% 20%, rgba(59,130,246,0.18), transparent 55%),
              radial-gradient(circle at 82% 80%, rgba(251,146,60,0.18), transparent 55%);
            pointer-events: none;
          }
          .cs-hero-icon {
            position: relative;
            width: 64px;
            height: 64px;
            border-radius: 18px;
            border: 2.5px solid #0a0a0a;
            box-shadow: 4px 4px 0 #0a0a0a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            margin: 0 auto 16px;
          }
          .cs-eyebrow {
            position: relative;
            display: inline-block;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #9ca3af;
            margin-bottom: 8px;
          }
          .cs-title {
            position: relative;
            font-size: 28px;
            font-weight: 900;
            color: #fff;
            line-height: 1.15;
            letter-spacing: -0.01em;
            margin: 0 auto 12px;
            max-width: 640px;
          }
          @media (min-width: 768px) {
            .cs-title { font-size: 38px; }
          }
          .cs-sub {
            position: relative;
            font-size: 15px;
            font-weight: 500;
            color: #cbd5e1;
            line-height: 1.55;
            margin: 0 auto;
            max-width: 560px;
          }
          .cs-beta-pill {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            padding: 8px 14px;
            background: #0a0a0a;
            border: 2.5px solid #10b981;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.14em;
            color: #34d399;
            box-shadow: 4px 4px 0 #0a0a0a;
          }
          .cs-beta-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #10b981;
            box-shadow: 0 0 0 4px rgba(16,185,129,0.2);
            animation: csPulse 1.6s ease-in-out infinite;
          }
          @keyframes csPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
          /* SECTION */
          .cs-section {
            background: #0d0d0d;
            border: 3px solid #0a0a0a;
            border-radius: 24px;
            box-shadow: 0 6px 0 #0a0a0a;
            padding: 28px 22px;
          }
          .cs-section-head {
            text-align: center;
            margin-bottom: 22px;
          }
          .cs-section-eyebrow {
            display: inline-block;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #60a5fa;
            margin-bottom: 6px;
          }
          .cs-section-title {
            font-size: 22px;
            font-weight: 900;
            color: #fff;
            line-height: 1.2;
            margin: 0 0 8px;
          }
          @media (min-width: 768px) {
            .cs-section-title { font-size: 26px; }
          }
          .cs-section-sub {
            font-size: 14px;
            color: #94a3b8;
            line-height: 1.55;
            margin: 0 auto;
            max-width: 560px;
          }
          .cs-steps {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
          }
          @media (min-width: 768px) {
            .cs-steps { grid-template-columns: repeat(3, 1fr); gap: 16px; }
          }
          .cs-step {
            background: #111;
            border: 2.5px solid #0a0a0a;
            border-left: 6px solid var(--step-accent, #3b82f6);
            border-radius: 18px;
            padding: 18px 16px;
            box-shadow: 4px 4px 0 #0a0a0a;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .cs-step-num {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.18em;
            color: var(--step-accent, #3b82f6);
            text-transform: uppercase;
          }
          .cs-step-title {
            font-size: 17px;
            font-weight: 900;
            color: #fff;
            margin: 0;
            line-height: 1.2;
          }
          .cs-step-body {
            font-size: 13px;
            color: #cbd5e1;
            line-height: 1.5;
            margin: 0;
          }
          /* GRID */
          .cs-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
          }
          @media (min-width: 768px) {
            .cs-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
          }
          .cs-list {
            background: #0d0d0d;
            border: 3px solid #0a0a0a;
            border-radius: 22px;
            padding: 22px 20px;
            box-shadow: 6px 6px 0 #0a0a0a;
          }
          .cs-list-head {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
          }
          .cs-list-tag {
            display: inline-flex;
            padding: 4px 10px;
            border-radius: 8px;
            border: 2px solid #0a0a0a;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.14em;
            color: #0a0a0a;
            box-shadow: 2px 2px 0 #0a0a0a;
          }
          .cs-list-title {
            font-size: 16px;
            font-weight: 900;
            color: #fff;
            margin: 0;
            line-height: 1.2;
          }
          .cs-list-items {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .cs-list-items li {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 14px;
            font-weight: 600;
            color: #e5e7eb;
            line-height: 1.45;
          }
          .cs-check {
            flex-shrink: 0;
            width: 22px;
            height: 22px;
            border-radius: 7px;
            background: #10b981;
            color: #042f1a;
            border: 2px solid #0a0a0a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 900;
            box-shadow: 2px 2px 0 #0a0a0a;
            margin-top: 1px;
          }
          .cs-clock {
            flex-shrink: 0;
            width: 22px;
            height: 22px;
            border-radius: 7px;
            background: #fb923c;
            color: #2a1404;
            border: 2px solid #0a0a0a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 900;
            box-shadow: 2px 2px 0 #0a0a0a;
            margin-top: 1px;
          }
          /* CTA */
          .cs-cta {
            display: flex;
            flex-direction: column;
            gap: 10px;
            justify-content: center;
            align-items: stretch;
          }
          @media (min-width: 768px) {
            .cs-cta { flex-direction: row; gap: 14px; }
          }
          .cs-cta-primary, .cs-cta-secondary {
            padding: 14px 24px;
            border-radius: 14px;
            font-weight: 900;
            font-size: 14px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            transition: transform 120ms ease, box-shadow 120ms ease;
          }
          .cs-cta-primary {
            background: #3b82f6;
            color: #fff;
            border: 2.5px solid #0a0a0a;
            box-shadow: 4px 4px 0 #0a0a0a;
          }
          .cs-cta-secondary {
            background: #0d0d0d;
            color: #e5e7eb;
            border: 2.5px solid #1f2937;
          }
          .cs-cta-primary:active { transform: translateY(2px); box-shadow: 2px 2px 0 #0a0a0a; }
          .cs-cta-secondary:active { transform: translateY(1px); }
          @media (hover: hover) {
            .cs-cta-primary:hover { transform: translateY(-2px); box-shadow: 6px 6px 0 #0a0a0a; }
            .cs-cta-secondary:hover { background: #1f2937; color: #fff; }
          }
          .cs-fineprint {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
            margin: 0 auto;
            max-width: 580px;
          }
        `}</style>
      </div>
    </>
  );
}
