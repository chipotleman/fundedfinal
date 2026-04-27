import { useRouter } from 'next/router';
import useRushAvailability from '../hooks/useRushAvailability';
import haptic from '../utils/haptics';

// Dashboard promo container that explains the new Rush battle mode
// to users who haven't tried it yet. Lives in the same horizontal
// promo slot as the other dashboard cards (DepositMatchContainer,
// TrendingBetContainer, etc.) and matches their dimensions exactly:
//
//   mobile : w-[calc(100vw-32px)]  h-[140px]
//   desktop: w-[864px]              h-[180px]
//
// Visual language follows the rest of the app's "premium cartoon"
// system per user prefs:
//   * No purple gradients — Rush is orange (#f59e0b / #d97706).
//   * Chunky 2px black-ish border + subtle inner glow that matches
//     the animated MostSharedBadgeContainer it replaces, so the
//     whole promo row reads as one consistent component family.
//   * Hover effects gated behind @media (hover: hover) so iPad /
//     phone don't render a sticky-looking hover state.
//
// The container also surfaces live-now availability via the shared
// useRushAvailability hook — when a live game is in progress, a
// pulsing "LIVE NOW" eyebrow appears on the right and the whole
// card glows orange. When no live game is available, the eyebrow
// reads "NEW MODE" so the card is still useful as marketing.
//
// Tapping the card sends the user to /battle, which is where every
// Rush entry-point modal (QuickMatchModal, PlayFriendModal,
// PrivateMatchModal, PreMatchPopup) lives.
export default function RushExplainerContainer() {
  const router = useRouter();
  const rushLive = useRushAvailability(true) === true;

  const handleClick = () => {
    haptic.tap && haptic.tap();
    router.push('/battle');
  };

  // Three "how it works" steps — kept short enough to fit in the
  // 140px-tall mobile card without truncation. Each step has a
  // sticker-style emoji that matches the cartoon language.
  const steps = [
    { icon: '⚡', label: 'Pick 6 props', sub: 'from one live game' },
    { icon: '💰', label: '10,000 coins', sub: 'starting bankroll' },
    { icon: '🏆', label: 'Highest wins', sub: 'live ends → winner' },
  ];

  return (
    <>
      <style>{`
        @keyframes rushexp-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(245,158,11,0.20), inset 0 0 20px rgba(245,158,11,0.06); }
          50%      { box-shadow: 0 0 30px rgba(245,158,11,0.40), inset 0 0 28px rgba(245,158,11,0.12); }
        }
        @keyframes rushexp-glow-live {
          0%, 100% { box-shadow: 0 0 22px rgba(245,158,11,0.35), inset 0 0 24px rgba(245,158,11,0.10); }
          50%      { box-shadow: 0 0 38px rgba(245,158,11,0.65), inset 0 0 36px rgba(245,158,11,0.18); }
        }
        @keyframes rushexp-pulse-dot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes rushexp-bolt-sway {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50%      { transform: rotate(6deg)  translateY(-2px); }
        }
        @keyframes rushexp-fade-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
        @media (hover: hover) {
          .rushexp-card:hover { transform: scale(1.01); }
        }
        .rushexp-card:active { transform: scale(0.985); }
        @media (prefers-reduced-motion: reduce) {
          .rushexp-card,
          .rushexp-bolt,
          .rushexp-dot,
          .rushexp-fade { animation: none !important; }
        }
      `}</style>

      <div
        className="rushexp-card w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background:
            'linear-gradient(135deg, #0a0a14 0%, #1a1108 35%, #21160a 65%, #0a0a14 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.45)',
          animation: `${rushLive ? 'rushexp-glow-live' : 'rushexp-glow'} 3s ease-in-out infinite`,
        }}
        onClick={handleClick}
        onKeyDown={(e) => {
          // Native keyboard activation for the role="button" root —
          // Enter and Space should both fire the click handler so
          // keyboard users get the same affordance as pointer users.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Rush — new battle mode. Tap to learn more and start a match."
      >
        {/* Background sheen — orange in the top-left where the eyebrow
            sits, faint cyan in the opposite corner so the card has
            depth without leaning monochrome. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 12% 18%, rgba(245,158,11,0.22) 0%, transparent 55%), radial-gradient(ellipse at 88% 92%, rgba(6,182,212,0.12) 0%, transparent 60%)',
          }}
        />

        {/* Top-left eyebrow: live pulse dot + "RUSH" + secondary tag */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 z-20">
          <span
            className="rushexp-dot block w-1.5 h-1.5 rounded-full bg-amber-300"
            style={{ animation: 'rushexp-pulse-dot 1.6s ease-in-out infinite' }}
          />
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            Rush
          </span>
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/45">
            new mode
          </span>
        </div>

        {/* Top-right status badge: "LIVE NOW" when a live game exists,
            otherwise a quieter "TAP TO PLAY" prompt so the card still
            has a clear call to action when Rush isn't immediately
            startable. */}
        <div className="absolute top-2 right-2 md:top-3 md:right-3 z-20">
          {rushLive ? (
            <span
              className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                color: '#fff',
                border: '1px solid rgba(0,0,0,0.35)',
                boxShadow: '0 1px 0 rgba(0,0,0,0.45)',
              }}
            >
              <span
                className="rushexp-dot block w-1.5 h-1.5 rounded-full bg-white"
                style={{ animation: 'rushexp-pulse-dot 1.2s ease-in-out infinite' }}
              />
              Live now
            </span>
          ) : (
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/55">
              Tap to play
            </span>
          )}
        </div>

        {/* Body: lightning bolt sticker on the left + 3 explainer
            steps on the right. Mirrors the 3-column layout of the
            MostShared container so the promo row stays visually
            balanced when this card is in rotation. */}
        <div
          className="rushexp-fade relative z-10 h-full flex items-center px-3 md:px-6 pt-7 md:pt-8 pb-3 md:pb-4 gap-3 md:gap-5"
          style={{ animation: 'rushexp-fade-in 360ms ease-out both' }}
        >
          {/* Lightning sticker — chunky black-bordered orange disc
              with a swaying bolt for the cartoon feel. */}
          <div
            className="rushexp-bolt flex-shrink-0 flex items-center justify-center rounded-2xl"
            style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(180deg,#fbbf24,#d97706)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
              fontSize: 30,
              lineHeight: 1,
              animation: 'rushexp-bolt-sway 2.4s ease-in-out infinite',
            }}
            aria-hidden="true"
          >
            ⚡
          </div>

          <div className="flex-1 min-w-0">
            {/* Headline — kept short so it never wraps on mobile. */}
            <div className="text-sm md:text-base font-black text-white leading-tight">
              The fastest way to battle.
            </div>

            {/* Step row */}
            <div className="flex items-center gap-2 md:gap-4 mt-1.5 md:mt-2">
              {steps.map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 md:gap-2 min-w-0"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center rounded-lg"
                    style={{
                      width: 24,
                      height: 24,
                      background: 'rgba(245,158,11,0.18)',
                      border: '1.5px solid rgba(245,158,11,0.55)',
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >
                    {s.icon}
                  </span>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-amber-100 truncate">
                      {s.label}
                    </span>
                    <span className="text-[8px] md:text-[10px] font-medium text-white/55 truncate">
                      {s.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
