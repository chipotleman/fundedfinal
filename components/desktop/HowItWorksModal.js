import { useEffect } from 'react';
import { useRouter } from 'next/router';

// =============================================================================
// HowItWorksModal — desktop "How it works" popup launched from the top bar.
// Explains the core Piks loop (pick a battle, choose a mode, win the pot) plus
// the multiplayer Pik Pools and capper marketplace. On-brand: dark glass card,
// blue/emerald/cyan/orange accents, NO purple. Tagged
// data-allow-fixed-overlay so the click-trap watchdog never removes it.
// =============================================================================
const accent = {
  blue: '#3b82f6',
  emerald: '#10b981',
  cyan: '#22d3ee',
  orange: '#fb923c',
  gold: '#fbbf24',
};

function Step({ index, color, title, children }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-black flex-shrink-0"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          {index}
        </span>
        <h3 className="text-[15px] font-bold" style={{ color: '#f5f5f5' }}>{title}</h3>
      </div>
      <div className="text-[13px] leading-relaxed pl-10" style={{ color: '#9ca3af' }}>
        {children}
      </div>
    </div>
  );
}

function ModeRow({ color, name, coins, desc }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span>
        <span className="font-bold" style={{ color: '#e5e7eb' }}>{name}</span>
        <span className="font-semibold" style={{ color: accent.gold }}> · {coins}</span>
        <span> — {desc}</span>
      </span>
    </div>
  );
}

export default function HowItWorksModal({ open, onClose }) {
  const router = useRouter();

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

  const goStartBattle = () => {
    onClose();
    router.push('/dashboard');
  };

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
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto rounded-3xl"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="relative px-6 pt-6 pb-5"
          style={{
            background: `linear-gradient(135deg, ${accent.blue}1a 0%, ${accent.cyan}12 50%, ${accent.emerald}12 100%)`,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
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
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: accent.blue }}>
            Welcome to Piks
          </p>
          <h2 className="text-2xl font-black" style={{ color: '#ffffff' }}>How it works</h2>
          <p className="text-[13px] mt-1.5" style={{ color: '#9ca3af' }}>
            Go head-to-head in real-time sports betting battles. Outpick your opponent, take the pot.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <Step index="1" color={accent.blue} title="Pick your battle">
            Jump into a <strong style={{ color: '#e5e7eb' }}>Quick Match</strong> against a random opponent,
            <strong style={{ color: '#e5e7eb' }}> Play a Friend</strong>, or set up a
            <strong style={{ color: '#e5e7eb' }}> Private Match</strong> with your own invite.
          </Step>

          <Step index="2" color={accent.cyan} title="Choose a mode">
            <div className="space-y-1.5">
              <ModeRow color={accent.blue} name="Rush" coins="10,000 coins" desc="6 fast live-game props, race the clock — most correct wins." />
              <ModeRow color={accent.emerald} name="Original" coins="10,000 coins" desc="full slate of the day's games, highest balance wins." />
              <ModeRow color={accent.orange} name="Tournament" coins="100,000 coins" desc="a 3-day battle for the big pot." />
            </div>
          </Step>

          <Step index="3" color={accent.emerald} title="Win the pot">
            The winner takes the combined pot, minus a small 5% rake. Climb the leaderboard and
            build your record battle by battle.
          </Step>

          <Step index="4" color={accent.orange} title="Go beyond 1v1">
            Join multiplayer <strong style={{ color: '#e5e7eb' }}>Pik Pools</strong> to compete against the
            whole league, or visit the <strong style={{ color: '#e5e7eb' }}>marketplace</strong> to follow
            verified cappers and their picks.
          </Step>
        </div>

        {/* Footer CTA */}
        <div className="px-6 pb-6 pt-1">
          <button
            type="button"
            onClick={goStartBattle}
            className="w-full py-3 rounded-xl font-bold text-[15px] transition-transform lg:hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${accent.blue}, #2563eb)`, color: '#ffffff' }}
          >
            Start a battle
          </button>
        </div>
      </div>
    </div>
  );
}
