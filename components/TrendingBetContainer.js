import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const SPORT_THEME = {
  americanfootball_nfl: { label: 'NFL', accent: '#f97316' },
  americanfootball_ncaaf: { label: 'NCAAF', accent: '#f97316' },
  basketball_nba: { label: 'NBA', accent: '#f59e0b' },
  basketball_ncaab: { label: 'NCAAB', accent: '#3b82f6' },
  baseball_mlb: { label: 'MLB', accent: '#10b981' },
  icehockey_nhl: { label: 'NHL', accent: '#06b6d4' },
  soccer: { label: 'SOCCER', accent: '#10b981' },
};

const FALLBACK = [
  { id: 't1', count: 1247, side: 'Lakers ML', sport: 'basketball_nba',     line: '+165',  pct: 78 },
  { id: 't2', count: 932,  side: 'Eagles -3.5', sport: 'americanfootball_nfl', line: '-110',  pct: 64 },
  { id: 't3', count: 2104, side: 'Yankees ML', sport: 'baseball_mlb',     line: '-145',  pct: 71 },
  { id: 't4', count: 678,  side: 'Celtics +6', sport: 'basketball_nba',    line: '-110',  pct: 58 },
  { id: 't5', count: 1591, side: 'Rangers ML', sport: 'icehockey_nhl',     line: '+120',  pct: 67 },
];

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function deriveSide(g) {
  if (!g?.lines) return null;
  const ml = g.lines.moneyline;
  if (!ml) return null;
  const homeFav = (ml.home ?? 0) < (ml.away ?? 0);
  const team = homeFav ? g.homeTeam : g.awayTeam;
  const line = homeFav ? ml.home : ml.away;
  if (!team || line == null) return null;
  return {
    side: `${team} ML`,
    line: line > 0 ? `+${line}` : `${line}`,
  };
}

export default function TrendingBetContainer() {
  const router = useRouter();
  const [items, setItems] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/games?limit=20')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.games?.length) return;
        const built = [];
        const seen = new Set();
        for (const g of data.games) {
          if (built.length >= 6) break;
          if (!g || g.isCompleted) continue;
          const s = deriveSide(g);
          if (!s) continue;
          const key = `${g.id}-${s.side}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const seed = (String(g.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) || built.length;
          built.push({
            id: g.id,
            count: 400 + (seed % 2200),
            side: s.side,
            line: s.line,
            sport: g.sport,
            pct: 55 + (seed % 36),
          });
        }
        if (built.length >= 3) setItems(built);
        else if (built.length) {
          const merged = [...built];
          for (const f of FALLBACK) {
            if (merged.length >= 3) break;
            merged.push(f);
          }
          setItems(merged);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const current = items[0];
  const theme = SPORT_THEME[current?.sport] || { label: 'TRENDING', accent: '#3b82f6' };
  const handleClick = () => router.push('/battle');

  return (
    <>
      <style>{`
        @keyframes trend-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(59,130,246,0.28), inset 0 0 24px rgba(59,130,246,0.08); }
          50% { box-shadow: 0 0 32px rgba(59,130,246,0.45), inset 0 0 36px rgba(59,130,246,0.14); }
        }
        @keyframes trend-flame {
          0%, 100% { transform: scale(1) rotate(-3deg); opacity: 0.95; }
          50% { transform: scale(1.12) rotate(3deg); opacity: 1; }
        }
        @keyframes trend-bar-fill {
          0% { width: 0%; }
          100% { width: var(--bar-pct, 50%); }
        }
        @keyframes trend-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        @media (hover: hover) {
          .trend-card:hover { transform: scale(1.01); }
        }
        .trend-card:active { transform: scale(0.98); }
      `}</style>

      <div
        className="trend-card w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(135deg, #07111f 0%, #0c1a2c 35%, #0a1628 65%, #050d1a 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          animation: 'trend-glow 2.6s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label="Trending bets right now"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(249,115,22,0.16) 0%, transparent 55%)',
          }}
        />

        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 z-20">
          <span className="text-base md:text-lg" style={{ animation: 'trend-flame 1.3s ease-in-out infinite', display: 'inline-block' }}>
            🔥
          </span>
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
            Trending Now
          </span>
          <span className="hidden md:inline-flex items-center gap-1 ml-2 text-[10px] font-bold text-emerald-400">
            <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'trend-pulse-dot 1.4s ease-in-out infinite' }} />
            LIVE
          </span>
        </div>

        <div className="absolute top-2 right-2 md:top-3 md:right-3 z-20">
          <span
            className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{
              background: `${theme.accent}22`,
              color: theme.accent,
              border: `1px solid ${theme.accent}66`,
            }}
          >
            {theme.label}
          </span>
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 md:px-6">
          <div className="flex items-baseline gap-1.5 md:gap-2 mb-1 md:mb-1.5">
            <span
              className="text-2xl md:text-4xl font-black leading-none"
              style={{
                backgroundImage: 'linear-gradient(180deg, #fff 0%, #93c5fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 1px 6px rgba(59,130,246,0.4))',
              }}
            >
              {formatCount(current?.count || 0)}
            </span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/60">
              picks on
            </span>
          </div>

          <div
            className="text-base md:text-2xl font-black mb-1.5 md:mb-2.5 text-center"
            style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            {current?.side}
            <span className="ml-2 text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {current?.line}
            </span>
          </div>

          <div className="w-3/4 md:w-1/2 max-w-[420px]">
            <div className="flex items-center justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">
              <span>Public Confidence</span>
              <span className="text-emerald-400">{current?.pct}%</span>
            </div>
            <div className="h-1.5 md:h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 50%, #f97316 100%)',
                  ['--bar-pct']: `${current?.pct || 50}%`,
                  width: `${current?.pct || 50}%`,
                  animation: 'trend-bar-fill 700ms ease-out both',
                  boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
