import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import TopNavbar from '../../components/TopNavbar';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function newsHref(a) {
  return `/news/${a.slug}?id=${encodeURIComponent(a.id)}`;
}

const LEAGUE_TINT = {
  NBA: '#fb923c',
  NFL: '#22d3ee',
  MLB: '#60a5fa',
  NHL: '#34d399',
  CBB: '#fb923c',
  CFB: '#22d3ee',
  Soccer: '#34d399',
  UFC: '#f87171',
  Golf: '#34d399',
  Tennis: '#facc15',
};

function PiksLoader({ label = 'Loading Piks News' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <img
        src="/pikslogotransparent.png"
        alt="Piks"
        className="w-16 h-16 animate-pulse"
        style={{ filter: 'none' }}
      />
      <span className="text-xs uppercase tracking-widest opacity-50">{label}</span>
    </div>
  );
}

export default function PiksNewsPage({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [activeLeague, setActiveLeague] = useState('All');

  useEffect(() => {
    let alive = true;
    fetch('/api/news/feed')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (Array.isArray(d.items) && d.items.length) setItems(d.items);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    fetch('/api/news/markets')
      .then((r) => r.json())
      .then((d) => alive && setMarkets(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const leagues = useMemo(() => {
    const set = [];
    for (const a of items) if (a.league && !set.includes(a.league)) set.push(a.league);
    return ['All', ...set];
  }, [items]);

  const filtered = useMemo(
    () => (activeLeague === 'All' ? items : items.filter((a) => a.league === activeLeague)),
    [items, activeLeague]
  );

  const hero = filtered.find((a) => a.image) || filtered[0] || null;
  const rest = filtered.filter((a) => a !== hero);

  const card = {
    background: 'var(--sf-surface)',
    border: '1px solid var(--sf-border)',
    boxShadow: 'var(--sf-card-shadow)',
  };

  return (
    <div className="news-page sf-root min-h-screen">
      <Head>
        <title>Piks News — Sports headlines with the betting angle</title>
        <meta
          name="description"
          content="The latest sports headlines, summarized with the Piks betting angle and live market odds."
        />
      </Head>
      <TopNavbar />

      {/* League filter pills — full screen width */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1 scrollbar-hide">
          {leagues.map((lg) => {
            const active = lg === activeLeague;
            const tint = LEAGUE_TINT[lg] || '#60a5fa';
            return (
              <button
                key={lg}
                type="button"
                onClick={() => setActiveLeague(lg)}
                className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-full transition-colors"
                style={{
                  background: active ? tint : 'var(--sf-surface)',
                  color: active ? '#0d1024' : 'var(--sf-text-primary)',
                  border: active ? `1px solid ${tint}` : '1px solid var(--sf-border-strong)',
                }}
              >
                {lg}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading ? (
          <PiksLoader />
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center" style={{ color: 'var(--sf-text-secondary)' }}>
            No stories right now — check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Hero */}
              {hero && (
                <Link
                  href={newsHref(hero)}
                  className="block group rounded-2xl overflow-hidden mb-6 transition-transform lg:hover:-translate-y-0.5"
                  style={card}
                >
                  {hero.image && (
                    <div className="aspect-[16/9] w-full overflow-hidden" style={{ background: 'var(--sf-avatar-bg)' }}>
                      <img
                        src={hero.image}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 lg:group-hover:scale-[1.03]"
                        loading="eager"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-wider">
                      <span
                        className="px-2 py-0.5 rounded-full"
                        style={{ background: LEAGUE_TINT[hero.league] || '#60a5fa', color: '#0d1024' }}
                      >
                        {hero.league}
                      </span>
                      <span style={{ color: 'var(--sf-text-secondary)' }}>
                        {hero.source} · {timeAgo(hero.published)}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold leading-tight mb-2">{hero.headline}</h2>
                    {hero.description && (
                      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--sf-text-secondary)' }}>
                        {hero.description}
                      </p>
                    )}
                  </div>
                </Link>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rest.map((a) => (
                  <Link
                    key={a.id}
                    href={newsHref(a)}
                    className="flex flex-col group rounded-xl overflow-hidden transition-transform lg:hover:-translate-y-0.5"
                    style={card}
                  >
                    {a.image && (
                      <div className="aspect-[16/9] w-full overflow-hidden" style={{ background: 'var(--sf-avatar-bg)' }}>
                        <img
                          src={a.image}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 lg:group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider">
                        <span
                          className="px-1.5 py-0.5 rounded-full"
                          style={{ background: LEAGUE_TINT[a.league] || '#60a5fa', color: '#0d1024' }}
                        >
                          {a.league}
                        </span>
                        <span style={{ color: 'var(--sf-text-secondary)' }}>{timeAgo(a.published)}</span>
                      </div>
                      <h3 className="text-[15px] font-bold leading-snug line-clamp-3">{a.headline}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Market Movers sidebar */}
            <aside className="lg:col-span-1">
              <div className="rounded-2xl p-5 lg:sticky lg:top-24" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-black uppercase tracking-wider">Market Movers</h2>
                </div>
                <p className="text-[11px] mb-4" style={{ color: 'var(--sf-text-secondary)' }}>
                  What the market thinks right now.
                </p>
                {markets.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--sf-text-secondary)' }}>
                    No live markets right now.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {markets.map((m) => (
                      <div
                        key={m.id}
                        className="block rounded-xl p-3"
                        style={{ background: 'var(--sf-surface-muted)', border: '1px solid var(--sf-border)' }}
                      >
                        <p className="text-[13px] font-bold leading-snug line-clamp-2 mb-2">{m.question}</p>
                        <div className="flex flex-col gap-1.5">
                          {m.outcomes.map((o, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold flex-shrink-0 w-16 truncate" style={{ color: 'var(--sf-text-secondary)' }}>
                                {o.label}
                              </span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf-track)' }}>
                                <div className="h-full rounded-full" style={{ width: `${o.prob}%`, background: i === 0 ? '#34d399' : '#60a5fa' }} />
                              </div>
                              <span className="text-[11px] font-extrabold flex-shrink-0 w-9 text-right">{o.prob}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export async function getStaticProps() {
  try {
    const { getFeed } = await import('../../lib/news');
    const items = await getFeed();
    return {
      props: { initialItems: Array.isArray(items) ? items : [] },
      revalidate: 300,
    };
  } catch (e) {
    return { props: { initialItems: [] }, revalidate: 60 };
  }
}
