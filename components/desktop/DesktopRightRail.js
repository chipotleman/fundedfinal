import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import UserAvatar from '../UserAvatar';
import { getSimulatedBattles } from '../battle/LiveBattlesSection';
import { formatLastSeen } from '../../utils/relativeTime';
import { useUserPreview } from '../../contexts/UserPreviewContext';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { readLastBuyIn } from '../../utils/lastBattleBuyIn';

// Lazy-load the invite modal so the rail's own bundle stays light — the
// flow code only ships once a user actually taps "Battle" on a friend row.
const PlayFriendModal = dynamic(() => import('../battle/PlayFriendModal'), { ssr: false });

// =============================================================================
// DesktopRightRail — the contextual right sidebar for the full-width desktop
// shell (Polymarket-style). Surfaces engagement content: a compact "Live now"
// list, online friends (`/api/friends`), and this week's top cappers
// (`/api/leaderboard`). All data comes from existing endpoints. Rendered
// `hidden lg:block` by the parent so it never affects mobile/tablet.
// =============================================================================
// Theme-aware palette via CSS variables. Defaults (dark) and the
// `html.light` overrides are defined in styles/globals.css under the
// `.desktop-right-rail` scope, so the rail flips with the rest of the
// app's light/dark theme without a hydration flash (the root `light`
// class is applied pre-paint by the _document.js inline script).
// Hydrate cached content before the browser paints so Friends / Top cappers
// never flash empty on load. useLayoutEffect fires after the hydration render
// but synchronously before paint; fall back to useEffect on the server to avoid
// the "useLayoutEffect does nothing on the server" warning during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function newsTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'now';
  const h = Math.floor(diff / 3600000);
  if (h < 1) {
    const m = Math.floor(diff / 60000);
    return m < 1 ? 'now' : `${m}m ago`;
  }
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const surface = 'var(--rail-surface)';
const border = 'var(--rail-border)';
const textPrimary = 'var(--rail-text)';
const textSecondary = 'var(--rail-text-2)';
const textMuted = 'var(--rail-text-3)';

function Card({ title, action, onAction, children }) {
  return (
    <div
      className="desktop-rail-card rounded-2xl mb-4 overflow-hidden"
      style={{ backgroundColor: surface, border: `1px solid ${border}` }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
          {title}
        </span>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="text-[11px] font-semibold lg:hover:underline"
            style={{ color: '#60a5fa' }}
          >
            {action}
          </button>
        )}
      </div>
      <div className="px-2 pb-2">{children}</div>
    </div>
  );
}

