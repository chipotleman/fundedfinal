import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import UserAvatar from '../UserAvatar';
import TeamLogo from '../TeamLogo';
import { useUserPreview } from '../../contexts/UserPreviewContext';
import { useTheme } from '../../contexts/ThemeContext';

// Quick-challenge popup — lazy so the battle-flow bundle only loads when a
// user actually challenges someone from the search results.
const PlayFriendModal = dynamic(() => import('../battle/PlayFriendModal'), { ssr: false });

// =============================================================================
// DesktopGlobalSearch — the prominent centered search bar for the lg+ top bar
// (Polymarket-style). Searches existing data only: players via the
// session-gated `/api/users/search` endpoint, and games/teams via a lazy,
// cached fetch of `/api/games`. Results show in a dropdown that links to the
// matching profile (`/profile/[id]`) or game (`/game/[id]`).
//
// This component is rendered `hidden lg:flex` by the parent so it never
// affects the mobile/tablet layout.
// =============================================================================
export default function DesktopGlobalSearch() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const isAuthed = authStatus === 'authenticated';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [playFriend, setPlayFriend] = useState(null);
  const [requestedIds, setRequestedIds] = useState(() => new Set());
  const sessionUser = session?.user || null;
  const { openMessage } = useUserPreview();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  // Theme-aware surface/text so the bar isn't a black box on the light page.
  const BAR_BG = isLight ? '#f1f5f9' : '#0d0d0d';
  const BAR_BORDER = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)';
  const PANEL_BG = isLight ? '#ffffff' : '#0a0a0a';
  const PANEL_BORDER = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)';
  const TXT = isLight ? '#0f172a' : '#f5f5f5';
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const gamesCacheRef = useRef(null);
  const debounceRef = useRef(null);

  // Outside-click / Escape dismissal.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lazily load (and cache) the games list the first time the user focuses
  // the search. Reuses the existing `/api/games` endpoint — no new infra.
  const ensureGamesLoaded = useCallback(async () => {
    if (gamesCacheRef.current) return gamesCacheRef.current;
    try {
      const res = await fetch('/api/games');
      if (!res.ok) return [];
      const json = await res.json();
      const list = Array.isArray(json?.games)
        ? json.games
        : Array.isArray(json)
          ? json
          : [];
      gamesCacheRef.current = list;
      return list;
    } catch {
      gamesCacheRef.current = [];
      return [];
    }
  }, []);

  const runSearch = useCallback(
    async (q) => {
      const term = q.trim();
      if (term.length < 2) {
        setPlayers([]);
        setGames([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Player search is session-gated — only query it for authenticated
        // users so logged-out visitors don't fire repeated 401s. Game search
        // works for everyone.
        const [playerRes, gameList] = await Promise.all([
          isAuthed
            ? fetch(`/api/users/search?q=${encodeURIComponent(term)}`)
                .then((r) => (r.ok ? r.json() : { users: [] }))
                .catch(() => ({ users: [] }))
            : Promise.resolve({ users: [] }),
          ensureGamesLoaded(),
        ]);
        setPlayers(Array.isArray(playerRes?.users) ? playerRes.users.slice(0, 6) : []);
        const lower = term.toLowerCase();
        const matchedGames = (gameList || [])
          .filter((g) => {
            // Match both abbreviated (`homeTeam`) and full team names
            // (`homeTeamFull`) so a search like "49ers" finds the
            // "San Francisco 49ers" game even when the card shows "SF".
            const haystack = [
              g.homeTeam, g.home_team, g.home,
              g.awayTeam, g.away_team, g.away,
              g.homeTeamFull, g.awayTeamFull,
              g.sportName, g.league, g.sport,
            ]
              .filter(Boolean)
              .map((v) => v.toString().toLowerCase());
            return haystack.some((v) => v.includes(lower));
          })
          .slice(0, 5);
        setGames(matchedGames);
      } finally {
        setLoading(false);
      }
    },
    [ensureGamesLoaded, isAuthed]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 220);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  const goToPlayer = (p) => {
    setOpen(false);
    setQuery('');
    router.push(`/profile/${p.id}`);
  };

  const goToGame = (g) => {
    setOpen(false);
    setQuery('');
    const id = g.id || g.gameId || g.eventId;
    if (id) router.push(`/game/${id}`);
  };

  // Quick actions from a player result row. Each closes the dropdown but
  // keeps the query so the user can fire another action afterward.
  const quickMessage = (p) => {
    setOpen(false);
    openMessage({ id: p.id, username: p.username, avatar: p.avatar });
  };

  const quickChallenge = (p) => {
    setOpen(false);
    setPlayFriend({ id: p.id, username: p.username, avatar: p.avatar });
  };

  const quickAddFriend = async (p) => {
    if (!p?.id || requestedIds.has(p.id)) return;
    // Optimistically flip to "requested" so the button gives instant
    // feedback; roll back only if the request actually fails.
    setRequestedIds((prev) => new Set(prev).add(p.id));
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ friendId: p.id }),
      });
      if (!res.ok) {
        setRequestedIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      }
    } catch {
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  const awayName = (g) => g.awayTeamFull || g.awayTeam || g.away_team || g.away || 'Away';
  const homeName = (g) => g.homeTeamFull || g.homeTeam || g.home_team || g.home || 'Home';
  const toNum = (v) => {
    const n = typeof v === 'number' ? v : v != null && v !== '' ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const gameScore = (g) => ({
    home: toNum(g.scores?.home?.total ?? g.homeScore ?? g.home_score),
    away: toNum(g.scores?.away?.total ?? g.awayScore ?? g.away_score),
  });
  const gameIsLive = (g) => !!(g.isLive || g.status === 'IN_PROGRESS');
  const gameIsFinal = (g) => !!(g.isCompleted || g.status === 'FINAL');

  const hasResults = players.length > 0 || games.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-[680px]">
      <div
        className="flex items-center gap-2 rounded-full px-4 h-10 transition-colors"
        style={{
          backgroundColor: BAR_BG,
          border: `1px solid ${open ? 'rgba(59,130,246,0.55)' : BAR_BORDER}`,
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
        }}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#6b7280" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            ensureGamesLoaded();
          }}
          placeholder="Search players, teams, games…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: TXT }}
          aria-label="Search players and games"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: PANEL_BG,
            border: `1px solid ${PANEL_BORDER}`,
            boxShadow: isLight ? '0 12px 40px rgba(15,23,42,0.18)' : '0 12px 40px rgba(0,0,0,0.6)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {loading && !hasResults && (
            <div className="px-4 py-4 text-xs" style={{ color: '#6b7280' }}>Searching…</div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-4 text-xs" style={{ color: '#6b7280' }}>
              No matches for “{query.trim()}”.
            </div>
          )}

          {players.length > 0 && (
            <div className="py-1">
              <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                Players
              </div>
              {players.map((p) => {
                const requested = requestedIds.has(p.id);
                return (
                  <div
                    key={`p-${p.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 lg:hover:bg-white/5 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => goToPlayer(p)}
                      className="min-w-0 flex-1 flex items-center gap-3 text-left"
                    >
                      <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <UserAvatar user={{ id: p.id, username: p.username, avatar: p.avatar }} size={32} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate" style={{ color: TXT }}>
                          {p.username}
                        </span>
                        {(p.battleWins != null || p.battleLosses != null) && (
                          <span className="block text-[11px]" style={{ color: '#6b7280' }}>
                            {parseInt(p.battleWins, 10) || 0}W · {parseInt(p.battleLosses, 10) || 0}L
                          </span>
                        )}
                      </span>
                    </button>
                    {isAuthed && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Challenge */}
                        <button
                          type="button"
                          onClick={() => quickChallenge(p)}
                          title={`Battle ${p.username}`}
                          aria-label={`Battle ${p.username}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                          style={{ background: 'rgba(251,146,60,0.14)', border: '1px solid rgba(251,146,60,0.4)', color: '#fdba74' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        {/* Add friend */}
                        <button
                          type="button"
                          onClick={() => quickAddFriend(p)}
                          disabled={requested}
                          title={requested ? 'Request sent' : `Add ${p.username}`}
                          aria-label={requested ? `Request sent to ${p.username}` : `Add ${p.username}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                          style={
                            requested
                              ? { background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', cursor: 'default' }
                              : { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }
                          }
                        >
                          {requested ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <line x1="19" y1="8" x2="19" y2="14" />
                              <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                          )}
                        </button>
                        {/* Message */}
                        <button
                          type="button"
                          onClick={() => quickMessage(p)}
                          title={`Message ${p.username}`}
                          aria-label={`Message ${p.username}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                          style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.4)', color: '#67e8f9' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {games.length > 0 && (
            <div className="py-1" style={{ borderTop: players.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                Games
              </div>
              {games.map((g, i) => {
                const { home: hs, away: as } = gameScore(g);
                const live = gameIsLive(g);
                const final = gameIsFinal(g);
                const showScore = (live || final) && (Number.isFinite(hs) || Number.isFinite(as));
                const awayWins = final && Number.isFinite(hs) && Number.isFinite(as) && as > hs;
                const homeWins = final && Number.isFinite(hs) && Number.isFinite(as) && hs > as;
                return (
                  <button
                    key={`g-${g.id || i}`}
                    type="button"
                    onClick={() => goToGame(g)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left lg:hover:bg-white/5 transition-colors"
                  >
                    <span className="min-w-0 flex-1 flex flex-col gap-1.5">
                      {/* Away */}
                      <span className="flex items-center gap-2">
                        <TeamLogo name={g.awayTeam || g.away_team || g.away} sport={g.sport} size={22} />
                        <span
                          className="min-w-0 flex-1 text-[13px] truncate"
                          style={{ color: TXT, fontWeight: awayWins ? 800 : 600, opacity: final && !awayWins ? 0.6 : 1 }}
                        >
                          {awayName(g)}
                        </span>
                        {showScore && (
                          <span
                            className="text-[13px] tabular-nums"
                            style={{ color: TXT, fontWeight: awayWins ? 800 : 700, opacity: final && !awayWins ? 0.6 : 1 }}
                          >
                            {Number.isFinite(as) ? as : '–'}
                          </span>
                        )}
                      </span>
                      {/* Home */}
                      <span className="flex items-center gap-2">
                        <TeamLogo name={g.homeTeam || g.home_team || g.home} sport={g.sport} size={22} />
                        <span
                          className="min-w-0 flex-1 text-[13px] truncate"
                          style={{ color: TXT, fontWeight: homeWins ? 800 : 600, opacity: final && !homeWins ? 0.6 : 1 }}
                        >
                          {homeName(g)}
                        </span>
                        {showScore && (
                          <span
                            className="text-[13px] tabular-nums"
                            style={{ color: TXT, fontWeight: homeWins ? 800 : 700, opacity: final && !homeWins ? 0.6 : 1 }}
                          >
                            {Number.isFinite(hs) ? hs : '–'}
                          </span>
                        )}
                      </span>
                    </span>
                    {/* Status column */}
                    <span className="flex-shrink-0 flex flex-col items-end gap-1 pl-2 text-right" style={{ minWidth: 52 }}>
                      {live ? (
                        <>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#ef4444' }}>Live</span>
                          </span>
                          {g.period && (
                            <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: '#9ca3af' }}>{g.period}</span>
                          )}
                        </>
                      ) : final ? (
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>Final</span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: '#6b7280' }}>
                          {g.sportName || g.league || g.sport || ''}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {playFriend && (
        <PlayFriendModal
          isOpen={!!playFriend}
          onClose={() => setPlayFriend(null)}
          friends={[]}
          initialFriend={playFriend}
          currentUser={sessionUser}
          onOpenMessage={openMessage}
        />
      )}
    </div>
  );
}
