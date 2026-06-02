// Shared premium match-flow screens.
//
// These are the sleek, dark, "billion-dollar" match-flow screens from the
// approved mockup — Finding Opponent, Opponent Found, Match Confirmed,
// You Win, and Play Again. They are PURELY PRESENTATIONAL: they take a
// small set of props + handlers and render. No data fetching, no routing.
// All three match entry points (Quick Match, Play a Friend, Private Match)
// share them so the experience is identical everywhere.
//
// Palette: blue #3b82f6 = YOU, orange #fb923c = OPP, green #10b981 = win,
// gold #facc15 = stake / coins. No purple. Hover styles are auto-gated to
// pointer devices by the Tailwind config (hoverOnlyWhenSupported).

import UserAvatar from '../../UserAvatar';

const BLUE = '#3b82f6';
const ORANGE = '#fb923c';
const GREEN = '#10b981';
const GOLD = '#facc15';
const CARD_BG =
  'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(59,130,246,0.10), transparent 60%),' +
  'radial-gradient(ellipse 90% 60% at 50% 100%, rgba(251,146,60,0.07), transparent 60%),' +
  'linear-gradient(180deg, #0b1020 0%, #070a14 100%)';

export function rankFromWins(wins) {
  const w = Number(wins) || 0;
  if (w >= 100) return { label: 'LEGEND', color: GREEN };
  if (w >= 50) return { label: 'ELITE', color: ORANGE };
  if (w >= 10) return { label: 'PRO', color: GOLD };
  return { label: 'ROOKIE', color: BLUE };
}

const fmt = (n) => Number(n || 0).toLocaleString();

/* ─────────────────────────── primitives ─────────────────────────── */

function CoinChip({ amount, label }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold text-white"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 16,
          height: 16,
          color: '#fb923c',
          boxShadow: '0 0 6px rgba(251,146,60,0.5)',
          fontSize: 12,
        }}
      >
        ⚔
      </span>
      {label || fmt(amount)}
    </span>
  );
}

function PiksMark() {
  return (
    <span
      className="font-extrabold lowercase tracking-tight"
      style={{ fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}
    >
      piks
    </span>
  );
}

// Dark premium card frame with a header row (piks logo · coin balance).
export function FlowCard({ balance, balanceLabel, children, header = true }) {
  return (
    <div
      className="relative overflow-hidden text-white"
      style={{ background: CARD_BG }}
    >
      {header && (
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <PiksMark />
          <CoinChip amount={balance} label={balanceLabel} />
        </div>
      )}
      <div className="relative z-10">{children}</div>
      <MatchFlowStyles />
    </div>
  );
}

function RankBadge({ rank }) {
  if (!rank) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[9px] font-extrabold uppercase"
      style={{
        color: rank.color,
        background: `${rank.color}1a`,
        border: `1px solid ${rank.color}55`,
        letterSpacing: '0.12em',
      }}
    >
      {rank.label}
    </span>
  );
}

function Fighter({ player, ring, crown, dimmed, size = 84, showRank = true }) {
  const rank = showRank ? rankFromWins(player?.battleWins) : null;
  return (
    <div className="flex flex-col items-center gap-2 min-w-0" style={{ maxWidth: 140 }}>
      <div className="relative" style={{ filter: dimmed ? 'grayscale(1)' : 'none', opacity: dimmed ? 0.45 : 1 }}>
        {crown && (
          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: -16, fontSize: 20, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}
          >
            👑
          </span>
        )}
        <div
          className="rounded-full overflow-hidden flex items-center justify-center"
          style={{
            width: size,
            height: size,
            border: `2.5px solid ${ring}`,
            boxShadow: `0 0 0 4px ${ring}22, 0 0 20px ${ring}66`,
            background: '#0b1020',
          }}
        >
          <UserAvatar
            user={{ id: player?.id, username: player?.name || player?.username, avatar: player?.avatar }}
            size={size}
          />
        </div>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wide truncate max-w-[130px] text-center" style={{ color: '#e2e8f0' }}>
        {player?.name || player?.username || 'Player'}
      </span>
      {rank && <RankBadge rank={rank} />}
    </div>
  );
}

