import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
  return `${Math.floor(hrs / 24)}d ago`;
}

const LEAGUE_TINT = {
  NBA: '#fb923c', NFL: '#22d3ee', MLB: '#60a5fa', NHL: '#34d399',
  CBB: '#fb923c', CFB: '#22d3ee', Soccer: '#34d399', UFC: '#f87171',
  Golf: '#34d399', Tennis: '#facc15',
};

const CARD = {
  background: 'var(--sf-surface)',
  border: '1px solid var(--sf-border)',
  boxShadow: 'var(--sf-card-shadow)',
};

function AiPulse() {
  return (
    <div className="flex items-center gap-3 py-4">
      <img src="/pikslogotransparent.png" alt="" className="w-8 h-8 animate-pulse" style={{ filter: 'none' }} />
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--sf-text-secondary)' }}>
        Piks is breaking down this story…
      </span>
    </div>
  );
}

export default function NewsArticlePage() {
  const router = useRouter();
  const { id } = router.query;

  const [article, setArticle] = useState(null);
  const [ai, setAi] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound

  useEffect(() => {
    if (!router.isReady) return;
    if (!id) {
      setStatus('notfound');
      return;
    }
    let alive = true;
    setStatus('loading');
    fetch(`/api/news/article?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) return { notfound: true };
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        if (d?.notfound || !d?.article) {
          setStatus('notfound');
          return;
        }
        setArticle(d.article);
        setAi(d.ai || null);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('notfound'));
    return () => {
      alive = false;
    };
  }, [router.isReady, id]);

  return (
    <div className="news-page sf-root min-h-screen">
      <Head>
        <title>{article ? `${article.headline} — Piks News` : 'Piks News'}</title>
      </Head>
      <TopNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        <Link href="/news" className="inline-flex items-center gap-1.5 text-sm font-semibold mb-5" style={{ color: '#fb923c' }}>
          ← Piks News
        </Link>

        {status === 'notfound' ? (
          <div className="py-24 text-center">
            <p className="text-lg font-bold mb-2">This story isn’t available</p>
            <p className="text-sm mb-6" style={{ color: 'var(--sf-text-secondary)' }}>
              It may have rolled off the feed. Browse the latest instead.
            </p>
            <Link href="/news" className="inline-block px-5 py-2.5 rounded-full font-bold text-sm" style={{ background: '#fb923c', color: '#0d1024' }}>
              Back to Piks News
            </Link>
          </div>
        ) : status === 'loading' || !article ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <img src="/pikslogotransparent.png" alt="Piks" className="w-16 h-16 animate-pulse" style={{ filter: 'none' }} />
          </div>
        ) : (
          <article>
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded-full" style={{ background: LEAGUE_TINT[article.league] || '#60a5fa', color: '#0d1024' }}>
                {article.league}
              </span>
              <span style={{ color: 'var(--sf-text-secondary)' }}>{article.source} · {timeAgo(article.published)}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-4">{article.headline}</h1>

            {article.image && (
              <div className="rounded-2xl overflow-hidden mb-2" style={{ background: 'var(--sf-avatar-bg)' }}>
                <img src={article.image} alt="" className="w-full object-cover" />
              </div>
            )}
            {article.imageCaption && (
              <p className="text-[11px] mb-6" style={{ color: 'var(--sf-text-secondary)' }}>{article.imageCaption}</p>
            )}

            {/* The Gist */}
            <section className="rounded-2xl p-5 mb-5" style={CARD}>
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#fb923c' }}>The Gist</h2>
              {!ai ? <AiPulse /> : <p className="text-[15px] leading-relaxed">{ai.gist}</p>}
            </section>

            {/* Key Points */}
            {ai?.keyPoints?.length > 0 && (
              <section className="rounded-2xl p-5 mb-5" style={CARD}>
                <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#22d3ee' }}>Key Points</h2>
                <ul className="flex flex-col gap-2.5">
                  {ai.keyPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] leading-snug">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22d3ee' }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Betting Angle */}
            {ai?.bettingAngle && (
              <section className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.3)' }}>
                <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#fb923c' }}>The Betting Angle</h2>
                <p className="text-[15px] leading-relaxed">{ai.bettingAngle}</p>
              </section>
            )}

            {/* Source attribution + link out */}
            <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)' }}>
              <div>
                <p className="text-[13px] font-bold">Original reporting by {article.source}</p>
                {article.byline && (
                  <p className="text-[12px]" style={{ color: 'var(--sf-text-secondary)' }}>{article.byline}</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--sf-text-secondary)' }}>
                  Piks summary & betting angle are our own take.
                </p>
              </div>
              <a
                href={article.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-center px-5 py-2.5 rounded-full font-bold text-sm"
                style={{ background: '#fb923c', color: '#0d1024' }}
              >
                Read full story →
              </a>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
