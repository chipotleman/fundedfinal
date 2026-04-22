import { useSession } from 'next-auth/react';

export default function ReferralBonusContainer() {
  const { status } = useSession();

  if (status !== 'authenticated') return null;

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openChallengePopup'));
    }
  };

  return (
    <>
      <style>{`
        @keyframes referral-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes referral-coin-float {
          0% { transform: translateY(20px) translateX(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-180px) translateX(var(--coin-x, 10px)) rotate(360deg); opacity: 0; }
        }
        @keyframes referral-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes referral-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.5), inset 0 0 30px rgba(250, 204, 21, 0.1); }
          50% { box-shadow: 0 0 40px rgba(250, 204, 21, 0.8), inset 0 0 50px rgba(250, 204, 21, 0.2); }
        }
        @keyframes referral-badge-bob {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(-3deg) scale(1.05); }
        }
        @keyframes referral-cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(250, 204, 21, 0.5); }
          50% { transform: scale(1.04); box-shadow: 0 6px 28px rgba(250, 204, 21, 0.8); }
        }
        @media (hover: hover) {
          .referral-card:hover { transform: scale(1.02); }
        }
        .referral-card:active { transform: scale(0.98); }
      `}</style>

      <div
        className="referral-card w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(135deg, #2d1b00 0%, #5a3a00 20%, #8a5d00 45%, #b8830d 70%, #6b4500 100%)',
          border: '2px solid rgba(250, 204, 21, 0.6)',
          animation: 'referral-glow-pulse 2.5s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label="Refer a friend and earn fifty dollars"
      >
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(253, 224, 71, 0.4) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(217, 119, 6, 0.5) 0%, transparent 55%)',
          }}
        />

        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <div
              key={`coin-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${10 + (i % 3) * 4}px`,
                height: `${10 + (i % 3) * 4}px`,
                left: `${5 + i * 9.5}%`,
                bottom: '-10px',
                background:
                  'radial-gradient(circle at 30% 30%, #fde68a 0%, #facc15 45%, #b45309 100%)',
                boxShadow: '0 0 8px rgba(250, 204, 21, 0.8), inset 0 -2px 3px rgba(120, 53, 15, 0.6)',
                animation: `referral-coin-float ${3 + (i % 4) * 0.6}s linear infinite`,
                animationDelay: `${i * 0.35}s`,
                ['--coin-x']: `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 6)}px`,
              }}
            />
          ))}
          {[...Array(14)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                width: `${3 + (i % 3) * 2}px`,
                height: `${3 + (i % 3) * 2}px`,
                left: `${(i * 7.5) % 100}%`,
                top: `${(i * 13) % 90}%`,
                background: '#fef9c3',
                borderRadius: '50%',
                boxShadow: '0 0 8px #fde68a, 0 0 16px #facc15',
                animation: `referral-sparkle ${1.5 + (i % 4) * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>

        <div
          className="absolute inset-0 overflow-hidden pointer-events-none z-0"
          style={{ mixBlendMode: 'overlay' }}
        >
          <div
            className="absolute top-0 left-0 h-full w-1/3"
            style={{
              background:
                'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
              animation: 'referral-shimmer 3.5s ease-in-out infinite',
            }}
          />
        </div>

        <div
          className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-1 md:px-3 md:py-1.5 rounded-md z-20"
          style={{
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.6)',
            animation: 'referral-badge-bob 2s ease-in-out infinite',
            transformOrigin: 'center',
          }}
        >
          <span className="text-[9px] md:text-[11px] font-black uppercase tracking-wider text-amber-950">
            🎁 Invite Friends
          </span>
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 md:px-6 text-center">
          <div
            className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-0.5 md:mb-1"
            style={{ color: '#fef3c7', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
          >
            Refer &amp; Earn
          </div>

          <div
            className="text-2xl md:text-5xl font-black leading-none"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #fff7d6 0%, #fde68a 35%, #facc15 65%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              letterSpacing: '0.02em',
            }}
          >
            $50 EACH
          </div>

          <div
            className="text-xs md:text-base font-bold mt-0.5 md:mt-1"
            style={{ color: '#fff7d6', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          >
            You both get <span className="text-yellow-300">$50 Free</span> when they deposit
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="mt-1.5 md:mt-3 px-5 md:px-8 py-1.5 md:py-2.5 rounded-xl font-black text-xs md:text-base uppercase tracking-wider relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #fde047 0%, #facc15 40%, #f59e0b 100%)',
              color: '#3f1d00',
              border: '1.5px solid rgba(255, 247, 214, 0.7)',
              animation: 'referral-cta-pulse 1.6s ease-in-out infinite',
              textShadow: '0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <span className="relative z-10">Invite a Friend →</span>
          </button>
        </div>
      </div>
    </>
  );
}
