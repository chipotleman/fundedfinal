import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import UserAvatar from './UserAvatar';

const FALLBACK_NAMES = [
  'Ace', 'Blitz', 'Cobra', 'Dash', 'Echo', 'Falcon', 'Ghost', 'Hawk',
  'Iron', 'Jett', 'King', 'Lynx', 'Maverick', 'Nova', 'Onyx', 'Phantom',
  'Quick', 'Rebel', 'Saint', 'Titan', 'Vortex', 'Wolf', 'Zen',
];

function buildFallbackPool() {
  return FALLBACK_NAMES.map((n, i) => ({
    id: `fallback-${i}`,
    username: n,
    avatar: null,
  }));
}

export default function FindOpponentContainer() {
  const router = useRouter();
  const [pool, setPool] = useState(buildFallbackPool());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/battles/recent?limit=10')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.battles?.length) return;
        const seen = new Set();
        const players = [];
        for (const b of data.battles) {
          for (const p of [b.winner, b.loser]) {
            if (p && p.id && !seen.has(p.id)) {
              seen.add(p.id);
              players.push({ id: p.id, username: p.username, avatar: p.avatar });
            }
          }
        }
        if (players.length >= 3) setPool(players);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    const out = [];
    const n = pool.length;
    if (n === 0) return out;
    for (let i = 0; i < 5; i += 1) {
      out.push(pool[(tick + i) % n]);
    }
    return out;
  }, [pool, tick]);

  const handleClick = () => {
    router.push('/battle');
  };

  return (
    <>
      <style>{`
        @keyframes find-opponent-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(59, 130, 246, 0.35), inset 0 0 24px rgba(59, 130, 246, 0.08); }
          50% { box-shadow: 0 0 32px rgba(59, 130, 246, 0.55), inset 0 0 40px rgba(59, 130, 246, 0.15); }
        }
        @keyframes find-opponent-radar {
          0% { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes find-opponent-cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 18px rgba(59, 130, 246, 0.45); }
          50% { transform: scale(1.04); box-shadow: 0 6px 26px rgba(59, 130, 246, 0.7); }
        }
        @keyframes find-opponent-avatar-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.85); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes find-opponent-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] active:scale-[0.98] hover:scale-[1.01]"
        style={{
          background:
            'linear-gradient(135deg, #06121f 0%, #0c1e35 35%, #0a1830 65%, #050d1a 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.45)',
          animation: 'find-opponent-glow 2.6s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label="Find an opponent"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 25% 30%, rgba(59,130,246,0.25) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(249,115,22,0.18) 0%, transparent 55%)',
          }}
        />

        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 z-20">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{
                background: 'rgba(59, 130, 246, 0.7)',
                animation: 'find-opponent-radar 1.6s ease-out infinite',
              }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: '#3b82f6' }}
            />
          </span>
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-blue-300">
            Live Matchmaking
          </span>
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 md:px-6 text-center">
          <div
            className="text-[10px] md:text-xs font-black uppercase tracking-[0.18em] mb-1 md:mb-1.5"
            style={{ color: '#cfe1ff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
          >
            Find an Opponent
          </div>

          <div className="flex items-center justify-center gap-1.5 md:gap-3 mb-1.5 md:mb-3">
            {visible.slice(0, 2).map((p, i) => (
              <div
                key={`l-${p.id}-${tick}-${i}`}
                style={{ animation: 'find-opponent-avatar-in 380ms ease-out both' }}
              >
                <UserAvatar size={i === 1 ? 36 : 28} user={p} />
              </div>
            ))}

            <div
              className="mx-1 md:mx-2 text-base md:text-2xl font-black"
              style={{
                color: '#fbbf24',
                textShadow: '0 1px 6px rgba(251, 191, 36, 0.6)',
                animation: 'find-opponent-vs-pulse 1.2s ease-in-out infinite',
              }}
            >
              VS
            </div>

            {visible.slice(2, 5).map((p, i) => (
              <div
                key={`r-${p.id}-${tick}-${i}`}
                style={{ animation: 'find-opponent-avatar-in 380ms ease-out both' }}
              >
                <UserAvatar size={i === 0 ? 36 : 28} user={p} />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-5 md:px-8 py-1.5 md:py-2.5 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider"
            style={{
              background:
                'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
              color: '#fff',
              border: '1.5px solid rgba(191, 219, 254, 0.6)',
              animation: 'find-opponent-cta-pulse 1.6s ease-in-out infinite',
            }}
          >
            Start a Battle →
          </button>
        </div>
      </div>
    </>
  );
}
