import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

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

export default function PromoCarousel({ slides }) {
  const containerRef = useRef(null);
  const slideRefs = useRef([]);
  const programmaticRef = useRef(false);
  const programmaticTimeoutRef = useRef(null);
  const resumeTimeoutRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const visible = (slides || [])
    .map((s, i) => {
      if (s == null || s === false) return null;
      if (typeof s === 'object' && 'node' in s) {
        if (!s.node) return null;
        return { key: s.key ?? i, node: s.node };
      }
      return { key: i, node: s };
    })
    .filter(Boolean);
  const count = visible.length;

  // Reset index if it's out of bounds after visible-list changes
  useEffect(() => {
    if (count === 0) return;
    if (activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  const scrollToIndex = useCallback((idx, smooth = true) => {
    const container = containerRef.current;
    const slide = slideRefs.current[idx];
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
  }, []);

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
    for (let i = 0; i < slideRefs.current.length; i++) {
      const child = slideRefs.current[i];
      if (!child) continue;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    setActiveIndex((curr) => (curr === bestIdx ? curr : bestIdx));
  }, []);

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

  if (count === 0) return null;

  const handleDotClick = (idx) => {
    setActiveIndex(idx);
    scrollToIndex(idx, true);
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
        {visible.map((slide, i) => (
          <div
            key={slide.key}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="snap-start snap-always flex-shrink-0"
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${count}`}
          >
            {slide.node}
          </div>
        ))}
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
