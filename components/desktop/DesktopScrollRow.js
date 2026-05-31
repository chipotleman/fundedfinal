import { useRef, useState, useEffect, useCallback } from 'react';

// =============================================================================
// DesktopScrollRow — wraps a horizontally-scrolling row so its content is
// strictly clipped to the column (overflow-x-auto) and never bleeds under the
// desktop right rail. On lg+ it overlays a right-edge fade + a chevron "scroll"
// affordance so users can tell there's more content to the right (and a left
// affordance once scrolled). The fade matches the black page background so the
// clipped card edge reads as intentional, not "tucked under the sidebar".
//
// Pass the original row classes via `innerClassName` (the flex + overflow-x-auto
// + responsive negative-margin classes). Mobile/tablet are unaffected because
// every affordance is `hidden lg:flex`/`hidden lg:block`.
// =============================================================================
export default function DesktopScrollRow({ children, className = '', innerClassName = '' }) {
  const ref = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth - clientWidth > 4;
    setAtStart(scrollLeft <= 2);
    setAtEnd(!overflowing || scrollLeft + clientWidth >= scrollWidth - 2);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update, children]);

  const scrollByDir = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className={innerClassName}>
        {children}
      </div>

      {/* Left affordance (only after scrolling). The chevron sits in the
          left page gutter (pushed half its width outside the column via
          -translate-x-1/2) so it never overlaps the first card. */}
      {!atStart && (
        <>
          <div
            className="hidden lg:block pointer-events-none absolute top-0 left-0 bottom-2 w-10 z-10"
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,0), #000)' }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="Scroll left"
            className="hidden lg:flex items-center justify-center absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-20 w-7 h-7 rounded-full transition-colors lg:hover:bg-[#1f1f1f]"
            style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.14)', color: '#e5e7eb' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      )}

      {/* Right affordance (while more content remains). The chevron is pushed
          half its width into the gutter between the content column and the
          right sidebar (translate-x-1/2) so it sits *between* them rather
          than on top of the last card. */}
      {!atEnd && (
        <>
          <div
            className="hidden lg:block pointer-events-none absolute top-0 right-0 bottom-2 w-10 z-10"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0), #000)' }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="Scroll right"
            className="hidden lg:flex items-center justify-center absolute right-0 top-1/2 translate-x-full -translate-y-1/2 z-20 w-7 h-7 rounded-full transition-colors lg:hover:bg-[#1f1f1f]"
            style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.14)', color: '#e5e7eb' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
