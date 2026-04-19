import { useState, useRef, useCallback, useEffect } from 'react';
import { formatMoney } from '../utils/formatMoney';
import useModalScrollLock from '../hooks/useModalScrollLock';

function TicketCarousel({ cards, theme, emptyMessage }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const mouseStartX = useRef(null);
  const isDragging = useRef(false);

  const total = cards ? cards.length : 0;

  const prev = useCallback((e) => {
    e && e.stopPropagation();
    setIndex(i => Math.max(0, i - 1));
  }, []);

  const next = useCallback((e) => {
    e && e.stopPropagation();
    setIndex(i => Math.min(total - 1, i + 1));
  }, [total]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { diff > 0 ? next() : prev(); }
    touchStartX.current = null;
  };

  const onMouseDown = (e) => { mouseStartX.current = e.clientX; isDragging.current = true; };

  const onMouseUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = mouseStartX.current - e.clientX;
    if (Math.abs(diff) > 40) { diff > 0 ? next() : prev(); }
    mouseStartX.current = null;
  };

  const onMouseLeave = () => { isDragging.current = false; mouseStartX.current = null; };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') prev(e);
    if (e.key === 'ArrowRight') next(e);
  };

  if (!cards || total === 0) {
    return <p className="text-xs text-gray-500 py-4 text-center">{emptyMessage}</p>;
  }

  if (total === 1) {
    return <div>{cards[0]}</div>;
  }

  return (
    <div className="select-none" onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {cards.map((card, i) => (
            <div key={i} className="w-full flex-shrink-0">{card}</div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.borderColor}` }}
          aria-label="Previous ticket"
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                background: i === index ? theme.accentColor : 'rgba(255,255,255,0.2)',
              }}
              aria-label={`Go to ticket ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={index === total - 1}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.borderColor}` }}
          aria-label="Next ticket"
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="text-[11px] font-bold tabular-nums" style={{ color: theme.accentColor }}>
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

export default function BattleOverviewPopup({
  battle,
  matchupId,
  theme,
  myProfile,
  betCount,
  opponentBetCount,
  myBetCards,
  opponentBetCards,
  outcomeBadge,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('mine');
  const [shareToast, setShareToast] = useState(null);
  const toastTimerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useModalScrollLock(true, { restoreScroll: true, allowScrollRef: scrollContainerRef });

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showShareToast = (message) => {
    setShareToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShareToast(null), 2200);
  };

  const buildShareUrl = () => {
    const id = matchupId || battle?.matchupId || battle?.id;
    if (!id) return null;
    if (typeof window === 'undefined') return `/bet-history?battle=${id}`;
    const url = new URL('/bet-history', window.location.origin);
    url.searchParams.set('battle', id);
    return url.toString();
  };

  const copyToClipboard = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (_) {}
    }
    return false;
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = buildShareUrl();
    if (!shareUrl) {
      showShareToast("Couldn't build link");
      return;
    }
    const opp = battle?.opponent?.username || 'opponent';
    const shareData = {
      title: 'Battle on Piks',
      text: `Check out my battle vs ${opp}`,
      url: shareUrl,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const ok = await copyToClipboard(shareUrl);
    showShareToast(ok ? 'Link copied!' : "Couldn't copy link");
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const myBalance = parseFloat(battle.myBalance ?? 0);
  const oppBalance = parseFloat(battle.oppBalance ?? 0);
  const startingBalance = parseFloat(battle.startingBalance ?? 0);
  const myPnL = myBalance - startingBalance;

  const outcome = battle.outcome || 'active';
  const isActive = outcome === 'active';

  const userAvatar = myProfile?.avatar || null;
  const userName = myProfile?.username || 'You';
  const opponent = battle.opponent || { username: 'Opponent', avatar: null };

  const myPendingCount = Number(battle.myPendingCount) || 0;
  const opponentPendingCount = Number(battle.opponentPendingCount) || 0;
  const totalPendingCount = myPendingCount + opponentPendingCount;
  const showPendingNote = !isActive && totalPendingCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/85 p-3"
      onClick={onClose}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        className="relative w-full max-w-lg mx-auto flex flex-col"
        style={{ maxHeight: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-2xl overflow-hidden flex flex-col relative"
          style={{
            background: theme.cardBg,
            border: `2px solid ${outcomeBadge.border}`,
            maxHeight: '100%',
          }}
        >
          <div
            className="absolute inset-0 opacity-25 pointer-events-none rounded-2xl"
            style={{ background: `radial-gradient(ellipse at center bottom, ${theme.glowColor} 0%, transparent 60%)` }}
          />

          <div
            ref={scrollContainerRef}
            className="relative z-10 overflow-y-auto flex-1 min-h-0"
            style={{
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              maxHeight: 'calc(100dvh - 1.5rem)',
            }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: theme.badgeBg }}>
                  <span className="text-[10px]">{theme.icon}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
                    {theme.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: theme.accentColor }}>
                  Battle
                </span>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(battle.endsAt || battle.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`px-2 py-0.5 rounded-full ${outcomeBadge.bg}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${outcomeBadge.text}`}>
                    {outcomeBadge.label}
                  </span>
                </div>
                <button
                  onClick={handleShare}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  aria-label="Share battle link"
                  title="Share battle link"
                  type="button"
                >
                  <svg className="w-3 h-3" fill="none" stroke={theme.accentColor} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  aria-label="Close"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Matchup row */}
            <div className="flex items-center w-full px-3 pb-2">
              <div className="flex flex-col items-center" style={{ width: '32%' }}>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ border: `2px solid ${theme.avatarRing}`, boxShadow: theme.avatarGlow, background: '#111' }}
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-black text-white/70">{userName?.[0]?.toUpperCase() || 'Y'}</span>
                  )}
                </div>
                <p className="text-white text-[11px] font-bold truncate max-w-[90px] text-center mt-0.5 leading-tight">{userName}</p>
                <p className={`text-[10px] font-bold leading-tight ${myPnL > 0 ? 'text-green-400' : myPnL < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                  ${formatMoney(myBalance, 0)}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center" style={{ width: '36%' }}>
                <div
                  className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text leading-none"
                  style={{ backgroundImage: theme.vsGradient, WebkitBackgroundClip: 'text' }}
                >
                  VS
                </div>
                <div className="text-center mt-0.5 flex items-baseline gap-1 justify-center">
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider leading-none">
                    {isActive ? 'Prize' : 'Pot'}
                  </p>
                  <p className="text-sm font-black leading-none" style={{
                    color: theme.prizeColor,
                    textShadow: `0 0 10px rgba(${theme.accentRgb},0.4)`,
                  }}>
                    ${formatMoney(battle.winnerPayout || battle.potSize || 0, 0)}
                  </p>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-none">
                  <span style={{ color: theme.accentColor }}>
                    <span className="font-bold">You</span>
                    <span className="text-white/80 ml-0.5">{betCount}</span>
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-red-300">
                    <span className="font-bold">Opp</span>
                    <span className="text-white/80 ml-0.5">{opponentBetCount}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center" style={{ width: '32%' }}>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ border: '2px solid #ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.3)', background: '#111' }}
                >
                  {opponent.avatar ? (
                    <img src={opponent.avatar} alt={opponent.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-black text-white/70">{(opponent.username || 'O')[0].toUpperCase()}</span>
                  )}
                </div>
                <p className="text-white text-[11px] font-bold truncate max-w-[90px] text-center mt-0.5 leading-tight">{opponent.username}</p>
                <p className="text-[10px] font-bold text-red-400 leading-tight">
                  ${formatMoney(oppBalance, 0)}
                </p>
              </div>
            </div>

            {/* Pending note */}
            {showPendingNote && (
              <div
                className="mx-3 mb-2 px-3 py-1.5 rounded-lg flex items-start gap-2"
                style={{
                  background: 'rgba(234,179,8,0.10)',
                  border: '1px solid rgba(234,179,8,0.45)',
                }}
              >
                <span className="text-sm leading-none mt-0.5">⚠️</span>
                <div className="flex-1">
                  <div className="text-yellow-400 text-[11px] font-bold uppercase tracking-wide leading-tight">
                    {totalPendingCount} {totalPendingCount === 1 ? 'pik' : 'piks'} did not grade in time
                  </div>
                  <div className="text-[10px] mt-0.5 text-gray-300 leading-snug">
                    {(() => {
                      const parts = [];
                      if (myPendingCount > 0) parts.push(`${myPendingCount} of yours`);
                      if (opponentPendingCount > 0) parts.push(`${opponentPendingCount} of ${opponent.username || 'opponent'}'s`);
                      const who = parts.join(' and ');
                      return `${who} ${totalPendingCount === 1 ? 'was' : 'were'} forfeited toward this battle's score.`;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mx-3 mb-2" style={{ height: 1, background: `${theme.borderColor}` }} />

            {/* Tab toggle + carousel */}
            {(myBetCards || opponentBetCards) && (
              <div className="px-3 pb-5">
                <div
                  className="inline-flex rounded-full p-1 mb-2"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${theme.borderColor}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('mine')}
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={{
                      background: activeTab === 'mine' ? theme.accentColor : 'transparent',
                      color: activeTab === 'mine' ? '#fff' : ('#9ca3af'),
                    }}
                  >
                    Your Piks ({betCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('theirs')}
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={{
                      background: activeTab === 'theirs' ? '#ef4444' : 'transparent',
                      color: activeTab === 'theirs' ? '#fff' : ('#9ca3af'),
                    }}
                  >
                    {opponent.username}'s Piks ({opponentBetCount})
                  </button>
                </div>

                {activeTab === 'mine' ? (
                  <TicketCarousel
                    key="mine"
                    cards={myBetCards && myBetCards.length > 0 ? myBetCards : null}
                    theme={theme}
                    emptyMessage="No piks placed in this battle."
                  />
                ) : (
                  <TicketCarousel
                    key="theirs"
                    cards={opponentBetCards && opponentBetCards.length > 0 ? opponentBetCards : null}
                    theme={theme}
                    emptyMessage={`${opponent.username} hasn't placed any piks yet.`}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {shareToast && (
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 px-3 py-1.5 rounded-full text-[11px] font-bold text-white shadow-lg"
            style={{ background: 'rgba(17,24,39,0.95)', border: `1px solid ${theme.borderColor}` }}
            role="status"
            aria-live="polite"
          >
            {shareToast}
          </div>
        )}
      </div>
    </div>
  );
}
