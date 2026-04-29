import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const DISMISS_KEY_PREFIX = 'depositMatchAppliedDismissed:';

export default function DepositMatchAppliedBanner() {
  const { data: session, status } = useSession();
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setInfo(null);
      setDismissed(false);
      return;
    }

    let cancelled = false;
    fetch('/api/user/has-deposited', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        if (!data.matchGranted) {
          setInfo(null);
          return;
        }
        const amount = parseFloat(data.matchAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          setInfo(null);
          return;
        }
        setInfo({
          amount,
          grantedAt: data.grantedAt || null,
        });

        if (typeof window !== 'undefined') {
          try {
            const key = `${DISMISS_KEY_PREFIX}${session.user.id}`;
            const stored = window.localStorage.getItem(key);
            if (stored && data.grantedAt && stored === data.grantedAt) {
              setDismissed(true);
            } else if (stored && !data.grantedAt) {
              setDismissed(true);
            }
          } catch {}
        }
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  if (status !== 'authenticated' || !info || dismissed) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && session?.user?.id) {
      try {
        const key = `${DISMISS_KEY_PREFIX}${session.user.id}`;
        window.localStorage.setItem(key, info.grantedAt || 'granted');
      } catch {}
    }
    setDismissed(true);
  };

  const formattedAmount = info.amount.toLocaleString('en-US', {
    minimumFractionDigits: info.amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <style>{`
        @keyframes deposit-applied-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(16, 185, 129, 0.35), inset 0 0 24px rgba(16, 185, 129, 0.08); }
          50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.55), inset 0 0 36px rgba(16, 185, 129, 0.16); }
        }
        @keyframes deposit-applied-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes deposit-applied-check {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden relative h-[140px] md:h-[180px]"
        style={{
          background:
            'linear-gradient(135deg, #022c22 0%, #064e3b 30%, #047857 65%, #065f46 100%)',
          border: '2px solid rgba(16, 185, 129, 0.55)',
          animation: 'deposit-applied-glow 3s ease-in-out infinite',
        }}
        role="status"
        aria-live="polite"
      >
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 25% 20%, rgba(110, 231, 183, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(5, 150, 105, 0.4) 0%, transparent 55%)',
          }}
        />

        <div
          className="absolute inset-0 overflow-hidden pointer-events-none z-0"
          style={{ mixBlendMode: 'overlay' }}
        >
          <div
            className="absolute top-0 left-0 h-full w-1/3"
            style={{
              background:
                'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              animation: 'deposit-applied-shimmer 4s ease-in-out infinite',
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss bonus notice"
          className="absolute top-2 right-2 md:top-3 md:right-3 z-30 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-emerald-50 hover:text-white transition-colors"
          style={{
            background: 'rgba(2, 44, 34, 0.6)',
            border: '1px solid rgba(110, 231, 183, 0.4)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="relative z-10 h-full flex items-center gap-3 md:gap-5 px-4 md:px-6">
          <div
            className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
              animation: 'deposit-applied-check 0.6s ease-out',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#022c22" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-0.5"
              style={{
                color: '#a7f3d0',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              Bonus Credited
            </div>
            <div
              className="text-2xl md:text-4xl font-black leading-tight"
              style={{
                backgroundImage:
                  'linear-gradient(180deg, #ecfdf5 0%, #a7f3d0 45%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            >
              +${formattedAmount} added
            </div>
            <div
              className="text-[11px] md:text-sm font-semibold mt-0.5"
              style={{
                color: '#d1fae5',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              Your first deposit match is in your balance.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
