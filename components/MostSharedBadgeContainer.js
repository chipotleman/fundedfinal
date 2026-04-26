import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AchievementBadge from './AchievementBadge';
import { getBadgeForAchievement } from '../lib/achievementBadges';

const RARITY_COLORS = {
  Common: { bg: 'rgba(148, 163, 184, 0.18)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.45)' },
  Uncommon: { bg: 'rgba(16, 185, 129, 0.18)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.45)' },
  Rare: { bg: 'rgba(6, 182, 212, 0.20)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.55)' },
  Epic: { bg: 'rgba(251, 191, 36, 0.20)', text: '#fde68a', border: 'rgba(251, 191, 36, 0.55)' },
};

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function MostSharedBadgeContainer() {
  const router = useRouter();
  const { data: session } = useSession();
  const [badges, setBadges] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/badges/most-shared-week')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.badges) ? data.badges.slice(0, 3) : [];
        setBadges(list);
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    if (!badges) return [];
    return badges.map((b) => {
      const meta = getBadgeForAchievement(b.achievementId);
      return {
        achievementId: b.achievementId,
        name: b.name || meta.name,
        rarity: b.rarity || meta.rarity,
        count: b.count || 0,
      };
    });
  }, [badges]);

  if (!loaded) return null;
  if (!items.length) return null;

  const handleClick = () => {
    const userId = session?.user?.id;
    if (userId) {
      router.push(`/profile/${userId}`);
    }
  };

  return (
    <>
      <style>{`
        @keyframes mshare-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(251,191,36,0.20), inset 0 0 20px rgba(251,191,36,0.06); }
          50% { box-shadow: 0 0 30px rgba(251,191,36,0.36), inset 0 0 28px rgba(251,191,36,0.12); }
        }
        @keyframes mshare-fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes mshare-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        @media (hover: hover) {
          .mshare-card:hover { transform: scale(1.01); }
        }
        .mshare-card:active { transform: scale(0.985); }
      `}</style>

      <div
        className="mshare-card w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px]"
        style={{
          background:
            'linear-gradient(135deg, #0a0a14 0%, #16110a 35%, #1d160a 65%, #0a0a14 100%)',
          border: '1.5px solid rgba(251, 191, 36, 0.35)',
          animation: 'mshare-glow 3s ease-in-out infinite',
        }}
        onClick={handleClick}
        role="button"
        aria-label="Most shared badges this week"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 15% 20%, rgba(251,191,36,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(6,182,212,0.14) 0%, transparent 60%)',
          }}
        />

        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5 z-20">
          <span
            className="block w-1.5 h-1.5 rounded-full bg-amber-300"
            style={{ animation: 'mshare-pulse-dot 1.6s ease-in-out infinite' }}
          />
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            Most Shared
          </span>
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/45">
            this week
          </span>
        </div>

        <div className="absolute top-2 right-2 md:top-3 md:right-3 z-20">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/55">
            Top {items.length}
          </span>
        </div>

        <div
          className="relative z-10 h-full flex items-center justify-center px-3 md:px-6 pt-7 md:pt-8 pb-3 md:pb-4"
          style={{ animation: 'mshare-fade-in 360ms ease-out both' }}
        >
          <div className="flex items-center justify-center gap-3 md:gap-6 w-full">
            {items.map((item, i) => {
              const tone = RARITY_COLORS[item.rarity] || RARITY_COLORS.Common;
              return (
                <div
                  key={item.achievementId}
                  className="flex items-center gap-2 md:gap-3 min-w-0"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex-shrink-0">
                    <AchievementBadge
                      achievementId={item.achievementId}
                      earned
                      size={56}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div
                      className="text-xs md:text-sm font-bold text-white truncate"
                      style={{ maxWidth: 110 }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[8px] md:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: tone.bg,
                          color: tone.text,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span
                        className="text-base md:text-lg font-black leading-none"
                        style={{ color: '#fde68a', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatCount(item.count)}
                      </span>
                      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/55">
                        {item.count === 1 ? 'share' : 'shares'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
