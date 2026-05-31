/**
 * RushFlow — the shared, presentational Rush match experience.
 *
 * Given a `rush` view (from lib/rush.publicView), the `matchup` (with
 * player1/player2 profiles + pot info), the current `userId`, and a set
 * of action handlers, this renders the correct one of the eight match
 * screens for the current phase:
 *
 *   accept       → RushAcceptScreen        (screen 2: Opponent Found)
 *   confirmed    → RushConfirmedScreen     (screen 3: Match Confirmed)
 *   picking      → RushPickScreen          (screen 4: Pick Your Side)
 *   live         → RushLiveScreen          (screen 5: Battle In Progress)
 *   round_result → RushRoundResultScreen   (screen 6: Round Result)
 *   completed    → RushResultScreen        (screen 7: Match Result)
 *                  → RushRematchScreen      (screen 8: Play Again)
 *   cancelled    → RushCancelledScreen
 *
 * It owns NO data fetching — the routed page and the QuickMatchModal both
 * poll /state and feed the result in here, so the look is identical in
 * both places. (Screen 1, "Finding Opponent", lives in the modal since
 * it happens before the matchup/rush state exists.)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import UserAvatar from '../../UserAvatar';
import { formatMoney } from '../../../utils/formatMoney';

// --- palette ----------------------------------------------------------
const YOU = '#3b82f6';
const YOU_SOFT = '#60a5fa';
const OPP = '#ef4444';
const OPP_SOFT = '#fb923c';
const WIN = '#10b981';
const GOLD = '#facc15';

function useNow(active = true, intervalMs = 150) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => (t + 1) % 1000000), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return Date.now();
}

function msUntil(deadline, now) {
  if (!deadline) return 0;
  return Math.max(0, new Date(deadline).getTime() - now);
}

function secs(ms) {
  return Math.ceil(ms / 1000);
}

// Cosmetic tier badge. Uses a provided tier when present, otherwise a
// stable label derived from the user id so the VS header reads like the
// mockup (PRO / ROOKIE / ELITE).
const TIERS = ['ROOKIE', 'PRO', 'ELITE'];
const TIER_COLOR = { ROOKIE: OPP, PRO: YOU, ELITE: GOLD };
function tierFor(player) {
  if (!player) return null;
  if (player.tier) return String(player.tier).toUpperCase();
  const id = String(player.id || '');
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TIERS[h % TIERS.length];
}

// --- small shared pieces ---------------------------------------------

function CoinBadge({ amount }) {
  return (
    <div className="rf-coin">
      <span className="rf-coin-icon">🪙</span>
      <span>{formatMoney(amount, 0)}</span>
    </div>
  );
}

function Avatar({ player, color, size = 84, winning, dimmed }) {
  return (
    <div
      className="rf-avatar"
      style={{
        width: size,
        height: size,
        borderColor: color,
        boxShadow: winning
          ? `0 0 0 3px rgba(16,185,129,0.35), 0 0 28px ${color}aa`
          : `0 0 22px ${color}66`,
        opacity: dimmed ? 0.4 : 1,
        filter: dimmed ? 'grayscale(0.6)' : 'none',
      }}
    >
      <UserAvatar
        user={{ id: player?.id, username: player?.username, avatar: player?.avatar }}
        size={size}
      />
    </div>
  );
}

function VsHeader({ me, opp, size = 84, showTiers = true, compact = false }) {
  return (
    <div className={`rf-vs ${compact ? 'rf-vs-compact' : ''}`}>
      <div className="rf-vs-side">
        <Avatar player={me} color={YOU} size={size} />
        <div className="rf-name" style={{ color: '#fff' }}>{(me?.username || 'YOU').toUpperCase()}</div>
        {showTiers && <span className="rf-tier" style={{ color: TIER_COLOR[tierFor(me)] || YOU, borderColor: `${TIER_COLOR[tierFor(me)] || YOU}55` }}>{tierFor(me)}</span>}
      </div>
      <div className="rf-vs-mid">
        <span className="rf-vs-text">VS</span>
      </div>
      <div className="rf-vs-side">
        <Avatar player={opp} color={OPP} size={size} />
        <div className="rf-name" style={{ color: '#fff' }}>{(opp?.username || 'OPPONENT').toUpperCase()}</div>
        {showTiers && <span className="rf-tier" style={{ color: TIER_COLOR[tierFor(opp)] || OPP, borderColor: `${TIER_COLOR[tierFor(opp)] || OPP}55` }}>{tierFor(opp)}</span>}
      </div>
    </div>
  );
}

function RoundDots({ count, current, wins }) {
  return (
    <div className="rf-dots">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`rf-dot ${i === current ? 'rf-dot-active' : ''} ${i < current ? 'rf-dot-done' : ''}`}
        />
      ))}
    </div>
  );
}

function BrandRow({ amount }) {
  return (
    <div className="rf-brandrow">
      <span className="rf-brand">piks</span>
      <CoinBadge amount={amount} />
    </div>
  );
}

// --- screen 2: Opponent Found / Accept -------------------------------

function RushAcceptScreen({ rush, me, opp, stake, coinBalance, onAccept, onDecline, busy }) {
  const now = useNow(true, 250);
  const remaining = secs(msUntil(rush.acceptDeadline, now));
  return (
    <div className="rf-card rf-accept">
      <BrandRow amount={coinBalance} />
      <div className="rf-found-title">⚡ OPPONENT FOUND! ⚡</div>
      <VsHeader me={me} opp={opp} size={88} />
      <div className="rf-stake">
        <span className="rf-stake-label">STAKE</span>
        <span className="rf-stake-val">{formatMoney(stake, 0)} <span className="rf-coin-icon">🪙</span></span>
      </div>
      {rush.myAccepted ? (
        <button className="rf-btn rf-btn-gold" disabled>
          ✓ ACCEPTED — WAITING…
        </button>
      ) : (
        <button className="rf-btn rf-btn-gold" onClick={onAccept} disabled={busy}>
          ACCEPT MATCH <span className="rf-btn-timer">{remaining}s</span>
        </button>
      )}
      <button className="rf-link" onClick={onDecline} disabled={busy}>DECLINE</button>
    </div>
  );
}

// --- screen 3: Match Confirmed countdown -----------------------------

function RushConfirmedScreen({ rush, me, opp, stake, coinBalance }) {
  const now = useNow(true, 100);
  const remainMs = msUntil(rush.confirmDeadline, now);
  const n = Math.max(1, Math.min(3, Math.ceil(remainMs / 1000)));
  return (
    <div className="rf-card rf-confirmed">
      <BrandRow amount={coinBalance} />
      <div className="rf-confirm-badge">
        <span className="rf-shield">🛡️</span>
        <span className="rf-confirm-title">MATCH CONFIRMED!</span>
      </div>
      <VsHeader me={me} opp={opp} size={70} compact />
      <div className="rf-stake">
        <span className="rf-stake-label">STAKE</span>
        <span className="rf-stake-val">{formatMoney(stake, 0)} <span className="rf-coin-icon">🪙</span></span>
      </div>
      <div className="rf-getting">GETTING PICKS READY…</div>
      <div className="rf-countdown">
        <span className="rf-cd-side">{Math.min(3, n + 1)}</span>
        <span key={n} className="rf-cd-main">{n}</span>
        <span className="rf-cd-side">{Math.max(1, n - 1)}</span>
      </div>
    </div>
  );
}

// --- screen 4: Pick Your Side ----------------------------------------

const SPORT_BG = {
  football: 'linear-gradient(160deg,#1f2937,#0b1220)',
  basketball: 'linear-gradient(160deg,#7c2d12,#1a0f08)',
  hockey: 'linear-gradient(160deg,#0c4a6e,#08131c)',
};

function RushPickScreen({ rush, me, opp, coinBalance, onPick, onBack, busy }) {
  const now = useNow(true, 200);
  const round = rush.round || {};
  const [selected, setSelected] = useState(round.myPick || null);
  useEffect(() => { setSelected(round.myPick || null); }, [round.myPick, rush.roundIndex]);
  const remaining = secs(msUntil(round.pickDeadline, now));
  const locked = !!round.myPick;
  const selectedOption = (round.options || []).find((o) => o.key === (round.myPick || selected));

  return (
    <div className="rf-card rf-pick">
      <div className="rf-topbar">
        <button className="rf-back" onClick={onBack} aria-label="Back">‹</button>
        <div className="rf-roundlabel">
          <span>ROUND {(rush.roundIndex || 0) + 1} OF {rush.maxRounds}</span>
          <RoundDots count={rush.maxRounds} current={rush.roundIndex || 0} wins={rush.roundWins} />
        </div>
        <CoinBadge amount={coinBalance} />
      </div>

      <div className="rf-pick-vs">
        <div className="rf-pick-player">
          <Avatar player={me} color={YOU} size={58} />
          <div className="rf-name-sm">{(me?.username || 'YOU').toUpperCase()}</div>
        </div>
        <div className="rf-pick-timer">
          <span className="rf-vs-text rf-vs-text-sm">VS</span>
          <span className="rf-timer-pill">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span>
        </div>
        <div className="rf-pick-player">
          <Avatar player={opp} color={OPP} size={58} />
          <div className="rf-name-sm">{(opp?.username || 'OPP').toUpperCase()}</div>
        </div>
      </div>

      <div className="rf-pickyourside">⚡ PICK YOUR SIDE ⚡</div>

      <div className="rf-options">
        {(round.options || []).map((opt) => {
          const isSel = (round.myPick || selected) === opt.key;
          return (
            <button
              key={opt.key}
              className={`rf-option ${isSel ? 'rf-option-sel' : ''}`}
              style={{ background: SPORT_BG[opt.sport] || '#111' }}
              onClick={() => !locked && setSelected(opt.key)}
              disabled={locked || busy}
            >
              {isSel && <span className="rf-option-check">✓</span>}
              <span className="rf-option-icon">{opt.icon}</span>
              <span className="rf-option-name">{opt.sportName.toUpperCase()}</span>
              <span className="rf-option-odds">{opt.odds}</span>
            </button>
          );
        })}
      </div>

      <div className="rf-pick-foot">
        <span className="rf-payout">PAYOUT: {selectedOption?.odds || '—'}</span>
        {locked ? (
          <button className="rf-btn rf-btn-blue" disabled>
            {round.oppPicked ? 'LOCKED — STARTING…' : 'LOCKED — WAITING…'}
          </button>
        ) : (
          <button
            className="rf-btn rf-btn-blue"
            disabled={!selected || busy}
            onClick={() => onPick(selected)}
          >
            LOCK IN PICK
          </button>
        )}
      </div>
    </div>
  );
}

// --- screen 5: Battle In Progress ------------------------------------

function buildSeries(events, frac) {
  const pts = [];
  let cum = 0;
  for (const e of events || []) {
    cum += e.points;
    pts.push({ at: e.at, y: cum });
  }
  const revealed = pts.filter((p) => p.at <= frac);
  return { all: pts, revealed, total: cum };
}

function LiveChart({ mePerf, oppPerf, frac }) {
  const W = 300;
  const H = 130;
  const pad = 6;
  const meS = buildSeries(mePerf?.events, frac);
  const oppS = buildSeries(oppPerf?.events, frac);
  const maxY = Math.max(10, meS.total, oppS.total);
  const toXY = (p) => [pad + p.at * (W - pad * 2), H - pad - (p.y / maxY) * (H - pad * 2)];
  const toPath = (arr) => {
    const list = [{ at: 0, y: 0 }, ...arr];
    return list.map((p, i) => `${i === 0 ? 'M' : 'L'}${toXY(p).map((n) => n.toFixed(1)).join(',')}`).join(' ');
  };
  const meLast = meS.revealed[meS.revealed.length - 1] || { at: 0, y: 0 };
  const meLastXY = toXY(meLast);
  return (
    <svg className="rf-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={H - pad - g * (H - pad * 2)} y2={H - pad - g * (H - pad * 2)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      <path d={toPath(oppS.revealed)} fill="none" stroke={OPP} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(meS.revealed)} fill="none" stroke={YOU} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {meS.revealed.map((p, i) => { const [x, y] = toXY(p); return <circle key={`m${i}`} cx={x} cy={y} r="2.4" fill={YOU} />; })}
      {oppS.revealed.map((p, i) => { const [x, y] = toXY(p); return <circle key={`o${i}`} cx={x} cy={y} r="2.4" fill={OPP} />; })}
      {meS.revealed.length > 0 && (
        <g>
          <rect x={Math.min(W - 40, meLastXY[0] - 14)} y={Math.max(2, meLastXY[1] - 22)} width="34" height="15" rx="4" fill={YOU} />
          <text x={Math.min(W - 23, meLastXY[0] + 3)} y={Math.max(13, meLastXY[1] - 11)} fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle">YOU</text>
        </g>
      )}
    </svg>
  );
}

function RushLiveScreen({ rush, me, opp, userId, coinBalance, onBack }) {
  const now = useNow(true, 100);
  const round = rush.round || {};
  const players = round.players || {};
  const mePerf = players[userId];
  const oppId = rush.opponentId;
  const oppPerf = players[oppId];
  const elapsed = round.liveStartedAt ? now - new Date(round.liveStartedAt).getTime() : 0;
  const frac = Math.max(0, Math.min(1, elapsed / (round.durationMs || 12000)));

  const meScore = buildSeries(mePerf?.events, frac).revealed.reduce((a, p) => Math.max(a, p.y), 0);
  const oppScore = buildSeries(oppPerf?.events, frac).revealed.reduce((a, p) => Math.max(a, p.y), 0);

  const feed = useMemo(() => {
    const merged = [];
    (mePerf?.events || []).forEach((e) => merged.push({ ...e, who: 'me' }));
    (oppPerf?.events || []).forEach((e) => merged.push({ ...e, who: 'opp' }));
    return merged.filter((e) => e.at <= frac).sort((a, b) => b.at - a.at).slice(0, 6);
  }, [mePerf, oppPerf, frac]);

  const sportIcon = mePerf?.icon || oppPerf?.icon || '🏀';
  const sportName = (mePerf?.sportName || oppPerf?.sportName || '').toUpperCase();

  return (
    <div className="rf-card rf-live">
      <div className="rf-topbar">
        <button className="rf-back" onClick={onBack} aria-label="Back">‹</button>
        <div className="rf-roundlabel">
          <span>ROUND {(rush.roundIndex || 0) + 1} OF {rush.maxRounds}</span>
          <RoundDots count={rush.maxRounds} current={rush.roundIndex || 0} wins={rush.roundWins} />
        </div>
        <CoinBadge amount={coinBalance} />
      </div>

      <div className="rf-live-vs">
        <div className="rf-pick-player">
          <Avatar player={me} color={YOU} size={48} winning={meScore >= oppScore} />
          <div className="rf-name-sm">{(me?.username || 'YOU').toUpperCase()}</div>
          <div className="rf-live-tag" style={{ color: WIN }}>● LIVE</div>
        </div>
        <span className="rf-vs-text rf-vs-text-sm">VS</span>
        <div className="rf-pick-player">
          <Avatar player={opp} color={OPP} size={48} winning={oppScore > meScore} />
          <div className="rf-name-sm">{(opp?.username || 'OPP').toUpperCase()}</div>
        </div>
      </div>

      <div className="rf-scores">
        <span className="rf-score" style={{ color: YOU_SOFT }}>{meScore}</span>
        <span className="rf-score" style={{ color: OPP_SOFT }}>{oppScore}</span>
      </div>

      <div className="rf-sportpill">{sportIcon} {sportName}</div>

      <LiveChart mePerf={mePerf} oppPerf={oppPerf} frac={frac} />

      <div className="rf-feed">
        {feed.length === 0 && <div className="rf-feed-empty">Tip-off…</div>}
        {feed.map((e, i) => (
          <div key={i} className="rf-feed-row">
            <span className="rf-feed-clock">{e.clock}</span>
            <span className="rf-feed-icon">{e.who === 'me' ? mePerf?.icon : oppPerf?.icon}</span>
            <span className="rf-feed-label">{e.team} {e.label}</span>
            <span className="rf-feed-pts" style={{ color: e.who === 'me' ? YOU_SOFT : OPP_SOFT }}>+{e.points}</span>
          </div>
        ))}
      </div>

      <div className="rf-liveupdates"><span className="rf-livedot" /> LIVE UPDATES</div>
    </div>
  );
}

// --- screen 6: Round Result ------------------------------------------

function RushRoundResultScreen({ rush, me, opp, userId, onContinue, busy }) {
  const round = rush.round || {};
  const players = round.players || {};
  const meScore = players[userId]?.finalScore ?? 0;
  const oppScore = players[rush.opponentId]?.finalScore ?? 0;
  const iWon = round.roundWinnerId === userId;
  const roundNum = (rush.roundIndex || 0) + 1;

  return (
    <div className="rf-card rf-roundresult">
      <div className="rf-rr-title">ROUND {roundNum} <span style={{ color: GOLD }}>⚡ COMPLETE ⚡</span></div>
      <VsHeader me={me} opp={opp} size={66} showTiers={false} />
      <div className="rf-scores">
        <span className="rf-score" style={{ color: YOU_SOFT }}>{meScore}</span>
        <span className="rf-score" style={{ color: OPP_SOFT }}>{oppScore}</span>
      </div>
      <div className={`rf-rr-banner ${iWon ? 'rf-rr-win' : 'rf-rr-loss'}`}>
        <span className="rf-rr-trophy">{iWon ? '🏆' : '💔'}</span>
        <div>
          <div className="rf-rr-head">{iWon ? 'YOU WON THE ROUND!' : 'OPPONENT TOOK THE ROUND'}</div>
          <div className="rf-rr-sub">{iWon ? '+1 POINT' : `${(opp?.username || 'Opponent')} +1 point`}</div>
        </div>
      </div>
      <div className="rf-rr-progress">
        <span>ROUND {roundNum} OF {rush.maxRounds}</span>
        <RoundDots count={rush.maxRounds} current={rush.roundIndex || 0} wins={rush.roundWins} />
      </div>
      {round.myContinued ? (
        <button className="rf-btn rf-btn-blue" disabled>WAITING…</button>
      ) : (
        <button className="rf-btn rf-btn-blue" onClick={onContinue} disabled={busy}>CONTINUE</button>
      )}
    </div>
  );
}

// --- screen 7: Match Result ------------------------------------------

function RushResultScreen({ rush, matchup, me, opp, userId, onViewResults }) {
  const iWon = rush.winnerUserId === userId;
  const winner = iWon ? me : opp;
  const loser = iWon ? opp : me;
  const payout = parseFloat(matchup?.winnerPayout) || 0;

  return (
    <div className="rf-card rf-result">
      <BrandRow amount={(parseFloat(matchup?.startingBalance) || 0)} />
      <div className="rf-confetti" aria-hidden>🎉✨🎊</div>
      <div className="rf-crown">👑</div>
      <div className="rf-win-title" style={{ color: iWon ? GOLD : OPP_SOFT }}>{iWon ? 'YOU WIN!' : 'YOU LOSE'}</div>
      <div className="rf-result-avatars">
        <Avatar player={winner} color={WIN} size={104} winning />
        <Avatar player={loser} color="#444" size={66} dimmed />
      </div>
      <div className="rf-result-name">{(winner?.username || '').toUpperCase()}</div>
      <div className={`rf-payout-box ${iWon ? 'rf-payout-win' : 'rf-payout-loss'}`}>
        <span className="rf-payout-label">{iWon ? 'YOU WON' : 'YOU STAKED'}</span>
        <span className="rf-payout-amt">{iWon ? formatMoney(payout, 0) : formatMoney(parseFloat(matchup?.startingBalance) || 0, 0)} <span className="rf-coin-icon">🪙</span></span>
      </div>
      <button className="rf-btn rf-btn-gold" onClick={onViewResults}>VIEW RESULTS</button>
    </div>
  );
}

// --- screen 8: Rematch / Play Again ----------------------------------

function RushRematchScreen({ matchup, me, opp, onRematch, onNewOpponent, onHome, busy }) {
  const base = parseFloat(matchup?.startingBalance) || 10000;
  const [stake, setStake] = useState(base);
  const step = base >= 10000 ? 5000 : 1000;
  const balance = (parseFloat(matchup?.startingBalance) || 0) * 2;
  return (
    <div className="rf-card rf-rematch">
      <BrandRow amount={balance} />
      <div className="rf-playagain">PLAY AGAIN?</div>
      <VsHeader me={me} opp={opp} size={70} compact />
      <div className="rf-stake-adjust">
        <span className="rf-stake-label">STAKE</span>
        <div className="rf-stepper">
          <button className="rf-step" onClick={() => setStake((s) => Math.max(step, s - step))} disabled={busy}>−</button>
          <span className="rf-step-val">{formatMoney(stake, 0)} <span className="rf-coin-icon">🪙</span></span>
          <button className="rf-step" onClick={() => setStake((s) => s + step)} disabled={busy}>+</button>
        </div>
      </div>
      <button className="rf-btn rf-btn-green" onClick={() => onRematch(stake)} disabled={busy}>⚡ REMATCH</button>
      <button className="rf-btn rf-btn-dark" onClick={onNewOpponent} disabled={busy}>NEW OPPONENT</button>
      <button className="rf-link" onClick={onHome} disabled={busy}>BACK TO HOME</button>
    </div>
  );
}

// --- cancelled --------------------------------------------------------

function RushCancelledScreen({ onExit }) {
  useEffect(() => {
    const t = setTimeout(() => onExit && onExit(), 4000);
    return () => clearTimeout(t);
  }, [onExit]);
  return (
    <div className="rf-card rf-cancelled">
      <div className="rf-cancel-emoji">🕒</div>
      <div className="rf-cancel-title">Match cancelled</div>
      <div className="rf-cancel-sub">Your stake is safe.</div>
      <button className="rf-btn rf-btn-dark" onClick={onExit}>BACK TO BATTLE</button>
    </div>
  );
}

// --- main orchestrator -----------------------------------------------

export default function RushFlow({
  rush,
  matchup,
  userId,
  busy = false,
  onAccept,
  onDecline,
  onPick,
  onContinue,
  onViewResults,
  onRematch,
  onNewOpponent,
  onHome,
  onExit,
  onBack,
}) {
  const [resultView, setResultView] = useState('result'); // result | rematch

  if (!rush) return null;

  const isUser1 = userId === matchup?.user1Id;
  const me = isUser1 ? matchup?.player1 : matchup?.player2;
  const opp = isUser1 ? matchup?.player2 : matchup?.player1;
  const stake = parseFloat(matchup?.startingBalance) || 0;
  const coinBalance = parseFloat(matchup?.startingBalance) || 0;

  let body = null;
  if (rush.phase === 'cancelled') {
    body = <RushCancelledScreen onExit={onExit} />;
  } else if (rush.phase === 'accept') {
    body = <RushAcceptScreen rush={rush} me={me} opp={opp} stake={stake} coinBalance={coinBalance} onAccept={onAccept} onDecline={onDecline} busy={busy} />;
  } else if (rush.phase === 'confirmed') {
    body = <RushConfirmedScreen rush={rush} me={me} opp={opp} stake={stake} coinBalance={coinBalance} />;
  } else if (rush.phase === 'picking') {
    body = <RushPickScreen rush={rush} me={me} opp={opp} coinBalance={coinBalance} onPick={onPick} onBack={onBack} busy={busy} />;
  } else if (rush.phase === 'live') {
    body = <RushLiveScreen rush={rush} me={me} opp={opp} userId={userId} coinBalance={coinBalance} onBack={onBack} />;
  } else if (rush.phase === 'round_result') {
    body = <RushRoundResultScreen rush={rush} me={me} opp={opp} userId={userId} onContinue={onContinue} busy={busy} />;
  } else if (rush.phase === 'completed') {
    body = resultView === 'rematch'
      ? <RushRematchScreen matchup={matchup} me={me} opp={opp} onRematch={onRematch} onNewOpponent={onNewOpponent} onHome={onHome} busy={busy} />
      : <RushResultScreen rush={rush} matchup={matchup} me={me} opp={opp} userId={userId} onViewResults={() => { setResultView('rematch'); if (onViewResults) onViewResults(); }} />;
  }

  return (
    <div className="rf-root">
      {body}
      <RushFlowStyles />
    </div>
  );
}

// --- styles -----------------------------------------------------------

function RushFlowStyles() {
  return (
    <style jsx global>{`
      .rf-root { width: 100%; display: flex; justify-content: center; }
      .rf-card {
        position: relative; width: 100%; max-width: 420px; margin: 0 auto;
        background: radial-gradient(120% 80% at 50% -10%, #15151a 0%, #0a0a0c 60%);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 22px;
        padding: 20px 18px 22px; color: #e5e7eb; overflow: hidden;
        box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        display: flex; flex-direction: column; align-items: center; gap: 14px;
      }
      .rf-brandrow { width: 100%; display: flex; align-items: center; justify-content: space-between; }
      .rf-brand { font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: #fff; }
      .rf-coin { display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(180deg,#3a2f00,#241d00); border: 1px solid ${GOLD}55; color: ${GOLD}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 999px; }
      .rf-coin-icon { filter: saturate(1.3); }

      .rf-found-title { color: ${WIN}; font-weight: 900; font-size: 18px; letter-spacing: 0.02em; text-align: center; text-shadow: 0 0 18px ${WIN}66; }

      .rf-vs { display: flex; align-items: center; justify-content: center; gap: 18px; width: 100%; }
      .rf-vs-compact { gap: 14px; }
      .rf-vs-side { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
      .rf-vs-mid { display: flex; align-items: center; justify-content: center; }
      .rf-vs-text { font-weight: 900; font-size: 30px; background: linear-gradient(135deg, ${YOU}, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .rf-vs-text-sm { font-size: 18px; }
      .rf-avatar { border-radius: 50%; border: 3px solid; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; }
      .rf-name { font-weight: 800; font-size: 13px; letter-spacing: 0.02em; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rf-name-sm { font-weight: 800; font-size: 10px; color: #fff; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rf-tier { font-size: 9px; font-weight: 900; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px; border: 1px solid; background: rgba(255,255,255,0.03); }

      .rf-stake { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .rf-stake-label { font-size: 10px; letter-spacing: 0.16em; color: #94a3b8; font-weight: 700; }
      .rf-stake-val { font-size: 20px; font-weight: 900; color: #fff; }

      .rf-btn { width: 100%; border: none; border-radius: 13px; padding: 14px; font-weight: 900; font-size: 15px; letter-spacing: 0.03em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.08s ease, filter 0.15s ease; }
      .rf-btn:active { transform: translateY(1px); }
      .rf-btn:disabled { opacity: 0.6; cursor: default; }
      .rf-btn-gold { background: linear-gradient(180deg,#fbbf24,#f59e0b); color: #1a1206; box-shadow: 0 6px 18px ${GOLD}44; }
      .rf-btn-blue { background: linear-gradient(180deg,#3b82f6,#2563eb); color: #fff; box-shadow: 0 6px 18px ${YOU}44; }
      .rf-btn-green { background: linear-gradient(180deg,#10b981,#059669); color: #04140d; box-shadow: 0 6px 18px ${WIN}44; }
      .rf-btn-dark { background: #161616; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.1); }
      .rf-btn-timer { background: rgba(0,0,0,0.18); border-radius: 8px; padding: 2px 8px; font-size: 12px; }
      .rf-link { background: none; border: none; color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; cursor: pointer; padding: 2px; }

      .rf-confirm-badge { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .rf-shield { font-size: 28px; filter: drop-shadow(0 0 10px ${WIN}); }
      .rf-confirm-title { color: ${WIN}; font-weight: 900; font-size: 18px; letter-spacing: 0.02em; }
      .rf-getting { font-size: 10px; letter-spacing: 0.2em; color: #94a3b8; font-weight: 700; }
      .rf-countdown { display: flex; align-items: center; gap: 18px; }
      .rf-cd-side { font-size: 20px; font-weight: 900; color: #475569; }
      .rf-cd-main { font-size: 40px; font-weight: 900; color: ${YOU_SOFT}; width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${YOU}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 24px ${YOU}66; animation: rfPop 0.4s ease; }
      @keyframes rfPop { 0% { transform: scale(0.6); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } }

      .rf-topbar { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .rf-back { background: none; border: none; color: #cbd5e1; font-size: 26px; line-height: 1; cursor: pointer; width: 28px; }
      .rf-roundlabel { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: #cbd5e1; }
      .rf-dots { display: flex; gap: 6px; }
      .rf-dot { width: 7px; height: 7px; border-radius: 50%; background: #2a2a32; }
      .rf-dot-active { background: ${YOU}; box-shadow: 0 0 8px ${YOU}; }
      .rf-dot-done { background: #475569; }

      .rf-pick-vs, .rf-live-vs { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; }
      .rf-live-vs { justify-content: center; gap: 18px; }
      .rf-pick-player { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
      .rf-pick-timer { display: flex; flex-direction: column; align-items: center; gap: 4px; }
      .rf-timer-pill { font-variant-numeric: tabular-nums; font-weight: 900; color: #fff; font-size: 15px; }
      .rf-live-tag { font-size: 9px; font-weight: 800; letter-spacing: 0.08em; }

      .rf-pickyourside { color: ${GOLD}; font-weight: 900; font-size: 14px; letter-spacing: 0.04em; }
      .rf-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; }
      .rf-option { position: relative; border: 2px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 6px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; color: #fff; transition: border-color 0.12s ease, transform 0.08s ease; }
      .rf-option:active { transform: translateY(1px); }
      .rf-option:disabled { cursor: default; }
      .rf-option-sel { border-color: ${YOU}; box-shadow: 0 0 0 2px ${YOU}55, 0 0 22px ${YOU}55; }
      .rf-option-check { position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%; background: ${YOU}; color: #fff; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
      .rf-option-icon { font-size: 30px; }
      .rf-option-name { font-size: 11px; font-weight: 900; letter-spacing: 0.02em; }
      .rf-option-odds { font-size: 11px; font-weight: 800; color: ${WIN}; }

      .rf-pick-foot { width: 100%; display: flex; align-items: center; gap: 10px; }
      .rf-payout { font-size: 11px; font-weight: 800; color: #cbd5e1; background: #141414; border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; white-space: nowrap; }
      .rf-pick-foot .rf-btn { flex: 1; }

      .rf-scores { display: flex; align-items: center; justify-content: center; gap: 60px; }
      .rf-score { font-size: 46px; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1; }
      .rf-sportpill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 900; letter-spacing: 0.06em; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 999px; }
      .rf-chart { width: 100%; height: 130px; }

      .rf-feed { width: 100%; display: flex; flex-direction: column; gap: 4px; min-height: 56px; }
      .rf-feed-empty { color: #64748b; font-size: 11px; text-align: center; padding: 8px; }
      .rf-feed-row { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 2px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .rf-feed-clock { color: #64748b; font-variant-numeric: tabular-nums; font-weight: 700; width: 34px; }
      .rf-feed-label { color: #e5e7eb; font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rf-feed-pts { font-weight: 900; }
      .rf-liveupdates { display: inline-flex; align-items: center; gap: 6px; color: ${WIN}; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
      .rf-livedot { width: 7px; height: 7px; border-radius: 50%; background: ${WIN}; box-shadow: 0 0 8px ${WIN}; animation: rfPulse 1.2s infinite; }
      @keyframes rfPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

      .rf-rr-title { font-style: italic; font-weight: 900; font-size: 22px; color: #fff; text-align: center; letter-spacing: 0.01em; }
      .rf-rr-banner { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 13px; }
      .rf-rr-win { background: rgba(16,185,129,0.12); border: 1px solid ${WIN}55; }
      .rf-rr-loss { background: rgba(239,68,68,0.1); border: 1px solid ${OPP}44; }
      .rf-rr-trophy { font-size: 24px; }
      .rf-rr-head { font-weight: 900; font-size: 14px; color: #fff; }
      .rf-rr-sub { font-size: 11px; color: #cbd5e1; font-weight: 700; }
      .rf-rr-progress { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 0.14em; font-weight: 800; color: #94a3b8; }

      .rf-confetti { font-size: 22px; letter-spacing: 6px; }
      .rf-crown { font-size: 30px; margin-top: -6px; filter: drop-shadow(0 0 12px ${GOLD}); }
      .rf-win-title { font-weight: 900; font-size: 34px; letter-spacing: 0.02em; text-shadow: 0 0 24px currentColor; }
      .rf-result-avatars { display: flex; align-items: center; justify-content: center; gap: 14px; }
      .rf-result-name { font-weight: 900; font-size: 15px; color: #fff; letter-spacing: 0.02em; }
      .rf-payout-box { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px; border-radius: 14px; }
      .rf-payout-win { background: rgba(16,185,129,0.12); border: 1px solid ${WIN}66; }
      .rf-payout-loss { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
      .rf-payout-label { font-size: 10px; letter-spacing: 0.16em; font-weight: 800; color: #94a3b8; }
      .rf-payout-amt { font-size: 26px; font-weight: 900; color: #fff; }

      .rf-playagain { font-weight: 900; font-size: 24px; color: #fff; letter-spacing: 0.02em; }
      .rf-stake-adjust { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .rf-stepper { display: flex; align-items: center; gap: 12px; }
      .rf-step { width: 38px; height: 38px; border-radius: 11px; background: #161616; border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 20px; font-weight: 900; cursor: pointer; }
      .rf-step-val { font-size: 18px; font-weight: 900; color: #fff; min-width: 120px; text-align: center; }

      .rf-cancelled { align-items: center; }
      .rf-cancel-emoji { font-size: 34px; }
      .rf-cancel-title { font-weight: 900; font-size: 18px; color: #fff; }
      .rf-cancel-sub { font-size: 12px; color: #94a3b8; }

      @media (hover: hover) {
        .rf-btn:hover:not(:disabled) { filter: brightness(1.07); }
        .rf-option:hover:not(:disabled):not(.rf-option-sel) { border-color: rgba(255,255,255,0.2); }
        .rf-step:hover { border-color: rgba(255,255,255,0.25); }
        .rf-link:hover { color: #cbd5e1; }
      }
    `}</style>
  );
}
