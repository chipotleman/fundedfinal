import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import haptic from '../../utils/haptics';

// Cinematic "HOW DO YOU WANT TO BATTLE?" mode picker. Three side-by-side
// cards (blue Quick Match / red Challenge Friend / green Private Match) over a
// dark arena backdrop, and a "FAIR PLAY GUARANTEED" footer.
//
// Each card's art is a fully INLINE, ANIMATED SVG emblem rendered in the
// cartoon house style (thick black outlines, bold flat fills, bouncy motion):
//   • Quick Match     → a pulsing lightning bolt with speed streaks + sparks.
//   • Challenge Friend → two crossed swords that clash with a spark burst.
//   • Private Match    → a wobbling padlock with glinting sparkles.
// They were previously remote PNGs under public/images/battle-modes/ (one was
// 200KB+), which loaded slowly / not at all on mobile and on the deploy. Inline
// SVG has ZERO network cost, so the art paints instantly on every device.
// Purple is intentionally avoided per the project's palette preference, and
// every hover lift is gated under @media (hover: hover) so touch devices never
// get sticky hover states. All motion is disabled under prefers-reduced-motion.

const LightningIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 26, height: 26 }} aria-hidden="true">
    <path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z" />
  </svg>
);

const Chevrons = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
    <polyline points="5 5 12 12 5 19" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ── Inline animated cartoon art ─────────────────────────────────────────────

const QuickMatchArt = () => (
  <svg className="bmc-svg" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <g className="bmc-streaks" stroke="#3b82f6" strokeWidth="7" strokeLinecap="round">
      <line x1="18" y1="58" x2="58" y2="58" />
      <line x1="10" y1="100" x2="62" y2="100" />
      <line x1="20" y1="142" x2="56" y2="142" />
    </g>
    <g className="bmc-emblem">
      <path
        className="bmc-bolt-art"
        d="M118 22 L62 108 H96 L82 178 L150 84 H114 L128 22 Z"
        fill="#fbbf24"
        stroke="#0a0a0a"
        strokeWidth="7"
        strokeLinejoin="round"
      />
    </g>
    <g fill="#fde68a" stroke="#0a0a0a" strokeWidth="2.5">
      <circle className="bmc-spark sp1" cx="152" cy="48" r="6" />
      <circle className="bmc-spark sp2" cx="46" cy="152" r="5" />
      <circle className="bmc-spark sp3" cx="162" cy="132" r="4.5" />
    </g>
  </svg>
);

const Sword = ({ className }) => (
  <g className={className}>
    <path d="M100 26 L108 52 L108 128 L92 128 L92 52 Z" fill="#e2e8f0" stroke="#0a0a0a" strokeWidth="5" strokeLinejoin="round" />
    <line x1="100" y1="40" x2="100" y2="122" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
    <rect x="76" y="126" width="48" height="14" rx="6" fill="#ef4444" stroke="#0a0a0a" strokeWidth="5" />
    <rect x="92" y="139" width="16" height="30" rx="5" fill="#7c2d12" stroke="#0a0a0a" strokeWidth="5" />
    <circle cx="100" cy="172" r="9" fill="#ef4444" stroke="#0a0a0a" strokeWidth="5" />
  </g>
);

const ChallengeFriendArt = () => (
  <svg className="bmc-svg" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <Sword className="bmc-sword sword-a" />
    <Sword className="bmc-sword sword-b" />
    <path
      className="bmc-clash"
      d="M100 62 L110 90 L138 100 L110 110 L100 138 L90 110 L62 100 L90 90 Z"
      fill="#fde68a"
      stroke="#0a0a0a"
      strokeWidth="3"
      strokeLinejoin="round"
    />
  </svg>
);

