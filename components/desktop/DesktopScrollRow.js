import { useRef, useState, useEffect, useCallback } from 'react';

// =============================================================================
// DesktopScrollRow — wraps a horizontally-scrolling row so its content is
// strictly clipped to the column (overflow-x-auto) and never bleeds under the
// desktop right rail. On lg+ it fades the actual scrolled content at whichever
// edge has more to scroll (a CSS mask on the scroll container) plus a chevron
// "scroll" affordance, so users can tell there's more content. The content
// fade is used instead of an overlay gradient so the cut card edge always
// reads as a soft fade regardless of where the card boundary lands — this is
// what keeps every row (Featured Battles, Close Games, …) fading identically.
//
// Pass the original row classes via `innerClassName` (the flex + overflow-x-auto
// + responsive negative-margin classes). Mobile/tablet are unaffected: the mask
// is only applied at lg+ (via matchMedia) and every chevron is `hidden lg:flex`.
// =============================================================================
const FADE = '48px';

export default function DesktopScrollRow({ children, className = '', innerClassName = '' }) {
  const ref = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth - clientWidth > 4;
    setAtStart(scrollLeft <= 2);
    setAtEnd(!overflowing || scrollLeft + clientWidth >= scrollWidth - 2);
  }, []);

  // Track lg+ so the content fade is desktop-only (mobile/tablet untouched).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
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

  // Build the edge fade mask from the current scroll position. Only fade the
  // edge(s) that actually have more content to scroll toward.
  let maskImage;
  if (isDesktop && !(atStart && atEnd)) {
    if (!atStart && !atEnd) {
      maskImage = `linear-gradient(to right, transparent 0, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent 100%)`;
    } else if (!atEnd) {
      maskImage = `linear-gradient(to right, #000 calc(100% - ${FADE}), transparent 100%)`;
    } else {
      maskImage = `linear-gradient(to right, transparent 0, #000 ${FADE})`;
    }
  }
  const innerStyle = maskImage ? { WebkitMaskImage: maskImage, maskImage } : undefined;

  return (
    <div className={`desktop-scroll-row relative ${className}`}>
      <div ref={ref} className={innerClassName} style={innerStyle}>
        {children}
      </div>

      {/* Left affordance (only after scrolling). The chevron sits in the
          left page gutter (pushed half its width outside the column via
          -translate-x-1/2) so it never overlaps the first card. */}
      {!atStart && (
        <button
          type="button"
          onClick={() => scrollByDir(-1)}
          aria-label="Scroll left"
          className="hidden lg:flex items-center justify-center absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-20 w-7 h-7 rounded-full transition-colors lg:hover:bg-[#1f1f1f]"
          style={{ backgroundColor: 'var(--scroll-btn-bg)', border: '1px solid var(--scroll-btn-border)', color: 'var(--scroll-btn-color)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right affordance (while more content remains). The chevron is pushed
          half its width into the gutter between the content column and the
          right sidebar (translate-x-1/2) so it sits *between* them rather
          than on top of the last card. */}
      {!atEnd && (
        <button
          type="button"
          onClick={() => scrollByDir(1)}
          aria-label="Scroll right"
          className="hidden lg:flex items-center justify-center absolute right-0 top-1/2 translate-x-full -translate-y-1/2 z-20 w-7 h-7 rounded-full transition-colors lg:hover:bg-[#1f1f1f]"
          style={{ backgroundColor: 'var(--scroll-btn-bg)', border: '1px solid var(--scroll-btn-border)', color: 'var(--scroll-btn-color)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
