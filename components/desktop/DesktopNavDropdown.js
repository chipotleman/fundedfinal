import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// =============================================================================
// DesktopNavDropdown — the "tucked away" primary navigation for the lg+ top
// bar (Polymarket-style). Instead of spreading the nav links across the bar,
// a single compact control opens a dropdown holding the primary links. The
// active route gets a blue (#3b82f6) accent. Rendered `hidden lg:block` by the
// parent so mobile/tablet (which keep the hamburger drawer) are unaffected.
// =============================================================================
export default function DesktopNavDropdown({ isLoggedIn }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close the menu on navigation.
  useEffect(() => {
    const handle = () => setOpen(false);
    router.events?.on('routeChangeStart', handle);
    return () => router.events?.off('routeChangeStart', handle);
  }, [router.events]);

  const currentPath = router.pathname || '';
  const isActive = (href) => {
    if (href === '/dashboard') return currentPath === '/dashboard' || currentPath === '/';
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const links = isLoggedIn
    ? [
        { href: '/dashboard', label: 'Battle' },
        { href: '/my-picks', label: 'My Picks' },
        { href: '/battle', label: 'Social' },
        { href: '/leaderboard', label: 'Leaderboard' },
      ]
    : [
        { href: '/battle', label: 'Social' },
        { href: '/leaderboard', label: 'Leaderboard' },
      ];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open navigation menu"
        className="flex items-center gap-2 h-10 px-3 rounded-full transition-colors lg:hover:bg-white/5"
        style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-sm font-semibold">Menu</span>
        <svg
          className="w-3.5 h-3.5 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Primary navigation"
          className="absolute left-0 mt-2 w-52 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div className="py-1">
            {links.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center px-4 py-3 text-sm font-medium transition-colors lg:hover:bg-white/5 border-l-[3px] ${
                    active ? 'border-l-[#3b82f6] text-white' : 'border-l-transparent text-gray-300'
                  }`}
                  style={active ? { backgroundColor: 'rgba(59,130,246,0.08)' } : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
