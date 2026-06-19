import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import FramedAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { useBetaMode } from '../../contexts/SiteConfigContext';

const SLIDE_MS = 6000;

// Shared cartoon/arcade tokens — thick black borders + hard offset shadows,
// matching the My Piks arcade theme so the story feels like part of the app.
const INK = '#0a0a0a';
const CARD_BORDER = `2.5px solid ${INK}`;
const HARD_SHADOW = `4px 4px 0 ${INK}`;
const HARD_SHADOW_SM = `3px 3px 0 ${INK}`;
const DOTS = 'radial-gradient(rgba(255,255,255,0.10) 1.6px, transparent 1.6px)';

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTimeLeft(ms) {
  if (!ms || ms <= 0) return 'Final';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

function pickStatusMeta(p) {
  const status = (p.status || 'pending').toLowerCase();
  if (status === 'won' || status === 'win') return { label: 'WIN', color: '#10b981', live: false };
  if (status === 'lost' || status === 'loss') return { label: 'LOSS', color: '#ef4444', live: false };
  return { label: 'LIVE', color: '#facc15', live: true };
}

function buildSlides(battle) {
  const u1 = battle.user1 || {};
  const u2 = battle.user2 || {};
  const u1Bal = parseFloat(u1.balance || 0);
  const u2Bal = parseFloat(u2.balance || 0);
  const u1Pnl = parseFloat(u1.pnlPercent || 0);
  const u2Pnl = parseFloat(u2.pnlPercent || 0);
  const pot = parseFloat(battle.potSize) || 0;
  const u1Lead = u1Bal > u2Bal;
  const u2Lead = u2Bal > u1Bal;
  const tied = u1Bal === u2Bal;
  const picks = battle.picks || {};
  const u1Picks = picks.user1 || [];
  const u2Picks = picks.user2 || [];

  const slides = [
    { kind: 'cover', u1, u2, u1Bal, u2Bal, u1Lead, u2Lead, tied, pot, startsAt: battle.startsAt },
    { kind: 'stakes', pot, u1, u2, u1Pnl, u2Pnl },
  ];
  // Head-to-head competing slips — the heart of the "battle update".
  if (u1Picks.length > 0 || u2Picks.length > 0) {
    slides.push({ kind: 'slips', u1, u2, u1Picks, u2Picks });
  }
  // Live duel tracker — animated balance bar.
  slides.push({ kind: 'duel', u1, u2, u1Bal, u2Bal, u1Pnl, u2Pnl, u1Lead, u2Lead, tied });
  // Who's on top right now.
  slides.push({ kind: 'leader', u1, u2, u1Bal, u2Bal, u1Pnl, u2Pnl, u1Lead, u2Lead, tied });
  return slides;
}

function ProgressBars({ count, activeIdx, progress }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3 flex gap-1">
      {Array.from({ length: count }).map((_, i) => {
        const fill = i < activeIdx ? 100 : i === activeIdx ? progress : 0;
        return (
          <div
            key={i}
            className="flex-1 h-[5px] rounded-full overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(0,0,0,0.5)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${fill}%`, background: '#fff', transition: i === activeIdx ? 'width 0.1s linear' : 'none' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Slide background: bold arcade gradient + dot texture so white sticker cards pop.
function SlideBg({ gradient }) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ background: gradient }} aria-hidden="true" />
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{ backgroundImage: DOTS, backgroundSize: '16px 16px' }}
        aria-hidden="true"
      />
    </>
  );
}

// White sticker chip with the cartoon black border + hard shadow.
function Sticker({ children, className = '', style = {}, anim, delay = 0 }) {
  return (
    <div
      className={`lbsv-anim relative ${className}`}
      style={{
        background: '#ffffff',
        border: CARD_BORDER,
        boxShadow: HARD_SHADOW,
        borderRadius: 16,
        ...(anim ? { animation: `${anim} 0.5s cubic-bezier(0.22,1.4,0.4,1) both`, animationDelay: `${delay}ms` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function AvatarBadge({ user, size = 72, ring = '#3b82f6', anim, delay = 0, bob = false }) {
  return (
    <div
      className="lbsv-anim relative rounded-full"
      style={{
        border: CARD_BORDER,
        boxShadow: HARD_SHADOW,
        background: ring,
        padding: 4,
        animation: [
          anim ? `${anim} 0.55s cubic-bezier(0.22,1.4,0.4,1) both` : null,
          bob ? 'lbsvBob 3s ease-in-out infinite' : null,
        ].filter(Boolean).join(', ') || undefined,
        animationDelay: anim ? `${delay}ms` : undefined,
      }}
    >
      <div className="rounded-full overflow-hidden" style={{ border: '2px solid #fff' }}>
        <FramedAvatar avatar={user.avatar} username={user.username || 'P'} frameId={user.equippedFrame} size={size} bgColor={ring} />
      </div>
    </div>
  );
}

function LiveTag({ delay = 0 }) {
  return (
    <span
      className="lbsv-anim inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest text-white"
      style={{
        background: '#ef4444',
        border: CARD_BORDER,
        animation: 'lbsvLivePulse 1.8s ease-in-out infinite, lbsvUp 0.45s ease-out both',
        animationDelay: `0s, ${delay}ms`,
      }}
    >
      <span className="w-2 h-2 rounded-full bg-white" /> Live Now
    </span>
  );
}

function CoverSlide({ s }) {
  const isBeta = useBetaMode();
  const leaderName = s.tied ? null : s.u1Lead ? (s.u1.username || 'P1') : (s.u2.username || 'P2');
  const unit = isBeta ? '' : '$';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <SlideBg gradient="linear-gradient(160deg,#1d4ed8 0%,#0891b2 100%)" />
      <div className="relative z-10 flex flex-col items-center gap-5 w-full">
        <LiveTag delay={40} />
        <div className="flex items-center justify-center gap-3 w-full">
          <div className="flex flex-col items-center gap-2">
            <AvatarBadge user={s.u1} ring={s.u1Lead ? '#10b981' : '#3b82f6'} anim="lbsvInL" delay={120} bob />
            <Sticker anim="lbsvUp" delay={260} className="px-2.5 py-1" style={{ borderRadius: 12, boxShadow: HARD_SHADOW_SM }}>
              <div className="text-[12px] font-black truncate max-w-[96px]" style={{ color: INK }}>{s.u1.username || 'Player 1'}</div>
            </Sticker>
            <div className="text-[15px] font-black tabular-nums text-white" style={{ textShadow: '1.5px 1.5px 0 #0a0a0a' }}>
              {unit}{formatMoney(s.u1Bal, 0)}
            </div>
          </div>
          <div
            className="lbsv-anim text-4xl font-black italic"
            style={{
              color: '#facc15',
              WebkitTextStroke: '2.5px #0a0a0a',
              paintOrder: 'stroke fill',
              textShadow: HARD_SHADOW_SM,
              animation: 'lbsvVsPunch 0.7s cubic-bezier(0.22,1.4,0.4,1) both',
              animationDelay: '200ms',
            }}
          >
            VS
          </div>
          <div className="flex flex-col items-center gap-2">
            <AvatarBadge user={s.u2} ring={s.u2Lead ? '#10b981' : '#fb923c'} anim="lbsvInR" delay={120} bob />
            <Sticker anim="lbsvUp" delay={300} className="px-2.5 py-1" style={{ borderRadius: 12, boxShadow: HARD_SHADOW_SM }}>
              <div className="text-[12px] font-black truncate max-w-[96px]" style={{ color: INK }}>{s.u2.username || 'Player 2'}</div>
            </Sticker>
            <div className="text-[15px] font-black tabular-nums text-white" style={{ textShadow: '1.5px 1.5px 0 #0a0a0a' }}>
              {unit}{formatMoney(s.u2Bal, 0)}
            </div>
          </div>
        </div>
        <Sticker anim="lbsvUp" delay={380} className="px-4 py-2" style={{ background: '#facc15' }}>
          <div className="text-[12px] font-black uppercase tracking-wider" style={{ color: INK }}>
            {leaderName ? `${leaderName} is in front` : 'All tied up!'}
          </div>
        </Sticker>
        {s.startsAt && (
          <div className="text-[11px] font-bold text-white/85">Started {timeAgo(s.startsAt)}</div>
        )}
      </div>
    </div>
  );
}

function StakesSlide({ s, timeLeft }) {
  const isBeta = useBetaMode();
  const fire1 = s.u1Pnl > 10;
  const fire2 = s.u2Pnl > 10;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
      <SlideBg gradient="linear-gradient(160deg,#b45309 0%,#f59e0b 100%)" />
      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-xs">
        <Sticker anim="lbsvUp" delay={40} className="px-4 py-1.5" style={{ background: '#0a0a0a', border: '2.5px solid #facc15', boxShadow: '4px 4px 0 rgba(0,0,0,0.4)' }}>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#facc15' }}>
            {isBeta ? 'Coin Pot On The Line' : 'Pot On The Line'}
          </div>
        </Sticker>
        <Sticker anim="lbsvPop" delay={140} className="lbsv-shine overflow-hidden px-6 py-4" style={{ background: '#0a0a0a', border: '2.5px solid #facc15' }}>
          <div className="text-5xl font-black tabular-nums text-center" style={{ color: '#ffffff' }}>
            {isBeta ? formatMoney(s.pot, 0) : `$${formatMoney(s.pot, 0)}`}
          </div>
          {isBeta && (
            <div className="text-[11px] font-black uppercase tracking-widest text-center mt-0.5" style={{ color: '#facc15' }}>Clash Coins</div>
          )}
        </Sticker>
        <div className="grid grid-cols-2 gap-3 w-full">
          <PnlTile name={s.u1.username || 'P1'} pnl={s.u1Pnl} fire={fire1} accent="#3b82f6" anim="lbsvInL" delay={260} />
          <PnlTile name={s.u2.username || 'P2'} pnl={s.u2Pnl} fire={fire2} accent="#fb923c" anim="lbsvInR" delay={260} />
        </div>
        <Sticker anim="lbsvUp" delay={380} className="px-4 py-2 inline-flex items-center gap-2" style={{ background: '#facc15' }}>
          <span className="text-base">⏱️</span>
          <span className="text-[12px] font-black uppercase tracking-widest" style={{ color: INK }}>{formatTimeLeft(timeLeft)}</span>
        </Sticker>
      </div>
    </div>
  );
}

function PnlTile({ name, pnl, fire, accent, anim, delay }) {
  const up = pnl >= 0;
  return (
    <Sticker anim={anim} delay={delay} className="px-2.5 py-2 text-center" style={{ boxShadow: HARD_SHADOW_SM }}>
      <div className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: accent }}>
        {name.slice(0, 9)} {fire ? '🔥' : ''}
      </div>
      <div className="text-xl font-black tabular-nums mt-0.5" style={{ color: up ? '#059669' : '#dc2626' }}>
        {up ? '+' : ''}{pnl}%
      </div>
    </Sticker>
  );
}

function PickChip({ p, accent, delay }) {
  const meta = pickStatusMeta(p);
  return (
    <Sticker
      anim="lbsvUp"
      delay={delay}
      className="px-2 py-1.5"
      style={{ boxShadow: HARD_SHADOW_SM, borderRadius: 12 }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="text-[11px] font-black truncate" style={{ color: INK }}>{p.team || 'Pick'}</div>
        <span
          className={meta.live ? 'lbsv-anim' : ''}
          style={{
            fontSize: 8,
            fontWeight: 900,
            padding: '1px 5px',
            borderRadius: 8,
            color: meta.live ? INK : '#fff',
            background: meta.color,
            border: `1.5px solid ${INK}`,
            ...(meta.live ? { animation: 'lbsvWiggle 1.4s ease-in-out infinite' } : {}),
          }}
        >
          {meta.label}
        </span>
      </div>
      {(p.type || p.odds || p.score) && (
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wide truncate" style={{ color: accent }}>
            {p.type}{p.odds ? ` · ${p.odds}` : ''}
          </span>
          {p.score && (
            <span className="text-[9px] font-black tabular-nums px-1 rounded" style={{ color: INK, background: '#facc15', border: `1px solid ${INK}` }}>
              {p.score}
            </span>
          )}
        </div>
      )}
    </Sticker>
  );
}

function SlipColumn({ user, picks, accent, side }) {
  const isL = side === 'u1';
  const empty = !picks || picks.length === 0;
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <AvatarBadge user={user} size={44} ring={accent} anim={isL ? 'lbsvInL' : 'lbsvInR'} delay={80} />
      <div className="text-[11px] font-black text-white truncate max-w-full" style={{ textShadow: '1.2px 1.2px 0 #0a0a0a' }}>
        {user.username || 'Player'}
      </div>
      <div className="w-full flex flex-col gap-1.5">
        {empty ? (
          <Sticker anim="lbsvUp" delay={160} className="px-2 py-2 text-center" style={{ boxShadow: HARD_SHADOW_SM, borderRadius: 12 }}>
            <div className="text-[10px] font-bold" style={{ color: '#6b7280' }}>No picks yet</div>
          </Sticker>
        ) : (
          picks.slice(0, 4).map((p, i) => <PickChip key={i} p={p} accent={accent} delay={160 + i * 90} />)
        )}
      </div>
    </div>
  );
}

function SlipsSlide({ s }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-5 overflow-hidden">
      <SlideBg gradient="linear-gradient(160deg,#1e3a8a 0%,#9a3412 100%)" />
      <div className="relative z-10 flex flex-col items-center gap-3 w-full">
        <Sticker anim="lbsvUp" delay={20} className="px-4 py-1.5" style={{ background: '#facc15' }}>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>The Slips · Head to Head</div>
        </Sticker>
        <div className="flex items-start gap-2 w-full">
          <SlipColumn user={s.u1} picks={s.u1Picks} accent="#3b82f6" side="u1" />
          <div
            className="lbsv-anim self-center text-xl font-black italic flex-shrink-0"
            style={{
              color: '#facc15',
              WebkitTextStroke: '2px #0a0a0a',
              paintOrder: 'stroke fill',
              animation: 'lbsvVsPunch 0.7s cubic-bezier(0.22,1.4,0.4,1) both',
              animationDelay: '120ms',
            }}
          >
            VS
          </div>
          <SlipColumn user={s.u2} picks={s.u2Picks} accent="#fb923c" side="u2" />
        </div>
      </div>
    </div>
  );
}

function DuelSlide({ s, timeLeft }) {
  const isBeta = useBetaMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);
  const total = s.u1Bal + s.u2Bal;
  const targetPct = total > 0 ? (s.u1Bal / total) * 100 : 50;
  const pct = mounted ? targetPct : 50;
  const unit = isBeta ? '' : '$';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
      <SlideBg gradient="linear-gradient(160deg,#065f46 0%,#0891b2 100%)" />
      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm">
        <Sticker anim="lbsvUp" delay={20} className="px-4 py-1.5" style={{ background: '#facc15' }}>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>Live Balance Duel</div>
        </Sticker>

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarBadge user={s.u1} size={40} ring={s.u1Lead ? '#10b981' : '#3b82f6'} anim="lbsvInL" delay={120} />
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white truncate max-w-[80px]" style={{ textShadow: '1px 1px 0 #0a0a0a' }}>{s.u1.username || 'P1'}</div>
              <div className="text-[14px] font-black tabular-nums" style={{ color: '#ffffff', textShadow: '1px 1px 0 #0a0a0a' }}>{unit}{formatMoney(s.u1Bal, 0)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <div className="text-[10px] font-black text-white truncate max-w-[80px] ml-auto" style={{ textShadow: '1px 1px 0 #0a0a0a' }}>{s.u2.username || 'P2'}</div>
              <div className="text-[14px] font-black tabular-nums" style={{ color: '#ffffff', textShadow: '1px 1px 0 #0a0a0a' }}>{unit}{formatMoney(s.u2Bal, 0)}</div>
            </div>
            <AvatarBadge user={s.u2} size={40} ring={s.u2Lead ? '#10b981' : '#fb923c'} anim="lbsvInR" delay={120} />
          </div>
        </div>

        {/* Animated tug-of-war bar */}
        <div
          className="lbsv-anim w-full relative overflow-hidden flex"
          style={{ height: 34, borderRadius: 999, border: CARD_BORDER, boxShadow: HARD_SHADOW, animation: 'lbsvUp 0.5s ease-out both', animationDelay: '180ms' }}
        >
          <div
            className="h-full flex items-center justify-start pl-2"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#2563eb,#3b82f6)', transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }}
          >
            <span className="text-[10px] font-black text-white tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div
            className="h-full flex items-center justify-end pr-2"
            style={{ width: `${100 - pct}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }}
          >
            <span className="text-[10px] font-black text-white tabular-nums">{Math.round(100 - pct)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <PnlTile name={s.u1.username || 'P1'} pnl={s.u1Pnl} fire={s.u1Pnl > 10} accent="#3b82f6" anim="lbsvUp" delay={300} />
          <PnlTile name={s.u2.username || 'P2'} pnl={s.u2Pnl} fire={s.u2Pnl > 10} accent="#fb923c" anim="lbsvUp" delay={360} />
        </div>

        <Sticker anim="lbsvUp" delay={420} className="px-4 py-1.5 inline-flex items-center gap-2" style={{ background: '#0a0a0a', border: '2.5px solid #facc15' }}>
          <span className="text-sm">⏱️</span>
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#facc15' }}>{formatTimeLeft(timeLeft)}</span>
        </Sticker>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 14 }).map((_, i) => ({
      left: `${(i * 7 + 6) % 96}%`,
      delay: `${(i % 7) * 0.18}s`,
      color: ['#facc15', '#3b82f6', '#10b981', '#fb923c', '#06b6d4'][i % 5],
      size: 7 + (i % 3) * 3,
    })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((c, i) => (
        <span
          key={i}
          className="lbsv-anim absolute top-0"
          style={{
            left: c.left,
            width: c.size,
            height: c.size,
            background: c.color,
            border: '1.5px solid #0a0a0a',
            borderRadius: i % 2 ? 2 : 999,
            animation: 'lbsvConfetti 2.4s ease-in infinite',
            animationDelay: c.delay,
          }}
        />
      ))}
    </div>
  );
}

function LeaderSlide({ s, timeLeft }) {
  const isBeta = useBetaMode();
  const leader = s.tied ? null : s.u1Lead ? s.u1 : s.u2;
  const leaderBal = s.tied ? null : s.u1Lead ? s.u1Bal : s.u2Bal;
  const leaderPnl = s.tied ? null : s.u1Lead ? s.u1Pnl : s.u2Pnl;
  const ring = s.u1Lead ? '#3b82f6' : '#fb923c';
  const unit = isBeta ? '' : '$';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
      <SlideBg gradient={s.tied ? 'linear-gradient(160deg,#7c2d12 0%,#f59e0b 100%)' : 'linear-gradient(160deg,#047857 0%,#10b981 100%)'} />
      {!s.tied && <Confetti />}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
        <Sticker anim="lbsvUp" delay={20} className="px-4 py-1.5" style={{ background: '#facc15' }}>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: INK }}>
            {s.tied ? 'Dead Even' : 'Out In Front'}
          </div>
        </Sticker>
        {leader ? (
          <>
            <div className="relative">
              <AvatarBadge user={leader} size={96} ring={s.tied ? '#facc15' : '#10b981'} anim="lbsvPop" delay={120} bob />
              <span
                className="lbsv-anim absolute -top-2 -right-2 text-2xl"
                style={{ animation: 'lbsvWiggle 1.6s ease-in-out infinite' }}
              >
                👑
              </span>
            </div>
            <Sticker anim="lbsvUp" delay={240} className="px-4 py-1.5">
              <div className="text-[16px] font-black truncate max-w-[200px]" style={{ color: INK }}>{leader.username || 'Leader'}</div>
            </Sticker>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-black tabular-nums text-white" style={{ textShadow: '2px 2px 0 #0a0a0a' }}>{unit}{formatMoney(leaderBal, 0)}</div>
              <Sticker anim="lbsvPop" delay={320} className="px-2 py-1" style={{ background: '#10b981', boxShadow: HARD_SHADOW_SM }}>
                <span className="text-[12px] font-black tabular-nums text-white">{leaderPnl >= 0 ? '+' : ''}{leaderPnl}%</span>
              </Sticker>
            </div>
          </>
        ) : (
          <div className="lbsv-anim text-5xl" style={{ animation: 'lbsvBob 2.4s ease-in-out infinite' }}>⚖️</div>
        )}
        <Sticker anim="lbsvUp" delay={400} className="px-4 py-1.5 inline-flex items-center gap-2" style={{ background: '#0a0a0a', border: `2.5px solid ${ring}` }}>
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-white">{formatTimeLeft(timeLeft)}</span>
        </Sticker>
      </div>
    </div>
  );
}

export default function LiveBattleStoryViewer({ battles, startIndex = 0, onClose }) {
  // Track the battle by ID so external refreshes (SSE/poll) that
  // reorder or shrink `battles` don't snap us to the wrong matchup.
  const [activeBattleId, setActiveBattleId] = useState(() => battles?.[startIndex]?.id || null);
  const battleIdx = useMemo(() => {
    if (!activeBattleId) return -1;
    const i = (battles || []).findIndex((b) => b?.id === activeBattleId);
    return i;
  }, [battles, activeBattleId]);
  const setBattleIdx = useCallback((next) => {
    const arr = battles || [];
    const target = typeof next === 'function' ? next(battleIdx) : next;
    const clamped = Math.max(0, Math.min(arr.length - 1, target));
    const id = arr[clamped]?.id;
    if (id) setActiveBattleId(id);
  }, [battles, battleIdx]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startedRef = useRef(Date.now());
  const elapsedAtPauseRef = useRef(0);
  const rafRef = useRef(null);

  const battle = battles?.[battleIdx];
  const slides = useMemo(() => (battle ? buildSlides(battle) : []), [battle]);
  const currentSlide = slides[slideIdx];

  // Live time-left tick for slides that show it
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLeft = battle?.endsAt ? Math.max(0, new Date(battle.endsAt).getTime() - now) : 0;

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0);
    startedRef.current = Date.now();
    elapsedAtPauseRef.current = 0;
  }, [slideIdx, battleIdx]);

  // Reset to slide 0 when battle changes
  useEffect(() => {
    setSlideIdx(0);
  }, [battleIdx]);

  const goNextSlide = useCallback(() => {
    if (slideIdx < slides.length - 1) {
      setSlideIdx((i) => i + 1);
    } else if (battleIdx < (battles?.length || 0) - 1) {
      // Atomically advance to the next battle's first slide so we
      // never render an out-of-bounds index on the new slide array.
      setSlideIdx(0);
      setBattleIdx(battleIdx + 1);
    } else {
      onClose?.();
    }
  }, [slideIdx, slides.length, battleIdx, battles?.length, onClose, setBattleIdx]);

  const goPrevSlide = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx((i) => i - 1);
    } else if (battleIdx > 0) {
      setSlideIdx(0);
      setBattleIdx(battleIdx - 1);
    }
  }, [slideIdx, battleIdx, setBattleIdx]);

  // If the active battle disappears from the live list (matchup
  // ended / removed), gracefully close instead of getting stuck on
  // a stale screen.
  useEffect(() => {
    if (battleIdx < 0) onClose?.();
  }, [battleIdx, onClose]);

  // Keep slideIdx within bounds if the new battle has fewer slides.
  useEffect(() => {
    if (slideIdx >= slides.length && slides.length > 0) {
      setSlideIdx(slides.length - 1);
    }
  }, [slideIdx, slides.length]);

  // Auto-advance with rAF for smooth progress
  useEffect(() => {
    if (paused || !battle) return undefined;
    const tick = () => {
      const elapsed = elapsedAtPauseRef.current + (Date.now() - startedRef.current);
      const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNextSlide();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, slideIdx, battleIdx, goNextSlide, battle]);

  // Pause handlers
  const handlePauseDown = useCallback(() => {
    if (paused) return;
    elapsedAtPauseRef.current += Date.now() - startedRef.current;
    setPaused(true);
  }, [paused]);
  const handlePauseUp = useCallback(() => {
    if (!paused) return;
    startedRef.current = Date.now();
    setPaused(false);
  }, [paused]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') goNextSlide();
      else if (e.key === 'ArrowLeft') goPrevSlide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goNextSlide, goPrevSlide]);

  if (!battle) return null;

  const u1 = battle.user1 || {};
  const u2 = battle.user2 || {};
  const headerLabel = `${(u1.username || 'P1').slice(0, 12)} vs ${(u2.username || 'P2').slice(0, 12)}`;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Live battle highlights: ${headerLabel}`}
    >
      <div
        className="relative w-full h-full sm:h-[88vh] sm:max-h-[760px] sm:w-[420px] sm:rounded-3xl overflow-hidden"
        style={{ background: '#000', border: '3px solid #0a0a0a', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ProgressBars count={slides.length} activeIdx={slideIdx} progress={progress} />

        {/* Header — avatars + label + close */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-7 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full overflow-hidden" style={{ border: '2px solid #0a0a0a' }}>
                <FramedAvatar avatar={u1.avatar} username={u1.username || 'P1'} frameId={u1.equippedFrame} size={28} bgColor="#1e40af" />
              </div>
              <div className="w-7 h-7 rounded-full overflow-hidden" style={{ border: '2px solid #0a0a0a' }}>
                <FramedAvatar avatar={u2.avatar} username={u2.username || 'P2'} frameId={u2.equippedFrame} size={28} bgColor="#7c2d12" />
              </div>
            </div>
            <span className="text-[11px] font-black text-white truncate max-w-[170px]" style={{ textShadow: '1px 1px 0 #0a0a0a' }}>{headerLabel}</span>
            {battles.length > 1 && (
              <span className="text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full" style={{ color: '#0a0a0a', background: '#facc15', border: '1.5px solid #0a0a0a' }}>
                {battleIdx + 1}/{battles.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black"
            style={{ background: '#0a0a0a', border: '2px solid rgba(255,255,255,0.3)' }}
            aria-label="Close story"
          >
            ✕
          </button>
        </div>

        {/* Slide content */}
        <div className="absolute inset-0">
          {currentSlide?.kind === 'cover' && <CoverSlide s={currentSlide} />}
          {currentSlide?.kind === 'stakes' && <StakesSlide s={currentSlide} timeLeft={timeLeft} />}
          {currentSlide?.kind === 'slips' && <SlipsSlide s={currentSlide} />}
          {currentSlide?.kind === 'duel' && <DuelSlide s={currentSlide} timeLeft={timeLeft} />}
          {currentSlide?.kind === 'leader' && <LeaderSlide s={currentSlide} timeLeft={timeLeft} />}
        </div>

        {/* Tap zones — left = previous slide, right = next slide.
            Press-and-hold pauses the auto-advance. */}
        <button
          type="button"
          aria-label="Previous"
          className="absolute left-0 top-12 bottom-20 w-1/3 z-20"
          style={{ background: 'transparent' }}
          onClick={(e) => { e.stopPropagation(); goPrevSlide(); }}
          onMouseDown={handlePauseDown}
          onMouseUp={handlePauseUp}
          onMouseLeave={handlePauseUp}
          onTouchStart={handlePauseDown}
          onTouchEnd={handlePauseUp}
          onTouchCancel={handlePauseUp}
        />
        <button
          type="button"
          aria-label="Next"
          className="absolute right-0 top-12 bottom-20 w-1/3 z-20"
          style={{ background: 'transparent' }}
          onClick={(e) => { e.stopPropagation(); goNextSlide(); }}
          onMouseDown={handlePauseDown}
          onMouseUp={handlePauseUp}
          onMouseLeave={handlePauseUp}
          onTouchStart={handlePauseDown}
          onTouchEnd={handlePauseUp}
          onTouchCancel={handlePauseUp}
        />
      </div>
    </div>
  );
}
