import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const SPORT_THEME = {
  americanfootball_nfl: { label: 'NFL', accent: '#f97316', glow: 'rgba(249,115,22,0.45)', tint: 'rgba(249,115,22,0.12)' },
  americanfootball_ncaaf: { label: 'NCAAF', accent: '#f97316', glow: 'rgba(249,115,22,0.45)', tint: 'rgba(249,115,22,0.12)' },
  basketball_nba: { label: 'NBA', accent: '#f59e0b', glow: 'rgba(245,158,11,0.45)', tint: 'rgba(245,158,11,0.12)' },
  basketball_ncaab: { label: 'NCAAB', accent: '#3b82f6', glow: 'rgba(59,130,246,0.45)', tint: 'rgba(59,130,246,0.12)' },
  baseball_mlb: { label: 'MLB', accent: '#10b981', glow: 'rgba(16,185,129,0.45)', tint: 'rgba(16,185,129,0.12)' },
  icehockey_nhl: { label: 'NHL', accent: '#06b6d4', glow: 'rgba(6,182,212,0.45)', tint: 'rgba(6,182,212,0.12)' },
  soccer: { label: 'SOCCER', accent: '#10b981', glow: 'rgba(16,185,129,0.45)', tint: 'rgba(16,185,129,0.12)' },
};

const FALLBACK = [
  { id: 'm-1', home: 'LAL', away: 'BOS', sport: 'basketball_nba', time: 'Tonight 8:00 PM ET', tag: 'PRIMETIME' },
  { id: 'm-2', home: 'KC',  away: 'BUF', sport: 'americanfootball_nfl', time: 'Sun 4:25 PM ET', tag: 'GAME OF THE WEEK' },
  { id: 'm-3', home: 'NYR', away: 'TOR', sport: 'icehockey_nhl', time: 'Tonight 7:00 PM ET', tag: 'RIVALRY NIGHT' },
];

function formatGameTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
    if (sameDay) return `Tonight ${t}`;
    if (isTomorrow) return `Tomorrow ${t}`;
    const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    return `${day} ${t}`;
  } catch { return ''; }
}

function pickTag(idx) {
  const tags = ['FEATURED MATCHUP', 'PRIMETIME', 'BOOSTED ODDS', 'GAME OF THE NIGHT', 'MARQUEE GAME'];
  return tags[idx % tags.length];
}

export default function MarqueeMatchupContainer() {
  const router = useRouter();
  const [games, setGames] = useState(FALLBACK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/games?limit=20')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.games?.length) return;
        const upcoming = data.games
          .filter((g) => g && !g.isCompleted && g.homeTeam && g.awayTeam)
          .sort((a, b) => new Date(a.startTime || a.commenceTime || 0) - new Date(b.startTime || b.commenceTime || 0))
          .slice(0, 6)
          .map((g, i) => ({
            id: g.id || g.gameId,
            home: g.homeTeam,
            away: g.awayTeam,
            sport: g.sport,
            time: formatGameTime(g.startTime || g.commenceTime),
            tag: pickTag(i),
            isLive: g.isLive,
          }));
        if (!upcoming.length) return;
        const seen = new Set(upcoming.map((u) => u.id));
        const merged = [...upcoming];
        for (const f of FALLBACK) {
          if (merged.length >= 3) break;
          if (!seen.has(f.id)) { merged.push(f); seen.add(f.id); }
        }
        setGames(merged.slice(0, 6));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (games.length <= 1) return;
    const id = setInterval(() => setTick((t) => t + 1), 3500);
    return () => clearInterval(id);
  }, [games.length]);

  const current = useMemo(() => games[tick % games.length] || games[0], [games, tick]);
  const theme = SPORT_THEME[current?.sport] || { label: 'FEATURED', accent: '#3b82f6', glow: 'rgba(59,130,246,0.45)', tint: 'rgba(59,130,246,0.12)' };

  const handleClick = () => {
    router.push('/battle');
  };

  return (
    <>
      <style>{`
        @keyframes marquee-glow {
          0%, 100% { box-shadow: 0 0 18px ${theme.glow}, inset 0 0 24px ${theme.tint}; }
          50% { box-shadow: 0 0 32px ${theme.glow}, inset 0 0 40px ${theme.tint}; }
        }
        @keyframes marquee-slide-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee-tag-pulse {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
        @media (hover: hover) {
          .marquee-card:hover { transform: scale(1.01); }
        }
        .marquee-card:active { transform: scale(0.98); }
      `}</style>

      <div
        className="marquee-card w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background: 'linear-gradient(135deg, #07111f 0%, #0c1a2c 35%, #0a1628 65%, #050d1a 100%)',
          border: `1.5px solid ${theme.accent}55`,
          animation: 'marquee-glow 2.8s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label={`Battle on featured matchup ${current?.away} vs ${current?.home}`}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 20% 20%, ${theme.glow} 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(6,182,212,0.18) 0%, transparent 55%)`,
          }}
        />

        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 z-20">
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
          <span
            className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.18em] text-white/80"
            style={{ animation: 'marquee-tag-pulse 1.6s ease-in-out infinite' }}
          >
            {current?.tag || 'FEATURED MATCHUP'}
          </span>
        </div>

        <div className="absolute top-2 right-2 md:top-3 md:right-3 z-20">
          <span className="text-[9px] md:text-[10px] font-bold text-white/60 uppercase tracking-wider">
            {current?.time || ''}
          </span>
        </div>

        <div
          key={`marquee-${current?.id}-${tick}`}
          className="relative z-10 h-full flex flex-col items-center justify-center px-4 md:px-6 text-center"
          style={{ animation: 'marquee-slide-in 380ms ease-out both' }}
        >
          <div className="flex items-center justify-center gap-3 md:gap-6 mb-1.5 md:mb-3">
            <div className="flex flex-col items-center">
              <span
                className="text-2xl md:text-4xl font-black leading-none"
                style={{ color: '#fff', textShadow: `0 2px 12px ${theme.glow}` }}
              >
                {current?.away}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">
                Away
              </span>
            </div>

            <div
              className="text-base md:text-2xl font-black"
              style={{ color: theme.accent, textShadow: `0 1px 8px ${theme.glow}` }}
            >
              VS
            </div>

            <div className="flex flex-col items-center">
              <span
                className="text-2xl md:text-4xl font-black leading-none"
                style={{ color: '#fff', textShadow: `0 2px 12px ${theme.glow}` }}
              >
                {current?.home}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">
                Home
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="px-5 md:px-7 py-1.5 md:py-2 rounded-xl font-black text-[11px] md:text-sm uppercase tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}cc 100%)`,
              color: '#0a0a0a',
              border: `1.5px solid ${theme.accent}`,
              boxShadow: `0 4px 18px ${theme.glow}`,
            }}
          >
            Battle on This Game →
          </button>
        </div>

        {games.length > 1 && (
          <div className="absolute bottom-1.5 md:bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-20">
            {games.slice(0, Math.min(games.length, 6)).map((_, i) => (
              <span
                key={i}
                className="block rounded-full transition-all"
                style={{
                  width: i === tick % games.length ? 14 : 4,
                  height: 4,
                  background: i === tick % games.length ? theme.accent : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
