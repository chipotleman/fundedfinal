export default function CasinoDepositMatchContainer() {
  const handleClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openChallengePopup'));
    }
  };

  return (
    <>
      <style>{`
        @keyframes casino-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes casino-chip-spin {
          0% {
            transform: translateY(20px) translateX(0) rotate(0deg);
            opacity: 0;
          }
          15% { opacity: 1; }
          100% {
            transform: translateY(-180px) translateX(var(--chip-x, 10px)) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes casino-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes casino-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.5), inset 0 0 30px rgba(250, 204, 21, 0.15); }
          50% { box-shadow: 0 0 45px rgba(250, 204, 21, 0.85), inset 0 0 50px rgba(220, 38, 38, 0.25); }
        }
        @keyframes casino-badge-spin {
          0% { transform: rotate(-8deg) scale(1); }
          50% { transform: rotate(-4deg) scale(1.07); }
          100% { transform: rotate(-8deg) scale(1); }
        }
        @keyframes casino-cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(250, 204, 21, 0.6); }
          50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(220, 38, 38, 0.85); }
        }
        @keyframes casino-headline-flash {
          0%, 100% { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(250,204,21,0.5)); }
          50% { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 18px rgba(250,204,21,0.95)); }
        }
        @keyframes casino-light-blink {
          0%, 49% { opacity: 1; box-shadow: 0 0 8px #facc15, 0 0 14px #facc15; }
          50%, 100% { opacity: 0.25; box-shadow: 0 0 4px #b45309; }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background:
            'linear-gradient(135deg, #1a0000 0%, #4a0a0a 20%, #7a1212 45%, #a8161a 65%, #4a0a0a 100%)',
          border: '2px solid rgba(250, 204, 21, 0.75)',
          animation: 'casino-glow-pulse 2.2s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label="Claim 100% deposit match"
      >
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 25% 20%, rgba(253, 224, 71, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(220, 38, 38, 0.55) 0%, transparent 55%)',
          }}
        />

        <div className="absolute inset-0 pointer-events-none z-0">
          {[...Array(14)].map((_, i) => (
            <div
              key={`light-${i}`}
              className="absolute rounded-full"
              style={{
                width: '5px',
                height: '5px',
                left: `${4 + i * 7}%`,
                top: '6px',
                background: i % 2 === 0 ? '#facc15' : '#fde68a',
                animation: `casino-light-blink 0.9s ease-in-out infinite`,
                animationDelay: `${(i % 4) * 0.22}s`,
              }}
            />
          ))}
          {[...Array(14)].map((_, i) => (
            <div
              key={`light-b-${i}`}
              className="absolute rounded-full"
              style={{
                width: '5px',
                height: '5px',
                left: `${4 + i * 7}%`,
                bottom: '6px',
                background: i % 2 === 1 ? '#facc15' : '#fde68a',
                animation: `casino-light-blink 0.9s ease-in-out infinite`,
                animationDelay: `${(i % 4) * 0.22 + 0.45}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <div
              key={`chip-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${12 + (i % 3) * 5}px`,
                height: `${12 + (i % 3) * 5}px`,
                left: `${5 + i * 9.5}%`,
                bottom: '-12px',
                background:
                  i % 3 === 0
                    ? 'radial-gradient(circle at 30% 30%, #fde68a 0%, #facc15 45%, #b45309 100%)'
                    : i % 3 === 1
                      ? 'radial-gradient(circle at 30% 30%, #fecaca 0%, #ef4444 45%, #7f1d1d 100%)'
                      : 'radial-gradient(circle at 30% 30%, #f5f5f5 0%, #d4d4d4 45%, #404040 100%)',
                boxShadow:
                  '0 0 10px rgba(250, 204, 21, 0.7), inset 0 -2px 3px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.25)',
                animation: `casino-chip-spin ${3 + (i % 4) * 0.6}s linear infinite`,
                animationDelay: `${i * 0.35}s`,
                ['--chip-x']: `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 6)}px`,
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
                top: `${15 + (i * 13) % 70}%`,
                background: '#fef9c3',
                borderRadius: '50%',
                boxShadow: '0 0 8px #fde68a, 0 0 16px #facc15',
                animation: `casino-sparkle ${1.4 + (i % 4) * 0.5}s ease-in-out infinite`,
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
                'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
              animation: 'casino-shimmer 3s ease-in-out infinite',
            }}
          />
        </div>

        <div
          className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-1 md:px-3 md:py-1.5 rounded-md z-20"
          style={{
            background: 'linear-gradient(135deg, #facc15 0%, #dc2626 100%)',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.7)',
            animation: 'casino-badge-spin 1.8s ease-in-out infinite',
            transformOrigin: 'center',
          }}
        >
          <span className="text-[9px] md:text-[11px] font-black uppercase tracking-wider text-amber-50">
            🎰 Hot Offer
          </span>
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 md:px-6 text-center">
          <div
            className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] mb-0.5 md:mb-1"
            style={{
              color: '#fef3c7',
              textShadow: '0 1px 2px rgba(0,0,0,0.7)',
            }}
          >
            Double Your Deposit
          </div>

          <div
            className="text-2xl md:text-5xl font-black leading-none"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #fff7d6 0%, #fde68a 30%, #facc15 60%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'casino-headline-flash 1.8s ease-in-out infinite',
              letterSpacing: '0.03em',
            }}
          >
            100% MATCH
          </div>

          <div
            className="text-xs md:text-base font-bold mt-0.5 md:mt-1"
            style={{
              color: '#fff7d6',
              textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}
          >
            Deposit <span className="text-yellow-300">$50</span>, Play With <span className="text-yellow-300">$100</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="mt-1.5 md:mt-3 px-5 md:px-8 py-1.5 md:py-2.5 rounded-xl font-black text-xs md:text-base uppercase tracking-wider relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #fde047 0%, #facc15 40%, #dc2626 100%)',
              color: '#3f0a0a',
              border: '1.5px solid rgba(255, 247, 214, 0.8)',
              animation: 'casino-cta-pulse 1.5s ease-in-out infinite',
              textShadow: '0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <span className="relative z-10">Deposit Now →</span>
          </button>
        </div>
      </div>
    </>
  );
}
