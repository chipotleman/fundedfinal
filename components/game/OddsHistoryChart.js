import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Kalshi-style live odds chart. Plots de-vigged implied win probability
// for the home (blue) and away (orange) teams over time. Self-contained
// SVG — no chart-library dep. Cartoon shell (2.5px #0a0a0a border + 4px
// hard shadow) matches the rest of the arcade theme.

const RANGES = [
  { key: 'LIVE', label: 'LIVE' },
  { key: '1H', label: '1H' },
  { key: '6H', label: '6H' },
  { key: '1D', label: '1D' },
  { key: 'ALL', label: 'ALL' },
];

const AWAY_COLOR = '#fb923c';
const HOME_COLOR = '#3b82f6';
const BORDER = '#0a0a0a';
const SHADOW = '4px 4px 0 0 #0a0a0a';

function americanToImplied(odds) {
  if (odds == null) return null;
  const n = Number(odds);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
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
  if (range === '1D' || range === 'ALL') {
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function OddsHistoryChart({ gameId, homeTeam, awayTeam, liveOdds }) {
  const [range, setRange] = useState('LIVE');
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
    if (!gameId) return;
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
    setLoading(true);
    const ctrl = new AbortController();
    fetchHistory(ctrl.signal);
    const t = setInterval(() => fetchHistory(), 30 * 1000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [fetchHistory]);

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

  // Build the series we actually plot. Stitch a synthetic "now" point
  // on the end using the page's current live odds so the chart never
  // looks stale between snapshot writes.
  const series = useMemo(() => {
    const pts = (data.points || []).filter(p => p.homeImplied != null && p.awayImplied != null);
    if (liveOdds && liveOdds.home != null && liveOdds.away != null) {
      const probs = devig(liveOdds.home, liveOdds.away);
      if (probs.home != null) {
        const last = pts[pts.length - 1];
        const nowPt = {
          t: Date.now(),
          homeML: liveOdds.home,
          awayML: liveOdds.away,
          homeImplied: probs.home,
          awayImplied: probs.away,
          isLive: true,
        };
        if (!last || Math.abs(last.homeImplied - probs.home) > 0.001 || last.t < nowPt.t - 1000) {
          pts.push(nowPt);
        }
      }
    }
    return pts;
  }, [data.points, liveOdds]);

  // Layout constants — keep in viewBox space so the SVG scales fluidly.
  const VB_W = 800;
  const VB_H = 240;
  const PAD_L = 12;
  const PAD_R = 64;  // room for right-edge live labels
  const PAD_T = 16;
  const PAD_B = 28;
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

  // Pointer interaction — find nearest point by x. Works for both mouse
  // and touch via pointer events.
  const onPointerMove = (e) => {
    if (!svgRef.current || series.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const vbX = (px / rect.width) * VB_W;
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
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">Live odds</span>
        </span>
        <span className="text-[11px] text-gray-500 font-semibold">Implied win %</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-bold">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: AWAY_COLOR }} /><span style={{ color: AWAY_COLOR }}>{awayTeam || 'Away'}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: HOME_COLOR }} /><span style={{ color: HOME_COLOR }}>{homeTeam || 'Home'}</span></span>
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
              background: active ? '#fb923c' : '#0d0d0d',
              color: active ? '#0a0a0a' : '#cbd5e1',
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
    <div className="flex flex-col items-center justify-center text-center" style={{ height: 200 }}>
      <div className="text-3xl mb-1">📈</div>
      <div className="text-sm font-bold text-gray-300">Tracking odds…</div>
      <div className="text-xs text-gray-500 mt-1 max-w-[260px]">
        We just started capturing this market. Check back in a few minutes to see how the line moves.
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="rounded-xl p-3 sm:p-4"
      style={{
        background: '#0d0d0d',
        border: `2.5px solid ${BORDER}`,
        boxShadow: SHADOW,
      }}
    >
      {headerLabel}

      {loading && series.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <div className="w-7 h-7 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : series.length === 0 ? (
        emptyState
      ) : (
        <div className="relative w-full" style={{ touchAction: 'pan-y' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="w-full block select-none"
            style={{ height: 'clamp(180px, 32vw, 240px)' }}
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
                stroke={p === 0.5 ? '#27272a' : '#1a1a1a'}
                strokeDasharray={p === 0.5 ? '4 4' : ''}
                strokeWidth="1"
              />
            ))}
            {[0.25, 0.5, 0.75].map((p) => (
              <text
                key={'l-' + p}
                x={PAD_L + plotW + 6}
                y={yOf(p) + 3}
                fontSize="9"
                fill="#3f3f46"
                fontWeight="700"
              >
                {Math.round(p * 100)}%
              </text>
            ))}

            {/* Time axis labels (start / mid / end) */}
            <text x={PAD_L} y={VB_H - 8} fontSize="9" fill="#52525b" fontWeight="700">
              {fmtTime(tMin, range)}
            </text>
            <text x={PAD_L + plotW / 2} y={VB_H - 8} fontSize="9" fill="#52525b" fontWeight="700" textAnchor="middle">
              {fmtTime((tMin + tMax) / 2, range)}
            </text>
            <text x={PAD_L + plotW} y={VB_H - 8} fontSize="9" fill="#52525b" fontWeight="700" textAnchor="end">
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
                <text x={PAD_L + plotW + 23} y={yOf(last.awayImplied) + 2} fontSize="10" fontWeight="800" fill="#0a0a0a" textAnchor="middle">{fmtPct(last.awayImplied)}</text>
              </g>
            )}
            {last && last.homeImplied != null && (
              <g>
                <rect x={PAD_L + plotW + 4} y={yOf(last.homeImplied) - 9} width="38" height="16" rx="4" fill={HOME_COLOR} stroke="#0a0a0a" strokeWidth="1.5" />
                <text x={PAD_L + plotW + 23} y={yOf(last.homeImplied) + 2} fontSize="10" fontWeight="800" fill="#0a0a0a" textAnchor="middle">{fmtPct(last.homeImplied)}</text>
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
                background: '#0a0a0a',
                border: `2px solid ${BORDER}`,
                boxShadow: '2px 2px 0 0 #0a0a0a',
                color: '#e5e7eb',
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
