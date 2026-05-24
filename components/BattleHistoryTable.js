import { useState, useMemo, useRef, useEffect } from 'react';
import { formatMoney } from '../utils/formatMoney';
import UserAvatar from './UserAvatar';
import BattleOverviewPopup from './BattleOverviewPopup';

const MODE_THEMES = {
  rush: {
    key: 'rush',
    label: 'RUSH',
    icon: '⚡',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.35)',
    cardBg: 'linear-gradient(135deg, #1a0800 0%, #2d1200 25%, #1a0a00 50%, #0d0500 75%, #050200 100%)',
    accentColor: '#fb923c',
    accentRgb: '251,146,60',
    prizeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
    avatarRing: '#fb923c',
    avatarGlow: '0 0 20px rgba(251,146,60,0.4)',
    glowColor: 'rgba(251,146,60,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef3c7 0%, #fb923c 50%, #ea580c 100%)',
    borderColor: 'rgba(251,146,60,0.35)',
  },
  original: {
    key: 'original',
    label: 'ORIGINAL',
    icon: '🏆',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    cardBg: 'linear-gradient(135deg, #020a18 0%, #0a1628 25%, #122240 50%, #0d1a30 75%, #050d1a 100%)',
    accentColor: '#3b82f6',
    accentRgb: '59,130,246',
    prizeColor: '#facc15',
    badgeBg: 'rgba(59,130,246,0.15)',
    avatarRing: '#3b82f6',
    avatarGlow: '0 0 20px rgba(59,130,246,0.4)',
    glowColor: 'rgba(59,130,246,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  tournament: {
    key: 'tournament',
    label: 'TOURNAMENT',
    icon: '👑',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.35)',
    cardBg: 'linear-gradient(135deg, #050d08 0%, #0d2210 25%, #0a1a0e 50%, #040d06 75%, #020804 100%)',
    accentColor: '#10b981',
    accentRgb: '16,185,129',
    prizeColor: '#10b981',
    badgeBg: 'rgba(16,185,129,0.15)',
    avatarRing: '#10b981',
    avatarGlow: '0 0 20px rgba(16,185,129,0.4)',
    glowColor: 'rgba(16,185,129,0.4)',
    vsGradient: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  standalone: {
    key: 'standalone',
    label: 'PIK',
    icon: '🎫',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.35)',
  },
};

function getGameMode(battle) {
  const dm = battle?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

function formatDateParts(date) {
  if (!date) return { date: '', time: '' };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

const ROWS_PER_PAGE = 10;

const RESULT_STYLES = {
  WON: { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.45)' },
  LOST: { bg: 'rgba(239,68,68,0.18)', color: '#f87171', border: 'rgba(239,68,68,0.45)' },
  OPEN: { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.45)' },
  TIE: { bg: 'rgba(234,179,8,0.18)', color: '#facc15', border: 'rgba(234,179,8,0.45)' },
};

function ModePill({ mode }) {
  const theme = MODE_THEMES[mode] || MODE_THEMES.standalone;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
      style={{
        background: theme.bg,
        color: theme.color,
        border: `1px solid ${theme.border}`,
        fontSize: 10,
        letterSpacing: '0.08em',
      }}
    >
      <span style={{ fontSize: 11 }}>{theme.icon}</span>
      {theme.label}
    </span>
  );
}

function ResultPill({ result }) {
  const style = RESULT_STYLES[result] || RESULT_STYLES.OPEN;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        fontSize: 10,
        letterSpacing: '0.1em',
      }}
    >
      {result}
    </span>
  );
}

function ScoreDisplay({ my, opp, didWin, didLose }) {
  const myColor = didWin ? '#22c55e' : didLose ? '#ef4444' : '#d1d5db';
  const oppColor = didLose ? '#22c55e' : didWin ? '#ef4444' : '#d1d5db';
  return (
    <span className="font-bold tabular-nums" style={{ fontSize: 13 }}>
      <span style={{ color: myColor }}>{my}</span>
      <span className="text-gray-500 mx-1">–</span>
      <span style={{ color: oppColor }}>{opp}</span>
    </span>
  );
}

