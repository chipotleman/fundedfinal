import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import FramedAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { useBetaMode } from '../../contexts/SiteConfigContext';

const SLIDE_MS = 5000;

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
    { kind: 'cover', u1, u2, u1Bal, u2Bal, u1Lead, u2Lead, tied, pot, startsAt: battle.startsAt, endsAt: battle.endsAt },
    { kind: 'stakes', pot, u1, u2, u1Pnl, u2Pnl, endsAt: battle.endsAt },
  ];
  if (u1Picks.length > 0) {
    slides.push({ kind: 'picks', user: u1, picks: u1Picks, side: 'u1' });
  }
  if (u2Picks.length > 0) {
    slides.push({ kind: 'picks', user: u2, picks: u2Picks, side: 'u2' });
  }
  slides.push({
    kind: 'leader',
    u1, u2, u1Bal, u2Bal, u1Pnl, u2Pnl, u1Lead, u2Lead, tied, endsAt: battle.endsAt,
  });
  return slides;
}

function ProgressBars({ count, activeIdx, progress }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3 flex gap-1">
      {Array.from({ length: count }).map((_, i) => {
        const fill = i < activeIdx ? 100 : i === activeIdx ? progress : 0;
        return (
          <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
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

function StatBubble({ label, value, color = '#fff' }) {
  return (
    <div
      className="rounded-2xl px-3 py-2 text-center"
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '2px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</div>
      <div className="text-base font-black tabular-nums mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function CoverSlide({ s }) {
  const leaderName = s.tied ? null : s.u1Lead ? (s.u1.username || 'P1') : (s.u2.username || 'P2');
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.35) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(251,146,60,0.35) 0%, transparent 55%), linear-gradient(180deg,#0a0a0a 0%, #050505 100%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(239,68,68,0.2)', border: '1.5px solid rgba(239,68,68,0.6)', color: '#fca5a5' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Now
        </span>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div
              className="rounded-full p-[3px]"
              style={{
                background: s.u1Lead ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                boxShadow: s.u1Lead ? '0 0 24px rgba(16,185,129,0.6)' : '0 0 18px rgba(59,130,246,0.55)',
              }}
            >
              <FramedAvatar avatar={s.u1.avatar} username={s.u1.username || 'P1'} frameId={s.u1.equippedFrame} size={68} bgColor="#1e40af" />
            </div>
            <div className="mt-2 text-[12px] font-extrabold text-white truncate max-w-[110px]">{s.u1.username || 'Player 1'}</div>
            <div className="text-[16px] font-black tabular-nums mt-0.5" style={{ color: s.u1Lead ? '#10b981' : '#fff' }}>${formatMoney(s.u1Bal, 0)}</div>
          </div>
          <div
            className="text-3xl font-black italic"
            style={{
              background: 'linear-gradient(180deg,#fde047,#f59e0b,#c2410c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              WebkitTextStroke: '1.5px #0a0a0a',
              textShadow: '0 0 20px rgba(250,204,21,0.5)',
            }}
          >
            VS
          </div>
          <div className="flex flex-col items-center">
            <div
              className="rounded-full p-[3px]"
              style={{
                background: s.u2Lead ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#fb923c,#c2410c)',
                boxShadow: s.u2Lead ? '0 0 24px rgba(16,185,129,0.6)' : '0 0 18px rgba(251,146,60,0.55)',
              }}
            >
              <FramedAvatar avatar={s.u2.avatar} username={s.u2.username || 'P2'} frameId={s.u2.equippedFrame} size={68} bgColor="#7c2d12" />
            </div>
            <div className="mt-2 text-[12px] font-extrabold text-white truncate max-w-[110px]">{s.u2.username || 'Player 2'}</div>
            <div className="text-[16px] font-black tabular-nums mt-0.5" style={{ color: s.u2Lead ? '#10b981' : '#fff' }}>${formatMoney(s.u2Bal, 0)}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {leaderName ? `${leaderName} is in the lead` : 'All tied up'}
        </div>
        {s.startsAt && (
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Started {timeAgo(s.startsAt)}</div>
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
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.18) 0%, transparent 60%), linear-gradient(180deg,#0a0a0a,#050505)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {isBeta ? 'Coin pot on the line' : 'Pot on the line'}
        </div>
        <div
          className="text-5xl font-black tabular-nums"
          style={{
            background: 'linear-gradient(180deg,#fde047,#f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 30px rgba(250,204,21,0.5)',
          }}
        >
          {isBeta ? `${formatMoney(s.pot, 0)} coins` : `$${formatMoney(s.pot, 0)}`}
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <StatBubble
            label={`${(s.u1.username || 'P1').slice(0, 10)} ${fire1 ? '🔥' : ''}`}
            value={`${s.u1Pnl >= 0 ? '+' : ''}${s.u1Pnl}%`}
            color={s.u1Pnl >= 0 ? '#10b981' : '#f87171'}
          />
          <StatBubble
            label={`${(s.u2.username || 'P2').slice(0, 10)} ${fire2 ? '🔥' : ''}`}
            value={`${s.u2Pnl >= 0 ? '+' : ''}${s.u2Pnl}%`}
            color={s.u2Pnl >= 0 ? '#10b981' : '#f87171'}
          />
        </div>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
          <span className="text-base">⏱️</span>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-white">{formatTimeLeft(timeLeft)}</span>
        </div>
      </div>
    </div>
  );
}

function PicksSlide({ s }) {
  const isU1 = s.side === 'u1';
  const accent = isU1 ? '#3b82f6' : '#fb923c';
  const accentSoft = isU1 ? 'rgba(59,130,246,0.35)' : 'rgba(251,146,60,0.35)';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at ${isU1 ? '20% 30%' : '80% 30%'}, ${accentSoft} 0%, transparent 60%), linear-gradient(180deg,#0a0a0a,#050505)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
        <div
          className="rounded-full p-[3px]"
          style={{ background: accent, boxShadow: `0 0 18px ${accentSoft}` }}
        >
          <FramedAvatar avatar={s.user.avatar} username={s.user.username || 'P'} frameId={s.user.equippedFrame} size={56} bgColor={isU1 ? '#1e40af' : '#7c2d12'} />
        </div>
        <div className="text-center">
          <div className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: accent }}>{isU1 ? "Player 1's Picks" : "Player 2's Picks"}</div>
          <div className="text-[15px] font-black text-white truncate max-w-[200px] mt-0.5">{s.user.username || 'Player'}</div>
        </div>
        <div className="w-full flex flex-col gap-2 mt-1">
          {s.picks.slice(0, 4).map((p, i) => {
            const status = (p.status || 'pending').toLowerCase();
            const won = status === 'won' || status === 'win';
            const lost = status === 'lost' || status === 'loss';
            const statusColor = won ? '#10b981' : lost ? '#ef4444' : '#facc15';
            const statusLabel = won ? 'WIN' : lost ? 'LOSS' : 'LIVE';
            return (
              <div
                key={i}
                className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  border: `1.5px solid rgba(255,255,255,0.1)`,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold text-white truncate">{p.team || 'Pick'}</div>
                  {(p.type || p.odds) && (
                    <div className="text-[9px] uppercase tracking-wider truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {p.type}{p.odds ? ` · ${p.odds}` : ''}
                    </div>
                  )}
                </div>
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}
                >
                  {statusLabel}
                </span>
              </div>
            );
          })}
          {s.picks.length === 0 && (
            <div className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>No picks locked yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderSlide({ s, timeLeft }) {
  const leader = s.tied ? null : s.u1Lead ? s.u1 : s.u2;
  const leaderBal = s.tied ? null : s.u1Lead ? s.u1Bal : s.u2Bal;
  const leaderPnl = s.tied ? null : s.u1Lead ? s.u1Pnl : s.u2Pnl;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: s.tied
            ? 'radial-gradient(ellipse at center, rgba(250,204,21,0.2), transparent 60%), linear-gradient(180deg,#0a0a0a,#050505)'
            : 'radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, transparent 60%), linear-gradient(180deg,#0a0a0a,#050505)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xs">
        <div className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {s.tied ? 'Currently Tied' : 'In The Lead'}
        </div>
        {leader ? (
          <>
            <div
              className="rounded-full p-[3px]"
              style={{
                background: 'linear-gradient(135deg,#10b981,#059669)',
                boxShadow: '0 0 28px rgba(16,185,129,0.65)',
              }}
            >
              <FramedAvatar avatar={leader.avatar} username={leader.username || 'P'} frameId={leader.equippedFrame} size={84} bgColor="#065f46" />
            </div>
            <div className="text-[18px] font-black text-white truncate max-w-[220px]">{leader.username || 'Leader'}</div>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-black tabular-nums text-white">${formatMoney(leaderBal, 0)}</span>
              <span
                className="text-[11px] font-black px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.5)' }}
              >
                {leaderPnl >= 0 ? '+' : ''}{leaderPnl}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-3xl font-black text-yellow-300">⚖️ Even Match</div>
        )}
        <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatTimeLeft(timeLeft)}</div>
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
        style={{ background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ProgressBars count={slides.length} activeIdx={slideIdx} progress={progress} />

        {/* Header — avatars + label + close */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-7 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-black">
                <FramedAvatar avatar={u1.avatar} username={u1.username || 'P1'} frameId={u1.equippedFrame} size={28} bgColor="#1e40af" />
              </div>
              <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-black">
                <FramedAvatar avatar={u2.avatar} username={u2.username || 'P2'} frameId={u2.equippedFrame} size={28} bgColor="#7c2d12" />
              </div>
            </div>
            <span className="text-[11px] font-extrabold text-white truncate max-w-[180px]">{headerLabel}</span>
            {battles.length > 1 && (
              <span className="text-[10px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {battleIdx + 1}/{battles.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Close story"
          >
            ✕
          </button>
        </div>

        {/* Slide content */}
        <div className="absolute inset-0">
          {currentSlide?.kind === 'cover' && <CoverSlide s={currentSlide} />}
          {currentSlide?.kind === 'stakes' && <StakesSlide s={currentSlide} timeLeft={timeLeft} />}
          {currentSlide?.kind === 'picks' && <PicksSlide s={currentSlide} />}
          {currentSlide?.kind === 'leader' && (
            <LeaderSlide s={currentSlide} timeLeft={timeLeft} />
          )}
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
