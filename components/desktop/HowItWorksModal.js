import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useTheme } from '../../contexts/ThemeContext';

// =============================================================================
// HowItWorksModal — desktop "How it works" walkthrough, Polymarket-style: one
// step per slide with a visual panel up top, a numbered title + description,
// dot progress indicators, and Back / Next (Get Started on the last step).
// On-brand dark glass, blue/emerald/cyan/orange accents, NO purple. Tagged
// data-allow-fixed-overlay so the click-trap watchdog never removes it.
// =============================================================================
const C = {
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  emerald: '#10b981',
  cyan: '#22d3ee',
  orange: '#fb923c',
  gold: '#fbbf24',
};

// ---- Per-step visual scenes -------------------------------------------------
function VisualBattle() {
  const tile = (label, color, emoji) => (
    <div
      className="flex flex-col items-center justify-center rounded-2xl w-24 h-24"
      style={{ backgroundColor: 'var(--hiw-tile-bg)', border: `2px solid ${color}`, boxShadow: `0 0 22px ${color}40` }}
    >
      <span className="text-3xl leading-none mb-1">{emoji}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-4">
      {tile('You', C.blue, '🫵')}
      <span className="text-xl font-black italic" style={{ color: '#6b7280' }}>VS</span>
      {tile('Opp', C.orange, '🎯')}
    </div>
  );
}

function VisualModes() {
  const row = (name, coins, color) => (
    <div
      className="flex items-center justify-between w-full rounded-xl px-3 py-2"
      style={{ backgroundColor: 'var(--hiw-tile-bg)', border: '1px solid var(--hiw-tile-border)' }}
    >
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-bold" style={{ color: 'var(--hiw-strong)' }}>{name}</span>
      </span>
      <span className="text-[12px] font-bold" style={{ color: C.orange }}>⚔ {coins}</span>
    </div>
  );
  return (
    <div className="w-full max-w-[260px] mx-auto space-y-2">
      {row('Rush', '10K', C.blue)}
      {row('Original', '10K', C.emerald)}
      {row('Tournament', '100K', C.orange)}
    </div>
  );
}

function VisualWin() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="flex items-center justify-center w-24 h-24 rounded-full"
        style={{ background: `radial-gradient(circle at 50% 35%, ${C.emerald}33, var(--hiw-tile-bg) 70%)`, border: `2px solid ${C.emerald}` }}
      >
        <span className="text-4xl">🏆</span>
      </div>
      <span className="mt-3 text-[12px] font-bold" style={{ color: C.gold }}>Winner takes the Crowns · −5% rake</span>
    </div>
  );
}

function VisualBeta() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="flex items-center justify-center px-5 h-20 rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${C.gold}33, rgba(217,119,6,0.12))`, border: `2px solid ${C.gold}`, boxShadow: `0 0 26px ${C.gold}40` }}
      >
        <span className="text-3xl mr-2">🏆</span>
        <span className="text-3xl font-black" style={{ color: C.gold }}>$1,000</span>
      </div>
      <span className="mt-3 text-[12px] font-bold" style={{ color: C.gold }}>Top capper of the week · every week</span>
    </div>
  );
}

function VisualBeyond() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center -space-x-3">
        {['#3b82f6', '#22d3ee', '#10b981', '#fb923c'].map((c, i) => (
          <span
            key={c}
            className="flex items-center justify-center w-12 h-12 rounded-full text-lg"
            style={{ backgroundColor: 'var(--hiw-tile-bg)', border: `2px solid ${c}`, zIndex: 10 - i }}
          >
            {['🔥', '⚡', '💎', '🏆'][i]}
          </span>
        ))}
      </div>
      <span className="mt-3 text-[12px] font-bold" style={{ color: C.cyan }}>Climb the ranks · Build your name</span>
    </div>
  );
}

