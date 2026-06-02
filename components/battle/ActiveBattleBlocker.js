import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useMatchup } from '../../contexts/MatchupContext';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';

// Cartoon-themed "you're already in a battle" blocker. Originally lived
// inline in PlayFriendModal; extracted here so Quick Match and Private
// Match can show the SAME block instead of silently opening a second
// matchmaking flow while a fight is still live. Reads the active matchup
// straight from MatchupContext so it's race-proof — it never relies on a
// stale page-level snapshot. Render it only when you've already confirmed
// `hasActiveMatchup` (each modal early-returns this in place of its body).
export default function ActiveBattleBlocker({ onClose }) {
  const router = useRouter();
  const { matchup: activeMatchup, opponent: activeOpponent } = useMatchup();

  if (typeof document === 'undefined') return null;

  const opponentName = activeOpponent?.username || 'your opponent';
  const goToBattle = () => {
    onClose?.();
    if (activeMatchup?.id) {
      navigateToBattleStart(router, activeMatchup);
    } else {
      router.push('/battle');
    }
  };

  const blocker = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
    >
      <style jsx>{`
        @keyframes abbBlockerIn {
          0% { opacity: 0; transform: scale(0.85) translateY(20px); }
          60% { opacity: 1; transform: scale(1.03) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes abbSwordSwing {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
        .abb-blocker { animation: abbBlockerIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .abb-sword { display: inline-block; animation: abbSwordSwing 1.6s ease-in-out infinite; }
        .abb-blk-primary { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        @media (hover: hover) {
          .abb-blk-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55); }
        }
        .abb-blk-primary:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
        .abb-blk-secondary { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        @media (hover: hover) {
          .abb-blk-secondary:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #0a0a0a; }
        }
        .abb-blk-secondary:active { transform: translateY(2px); box-shadow: 0 2px 0 #0a0a0a; }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="abb-blocker-title"
        className="abb-blocker rounded-3xl max-w-sm w-full overflow-hidden my-auto"
        style={{
          backgroundColor: '#0d0d0d',
          border: '2.5px solid #0a0a0a',
          boxShadow: '0 8px 0 #0a0a0a, 0 22px 44px rgba(0,0,0,0.55)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div
            className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.45)',
            }}
          >
            <span className="text-4xl abb-sword">⚔️</span>
          </div>
          <div
            className="text-[11px] font-extrabold uppercase mb-1"
            style={{ color: '#60a5fa', letterSpacing: '0.22em' }}
          >
            You're In A Battle
          </div>
          <h2
            id="abb-blocker-title"
            className="font-black uppercase"
            style={{
              color: '#fff',
              fontSize: '22px',
              letterSpacing: '0.04em',
              textShadow: '0 2px 0 #000',
            }}
          >
            Finish your fight first
          </h2>
          <p className="text-sm mt-3" style={{ color: '#9ca3af', lineHeight: 1.5 }}>
            You can't start a new battle while you're already
            matched up with <span style={{ color: '#fff', fontWeight: 700 }}>{opponentName}</span>.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: '#111',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <span className="text-lg leading-none mt-0.5">🎯</span>
            <p className="text-xs font-semibold" style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
              Head back to your battle and play it out — winner takes the pot.
            </p>
          </div>
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: '#111',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <span className="text-lg leading-none mt-0.5">🏳️</span>
            <p className="text-xs font-semibold" style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
              Or tap{' '}
              <span style={{ color: '#fb923c', fontWeight: 800 }}>Forfeit</span>
              {' '}on your battle to surrender — then you'll be free to start anything.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 pt-1 flex flex-col gap-3">
          <button
            onClick={goToBattle}
            className="abb-blk-primary w-full py-3.5 rounded-2xl text-sm uppercase"
            style={{
              background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              fontWeight: 900,
              letterSpacing: '0.08em',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.4)',
              textShadow: '0 1px 0 rgba(0,0,0,0.35)',
            }}
          >
            Go to my battle
          </button>
          <button
            onClick={onClose}
            className="abb-blk-secondary w-full py-3 rounded-2xl text-sm uppercase"
            style={{
              background: '#111',
              color: '#9ca3af',
              fontWeight: 800,
              letterSpacing: '0.08em',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 4px 0 #0a0a0a',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(blocker, document.body);
}
