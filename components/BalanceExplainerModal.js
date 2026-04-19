import { useRouter } from 'next/router';
import useModalScrollLock from '../hooks/useModalScrollLock';
import { formatMoney } from '../utils/formatMoney';

const MODE_LABELS = {
  rush: { label: 'RUSH', icon: '⚡', color: '#fb923c' },
  original: { label: 'ORIGINAL', icon: '🏆', color: '#3b82f6' },
  tournament: { label: 'TOURNAMENT', icon: '👑', color: '#10b981' },
};

function getMode(matchup) {
  if (matchup?.durationType) return matchup.durationType;
  const dm = matchup?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function BalanceExplainerModal({
  type,
  isOpen,
  onClose,
  cashBalance,
  coinsBalance,
  matchup,
  opponent,
}) {
  useModalScrollLock(isOpen);
  const router = useRouter();

  if (!isOpen) return null;

  const isCash = type === 'cash';
  const accent = isCash ? '#22c55e' : '#fb923c';
  const accentRgb = isCash ? '34,197,94' : '251,146,60';
  const headerEmoji = isCash ? '💵' : '⚔️';
  const title = isCash ? 'Cash Balance' : 'Battle Coins';
  const subtitle = isCash
    ? 'Real money in your Piks wallet'
    : 'Coins you can wager inside your active battle';

  const mode = matchup ? getMode(matchup) : null;
  const modeMeta = mode ? MODE_LABELS[mode] : null;
  const payout = parseFloat(matchup?.winnerPayout ?? matchup?.potSize ?? 0);

  const handleCta = () => {
    onClose();
    if (isCash) router.push('/withdrawal');
    else router.push('/battle');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="popup-content relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#0a0a0a',
          border: `1px solid rgba(${accentRgb},0.35)`,
          boxShadow: `0 0 40px rgba(${accentRgb},0.15)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ background: `linear-gradient(180deg, rgba(${accentRgb},0.12) 0%, rgba(${accentRgb},0.02) 100%)`, borderBottom: '1px solid #1a1a1a' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.4)` }}
          >
            {headerEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider" style={{ color: accent }}>{title}</div>
            <div className="text-white text-sm font-medium truncate">{subtitle}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl p-4 text-center" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Current Balance</div>
            {isCash ? (
              <div className="text-4xl font-black" style={{ color: '#22c55e' }}>
                ${formatMoney(parseFloat(cashBalance || 0), 2)}
              </div>
            ) : (
              <div className="text-4xl font-black flex items-center justify-center gap-2" style={{ color: '#fff' }}>
                <span style={{ color: '#fb923c' }}>⚔</span>
                <span>{formatMoney(parseFloat(coinsBalance || 0), 0)}</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {isCash ? 'Real cash · USD' : 'In-battle coins (not real money)'}
            </div>
          </div>

          {isCash ? (
            <div className="space-y-2 text-sm" style={{ color: '#d1d5db' }}>
              <p>
                This is the real money in your Piks wallet. You use it to buy in to battles, deposit more, or cash out.
              </p>
              <div className="rounded-lg p-3 text-xs" style={{ background: '#0e1a14', border: '1px solid rgba(34,197,94,0.25)', color: '#a7f3d0' }}>
                Cash never moves into a battle — when you join one, your buy-in is converted to play coins for that battle only.
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm" style={{ color: '#d1d5db' }}>
              <p>
                These are play coins for your <span className="font-semibold text-white">active battle</span>. They aren't real money — winner takes the cash prize pot.
              </p>
              {matchup && (
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {modeMeta && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `rgba(${accentRgb},0.15)`, color: modeMeta.color }}>
                          {modeMeta.icon} {modeMeta.label}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">vs {opponent?.username || 'Opponent'}</span>
                    </div>
                    {payout > 0 && (
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-widest" style={{ color: '#fcd34d' }}>Prize</div>
                        <div className="text-sm font-bold" style={{ color: '#fbbf24' }}>${formatMoney(payout, 0)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="rounded-lg p-3 text-xs" style={{ background: '#1a1206', border: '1px solid rgba(251,146,60,0.25)', color: '#fed7aa' }}>
                Your cash buy-in becomes coins for the duration of the battle. The player with the most coins at the end keeps the entire pot.
              </div>
            </div>
          )}

          <button
            onClick={handleCta}
            className="w-full py-3 rounded-xl font-bold text-sm transition-transform active:scale-[0.98]"
            style={{
              background: isCash
                ? 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'
                : 'linear-gradient(180deg, #fb923c 0%, #c2410c 100%)',
              color: '#fff',
              boxShadow: `0 0 20px rgba(${accentRgb},0.35)`,
            }}
          >
            {isCash ? 'Open Wallet · Deposit / Withdraw' : 'View My Battle'}
          </button>
        </div>
      </div>
    </div>
  );
}