const STEPS = [
  {
    accent: C.blue,
    eyebrow: 'Welcome to Piks',
    title: 'Pick your battle',
    body: (
      <>
        Go head-to-head in real-time sports betting battles. Jump into a{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Quick Match</strong> against a random opponent,{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Play a Friend</strong>, or set up a{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Private Match</strong> with your own invite.
      </>
    ),
    Visual: VisualBattle,
  },
  {
    accent: C.cyan,
    eyebrow: 'Step 2',
    title: 'Choose a mode',
    body: (
      <>
        You start every battle with a stack of <strong style={{ color: 'var(--hiw-strong)' }}>Clash Coins</strong>.{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Rush</strong> — 6 fast live-game props, race the clock.{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Original</strong> — full slate of the day, most Clash Coins wins.{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>Tournament</strong> — a 3-day battle for the big pot.
      </>
    ),
    Visual: VisualModes,
  },
  {
    accent: C.emerald,
    eyebrow: 'Step 3',
    title: 'Win the Crowns',
    body: (
      <>
        The winner banks the combined <strong style={{ color: 'var(--hiw-strong)' }}>Crowns</strong> pot, minus a small{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>5% rake</strong>. Crowns are the currency of the beta — whoever holds the{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>most Crowns wins the beta</strong>.
      </>
    ),
    Visual: VisualWin,
  },
  {
    accent: C.gold,
    eyebrow: 'Step 4',
    title: 'Weekly beta · $1,000 prize',
    body: (
      <>
        We run a fresh beta <strong style={{ color: 'var(--hiw-strong)' }}>every week</strong> with a{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>$1,000 cash grand prize</strong> — the{' '}
        <strong style={{ color: 'var(--hiw-strong)' }}>top capper of the week</strong> takes it home. And once the beta ends, your
        Crowns <strong style={{ color: 'var(--hiw-strong)' }}>convert to real cash</strong> and you'll be able to play for real money.
      </>
    ),
    Visual: VisualBeta,
  },
  {
    accent: C.orange,
    eyebrow: 'Step 5',
    title: 'Build your name',
    body: (
      <>
        Every battle you win builds your <strong style={{ color: 'var(--hiw-strong)' }}>reputation</strong>. Stack wins,
        climb the leaderboard, and make a <strong style={{ color: 'var(--hiw-strong)' }}>name for yourself</strong> across
        the league.
      </>
    ),
    Visual: VisualBeyond,
  },
];

export default function HowItWorksModal({ open, onClose }) {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const t = isLight
    ? {
        backdrop: 'rgba(15,23,42,0.45)',
        modalBg: '#ffffff',
        modalBorder: '1px solid #e7e0d3',
        modalShadow: '0 24px 70px rgba(15,23,42,0.22)',
        panelBorder: '1px solid rgba(15,23,42,0.08)',
        closeIcon: '#475569',
        title: '#0f172a',
        body: '#475569',
        dotTrack: 'rgba(15,23,42,0.18)',
        backText: '#475569',
        backBorder: '1px solid rgba(15,23,42,0.15)',
        strong: '#0f172a',
        tileBg: '#f5f1ea',
        tileBorder: 'rgba(15,23,42,0.1)',
      }
    : {
        backdrop: 'rgba(0,0,0,0.78)',
        modalBg: '#0a0a0a',
        modalBorder: '1px solid rgba(255,255,255,0.1)',
        modalShadow: '0 24px 70px rgba(0,0,0,0.7)',
        panelBorder: '1px solid rgba(255,255,255,0.06)',
        closeIcon: '#9ca3af',
        title: '#ffffff',
        body: '#9ca3af',
        dotTrack: 'rgba(255,255,255,0.18)',
        backText: '#9ca3af',
        backBorder: '1px solid rgba(255,255,255,0.12)',
        strong: '#e5e7eb',
        tileBg: '#101010',
        tileBorder: 'rgba(255,255,255,0.08)',
      };
  const [step, setStep] = useState(0);

  // Reset to the first slide only when the modal transitions open. This must
  // depend on `open` alone — callers pass an inline `onClose` arrow whose
  // identity changes on every parent re-render (the dashboard/top-nav re-render
  // constantly from polling + SSE), so including it here would re-fire this
  // effect mid-walkthrough and yank the user back to slide 1.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal to document.body so the fixed overlay isn't trapped by a
  // transformed/animated ancestor (TopNavbar lives inside containers that
  // can establish a containing block for `position: fixed`). Otherwise the
  // walkthrough renders inside that container on mobile instead of covering
  // the viewport.
  if (typeof document === 'undefined') return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const { Visual } = current;

  const next = () => {
    if (isLast) {
      onClose();
      router.push('/dashboard');
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return createPortal((
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ backgroundColor: t.backdrop, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-allow-fixed-overlay="true"
      role="dialog"
      aria-modal="true"
      aria-label="How Piks works"
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-3xl"
        style={{
          backgroundColor: t.modalBg,
          border: t.modalBorder,
          boxShadow: t.modalShadow,
          '--hiw-strong': t.strong,
          '--hiw-tile-bg': t.tileBg,
          '--hiw-tile-border': t.tileBorder,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Visual panel */}
        <div
          className="relative flex items-center justify-center px-6"
          style={{
            height: 188,
            background: `linear-gradient(160deg, ${current.accent}24 0%, ${current.accent}0d 55%, rgba(0,0,0,0) 100%)`,
            borderBottom: t.panelBorder,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full lg:hover:bg-white/10 transition-colors"
            aria-label="Close"
            style={{ color: t.closeIcon }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <Visual />
        </div>

        {/* Copy */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: current.accent }}>
            {current.eyebrow}
          </p>
          <h2 className="text-xl font-black mb-2" style={{ color: t.title }}>
            {step + 1}. {current.title}
          </h2>
          <p className="text-[13.5px] leading-relaxed min-h-[66px]" style={{ color: t.body }}>
            {current.body}
          </p>
        </div>

        {/* Footer: dots + nav */}
        <div className="px-6 pb-6 pt-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            {STEPS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 22 : 7,
                  height: 7,
                  backgroundColor: i === step ? current.accent : t.dotTrack,
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="px-4 py-3 rounded-xl font-bold text-[14px] transition-colors"
                style={{ color: t.backText, border: t.backBorder }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex-1 py-3 rounded-xl font-bold text-[15px] transition-transform lg:hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${C.blue}, #2563eb)`, color: '#ffffff' }}
            >
              {isLast ? 'Start a battle' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
