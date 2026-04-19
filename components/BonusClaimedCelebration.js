import { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useSession } from 'next-auth/react';

const STORAGE_PREFIX = 'piks_bonus_claimed_shown_v1:';
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 20000;

async function postAcknowledge() {
  try {
    await fetch('/api/user/has-deposited', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledgeBonusClaimed' }),
    });
  } catch (_e) {
    // Best effort; the next check will retry persisting if needed.
  }
}

function formatAmount(value) {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

export default function BonusClaimedCelebration() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || null;
  const [matchAmount, setMatchAmount] = useState(null);
  const [open, setOpen] = useState(false);
  const checkedRef = useRef(false);
  const dismissedRef = useRef(false);

  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  const markShown = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch (_e) {}
  }, [storageKey]);

  const alreadyShown = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(storageKey) === '1';
    } catch (_e) {
      return false;
    }
  }, [storageKey]);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      checkedRef.current = false;
      dismissedRef.current = false;
      setOpen(false);
      setMatchAmount(null);
      return undefined;
    }

    if (alreadyShown()) {
      checkedRef.current = true;
      return undefined;
    }

    let cancelled = false;

    const check = async () => {
      if (cancelled || dismissedRef.current) return;
      try {
        const res = await fetch('/api/user/has-deposited', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || dismissedRef.current) return;
        // Server-side acknowledgement is the source of truth across devices.
        if (data?.bonusClaimedAcknowledgedAt) {
          markShown();
          return;
        }
        // Migrate legacy per-device dismissals: if this browser already saw
        // the popup but the server doesn't know yet, persist it now and skip.
        if (alreadyShown()) {
          postAcknowledge();
          return;
        }
        if (!data?.hasDeposited) return;
        const grantedAt = data.grantedAt ? Date.parse(data.grantedAt) : null;
        // Only celebrate if the match was credited recently. Prevents a
        // celebratory popup for users who deposited long before this
        // feature shipped.
        if (!grantedAt || Number.isNaN(grantedAt)) return;
        if (Date.now() - grantedAt > FRESHNESS_WINDOW_MS) {
          // Too old — treat as already-acknowledged so we never show it,
          // and persist that to the server so other devices agree.
          markShown();
          postAcknowledge();
          return;
        }
        const amount = Number(data.matchAmount) || 0;
        if (amount <= 0) return;
        // Mark shown immediately on first render so a refresh / navigation
        // before dismissal doesn't re-trigger the celebration.
        markShown();
        setMatchAmount(amount);
        setOpen(true);
        checkedRef.current = true;
      } catch (_e) {
        // Network errors: try again on the next interval.
      }
    };

    check();
    const interval = setInterval(() => {
      if (dismissedRef.current || alreadyShown()) {
        clearInterval(interval);
        return;
      }
      check();
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') check();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [status, userId, alreadyShown, markShown]);

  const handleClose = useCallback(() => {
    dismissedRef.current = true;
    markShown();
    postAcknowledge();
    setOpen(false);
  }, [markShown]);

  if (!open || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes bonus-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bonus-card-in {
          0% { transform: scale(0.7) translateY(20px); opacity: 0; }
          60% { transform: scale(1.04) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes bonus-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes bonus-glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(250, 204, 21, 0.55), inset 0 0 40px rgba(250, 204, 21, 0.1); }
          50% { box-shadow: 0 0 60px rgba(250, 204, 21, 0.85), inset 0 0 60px rgba(250, 204, 21, 0.25); }
        }
        @keyframes bonus-coin-float {
          0% { transform: translateY(40px) translateX(0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-260px) translateX(var(--coin-x, 10px)) rotate(360deg); opacity: 0; }
        }
        @keyframes bonus-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes bonus-cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(250, 204, 21, 0.5); }
          50% { transform: scale(1.04); box-shadow: 0 6px 28px rgba(250, 204, 21, 0.8); }
        }
        @keyframes bonus-badge-bob {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          50% { transform: rotate(-3deg) scale(1.05); }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bonus claimed"
        className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        style={{
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(4px)',
          animation: 'bonus-overlay-in 0.25s ease-out',
        }}
        onClick={handleClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[420px] rounded-2xl overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, #2d1b00 0%, #5a3a00 20%, #8a5d00 45%, #b8830d 70%, #6b4500 100%)',
            border: '2px solid rgba(250, 204, 21, 0.6)',
            animation: 'bonus-card-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), bonus-glow-pulse 2.5s ease-in-out infinite 0.45s',
          }}
        >
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 30% 20%, rgba(253, 224, 71, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(217, 119, 6, 0.55) 0%, transparent 55%)',
            }}
          />

          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(12)].map((_, i) => (
              <div
                key={`coin-${i}`}
                className="absolute rounded-full"
                style={{
                  width: `${10 + (i % 3) * 4}px`,
                  height: `${10 + (i % 3) * 4}px`,
                  left: `${4 + i * 8}%`,
                  bottom: '-12px',
                  background:
                    'radial-gradient(circle at 30% 30%, #fde68a 0%, #facc15 45%, #b45309 100%)',
                  boxShadow: '0 0 8px rgba(250, 204, 21, 0.8), inset 0 -2px 3px rgba(120, 53, 15, 0.6)',
                  animation: `bonus-coin-float ${3.2 + (i % 4) * 0.6}s linear infinite`,
                  animationDelay: `${i * 0.3}s`,
                  ['--coin-x']: `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 6)}px`,
                }}
              />
            ))}
            {[...Array(16)].map((_, i) => (
              <div
                key={`sparkle-${i}`}
                className="absolute"
                style={{
                  width: `${3 + (i % 3) * 2}px`,
                  height: `${3 + (i % 3) * 2}px`,
                  left: `${(i * 7.5) % 100}%`,
                  top: `${(i * 13) % 90}%`,
                  background: '#fef9c3',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px #fde68a, 0 0 16px #facc15',
                  animation: `bonus-sparkle ${1.5 + (i % 4) * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>

          <div
            className="absolute inset-0 overflow-hidden pointer-events-none z-0"
            style={{ mixBlendMode: 'overlay' }}
          >
            <div
              className="absolute top-0 left-0 h-full w-1/3"
              style={{
                background:
                  'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                animation: 'bonus-shimmer 3.5s ease-in-out infinite',
              }}
            />
          </div>

          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-md z-20"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.6)',
              animation: 'bonus-badge-bob 2s ease-in-out infinite',
              transformOrigin: 'center',
            }}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-950">
              ⭐ Bonus Claimed
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-amber-100 hover:text-white hover:bg-black/30 transition-colors text-xl leading-none"
          >
            ×
          </button>

          <div className="relative z-10 px-6 pt-12 pb-6 text-center">
            <div className="text-5xl mb-2" aria-hidden="true">🎉</div>

            <div
              className="text-[11px] font-black uppercase tracking-[0.22em] mb-1"
              style={{
                color: '#fef3c7',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              Match Bonus Credited
            </div>

            <div
              className="text-4xl md:text-5xl font-black leading-none my-2"
              style={{
                backgroundImage:
                  'linear-gradient(180deg, #fff7d6 0%, #fde68a 35%, #facc15 65%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                letterSpacing: '0.02em',
              }}
            >
              {formatAmount(matchAmount)}
            </div>

            <div
              className="text-sm font-bold mt-2"
              style={{
                color: '#fff7d6',
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}
            >
              added to your balance
            </div>

            <div
              className="text-xs font-medium mt-3 mb-5"
              style={{ color: '#fde68a' }}
            >
              Your first deposit match is in. Time to play.
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="px-8 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, #fde047 0%, #facc15 40%, #f59e0b 100%)',
                color: '#3f1d00',
                border: '1.5px solid rgba(255, 247, 214, 0.7)',
                animation: 'bonus-cta-pulse 1.6s ease-in-out infinite',
                textShadow: '0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              Let&apos;s Go →
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
