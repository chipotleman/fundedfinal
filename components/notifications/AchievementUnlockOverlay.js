import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNotifications } from '../../contexts/NotificationsContext';
import AchievementBadge from '../AchievementBadge';

const AUTO_DISMISS_MS = 3200;
const ENTRANCE_LOCKOUT_MS = 350;

export default function AchievementUnlockOverlay() {
  const ctx = useNotifications();
  const current = ctx?.currentAchievementUnlock || null;
  const dismissAchievementUnlock = ctx?.dismissAchievementUnlock;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !current || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <Overlay achievement={current} onDismiss={dismissAchievementUnlock} />,
    document.body
  );
}

function Overlay({ achievement, onDismiss }) {
  const dismissedRef = useRef(false);
  const openedAtRef = useRef(Date.now());

  // Reset entrance timestamp whenever a new achievement takes the head of
  // the queue so back-to-back unlocks each get a clean entrance animation.
  useEffect(() => {
    dismissedRef.current = false;
    openedAtRef.current = Date.now();
  }, [achievement.id]);

  useEffect(() => {
    const id = achievement.id;
    const timer = setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      onDismiss?.(id);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [achievement.id, onDismiss]);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    // Ignore taps that arrive during the entrance — protects against an
    // accidental tap-through immediately as the overlay appears.
    if (Date.now() - openedAtRef.current < ENTRANCE_LOCKOUT_MS) return;
    dismissedRef.current = true;
    onDismiss?.(achievement.id);
  };

  const sparkles = SPARKLE_POSITIONS;
  const confetti = CONFETTI_PIECES;

  return (
    <>
      <style>{`
        @keyframes achv-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes achv-burst {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          40% { opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes achv-ring {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
        }
        @keyframes achv-badge-pop {
          0% { transform: scale(0.2) rotate(-12deg); opacity: 0; }
          55% { transform: scale(1.18) rotate(4deg); opacity: 1; }
          75% { transform: scale(0.96) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes achv-banner-up {
          0% { transform: translateY(28px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes achv-line-in {
          0% { transform: translateY(14px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes achv-spark {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes achv-confetti {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            transform:
              translate(var(--cx, 0px), var(--cy, -260px))
              rotate(var(--cr, 540deg));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .achv-overlay-root,
          .achv-overlay-root * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            animation-delay: 0ms !important;
          }
          .achv-overlay-root .achv-particles { display: none !important; }
          .achv-overlay-root .achv-burst,
          .achv-overlay-root .achv-ring { display: none !important; }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Achievement unlocked: ${achievement.name || 'New badge'}`}
        data-allow-fixed-overlay="true"
        className="achv-overlay-root fixed inset-0 z-[110] flex items-center justify-center px-4"
        style={{
          background:
            'radial-gradient(circle at center, rgba(20, 14, 0, 0.78) 0%, rgba(0, 0, 0, 0.88) 70%)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'achv-overlay-in 0.25s ease-out',
          cursor: 'pointer',
        }}
        onClick={handleDismiss}
      >
        {/* Radial glow burst behind badge */}
        <div
          className="achv-burst pointer-events-none absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 360,
            height: 360,
            transform: 'translate(-50%, -50%) scale(0.2)',
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.55) 0%, rgba(245, 158, 11, 0.35) 35%, transparent 70%)',
            filter: 'blur(8px)',
            animation: 'achv-burst 1.4s ease-out forwards',
          }}
        />
        <div
          className="achv-ring pointer-events-none absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 220,
            height: 220,
            borderRadius: '9999px',
            border: '2px solid rgba(253, 224, 71, 0.8)',
            transform: 'translate(-50%, -50%) scale(0.4)',
            animation: 'achv-ring 1.1s ease-out 0.05s forwards',
          }}
        />
        <div
          className="achv-ring pointer-events-none absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 220,
            height: 220,
            borderRadius: '9999px',
            border: '2px solid rgba(250, 204, 21, 0.55)',
            transform: 'translate(-50%, -50%) scale(0.4)',
            animation: 'achv-ring 1.4s ease-out 0.25s forwards',
          }}
        />

        {/* Confetti pieces shooting outward from the badge */}
        <div
          className="achv-particles pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {confetti.map((piece, i) => (
            <div
              key={`confetti-${i}`}
              className="absolute"
              style={{
                top: '50%',
                left: '50%',
                width: piece.w,
                height: piece.h,
                background: piece.color,
                borderRadius: piece.round ? '9999px' : '2px',
                transform: 'translate(-50%, -50%)',
                animation: `achv-confetti ${piece.dur}s cubic-bezier(0.2, 0.7, 0.4, 1) ${piece.delay}s forwards`,
                boxShadow: '0 0 6px rgba(253, 224, 71, 0.55)',
                ['--cx']: `${piece.x}px`,
                ['--cy']: `${piece.y}px`,
                ['--cr']: `${piece.r}deg`,
              }}
            />
          ))}
          {sparkles.map((s, i) => (
            <div
              key={`spark-${i}`}
              className="absolute"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                borderRadius: '9999px',
                background: '#fef9c3',
                boxShadow: '0 0 8px #fde68a, 0 0 16px #facc15',
                animation: `achv-spark ${1.4 + (i % 4) * 0.3}s ease-in-out ${0.2 + i * 0.08}s infinite`,
              }}
            />
          ))}
        </div>

        <div
          className="relative z-10 flex flex-col items-center text-center select-none"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          style={{ maxWidth: 420 }}
        >
          <div
            className="text-[11px] font-black uppercase tracking-[0.32em] mb-4"
            style={{
              color: '#fde68a',
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              animation: 'achv-banner-up 0.5s ease-out 0.1s both',
            }}
          >
            Achievement Unlocked
          </div>

          <div
            style={{
              animation:
                'achv-badge-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              filter:
                'drop-shadow(0 12px 28px rgba(250, 204, 21, 0.55)) drop-shadow(0 0 20px rgba(253, 224, 71, 0.45))',
            }}
          >
            <AchievementBadge
              achievementId={achievement.id}
              earned
              size={184}
            />
          </div>

          <div
            className="mt-6 text-2xl sm:text-3xl font-black"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #fff7d6 0%, #fde68a 35%, #facc15 70%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              letterSpacing: '0.01em',
              animation: 'achv-line-in 0.5s ease-out 0.35s both',
            }}
          >
            {achievement.name || 'New badge'}
          </div>

          {achievement.description ? (
            <div
              className="mt-2 text-sm sm:text-base font-medium px-4"
              style={{
                color: '#fef3c7',
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                animation: 'achv-line-in 0.5s ease-out 0.5s both',
                maxWidth: 360,
              }}
            >
              {achievement.description}
            </div>
          ) : null}

          <div
            className="mt-6 text-[11px] font-semibold uppercase tracking-widest"
            style={{
              color: 'rgba(253, 230, 138, 0.7)',
              animation: 'achv-line-in 0.5s ease-out 0.7s both',
            }}
          >
            Tap to dismiss
          </div>
        </div>
      </div>
    </>
  );
}

