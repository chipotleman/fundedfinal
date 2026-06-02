import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

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
      style={{ backgroundColor: '#101010', border: `2px solid ${color}`, boxShadow: `0 0 22px ${color}40` }}
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
      style={{ backgroundColor: '#101010', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-bold" style={{ color: '#e5e7eb' }}>{name}</span>
      </span>
      <span className="text-[12px] font-bold" style={{ color: C.gold }}>{coins}</span>
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
        style={{ background: `radial-gradient(circle at 50% 35%, ${C.emerald}33, #101010 70%)`, border: `2px solid ${C.emerald}` }}
      >
        <span className="text-4xl">🏆</span>
      </div>
      <span className="mt-3 text-[12px] font-bold" style={{ color: C.gold }}>Winner takes the pot · −5% rake</span>
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
            style={{ backgroundColor: '#101010', border: `2px solid ${c}`, zIndex: 10 - i }}
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
        <strong style={{ color: '#e5e7eb' }}>Quick Match</strong> against a random opponent,{' '}
        <strong style={{ color: '#e5e7eb' }}>Play a Friend</strong>, or set up a{' '}
        <strong style={{ color: '#e5e7eb' }}>Private Match</strong> with your own invite.
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
        <strong style={{ color: '#e5e7eb' }}>Rush</strong> — 6 fast live-game props, race the clock.{' '}
        <strong style={{ color: '#e5e7eb' }}>Original</strong> — full slate of the day, highest balance wins.{' '}
        <strong style={{ color: '#e5e7eb' }}>Tournament</strong> — a 3-day battle for the big pot.
      </>
    ),
    Visual: VisualModes,
  },
  {
    accent: C.emerald,
    eyebrow: 'Step 3',
    title: 'Win the pot',
    body: (
      <>
        The winner takes the combined pot, minus a small{' '}
        <strong style={{ color: '#e5e7eb' }}>5% rake</strong>. Climb the leaderboard and build your record
        battle by battle.
      </>
    ),
    Visual: VisualWin,
  },
  {
    accent: C.orange,
    eyebrow: 'Step 4',
    title: 'Build your name',
    body: (
      <>
        Every battle you win builds your <strong style={{ color: '#e5e7eb' }}>reputation</strong>. Stack wins,
        climb the leaderboard, and make a <strong style={{ color: '#e5e7eb' }}>name for yourself</strong> across
        the league.
      </>
    ),
    Visual: VisualBeyond,
  },
];

export default function HowItWorksModal({ open, onClose }) {
  const router = useRouter();
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

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-allow-fixed-overlay="true"
      role="dialog"
      aria-modal="true"
      aria-label="How Piks works"
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-3xl"
        style={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Visual panel */}
        <div
          className="relative flex items-center justify-center px-6"
          style={{
            height: 188,
            background: `linear-gradient(160deg, ${current.accent}24 0%, ${current.accent}0d 55%, rgba(0,0,0,0) 100%)`,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full lg:hover:bg-white/10 transition-colors"
            aria-label="Close"
            style={{ color: '#9ca3af' }}
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
          <h2 className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>
            {step + 1}. {current.title}
          </h2>
          <p className="text-[13.5px] leading-relaxed min-h-[66px]" style={{ color: '#9ca3af' }}>
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
                  backgroundColor: i === step ? current.accent : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="px-4 py-3 rounded-xl font-bold text-[14px] transition-colors lg:hover:bg-white/5"
                style={{ color: '#9ca3af', border: '1px solid rgba(255,255,255,0.12)' }}
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
  );
}
