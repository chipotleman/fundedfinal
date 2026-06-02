import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../hooks/useModalScrollLock';
import { formatMoney } from '../utils/formatMoney';
import { useTheme } from '../contexts/ThemeContext';

const MODE_LABELS = {
  rush: { label: 'RUSH', icon: '⚡', color: '#fb923c' },
  original: { label: 'ORIGINAL', icon: '🏆', color: '#3b82f6' },
  tournament: { label: 'TOURNAMENT', icon: '👑', color: '#10b981' },
};

function getMode(matchup) {
  if (matchup?.durationType) return matchup.durationType;
  const dm = matchup?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

// =============================================================================
// BalanceExplainerModal — two DELIBERATELY DIFFERENT popups behind the navbar
// balance pills:
//   • Crowns (type="cash")  → a single, premium "royal" explanation card. Gold
//     treatment, crown motif. Explains that Crowns are the beta standing, the
//     weekly $1,000 grand prize, and that Crowns convert to real cash once the
//     beta ends.
//   • Clash Coins (type="coins") → a stepped, esports-style click-through
//     walkthrough (orange/blue, progress dots, Back / Next) that explains how
//     the in-battle currency works end to end.
// Both are theme-aware (light/dark) via ThemeContext.
// =============================================================================
export default function BalanceExplainerModal({
  type,
  isOpen,
  onClose,
  cashBalance,
  coinsBalance,
  matchup,
  opponent,
}) {
  useModalScrollLock(isOpen);
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [step, setStep] = useState(0);

  // Reset the Clash Coins walkthrough to slide 1 whenever the popup opens or
  // the user switches which pill they tapped.
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen, type]);

  if (!isOpen) return null;

  const isCash = type === 'cash';

  const go = (href) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: isLight ? 'rgba(15,23,42,0.35)' : 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isCash ? 'About Crowns' : 'About Clash Coins'}
    >
      {isCash ? (
        <CrownsView
          isLight={isLight}
          cashBalance={cashBalance}
          onClose={onClose}
          onCta={() => go('/leaderboard')}
        />
      ) : (
        <ClashCoinsView
          isLight={isLight}
          coinsBalance={coinsBalance}
          matchup={matchup}
          opponent={opponent}
          step={step}
          setStep={setStep}
          onClose={onClose}
          onCta={() => go('/battle')}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// CROWNS — premium single-card explainer (gold / royal)
// ----------------------------------------------------------------------------
function CrownsView({ isLight, cashBalance, onClose, onCta }) {
  const s = {
    card: isLight ? '#ffffff' : '#0a0a08',
    cardBorder: isLight ? '1px solid rgba(217,160,34,0.5)' : '1px solid rgba(251,191,36,0.4)',
    headerBg: isLight
      ? 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)'
      : 'radial-gradient(120% 100% at 50% 0%, rgba(251,191,36,0.22) 0%, rgba(10,10,8,0) 70%)',
    headerBorder: isLight ? '1px solid rgba(217,160,34,0.25)' : '1px solid rgba(251,191,36,0.18)',
    balanceBg: isLight ? '#fffbeb' : 'rgba(251,191,36,0.07)',
    balanceBorder: isLight ? '1px solid rgba(217,160,34,0.3)' : '1px solid rgba(251,191,36,0.25)',
    title: isLight ? '#0f172a' : '#ffffff',
    body: isLight ? '#475569' : '#d1d5db',
    muted: isLight ? '#64748b' : '#9ca3af',
    strong: isLight ? '#0f172a' : '#fde68a',
  };

  return (
    <div
      className="popup-content relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
      style={{ background: s.card, border: s.cardBorder, boxShadow: '0 24px 70px rgba(0,0,0,0.6)', maxHeight: '90vh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-6 pt-7 pb-5 text-center relative" style={{ background: s.headerBg, borderBottom: s.headerBorder }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: s.muted }}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div
          className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-3"
          style={{ background: 'linear-gradient(160deg, rgba(251,191,36,0.25), rgba(217,119,6,0.12))', border: '1px solid rgba(251,191,36,0.45)', boxShadow: '0 0 30px rgba(251,191,36,0.25)' }}
        >
          👑
        </div>
        <div className="text-2xl font-black tracking-tight" style={{ color: s.title }}>Crowns</div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] mt-1" style={{ color: '#d97706' }}>
          Your beta standing
        </div>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto">
        {/* Balance */}
        <div className="rounded-2xl p-4 text-center" style={{ background: s.balanceBg, border: s.balanceBorder }}>
          <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: s.muted }}>Your Crowns</div>
          <div className="text-4xl font-black flex items-center justify-center gap-2" style={{ color: '#f59e0b' }}>
            <span>👑</span>
            <span>{formatMoney(parseFloat(cashBalance || 0), 0)}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: s.body }}>
          Crowns are the currency of the <span className="font-bold" style={{ color: s.strong }}>Piks beta</span>. You
          earn them by winning battles, and whoever banks the <span className="font-bold" style={{ color: s.strong }}>most
          Crowns wins the beta</span>. It's the one leaderboard everyone's chasing.
        </p>

        {/* Weekly grand prize */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: isLight ? '#fffbeb' : 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(217,119,6,0.06))',
            border: '1px solid rgba(251,191,36,0.4)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-black uppercase tracking-wide" style={{ color: '#d97706' }}>$1,000 Every Week</span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: s.body }}>
            We run a fresh beta every week. The <span className="font-bold" style={{ color: s.strong }}>top capper of the
            week</span> — the player with the most Crowns — takes home a <span className="font-bold" style={{ color: s.strong }}>$1,000
            cash grand prize</span>. New week, new shot at it.
          </p>
        </div>

        {/* Real cash after beta */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: isLight ? '#ecfdf5' : 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.35)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">💵</span>
            <span className="text-sm font-black uppercase tracking-wide" style={{ color: isLight ? '#047857' : '#34d399' }}>Real Cash Is Coming</span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: s.body }}>
            When the beta ends, your <span className="font-bold" style={{ color: s.strong }}>Crowns convert to real
            cash</span> — and Piks opens up so you can deposit and play for real money. The Crowns you stack now are a
            head start.
          </p>
        </div>

        <button
          onClick={onCta}
          className="w-full py-3.5 rounded-xl font-black text-sm transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', color: '#1a1206', boxShadow: '0 0 24px rgba(251,191,36,0.4)' }}
        >
          View the Leaderboard →
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// CLASH COINS — stepped click-through walkthrough (esports orange/blue)
// ----------------------------------------------------------------------------
const COIN_STEPS = [
  {
    accent: '#fb923c',
    icon: '⚔️',
    title: 'What are Clash Coins?',
    body: (strong) => (
      <>
        Clash Coins are your <span style={strong}>in-battle ammo</span>. Every battle hands you a fresh stack —{' '}
        <span style={strong}>10,000</span> in Rush &amp; Original, <span style={strong}>100,000</span> in a Tournament.
        They only live inside that one battle.
      </>
    ),
  },
  {
    accent: '#3b82f6',
    icon: '🎯',
    title: 'Spend them on picks',
    body: (strong) => (
      <>
        Wager Clash Coins on your <span style={strong}>picks and live props</span> during the battle. Nail your reads
        and your stack grows; miss and it shrinks. It's all skill, no real money on the line.
      </>
    ),
  },
  {
    accent: '#22d3ee',
    icon: '📊',
    title: 'Most coins wins',
    body: (strong) => (
      <>
        When the clock runs out, whoever has the <span style={strong}>most Clash Coins</span> wins the battle. Your
        stack <span style={strong}>resets fresh</span> for every new matchup, so each one is a clean fight.
      </>
    ),
  },
  {
    accent: '#fbbf24',
    icon: '👑',
    title: 'Winner takes the Crowns',
    body: (strong) => (
      <>
        Clash Coins decide <span style={strong}>who wins</span> — the prize is <span style={strong}>Crowns</span>. The
        winner banks the combined Crowns pot, minus a small <span style={strong}>5% rake</span>. Crowns are your beta
        standing (tap the Crowns pill to learn more).
      </>
    ),
  },
];