// Two fighters facing off across a VS burst. Used on found / confirmed /
// play-again screens for a consistent head-to-head.
export function VersusRow({ you, opp, size = 84, youCrown = true, dimOpp = false, dimYou = false, showRank = true, score }) {
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      <Fighter player={you} ring={BLUE} crown={youCrown && !dimYou} dimmed={dimYou} size={size} showRank={showRank} />
      <div className="flex flex-col items-center justify-center pb-7 shrink-0">
        <span
          className="font-black italic"
          style={{
            fontSize: size > 80 ? 34 : 26,
            color: '#fff',
            textShadow: `0 0 14px ${BLUE}88, 0 2px 4px rgba(0,0,0,0.6)`,
            lineHeight: 1,
          }}
        >
          VS
        </span>
        {score && (
          <span className="mt-1 text-[10px] font-bold" style={{ color: '#94a3b8' }}>{score}</span>
        )}
      </div>
      <Fighter player={opp} ring={ORANGE} crown={false} dimmed={dimOpp} size={size} showRank={showRank} />
    </div>
  );
}

function StakeRow({ stake }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#64748b' }}>Stake</div>
      <div className="mt-1 inline-flex items-center gap-2 text-[22px] font-extrabold text-white">
        {fmt(stake)}
        <span aria-hidden="true" style={{ fontSize: 16, color: '#fb923c' }}>⚔</span>
      </div>
    </div>
  );
}

// Primary action button — gradient fill, premium shadow.
export function FlowButton({ children, onClick, color = 'gold', trailing, disabled, full = true, size = 'lg' }) {
  const palettes = {
    gold: { bg: 'linear-gradient(180deg,#fde047,#f59e0b)', fg: '#1a1206', glow: 'rgba(245,158,11,0.45)' },
    green: { bg: 'linear-gradient(180deg,#34d399,#059669)', fg: '#04140d', glow: 'rgba(16,185,129,0.45)' },
    blue: { bg: 'linear-gradient(180deg,#60a5fa,#2563eb)', fg: '#fff', glow: 'rgba(59,130,246,0.45)' },
    dark: { bg: 'rgba(255,255,255,0.06)', fg: '#e2e8f0', glow: 'transparent' },
  };
  const p = palettes[color] || palettes.gold;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${full ? 'w-full' : ''} inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{
        background: p.bg,
        color: p.fg,
        border: color === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.15)',
        boxShadow: color === 'dark' ? 'none' : `0 6px 20px ${p.glow}`,
        padding: size === 'lg' ? '14px 20px' : '11px 16px',
        fontSize: size === 'lg' ? 16 : 13,
        letterSpacing: '0.04em',
      }}
    >
      {children}
      {trailing}
    </button>
  );
}

/* ─────────────────────────── screens ─────────────────────────── */

