import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import haptic from '../../utils/haptics';

// Cinematic "HOW DO YOU WANT TO BATTLE?" mode picker. Three side-by-side
// character cards (blue Quick Match / red Challenge Friend / green Private
// Match) over a dark arena backdrop, a "WIN. CLIMB. REPEAT." reward banner,
// and a "FAIR PLAY GUARANTEED" footer.
//
// Each card's art box is filled edge-to-edge with a themed cinematic image
// (blue lightning arena / red clashing swords / green vault) stored under
// public/images/battle-modes/. A colour-tinted radial vignette + bottom fade
// melts the image into the card body, and a small themed icon chip sits in the
// bottom-left as a branded accent. (Earlier revisions used an empty box with a
// centred icon badge, which looked unfinished; AI-generated people before that
// read as generic stock art.) Purple is intentionally avoided per the project's
// palette preference, and every hover lift is gated under @media (hover: hover)
// so touch devices never get sticky hover states.

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
              <img src="/images/battle-modes/quick-match.png?v=4" alt="" className="bmc-art-img" loading="lazy" draggable="false" />
              <span className="bmc-art-fade" />
              <span className="bmc-icon-chip">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }} aria-hidden="true">
                  <path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z" />
                </svg>
              </span>
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
              <img src="/images/battle-modes/challenge-friend.png?v=4" alt="" className="bmc-art-img" loading="lazy" draggable="false" />
              <span className="bmc-art-fade" />
              <span className="bmc-icon-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
                  <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
                  <path d="m13 19 6-6" />
                  <path d="m16 16 4 4" />
                  <path d="m19 21 2-2" />
                  <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
                  <path d="m5 14 6 6" />
                  <path d="m8 17-4 4" />
                  <path d="m5 19-2-2" />
                </svg>
              </span>
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
              <img src="/images/battle-modes/private-match.png?v=4" alt="" className="bmc-art-img" loading="lazy" draggable="false" />
              <span className="bmc-art-fade" />
              <span className="bmc-icon-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2.5" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
                </svg>
              </span>
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
        .bmc-card-blue { --edge: rgba(59, 130, 246, 0.55); --tint: rgba(30, 64, 175, 0.32); --halo: rgba(37, 99, 235, 0.3); --badge-fg: #bfdbfe; --badge-bg-1: rgba(59, 130, 246, 0.35); --badge-bg-2: rgba(30, 58, 138, 0.6); }
        .bmc-card-red { --edge: rgba(239, 68, 68, 0.55); --tint: rgba(153, 27, 27, 0.32); --halo: rgba(220, 38, 38, 0.32); --badge-fg: #fecaca; --badge-bg-1: rgba(239, 68, 68, 0.35); --badge-bg-2: rgba(127, 29, 29, 0.6); }
        .bmc-card-green { --edge: rgba(16, 185, 129, 0.55); --tint: rgba(6, 95, 70, 0.34); --halo: rgba(5, 150, 105, 0.32); --badge-fg: #d1fae5; --badge-bg-1: rgba(16, 185, 129, 0.35); --badge-bg-2: rgba(6, 78, 59, 0.6); }

        .bmc-art {
          position: relative;
          height: 220px;
          overflow: hidden;
        }
        .bmc-art-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }
        .bmc-art-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          /* Tinted radial vignette ties the art to each card's colour, plus a
             bottom fade so the image melts seamlessly into the card body. */
          background:
            radial-gradient(120% 80% at 50% 18%, transparent 38%, var(--halo) 130%),
            linear-gradient(180deg, transparent 52%, rgba(7, 11, 22, 0.72) 84%, rgba(7, 11, 22, 0.99) 100%);
        }
        .bmc-icon-chip {
          position: absolute;
          z-index: 2;
          left: 12px;
          bottom: 12px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: var(--badge-fg);
          background: linear-gradient(160deg, var(--badge-bg-1), var(--badge-bg-2));
          border: 1.5px solid var(--edge);
          box-shadow: 0 0 18px var(--halo), 0 6px 14px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

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
          .bmc-art-img { border-radius: 18px 0 0 18px; }
          .bmc-art-fade {
            background:
              radial-gradient(120% 100% at 30% 40%, transparent 42%, var(--halo) 130%),
              linear-gradient(90deg, transparent 38%, rgba(7, 11, 22, 0.85) 92%);
          }
          .bmc-body { align-items: flex-start; text-align: left; padding: 14px 14px 14px 6px; margin-top: 0; gap: 7px; }
          .bmc-desc { min-height: 0; }
          .bmc-action { width: auto; align-self: stretch; }
          .bmc-icon-chip { left: 10px; bottom: 10px; width: 36px; height: 36px; border-radius: 10px; }
          .bmc-icon-chip svg { width: 18px; height: 18px; }
        }

        @keyframes bmcFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bmcPop { 0% { transform: scale(0.94) translateY(8px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .bmc-overlay, .bmc-shell { animation: none; }
          .bmc-card { transition: none; }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
