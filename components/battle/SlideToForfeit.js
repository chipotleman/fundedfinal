import { useRef, useState, useEffect, useCallback } from 'react';
import haptic from '../../utils/haptics';

export default function SlideToForfeit({ onConfirm, disabled = false }) {
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const startPointerXRef = useRef(0);
  const startThumbRef = useRef(0);
  const thumbXRef = useRef(0);
  const maxXRef = useRef(0);
  const [thumbX, setThumbX] = useState(0);
  const [maxX, setMaxX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const THUMB = 44;
  const COMPLETE_RATIO = 0.88;

  useEffect(() => { thumbXRef.current = thumbX; }, [thumbX]);
  useEffect(() => { maxXRef.current = maxX; }, [maxX]);

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setMaxX(Math.max(0, el.clientWidth - THUMB - 4));
    };
    measure();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && trackRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(trackRef.current);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }
    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const animateTo = useCallback((target, onDone) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const step = (now) => {
      const dt = Math.min(0.05, ((now || Date.now()) - last) / 1000);
      last = now || Date.now();
      const current = thumbXRef.current;
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        thumbXRef.current = target;
        setThumbX(target);
        animRef.current = null;
        if (onDone) onDone();
        return;
      }
      const next = current + diff * Math.min(1, dt * 14);
      thumbXRef.current = next;
      setThumbX(next);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const handlePointerDown = (e) => {
    if (disabled || confirming) return;
    e.preventDefault();
    e.stopPropagation();
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setDragging(true);
    startPointerXRef.current = e.clientX;
    startThumbRef.current = thumbXRef.current;
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startPointerXRef.current;
    const next = Math.max(0, Math.min(maxXRef.current, startThumbRef.current + dx));
    thumbXRef.current = next;
    setThumbX(next);
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const max = maxXRef.current;
    if (max > 0 && thumbXRef.current / max >= COMPLETE_RATIO) {
      animateTo(max, () => {
        try { haptic.warning(); } catch {}
        setConfirming(true);
        Promise.resolve(onConfirm && onConfirm()).catch(() => {}).finally(() => {
          setConfirming(false);
          animateTo(0);
        });
      });
    } else {
      animateTo(0);
    }
  };

  const progress = maxX > 0 ? thumbX / maxX : 0;
  const trackBg = `linear-gradient(90deg, rgba(239,68,68,${0.05 + progress * 0.20}) 0%, rgba(249,115,22,${0.03 + progress * 0.14}) 100%)`;

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: 52,
        borderRadius: 26,
        background: `linear-gradient(180deg, rgba(22,18,22,0.6), rgba(14,12,15,0.6)), ${trackBg}`,
        border: `1px solid rgba(239,68,68,${0.16 + progress * 0.28})`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 4px rgba(0,0,0,0.35)`,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          paddingLeft: THUMB + 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          color: '#f87171',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: confirming ? 0 : Math.max(0.22, 1 - progress * 1.4),
          transition: dragging ? 'none' : 'opacity 200ms ease',
        }}
      >
        {confirming ? 'Forfeiting…' : 'Slide to forfeit'}
      </div>
      <div
        role="button"
        aria-label="Slide to forfeit battle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => { e.stopPropagation(); }}
        style={{
          position: 'absolute',
          top: '50%',
          left: 4,
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #f05252 0%, #dc2626 100%)',
          border: '1px solid rgba(0,0,0,0.18)',
          boxShadow: '0 2px 6px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          transform: `translate(${thumbX}px, -50%)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
          cursor: disabled || confirming ? 'not-allowed' : 'grab',
          touchAction: 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