// Pre-computed positions / colors so React doesn't randomise on each render
// (which would re-run the entrance animations on every achievement update).
const CONFETTI_COLORS = [
  '#fde047',
  '#facc15',
  '#f59e0b',
  '#fb923c',
  '#fef3c7',
  '#fbbf24',
];

const CONFETTI_PIECES = (() => {
  const pieces = [];
  const count = 28;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (i % 2 ? 0.12 : -0.12);
    const distance = 220 + (i % 5) * 30;
    pieces.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      r: (i % 2 ? 1 : -1) * (320 + (i % 4) * 90),
      w: i % 3 === 0 ? 6 : 8,
      h: i % 3 === 0 ? 6 : 14,
      round: i % 4 === 0,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      dur: 1.3 + (i % 5) * 0.18,
      delay: 0.15 + (i % 6) * 0.05,
    });
  }
  return pieces;
})();

const SPARKLE_POSITIONS = [
  { top: 18, left: 22, size: 4 },
  { top: 24, left: 78, size: 5 },
  { top: 38, left: 12, size: 3 },
  { top: 62, left: 88, size: 4 },
  { top: 76, left: 28, size: 5 },
  { top: 82, left: 70, size: 3 },
  { top: 30, left: 50, size: 4 },
  { top: 70, left: 50, size: 3 },
  { top: 14, left: 60, size: 3 },
  { top: 88, left: 14, size: 4 },
];
