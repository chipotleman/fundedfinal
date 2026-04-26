import { getBadgeForAchievement } from '../lib/achievementBadges';

/**
 * Renders a unique illustrated SVG badge for an achievement id.
 *
 * Props:
 *  - achievementId: string  (looked up in `lib/achievementBadges.js`)
 *  - earned: boolean        (true → full color, false → desaturated + lock overlay)
 *  - size: number           (px, default 96)
 *  - className: string
 *
 * Idle animations are CSS-driven and automatically disable under
 * `prefers-reduced-motion: reduce`.
 */
export default function AchievementBadge({
  achievementId,
  earned = false,
  size = 96,
  className = '',
}) {
  const badge = getBadgeForAchievement(achievementId);
  const uid = `b-${achievementId || 'fallback'}`;
  const showAnimations = !!earned;

  return (
    <div
      className={`achv-badge ${earned ? 'is-earned' : 'is-locked'} ${className}`}
      style={{ width: size, height: size }}
      aria-label={earned ? `${badge.name} badge` : `${badge.name} badge (locked)`}
      role="img"
    >
      <div className="achv-badge__inner">
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>{renderDefs(uid, badge)}</defs>
          {showAnimations && badge.rarity === 'Uncommon' && (
            <circle
              cx="50"
              cy="50"
              r="44"
              fill={badge.palette.highlight}
              opacity="0.55"
              filter={`url(#${uid}-soft)`}
              className="achv-glow"
            />
          )}
          {showAnimations && badge.rarity === 'Epic' && (
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke={`url(#${uid}-halo)`}
              strokeWidth="2"
              className="achv-halo"
            />
          )}
          {renderShape(uid, badge)}
          {renderEmblem(uid, badge)}
          {showAnimations && (badge.rarity === 'Rare' || badge.rarity === 'Epic') && (
            <g className="achv-shimmer" clipPath={`url(#${uid}-clip)`}>
              <rect x="-40" y="0" width="20" height="100" fill="white" opacity="0.35" transform="skewX(-20)" />
            </g>
          )}
          {showAnimations && badge.rarity === 'Epic' && (
            <g className="achv-sparkles">
              <Sparkle cx="18" cy="22" r="1.6" />
              <Sparkle cx="82" cy="28" r="2" delay="0.6s" />
              <Sparkle cx="78" cy="78" r="1.4" delay="1.1s" />
              <Sparkle cx="22" cy="80" r="1.8" delay="1.6s" />
            </g>
          )}
        </svg>
        {!earned && <LockOverlay />}
      </div>
      <style jsx>{`
        .achv-badge {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
        }
        .achv-badge__inner {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .achv-badge.is-locked .achv-badge__inner > svg {
          filter: grayscale(1) brightness(0.55);
          opacity: 0.85;
        }
        :global(.achv-halo) {
          transform-origin: 50% 50%;
          animation: achvHaloSpin 6s linear infinite;
        }
        :global(.achv-shimmer) {
          animation: achvShimmer 3.4s ease-in-out infinite;
        }
        :global(.achv-flame) {
          transform-origin: 50% 70%;
          animation: achvFlameFlicker 1.4s ease-in-out infinite;
        }
        :global(.achv-sparkle) {
          transform-origin: center;
          transform-box: fill-box;
          animation: achvSparkle 2.4s ease-in-out infinite;
        }
        :global(.achv-glow) {
          animation: achvGlowPulse 2.8s ease-in-out infinite;
        }
        @keyframes achvHaloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes achvShimmer {
          0% { transform: translateX(-30px); opacity: 0; }
          25% { opacity: 1; }
          70% { transform: translateX(140px); opacity: 0; }
          100% { transform: translateX(140px); opacity: 0; }
        }
        @keyframes achvFlameFlicker {
          0%, 100% { transform: scale(1, 1); }
          40% { transform: scale(1.04, 0.96); }
          70% { transform: scale(0.97, 1.05); }
        }
        @keyframes achvSparkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes achvGlowPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.achv-halo),
          :global(.achv-shimmer),
          :global(.achv-flame),
          :global(.achv-sparkle),
          :global(.achv-glow) {
            animation: none !important;
          }
          :global(.achv-shimmer) { display: none; }
          :global(.achv-sparkle) { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

function Sparkle({ cx, cy, r = 1.5, delay = '0s' }) {
  return (
    <g style={{ animationDelay: delay }} className="achv-sparkle">
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <path
        d={`M ${cx - r * 2.4} ${cy} L ${cx + r * 2.4} ${cy} M ${cx} ${cy - r * 2.4} L ${cx} ${cy + r * 2.4}`}
        stroke="#fff"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </g>
  );
}

function LockOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '38%',
          height: '38%',
          borderRadius: '9999px',
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#cbd5e1" strokeWidth="2">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
    </div>
  );
}

function renderDefs(uid, badge) {
  const { palette } = badge;
  // Matte for Common, increasingly glossy for higher rarities so the
  // tier reads at a glance even before idle animations kick in.
  const shineByRarity = {
    Common: 0.18,
    Uncommon: 0.4,
    Rare: 0.55,
    Epic: 0.65,
  };
  const shineOpacity = shineByRarity[badge.rarity] ?? 0.4;
  return (
    <>
      <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={palette.highlight} />
        <stop offset="55%" stopColor={palette.base} />
        <stop offset="100%" stopColor={palette.accent} />
      </linearGradient>
      <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.95" />
        <stop offset="100%" stopColor={palette.accent} />
      </linearGradient>
      <radialGradient id={`${uid}-shine`} cx="35%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={shineOpacity} />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-halo`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.9" />
        <stop offset="50%" stopColor={palette.secondary || palette.base} stopOpacity="0.6" />
        <stop offset="100%" stopColor={palette.accent} stopOpacity="0.9" />
      </linearGradient>
      <clipPath id={`${uid}-clip`}>
        {clipForShape(badge.shape)}
      </clipPath>
      <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.4" />
      </filter>
    </>
  );
}

function clipForShape(shape) {
  switch (shape) {
    case 'shield':
      return <path d="M50 6 L86 18 L86 52 C86 74 70 88 50 94 C30 88 14 74 14 52 L14 18 Z" />;
    case 'hex':
      return <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" />;
    case 'star':
      return <polygon points={STAR_POINTS} />;
    case 'gem':
      return <polygon points="50,6 84,32 70,92 30,92 16,32" />;
    case 'coin':
    case 'medal':
    case 'flameDisc':
    case 'crownDisc':
    default:
      return <circle cx="50" cy="50" r="42" />;
  }
}

const STAR_POINTS =
  '50,8 60,38 92,38 66,57 76,88 50,70 24,88 34,57 8,38 40,38';

function renderShape(uid, badge) {
  const baseFill = `url(#${uid}-base)`;
  const shine = `url(#${uid}-shine)`;
  const rim = `url(#${uid}-rim)`;

  switch (badge.shape) {
    case 'shield':
      return (
        <g>
          <path
            d="M50 4 L88 16 L88 52 C88 76 70 90 50 96 C30 90 12 76 12 52 L12 16 Z"
            fill={rim}
          />
          <path
            d="M50 9 L84 19 L84 52 C84 73 68 86 50 92 C32 86 16 73 16 52 L16 19 Z"
            fill={baseFill}
          />
          <path
            d="M50 9 L84 19 L84 52 C84 73 68 86 50 92 C32 86 16 73 16 52 L16 19 Z"
            fill={shine}
          />
        </g>
      );
    case 'hex':
      return (
        <g>
          <polygon points="50,4 90,26 90,74 50,96 10,74 10,26" fill={rim} />
          <polygon points="50,10 86,30 86,70 50,90 14,70 14,30" fill={baseFill} />
          <polygon points="50,10 86,30 86,70 50,90 14,70 14,30" fill={shine} />
        </g>
      );
    case 'star':
      return (
        <g>
          <polygon points={STAR_POINTS} fill={rim} />
          <polygon
            points={STAR_POINTS}
            fill={baseFill}
            transform="translate(50 50) scale(0.92) translate(-50 -50)"
          />
          <polygon
            points={STAR_POINTS}
            fill={shine}
            transform="translate(50 50) scale(0.92) translate(-50 -50)"
          />
        </g>
      );
    case 'gem':
      return (
        <g>
          <polygon points="50,4 86,32 70,94 30,94 14,32" fill={rim} />
          <polygon points="50,9 82,33 68,90 32,90 18,33" fill={baseFill} />
          <polygon points="50,9 82,33 50,50 18,33" fill="#ffffff" opacity="0.3" />
          <polygon points="50,50 68,90 32,90" fill="#000000" opacity="0.18" />
          <polygon points="50,9 82,33 68,90 32,90 18,33" fill={shine} />
        </g>
      );
    case 'coin':
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={rim} />
          <circle cx="50" cy="50" r="40" fill={baseFill} />
          <circle cx="50" cy="50" r="40" fill={shine} />
          <circle cx="50" cy="50" r="40" fill="none" stroke={badge.palette.accent} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.55" />
        </g>
      );
    case 'flameDisc':
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={rim} />
          <circle cx="50" cy="50" r="40" fill={baseFill} />
          <circle cx="50" cy="50" r="40" fill={shine} />
        </g>
      );
    case 'crownDisc':
      return (
        <g>
          <circle cx="50" cy="50" r="44" fill={rim} />
          <circle cx="50" cy="50" r="40" fill={baseFill} />
          <circle cx="50" cy="50" r="40" fill={shine} />
        </g>
      );
    case 'medal':
    default:
      return (
        <g>
          <path d="M30 6 L40 6 L46 30 L34 30 Z" fill={badge.palette.accent} opacity="0.85" />
          <path d="M70 6 L60 6 L54 30 L66 30 Z" fill={badge.palette.accent} opacity="0.85" />
          <circle cx="50" cy="60" r="34" fill={rim} />
          <circle cx="50" cy="60" r="30" fill={baseFill} />
          <circle cx="50" cy="60" r="30" fill={shine} />
          <circle cx="50" cy="60" r="30" fill="none" stroke={badge.palette.highlight} strokeWidth="0.8" opacity="0.6" />
        </g>
      );
  }
}

