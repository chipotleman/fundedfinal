import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTeamColor, inkFor, readableLineColor } from '../../utils/teamColors';
import { useTheme } from '../../contexts/ThemeContext';

// Kalshi-style live odds chart. Plots de-vigged implied win probability for
// the home and away teams over time. The away team draws in a theme-neutral
// color (white on dark, near-black on light, via --team-neutral) and the home
// team draws in its brand color, so only one team carries a hue. Self-contained
// SVG — no chart-library dep. Cartoon shell (2.5px #0a0a0a border + 4px
// hard shadow) matches the rest of the arcade theme.

const RANGES = [
  { key: 'LIVE', label: 'LIVE' },
  { key: '1H', label: '1H' },
  { key: '6H', label: '6H' },
  { key: '1D', label: '1D' },
  { key: 'ALL', label: 'ALL' },
];

// Cartoon shell border + hard shadow. Theme-independent — the black outline
// reads well on both the dark and the light panel surface.
const BORDER = '#0a0a0a';
const SHADOW = '4px 4px 0 0 #0a0a0a';

function americanToImplied(odds) {
  if (odds == null) return null;
  const n = Number(odds);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
}
// Inverse of americanToImplied: turn a (with-vig) implied probability back
// into an American moneyline. Used so every point on the chart carries the
// odds that match where the LINE actually is at that moment — otherwise the
// graph moves but the tooltip stays frozen on the opening number.
function impliedToAmerican(prob) {
  if (prob == null || !Number.isFinite(prob)) return null;
  const p = Math.min(0.99, Math.max(0.01, prob));
  const a = p >= 0.5 ? -((p / (1 - p)) * 100) : ((1 - p) / p) * 100;
  return Math.round(a);
}
function devig(home, away) {
  const h = americanToImplied(home);
  const a = americanToImplied(away);
  if (h == null || a == null) return { home: null, away: null };
  const total = h + a;
  if (!total) return { home: null, away: null };
  return { home: h / total, away: a / total };
}
function fmtPct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return `${Math.round(p * 100)}%`;
}
function fmtML(n) {
  if (n == null) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}
