import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { trackPromoEvent } from '../lib/promoTracking';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const SCROLL_SPEED_PX_PER_SEC = 30;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

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
  const containerRef = useRef(null);
  const slideRefs = useRef(new Map());
  const set1FirstRef = useRef(null);
  const setWidthRef = useRef(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const seenImpressionsRef = useRef(new Set());

  const [activeIndex, setActiveIndex] = useState(0);
  const [emptyKeys, setEmptyKeys] = useState({});
  const [impressionsReady, setImpressionsReady] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

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
  const showLoop = count > 1 && !reducedMotion;

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
    if (activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  // Sync activeIndex to whichever tile is actually centered on mount before any
  // impression fires. Without this, narrow tiles (multiple visible at once)
  // would always credit the leftmost tile (index 0) for the first impression
  // instead of the slide actually centered in the viewport.
  useIsomorphicLayoutEffect(() => {
    if (impressionsReady || count === 0) return;
    const container = containerRef.current;
    if (!container) return;
    if (slideRefs.current.size === 0) return;
    const center = container.scrollLeft + container.clientWidth / 2;
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
    setActiveIndex(bestIdx);
    setImpressionsReady(true);
  }, [count, visible, impressionsReady]);

  // Fire an impression event whenever a new slide becomes the active one.
  // Dedup per (slotIndex, containerType) for the lifetime of this mount so
  // continuous scrolling past the same slide repeatedly doesn't inflate counts.
  // Gated on impressionsReady so the first impression is for the actually
  // centered tile, not the (possibly stale) initial activeIndex of 0.
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

  // Measure the width of one full set of slides (distance from first slide of
  // set 0 to first slide of set 1). This is the wrap distance for seamless
  // looping. Returns true if a non-zero measurement was captured.
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

  // Re-measure on viewport resize, container/slide resize (image/font load,
  // layout shift), font readiness, and image load events. Without these the
  // initial measurement can stick at 0 and auto-scroll appears stalled.
  useEffect(() => {
    if (typeof window === 'undefined' || !showLoop) return;
    const handle = () => tryMeasureSetWidth();
    window.addEventListener('resize', handle);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handle);
      if (containerRef.current) ro.observe(containerRef.current);
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

    const container = containerRef.current;
    const imgs = container ? Array.from(container.querySelectorAll('img')) : [];
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

  // Continuous slow horizontal scroll using rAF, with seamless wraparound.
  // The tick also retries measurement if setWidth is still 0, so the loop
  // self-heals once slides settle into their final size (post image/font load).
  useEffect(() => {
    if (reducedMotion || !showLoop) return;
    let raf;
    const tick = (time) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      const container = containerRef.current;
      let setWidth = setWidthRef.current;
      if (setWidth <= 0) {
        const el = set1FirstRef.current;
        if (el && el.offsetLeft > 0) {
          setWidth = el.offsetLeft;
          setWidthRef.current = setWidth;
        }
      }
      if (container && setWidth > 0) {
        let next = container.scrollLeft + SCROLL_SPEED_PX_PER_SEC * dt;
        if (next >= setWidth) next -= setWidth;
        container.scrollLeft = next;
      }
      raf = requestAnimationFrame(tick);
      rafRef.current = raf;
    };
    raf = requestAnimationFrame(tick);
    rafRef.current = raf;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      lastTimeRef.current = 0;
    };
  }, [reducedMotion, showLoop]);

  // Track scroll → update active index based on which slide is most centered
  // (after normalizing position into the first set's coordinate space).
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const setWidth = setWidthRef.current;
    let scrollLeft = container.scrollLeft;
    if (setWidth > 0 && scrollLeft >= setWidth) scrollLeft -= setWidth;
    const center = scrollLeft + container.clientWidth / 2;
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
    setActiveIndex((curr) => (curr === bestIdx ? curr : bestIdx));
  }, [visible]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (candidates.length === 0) return null;

  const handleDotClick = (idx) => {
    const container = containerRef.current;
    const slideKey = visible[idx]?.key;
    const target = slideKey != null ? slideRefs.current.get(slideKey) : null;
    if (!container || !target) {
      setActiveIndex(idx);
      return;
    }
    const setWidth = setWidthRef.current;
    if (setWidth > 0 && container.scrollLeft >= setWidth) {
      container.scrollLeft = container.scrollLeft - setWidth;
    }
    container.scrollLeft = target.offsetLeft;
    setActiveIndex(idx);
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
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-visible scrollbar-hide flex gap-3 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Promotions"
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

      {count > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-1 sm:mt-3">
          {visible.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIndex ? 'true' : 'false'}
              onClick={() => handleDotClick(i)}
              className="relative flex items-center justify-center cursor-pointer bg-transparent p-0"
              style={{ border: 0 }}
            >
              {/* Extends the tap target without contributing to layout height.
                  Horizontal extension intentionally large enough to keep dots
                  comfortably tappable on small phones; adjacent hit areas may
                  overlap, which is fine — the topmost (later in DOM) button
                  receives the tap. */}
              <span
                aria-hidden="true"
                className="absolute"
                style={{ top: -11, bottom: -11, left: -10, right: -10 }}
              />
              <span
                className={`rounded-full block transition-all duration-300 ${
                  i === activeIndex
                    ? 'w-[22px] h-[6px]'
                    : 'w-[6px] h-[6px]'
                }`}
                style={{
                  background:
                    i === activeIndex
                      ? 'rgba(255,255,255,0.85)'
                      : 'rgba(255,255,255,0.28)',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