// 1 · FINDING OPPONENT
export function FindingOpponent({ you, others = [], balance, balanceLabel, onCancel, subtitle = 'Scanning thousands of players…' }) {
  const ringColors = [BLUE, GREEN, ORANGE, GOLD, '#22d3ee', '#a3a3a3'];
  // Build up to 6 orbiting challengers from the live player pool. If the
  // pool is short, cycle through whoever we have so the orbit always reads
  // as a busy field of real players. With no pool yet, fall back to empty
  // colored rings so the animation still feels alive on first paint.
  const SLOTS = 6;
  const pool = Array.isArray(others) ? others.filter(Boolean) : [];
  const hasPool = pool.length > 0;
  const orbiters = Array.from({ length: SLOTS }).map((_, i) => (hasPool ? pool[i % pool.length] : null));
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      <div className="px-6 pt-6 pb-7 text-center">
        <span aria-hidden="true" style={{ fontSize: 26 }}>⚡</span>
        <h2 className="mt-1 font-black italic uppercase leading-[0.95]" style={{ fontSize: 'clamp(30px,8vw,42px)' }}>
          <span style={{ color: '#fff' }}>Finding</span>{' '}
          <span style={{ color: BLUE }}>Opponent</span>
        </h2>
        <p className="mt-2 text-[12px]" style={{ color: '#94a3b8' }}>{subtitle}</p>

        {/* Orbit field — YOUR avatar at the center, real players revolving
            around it (their faces kept upright via counter-rotation). */}
        <div className="relative mx-auto my-7" style={{ width: 224, height: 224 }}>
          <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
          <span aria-hidden="true" className="absolute rounded-full" style={{ inset: 32, border: '1px solid rgba(255,255,255,0.06)' }} />
          <span aria-hidden="true" className="absolute inset-0 rounded-full mf-spin" style={{ border: '2px solid transparent', borderTopColor: BLUE, opacity: 0.45 }} />
          <div className="absolute inset-0 mf-spin">
            {orbiters.map((p, i) => {
              const c = ringColors[i % ringColors.length];
              const angle = (i / SLOTS) * Math.PI * 2;
              const r = i % 2 === 0 ? 104 : 78;
              const size = 42;
              const x = 112 + Math.cos(angle) * r - size / 2;
              const y = 112 + Math.sin(angle) * r - size / 2;
              return (
                <div
                  key={i}
                  className="absolute rounded-full overflow-hidden mf-spin-rev"
                  style={{
                    left: x, top: y, width: size, height: size,
                    background: '#0b1020',
                    border: `2px solid ${c}`,
                    boxShadow: `0 0 10px ${c}99`,
                  }}
                >
                  {p && (
                    <UserAvatar user={{ id: p.id, username: p.name || p.username, avatar: p.avatar }} size={size} />
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden mf-pulse"
            style={{
              width: 80, height: 80,
              border: `3px solid ${BLUE}`,
              boxShadow: `0 0 30px ${BLUE}aa`,
              background: '#0b1020',
            }}
          >
            <UserAvatar user={{ id: you?.id, username: you?.name || you?.username, avatar: you?.avatar }} size={80} />
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-full px-8 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          Cancel
        </button>
      </div>
    </FlowCard>
  );
}

// 1b · CONNECTING TO FRIEND
// Direct, two-player handshake used when challenging a specific friend.
// Instead of a crowd of random orbiters, it shows YOUR avatar reaching out
// to the friend's avatar with a pulsing link between them, so it reads as a
// targeted connection rather than an open search.
export function ConnectingToFriend({ you, friend, balance, balanceLabel, onCancel, subtitle = 'Connecting…' }) {
  const Side = ({ player, ring, label }) => (
    <div className="flex flex-col items-center" style={{ width: 96 }}>
      <div
        className="rounded-full overflow-hidden mf-pulse-scale"
        style={{
          width: 84, height: 84,
          border: `3px solid ${ring}`,
          boxShadow: `0 0 0 4px ${ring}22, 0 0 26px ${ring}88`,
          background: '#0b1020',
        }}
      >
        <UserAvatar user={{ id: player?.id, username: player?.name || player?.username, avatar: player?.avatar }} size={84} />
      </div>
      <span className="mt-2 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: ring }}>{label}</span>
      <span className="mt-0.5 max-w-[92px] truncate text-[12px] font-semibold" style={{ color: '#cbd5e1' }}>
        {player?.name || player?.username || '—'}
      </span>
    </div>
  );
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      <div className="px-6 pt-6 pb-7 text-center">
        <span aria-hidden="true" style={{ fontSize: 26 }}>🤝</span>
        <h2 className="mt-1 font-black italic uppercase leading-[0.95]" style={{ fontSize: 'clamp(30px,8vw,42px)' }}>
          <span style={{ color: '#fff' }}>Connecting</span>
        </h2>
        <p className="mt-2 text-[12px]" style={{ color: '#94a3b8' }}>{subtitle}</p>

        {/* YOU ⟶ FRIEND handshake. A short track of dots travels from your
            avatar toward the friend's, signalling the invite in flight. */}
        <div className="my-8 flex items-center justify-center">
          <Side player={you} ring={BLUE} label="You" />
          <div className="relative mx-1 flex-1" style={{ maxWidth: 96, height: 84 }}>
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
              style={{ height: 2, background: 'linear-gradient(90deg, rgba(59,130,246,0.45), rgba(251,146,60,0.45))' }}
            />
            <div className="absolute inset-0 flex items-center justify-between">
              <span className="mf-link-dot" style={{ background: BLUE, animationDelay: '0s' }} />
              <span className="mf-link-dot" style={{ background: '#22d3ee', animationDelay: '0.18s' }} />
              <span className="mf-link-dot" style={{ background: ORANGE, animationDelay: '0.36s' }} />
            </div>
          </div>
          <Side player={friend} ring={ORANGE} label="Friend" />
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-full px-8 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          Cancel
        </button>
      </div>
    </FlowCard>
  );
}

// 2 · OPPONENT FOUND (accept / decline)
export function OpponentFound({
  you, opp, balance, balanceLabel, stake, secondsLeft,
  onAccept, onDecline, acceptLabel = 'Accept Match', loading = false, loadingLabel = 'Loading…',
}) {
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      <div className="px-6 pt-3 pb-7">
        <div className="text-center mb-5">
          <span className="inline-flex items-center gap-2 text-[15px] font-black italic uppercase" style={{ color: GREEN }}>
            <span aria-hidden="true">⚡</span> Opponent Found! <span aria-hidden="true">⚡</span>
          </span>
        </div>

        <VersusRow you={you} opp={opp} size={88} />

        <div className="mt-6">
          <StakeRow stake={stake} />
        </div>

        <div className="mt-6">
          {loading ? (
            <FlowButton color="dark" disabled>
              <span className="mf-blink" style={{ color: GOLD }}>●</span> {loadingLabel}
            </FlowButton>
          ) : (
            <FlowButton
              color="gold"
              onClick={onAccept}
              trailing={
                typeof secondsLeft === 'number' ? (
                  <span
                    className="ml-1 inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[12px] font-extrabold"
                    style={{ background: 'rgba(0,0,0,0.18)', color: '#1a1206' }}
                  >
                    {Math.max(0, secondsLeft)}s
                  </span>
                ) : null
              }
            >
              {acceptLabel}
            </FlowButton>
          )}
          {onDecline && (
            <button
              type="button"
              onClick={onDecline}
              className="block mx-auto mt-3 text-[12px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-white"
              style={{ color: '#64748b' }}
            >
              Decline
            </button>
          )}
        </div>
      </div>
    </FlowCard>
  );
}

// 3 · MATCH CONFIRMED (countdown into the game)
export function MatchConfirmed({
  you, opp, balance, balanceLabel, stake, count, label = 'Getting your game ready…',
}) {
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      <div className="px-6 pt-3 pb-8">
        <div className="text-center mb-5">
          <div
            className="mx-auto mb-2 flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: `${GREEN}1f`, border: `1.5px solid ${GREEN}` }}
          >
            <span aria-hidden="true" style={{ color: GREEN, fontSize: 20 }}>✓</span>
          </div>
          <span className="text-[15px] font-black italic uppercase" style={{ color: GREEN }}>
            Match Confirmed!
          </span>
        </div>

        <VersusRow you={you} opp={opp} size={72} showRank={false} />

        <div className="mt-5">
          <StakeRow stake={stake} />
        </div>

        {typeof count === 'number' && (
          <div className="mt-7 flex justify-center">
            <div
              className="flex items-center justify-center rounded-full mf-pulse-scale"
              style={{
                width: 84, height: 84,
                border: `3px solid ${BLUE}`,
                boxShadow: `0 0 26px ${BLUE}77`,
                background: '#0b1020',
              }}
            >
              <span className="font-black leading-none" style={{ fontSize: 40, color: '#fff' }}>{count}</span>
            </div>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#64748b' }}>
          {label}
        </p>
      </div>
    </FlowCard>
  );
}

// 7 · YOU WIN / LOSE / DRAW
export function MatchWin({
  outcome = 'win', you, opp, balance, balanceLabel, prize,
  onPrimary, primaryLabel = 'View Results', secondary,
}) {
  const isWin = outcome === 'win';
  const isTie = outcome === 'tie';
  const headline = isWin ? 'You Win!' : isTie ? 'Draw' : 'You Lose';
  const headColor = isWin ? GOLD : isTie ? '#cbd5e1' : '#f87171';
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      {isWin && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="absolute mf-confetti"
              style={{
                left: `${(i * 61) % 100}%`,
                width: 6, height: 10,
                background: [GOLD, GREEN, BLUE, ORANGE][i % 4],
                animationDelay: `${(i % 6) * 0.18}s`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      )}
      <div className="px-6 pt-4 pb-8 text-center">
        {isWin && <div aria-hidden="true" style={{ fontSize: 26 }}>👑</div>}
        <h2 className="font-black italic uppercase leading-none" style={{ fontSize: 'clamp(34px,9vw,52px)', color: headColor, textShadow: `0 0 22px ${headColor}55` }}>
          {headline}
        </h2>

        <div className="mt-6 flex items-center justify-center">
          <Fighter
            player={isWin || isTie ? you : opp}
            ring={isWin || isTie ? GREEN : ORANGE}
            crown={isWin}
            size={96}
            showRank={false}
          />
        </div>

        {isWin && (
          <div
            className="mx-auto mt-6 rounded-2xl px-5 py-4"
            style={{ background: `${GREEN}14`, border: `1px solid ${GREEN}55`, maxWidth: 320 }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: GREEN }}>You Won</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[26px] font-extrabold text-white">
              {fmt(prize)} <span aria-hidden="true" style={{ fontSize: 18 }}>👑</span>
            </div>
          </div>
        )}

        <div className="mt-7 max-w-[320px] mx-auto">
          <FlowButton color={isWin ? 'gold' : 'dark'} onClick={onPrimary}>{primaryLabel}</FlowButton>
          {secondary}
        </div>
      </div>
    </FlowCard>
  );
}

// 8 · PLAY AGAIN / REMATCH
export function PlayAgain({
  you, opp, balance, balanceLabel, stake, stakeStep = 1000, minStake = 0, maxStake,
  onStakeChange, onRematch, onNewOpponent, onHome,
  rematchLabel = 'Rematch', rematchDisabled = false, statusText,
}) {
  const adjust = (dir) => {
    if (!onStakeChange) return;
    let next = Number(stake) + dir * stakeStep;
    if (next < minStake) next = minStake;
    if (typeof maxStake === 'number' && next > maxStake) next = maxStake;
    onStakeChange(next);
  };
  return (
    <FlowCard balance={balance} balanceLabel={balanceLabel}>
      <div className="px-6 pt-4 pb-8">
        <h2 className="text-center font-black italic uppercase" style={{ fontSize: 'clamp(28px,7vw,40px)', color: '#fff' }}>
          Play Again?
        </h2>

        <div className="mt-5">
          <VersusRow you={you} opp={opp} size={72} showRank={false} />
        </div>

        <div className="mt-6 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#64748b' }}>Stake</div>
          <div className="mt-2 flex items-center justify-center gap-3">
            {onStakeChange && (
              <button
                type="button" onClick={() => adjust(-1)}
                className="flex items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
                style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 20 }}
              >−</button>
            )}
            <div className="inline-flex items-center gap-2 text-[22px] font-extrabold text-white min-w-[120px] justify-center">
              {fmt(stake)} <span aria-hidden="true" style={{ fontSize: 15, color: '#fb923c' }}>⚔</span>
            </div>
            {onStakeChange && (
              <button
                type="button" onClick={() => adjust(1)}
                className="flex items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
                style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 20 }}
              >+</button>
            )}
          </div>
        </div>

        {statusText && (
          <p className="mt-4 text-center text-[12px] font-semibold" style={{ color: '#94a3b8' }}>{statusText}</p>
        )}

        <div className="mt-6 space-y-3">
          <FlowButton color="green" onClick={onRematch} disabled={rematchDisabled}>
            <span aria-hidden="true">⚡</span> {rematchLabel}
          </FlowButton>
          {onNewOpponent && <FlowButton color="dark" onClick={onNewOpponent}>New Opponent</FlowButton>}
          {onHome && (
            <button
              type="button" onClick={onHome}
              className="block mx-auto mt-1 text-[12px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-white"
              style={{ color: '#64748b' }}
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    </FlowCard>
  );
}

/* ─────────────────────────── keyframes ─────────────────────────── */

export function MatchFlowStyles() {
  return (
    <style jsx global>{`
      @keyframes mf-spin { to { transform: rotate(360deg); } }
      @keyframes mf-spin-rev { to { transform: rotate(-360deg); } }
      .mf-spin { animation: mf-spin 9s linear infinite; }
      .mf-spin-rev { animation: mf-spin-rev 9s linear infinite; }
      @keyframes mf-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.06); }
      }
      .mf-pulse { animation: mf-pulse 1.8s ease-in-out infinite; }
      @keyframes mf-pulse-scale {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
      .mf-pulse-scale { animation: mf-pulse-scale 1.8s ease-in-out infinite; }
      @keyframes mf-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      .mf-blink { animation: mf-blink 0.9s ease-in-out infinite; }
      @keyframes mf-link-dot {
        0%, 100% { transform: scale(0.7); opacity: 0.35; }
        50% { transform: scale(1.25); opacity: 1; }
      }
      .mf-link-dot {
        width: 8px; height: 8px; border-radius: 9999px;
        box-shadow: 0 0 8px currentColor;
        animation: mf-link-dot 1.1s ease-in-out infinite;
      }
      @keyframes mf-confetti {
        0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
        15% { opacity: 1; }
        100% { transform: translateY(170px) rotate(360deg); opacity: 0; }
      }
      .mf-confetti { top: 0; border-radius: 1px; animation: mf-confetti 2.4s linear infinite; }
    `}</style>
  );
}