function renderEmblem(uid, badge) {
  switch (badge.emblem) {
    case 'one':
      return (
        <g fill="#ffffff" stroke={badge.palette.accent} strokeWidth="0.8">
          <text
            x="50"
            y="72"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="900"
            fontSize="34"
            style={{ paintOrder: 'stroke' }}
          >
            1
          </text>
        </g>
      );
    case 'target':
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="20" stroke="#ffffff" strokeWidth="3" opacity="0.95" />
          <circle cx="50" cy="50" r="12" stroke="#ffffff" strokeWidth="2.5" opacity="0.85" />
          <circle cx="50" cy="50" r="5" fill="#ffffff" />
        </g>
      );
    case 'bars':
      return (
        <g fill="#ffffff">
          <rect x="32" y="58" width="8" height="18" rx="1.5" opacity="0.95" />
          <rect x="46" y="48" width="8" height="28" rx="1.5" />
          <rect x="60" y="38" width="8" height="38" rx="1.5" opacity="0.95" />
          <path d="M30 36 L50 24 L70 30" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="30" cy="36" r="2.4" />
          <circle cx="50" cy="24" r="2.4" />
          <circle cx="70" cy="30" r="2.4" />
        </g>
      );
    case 'hundred':
      return (
        <g fill="#ffffff">
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="900"
            fontSize="22"
            stroke={badge.palette.accent}
            strokeWidth="0.7"
            style={{ paintOrder: 'stroke' }}
          >
            100
          </text>
        </g>
      );
    case 'flame':
      return (
        <g className="achv-flame">
          <path
            d="M50 22 C58 32 66 38 64 50 C63 60 58 66 50 70 C42 66 37 60 36 50 C36 42 42 38 44 32 C46 36 48 38 50 38 C50 30 48 26 50 22 Z"
            fill="#fff7ed"
          />
          <path
            d="M50 36 C54 42 58 46 56 54 C55 60 52 64 50 66 C46 64 44 60 44 54 C44 48 47 46 49 42 C49 44 50 46 50 46 C50 42 49 38 50 36 Z"
            fill={badge.palette.accent}
          />
        </g>
      );
    case 'flameBig':
      return (
        <g className="achv-flame">
          <path
            d="M50 14 C62 28 70 36 68 52 C66 64 60 72 50 76 C40 72 34 64 32 52 C32 42 40 36 42 28 C44 34 47 36 50 36 C50 26 48 20 50 14 Z"
            fill="#fff7ed"
          />
          <path
            d="M50 30 C56 38 62 44 60 54 C59 62 55 68 50 70 C45 68 41 62 40 54 C40 46 45 44 47 38 C48 42 49 44 50 44 C50 38 49 34 50 30 Z"
            fill={badge.palette.accent}
          />
          <path
            d="M50 44 C53 50 56 54 55 60 C54 64 52 66 50 68 C48 66 46 64 45 60 C45 56 47 54 49 50 Z"
            fill={badge.palette.secondary || badge.palette.highlight}
          />
        </g>
      );
    case 'dollar':
      return (
        <g>
          <text
            x="50"
            y="68"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="900"
            fontSize="44"
            fill="#ffffff"
            stroke={badge.palette.accent}
            strokeWidth="1"
            style={{ paintOrder: 'stroke' }}
          >
            $
          </text>
        </g>
      );
    case 'diamond':
      return (
        <g>
          <polygon
            points="50,32 64,46 50,72 36,46"
            fill="#ffffff"
            opacity="0.92"
          />
          <polygon
            points="50,32 64,46 50,52 36,46"
            fill={badge.palette.highlight}
            opacity="0.9"
          />
          <polygon
            points="36,46 50,52 50,72"
            fill={badge.palette.accent}
            opacity="0.35"
          />
        </g>
      );
    case 'swords':
      return (
        <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="#ffffff">
          <line x1="28" y1="30" x2="64" y2="66" />
          <line x1="72" y1="30" x2="36" y2="66" />
          <circle cx="28" cy="30" r="3.5" />
          <circle cx="72" cy="30" r="3.5" />
          <rect x="32" y="64" width="14" height="4" rx="1.5" transform="rotate(-45 39 66)" fill={badge.palette.accent} stroke={badge.palette.accent} />
          <rect x="54" y="64" width="14" height="4" rx="1.5" transform="rotate(45 61 66)" fill={badge.palette.accent} stroke={badge.palette.accent} />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path
            d="M24 60 L30 36 L42 50 L50 30 L58 50 L70 36 L76 60 Z"
            fill="#ffffff"
            stroke={badge.palette.accent}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x="26" y="62" width="48" height="8" rx="2" fill="#ffffff" stroke={badge.palette.accent} strokeWidth="1.2" />
          <circle cx="50" cy="30" r="3" fill={badge.palette.secondary || badge.palette.accent} />
          <circle cx="30" cy="36" r="2.4" fill={badge.palette.secondary || badge.palette.accent} />
          <circle cx="70" cy="36" r="2.4" fill={badge.palette.secondary || badge.palette.accent} />
        </g>
      );
    case 'star':
    default:
      return (
        <g fill="#ffffff">
          <polygon points="50,30 56,46 72,46 59,56 64,72 50,62 36,72 41,56 28,46 44,46" />
        </g>
      );
  }
}
