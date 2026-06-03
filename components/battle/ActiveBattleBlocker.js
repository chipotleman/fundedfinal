import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { useMatchup } from '../../contexts/MatchupContext';
import { useTheme } from '../../contexts/ThemeContext';

// Cartoon-themed "you're already in a battle" blocker. Originally lived
// inline in PlayFriendModal; extracted here so Quick Match and Private
// Match can show the SAME block instead of silently opening a second
// matchmaking flow while a fight is still live. Reads the active matchup
// straight from MatchupContext so it's race-proof — it never relies on a
// stale page-level snapshot. Render it only when you've already confirmed
// `hasActiveMatchup` (each modal early-returns this in place of its body).
export default function ActiveBattleBlocker({ onClose, invite = false }) {
  const router = useRouter();
  const { matchup: activeMatchup, opponent: activeOpponent } = useMatchup();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (typeof document === 'undefined') return null;

  // Cartoon hard borders/shadows (#0a0a0a) stay in both themes — only the
  // panel/card surfaces, text and muted accents flip so the blocker matches
  // the rest of the app in light mode (it used to stay dark regardless).
  const t = isLight
    ? {
        backdrop: 'rgba(15,23,42,0.45)',
        modalBg: '#ffffff',
        card: '#f4efe4',
        cardText: '#334155',
        title: '#0f172a',
        titleShadow: 'none',
        label: '#2563eb',
        body: '#475569',
        bodyStrong: '#0f172a',
        forfeit: '#ea580c',
        secondaryBg: '#f1ece0',
        secondaryText: '#475569',
      }
    : {
        backdrop: 'rgba(0,0,0,0.80)',
        modalBg: '#0d0d0d',
        card: '#111',
        cardText: '#e5e7eb',
        title: '#ffffff',
        titleShadow: '0 2px 0 #000',
        label: '#60a5fa',
        body: '#9ca3af',
        bodyStrong: '#ffffff',
        forfeit: '#fb923c',
        secondaryBg: '#111',
        secondaryText: '#9ca3af',
      };

  const opponentName = activeOpponent?.username || 'your opponent';
  // RUSH has its own dedicated gameshow lobby; every other mode is played out
  // on the My Piks page (where the active battle's picks live). We route there
  // directly instead of the dashboard's "YOU'RE MATCHED!" celebration, which
  // shouldn't replay when revisiting a battle you're already in.
  const goToBattle = () => {
    onClose?.();
    if (activeMatchup?.durationType === 'rush' && activeMatchup?.id) {
      router.push(`/battle/rush/${activeMatchup.id}`);
    } else {
      router.push('/my-picks');
    }
  };

  const blocker = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: t.backdrop }}
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
          backgroundColor: t.modalBg,
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
            style={{ color: t.label, letterSpacing: '0.22em' }}
          >
            You're In A Battle
          </div>
          <h2
            id="abb-blocker-title"
            className="font-black uppercase"
            style={{
              color: t.title,
              fontSize: '22px',
              letterSpacing: '0.04em',
              textShadow: t.titleShadow,
            }}
          >
            Finish your fight first
          </h2>
          <p className="text-sm mt-3" style={{ color: t.body, lineHeight: 1.5 }}>
            You can't {invite ? 'send a new battle invite' : 'start a new battle'} while you're already
            matched up with <span style={{ color: t.bodyStrong, fontWeight: 700 }}>{opponentName}</span>.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: t.card,
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <span className="text-lg leading-none mt-0.5">🎯</span>
            <p className="text-xs font-semibold" style={{ color: t.cardText, lineHeight: 1.5 }}>
              Head back to your battle and play it out — winner takes the pot.
            </p>
          </div>
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: t.card,
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
            }}
          >
            <span className="text-lg leading-none mt-0.5">🏳️</span>
            <p className="text-xs font-semibold" style={{ color: t.cardText, lineHeight: 1.5 }}>
              Or tap{' '}
              <span style={{ color: t.forfeit, fontWeight: 800 }}>Forfeit</span>
              {' '}on your battle to surrender — then you'll be free to {invite ? 'invite anyone' : 'start anything'}.
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
              background: t.secondaryBg,
              color: t.secondaryText,
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