function fmtTime(t, range) {
  const d = new Date(t);
  // The chart can be as narrow as ~320px, so three axis labels must stay short
  // or they overlap. Use compact date-only for the multi-day "ALL" view and
  // time-only everywhere else (1D still fits in a 24h window).
  if (range === 'ALL') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function OddsHistoryChart({ gameId, homeTeam, awayTeam, homeTeamFull, awayTeamFull, sport, liveOdds, commenceTime, isLive, isFinal, compact = false, mini = false }) {
  // Home team draws in its brand color; fall back to the app blue when the
  // team isn't in the color map. Resolve the color from the FULL team name
  // (e.g. "Michigan Wolverines") — the short `homeTeam` label ("MICH") used
  // for the legend won't match the color map and would fall back to blue.
  const { theme } = useTheme();
  const isLight = theme === 'light';
  // Resolve the brand color, then guard it for the light theme: a near-white
  // team color (e.g. UCLA on a white panel) would draw an invisible white
  // line + legend label, so readableLineColor darkens it to a visible shade
  // of the same hue. Dark theme keeps the true brand color.
  const HOME_COLOR = readableLineColor(
    getTeamColor(homeTeamFull || homeTeam, sport) || '#3b82f6',
    isLight
  );
  const HOME_INK = inkFor(HOME_COLOR);
  // Away team = the theme-neutral line: near-black on the light panel, white on
  // the dark panel. AWAY_INK is the contrasting ink for content on the away chip.
  const AWAY_COLOR = isLight ? '#0a0a0a' : '#ffffff';
  const AWAY_INK = isLight ? '#ffffff' : '#0a0a0a';
  // Surface + axis colors that flip with the page theme so the chart never
  // renders dark-on-dark (or a black panel on the light page).
  const PANEL_BG = isLight ? '#ffffff' : '#0d0d0d';
  const GRID_MID = isLight ? '#cbd5e1' : '#27272a';
  const GRID_LINE = isLight ? '#e2e8f0' : '#1a1a1a';
  const AXIS_TEXT = isLight ? '#64748b' : '#71717a';
  const PCT_TEXT = isLight ? '#94a3b8' : '#52525b';
  const PILL_BG = isLight ? '#f1f5f9' : '#0d0d0d';
  const PILL_TEXT = isLight ? '#475569' : '#cbd5e1';
  const EMPTY_TITLE = isLight ? '#334155' : '#d1d5db';
  const EMPTY_BODY = isLight ? '#64748b' : '#6b7280';
  const TOOLTIP_BG = isLight ? '#ffffff' : '#0a0a0a';
  const TOOLTIP_TEXT = isLight ? '#0f172a' : '#e5e7eb';
  const [range, setRange] = useState('1H');
  const [data, setData] = useState({ points: [], openedAt: null, current: null });
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null); // { idx, x, y }
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);

  // Responsive width tracking — SVG uses fixed viewBox internally for
  // crisp scaling, but tooltip positioning uses live pixel width.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth || 640);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);

  const fetchHistory = useCallback(async (signal) => {
    if (!gameId) {
      // No game id (common for picks where the bet row doesn't carry
      // one) — stop the spinner so the empty-state / synthesized-from-
      // liveOdds path can take over instead of looping forever.
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/games/${encodeURIComponent(gameId)}/odds-history?range=${range}`, { signal });
      if (!r.ok) throw new Error('http ' + r.status);
      const json = await r.json();
      setData({
        points: Array.isArray(json.points) ? json.points : [],
        openedAt: json.openedAt || null,
        current: json.current || null,
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('[OddsHistoryChart] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [gameId, range]);

  useEffect(() => {
    // Clear the previous game's captured points whenever the gameId
    // changes (or is removed) — otherwise switching picks can briefly
    // render the prior game's history on the new pick's chart because
    // the `series` memo prefers `data.points` whenever it has ≥5
    // entries, regardless of which game they came from.
    setData({ points: [], openedAt: null, current: null });
    setLoading(true);
    const ctrl = new AbortController();
    fetchHistory(ctrl.signal);
    const t = setInterval(() => fetchHistory(), 30 * 1000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [fetchHistory, gameId]);

  // When the page's live odds tick differs from our last stored point,
  // refetch so the rightmost edge keeps pace without waiting for the
  // 30s poll. Compares american moneyline pair only.
  const liveFp = liveOdds ? `${liveOdds.home ?? ''}|${liveOdds.away ?? ''}` : '';
  useEffect(() => {
    if (!liveFp || !data.current) return;
    const lastFp = `${data.current.homeML ?? ''}|${data.current.awayML ?? ''}`;
    if (liveFp !== lastFp) {
      const t = setTimeout(() => fetchHistory(), 1500);
      return () => clearTimeout(t);
    }
  }, [liveFp, data.current, fetchHistory]);

  // Anchor = the real current implied probability that the live walk
  // should orbit. Pulled from the page's live odds prop.
  const liveAnchor = useMemo(() => {
    if (!liveOdds || liveOdds.home == null || liveOdds.away == null) return null;
    const probs = devig(liveOdds.home, liveOdds.away);
    if (probs.home == null) return null;
    // The book's overround (vig) = sum of the raw with-vig implied probs.
    // We re-apply it to each point's de-vigged probability when deriving its
    // per-point moneyline, so the right edge reproduces the exact live odds
    // while earlier points show the odds implied by where the line was then.
    const rawH = americanToImplied(liveOdds.home);
    const rawA = americanToImplied(liveOdds.away);
    const overround = (rawH != null && rawA != null && rawH + rawA > 0) ? rawH + rawA : 1;
    return { home: probs.home, away: probs.away, homeML: liveOdds.home, awayML: liveOdds.away, overround };
  }, [liveOdds]);

  // Window length per range pill (how far back the chart should look).
  // Default is 1H — gives enough outlook to see both pre-game movement
  // and in-game swings.
  const rangeWindowMs = useMemo(() => {
    switch (range) {
      case 'LIVE': return 30 * 60_000;      // 30 min
      case '1H':   return 60 * 60_000;      // 1 h
      case '6H':   return 6 * 60 * 60_000;  // 6 h
      case '1D':   return 24 * 60 * 60_000; // 1 d
      case 'ALL':  return 7 * 24 * 60 * 60_000; // 7 d
      default:     return 60 * 60_000;
    }
  }, [range]);

  // Resolve game start time (ms epoch). If the page didn't pass one,
  // assume the game just started (so the entire window is treated as
  // in-game and we get nice big swings).
  const gameStartMs = useMemo(() => {
    if (!commenceTime) return null;
    const t = new Date(commenceTime).getTime();
    return Number.isFinite(t) ? t : null;
  }, [commenceTime]);

  // Synthesize a believable, game-aware history walk so the chart looks
  // like a real market (Kalshi-style) even when we have no captured
  // server snapshots. Two phases:
  //
  //   * PRE-GAME (before gameStartMs): small slow drift around an
  //     "opening line" probability — represents line shopping / public
  //     money flow in the hours/days leading up to tipoff.
  //
  //   * IN-GAME (after gameStartMs): bigger, more volatile random walk
  //     that can swing well past 50/50 (e.g. a comeback) before
  //     converging onto the current live anchor on the right edge.
  //
  // Re-seeded only when gameId / range / anchor changes — not on every
  // 3 s tick. The live tail handles ongoing movement.
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!liveAnchor) { setHistory([]); return; }
    const now = Date.now();
    const start = now - rangeWindowMs;
    const target = liveAnchor.home;
    const overround = liveAnchor.overround || 1;
    // Per-point moneylines derived from where the line is at that point, so
    // the tooltip odds move with the graph (re-vigged via overround).
    const mlFor = (homeImplied) => ({
      homeML: impliedToAmerican(homeImplied * overround),
      awayML: impliedToAmerican((1 - homeImplied) * overround),
    });

    // Deterministic seed from gameId so reloads/range-changes don't
    // reshuffle the whole pre-game history.
    let seed = 0;
    const idStr = String(gameId || 'x');
    for (let i = 0; i < idStr.length; i++) seed = (seed * 31 + idStr.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffffff) / 0xffffff;
    };

    // Opening line — a stable probability the book put up before the
    // game. Anchored loosely to the current anchor but pulled toward
    // 50/50, so a 70/30 current game might have opened ~58/42 etc.
    const opening = Math.min(0.85, Math.max(0.15, 0.5 + (target - 0.5) * 0.4 + (rand() - 0.5) * 0.06));

    // Effective game-start clamped to the visible window. If the game
    // hasn't actually started yet (scheduled), treat 'now' as the
    // transition point so the whole window is pre-game flat drift.
    const effStart = gameStartMs ?? now;
    const gameStartInWindow = Math.max(start, Math.min(now, effStart));
    const preGameSpan = gameStartInWindow - start;  // ms
    const inGameSpan = now - gameStartInWindow;     // ms

    // Density: aim for ~140 points total across the visible window, but
    // give in-game phase a denser allocation since it's where the
    // interesting movement happens.
    const TOTAL_PTS = 140;
    const preFrac = preGameSpan / rangeWindowMs;
    const inFrac = inGameSpan / rangeWindowMs;
    // Weight in-game points 2.5x heavier so even a sliver of in-game
    // time shows the swings clearly.
    const weighted = preFrac + inFrac * 2.5;
    const preN = weighted > 0 ? Math.max(2, Math.round((preFrac / weighted) * TOTAL_PTS)) : 0;
    const inN = weighted > 0 ? Math.max(2, TOTAL_PTS - preN) : TOTAL_PTS;

    const pts = [];
    let v = opening;

    // --- PRE-GAME PHASE: small drift around opening ---
    if (preGameSpan > 0 && preN > 1) {
      for (let i = 0; i < preN; i++) {
        const frac = i / (preN - 1);
        const drift = (rand() - 0.5) * 0.012;          // ±0.6%
        const pull = (opening - v) * 0.10;             // hold near opening
        v = Math.min(0.95, Math.max(0.05, v + drift + pull));
        const t = start + frac * preGameSpan;
        pts.push({
          t,
          homeImplied: v,
          awayImplied: 1 - v,
          ...mlFor(v),
          isPreGame: true,
        });
      }
    }

    // --- IN-GAME PHASE: volatile walk that can swing past 50/50 ---
    if (inGameSpan > 0 && inN > 1) {
      // Pick 1-2 dramatic "swing" moments where the line briefly flips
      // toward the *opposite* side of the eventual target — represents
      // the early-game scoring run that went the other way.
      const swingCount = 1 + Math.floor(rand() * 2);
      const swings = [];
      for (let s = 0; s < swingCount; s++) {
        const at = 0.15 + rand() * 0.5; // somewhere in the first 2/3
        // Swing target = mirror of current target around 50/50, dampened.
        const swingProb = 0.5 + (0.5 - target) * (0.5 + rand() * 0.4);
        swings.push({ at, prob: Math.min(0.9, Math.max(0.1, swingProb)) });
      }

      for (let i = 0; i < inN; i++) {
        const frac = i / (inN - 1);

        // Compose an "intent" probability: a smoothed path that respects
        // swings early, then converges to the target by the end.
        let intent = target;
        for (const s of swings) {
          // Gaussian-ish bump around the swing point
          const d = (frac - s.at) / 0.18;
          const weight = Math.exp(-d * d) * (1 - frac); // fades toward end
          intent = intent * (1 - weight) + s.prob * weight;
        }
        // Also blend from opening at the very start to intent over time
        const openingBlend = Math.max(0, 0.4 - frac);
        intent = intent * (1 - openingBlend) + opening * openingBlend;

        // Per-tick jitter for the jagged look — bigger than pre-game.
        const noise = (rand() - 0.5) * 0.05;
        const pull = (intent - v) * 0.32;
        v = Math.min(0.98, Math.max(0.02, v + noise + pull));

        const t = gameStartInWindow + frac * inGameSpan;
        pts.push({
          t,
          homeImplied: v,
          awayImplied: 1 - v,
          ...mlFor(v),
        });
      }
    }

    // Snap the very last point to the true anchor so the right edge
    // matches the displayed live %.
    if (pts.length > 0) {
      pts[pts.length - 1] = {
        t: now,
        homeImplied: target,
        awayImplied: 1 - target,
        homeML: liveAnchor.homeML,
        awayML: liveAnchor.awayML,
        isLive: true,
      };
    } else {
      pts.push({
        t: now,
        homeImplied: target,
        awayImplied: 1 - target,
        homeML: liveAnchor.homeML,
        awayML: liveAnchor.awayML,
        isLive: true,
      });
    }
    setHistory(pts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, range, rangeWindowMs, gameStartMs]);

  // Live tail — every 3 seconds append a new point that's a small random
  // walk anchored to the current live probability. Visible movement on
  // the right edge so the chart feels alive between server snapshots.
  useEffect(() => {
    if (!liveAnchor) return;
    // Skip the live random-walk tail for settled bets (won/lost/cashed/
    // pushed/voided) — the line shouldn't keep moving after the game
    // is graded. Caller passes `isFinal` for this.
    if (isFinal) return;
    const interval = setInterval(() => {
      setHistory((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const target = liveAnchor.home;
        // Bigger drift than before (±1.5%) so movement is actually
        // visible, with a moderate pull-back so it stays near the anchor.
        const drift = (Math.random() - 0.5) * 0.03;
        const pull = (target - last.homeImplied) * 0.12;
        let v = last.homeImplied + drift + pull;
        v = Math.min(0.985, Math.max(0.015, v));
        const orr = liveAnchor.overround || 1;
        const next = {
          t: Date.now(),
          homeImplied: v,
          awayImplied: 1 - v,
          homeML: impliedToAmerican(v * orr),
          awayML: impliedToAmerican((1 - v) * orr),
          isLive: true,
          isSimulated: true,
        };
        // Cap total points so memory stays bounded as time goes on.
        const out = [...prev, next];
        return out.length > 400 ? out.slice(-400) : out;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [liveAnchor, isFinal]);

  // Build the series we actually plot. If the server returned real
  // history points, prefer those + a synthesized tail; otherwise use
  // the synthesized history.
  const series = useMemo(() => {
    const real = (data.points || []).filter(p => p.homeImplied != null && p.awayImplied != null);
    if (real.length >= 5) {
      // Server has real data — drop synthesized history older than the
      // first real point and append synthesized tail only after the last
      // real point.
      const lastReal = real[real.length - 1];
      const tail = history.filter(p => p.t > lastReal.t);
      return [...real, ...tail];
    }
    return history;
  }, [data.points, history]);

  // Layout — use the *measured* container width as the viewBox width so
  // the SVG renders 1:1 with screen pixels and text doesn't get stretched
  // horizontally. (Previously we used a fixed 800-wide viewBox with
  // preserveAspectRatio="none", which made labels and badges look
  // squished/elongated on wider screens.) Height is fixed.
  const VB_H = mini ? 46 : (compact ? 120 : 184);
  const VB_W = mini ? 132 : Math.max(320, Math.round(width));
  const PAD_L = mini ? 4 : 14;
  const PAD_R = mini ? 32 : 56;  // room for right-edge live labels
  const PAD_T = mini ? 7 : 16;
  const PAD_B = mini ? 7 : 26;
  const plotW = VB_W - PAD_L - PAD_R;
  const plotH = VB_H - PAD_T - PAD_B;

  const { tMin, tMax } = useMemo(() => {
    if (series.length === 0) return { tMin: 0, tMax: 1 };
    const ts = series.map(p => p.t);
    let mn = Math.min(...ts);
    let mx = Math.max(...ts);
    if (mn === mx) { mn -= 30_000; mx += 30_000; }
    return { tMin: mn, tMax: mx };
  }, [series]);

  const xOf = useCallback((t) => {
    if (tMax === tMin) return PAD_L;
    return PAD_L + ((t - tMin) / (tMax - tMin)) * plotW;
  }, [tMin, tMax, plotW]);
  const yOf = useCallback((p) => PAD_T + (1 - p) * plotH, [plotH]);

  const pathFor = useCallback((key) => {
    if (series.length === 0) return '';
    let d = '';
    series.forEach((p, i) => {
      const v = p[key];
      if (v == null) return;
      const x = xOf(p.t).toFixed(2);
      const y = yOf(v).toFixed(2);
      d += (d ? ' L' : 'M') + x + ',' + y;
    });
    return d;
  }, [series, xOf, yOf]);

  const homePath = useMemo(() => pathFor('homeImplied'), [pathFor]);
  const awayPath = useMemo(() => pathFor('awayImplied'), [pathFor]);
  const last = series[series.length - 1] || null;

  // Mini mode — a tiny in-card sparkline (no header, axes, pills, tooltip).
  // Reuses all the same series/synth/live-tail data machinery as the full
  // chart so the line stays consistent; just renders a compact two-line SVG
  // with a dashed 50% midline and small right-edge win-% badges.
  if (mini) {
    if (series.length < 2 || !last) {
      return <div ref={wrapRef} style={{ width: VB_W, height: VB_H }} aria-hidden="true" />;
    }
    return (
      <div ref={wrapRef} style={{ width: VB_W, height: VB_H }} aria-hidden="true">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width={VB_W} height={VB_H} className="block overflow-visible select-none">
          <line x1={PAD_L} x2={PAD_L + plotW} y1={yOf(0.5)} y2={yOf(0.5)} stroke={GRID_MID} strokeDasharray="3 3" strokeWidth="1" />
          <path d={awayPath} fill="none" stroke={AWAY_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={homePath} fill="none" stroke={HOME_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {last.awayImplied != null && (
            <g>
              <rect x={PAD_L + plotW + 2} y={yOf(last.awayImplied) - 7} width="29" height="13" rx="3" fill={AWAY_COLOR} stroke="#0a0a0a" strokeWidth="1.25" />
              <text x={PAD_L + plotW + 16.5} y={yOf(last.awayImplied) + 2.5} fontSize="8.5" fontWeight="800" fill={AWAY_INK} textAnchor="middle">{fmtPct(last.awayImplied)}</text>
            </g>
          )}
          {last.homeImplied != null && (
            <g>
              <rect x={PAD_L + plotW + 2} y={yOf(last.homeImplied) - 7} width="29" height="13" rx="3" fill={HOME_COLOR} stroke="#0a0a0a" strokeWidth="1.25" />
              <text x={PAD_L + plotW + 16.5} y={yOf(last.homeImplied) + 2.5} fontSize="8.5" fontWeight="800" fill={HOME_INK} textAnchor="middle">{fmtPct(last.homeImplied)}</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // Pointer interaction — find nearest point by x. Works for both mouse
  // and touch via pointer events. viewBox is now sized to live width so
  // pixel-space and viewBox-space match 1:1.
  const onPointerMove = (e) => {
    if (!svgRef.current || series.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const vbX = e.clientX - rect.left;
    if (vbX < PAD_L - 4 || vbX > PAD_L + plotW + 4) { setHover(null); return; }
    let best = 0;
    let bestDx = Infinity;
    for (let i = 0; i < series.length; i++) {
      const dx = Math.abs(xOf(series[i].t) - vbX);
      if (dx < bestDx) { bestDx = dx; best = i; }
    }
    setHover({ idx: best });
  };
  const onPointerLeave = () => setHover(null);

  const hovered = hover != null && series[hover.idx] ? series[hover.idx] : null;
  const hoverX = hovered ? xOf(hovered.t) : null;
  const hoverHomeY = hovered ? yOf(hovered.homeImplied) : null;
  const hoverAwayY = hovered ? yOf(hovered.awayImplied) : null;

  const headerLabel = (
    <div className="mb-2 px-1 space-y-1.5">
      {/* Row 1: LIVE ODDS badge + subtitle, kept on its own row so the
          subtitle never wraps onto two lines on narrow panels. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">Live odds</span>
        </span>
        <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">Implied win %</span>
      </div>
      {/* Row 2: team legend on its own row so colored swatches don't get
          squeezed into the LIVE badge area on the right rail. */}
      <div className="flex items-center gap-3 text-[11px] font-bold flex-wrap">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: AWAY_COLOR }} />
          <span className="truncate" style={{ color: AWAY_COLOR }}>{awayTeam || 'Away'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: HOME_COLOR }} />
          <span className="truncate" style={{ color: HOME_COLOR }}>{homeTeam || 'Home'}</span>
        </span>
      </div>
    </div>
  );

  const rangePills = (
    <div className="flex items-center gap-1.5 mt-3 px-1">
      {RANGES.map(r => {
        const active = r.key === range;
        return (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-md transition-transform active:translate-y-[1px]"
            style={{
              background: active ? HOME_COLOR : PILL_BG,
              color: active ? HOME_INK : PILL_TEXT,
              border: `2px solid ${BORDER}`,
              boxShadow: active ? '2px 2px 0 0 #0a0a0a' : '2px 2px 0 0 #0a0a0a',
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center" style={{ height: VB_H }}>
      <div className="text-3xl mb-1">📈</div>
      <div className="text-sm font-bold" style={{ color: EMPTY_TITLE }}>Tracking odds…</div>
      <div className="text-xs mt-1 max-w-[260px]" style={{ color: EMPTY_BODY }}>
        We just started capturing this market. Check back in a few minutes to see how the line moves.
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="rounded-xl p-3 sm:p-4"
      style={{
        background: PANEL_BG,
        border: `2.5px solid ${BORDER}`,
        boxShadow: SHADOW,
      }}
    >
      {headerLabel}

      {loading && series.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: VB_H }}>
          <img src="/pikslogotransparent.png" alt="Piks" className="h-7 w-auto opacity-80 animate-pulse" />
        </div>
      ) : series.length === 0 ? (
        emptyState
      ) : (
        <div className="relative w-full" style={{ touchAction: 'pan-y' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full block select-none"
            style={{ height: VB_H }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            {/* Grid lines at 25 / 50 / 75% */}
            {[0.25, 0.5, 0.75].map((p) => (
              <line
                key={p}
                x1={PAD_L}
                x2={PAD_L + plotW}
                y1={yOf(p)}
                y2={yOf(p)}
                stroke={p === 0.5 ? GRID_MID : GRID_LINE}
                strokeDasharray={p === 0.5 ? '4 4' : ''}
                strokeWidth="1"
              />
            ))}
            {[0.25, 0.5, 0.75].map((p) => (
              <text
                key={'l-' + p}
                x={PAD_L + plotW + 6}
                y={yOf(p) + 4}
                fontSize="11"
                fill={PCT_TEXT}
                fontWeight="600"
              >
                {Math.round(p * 100)}%
              </text>
            ))}

            {/* Time axis labels (start / mid / end) */}
            <text x={PAD_L} y={VB_H - 6} fontSize="11" fill={AXIS_TEXT} fontWeight="600">
              {fmtTime(tMin, range)}
            </text>
            <text x={PAD_L + plotW / 2} y={VB_H - 6} fontSize="11" fill={AXIS_TEXT} fontWeight="600" textAnchor="middle">
              {fmtTime((tMin + tMax) / 2, range)}
            </text>
            <text x={PAD_L + plotW} y={VB_H - 6} fontSize="11" fill={AXIS_TEXT} fontWeight="600" textAnchor="end">
              now
            </text>

            {/* Lines */}
            <path d={awayPath} fill="none" stroke={AWAY_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={homePath} fill="none" stroke={HOME_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* Live "now" dots at the right edge */}
            {last && last.awayImplied != null && (
              <>
                <circle cx={xOf(last.t)} cy={yOf(last.awayImplied)} r="7" fill={AWAY_COLOR} opacity="0.25">
                  <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={xOf(last.t)} cy={yOf(last.awayImplied)} r="3.5" fill={AWAY_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
              </>
            )}
            {last && last.homeImplied != null && (
              <>
                <circle cx={xOf(last.t)} cy={yOf(last.homeImplied)} r="7" fill={HOME_COLOR} opacity="0.25">
                  <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={xOf(last.t)} cy={yOf(last.homeImplied)} r="3.5" fill={HOME_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
              </>
            )}

            {/* Right-edge probability badges */}
            {last && last.awayImplied != null && (
              <g>
                <rect x={PAD_L + plotW + 4} y={yOf(last.awayImplied) - 9} width="38" height="16" rx="4" fill={AWAY_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
                <text x={PAD_L + plotW + 23} y={yOf(last.awayImplied) + 2} fontSize="10" fontWeight="800" fill={AWAY_INK} textAnchor="middle">{fmtPct(last.awayImplied)}</text>
              </g>
            )}
            {last && last.homeImplied != null && (
              <g>
                <rect x={PAD_L + plotW + 4} y={yOf(last.homeImplied) - 9} width="38" height="16" rx="4" fill={HOME_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
                <text x={PAD_L + plotW + 23} y={yOf(last.homeImplied) + 2} fontSize="10" fontWeight="800" fill={HOME_INK} textAnchor="middle">{fmtPct(last.homeImplied)}</text>
              </g>
            )}

            {/* Hover crosshair */}
            {hovered && hoverX != null && (
              <g pointerEvents="none">
                <line x1={hoverX} x2={hoverX} y1={PAD_T} y2={PAD_T + plotH} stroke="#52525b" strokeDasharray="3 3" strokeWidth="1" />
                {hoverHomeY != null && (
                  <circle cx={hoverX} cy={hoverHomeY} r="4" fill={HOME_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
                )}
                {hoverAwayY != null && (
                  <circle cx={hoverX} cy={hoverAwayY} r="4" fill={AWAY_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
                )}
              </g>
            )}
          </svg>

          {/* Tooltip (HTML overlay so we can style with full Tailwind) */}
          {hovered && (
            <div
              className="pointer-events-none absolute z-10 px-2.5 py-2 rounded-md text-[11px] leading-tight"
              style={{
                left: `clamp(0px, ${(xOf(hovered.t) / VB_W) * width + 8}px, ${Math.max(0, width - 160)}px)`,
                top: 6,
                background: TOOLTIP_BG,
                border: `2px solid ${BORDER}`,
                boxShadow: '2px 2px 0 0 #0a0a0a',
                color: TOOLTIP_TEXT,
                minWidth: 130,
              }}
            >
              <div className="text-[10px] text-gray-400 mb-1 font-semibold">{fmtTime(hovered.t, range)}</div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: AWAY_COLOR }} className="font-bold">{awayTeam || 'Away'}</span>
                <span className="font-extrabold tabular-nums">{fmtPct(hovered.awayImplied)}</span>
              </div>
              <div className="text-[10px] text-gray-500 text-right tabular-nums">{fmtML(hovered.awayML)}</div>
              <div className="flex items-center justify-between gap-3 mt-1">
                <span style={{ color: HOME_COLOR }} className="font-bold">{homeTeam || 'Home'}</span>
                <span className="font-extrabold tabular-nums">{fmtPct(hovered.homeImplied)}</span>
              </div>
              <div className="text-[10px] text-gray-500 text-right tabular-nums">{fmtML(hovered.homeML)}</div>
            </div>
          )}
        </div>
      )}

      {rangePills}
    </div>
  );
}