const PrivateMatchArt = () => (
  <svg className="bmc-svg" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <g className="bmc-emblem">
      <path d="M68 94 V72 a32 32 0 0 1 64 0 V94" fill="none" stroke="#0a0a0a" strokeWidth="13" strokeLinecap="round" />
      <path d="M68 94 V72 a32 32 0 0 1 64 0 V94" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round" />
      <rect x="50" y="92" width="100" height="82" rx="18" fill="#10b981" stroke="#0a0a0a" strokeWidth="7" />
      <circle cx="100" cy="124" r="12" fill="#064e3b" stroke="#0a0a0a" strokeWidth="5" />
      <path d="M100 130 l-8 24 h16 z" fill="#064e3b" stroke="#0a0a0a" strokeWidth="5" strokeLinejoin="round" />
    </g>
    <g fill="#a7f3d0" stroke="#0a0a0a" strokeWidth="2.5">
      <circle className="bmc-spark sp1" cx="162" cy="58" r="5.5" />
      <circle className="bmc-spark sp2" cx="40" cy="150" r="4.5" />
    </g>
  </svg>
);

export default function BattleModeChooser({
  isOpen,
  onClose,
  onPickQuickMatch,
  onPickChallengeFriend,
  onPickPrivateMatch,
  // currentUser is accepted for API compatibility but intentionally unused —
  // the card art is the same generic default for everyone (no per-user fetch).
  currentUser = null,
}) {
  useModalScrollLock(isOpen);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const pick = (fn) => {
    haptic.tap();
    if (typeof fn === 'function') fn();
  };

  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="bmc-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How do you want to battle?"
    >
      <div className="bmc-shell" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="bmc-close no-hover-effect"
          onClick={() => { haptic.tap(); onClose(); }}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ width: 18, height: 18 }}>
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <div className="bmc-header">
          <h2 className="bmc-title">
            <span className="bmc-bolt">{LightningIcon()}</span>
            HOW DO YOU WANT TO BATTLE?
            <span className="bmc-bolt">{LightningIcon()}</span>
          </h2>
          <p className="bmc-subtitle">Jump in. Pick your opponent. Win.</p>
        </div>

        <div className="bmc-cards">
          {/* QUICK MATCH */}
          <button type="button" className="bmc-card bmc-card-blue no-hover-effect" onClick={() => pick(onPickQuickMatch)}>
            <div className="bmc-art">
              <QuickMatchArt />
              <span className="bmc-art-fade" />
            </div>
            <div className="bmc-body">
              <h3 className="bmc-mode">Quick Match</h3>
              <p className="bmc-desc">Jump in and get matched against a random player.</p>
              <span className="bmc-pill bmc-pill-blue">⚡ Fastest way to play</span>
              <span className="bmc-action bmc-action-blue">Find Opponent <Chevrons /></span>
            </div>
          </button>

          {/* CHALLENGE FRIEND */}
          <button type="button" className="bmc-card bmc-card-red no-hover-effect" onClick={() => pick(onPickChallengeFriend)}>
            <div className="bmc-art">
              <ChallengeFriendArt />
              <span className="bmc-art-fade" />
            </div>
            <div className="bmc-body">
              <h3 className="bmc-mode">Challenge Friend</h3>
              <p className="bmc-desc">Send a challenge and battle a friend head-to-head.</p>
              <span className="bmc-pill bmc-pill-red">👥 Play your friends</span>
              <span className="bmc-action bmc-action-red">Challenge a Friend <Chevrons /></span>
            </div>
          </button>

          {/* PRIVATE MATCH */}
          <button type="button" className="bmc-card bmc-card-green no-hover-effect" onClick={() => pick(onPickPrivateMatch)}>
            <div className="bmc-art">
              <PrivateMatchArt />
              <span className="bmc-art-fade" />
            </div>
            <div className="bmc-body">
              <h3 className="bmc-mode">Private Match</h3>
              <p className="bmc-desc">Create a room and battle with a code.</p>
              <span className="bmc-pill bmc-pill-green">🔒 You're in control</span>
              <span className="bmc-action bmc-action-green">Create Room <Chevrons /></span>
            </div>
          </button>
        </div>

        <div className="bmc-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} aria-hidden="true">
            <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
          </svg>
          Fair Play Guaranteed
        </div>
      </div>

      <style jsx>{`
        .bmc-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 24px 16px;
          background: radial-gradient(120% 120% at 50% 0%, rgba(12, 22, 44, 0.92) 0%, rgba(2, 6, 16, 0.96) 60%, rgba(0, 0, 0, 0.97) 100%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          animation: bmcFade 180ms ease both;
        }
        .bmc-shell {
          position: relative;
          width: 100%;
          max-width: 1040px;
          margin: auto;
          animation: bmcPop 240ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .bmc-close {
          position: absolute;
          top: -6px;
          left: 0;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #e5e7eb;
          cursor: pointer;
          z-index: 3;
          transition: background-color 120ms ease, transform 120ms ease;
        }
        .bmc-close:active { transform: scale(0.92); }
        @media (hover: hover) {
          .bmc-close:hover { background: rgba(255, 255, 255, 0.14); }
        }
        .bmc-header { text-align: center; margin: 8px 0 22px; }
        .bmc-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin: 0;
          color: #f8fafc;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          font-size: clamp(20px, 4vw, 34px);
          line-height: 1.05;
          text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6), 0 0 26px rgba(59, 130, 246, 0.35);
        }
        .bmc-bolt { color: #fbbf24; display: inline-flex; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)); }
        .bmc-subtitle {
          margin: 10px 0 0;
          color: rgba(148, 163, 184, 0.95);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: clamp(10px, 1.6vw, 13px);
        }
        .bmc-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .bmc-card {
          position: relative;
          display: flex;
          flex-direction: column;
          text-align: center;
          padding: 0 0 18px;
          border-radius: 18px;
          border: 1.5px solid var(--edge);
          background: linear-gradient(180deg, var(--tint) 0%, rgba(7, 11, 22, 0.96) 58%);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 0 28px var(--halo);
          cursor: pointer;
          overflow: hidden;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .bmc-card:active { transform: translateY(1px) scale(0.995); }
        @media (hover: hover) {
          .bmc-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 26px 52px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 40px var(--halo);
          }
        }
        .bmc-card-blue { --edge: rgba(59, 130, 246, 0.55); --tint: rgba(30, 64, 175, 0.32); --halo: rgba(37, 99, 235, 0.3); }
        .bmc-card-red { --edge: rgba(239, 68, 68, 0.55); --tint: rgba(153, 27, 27, 0.32); --halo: rgba(220, 38, 38, 0.32); }
        .bmc-card-green { --edge: rgba(16, 185, 129, 0.55); --tint: rgba(6, 95, 70, 0.34); --halo: rgba(5, 150, 105, 0.32); }

        .bmc-art {
          position: relative;
          height: 200px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(95% 85% at 50% 32%, var(--halo) 0%, transparent 72%);
        }
        .bmc-svg {
          width: 88%;
          height: 88%;
          display: block;
          pointer-events: none;
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
        }
        .bmc-art-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, transparent 60%, rgba(7, 11, 22, 0.72) 86%, rgba(7, 11, 22, 0.99) 100%);
        }

        /* ── Animations (all GPU-cheap transforms / opacity) ── */
        .bmc-emblem { transform-box: view-box; transform-origin: 100px 100px; animation: bmcFloat 3.2s ease-in-out infinite; }
        .bmc-bolt-art { transform-box: view-box; transform-origin: 100px 100px; animation: bmcPulse 1.4s ease-in-out infinite; }
        .bmc-streaks { animation: bmcStreaks 1.1s ease-in-out infinite; }
        .bmc-streaks line { stroke-opacity: 0.55; }
        .bmc-spark { transform-box: view-box; transform-origin: center; animation: bmcTwinkle 1.5s ease-in-out infinite; }
        .bmc-spark.sp2 { animation-delay: 0.4s; }
        .bmc-spark.sp3 { animation-delay: 0.8s; }
        .bmc-sword { transform-box: view-box; transform-origin: 100px 100px; }
        .sword-a { animation: bmcClashA 1.7s ease-in-out infinite; }
        .sword-b { animation: bmcClashB 1.7s ease-in-out infinite; }
        .bmc-clash { transform-box: view-box; transform-origin: 100px 100px; animation: bmcClashSpark 1.7s ease-in-out infinite; }

        @keyframes bmcFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes bmcPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes bmcStreaks { 0%, 100% { transform: translateX(0); opacity: 0.85; } 50% { transform: translateX(-7px); opacity: 0.35; } }
        @keyframes bmcTwinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes bmcClashA { 0%, 100% { transform: rotate(45deg); } 46% { transform: rotate(38deg); } 54% { transform: rotate(38deg); } }
        @keyframes bmcClashB { 0%, 100% { transform: rotate(-45deg); } 46% { transform: rotate(-38deg); } 54% { transform: rotate(-38deg); } }
        @keyframes bmcClashSpark { 0%, 40% { opacity: 0; transform: scale(0.4) rotate(0deg); } 52% { opacity: 1; transform: scale(1.25) rotate(20deg); } 70%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); } }

        .bmc-body {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          padding: 4px 16px 0;
          margin-top: -6px;
        }
        .bmc-mode {
          margin: 0;
          color: #f8fafc;
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-size: 20px;
          text-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
        }
        .bmc-desc {
          margin: 0;
          min-height: 34px;
          color: rgba(203, 213, 225, 0.88);
          font-size: 13px;
          line-height: 1.35;
        }
        .bmc-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .bmc-pill-blue { color: #93c5fd; background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.4); }
        .bmc-pill-red { color: #fca5a5; background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.4); }
        .bmc-pill-green { color: #6ee7b7; background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.4); }
        .bmc-action {
          margin-top: 6px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 12px;
          border-radius: 11px;
          color: #fff;
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 14px;
          border: 1.5px solid rgba(0, 0, 0, 0.35);
        }
        .bmc-action-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); box-shadow: 0 6px 0 #102a63, 0 8px 18px rgba(37, 99, 235, 0.4); }
        .bmc-action-red { background: linear-gradient(135deg, #ef4444, #b91c1c); box-shadow: 0 6px 0 #5e1212, 0 8px 18px rgba(220, 38, 38, 0.4); }
        .bmc-action-green { background: linear-gradient(135deg, #10b981, #047857); box-shadow: 0 6px 0 #064031, 0 8px 18px rgba(5, 150, 105, 0.4); }

        .bmc-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 16px;
          color: rgba(148, 163, 184, 0.85);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 11px;
        }

        @media (max-width: 760px) {
          .bmc-overlay { padding: 16px 12px; align-items: flex-start; }
          .bmc-shell { padding-top: 8px; }
          .bmc-close { position: sticky; top: 0; }
          .bmc-cards { grid-template-columns: 1fr; gap: 14px; }
          .bmc-card { flex-direction: row; text-align: left; padding: 0; align-items: stretch; }
          .bmc-art { height: auto; width: 40%; min-height: 150px; flex-shrink: 0; border-radius: 18px 0 0 18px; }
          .bmc-art-fade {
            background: linear-gradient(90deg, transparent 42%, rgba(7, 11, 22, 0.85) 94%);
          }
          .bmc-body { align-items: flex-start; text-align: left; padding: 14px 14px 14px 6px; margin-top: 0; gap: 7px; }
          .bmc-desc { min-height: 0; }
          .bmc-action { width: auto; align-self: stretch; }
        }

        @keyframes bmcFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bmcPop { 0% { transform: scale(0.94) translateY(8px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .bmc-overlay, .bmc-shell { animation: none; }
          .bmc-card { transition: none; }
          .bmc-emblem, .bmc-bolt-art, .bmc-streaks, .bmc-spark, .sword-a, .sword-b, .bmc-clash { animation: none; }
          .sword-a { transform: rotate(45deg); }
          .sword-b { transform: rotate(-45deg); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
