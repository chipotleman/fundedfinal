import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNotifications } from '../../contexts/NotificationsContext';
import AchievementDetailModal from '../AchievementDetailModal';

const AUTO_DISMISS_MS = 4500;
const ENTRANCE_LOCKOUT_MS = 350;
const UNLOCK_VIBRATION_PATTERN = [30, 40, 60];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function buzzForUnlock() {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(UNLOCK_VIBRATION_PATTERN);
  } catch {
    // Some browsers throw on certain patterns or in iframes — stay silent.
  }
}

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
    <Celebration achievement={current} onDismiss={dismissAchievementUnlock} />,
    document.body
  );
}

// Wraps the existing AchievementDetailModal in a celebratory layer of
// confetti, sparkles, and a radial glow burst — so the moment of *earning*
// a badge feels rewarding while still reusing the same detail card the user
// gets when tapping a badge in their profile (task #368).
function Celebration({ achievement, onDismiss }) {
  const dismissedRef = useRef(false);
  const openedAtRef = useRef(Date.now());

  // Reset entrance state whenever a new achievement takes the head of the
  // queue so back-to-back unlocks each get a fresh celebration. Also fire
  // a short haptic buzz so hitting a milestone feels tactile on mobile —
  // gracefully no-ops on devices without the Vibration API and is
  // suppressed when the user prefers reduced motion.
  useEffect(() => {
    dismissedRef.current = false;
    openedAtRef.current = Date.now();
    buzzForUnlock();
  }, [achievement.id]);

  // Auto-dismiss after a few seconds — gives the user time to read the
  // detail card without trapping them.
  useEffect(() => {
    const id = achievement.id;
    const timer = setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      onDismiss?.(id);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [achievement.id, onDismiss]);

  const handleClose = () => {
    if (dismissedRef.current) return;
    // Ignore taps that arrive during the entrance — protects against an
    // accidental tap-through immediately as the celebration appears.
    if (Date.now() - openedAtRef.current < ENTRANCE_LOCKOUT_MS) return;
    dismissedRef.current = true;
    onDismiss?.(achievement.id);
  };

  // Map the SSE/catch-up payload onto the shape AchievementDetailModal
  // expects. The modal already looks up rarity + badge art via the
  // achievement id, so we only need the human-readable bits + earned
  // metadata.
  const modalAchievement = {
    achievementId: achievement.id,
    name: achievement.name || null,
    description: achievement.description || null,
    earned: true,
    earnedAt: achievement.earnedAt || new Date().toISOString(),
    progressPercent: 100,
    progressText: null,
    progressLabel: null,
  };

  return (
    <>
      <style>{`
        @keyframes achv-unlock-banner-in {
          0% { opacity: 0; transform: translate(-50%, -16px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes achv-unlock-burst {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          40% { opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes achv-unlock-ring {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.0); opacity: 0; }
        }
        @keyframes achv-unlock-spark {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes achv-unlock-confetti {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% {
            transform:
              translate(var(--cx, 0px), var(--cy, -260px))
              rotate(var(--cr, 540deg));
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .achv-unlock-fx,
          .achv-unlock-fx * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            animation-delay: 0ms !important;
          }
          .achv-unlock-fx .achv-unlock-particles { display: none !important; }
          .achv-unlock-fx .achv-unlock-burst,
          .achv-unlock-fx .achv-unlock-ring,
          .achv-unlock-fx .achv-unlock-banner { animation: none !important; }
        }
      `}</style>

      {/* Reuse the same detail card the badge tap-to-inspect surface uses,
          so the celebrated badge looks identical to its detail view. The
          modal handles its own backdrop, scroll lock, focus trap, and
          Escape-to-close. */}
      <AchievementDetailModal
        achievement={modalAchievement}
        isOpen
        onClose={handleClose}
      />

      {/* Celebratory FX layer — sits above the modal backdrop (z=60) so the
          glow / confetti read as bursting outward from the centered card.
          pointer-events:none lets taps fall through to the modal so the
          backdrop dismiss still works. */}
      <div
        className="achv-unlock-fx fixed inset-0 z-[80] pointer-events-none"
        aria-hidden="true"
        data-allow-fixed-overlay="true"
      >
        {/* Soft golden halo behind the card */}
        <div
          className="achv-unlock-burst absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 420,
            height: 420,
            transform: 'translate(-50%, -50%) scale(0.2)',
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.45) 0%, rgba(245, 158, 11, 0.28) 35%, transparent 70%)',
            filter: 'blur(10px)',
            animation: 'achv-unlock-burst 1.6s ease-out forwards',
          }}
        />
        <div
          className="achv-unlock-ring absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 260,
            height: 260,
            borderRadius: '9999px',
            border: '2px solid rgba(253, 224, 71, 0.7)',
            transform: 'translate(-50%, -50%) scale(0.4)',
            animation: 'achv-unlock-ring 1.2s ease-out 0.05s forwards',
          }}
        />
        <div
          className="achv-unlock-ring absolute"
          style={{
            top: '50%',
            left: '50%',
            width: 260,
            height: 260,
            borderRadius: '9999px',
            border: '2px solid rgba(250, 204, 21, 0.45)',
            transform: 'translate(-50%, -50%) scale(0.4)',
            animation: 'achv-unlock-ring 1.5s ease-out 0.25s forwards',
          }}
        />

        {/* "Achievement Unlocked" gold banner above the card */}
        <div
          className="achv-unlock-banner absolute text-[11px] font-black uppercase tracking-[0.32em] px-3 py-1.5 rounded-full"
          style={{
            top: 'calc(50% - 230px)',
            left: '50%',
            transform: 'translate(-50%, 0)',
            color: '#fde68a',
            background: 'rgba(15, 10, 0, 0.7)',
            border: '1px solid rgba(253, 224, 71, 0.5)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 18px rgba(253, 224, 71, 0.35)',
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            animation: 'achv-unlock-banner-in 0.45s ease-out 0.1s both',
            whiteSpace: 'nowrap',
          }}
        >
          Achievement Unlocked
        </div>

        {/* Confetti + sparkles. Pre-computed positions so the entrance
            animations don't restart on parent re-renders. */}
        <div className="achv-unlock-particles absolute inset-0 overflow-hidden">
          {CONFETTI_PIECES.map((piece, i) => (
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
                animation: `achv-unlock-confetti ${piece.dur}s cubic-bezier(0.2, 0.7, 0.4, 1) ${piece.delay}s forwards`,
                boxShadow: '0 0 6px rgba(253, 224, 71, 0.5)',
                ['--cx']: `${piece.x}px`,
                ['--cy']: `${piece.y}px`,
                ['--cr']: `${piece.r}deg`,
              }}
            />
          ))}
          {SPARKLE_POSITIONS.map((s, i) => (
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
                animation: `achv-unlock-spark ${1.4 + (i % 4) * 0.3}s ease-in-out ${0.2 + i * 0.08}s infinite`,
              }}
            />
          ))}
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
    const distance = 240 + (i % 5) * 30;
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
