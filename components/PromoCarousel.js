import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { trackPromoEvent } from '../lib/promoTracking';

const AUTO_ADVANCE_MS = 5000;
const RESUME_DELAY_MS = 600;

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

  useLayoutEffect(() => {
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
      className={isEmpty ? '' : 'snap-start snap-always flex-shrink-0'}
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
  const programmaticRef = useRef(false);
  const programmaticTimeoutRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const seenImpressionsRef = useRef(new Set());

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [emptyKeys, setEmptyKeys] = useState({});
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

  // Fire an impression event whenever a new slide becomes the active one.
  // Dedup per (slotIndex, containerType) for the lifetime of this mount so
  // auto-advancing past the same slide repeatedly doesn't inflate counts.
  useEffect(() => {
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
  }, [activeIndex, count, visible]);

  const scrollToIndex = useCallback(
    (idx, smooth = true) => {
      const container = containerRef.current;
      const slideKey = visible[idx]?.key;
      const slide = slideKey != null ? slideRefs.current.get(slideKey) : null;
      if (!container || !slide) return;
      programmaticRef.current = true;
      if (programmaticTimeoutRef.current) {
        clearTimeout(programmaticTimeoutRef.current);
      }
      container.scrollTo({
        left: slide.offsetLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
      programmaticTimeoutRef.current = setTimeout(
        () => {
          programmaticRef.current = false;
        },
        smooth ? 700 : 100,
      );
    },
    [visible],
  );

  // Auto-advance timer
  useEffect(() => {
    if (paused || reducedMotion || count <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % count;
        scrollToIndex(next, true);
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, reducedMotion, count, scrollToIndex]);

  // Track manual scroll → update active index
  const handleScroll = useCallback(() => {
    if (programmaticRef.current) return;
    const container = containerRef.current;
    if (!container) return;
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
    setActiveIndex((curr) => (curr === bestIdx ? curr : bestIdx));
  }, [visible]);

  // Re-snap to active slide after a viewport resize so the layout stays correct
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => scrollToIndex(activeIndex, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex, scrollToIndex]);

  // Pause helpers
  const pauseNow = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setPaused(true);
  }, []);

  const resumeSoon = useCallback(() => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setPaused(false);
      resumeTimeoutRef.current = null;
    }, RESUME_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (programmaticTimeoutRef.current) {
        clearTimeout(programmaticTimeoutRef.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  if (candidates.length === 0) return null;

  const handleDotClick = (idx) => {
    setActiveIndex(idx);
    scrollToIndex(idx, true);
  };

  const handleSlideClick = (slide) => {
    if (slide.slotIndex == null || !slide.containerType) return;
    trackPromoEvent('promo_click', {
      slotIndex: slide.slotIndex,
      containerType: slide.containerType,
    });
  };

  return (
    <div
      className="relative"
      onMouseEnter={pauseNow}
      onMouseLeave={resumeSoon}
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={pauseNow}
        onTouchEnd={resumeSoon}
        onTouchCancel={resumeSoon}
        className="overflow-x-auto overflow-y-visible scrollbar-hide flex gap-3 py-1 snap-x snap-mandatory"
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
      </div>

      {count > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-3">
          {visible.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIndex ? 'true' : 'false'}
              onClick={() => handleDotClick(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 22 : 6,
                height: 6,
                background:
                  i === activeIndex
                    ? 'rgba(255,255,255,0.85)'
                    : 'rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
