import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { trackPromoEvent } from '../lib/promoTracking';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Continuous slow-scroll speed for the promo strip. Tuned to feel
// alive but not distracting; the same value is used on every device
// (desktop, tablet, phone) so the experience is uniform.
const SCROLL_SPEED_PX_PER_SEC = 45;

// After the user lifts their finger / pointer following a drag or
// touch-pause, wait this long before resuming the auto-scroll. Long
// enough for them to read what they paused on, short enough that the
// strip feels alive when they look away.
const RESUME_AFTER_INTERACTION_MS = 2000;

// A pointer movement under this many pixels between pointerdown and
// pointerup is treated as a tap (lets clicks through to slide CTAs)
// rather than a drag (which would steal the click).
const DRAG_THRESHOLD_PX = 6;

// After a wheel/trackpad scrub stops producing deltas, wait this long
// of idleness before scheduling the auto-scroll resume. Short enough
// that the strip feels responsive when the user lets go, long enough
// that the pauses between frames of a single trackpad fling don't
// count as "stopped".
const WHEEL_IDLE_MS = 160;

function SlideHost({
  slideKey,
  isEmpty,
  registerRef,
  onContentChange,
  onClickCapture,
  ariaLabel,
  children,
}) {
  const localRef = useRef(null);

  const setRef = useCallback(
    (el) => {
      localRef.current = el;
      registerRef(slideKey, el);
    },
    [slideKey, registerRef],
  );

  useIsomorphicLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const update = () => {
      onContentChange(slideKey, el.childNodes.length === 0);
    };
    update();
    let mo = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(update);
      mo.observe(el, { childList: true });
    }
    return () => {
      if (mo) mo.disconnect();
    };
  }, [slideKey, onContentChange]);

  useEffect(() => {
    return () => {
      registerRef(slideKey, null);
    };
  }, [slideKey, registerRef]);

  return (
    <div
      ref={setRef}
      className={isEmpty ? '' : 'flex-shrink-0'}
      style={isEmpty ? { display: 'none' } : undefined}
      role={isEmpty ? undefined : 'group'}
      aria-roledescription={isEmpty ? undefined : 'slide'}
      aria-label={ariaLabel}
      aria-hidden={isEmpty ? 'true' : undefined}
      onClickCapture={isEmpty ? undefined : onClickCapture}
    >
      {children}
    </div>
  );
}