function ClashCoinsView({ isLight, coinsBalance, matchup, opponent, step, setStep, onClose, onCta }) {
  const s = {
    card: isLight ? '#ffffff' : '#0a0a0a',
    cardBorder: isLight ? '1px solid rgba(251,146,60,0.4)' : '1px solid rgba(251,146,60,0.3)',
    title: isLight ? '#0f172a' : '#ffffff',
    body: isLight ? '#475569' : '#9ca3af',
    muted: isLight ? '#64748b' : '#6b7280',
    coinValue: isLight ? '#0f172a' : '#ffffff',
    chipBg: isLight ? '#fff7ed' : 'rgba(251,146,60,0.08)',
    chipBorder: isLight ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(251,146,60,0.22)',
    matchupBg: isLight ? '#f1f5f9' : '#0f0f0f',
    matchupBorder: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid #1f1f1f',
    navBorder: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.12)',
  };
  const strong = { color: isLight ? '#0f172a' : '#e5e7eb', fontWeight: 700 };

  const isLast = step === COIN_STEPS.length - 1;
  const current = COIN_STEPS[step];
  const mode = matchup ? getMode(matchup) : null;
  const modeMeta = mode ? MODE_LABELS[mode] : null;
  const payout = parseFloat(matchup?.winnerPayout ?? matchup?.potSize ?? 0);

  return (
    <div
      className="popup-content relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
      style={{ background: s.card, border: s.cardBorder, boxShadow: `0 0 40px rgba(251,146,60,${isLight ? '0.1' : '0.18'})`, maxHeight: '90vh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Visual scene */}
      <div
        className="relative flex flex-col items-center justify-center"
        style={{
          height: 150,
          background: `linear-gradient(160deg, ${current.accent}24 0%, ${current.accent}0a 55%, rgba(0,0,0,0) 100%)`,
          borderBottom: isLight ? '1px solid rgba(15,23,42,0.06)' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: s.muted }}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: '#101010', border: `2px solid ${current.accent}`, boxShadow: `0 0 22px ${current.accent}55` }}
        >
          {current.icon}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black" style={{ background: s.chipBg, border: s.chipBorder, color: '#fb923c' }}>
          <span>⚔</span>
          <span style={{ color: s.coinValue }}>{formatMoney(parseFloat(coinsBalance || 0), 0)}</span>
          <span style={{ color: s.muted, fontWeight: 600 }}>in this battle</span>
        </div>
      </div>

      {/* Copy */}
      <div className="px-6 pt-5 pb-1 overflow-y-auto">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: current.accent }}>
          Clash Coins · Step {step + 1} of {COIN_STEPS.length}
        </p>
        <h2 className="text-xl font-black mb-2" style={{ color: s.title }}>{current.title}</h2>
        <p className="text-[13.5px] leading-relaxed min-h-[72px]" style={{ color: s.body }}>
          {current.body(strong)}
        </p>

        {/* Live matchup prize, shown on the final step when in a battle */}
        {isLast && matchup && (
          <div className="rounded-lg p-3 mb-1 flex items-center justify-between" style={{ background: s.matchupBg, border: s.matchupBorder }}>
            <div className="flex items-center gap-2">
              {modeMeta && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: modeMeta.color }}>
                  {modeMeta.icon} {modeMeta.label}
                </span>
              )}
              <span className="text-xs" style={{ color: s.muted }}>vs {opponent?.username || 'Opponent'}</span>
            </div>
            {payout > 0 && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest" style={{ color: isLight ? '#b45309' : '#fcd34d' }}>Prize</div>
                <div className="text-sm font-bold" style={{ color: isLight ? '#b45309' : '#fbbf24' }}>👑 {formatMoney(payout, 0)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: dots + nav */}
      <div className="px-6 pb-6 pt-3">
        <div className="flex items-center justify-center gap-2 mb-4">
          {COIN_STEPS.map((st, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className="rounded-full transition-all"
              style={{ width: i === step ? 22 : 7, height: 7, backgroundColor: i === step ? current.accent : (isLight ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.18)') }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((p) => Math.max(p - 1, 0))}
              className="px-4 py-3 rounded-xl font-bold text-[14px] transition-colors"
              style={{ color: s.muted, border: s.navBorder }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onCta() : setStep((p) => Math.min(p + 1, COIN_STEPS.length - 1)))}
            className="flex-1 py-3 rounded-xl font-black text-[15px] transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #fb923c 0%, #c2410c 100%)', color: '#fff', boxShadow: '0 0 20px rgba(251,146,60,0.35)' }}
          >
            {isLast ? 'View My Battle' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