function PotCell({ value }) {
  return (
    <span className="inline-flex items-center gap-1 text-gray-200 font-semibold tabular-nums" style={{ fontSize: 13 }}>
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
      ${formatMoney(value || 0, 0)}
    </span>
  );
}

function EarningsCell({ value, result }) {
  if (result === 'OPEN') return <span className="text-gray-500" style={{ fontSize: 13 }}>—</span>;
  const positive = value > 0;
  const negative = value < 0;
  const color = positive ? '#22c55e' : negative ? '#ef4444' : '#d1d5db';
  const sign = positive ? '+' : negative ? '-' : '';
  return (
    <span className="font-bold tabular-nums" style={{ color, fontSize: 13 }}>
      {sign}${formatMoney(Math.abs(value), 0)}
    </span>
  );
}

function PlayersCell({ me, opponent }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <UserAvatar
        avatar={me.avatar}
        username={me.username}
        frameId={me.equippedFrame}
        size={26}
        bgColor="#111"
      />
      <span className="text-white text-[12px] font-medium truncate max-w-[110px]">{me.username}</span>
      <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">vs</span>
      <UserAvatar
        avatar={opponent.avatar}
        username={opponent.username}
        frameId={opponent.equippedFrame}
        size={26}
        bgColor="#111"
      />
      <span className="text-white text-[12px] font-medium truncate max-w-[110px]">{opponent.username}</span>
    </div>
  );
}

function ViewDetailsButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider transition-colors"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#d1d5db',
        fontSize: 10,
        letterSpacing: '0.1em',
      }}
    >
      View Details
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function FilterPill({ label, active, onClick, activeColor = '#2563eb' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-1.5 rounded-full font-semibold transition-all"
      style={{
        background: active ? activeColor : 'transparent',
        color: active ? '#fff' : '#9ca3af',
        border: active ? `1px solid ${activeColor}` : '1px solid rgba(75,85,99,0.4)',
        fontSize: 12,
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </button>
  );
}

function buildCsv(rows, myUsername) {
  const header = ['Date', 'Mode', 'Me', 'Opponent', 'My Score', 'Opp Score', 'Pot', 'Result', 'Earnings'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    const d = r.dateRaw ? new Date(r.dateRaw).toISOString() : '';
    lines.push([
      d,
      r.modeLabel,
      myUsername || 'You',
      r.opponent.username,
      r.myScore,
      r.oppScore,
      r.pot,
      r.result,
      r.earnings,
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SortDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);
  const current = options.find(o => o.value === value) || options[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors"
        style={{
          background: '#111',
          border: '1px solid rgba(75,85,99,0.5)',
          color: '#d1d5db',
          fontSize: 12,
          letterSpacing: '0.08em',
        }}
      >
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4" />
        </svg>
        <span className="uppercase">Sort: {current.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 rounded-lg overflow-hidden z-20"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(75,85,99,0.5)',
            minWidth: 200,
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 transition-colors"
              style={{
                background: opt.value === value ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: opt.value === value ? '#fff' : '#d1d5db',
                fontSize: 12,
                letterSpacing: '0.08em',
              }}
            >
              <span className="uppercase font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableHeader({ label, column, sort, onSort, align = 'left' }) {
  const active = sort.column === column;
  const dir = active ? sort.direction : null;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      className={`${alignClass} px-3 py-3 text-gray-400 font-bold uppercase tracking-wider select-none`}
      style={{ fontSize: 10, letterSpacing: '0.1em' }}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 transition-colors hover:text-white"
        style={{
          color: active ? '#fff' : 'inherit',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 10, height: 10, opacity: active ? 1 : 0.3 }}
        >
          {dir === 'asc' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
            </svg>
          ) : dir === 'desc' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4M8 15l4 4 4-4" />
            </svg>
          )}
        </span>
      </button>
    </th>
  );
}

function ModeDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);
  const current = options.find(o => o.value === value) || options[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors"
        style={{
          background: '#111',
          border: '1px solid rgba(75,85,99,0.5)',
          color: '#d1d5db',
          fontSize: 12,
          letterSpacing: '0.08em',
        }}
      >
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="uppercase">{current.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 rounded-lg overflow-hidden z-20"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(75,85,99,0.5)',
            minWidth: 160,
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 transition-colors"
              style={{
                background: opt.value === value ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: opt.value === value ? '#fff' : '#d1d5db',
                fontSize: 12,
                letterSpacing: '0.08em',
              }}
            >
              <span className="uppercase font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const label = (() => {
    if (!from && !to) return 'All dates';
    const f = from ? new Date(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const t = to ? new Date(to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `${f} – ${t}`;
  })();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors"
        style={{
          background: '#111',
          border: '1px solid rgba(75,85,99,0.5)',
          color: '#d1d5db',
          fontSize: 12,
          letterSpacing: '0.08em',
        }}
      >
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="uppercase">{label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 rounded-lg p-3 z-20"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(75,85,99,0.5)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            minWidth: 240,
          }}
        >
          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">From</span>
              <input
                type="date"
                value={from || ''}
                onChange={(e) => onChange({ from: e.target.value || null, to })}
                className="mt-1 w-full px-2 py-1.5 rounded text-white text-sm"
                style={{ background: '#1a1a1a', border: '1px solid rgba(75,85,99,0.5)', colorScheme: 'dark' }}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">To</span>
              <input
                type="date"
                value={to || ''}
                onChange={(e) => onChange({ from, to: e.target.value || null })}
                className="mt-1 w-full px-2 py-1.5 rounded text-white text-sm"
                style={{ background: '#1a1a1a', border: '1px solid rgba(75,85,99,0.5)', colorScheme: 'dark' }}
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                onClick={() => onChange({ from: null, to: null })}
                className="w-full mt-1 px-2 py-1 rounded text-gray-300 text-[11px] uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(75,85,99,0.5)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const push = (v) => pages.push(v);
  const maxAround = 1;
  push(1);
  let last = 1;
  for (let i = Math.max(2, page - maxAround); i <= Math.min(totalPages - 1, page + maxAround); i++) {
    if (i - last > 1) push('…');
    push(i);
    last = i;
  }
  if (totalPages > 1) {
    if (totalPages - last > 1) push('…');
    push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-opacity disabled:opacity-30"
        style={{ background: '#111', border: '1px solid rgba(75,85,99,0.5)', color: '#d1d5db' }}
        aria-label="Previous page"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      {pages.map((p, i) => p === '…' ? (
        <span key={`e${i}`} className="px-1 text-gray-500 text-sm">…</span>
      ) : (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="min-w-[32px] h-8 px-2 rounded-md font-semibold tabular-nums transition-colors"
          style={{
            background: p === page ? 'rgba(37,99,235,0.18)' : '#111',
            color: p === page ? '#fff' : '#d1d5db',
            border: `1px solid ${p === page ? '#2563eb' : 'rgba(75,85,99,0.5)'}`,
            fontSize: 12,
          }}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex items-center gap-1 h-8 px-3 rounded-md font-semibold transition-opacity disabled:opacity-30"
        style={{ background: '#111', border: '1px solid rgba(75,85,99,0.5)', color: '#d1d5db', fontSize: 12 }}
      >
        Next
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

export default function BattleHistoryTable({
  rows,
  myProfile,
  selectedFilter,
  onFilterChange,
  openBattleId,
  onOpenChange,
  renderRowExtras,
}) {
  const [page, setPage] = useState(1);
  const [modeFilter, setModeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [sort, setSort] = useState(() => {
    if (typeof window === 'undefined') return { column: null, direction: null };
    try {
      const raw = window.sessionStorage.getItem('piks:battleHistorySort');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
    return { column: null, direction: null };
  });

  // Persist sort for the session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem('piks:battleHistorySort', JSON.stringify(sort));
    } catch (_) {}
  }, [sort]);

  const handleSort = (column) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      // asc → desc → off
      return { column: null, direction: null };
    });
  };

  // Reset page when filters or sort change
  useEffect(() => { setPage(1); }, [selectedFilter, modeFilter, dateRange.from, dateRange.to, sort.column, sort.direction]);

  const modeOptions = useMemo(() => ([
    { value: 'all', label: 'All Modes' },
    { value: 'rush', label: 'Rush' },
    { value: 'original', label: 'Original' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'standalone', label: 'Standalone' },
  ]), []);

  const filtered = useMemo(() => {
    const base = rows.filter(r => {
      if (modeFilter !== 'all' && r.mode !== modeFilter) return false;
      if (dateRange.from) {
        const fromTs = new Date(dateRange.from).getTime();
        if (!r.dateRaw || new Date(r.dateRaw).getTime() < fromTs) return false;
      }
      if (dateRange.to) {
        const toTs = new Date(dateRange.to).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (!r.dateRaw || new Date(r.dateRaw).getTime() > toTs) return false;
      }
      return true;
    });

    if (!sort.column || !sort.direction) return base;

    // Sort order rank for result column (LOST < TIE < OPEN < WON for asc)
    const resultRank = { LOST: 0, TIE: 1, OPEN: 2, WON: 3 };
    const modeRank = { rush: 0, original: 1, tournament: 2, standalone: 3 };

    const getKey = (r) => {
      switch (sort.column) {
        case 'date': return r.dateRaw ? new Date(r.dateRaw).getTime() : 0;
        case 'mode': return modeRank[r.mode] ?? 99;
        case 'pot': return Number(r.pot) || 0;
        case 'result': return resultRank[r.result] ?? -1;
        case 'earnings': return Number(r.earnings) || 0;
        default: return 0;
      }
    };

    const dir = sort.direction === 'asc' ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      const av = getKey(a);
      const bv = getKey(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      // Tie-break on date desc so equal-keyed rows stay newest-first
      const aDate = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
      const bDate = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
      return bDate - aDate;
    });
    return sorted;
  }, [rows, modeFilter, dateRange.from, dateRange.to, sort.column, sort.direction]);

  const sortOptions = useMemo(() => ([
    { value: 'date-desc', label: 'Date (Newest)' },
    { value: 'date-asc', label: 'Date (Oldest)' },
    { value: 'mode-asc', label: 'Mode (A–Z)' },
    { value: 'mode-desc', label: 'Mode (Z–A)' },
    { value: 'pot-desc', label: 'Pot (High → Low)' },
    { value: 'pot-asc', label: 'Pot (Low → High)' },
    { value: 'result-desc', label: 'Result (Won first)' },
    { value: 'result-asc', label: 'Result (Lost first)' },
    { value: 'earnings-desc', label: 'Earnings (High → Low)' },
    { value: 'earnings-asc', label: 'Earnings (Low → High)' },
    { value: 'default', label: 'Default' },
  ]), []);

  const sortDropdownValue = sort.column && sort.direction
    ? `${sort.column}-${sort.direction}`
    : 'default';

  const onSortDropdownChange = (value) => {
    if (value === 'default') { setSort({ column: null, direction: null }); return; }
    const idx = value.lastIndexOf('-');
    const column = value.slice(0, idx);
    const direction = value.slice(idx + 1);
    setSort({ column, direction });
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  const handleExport = () => {
    const csv = buildCsv(filtered, myProfile?.username);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `piks-battle-history-${stamp}.csv`);
  };

  const filters = ['all', 'open', 'won', 'lost'];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-white font-black tracking-wider" style={{ fontSize: 22, letterSpacing: '0.08em' }}>
            BATTLE HISTORY
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {filters.map(f => (
              <FilterPill
                key={f}
                label={f.toUpperCase()}
                active={selectedFilter === f}
                onClick={() => onFilterChange(f)}
                activeColor={
                  f === 'won' ? '#10b981'
                  : f === 'lost' ? '#ef4444'
                  : f === 'open' ? '#3b82f6'
                  : '#2563eb'
                }
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <div className="md:hidden">
            <SortDropdown value={sortDropdownValue} onChange={onSortDropdownChange} options={sortOptions} />
          </div>
          <ModeDropdown value={modeFilter} onChange={setModeFilter} options={modeOptions} />
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors"
            style={{
              background: '#111',
              border: '1px solid rgba(75,85,99,0.5)',
              color: '#d1d5db',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span className="uppercase">Export</span>
          </button>
        </div>
      </div>

      {/* Table card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,10,12,0.85)',
          border: '1px solid rgba(75,85,99,0.35)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(75,85,99,0.35)' }}>
                <SortableHeader label="Date" column="date" sort={sort} onSort={handleSort} />
                <SortableHeader label="Mode" column="mode" sort={sort} onSort={handleSort} />
                <th className="text-left px-3 py-3 text-gray-400 font-bold uppercase tracking-wider" style={{ fontSize: 10, letterSpacing: '0.1em' }}>Players</th>
                <th className="text-left px-3 py-3 text-gray-400 font-bold uppercase tracking-wider" style={{ fontSize: 10, letterSpacing: '0.1em' }}>Score</th>
                <SortableHeader label="Pot" column="pot" sort={sort} onSort={handleSort} />
                <SortableHeader label="Result" column="result" sort={sort} onSort={handleSort} />
                <SortableHeader label="Earnings" column="earnings" sort={sort} onSort={handleSort} />
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const parts = formatDateParts(r.dateRaw);
                const isLast = i === pageRows.length - 1;
                return (
                  <tr
                    key={r.key}
                    onClick={() => r.openable && onOpenChange(r.matchupId, true)}
                    className={r.openable ? 'cursor-pointer transition-colors hover:bg-white/[0.03]' : ''}
                    style={{ borderBottom: isLast ? 'none' : '1px solid rgba(55,65,81,0.25)' }}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="text-white font-medium leading-tight" style={{ fontSize: 12 }}>{parts.date}</div>
                      <div className="text-gray-500 leading-tight" style={{ fontSize: 11 }}>{parts.time}</div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <ModePill mode={r.mode} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PlayersCell me={r.me} opponent={r.opponent} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <ScoreDisplay
                        my={r.myScore}
                        opp={r.oppScore}
                        didWin={r.result === 'WON'}
                        didLose={r.result === 'LOST'}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PotCell value={r.pot} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <ResultPill result={r.result} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <EarningsCell value={r.earnings} result={r.result} />
                    </td>
                    <td className="px-3 py-3 align-middle text-right">
                      {r.openable && (
                        <ViewDetailsButton onClick={(e) => { e.stopPropagation(); onOpenChange(r.matchupId, true); }} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-500" style={{ fontSize: 13 }}>
                    No battles match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked */}
        <div className="md:hidden">
          {pageRows.map((r, i) => {
            const parts = formatDateParts(r.dateRaw);
            const isLast = i === pageRows.length - 1;
            return (
              <div
                key={r.key}
                onClick={() => r.openable && onOpenChange(r.matchupId, true)}
                className="px-4 py-3 active:bg-white/[0.04]"
                style={{ borderBottom: isLast ? 'none' : '1px solid rgba(55,65,81,0.25)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-white font-medium leading-tight" style={{ fontSize: 12 }}>{parts.date}</div>
                    <div className="text-gray-500 leading-tight" style={{ fontSize: 11 }}>{parts.time}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModePill mode={r.mode} />
                    <ResultPill result={r.result} />
                  </div>
                </div>
                <div className="mb-2">
                  <PlayersCell me={r.me} opponent={r.opponent} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-gray-500 uppercase tracking-wider font-bold" style={{ fontSize: 9 }}>Score</div>
                      <ScoreDisplay
                        my={r.myScore}
                        opp={r.oppScore}
                        didWin={r.result === 'WON'}
                        didLose={r.result === 'LOST'}
                      />
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase tracking-wider font-bold" style={{ fontSize: 9 }}>Pot</div>
                      <PotCell value={r.pot} />
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase tracking-wider font-bold" style={{ fontSize: 9 }}>Earnings</div>
                      <EarningsCell value={r.earnings} result={r.result} />
                    </div>
                  </div>
                  {r.openable && (
                    <ViewDetailsButton onClick={(e) => { e.stopPropagation(); onOpenChange(r.matchupId, true); }} />
                  )}
                </div>
              </div>
            );
          })}
          {pageRows.length === 0 && (
            <div className="px-4 py-16 text-center text-gray-500" style={{ fontSize: 13 }}>
              No battles match the current filters.
            </div>
          )}
        </div>
      </div>

      <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />

      {/* Render popups (controlled by parent via openBattleId) */}
      {renderRowExtras && renderRowExtras({ rows: filtered, openBattleId })}
    </div>
  );
}

export { MODE_THEMES, getGameMode };