export default function PromoCarousel({ slides }) {
  // The viewport is `overflow: hidden`; the actual scroll is driven by
  // a `transform: translate3d(-x, 0, 0)` applied to the inner track.
  // We deliberately moved away from animating `scrollLeft` because
  // browsers round `scrollLeft` to integer pixels on most platforms
  // (notably Windows Chrome and mobile Safari). At our slow speed
  // (~45 px/sec ÷ 60fps ≈ 0.75 px/frame) integer rounding meant most
  // frames produced zero motion and every ~1.3 frames produced a 1px
  // jump — visible as the "choppy" stutter on Windows. Transforms
  // keep subpixel precision and are GPU-composited, so the strip is
  // butter-smooth at any speed on every device.
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const slideRefs = useRef(new Map());
  const set1FirstRef = useRef(null);
  const setWidthRef = useRef(0);
  const offsetRef = useRef(0); // current translateX, always >= 0
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const seenImpressionsRef = useRef(new Set());

  // Interaction state. Refs (not React state) because they're read
  // inside the rAF loop and we don't want to thrash re-renders.
  const pausedRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startOffset: 0,
    moved: false,
  });
  const resumeTimerRef = useRef(null);
  const wheelIdleTimerRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  // Mirror of `activeIndex` for use inside the rAF loop so we can
  // bail out *before* calling setState when nothing has changed.
  // Returning `curr` from setState's updater still enqueues an
  // update every frame — skipping the call entirely is what keeps
  // the scheduler quiet.
  const activeIndexRef = useRef(0);
  const [emptyKeys, setEmptyKeys] = useState({});
  const [impressionsReady, setImpressionsReady] = useState(false);

  const candidates = (slides || [])
    .map((s, i) => {
      if (s == null || s === false) return null;
      if (typeof s === 'object' && 'node' in s) {
        if (!s.node) return null;
        return {
          key: s.key ?? i,
          node: s.node,
          slotIndex: typeof s.slotIndex === 'number' ? s.slotIndex : null,
          containerType: s.containerType || null,
        };
      }
      return { key: i, node: s, slotIndex: null, containerType: null };
    })
    .filter(Boolean);

  const visible = candidates.filter((s) => !emptyKeys[s.key]);
  const count = visible.length;
  // Auto-scroll runs on every device when there's something to loop.
  // Previously this was desktop-only because the old `scrollLeft`
  // animation competed with iOS touch panning; the transform-based
  // engine has no such conflict (we explicitly handle pointer drag
  // ourselves below) so we can give every user the same animated
  // strip. We also no longer gate on `prefers-reduced-motion`
  // because iOS users very commonly have Reduce Motion on by
  // default, which was making the strip appear static.
  const showLoop = count > 1;

  const reportContent = useCallback((key, isEmpty) => {
    setEmptyKeys((prev) => {
      const wasEmpty = !!prev[key];
      if (wasEmpty === isEmpty) return prev;
      const next = { ...prev };
      if (isEmpty) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);

  const registerRef = useCallback((key, el) => {
    if (el) {
      slideRefs.current.set(key, el);
    } else {
      slideRefs.current.delete(key);
    }
  }, []);

  // Reset index if it's out of bounds after the visible list shrinks
  useEffect(() => {
    if (count === 0) return;
    if (activeIndex >= count) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
    }
  }, [count, activeIndex]);

  // Sync activeIndex to whichever tile is most centered in the viewport
  // on mount before the first impression fires.
  useIsomorphicLayoutEffect(() => {
    if (impressionsReady || count === 0) return;
    const vp = viewportRef.current;
    if (!vp) return;
    if (slideRefs.current.size === 0) return;
    const center = offsetRef.current + vp.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < visible.length; i++) {
      const child = slideRefs.current.get(visible[i].key);
      if (!child) continue;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    activeIndexRef.current = bestIdx;
    setActiveIndex(bestIdx);
    setImpressionsReady(true);
  }, [count, visible, impressionsReady]);

  // Fire an impression event whenever a new slide becomes the active one.
  useEffect(() => {
    if (!impressionsReady) return;
    if (count === 0) return;
    const slide = visible[activeIndex];
    if (!slide || slide.slotIndex == null || !slide.containerType) return;
    const key = `${slide.slotIndex}:${slide.containerType}`;
    if (seenImpressionsRef.current.has(key)) return;
    seenImpressionsRef.current.add(key);
    trackPromoEvent('promo_impression', {
      slotIndex: slide.slotIndex,
      containerType: slide.containerType,
    });
  }, [activeIndex, count, visible, impressionsReady]);

  // Measure one full set's width (= offsetLeft of the first duplicate
  // tile). This is the wrap distance for seamless looping.
  const tryMeasureSetWidth = useCallback(() => {
    const el = set1FirstRef.current;
    if (!el) return false;
    const left = el.offsetLeft;
    if (left > 0) {
      setWidthRef.current = left;
      return true;
    }
    return false;
  }, []);

  useIsomorphicLayoutEffect(() => {
    tryMeasureSetWidth();
  }, [tryMeasureSetWidth, count, showLoop, emptyKeys]);

  // Re-measure on viewport resize, slide resize (image/font load), font
  // readiness, and image load events. Without these the initial
  // measurement can stick at 0 and auto-scroll appears stalled.
  useEffect(() => {
    if (typeof window === 'undefined' || !showLoop) return;
    const handle = () => tryMeasureSetWidth();
    window.addEventListener('resize', handle);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handle);
      if (viewportRef.current) ro.observe(viewportRef.current);
      slideRefs.current.forEach((el) => {
        if (el) ro.observe(el);
      });
      if (set1FirstRef.current) ro.observe(set1FirstRef.current);
    }

    let fontsCancelled = false;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (!fontsCancelled) handle();
        })
        .catch(() => {});
    }

    const vp = viewportRef.current;
    const imgs = vp ? Array.from(vp.querySelectorAll('img')) : [];
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', handle);
    });

    return () => {
      window.removeEventListener('resize', handle);
      if (ro) ro.disconnect();
      fontsCancelled = true;
      imgs.forEach((img) => img.removeEventListener('load', handle));
    };
  }, [tryMeasureSetWidth, showLoop, count, emptyKeys]);

  // Sync activeIndex to whichever tile is most centered in the viewport
  // as the strip moves. Read inside rAF so we don't re-render every
  // frame — we only call setActiveIndex when the centered tile
  // actually changes.
  const computeActiveIndex = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || visible.length === 0) return;
    const setWidth = setWidthRef.current;
    let pos = offsetRef.current;
    if (setWidth > 0 && pos >= setWidth) pos -= setWidth;
    const center = pos + vp.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < visible.length; i++) {
      const child = slideRefs.current.get(visible[i].key);
      if (!child) continue;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx === activeIndexRef.current) return;
    activeIndexRef.current = bestIdx;
    setActiveIndex(bestIdx);
  }, [visible]);

  // Apply the current offset to the track. Uses translate3d to opt
  // into the GPU compositor path on every browser.
  const applyTransform = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
  }, []);

  // When looping turns off (slide count shrinks to ≤1, or we mount
  // with a single slide), zero the offset and the track's transform
  // so we never leave a stale translation on screen — without this,
  // a strip that briefly had >1 slide and then collapsed to 1 would
  // remain visually offset by whatever offsetRef.current happened to
  // hold when the rAF loop stopped. Declared after applyTransform so
  // the dep array doesn't hit a TDZ at render time.
  useEffect(() => {
    if (showLoop) return;
    offsetRef.current = 0;
    applyTransform();
  }, [showLoop, applyTransform]);

  // Continuous slow scroll using rAF + transform. The loop also retries
  // measurement if setWidth is still 0, so it self-heals once slides
  // settle into their final size (post image/font load).
  useEffect(() => {
    if (!showLoop) return;
    let raf;
    const tick = (time) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      let setWidth = setWidthRef.current;
      if (setWidth <= 0) {
        const el = set1FirstRef.current;
        if (el && el.offsetLeft > 0) {
          setWidth = el.offsetLeft;
          setWidthRef.current = setWidth;
        }
      }

      const interacting = pausedRef.current || dragRef.current.active;
      if (setWidth > 0 && !interacting) {
        let next = offsetRef.current + SCROLL_SPEED_PX_PER_SEC * dt;
        if (next >= setWidth) next -= setWidth;
        offsetRef.current = next;
      }

      applyTransform();
      computeActiveIndex();

      raf = requestAnimationFrame(tick);
      rafRef.current = raf;
    };
    raf = requestAnimationFrame(tick);
    rafRef.current = raf;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      lastTimeRef.current = 0;
    };
  }, [showLoop, applyTransform, computeActiveIndex]);

  // Pointer handlers — unified path for mouse, touch and stylus.
  // Pointerdown pauses the auto-scroll; if the pointer then moves more
  // than DRAG_THRESHOLD_PX we treat it as a manual scrub (the offset
  // tracks the pointer 1:1). Pointerup schedules the auto-scroll to
  // resume after RESUME_AFTER_INTERACTION_MS.
  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearWheelIdleTimer = useCallback(() => {
    if (wheelIdleTimerRef.current) {
      clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      resumeTimerRef.current = null;
    }, RESUME_AFTER_INTERACTION_MS);
  }, [clearResumeTimer]);

  const handlePointerDown = useCallback((e) => {
    // Ignore secondary buttons (right-click etc.) and synthetic mouse
    // events that follow touch — Pointer Events normalize this but
    // some browsers still fire phantom mouse events alongside touch.
    if (e.button != null && e.button !== 0) return;
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startOffset: offsetRef.current,
      moved: false,
    };
    pausedRef.current = true;
    clearResumeTimer();
    // Capture so we keep receiving move/up even if the pointer leaves
    // the viewport — important for desktop click-and-drag past the
    // strip's edge.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_err) {}
  }, [clearResumeTimer]);

  const handlePointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    // Ignore events from a different pointer — protects against
    // multi-touch / multi-pointer interference where a second finger
    // lands while the first is still dragging.
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    const delta = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) >= DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    // Prevent native horizontal scroll/text-select hijack once we know
    // this is a real drag.
    if (e.cancelable) {
      try { e.preventDefault(); } catch (_err) {}
    }
    const setWidth = setWidthRef.current;
    let next = drag.startOffset - delta;
    if (setWidth > 0) {
      // Normalize into [0, setWidth) so wrapping stays seamless.
      next = ((next % setWidth) + setWidth) % setWidth;
    } else if (next < 0) {
      next = 0;
    }
    offsetRef.current = next;
    applyTransform();
  }, [applyTransform]);

  const handlePointerUp = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    const wasMove = drag.moved;
    dragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startOffset: 0,
      moved: false,
    };
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_err) {}
    // If the user actually dragged, suppress the click that would
    // otherwise fall through to the slide CTA underneath.
    if (wasMove) {
      const swallow = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      const node = e.currentTarget;
      node.addEventListener('click', swallow, { capture: true, once: true });
      // Belt-and-suspenders: if no click ever fires, remove the
      // capture handler on the next tick.
      setTimeout(() => {
        try { node.removeEventListener('click', swallow, { capture: true }); } catch (_err) {}
      }, 0);
    }
    scheduleResume();
  }, [scheduleResume]);

  // Desktop hover-to-pause. Touch devices don't generate
  // mouseenter/leave, so this only affects pointer users; touch
  // pausing is handled by the pointerdown path above.
  const handleMouseEnter = useCallback(() => {
    if (dragRef.current.active) return;
    pausedRef.current = true;
    clearResumeTimer();
  }, [clearResumeTimer]);

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current.active) return;
    scheduleResume();
  }, [scheduleResume]);

  // Wheel / trackpad scrubbing while the pointer is over the strip.
  // Attached as a native non-passive listener so we can preventDefault
  // on horizontal-dominant gestures without React's passive default
  // swallowing the call. Vertical-dominant gestures are left untouched
  // so the page still scrolls naturally through the strip.
  useEffect(() => {
    if (!showLoop) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e) => {
      // Treat shift+wheel (the desktop convention for horizontal
      // scroll) and any gesture with a dominant horizontal component
      // as a request to scrub the strip. Everything else is left to
      // bubble so the page scrolls.
      const horiz = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const vert = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      if (Math.abs(horiz) <= Math.abs(vert)) return;
      if (horiz === 0) return;

      // Don't fight the user's own drag.
      if (dragRef.current.active) return;

      if (e.cancelable) {
        try { e.preventDefault(); } catch (_err) {}
      }

      pausedRef.current = true;
      clearResumeTimer();

      const setWidth = setWidthRef.current;
      let next = offsetRef.current + horiz;
      if (setWidth > 0) {
        next = ((next % setWidth) + setWidth) % setWidth;
      } else if (next < 0) {
        next = 0;
      }
      offsetRef.current = next;
      applyTransform();

      // Reset the idle timer on every delta; once the wheel goes
      // quiet for WHEEL_IDLE_MS, kick the normal resume timer so the
      // strip picks back up without needing the page to scroll.
      clearWheelIdleTimer();
      wheelIdleTimerRef.current = setTimeout(() => {
        wheelIdleTimerRef.current = null;
        scheduleResume();
      }, WHEEL_IDLE_MS);
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      vp.removeEventListener('wheel', onWheel, { passive: false });
    };
  }, [showLoop, applyTransform, clearResumeTimer, clearWheelIdleTimer, scheduleResume]);

  // Clean up rAF + pending timers on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearResumeTimer();
      clearWheelIdleTimer();
    };
  }, [clearResumeTimer, clearWheelIdleTimer]);

  if (candidates.length === 0) return null;

  const handleDotClick = (idx) => {
    const slideKey = visible[idx]?.key;
    const target = slideKey != null ? slideRefs.current.get(slideKey) : null;
    if (!target) {
      setActiveIndex(idx);
      return;
    }
    offsetRef.current = target.offsetLeft;
    applyTransform();
    activeIndexRef.current = idx;
    setActiveIndex(idx);
    // Treat a dot tap as an interaction so the strip pauses briefly
    // on the chosen slide before resuming.
    pausedRef.current = true;
    scheduleResume();
  };

  const handleSlideClick = (slide) => {
    if (slide.slotIndex == null || !slide.containerType) return;
    trackPromoEvent('promo_click', {
      slotIndex: slide.slotIndex,
      containerType: slide.containerType,
    });
  };

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className="overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label="Promotions"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        // Let the page scroll vertically through the strip but claim
        // horizontal gestures for ourselves so iOS Safari doesn't try
        // to swipe-navigate back.
        style={{ touchAction: 'pan-y', cursor: 'grab' }}
      >
        <div
          ref={trackRef}
          className="flex gap-3 py-1"
          // GPU-compositor opt-in. backface-visibility hides the
          // hairline shimmer some browsers render when translating a
          // composited layer at non-integer offsets.
          style={{
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {candidates.map((slide) => {
            const isEmpty = !!emptyKeys[slide.key];
            const visibleIdx = isEmpty
              ? -1
              : visible.findIndex((s) => s.key === slide.key);
            const ariaLabel = isEmpty
              ? undefined
              : `Slide ${visibleIdx + 1} of ${count}`;
            return (
              <SlideHost
                key={slide.key}
                slideKey={slide.key}
                isEmpty={isEmpty}
                registerRef={registerRef}
                onContentChange={reportContent}
                onClickCapture={() => handleSlideClick(slide)}
                ariaLabel={ariaLabel}
              >
                {slide.node}
              </SlideHost>
            );
          })}

          {showLoop &&
            visible.map((slide, i) => (
              <div
                key={`loop-${slide.key}`}
                ref={i === 0 ? set1FirstRef : null}
                className="flex-shrink-0"
                aria-hidden="true"
                onClickCapture={() => handleSlideClick(slide)}
              >
                {slide.node}
              </div>
            ))}
        </div>
      </div>

      {/* Pagination dots are visible at every breakpoint. They double as
          a click-to-jump affordance for the auto-scrolling strip and
          give a stable orientation cue. */}
      {count > 1 && (() => {
        const dotCount = Math.min(3, count);
        const activeDot = count <= 3
          ? activeIndex
          : Math.min(
              dotCount - 1,
              Math.floor((activeIndex / count) * dotCount),
            );
        const dotToSlide = (i) => {
          if (count <= 3) return i;
          if (i === 0) return 0;
          if (i === dotCount - 1) return count - 1;
          return Math.round((i / (dotCount - 1)) * (count - 1));
        };
        return (
          <div className="flex justify-center items-center gap-1.5 mt-1.5">
            {Array.from({ length: dotCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${dotToSlide(i) + 1}`}
                aria-current={i === activeDot ? 'true' : 'false'}
                onClick={() => handleDotClick(dotToSlide(i))}
                className="relative flex items-center justify-center cursor-pointer bg-transparent p-0"
                style={{ border: 0 }}
              >
                <span
                  aria-hidden="true"
                  className="absolute"
                  style={{ top: -6, bottom: -6, left: -10, right: -10 }}
                />
                <span
                  className={`rounded-full block transition-all duration-300 ${
                    i === activeDot
                      ? 'w-[14px] h-[4px]'
                      : 'w-[4px] h-[4px]'
                  }`}
                  style={{
                    background:
                      i === activeDot
                        ? 'rgba(255,255,255,0.85)'
                        : 'rgba(255,255,255,0.28)',
                  }}
                />
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