export default function DesktopRightRail({ isLoggedIn }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { openPreview, openMessage } = useUserPreview();
  const isBeta = useBetaMode();
  // Friend the user is quick-inviting to a battle (null when the modal is
  // closed). Opening the invite popup never navigates away from the dash.
  const [playFriend, setPlayFriend] = useState(null);
  const sessionUser = session?.user
    ? { id: session.user.id, username: session.user.name, avatar: session.user.image }
    : null;
  const [friends, setFriends] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [news, setNews] = useState([]);
  // Prefer real active battles from `/api/battles/live`; only fall back to the
  // shared simulated demo battles when the backend returns none (keeps the rail
  // from looking dead during quiet periods without fabricating fake activity
  // when real battles exist).
  const [battles, setBattles] = useState(() => getSimulatedBattles([]).slice(0, 3));

  const userId = session?.user?.id;

  // Hydrate from the last-known cache *before paint* so Friends and Top cappers
  // render with content on the very first frame instead of flashing an empty
  // container that "floods in" once the network resolves. Runs synchronously
  // after the hydration render (client only); the network effect below refreshes
  // this data and rewrites the cache in the background.
  useIsoLayoutEffect(() => {
    const friendsKey = userId ? `piks:rail:friends:${userId}` : null;
    try {
      const cf = friendsKey ? JSON.parse(localStorage.getItem(friendsKey) || 'null') : null;
      if (isLoggedIn && Array.isArray(cf) && cf.length) setFriends(cf);
      else if (!isLoggedIn) setFriends([]);
      const cl = JSON.parse(localStorage.getItem('piks:rail:leaders') || 'null');
      if (Array.isArray(cl) && cl.length) setLeaders(cl);
      // Only trust cached items from the hosted Piks News feed (they carry an
      // id + slug). Legacy entries cached from the old external feed lack those
      // and must be discarded so we never surface an off-site link.
      const cn = JSON.parse(localStorage.getItem('piks:rail:news') || 'null');
      const cnClean = Array.isArray(cn) ? cn.filter((n) => n && n.id && n.slug) : [];
      if (cnClean.length) setNews(cnClean);
      else { try { localStorage.removeItem('piks:rail:news'); } catch {} }
    } catch {}
  }, [isLoggedIn, userId]);

  useEffect(() => {
    let cancelled = false;

    // Friends are per-user, so their cache key is scoped to the signed-in
    // user id — that way switching accounts can never flash the previous
    // user's friend list. The leaderboard is public, so it stays global.
    const friendsKey = userId ? `piks:rail:friends:${userId}` : null;

    const loadFriends = async () => {
      if (!isLoggedIn) return;
      try {
        const res = await fetch('/api/friends');
        if (res.ok && !cancelled) {
          const json = await res.json();
          const next = Array.isArray(json?.friends) ? json.friends : [];
          setFriends(next);
          if (friendsKey) {
            try { localStorage.setItem(friendsKey, JSON.stringify(next)); } catch {}
          }
        }
      } catch {}
    };

    const loadBattles = async () => {
      try {
        const res = await fetch('/api/battles/live');
        if (res.ok && !cancelled) {
          const json = await res.json();
          const live = Array.isArray(json?.battles) ? json.battles : [];
          if (live.length > 0) {
            setBattles(live.slice(0, 3));
          }
        }
      } catch {}
    };

    const loadLeaders = async () => {
      try {
        const res = await fetch('/api/leaderboard?sortBy=profit&limit=5');
        if (res.ok && !cancelled) {
          const json = await res.json();
          const next = Array.isArray(json?.leaders) ? json.leaders.slice(0, 5) : [];
          setLeaders(next);
          try { localStorage.setItem('piks:rail:leaders', JSON.stringify(next)); } catch {}
        }
      } catch {}
    };

    // Fire all three independently so a slow `/api/battles/live` (which can
    // stall on flaky upstream sports data) never blocks the leaderboard or
    // friends from populating. These used to be awaited sequentially, which
    // left the Top Cappers card stuck on "Leaderboard loading…" until the
    // battles fetch resolved — even though the leaderboard endpoint itself
    // is fast.
    const loadNews = async () => {
      if (isLoggedIn) return; // card is guest-only
      try {
        const res = await fetch('/api/news/feed');
        if (res.ok && !cancelled) {
          const json = await res.json();
          const next = Array.isArray(json?.items) ? json.items.slice(0, 6) : [];
          if (next.length) {
            setNews(next);
            try { localStorage.setItem('piks:rail:news', JSON.stringify(next)); } catch {}
          }
        }
      } catch {}
    };

    loadFriends();
    loadBattles();
    loadLeaders();
    loadNews();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userId]);

  const onlineFriends = friends.filter((f) => f.isOnline);
  const sortedFriends = [...friends].sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)).slice(0, 6);

  // Twitter-style "trending" topics for logged-out visitors. Logged-in users
  // get the Friends card in this slot; guests have no friends list, so we fill
  // the gap with real engagement signals (live battles + this week's top
  // cappers) reframed as trends, falling back to evergreen platform topics when
  // no live data is loaded yet. Each row nudges toward sign-up.
  const openSignup = () =>
    window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }));

  const guestTrends = [];
  // Only real live battles count as "trending" — the `battles` state is seeded
  // with simulated placeholders (for the Live now card), which we must not pass
  // off as real trends.
  battles.filter((b) => !b.simulated).slice(0, 2).forEach((b) => {
    guestTrends.push({
      key: `b-${b.id}`,
      category: 'Live battle',
      title: `${b.user1?.username || 'Player 1'} vs ${b.user2?.username || 'Player 2'}`,
      meta: Number(b.potSize) > 0 ? `${Number(b.potSize).toLocaleString()} coins on the line` : 'Live now',
      onClick: () => router.push(`/battle?battle=${b.id}`),
    });
  });
  leaders.slice(0, 3).forEach((l, i) => {
    guestTrends.push({
      key: `l-${l.id || i}`,
      category: 'Top capper',
      title: `@${l.username}`,
      meta:
        typeof l.profit === 'number'
          ? `${l.profit >= 0 ? '+' : ''}${l.profit.toLocaleString()}${isBeta ? ' Crowns' : ''} this week`
          : 'On the leaderboard',
      onClick: () => router.push('/leaderboard'),
    });
  });
  if (guestTrends.length === 0) {
    [
      { category: 'Trending in Basketball', title: 'NBA tonight' },
      { category: 'Trending in Football', title: 'NFL matchups' },
      { category: 'Hot game mode', title: 'RUSH 1v1' },
    ].forEach((t, i) => guestTrends.push({ key: `f-${i}`, ...t, onClick: openSignup }));
  }
  const trendsToShow = guestTrends.slice(0, 5);

  return (
    <div className="desktop-right-rail lg:pr-1">
      {/* Live now */}
      <Card title={`Live now${battles.length ? ` · ${battles.length}` : ''}`} action="View all" onAction={() => router.push('/battle')}>
        {battles.length === 0 ? (
          <div className="px-2 py-3 text-xs" style={{ color: textMuted }}>No live battles right now.</div>
        ) : (
          battles.map((b) => {
            const u1 = b.user1 || {};
            const u2 = b.user2 || {};
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/battle?battle=${b.id}`)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left lg:hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center -space-x-2 flex-shrink-0">
                  <span className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-[#0d0d0d]">
                    <UserAvatar user={{ id: u1.id, username: u1.username, avatar: u1.avatar }} size={28} />
                  </span>
                  <span className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-[#0d0d0d]">
                    <UserAvatar user={{ id: u2.id, username: u2.username, avatar: u2.avatar }} size={28} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold truncate" style={{ color: textPrimary }}>
                    {(u1.username || 'P1')} vs {(u2.username || 'P2')}
                  </span>
                  <span className="block text-[10px]" style={{ color: textMuted }}>
                    {Number(b.potSize) > 0 ? `${Number(b.potSize).toLocaleString()} coins on the line` : 'Live now'}
                  </span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase" style={{ color: '#ef4444' }}>Live</span>
                </span>
              </button>
            );
          })
        )}
      </Card>

      {/* Online friends */}
      {isLoggedIn && (
        <Card title={`Friends${onlineFriends.length ? ` · ${onlineFriends.length} online` : ''}`} action="All" onAction={() => router.push('/messenger')}>
          {sortedFriends.length === 0 ? (
            <div className="px-2 py-3 text-xs" style={{ color: textMuted }}>
              No friends yet — add some to battle.
            </div>
          ) : (
            sortedFriends.map((f) => (
              <div
                key={f.id}
                className="group w-full flex items-center gap-2 px-2 py-2 rounded-lg lg:hover:bg-white/5 transition-colors"
              >
                {/* Name + avatar — opens the mini-profile preview popover
                    (View profile / DM / Add friend) instead of jumping
                    straight to /profile. */}
                <button
                  type="button"
                  onClick={(e) => openPreview({ id: f.id, username: f.username, avatar: f.avatar, isOnline: f.isOnline, friendStatus: 'friends' }, e.currentTarget)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <span className="relative flex-shrink-0">
                    <span className="w-8 h-8 rounded-full overflow-hidden block">
                      <UserAvatar user={{ id: f.id, username: f.username, avatar: f.avatar }} size={32} />
                    </span>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        backgroundColor: f.isOnline ? '#22c55e' : '#4b5563',
                        borderColor: surface,
                      }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold truncate" style={{ color: textPrimary }}>
                      {f.username}
                    </span>
                    <span className="block text-[10px]" style={{ color: f.isOnline ? '#22c55e' : textMuted }}>
                      {f.isOnline ? 'Online' : formatLastSeen ? formatLastSeen(f.lastSeenAt) : 'Offline'}
                    </span>
                  </span>
                </button>
                {/* Quick actions — never leave the dashboard. Battle opens
                    the Play-a-Friend invite popup preset to this friend;
                    Message opens the DM popup overlay. */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlayFriend({ id: f.id, username: f.username, avatar: f.avatar })}
                    title={`Battle ${f.username}`}
                    aria-label={`Battle ${f.username}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: 'var(--rail-battle-bg)', border: '1px solid var(--rail-battle-border)', color: 'var(--rail-battle-icon)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                      <line x1="13" y1="19" x2="19" y2="13" />
                      <line x1="16" y1="16" x2="20" y2="20" />
                      <line x1="19" y1="21" x2="21" y2="19" />
                      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                      <line x1="5" y1="14" x2="9" y2="18" />
                      <line x1="7" y1="17" x2="4" y2="20" />
                      <line x1="3" y1="19" x2="5" y2="21" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openMessage({ id: f.id, username: f.username, avatar: f.avatar })}
                    title={`Message ${f.username}`}
                    aria-label={`Message ${f.username}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: 'var(--rail-msg-bg)', border: '1px solid var(--rail-msg-border)', color: 'var(--rail-msg-icon)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* Piks News — logged-out only (fills the Friends slot for guests).
          Headlines from the hosted Piks News feed (/api/news/feed). Each item
          opens the branded Piks News reader (/news/[slug]) instead of an
          external source. Falls back to the engagement "trends" rows while the
          feed loads, so the card is never empty. */}
      {!isLoggedIn && (
        <Card title="Piks News" action="View all" onAction={() => router.push('/news')}>
          {news.length > 0 ? (
            news.map((n, i) => (
              <a
                key={n.id || i}
                href={n.slug && n.id ? `/news/${n.slug}?id=${encodeURIComponent(n.id)}` : '/news'}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(n.slug && n.id ? `/news/${n.slug}?id=${encodeURIComponent(n.id)}` : '/news');
                }}
                className="w-full flex flex-col items-start px-2 py-2 rounded-lg text-left lg:hover:bg-white/5 transition-colors"
              >
                <span className="text-[10px] uppercase tracking-wide" style={{ color: textMuted }}>
                  {n.league ? `${n.league}` : 'Piks News'}{n.published ? ` · ${newsTimeAgo(n.published)}` : ''}
                </span>
                <span className="text-[13px] font-bold leading-snug line-clamp-2 max-w-full" style={{ color: textPrimary }}>
                  {n.headline}
                </span>
              </a>
            ))
          ) : (
            trendsToShow.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={t.onClick}
                className="w-full flex flex-col items-start px-2 py-2 rounded-lg text-left lg:hover:bg-white/5 transition-colors"
              >
                <span className="text-[10px]" style={{ color: textMuted }}>{t.category}</span>
                <span className="text-[13px] font-bold truncate max-w-full" style={{ color: textPrimary }}>{t.title}</span>
                {t.meta && (
                  <span className="text-[10px]" style={{ color: textMuted }}>{t.meta}</span>
                )}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => router.push('/battle')}
            className="w-full mt-1 py-2 rounded-lg text-[12px] font-bold transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #facc15, #eab308)', color: '#1a1505' }}
          >
            Open Social Hub
          </button>
        </Card>
      )}

      {/* Top cappers */}
      <Card title="Top cappers" action="Leaderboard" onAction={() => router.push('/leaderboard')}>
        {leaders.length === 0 ? (
          <div className="px-2 py-3 text-xs" style={{ color: textMuted }}>Leaderboard loading…</div>
        ) : (
          leaders.map((l, i) => (
            <button
              key={l.id || i}
              type="button"
              onClick={() => l.id && router.push(`/profile/${l.id}`)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left lg:hover:bg-white/5 transition-colors"
            >
              <span
                className="flex-shrink-0 w-5 text-center text-[12px] font-black"
                style={{ color: textPrimary }}
              >
                {i === 0 ? (
                  <span className="relative inline-flex items-center justify-center" aria-label="1st place" title="1st place">
                    <span style={{ fontSize: 19, lineHeight: 1 }}>👑</span>
                    <span
                      className="absolute font-black"
                      style={{ fontSize: 9, color: '#7c2d12', top: '58%', left: '50%', transform: 'translate(-50%,-50%)' }}
                    >
                      1
                    </span>
                  </span>
                ) : (
                  l.rank || i + 1
                )}
              </span>
              <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <UserAvatar user={{ id: l.id, username: l.username, avatar: l.avatar }} size={32} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold truncate" style={{ color: textPrimary }}>
                  {l.username}
                </span>
                <span className="block text-[10px]" style={{ color: textMuted }}>
                  {(parseInt(l.wins, 10) || 0)}W · {(parseInt(l.losses, 10) || 0)}L
                </span>
              </span>
              {typeof l.profit === 'number' && (
                isBeta ? (
                  <span className="flex-shrink-0 text-right leading-tight">
                    <span className="block text-[8px] font-semibold uppercase tracking-wider" style={{ color: textPrimary }}>
                      Crowns
                    </span>
                    <span className="block text-[11px] font-bold" style={{ color: '#facc15' }}>
                      {l.profit >= 0 ? '+' : ''}{l.profit.toLocaleString()}
                    </span>
                  </span>
                ) : (
                  <span
                    className="flex-shrink-0 text-[11px] font-bold"
                    style={{ color: l.profit >= 0 ? '#10b981' : '#ef4444' }}
                  >
                    {l.profit >= 0 ? '+' : ''}{l.profit.toLocaleString()}
                  </span>
                )
              )}
            </button>
          ))
        )}
      </Card>

      {/* Quick "Play a Friend" invite — opens inline as a popup (no
          navigation) preset to the friend tapped in the list above. */}
      {playFriend && (
        <PlayFriendModal
          isOpen={!!playFriend}
          onClose={() => setPlayFriend(null)}
          friends={friends}
          initialFriend={playFriend}
          currentUser={sessionUser}
          initialBuyIn={sessionUser?.id ? readLastBuyIn(sessionUser.id) : null}
          onOpenMessage={openMessage}
        />
      )}
    </div>
  );
}
