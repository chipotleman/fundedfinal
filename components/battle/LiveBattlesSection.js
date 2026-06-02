import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';
import QuickMatchModal from './QuickMatchModal';
import BattleModeChooser from './BattleModeChooser';
import PlayFriendModal from './PlayFriendModal';
import PrivateMatchModal from './PrivateMatchModal';
import MyBattleOverviewModal from './MyBattleOverviewModal';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../UserAvatar';
import TeamLogo from '../TeamLogo';
import MutualFriendsLine from '../social/MutualFriendsLine';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';
import { useMatchup } from '../../contexts/MatchupContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';
import { navigateToBattleStart } from '../../lib/battleStartNavigation';
import {
  PLAY_NOW_SKIP_CONFIRM_KEY,
  PLAY_NOW_SKIP_CONFIRM_VERSION,
} from '../../lib/playNowConfirm';
import { readLocalOneTapPrefs, writeLocalOneTapPrefs, fetchOneTapPrefs, saveOneTapPrefs } from '../../utils/oneTapPrefs';
import { CartoonChip, CARTOON_MODE_META, CartoonChipStyles } from './CartoonChip';
import DesktopScrollRow from '../desktop/DesktopScrollRow';
import PreMatchPopup from './PreMatchPopup';
import haptic from '../../utils/haptics';
import SlideToForfeit from './SlideToForfeit';
import { useBetaMode } from '../../contexts/SiteConfigContext';

function formatTimeRemaining(ms) {
  if (!ms || ms <= 0) return 'Ended';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatStartedAgo(startsAt) {
  if (!startsAt) return null;
  const ms = Date.now() - new Date(startsAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `Started ${days}d ago`;
  if (hours > 0) return `Started ${hours}h ago`;
  if (minutes > 0) return `Started ${minutes}m ago`;
  return 'Just started';
}

function formatBattleRecord(user) {
  const w = parseInt(user?.battleWins, 10);
  const l = parseInt(user?.battleLosses, 10);
  const wins = Number.isFinite(w) ? w : 0;
  const losses = Number.isFinite(l) ? l : 0;
  if (wins === 0 && losses === 0) return null;
  return `${wins}-${losses}`;
}

const SIMULATED_PICKS = {
  'sim-1': {
    user1: [
      { team: 'Lakers', type: 'Moneyline', odds: '-140', status: 'won', amount: 50 },
      { team: 'Celtics', type: 'Spread -3.5', odds: '-110', status: 'pending', amount: 35 },
    ],
    user2: [
      { team: 'Warriors', type: 'Moneyline', odds: '+120', status: 'lost', amount: 40 },
      { team: 'Bucks', type: 'Over 224.5', odds: '-105', status: 'pending', amount: 30 },
    ],
  },
  'sim-2': {
    user1: [
      { team: 'Chiefs', type: 'Spread -7', odds: '-110', status: 'won', amount: 100 },
      { team: 'Cowboys', type: 'Moneyline', odds: '+155', status: 'won', amount: 75 },
      { team: '76ers', type: 'Under 218.5', odds: '-115', status: 'pending', amount: 60 },
    ],
    user2: [
      { team: 'Eagles', type: 'Moneyline', odds: '-180', status: 'won', amount: 80 },
      { team: 'Knicks', type: 'Spread +4.5', odds: '-110', status: 'lost', amount: 55 },
    ],
  },
  'sim-3': {
    user1: [
      { team: 'Heat', type: 'Moneyline', odds: '+135', status: 'pending', amount: 25 },
    ],
    user2: [
      { team: 'Nuggets', type: 'Spread -5.5', odds: '-110', status: 'pending', amount: 30 },
    ],
  },
};


export function getSimulatedBattles(avatars) {
  const avatarPool = avatars.length >= 6 ? avatars : [];
  
  return [
    {
      id: 'sim-1',
      simulated: true,
      potSize: '500',
      startsAt: new Date(Date.now() - 1800000).toISOString(),
      endsAt: new Date(Date.now() + 5400000).toISOString(),
      remainingMs: 5400000,
      progressPercent: 25,
      user1: { id: 'bot-1', username: 'SharpShooter', avatar: avatarPool[0] || null, balance: 285, pnl: 35, pnlPercent: '14.0', battleWins: 12, battleLosses: 3 },
      user2: { id: 'bot-2', username: 'TheAnalyst', avatar: avatarPool[1] || null, balance: 240, pnl: -10, pnlPercent: '-4.0', battleWins: 8, battleLosses: 5, isFake: true },
    },
    {
      id: 'sim-2',
      simulated: true,
      potSize: '1000',
      startsAt: new Date(Date.now() - 7200000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      remainingMs: 3600000,
      progressPercent: 67,
      user1: { id: 'bot-3', username: 'BetMaster_X', avatar: avatarPool[2] || null, balance: 620, pnl: 120, pnlPercent: '24.0', battleWins: 22, battleLosses: 9 },
      user2: { id: 'bot-4', username: 'OddsKing99', avatar: avatarPool[3] || null, balance: 445, pnl: -55, pnlPercent: '-11.0', battleWins: 15, battleLosses: 11, isFake: true },
    },
    {
      id: 'sim-3',
      simulated: true,
      potSize: '250',
      startsAt: new Date(Date.now() - 600000).toISOString(),
      endsAt: new Date(Date.now() + 43200000).toISOString(),
      remainingMs: 43200000,
      progressPercent: 1.4,
      user1: { id: 'bot-5', username: 'LocksOnly', avatar: avatarPool[4] || null, balance: 128, pnl: 3, pnlPercent: '2.4', battleWins: 5, battleLosses: 2 },
      user2: { id: 'bot-6', username: 'ValueHunter', avatar: avatarPool[5] || null, balance: 125, pnl: 0, pnlPercent: '0.0', battleWins: 7, battleLosses: 4, isFake: true },
    },
  ];
}

function PickPill({ pick, compact = false }) {
  const isWon = pick.status === 'won';
  const isLost = pick.status === 'lost';
  const isPending = pick.status === 'pending';

  const neutralBorder = '#1a1a1a';
  const neutralBg = '#111';

  const statusColor = isWon ? '#10b981' : isLost ? '#ef4444' : '#64748b';
  const statusGlow = isWon ? 'rgba(16,185,129,0.35)' : isLost ? 'rgba(239,68,68,0.35)' : 'rgba(100,116,139,0.25)';
  const oddsColor = isWon ? '#34d399' : isLost ? '#f87171' : (typeof pick.odds === 'string' && pick.odds.startsWith('+') ? '#34d399' : '#e5e7eb');

  return (
    <div
      className="pick-chip-card"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '8px' : '11px',
        padding: compact ? '6px 10px 6px 9px' : '9px 14px 9px 12px',
        borderRadius: compact ? '999px' : '999px',
        background: isWon
          ? 'linear-gradient(90deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.02) 100%)'
          : isLost
          ? 'linear-gradient(90deg, rgba(239,68,68,0.10) 0%, rgba(239,68,68,0.02) 100%)'
          : 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        boxShadow: `inset 3px 0 0 0 ${statusColor}, 0 1px 0 0 rgba(255,255,255,0.03)`,
      }}
    >
      <div
        style={{
          width: compact ? '16px' : '20px',
          height: compact ? '16px' : '20px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: `radial-gradient(circle at 30% 30%, ${statusColor}55 0%, ${statusColor}22 60%, transparent 100%)`,
          boxShadow: `0 0 8px ${statusGlow}`,
        }}
      >
        {isWon && <svg width={compact ? "9" : "11"} height={compact ? "9" : "11"} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isLost && <svg width={compact ? "9" : "11"} height={compact ? "9" : "11"} viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isPending && <div className="pick-pending-dot" style={{ width: compact ? '4px' : '5px', height: compact ? '4px' : '5px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}></div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '6px' : '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <TeamLogo name={pick.team} sport={pick.sport} size={compact ? 14 : 18} />
        <span
          style={{
            color: '#fff',
            fontSize: compact ? '11px' : '13px',
            fontWeight: 800,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {pick.team}
        </span>
        <span
          style={{
            fontSize: compact ? '8px' : '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(148, 163, 184, 0.9)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {pick.type}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? '5px' : '7px', flexShrink: 0 }}>
        <span
          style={{
            color: oddsColor,
            fontSize: compact ? '12px' : '14px',
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            textShadow: isWon || isLost ? `0 0 8px ${statusGlow}` : 'none',
          }}
        >
          {pick.odds}
        </span>
        <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: compact ? '9px' : '10px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          ${pick.amount}
        </span>
      </div>
    </div>
  );
}


function MomentumIcon() {
  return <span className="live-momentum-flame text-[10px]" title="On fire!">🔥</span>;
}

function PlayerAvatar({ user, isWinning, size = 44, bgColor = '#1e40af', onClick }) {
  const router = useRouter();
  const profileCache = useProfileCacheOptional();
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else if (user.id) {
      if (profileCache) {
        profileCache.prefetchProfile(user.id, {
          id: user.id,
          username: user.username || user.name,
          avatar: user.avatar ?? null,
        });
      }
      router.push(`/profile/${user.id}`);
    }
  };
  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, cursor: user.id ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bgColor,
          border: isWinning ? '2px solid #10b981' : `2px solid ${'#333'}`,
        }}
      >
        <UserAvatar
          user={{ id: user.id, username: user.username, avatar: user.avatar }}
          size={size}
        />
      </div>
    </div>
  );
}

function PnlBadge({ pnlPercent, size = 'normal' }) {
  const val = parseFloat(pnlPercent);
  const isPos = val >= 0;
  const fontSize = size === 'small' ? '10px' : '11px';
  const padding = size === 'small' ? '1px 5px' : '2px 6px';
  
  return (
    <span style={{
      fontSize,
      fontWeight: 700,
      padding,
      borderRadius: '6px',
      background: isPos ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
      color: isPos ? '#10b981' : '#ef4444',
      border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
    }}>
      {isPos ? '+' : ''}{pnlPercent}%
    </span>
  );
}

function BattleCard({ battle, compact, focused, isExpanded = false, onToggle = null }) {
  // Beta mode: render coin amounts instead of $ since there is no
  // real money in beta. Player balances and the pot are coin scores.
  const isBeta = useBetaMode();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(battle.remainingMs || 0);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = compact ? isExpanded : internalExpanded;
  // Forward the desired next value to onToggle (instead of a blind
  // invert), so the carousel can set the shared row state explicitly.
  // This avoids a parity bug where, while peers are force-expanded by
  // YouVsCard's active state, clicking "Hide" would flip the underlying
  // preference the wrong way and leak that wrong preference back out
  // when YouVsCard later returned to idle.
  const setExpanded = compact ? (next) => onToggle?.(next) : setInternalExpanded;
  const cardRef = useRef(null);

  useEffect(() => {
    if (!battle.endsAt) return;
    const update = () => {
      const remaining = new Date(battle.endsAt).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [battle.endsAt]);

  useEffect(() => {
    if (!focused || !cardRef.current) return;
    const t = setTimeout(() => {
      try {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
    }, 100);
    return () => clearTimeout(t);
  }, [focused]);

  const user1 = battle.user1 || {};
  const user2 = battle.user2 || {};
  const user1Winning = (user1.balance || 0) > (user2.balance || 0);
  const user2Winning = (user2.balance || 0) > (user1.balance || 0);
  const potSize = parseFloat(battle.potSize) || 0;
  const rawPicks = battle.picks || SIMULATED_PICKS[battle.id] || null;
  const isSimulated = !battle.picks && !!SIMULATED_PICKS[battle.id];
  const bothHavePicks = rawPicks && rawPicks.user1.length > 0 && rawPicks.user2.length > 0;
  const onlyUser1 = rawPicks && rawPicks.user1.length > 0 && rawPicks.user2.length === 0;
  const onlyUser2 = rawPicks && rawPicks.user2.length > 0 && rawPicks.user1.length === 0;
  const picksLocked = !isSimulated && (onlyUser1 || onlyUser2);
  const picks = (isSimulated || bothHavePicks) ? rawPicks : null;

  const user1OnFire = parseFloat(user1.pnlPercent) > 10;
  const user2OnFire = parseFloat(user2.pnlPercent) > 10;

  if (compact) {
    let statusText = 'Awaiting picks from both players...';
    let statusDotColor = '#facc15';
    if (picks) {
      statusText = 'Live · both players locked in';
      statusDotColor = '#10b981';
    } else if (picksLocked) {
      statusText = onlyUser1
        ? `${user1.username || 'Player 1'} locked · awaiting ${user2.username || 'Player 2'}`
        : `${user2.username || 'Player 2'} locked · awaiting ${user1.username || 'Player 1'}`;
      statusDotColor = '#06b6d4';
    }

    return (
      <div
        ref={cardRef}
        className={`bc-surface w-full h-full rounded-xl cursor-pointer flex flex-col ${focused ? 'live-battle-highlight' : ''}`}
        onClick={() => setExpanded(!expanded)}
        style={{
          backgroundColor: '#0d0d0d',
          border: focused
            ? '1px solid rgba(6, 182, 212, 0.5)'
            : (expanded ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(59, 130, 246, 0.18)'),
          boxShadow: 'none',
          overflow: 'hidden',
          transition: 'border-color 200ms ease',
        }}
      >
        <div className="p-1.5 sm:p-2.5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400">
                {isBeta ? `${formatMoney(potSize, 0)} coins` : `$${formatMoney(potSize, 0)}`}
              </span>
              <span className="text-gray-600 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <PlayerAvatar user={user1} isWinning={user1Winning} size={40} bgColor="#1e40af" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1" style={{ color: '#fff' }}>
                  {user1.username || 'Player 1'}
                  {user1OnFire && <MomentumIcon />}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <PnlBadge pnlPercent={user1.pnlPercent} size="small" />
                </div>
              </div>
            </div>
            <div className="px-2 flex flex-col items-center">
              <span
                className="text-xl font-black text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
              >
                VS
              </span>
              <span className="text-gray-600 text-[9px] mt-0.5 uppercase tracking-widest">1v1</span>
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-sm font-medium truncate flex items-center justify-end gap-1" style={{ color: '#fff' }}>
                  {user2OnFire && <MomentumIcon />}
                  {user2.username || 'Player 2'}
                </p>
                <div className="flex items-center gap-2 justify-end mt-0.5">
                  <PnlBadge pnlPercent={user2.pnlPercent} size="small" />
                </div>
              </div>
              <PlayerAvatar user={user2} isWinning={user2Winning} size={40} bgColor="#065f46" />
            </div>
          </div>

          {picks ? (
            <div className="flex gap-1 mb-0.5 sm:mb-1" style={{ minHeight: '24px' }}>
              <div className="flex-1 min-w-0">
                {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
              <span className="text-gray-600 text-[9px] self-center px-0.5">vs</span>
              <div className="flex-1 min-w-0">
                {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
            </div>
          ) : picksLocked ? (
            <div className="mb-0.5 sm:mb-1 flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '24px' }}>
              <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[9px] text-gray-500 truncate">{onlyUser1 ? `${user1.username || 'P1'} locked` : `${user2.username || 'P2'} locked`} · awaiting other</span>
            </div>
          ) : (
            <div className="mb-0.5 sm:mb-1 flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '24px' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
              <span className="text-[9px] text-gray-500">Awaiting picks...</span>
            </div>
          )}

          {(() => {
            // Cartoon info chip row — fills the previously-empty band
            // between the picks pills and the progress bar with the
            // glanceable, animated chips that share their visual
            // language with the YouVsCard. Each chip is rendered only
            // when its underlying data is real, so cards with missing
            // optional fields stay balanced instead of showing
            // placeholder values.
            const chips = [];
            const modeKey = (battle.challengeType || '').toLowerCase();
            const modeMeta = CARTOON_MODE_META[modeKey];
            if (modeMeta) {
              chips.push(
                <CartoonChip
                  key="mode"
                  icon={modeMeta.icon}
                  label={modeMeta.label}
                  color={modeMeta.color}
                  animate="bounce"
                  ariaLabel={`Game mode ${modeMeta.label}`}
                />
              );
            }
            const u1Picks = picks?.user1?.length || 0;
            const u2Picks = picks?.user2?.length || 0;
            if (picks && (u1Picks > 0 || u2Picks > 0)) {
              chips.push(
                <CartoonChip
                  key="piks"
                  icon="🎯"
                  label={`${u1Picks} vs ${u2Picks} piks`}
                  color="blue"
                  animate="bounce"
                  ariaLabel={`${u1Picks} piks for ${user1.username || 'Player 1'} versus ${u2Picks} piks for ${user2.username || 'Player 2'}`}
                />
              );
            }
            if (user1OnFire || user2OnFire) {
              const fireUser = user1OnFire ? user1 : user2;
              const fireName = fireUser.username || (user1OnFire ? 'Player 1' : 'Player 2');
              chips.push(
                <CartoonChip
                  key="fire"
                  icon="🔥"
                  label={`${fireName} hot`}
                  color="orange"
                  animate="wobble"
                  ariaLabel={`${fireName} is on fire`}
                />
              );
            }
            if (chips.length === 0) return null;
            return (
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5 sm:mb-1" style={{ minHeight: 18 }}>
                {chips}
              </div>
            );
          })()}

          <div className="mt-auto pt-0.5 sm:pt-1">
            {(() => {
              const startedAgo = formatStartedAgo(battle.startsAt);
              const u1Record = formatBattleRecord(user1);
              const u2Record = formatBattleRecord(user2);
              const showRecords = u1Record && u2Record;
              const showFallback = !startedAgo && !showRecords;
              return (
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    {startedAgo && (
                      <span className="text-gray-500 text-[10px] truncate">{startedAgo}</span>
                    )}
                    {startedAgo && showRecords && (
                      <span className="text-gray-700 text-[10px]" aria-hidden="true">·</span>
                    )}
                    {showRecords && (
                      <span className="text-gray-500 text-[10px] tabular-nums truncate">
                        {u1Record} vs {u2Record}
                      </span>
                    )}
                    {showFallback && (
                      <span className="text-gray-500 text-[10px] truncate">Live now</span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-blue-400 flex items-center gap-1 flex-shrink-0">
                    {expanded ? 'Hide' : 'Preview'}
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 220ms ease',
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 280ms ease',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                borderTop: '1px solid #1a1a1a',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 220ms ease',
                transitionDelay: expanded ? '120ms' : '0ms',
                cursor: 'default',
              }}
            >
              <div className="px-3.5 pt-3 pb-2 flex items-center gap-1.5">
                <div
                  className={statusDotColor === '#facc15' ? 'pick-pending-dot' : ''}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: statusDotColor, boxShadow: `0 0 6px ${statusDotColor}` }}
                ></div>
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: statusDotColor }}>
                  {statusText}
                </span>
              </div>

              {picks ? (
                /* FanDuel-style tickets — one per player. On mobile we
                   horizontal snap-scroll between the two tickets (swipe,
                   not infinite scroll) so each ticket gets full width;
                   on sm+ desktop they sit side-by-side in a 2-col grid. */
                <div className="px-3.5 pb-3">
                  <div
                    className="flex sm:grid sm:grid-cols-2 gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {[
                      { player: user1, list: picks.user1, accent: '#3b82f6', side: 'left' },
                      { player: user2, list: picks.user2, accent: '#fb923c', side: 'right' },
                    ].map(({ player, list, accent, side }, idx) => {
                      const totalStake = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                      return (
                        <div
                          key={idx}
                          className="snap-center flex-shrink-0 w-[88%] sm:w-auto rounded-xl overflow-hidden flex flex-col"
                          style={{
                            background: '#0a0a0a',
                            border: `2px solid ${accent}`,
                            boxShadow: `3px 3px 0 #000`,
                          }}
                        >
                          <div
                            className="px-2.5 py-1.5 flex items-center justify-between gap-2"
                            style={{ background: `${accent}1a`, borderBottom: `1.5px solid ${accent}` }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                              />
                              <span className="text-[11px] font-black uppercase tracking-wider text-white truncate">
                                {player.username || (side === 'left' ? 'Player 1' : 'Player 2')}
                              </span>
                            </div>
                            <span
                              className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: '#000', color: accent }}
                            >
                              {list.length}-leg
                            </span>
                          </div>
                          <div className="flex-1 px-2 py-1.5 space-y-1">
                            {list.length === 0 ? (
                              <div className="text-[10px] text-gray-600 py-2 text-center">No picks yet</div>
                            ) : (
                              list.map((pick, i) => {
                                const isWon = pick.status === 'won';
                                const isLost = pick.status === 'lost';
                                const statusColor = isWon ? '#10b981' : isLost ? '#ef4444' : '#9ca3af';
                                return (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 px-1.5 py-1 rounded"
                                    style={{ background: '#111', border: '1px solid #1a1a1a' }}
                                  >
                                    <div
                                      className="w-1 h-7 rounded-full flex-shrink-0"
                                      style={{ background: statusColor }}
                                    />
                                    <TeamLogo name={pick.team} sport={pick.sport} size={18} />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-bold text-white truncate leading-tight">
                                        {pick.team}
                                      </div>
                                      <div className="text-[9px] text-gray-500 truncate leading-tight">
                                        {pick.type}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0">
                                      <span
                                        className="text-[10px] font-black tabular-nums leading-tight"
                                        style={{
                                          color:
                                            typeof pick.odds === 'string' && pick.odds.startsWith('+')
                                              ? '#34d399'
                                              : '#e5e7eb',
                                        }}
                                      >
                                        {pick.odds || '—'}
                                      </span>
                                      <span className="text-[9px] text-gray-500 tabular-nums leading-tight">
                                        ${Number(pick.amount || 0).toFixed(0)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div
                            className="px-2.5 py-1.5 flex items-center justify-between"
                            style={{ background: '#000', borderTop: `1px dashed ${accent}` }}
                          >
                            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">
                              Total wagered
                            </span>
                            <span className="text-[12px] font-black text-white tabular-nums">
                              ${totalStake.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Swipe hint dots — mobile only */}
                  <div className="flex sm:hidden justify-center gap-1 mt-1.5">
                    <span className="w-1 h-1 rounded-full" style={{ background: '#3b82f6' }} />
                    <span className="w-1 h-1 rounded-full" style={{ background: '#fb923c' }} />
                  </div>
                </div>
              ) : (
                <div className="px-3.5 pb-3">
                  <div
                    className="rounded-md px-3 py-2 text-[11px] text-gray-400"
                    style={{ background: '#111', border: '1px solid #1a1a1a' }}
                  >
                    Picks reveal once both players lock in their plays.
                  </div>
                </div>
              )}

              <div className="px-3.5 pb-3.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    /* Simulated demo cards have no live spectate page —
                       routing into /battle/spectate/<sim-id> hits the API
                       404 ("Battle not found"). Drop those clicks on the
                       social feed instead so the user always lands
                       somewhere live. Real battles keep the full
                       spectator view (scoreboard, picks, chat). */
                    if (battle.simulated || isSimulated) {
                      router.push(`/battle?battle=${encodeURIComponent(battle.id)}`);
                    } else {
                      router.push(`/battle/spectate/${battle.id}`);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
                  }}
                >
                  {battle.simulated || isSimulated ? 'Open in Social' : 'See More'}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`rounded-xl overflow-hidden w-full h-full flex flex-col ${focused ? 'live-battle-highlight' : ''}`}
      style={{
        backgroundColor: '#0d0d0d',
        border: focused ? '1px solid rgba(6, 182, 212, 0.5)' : `1px solid ${'#1a1a1a'}`,
        boxShadow: 'none',
      }}
    >
      <div className="px-3.5 pt-2.5 pb-2" onClick={() => picks && setExpanded(!expanded)} style={{ cursor: picks ? 'pointer' : 'default' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-gray-400">
              {isBeta ? `${formatMoney(potSize, 0)} coins` : `$${formatMoney(potSize, 0)} pot`}
            </span>
            <span className="text-gray-600 text-[11px]">{formatTimeRemaining(timeLeft)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={40} bgColor="#1e40af" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1" style={{ color: '#fff' }}>
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold tabular-nums" style={{ color: '#fff' }}>
                  {isBeta ? formatMoney(user1.balance || 0, 0) : `$${formatMoney(user1.balance || 0, 0)}`}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <PnlBadge pnlPercent={user1.pnlPercent} />
                {picks ? (
                  <span className="text-gray-500 text-[10px]">
                    {picks.user1.length}P · <span className="text-green-400">{picks.user1.filter(p => p.status === 'won').length}W</span> <span className="text-red-400">{picks.user1.filter(p => p.status === 'lost').length}L</span>
                  </span>
                ) : (
                  <span className="text-gray-600 text-[10px]">0P</span>
                )}
              </div>
            </div>
          </div>

          <div className="px-3 flex flex-col items-center">
            <span className="text-xs font-bold text-gray-600">VS</span>
            <span className="text-gray-600 text-[9px] mt-0.5">
              {picks ? (expanded ? 'Hide' : 'View') : ''}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-sm font-medium truncate flex items-center justify-end gap-1" style={{ color: '#fff' }}>
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <div className="flex items-center gap-2 justify-end mt-0.5">
                <span className="text-sm font-bold tabular-nums" style={{ color: '#fff' }}>
                  {isBeta ? formatMoney(user2.balance || 0, 0) : `$${formatMoney(user2.balance || 0, 0)}`}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-end mt-0.5">
                {picks ? (
                  <span className="text-gray-500 text-[10px]">
                    {picks.user2.length}P · <span className="text-green-400">{picks.user2.filter(p => p.status === 'won').length}W</span> <span className="text-red-400">{picks.user2.filter(p => p.status === 'lost').length}L</span>
                  </span>
                ) : (
                  <span className="text-gray-600 text-[10px]">0P</span>
                )}
                <PnlBadge pnlPercent={user2.pnlPercent} />
              </div>
            </div>
            <PlayerAvatar user={user2} isWinning={user2Winning} size={40} bgColor="#065f46" />
          </div>
        </div>

        {!picks && !picksLocked && (
          <div className="mb-2 flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}` }}>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
              <span className="text-[10px] text-gray-500 font-medium">Awaiting picks from both players...</span>
            </div>
            <span className="text-[9px] text-gray-600">0P vs 0P</span>
          </div>
        )}

        {picksLocked && (
          <div className="mb-2 rounded-lg" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}` }}>
            <div className="flex items-center gap-2 px-3 py-2">
              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[10px] text-gray-500 font-medium">Reveals when both players lock in</span>
            </div>
            <div className="flex gap-2 px-3 pb-2.5">
              <div className="flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-md" style={{ background: onlyUser1 ? 'rgba(16,185,129,0.08)' : ('rgba(255,255,255,0.02)'), border: onlyUser1 ? '1px solid rgba(16,185,129,0.2)' : `1px solid ${'#1a1a1a'}` }}>
                {onlyUser1 ? (
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                ) : (
                  <div className="w-3 h-3 rounded-full border border-gray-600 flex-shrink-0 pick-pending-dot"></div>
                )}
                <span className={`text-[10px] font-medium truncate ${onlyUser1 ? 'text-green-400' : 'text-gray-600'}`}>
                  {user1.username || 'Player 1'} {onlyUser1 ? 'locked' : 'pending'}
                </span>
              </div>
              <span className="text-gray-600 text-[9px] self-center">vs</span>
              <div className="flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-md" style={{ background: onlyUser2 ? 'rgba(16,185,129,0.08)' : ('rgba(255,255,255,0.02)'), border: onlyUser2 ? '1px solid rgba(16,185,129,0.2)' : `1px solid ${'#1a1a1a'}` }}>
                {onlyUser2 ? (
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                ) : (
                  <div className="w-3 h-3 rounded-full border border-gray-600 flex-shrink-0 pick-pending-dot"></div>
                )}
                <span className={`text-[10px] font-medium truncate ${onlyUser2 ? 'text-green-400' : 'text-gray-600'}`}>
                  {user2.username || 'Player 2'} {onlyUser2 ? 'locked' : 'pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        {(() => {
          // Same cartoon info chip row used by the compact homepage
          // BattleCard. Surfacing it here keeps the visual language
          // consistent between the homepage carousel and the full
          // Active Battles page, and gives at-a-glance context (mode,
          // pik counts, momentum) without needing to expand the card.
          // Each chip is rendered only when its underlying data is
          // real, so missing optional fields degrade to nothing
          // instead of placeholder values.
          const chips = [];
          const modeKey = (battle.challengeType || '').toLowerCase();
          const modeMeta = CARTOON_MODE_META[modeKey];
          if (modeMeta) {
            chips.push(
              <CartoonChip
                key="mode"
                icon={modeMeta.icon}
                label={modeMeta.label}
                color={modeMeta.color}
                animate="bounce"
                ariaLabel={`Game mode ${modeMeta.label}`}
              />
            );
          }
          const u1Picks = picks?.user1?.length || 0;
          const u2Picks = picks?.user2?.length || 0;
          if (picks && (u1Picks > 0 || u2Picks > 0)) {
            chips.push(
              <CartoonChip
                key="piks"
                icon="🎯"
                label={`${u1Picks} vs ${u2Picks} piks`}
                color="blue"
                animate="bounce"
                ariaLabel={`${u1Picks} piks for ${user1.username || 'Player 1'} versus ${u2Picks} piks for ${user2.username || 'Player 2'}`}
              />
            );
          }
          if (user1OnFire || user2OnFire) {
            const fireUser = user1OnFire ? user1 : user2;
            const fireName = fireUser.username || (user1OnFire ? 'Player 1' : 'Player 2');
            chips.push(
              <CartoonChip
                key="fire"
                icon="🔥"
                label={`${fireName} hot`}
                color="orange"
                animate="wobble"
                ariaLabel={`${fireName} is on fire`}
              />
            );
          }
          if (chips.length === 0) return null;
          return (
            <div className="flex items-center gap-1.5 flex-wrap mb-2" style={{ minHeight: 22 }}>
              {chips}
            </div>
          );
        })()}

        {(() => {
          const startedAgo = formatStartedAgo(battle.startsAt);
          const u1Record = formatBattleRecord(user1);
          const u2Record = formatBattleRecord(user2);
          const showRecords = u1Record && u2Record;
          const showFallback = !startedAgo && !showRecords;
          return (
            <div className="flex items-center justify-between gap-2 min-w-0 pt-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                {startedAgo && (
                  <span className="text-gray-500 text-[10px] truncate">{startedAgo}</span>
                )}
                {startedAgo && showRecords && (
                  <span className="text-gray-700 text-[10px]" aria-hidden="true">·</span>
                )}
                {showRecords && (
                  <span className="text-gray-500 text-[10px] tabular-nums truncate">
                    {u1Record} vs {u2Record}
                  </span>
                )}
                {showFallback && (
                  <span className="text-gray-500 text-[10px] truncate">Live now</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/battle/spectate/${battle.id}`); }}
                className="text-[11px] font-medium text-blue-400 flex-shrink-0"
              >
                Watch
              </button>
            </div>
          );
        })()}
      </div>

      {expanded && (
        <>
          {picks && (
            <div style={{ borderTop: `1px solid ${'#1a1a1a'}` }}>
              <div className="grid grid-cols-2 relative">
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: '#1a1a1a' }}></div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{user1.username}'s Picks</span>
                  </div>
                  {user1.id && (
                    <div className="mb-2">
                      <MutualFriendsLine
                        userId={user1.id}
                        username={user1.username}
                        size="xs"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {picks.user1.map((pick, i) => (
                      <PickPill key={i} pick={pick} />
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2 justify-end">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{user2.username}'s Picks</span>
                  </div>
                  {user2.id && (
                    <div className="mb-2 flex justify-end">
                      <MutualFriendsLine
                        userId={user2.id}
                        username={user2.username}
                        size="xs"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {picks.user2.map((pick, i) => (
                      <PickPill key={i} pick={pick} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <BattleChat battleId={battle.id} />
        </>
      )}

      <style>{`
        @keyframes liveMomentumPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.3); }
        }
        .live-momentum-flame {
          display: inline-block;
          animation: liveMomentumPulse 1s ease-in-out infinite;
        }
        @keyframes pickPendingPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .pick-pending-dot {
          animation: pickPendingPulse 1.5s ease-in-out infinite;
        }
        @keyframes battleCtaFloat {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-6px); opacity: 0.8; }
        }
        .battle-cta-particle {
          animation: battleCtaFloat 3s ease-in-out infinite;
        }
        @media (hover: hover) {
          .battle-cta-card:hover {
            border-color: rgba(59,130,246,0.45) !important;
            box-shadow: 0 0 24px rgba(59,130,246,0.12), 0 4px 16px rgba(0,0,0,0.3);
          }
        }
        @media (hover: none) {
          .battle-cta-card:active {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}

function formatElapsed(ms) {
  if (!ms || ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const ANONYMOUS_OPPONENTS = [
  { gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
  { gradient: 'linear-gradient(135deg, #f59e0b, #f97316)' },
  { gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { gradient: 'linear-gradient(135deg, #10b981, #f97316)' },
];

function SilhouetteAvatar({ gradient, size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 12.5a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="rgba(255,255,255,0.18)"
        />
      </svg>
    </div>
  );
}

// Defaults for the homepage one-tap matchmaking flow. Picked as the
// smallest available buy-in and the fastest mode so a first-time tap on
// the graffiti "PLAY NOW" sticker drops the user into the lightest
// commit path. Power users can change the buy-in / mode from the chips
// rendered on the card itself, and that choice is remembered between
// visits so the next tap goes straight to their preferred default. The
// QuickMatchModal still drives any other entry point with its own
// config screen.
const ONE_TAP_DEFAULT_BUY_IN = 5;
const ONE_TAP_DEFAULT_GAME_MODE = 'rush';
// `coins` mirrors the per-mode starting bankroll surfaced in
// QuickMatchModal. Used to render the "X coins to start" context
// inside the idle metaRight string. Keep in sync with
// QuickMatchModal's GAME_MODE_OPTIONS.
const ONE_TAP_GAME_MODE_OPTIONS = [
  { id: 'rush', label: 'Rush', icon: '⚡', coins: 10000 },
  { id: 'original', label: 'Original', icon: '🏆', coins: 10000 },
  { id: 'tournament', label: 'Tournament', icon: '👑', coins: 100000 },
];
// Persisted defaults for the one-tap card live in `utils/oneTapPrefs`,
// which keeps a localStorage cache for instant render and — for signed-in
// users — mirrors the value to their profile so it follows them across
// devices. Signed-out users keep the original localStorage-only behaviour.

// The localStorage key + version that gate the "Don't ask again"
// preference on the homepage Play Now card live in
// `lib/playNowConfirm.js` so the Settings page can let users flip
// the spend warning back on without us duplicating the contract.
// Bumping PLAY_NOW_SKIP_CONFIRM_VERSION there will re-prompt every
// existing user the next time they tap Play Now — honouring the
// spec's "any user the first time after a deploy" line whenever
// product changes the matchmaking buy-in, mode, or anything else
// worth re-confirming.

function YouVsCard({
  youVsState,
  onClick,
  isExpanded = false,
  onToggle = null,
  onMatchFound = null,
  currentUserId = null,
  balance = null,
  // Friends list, remembered last buy-in, and full current-user profile
  // are forwarded from the home page so the in-card "Choose Battle Mode"
  // chooser can mount the Play Friend / Private Match modals directly
  // (no `/battle?openPlayFriend=1` page jump). Pages that don't pass these
  // (e.g. the legacy /battle full-list view) fall back to the previous
  // router.push hand-off via `legacyChooserHandoff` below.
  friends = null,
  lastBuyIn = null,
  currentUser = null,
  onPlayFriendInviteSent = null,
  onPlayFriendInviteCancelled = null,
  onPrivateMatchJoined = null,
}) {
  const router = useRouter();
  const { refresh: refreshMatchup } = useMatchup();
  const [cancelling, setCancelling] = useState(false);
  // Cartoon overview popup for the user's own active battle. Tapping
  // "View Battle" on a card you're already in opens this instead of
  // routing straight to /battle so users see a confirmation overview
  // (mode, opponent, pot, "ends after today") before committing.
  const [showMyBattleOverview, setShowMyBattleOverview] = useState(false);
  // Beta lockdown: in beta there's no buy-in and only ORIGINAL is
  // playable, so the meta line drops the "$X" segment and we steer
  // matchmaking to original regardless of remembered prefs.
  const isBeta = useBetaMode();
  const status = youVsState?.status || 'idle';
  const myProfile = youVsState?.myProfile || null;
  const opponent = youVsState?.opponent || null;
  const matchup = youVsState?.matchup || null;
  const queueEntry = youVsState?.queueEntry || null;
  const initialTimeRemaining = youVsState?.timeRemaining ?? null;
  // Per-player balance + PnL forwarded from MatchupContext via the
  // homepage. Used by the active-state slim layout to render the
  // info-dense balance row that the old hero-arena display used to
  // carry (shown on desktop only — the mobile carousel keeps the
  // ultra-slim username-only header to match sibling cards).
  const youVsMyBalance = youVsState?.myBalance ?? null;
  const youVsOppBalance = youVsState?.opponentBalance ?? null;
  const youVsMyLiveBalance = youVsState?.myLiveBalance ?? null;
  const youVsOppLiveBalance = youVsState?.opponentLiveBalance ?? null;
  const youVsMyUnrealizedPnl = youVsState?.myUnrealizedPnl ?? null;
  const youVsOppUnrealizedPnl = youVsState?.opponentUnrealizedPnl ?? null;

  // One-tap matchmaking preferences. Seeded with the safe lightweight
  // defaults, then hydrated from localStorage on mount so a returning
  // visitor's preferred buy-in / mode is what their first tap fires.
  // Hydrating in an effect (rather than the initial state) keeps the
  // server-rendered markup deterministic and avoids hydration mismatch.
  // For signed-in users we additionally fetch the server-stored value
  // on mount and apply it on top of the local cache so the choice
  // follows them across devices, browsers, and reinstalls. Local
  // writes still happen synchronously for instant UI feedback (and so
  // signed-out users keep the original behaviour); the server write is
  // a fire-and-forget mirror.
  const [buyIn, setBuyIn] = useState(ONE_TAP_DEFAULT_BUY_IN);
  const [gameMode, setGameMode] = useState(ONE_TAP_DEFAULT_GAME_MODE);
  // Latest-prefs ref that's hydrated synchronously the very first time
  // it's read — guards against the edge case where a returning visitor
  // taps the card before our hydration effect has had a chance to run,
  // which would otherwise fire matchmaking with the stale defaults.
  const prefsRef = useRef(null);
  const ensurePrefsHydrated = useCallback(() => {
    if (prefsRef.current) return prefsRef.current;
    const stored = readLocalOneTapPrefs();
    const next = {
      buyIn: stored?.buyIn ?? ONE_TAP_DEFAULT_BUY_IN,
      gameMode: stored?.gameMode ?? ONE_TAP_DEFAULT_GAME_MODE,
    };
    prefsRef.current = next;
    return next;
  }, []);
  useEffect(() => {
    const prefs = ensurePrefsHydrated();
    setBuyIn(prefs.buyIn);
    setGameMode(prefs.gameMode);
  }, [ensurePrefsHydrated]);
  useEffect(() => {
    prefsRef.current = { buyIn, gameMode };
  }, [buyIn, gameMode]);

  // Pull the server-stored value once we know who's signed in, then
  // apply it on top of whatever the local cache rendered with. We
  // intentionally let the server value win (it's the cross-device
  // source of truth) but only when it's a valid normalized payload —
  // a missing column or transient error keeps the local-first state
  // we already showed.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    fetchOneTapPrefs().then((prefs) => {
      if (cancelled || !prefs) return;
      if (prefs.buyIn != null) setBuyIn(prefs.buyIn);
      if (prefs.gameMode != null) setGameMode(prefs.gameMode);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const persistPrefs = useCallback((nextBuyIn, nextMode) => {
    // Always write the local cache (so guests still benefit) and, for
    // signed-in users, mirror to the profile API. We don't await — a
    // chip tap should feel instant; the network write is a quiet
    // background sync.
    writeLocalOneTapPrefs(nextBuyIn, nextMode);
    if (currentUserId) {
      saveOneTapPrefs({ buyIn: nextBuyIn, gameMode: nextMode, isSignedIn: true });
    }
  }, [currentUserId]);

  const handleSelectBuyIn = useCallback((next) => {
    setBuyIn(next);
    setGameMode((currentMode) => {
      persistPrefs(next, currentMode);
      return currentMode;
    });
  }, [persistPrefs]);
  const handleSelectGameMode = useCallback((next) => {
    setGameMode(next);
    setBuyIn((currentBuyIn) => {
      persistPrefs(currentBuyIn, next);
      return currentBuyIn;
    });
  }, [persistPrefs]);
  const selectedGameMode = ONE_TAP_GAME_MODE_OPTIONS.find((m) => m.id === gameMode)
    || ONE_TAP_GAME_MODE_OPTIONS[0];

  const isActive = status === 'active';
  const isWaiting = status === 'waiting';
  const isQueued = status === 'queued';
  const showOpponent = !!opponent && (isActive || isWaiting || isQueued);
  const isIdle = !isActive && !isWaiting && !isQueued;

  // In-card matchmaking state. Drives the new "finding battle" animation
  // that plays inside the card before the standard match-found popup
  // takes over. `idle` means we're showing the graffiti PLAY NOW
  // treatment; `searching` means we're polling for a match; `error`
  // shows a brief inline message before snapping back to idle. The
  // pre-match buy-in / game-mode / confirm config now lives in the
  // separate `PreMatchPopup` (see `showPrePopup` below) instead of an
  // inline confirm step on the card itself.
  const [searchState, setSearchState] = useState('idle');
  const [searchError, setSearchError] = useState('');
  const [searchTimer, setSearchTimer] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
  // Stepped pre-match popup. Opens when the user picks Quick Match
  // (either by tapping Play Now and choosing Quick Match in the
  // chooser, or by tapping Play Now when they've already picked a
  // default mode but haven't opted out of the confirm gate). Closing
  // it without confirming returns to idle without firing any API.
  const [showPrePopup, setShowPrePopup] = useState(false);
  // Inline "Choose Battle Mode" chooser. Mirrors the chooser opened
  // by the Start a Battle button on /battle so the home card surfaces
  // the same Quick Match / Challenge Friend / Private Match options
  // instead of jumping straight into a Quick Match search.
  const [showChooser, setShowChooser] = useState(false);

  // Listen for a global "open battle chooser" request so promo tiles and
  // other dashboard CTAs can summon the same chooser this card already
  // owns instead of routing the user to /battle (Social) and stranding
  // them there after the modal closes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (!myProfile?.id) return;
      setShowChooser(true);
      try { window.dispatchEvent(new CustomEvent('piks:battle-chooser-opened')); } catch {}
    };
    window.addEventListener('piks:open-battle-chooser', handler);
    return () => window.removeEventListener('piks:open-battle-chooser', handler);
  }, [myProfile?.id]);
  // In-card Quick Match modal. Mirrors the QuickMatchModal opened
  // from the /battle page so picking Quick Match here surfaces the
  // full buy-in / mode picker instead of jumping straight to the
  // queue with the user's persisted defaults.
  const [showQuickMatchModal, setShowQuickMatchModal] = useState(false);
  // In-card Play Friend / Private Match modals. When the home page
  // wires up the `friends` / `currentUser` props the chooser opens
  // these directly so the user never leaves the home page; the
  // legacy hand-off (router.push to `/battle?openPlayFriend=1`)
  // remains for callers that don't supply that data.
  const [showPlayFriend, setShowPlayFriend] = useState(false);
  const [showPrivateMatch, setShowPrivateMatch] = useState(false);
  // Whether this card has the data it needs to mount the in-card
  // Play Friend / Private Match modals. We don't gate on `friends`
  // length (a brand-new user with zero friends still gets the Find
  // Players tab inside the modal) — only on the prop being passed at
  // all, so the legacy /battle full-list usage stays on the old
  // router.push path.
  const canMountChooserModals = Array.isArray(friends) && !!currentUser;
  const matchmakingCancelledRef = useRef(false);
  const cancelNoticeTimerRef = useRef(null);
  const searchTimerIntervalRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const errorResetTimeoutRef = useRef(null);

  const cleanupSearchTimers = useCallback(() => {
    if (searchTimerIntervalRef.current) {
      clearInterval(searchTimerIntervalRef.current);
      searchTimerIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      matchmakingCancelledRef.current = true;
      cleanupSearchTimers();
      if (errorResetTimeoutRef.current) {
        clearTimeout(errorResetTimeoutRef.current);
        errorResetTimeoutRef.current = null;
      }
      if (cancelNoticeTimerRef.current) {
        clearTimeout(cancelNoticeTimerRef.current);
        cancelNoticeTimerRef.current = null;
      }
    };
  }, [cleanupSearchTimers]);

  // Cycle the shuffling silhouette in the in-card search animation.
  // Only runs while we're actively searching, and bows out under
  // reduced-motion to keep the visual static.
  useEffect(() => {
    if (searchState !== 'searching') return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const id = setInterval(() => setShuffleTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, [searchState]);

  // If the global matchup status flips to active/waiting/queued while
  // we were mid-search (e.g. the queue resolved server-side and the
  // SSE refresh beat our poll), drop the in-card search UI so we don't
  // show two competing states at once.
  useEffect(() => {
    if (!isIdle && searchState !== 'idle') {
      matchmakingCancelledRef.current = true;
      cleanupSearchTimers();
      setSearchState('idle');
      setSearchError('');
    }
    if (!isIdle && showPrePopup) {
      // Likewise close the pre-match popup if a battle resolves while
      // it's still on screen — the user has nothing meaningful to
      // confirm anymore.
      setShowPrePopup(false);
    }
  }, [isIdle, searchState, showPrePopup, cleanupSearchTimers]);

  // Cycling silhouette gradient for queued / waiting-without-opponent
  // states. The idle state no longer cycles fake opponents — that
  // treatment was replaced by the graffiti PLAY NOW visual — but the
  // existing active / waiting / queued layouts still rely on this.
  const [opponentTick, setOpponentTick] = useState(0);
  useEffect(() => {
    if (showOpponent) return;
    if (isIdle) return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const id = setInterval(() => setOpponentTick((t) => t + 1), 1800);
    return () => clearInterval(id);
  }, [showOpponent, isIdle]);
  const anonymousOpponent = !showOpponent
    ? ANONYMOUS_OPPONENTS[opponentTick % ANONYMOUS_OPPONENTS.length]
    : null;

  const endsAt = matchup?.endsAt || null;
  const startsAt = matchup?.startsAt || matchup?.createdAt || null;
  const queuedAt = queueEntry?.queuedAt || queueEntry?.createdAt || null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive && !isWaiting && !isQueued) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActive, isWaiting, isQueued]);

  let timeLeftMs = 0;
  if (isActive && endsAt) {
    timeLeftMs = Math.max(0, new Date(endsAt).getTime() - now);
  } else if (initialTimeRemaining != null && isActive) {
    timeLeftMs = Math.max(0, initialTimeRemaining);
  }

  const QUEUE_MAX_MS = 10 * 60 * 1000;
  const LOBBY_MAX_MS = 10 * 60 * 1000;

  let progressPercent = 0;
  if (isActive && startsAt && endsAt) {
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    const total = endMs - startMs;
    if (total > 0) {
      progressPercent = Math.max(0, Math.min(100, ((now - startMs) / total) * 100));
    }
  } else if (isWaiting) {
    if (startsAt) {
      const age = Math.max(0, now - new Date(startsAt).getTime());
      progressPercent = Math.max(5, Math.min(100, (age / LOBBY_MAX_MS) * 100));
    } else {
      progressPercent = 10;
    }
  } else if (isQueued) {
    if (queuedAt) {
      const age = Math.max(0, now - new Date(queuedAt).getTime());
      progressPercent = Math.max(5, Math.min(100, (age / QUEUE_MAX_MS) * 100));
    } else {
      progressPercent = 10;
    }
  } else {
    progressPercent = 15;
  }

  let pot = null;
  if (matchup) {
    const ps = parseFloat(matchup.potSize);
    if (Number.isFinite(ps) && ps > 0) {
      pot = ps;
    } else {
      const sb = parseFloat(matchup.startingBalance);
      if (Number.isFinite(sb) && sb > 0) pot = sb * 2;
    }
  } else if (queueEntry) {
    const bi = parseFloat(queueEntry.buyIn);
    if (Number.isFinite(bi) && bi > 0) pot = bi * 2;
  }

  // Balance comes in from the homepage so we don't refetch just to
  // render the confirm step. Treat any non-finite value (signed-out,
  // not yet hydrated) as "unknown" — in that case we render no
  // balance row at all and keep the original confirm CTA.
  const numericBalance = balance != null && Number.isFinite(Number(balance)) ? Number(balance) : null;
  const hasBalance = numericBalance != null;
  const insufficientBalance = hasBalance && numericBalance < buyIn;
  const balanceShortfall = insufficientBalance ? Math.max(0, buyIn - numericBalance) : 0;

  let topLabel = 'Play Now';
  let topDotColor = '#fbbf24';
  let ctaText = 'Tap to Start a 1v1';
  let metaRight = isBeta
    ? `1v1 · ORIGINAL · 10K coins`
    : `1v1 · $${buyIn} · ${selectedGameMode.label}`;
  let progressLabel = 'Tap to start a 1v1';

  if (searchState === 'searching') {
    topLabel = 'Searching…';
    topDotColor = '#06b6d4';
    metaRight = `${searchTimer}s`;
  } else if (isActive) {
    topLabel = 'In Battle';
    topDotColor = '#10b981';
    ctaText = 'View Battle';
    // The pot is now rendered as a focal "prize plate" inside the
    // hero composition below, so the top meta line carries only the
    // time remaining (kept here so the spec's "time remaining stays
    // present in roughly the same location" requirement is met).
    // All ORIGINAL battles end at the end of the day, so a literal
    // "23h 58m" countdown was misleading (it implied the match was a
    // rolling 24h timer). Surface the real rule instead.
    metaRight = timeLeftMs > 0 ? 'Ends after today' : 'Live now';
    progressLabel = `${progressPercent.toFixed(0)}% complete`;
  } else if (isWaiting) {
    topLabel = 'Waiting';
    topDotColor = '#f59e0b';
    ctaText = 'Open Lobby';
    const lobbyAge = startsAt ? Math.max(0, now - new Date(startsAt).getTime()) : 0;
    // Beta has no real money — show coin pot instead of $ amount.
    const potLabel = pot != null
      ? (isBeta ? `${formatMoney(pot, 0)} coins` : `$${formatMoney(pot, 0)}`)
      : null;
    if (potLabel && lobbyAge > 0) {
      metaRight = `${potLabel} · ${formatElapsed(lobbyAge)}`;
    } else if (potLabel) {
      metaRight = `${potLabel} pot`;
    } else {
      metaRight = 'Awaiting opponent';
    }
    progressLabel = lobbyAge > 0 ? `Lobby open ${formatElapsed(lobbyAge)}` : 'Lobby ready';
  } else if (isQueued) {
    topLabel = 'Searching';
    topDotColor = '#06b6d4';
    ctaText = 'View Queue';
    const queueAge = queuedAt ? Math.max(0, now - new Date(queuedAt).getTime()) : 0;
    const queuePotLabel = pot != null
      ? (isBeta ? `${formatMoney(pot, 0)} coins` : `$${formatMoney(pot, 0)}`)
      : null;
    if (queuePotLabel && queueAge > 0) {
      metaRight = `${queuePotLabel} · ${formatElapsed(queueAge)}`;
    } else if (queueAge > 0) {
      metaRight = `Searching ${formatElapsed(queueAge)}`;
    } else {
      metaRight = 'Matchmaking…';
    }
    progressLabel = queueAge > 0 ? `In queue ${formatElapsed(queueAge)}` : 'Looking for opponent';
  }

  const youUser = myProfile
    ? { id: myProfile.id, username: myProfile.username || 'You', avatar: myProfile.avatar }
    : { id: null, username: 'You', avatar: null };

  const handleNavigate = () => {
    // If the user is tapping into their OWN active matchup, surface the
    // cartoon overview popup first (mode/opponent/pot/ends-after-today)
    // so they get a beat of confirmation instead of an instant route.
    // The popup's primary CTA still routes via navigateToBattleStart.
    if (status === 'active' && matchup?.id) {
      setShowMyBattleOverview(true);
      return;
    }
    if (onClick) onClick();
    else router.push('/battle');
  };

  const handleOverviewOpenBattle = useCallback((m) => {
    const target = m || matchup;
    if (target) navigateToBattleStart(router, target);
    else if (onClick) onClick();
    else router.push('/battle');
  }, [matchup, onClick, router]);

  const handleOverviewForfeit = useCallback(async (m) => {
    const id = (m && m.id) || matchup?.id;
    if (!id) return;
    try {
      const res = await fetch('/api/battles/forfeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchupId: id }),
      });
      if (res.ok) {
        try { await refreshMatchup(); } catch {}
      }
    } catch {}
  }, [matchup, refreshMatchup]);

  const handleOverviewMessage = useCallback((opp) => {
    const peerId = (opp && opp.id) || opponent?.id;
    if (peerId) router.push(`/messenger?chat=${peerId}`);
    else router.push('/messenger');
  }, [opponent, router]);

  const handleOverviewViewUpdates = useCallback(() => {
    router.push('/notifications');
  }, [router]);

  const handleSearchError = useCallback((message) => {
    cleanupSearchTimers();
    setSearchError(message);
    setSearchState('error');
    if (errorResetTimeoutRef.current) clearTimeout(errorResetTimeoutRef.current);
    errorResetTimeoutRef.current = setTimeout(() => {
      setSearchState('idle');
      setSearchError('');
      errorResetTimeoutRef.current = null;
    }, 4000);
  }, [cleanupSearchTimers]);

  const handleInCardMatchFound = useCallback((opp, foundMatchup) => {
    cleanupSearchTimers();
    matchmakingCancelledRef.current = true;
    setSearchState('idle');
    setSearchError('');
    setSearchTimer(0);
    if (onMatchFound) {
      // Pull from the prefs ref so the hand-off carries the same
      // buy-in / mode the matchmaking POST was actually fired with —
      // even on a very-fast first tap that beat the hydration effect.
      const activePrefs = ensurePrefsHydrated();
      onMatchFound({
        opponent: opp || null,
        matchup: foundMatchup,
        buyIn: activePrefs.buyIn,
        gameMode: activePrefs.gameMode,
      });
    }
    try { refreshMatchup(); } catch {}
  }, [ensurePrefsHydrated, cleanupSearchTimers, onMatchFound, refreshMatchup]);

  const pollForInCardMatch = useCallback(() => {
    let attempts = 0;
    const poll = async () => {
      if (matchmakingCancelledRef.current) return;
      attempts += 1;
      try {
        const res = await fetch('/api/matchups/current');
        if (matchmakingCancelledRef.current) return;
        if (res.ok) {
          const data = await res.json();
          if ((data.status === 'active' || data.status === 'matched') && data.matchup) {
            handleInCardMatchFound(data.opponent, data.matchup);
            return;
          }
        }
      } catch {}

      if (matchmakingCancelledRef.current) return;

      if (attempts < 16) {
        pollTimeoutRef.current = setTimeout(poll, 2000);
      } else {
        // Same fallback the modal uses today: after 16 polls (~32s of
        // searching + the initial request), reach for a synthetic
        // opponent so the user always lands somewhere instead of
        // bouncing back to idle empty-handed.
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myProfile?.id }),
          });
          if (matchmakingCancelledRef.current) return;
          if (fakeRes.ok) {
            const fakeData = await fakeRes.json();
            if (fakeData?.matchup) {
              handleInCardMatchFound(fakeData.opponent, fakeData.matchup);
              return;
            }
          }
          handleSearchError('No one\'s around right now. Try again.');
        } catch {
          if (matchmakingCancelledRef.current) return;
          handleSearchError('No one\'s around right now. Try again.');
        }
      }
    };
    pollTimeoutRef.current = setTimeout(poll, 2000);
  }, [handleInCardMatchFound, handleSearchError, myProfile?.id]);

  const startInCardSearch = useCallback(async () => {
    matchmakingCancelledRef.current = false;
    setSearchState('searching');
    setSearchError('');
    setSearchTimer(0);
    cleanupSearchTimers();
    searchTimerIntervalRef.current = setInterval(() => {
      setSearchTimer((t) => t + 1);
    }, 1000);
    // Read prefs through the ref so a returning visitor who taps before
    // the hydration effect lands still gets their persisted defaults.
    const activePrefs = ensurePrefsHydrated();
    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn: activePrefs.buyIn, gameMode: activePrefs.gameMode }),
      });
      if (matchmakingCancelledRef.current) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        handleSearchError(data.error || 'Couldn\'t start matchmaking. Try again.');
        return;
      }
      const data = await res.json();
      if (matchmakingCancelledRef.current) return;
      if (data.matched && data.matchup) {
        handleInCardMatchFound(data.opponent, data.matchup);
      } else {
        pollForInCardMatch();
      }
    } catch {
      if (matchmakingCancelledRef.current) return;
      handleSearchError('Couldn\'t reach matchmaking. Try again.');
    }
  }, [ensurePrefsHydrated, cleanupSearchTimers, handleInCardMatchFound, handleSearchError, pollForInCardMatch]);

  const cancelInCardSearch = useCallback(async () => {
    matchmakingCancelledRef.current = true;
    cleanupSearchTimers();
    setSearchState('idle');
    // Brief inline confirmation that the user actually cancelled —
    // matches the spec's "returns smoothly to idle with a brief inline
    // message" requirement for both failure and cancellation paths.
    setSearchError('Matchmaking cancelled.');
    setSearchTimer(0);
    if (cancelNoticeTimerRef.current) clearTimeout(cancelNoticeTimerRef.current);
    cancelNoticeTimerRef.current = setTimeout(() => {
      setSearchError((prev) => (prev === 'Matchmaking cancelled.' ? '' : prev));
    }, 2500);
    try {
      await fetch('/api/battles/matchmaking', { method: 'DELETE' });
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    try { refreshMatchup(); } catch {}
  }, [cleanupSearchTimers, refreshMatchup]);

  // Read the persisted "Don't ask again" preference. We read from
  // storage on demand (rather than caching in state) so the flag
  // stays accurate across tab/storage updates without needing an
  // explicit listener.
  const shouldSkipConfirm = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      // Match against the current version so users only skip the
      // confirm when they previously opted out under the same
      // version. Bumping PLAY_NOW_SKIP_CONFIRM_VERSION re-prompts
      // everyone on their next tap after a deploy.
      return window.localStorage.getItem(PLAY_NOW_SKIP_CONFIRM_KEY) === PLAY_NOW_SKIP_CONFIRM_VERSION;
    } catch {
      return false;
    }
  }, []);

  // Open the stepped pre-match popup. The popup itself is responsible
  // for the buy-in / mode / confirm flow; on confirm it calls back into
  // `handlePopupConfirm` below to actually fire matchmaking. Closing
  // the popup without confirming is a no-op (no API calls).
  const openPrePopup = useCallback(() => {
    setSearchError('');
    setShowPrePopup(true);
  }, []);

  // Pre-match popup confirmed. Apply the user's selections (the popup
  // already persisted them via the same path the inline confirm step
  // used) and kick off the in-card search.
  const handlePopupConfirm = useCallback(({ buyIn: nextBuyIn, gameMode: nextMode }) => {
    setShowPrePopup(false);
    if (typeof nextBuyIn === 'number') setBuyIn(nextBuyIn);
    if (typeof nextMode === 'string') setGameMode(nextMode);
    // Update the prefs ref synchronously so the matchmaking POST
    // fired immediately below picks up the just-confirmed values
    // without waiting for React state to flush.
    prefsRef.current = {
      buyIn: typeof nextBuyIn === 'number' ? nextBuyIn : buyIn,
      gameMode: typeof nextMode === 'string' ? nextMode : gameMode,
    };
    startInCardSearch();
  }, [buyIn, gameMode, startInCardSearch]);

  const handleCardTap = () => {
    if (isIdle) {
      // While searching, the card is "busy" — only the explicit cancel
      // affordance should escape, never the card-wide tap.
      if (searchState === 'searching') return;
      // The pre-match popup is mounted as a portal-style overlay. If
      // it's already open the card tap is meaningless (the popup
      // captures clicks); guard anyway so a stray bubble can't fire
      // matchmaking twice.
      if (showPrePopup) return;
      // Clear any lingering cancel/error inline notice from the
      // previous attempt so the new search starts visually clean.
      if (cancelNoticeTimerRef.current) {
        clearTimeout(cancelNoticeTimerRef.current);
        cancelNoticeTimerRef.current = null;
      }
      setSearchError('');
      // PLAY NOW always opens the shared Battle Mode Chooser so the
      // entry point matches the Start a Battle button on /battle —
      // Quick Match, Challenge Friend, and Private Match are all
      // surfaced before any mode-specific popup runs. The chooser's
      // Quick Match handler still respects the user's "Don't ask me
      // again" preference, so the in-popup shortcut continues to
      // work once they're inside that branch. Signed-out users hit
      // the existing auth gate by routing to /battle?openChooser=1,
      // where the page's requireAuth wrapper triggers the sign-in
      // popup first and then opens the same chooser.
      if (myProfile?.id && onMatchFound) {
        haptic.tap();
        setShowChooser(true);
      } else {
        haptic.tap();
        router.push('/battle?openChooser=1');
      }
      return;
    }
    if (onToggle) onToggle();
    else handleNavigate();
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardTap();
    }
  };

  const canCancel = (isWaiting || isQueued) && !cancelling;

  const handleCancel = async (e) => {
    e.stopPropagation();
    if (!canCancel) return;
    if (typeof window !== 'undefined' && !window.confirm(isQueued ? 'Leave the queue?' : 'Cancel this lobby?')) {
      return;
    }
    setCancelling(true);
    try {
      if (isQueued) {
        await fetch('/api/battles/cancel-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queueEntry?.id ? { queueId: queueEntry.id } : {}),
        });
      } else {
        await fetch('/api/battles/private', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel' }),
        });
      }
      try { await refreshMatchup(); } catch {}
    } catch {
      // swallow; UI will recover on next refresh
    } finally {
      setCancelling(false);
    }
  };

  let expandedHeadline = 'Ready for a 1v1 battle?';
  let expandedBody = 'Start a private match or join the queue to find a real opponent in seconds.';
  if (isActive) {
    expandedHeadline = 'You\'re live in a battle';
    expandedBody = opponent?.username
      ? `Battling ${opponent.username}. Open the battle for picks, chat, and the live scoreboard.`
      : 'Open the battle for picks, chat, and the live scoreboard.';
  } else if (isWaiting) {
    expandedHeadline = 'Lobby is open · waiting for opponent';
    expandedBody = 'Share your lobby link or wait for someone to join. You can cancel anytime.';
  } else if (isQueued) {
    expandedHeadline = 'Searching the queue';
    expandedBody = 'Matchmaking is finding a player at your buy-in. You can leave the queue anytime.';
  }

  // Quick Match pick from the inline chooser. Mounts the same
  // QuickMatchModal that the /battle page's Start a Battle button
  // opens, so the user always sees the full buy-in / mode picker
  // before entering the queue (instead of being dropped straight
  // into matchmaking with persisted defaults).
  const handleChooserQuickMatch = () => {
    setShowChooser(false);
    setShowQuickMatchModal(true);
  };

  // Challenge Friend / Private Match picks. When the home page wires
  // up the in-card data (friends + currentUser), open the matching
  // modal directly so the entire chooser experience stays on the
  // home page. Otherwise fall back to the legacy router hand-off so
  // callers that don't provide that data (and the existing
  // `?openPlayFriend=1` / `?openPrivateMatch=1` deep-link entry on
  // /battle) keep working.
  const handleChooserChallengeFriend = () => {
    setShowChooser(false);
    if (canMountChooserModals) {
      setShowPlayFriend(true);
    } else {
      router.push('/battle?openPlayFriend=1');
    }
  };

  const handleChooserPrivateMatch = () => {
    setShowChooser(false);
    if (canMountChooserModals) {
      setShowPrivateMatch(true);
    } else {
      router.push('/battle?openPrivateMatch=1');
    }
  };

  return (
    <>
    <div
      className="youvs-card rounded-xl overflow-hidden cursor-pointer w-full h-full flex flex-col relative"
      onClick={handleCardTap}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={
        isIdle
          ? (searchState === 'searching'
              ? 'Your battle — Finding your battle. Use the cancel button to stop.'
              : 'Your battle — Tap to start a 1v1')
          : `Your battle — ${topLabel}. Tap to ${isExpanded ? 'hide' : 'show'} preview.`
      }
      aria-expanded={isIdle ? undefined : isExpanded}
      style={{
        background:
          'linear-gradient(180deg, rgba(16,185,129,0.14) 0%, rgba(6,182,212,0.08) 45%, rgba(13,13,13,0.95) 100%), #0d0d0d',
        border: isExpanded
          ? '1.5px solid rgba(52, 211, 153, 0.85)'
          : '1.5px solid rgba(16, 185, 129, 0.6)',
        boxShadow:
          '0 0 0 1px rgba(16,185,129,0.15) inset, 0 0 18px rgba(16,185,129,0.28), 0 0 32px rgba(6,182,212,0.12)',
        transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease-out, border-color 180ms ease-out',
        outline: 'none',
        willChange: 'transform',
      }}
    >
      <style jsx>{`
        @keyframes youvsAnonFade {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        :global(.youvs-anon-fade) {
          animation: youvsAnonFade 420ms ease-out both;
        }
        @keyframes tapToStartPulse {
          0%, 100% { opacity: 0.55; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(2px); }
        }
        .tap-to-start-cta {
          animation: tapToStartPulse 1.6s ease-in-out infinite;
        }
        /* Graffiti PLAY NOW sticker — bouncy scale + slight wobble so
           the idle card visibly reads as a play-now button. */
        @keyframes youvsPlayBounce {
          0%, 100% { transform: rotate(-3deg) scale(1); }
          45% { transform: rotate(-1deg) scale(1.05); }
          55% { transform: rotate(-2deg) scale(1.04); }
        }
        @keyframes youvsTagWobble {
          0%, 100% { transform: rotate(8deg) translateY(0); }
          50% { transform: rotate(10deg) translateY(-2px); }
        }
        @keyframes youvsSparkPop {
          0%, 100% { opacity: 0.55; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes youvsMotionDash {
          0% { stroke-dashoffset: 24; opacity: 0.25; }
          50% { opacity: 0.85; }
          100% { stroke-dashoffset: 0; opacity: 0.25; }
        }
        :global(.youvs-play-sticker) {
          animation: youvsPlayBounce 2.4s ease-in-out infinite;
          transform-origin: center;
        }
        :global(.youvs-tag) {
          animation: youvsTagWobble 2.6s ease-in-out infinite;
          transform-origin: center;
        }
        :global(.youvs-spark) {
          animation: youvsSparkPop 1.8s ease-in-out infinite;
        }
        :global(.youvs-motion-line) {
          stroke-dasharray: 24;
          animation: youvsMotionDash 1.6s linear infinite;
        }
        /* In-card "finding battle" state. Radar sweep + concentric
           pulse rings + a swapping silhouette + dot ellipsis make the
           card feel alive while matchmaking runs in the background. */
        @keyframes youvsRadarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes youvsRingPulse {
          0% { transform: scale(0.6); opacity: 0.55; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes youvsShufflePop {
          0% { opacity: 0; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.85; transform: scale(1); }
        }
        @keyframes youvsDotsPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        /* Pulse on the "Tap to confirm" button so the confirmation
           gate visibly invites a second tap without blending into
           the rest of the card chrome. */
        @keyframes playNowConfirmPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(251,146,60,0.5); }
          50% { transform: scale(1.04); box-shadow: 0 3px 0 rgba(0,0,0,0.55), 0 0 26px rgba(251,146,60,0.85); }
        }
        :global(.play-now-confirm-btn) {
          animation: playNowConfirmPulse 1.4s ease-in-out infinite;
          transform-origin: center;
        }
        :global(.youvs-radar) {
          animation: youvsRadarSweep 2.2s linear infinite;
          transform-origin: center;
        }
        :global(.youvs-ring) {
          animation: youvsRingPulse 1.8s ease-out infinite;
        }
        :global(.youvs-shuffle) {
          animation: youvsShufflePop 0.6s ease-out both;
        }
        /* On mobile the radar ring is shrunk to 56px square (vs 96px
           on tablet+); scale the silhouette avatar inside to match so
           it doesn't overflow the smaller ring. */
        :global(.youvs-shuffle-scale) {
          transform: scale(0.6);
          transform-origin: center;
        }
        @media (min-width: 640px) {
          :global(.youvs-shuffle-scale) {
            transform: none;
          }
        }
        :global(.youvs-dot) {
          animation: youvsDotsPulse 1.2s ease-in-out infinite;
        }
        /* Mortal Kombat-style hero treatment for the active "In Battle"
           state. The arena gets a slow diagonal sheen, each fighter
           portrait pulses with a colored ring, the cartoon VS rocks
           with a subtle kick, and the prize plate bobs to read as a
           prize callout. All gracefully degrade under reduced-motion
           below — the still hero look stays bold without movement. */
        @keyframes heroSweep {
          0% { transform: translateX(-110%) skewX(-18deg); opacity: 0; }
          35% { opacity: 0.55; }
          100% { transform: translateX(110%) skewX(-18deg); opacity: 0; }
        }
        :global(.hero-sweep) {
          background: linear-gradient(95deg, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%);
          animation: heroSweep 4.2s ease-in-out infinite;
        }
        @keyframes heroRingPulse {
          0% { transform: scale(0.94); opacity: 0.75; }
          80% { transform: scale(1.18); opacity: 0; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        :global(.hero-ring) {
          border-width: 2px;
          border-style: solid;
          pointer-events: none;
          animation: heroRingPulse 2s ease-out infinite;
        }
        :global(.hero-ring-you) {
          border-color: rgba(52,211,153,0.75);
          box-shadow: 0 0 12px rgba(16,185,129,0.55);
        }
        :global(.hero-ring-opp) {
          border-color: rgba(248,113,113,0.75);
          box-shadow: 0 0 12px rgba(239,68,68,0.55);
        }
        @keyframes heroVsKick {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          50% { transform: scale(1.08) rotate(2deg); }
        }
        :global(.hero-vs) {
          display: inline-block;
          animation: heroVsKick 2.4s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes heroPrizeBob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.04); }
        }
        :global(.hero-prize) {
          animation: heroPrizeBob 2.2s ease-in-out infinite;
          transform-origin: center;
        }

        /* ----- Cartoon "Finding your battle" animation ----- */
        @keyframes youvsFindRing {
          0%   { transform: scale(0.55); opacity: 0.85; }
          70%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        :global(.youvs-find-ring) {
          animation: youvsFindRing 1.8s ease-out infinite;
          transform-origin: center;
        }
        @keyframes youvsFindAvatarLeft {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-6px) rotate(3deg); }
        }
        :global(.youvs-find-avatar-left) {
          animation: youvsFindAvatarLeft 1.1s ease-in-out infinite;
        }
        @keyframes youvsFindAvatarRight {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50%      { transform: translateY(-6px) rotate(-3deg); }
        }
        :global(.youvs-find-avatar-right) {
          animation: youvsFindAvatarRight 1.1s ease-in-out infinite;
          animation-delay: 0.55s;
        }
        @keyframes youvsFindVs {
          0%, 100% { transform: rotate(-6deg) scale(1); }
          25%      { transform: rotate(6deg) scale(1.15); }
          50%      { transform: rotate(-4deg) scale(1.05); }
          75%      { transform: rotate(4deg) scale(1.12); }
        }
        :global(.youvs-find-vs-sticker) {
          animation: youvsFindVs 1.2s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes youvsFindTitle {
          0%, 100% { background-position: 0% 50%; transform: scale(1); }
          50%      { background-position: 100% 50%; transform: scale(1.04); }
        }
        :global(.youvs-find-title) {
          animation: youvsFindTitle 1.6s ease-in-out infinite;
        }
        @keyframes youvsFindDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40%           { opacity: 1;    transform: scale(1.25); }
        }
        :global(.youvs-find-dot) {
          animation: youvsFindDot 1.1s ease-in-out infinite;
        }
        @keyframes youvsFindConfetti {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0.85; }
          50%  { transform: translateY(-10px) rotate(180deg); opacity: 1; }
          100% { transform: translateY(0) rotate(360deg); opacity: 0.85; }
        }
        :global(.youvs-find-confetti) {
          animation: youvsFindConfetti 1.6s ease-in-out infinite;
        }
        @keyframes youvsFindSpark {
          0%, 100% { transform: scale(0.7); opacity: 0.4; }
          50%      { transform: scale(1.25); opacity: 1; }
        }
        :global(.youvs-find-spark) {
          animation: youvsFindSpark 1.3s ease-in-out infinite;
          display: inline-block;
          color: #fff;
          will-change: transform, opacity;
        }
        @keyframes youvsFindSwoosh {
          0%   { stroke-dashoffset: 50; opacity: 0; }
          40%  { opacity: 1; }
          100% { stroke-dashoffset: 0;  opacity: 0; }
        }
        :global(.youvs-find-swoosh) {
          stroke-dasharray: 50;
          animation: youvsFindSwoosh 1.4s ease-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.youvs-anon-fade),
          .tap-to-start-cta,
          :global(.youvs-play-sticker),
          :global(.youvs-tag),
          :global(.youvs-spark),
          :global(.youvs-motion-line),
          :global(.youvs-radar),
          :global(.youvs-ring),
          :global(.youvs-shuffle),
          :global(.youvs-dot),
          :global(.play-now-confirm-btn),
          :global(.hero-sweep),
          :global(.hero-ring),
          :global(.hero-vs),
          :global(.hero-prize),
          :global(.youvs-find-ring),
          :global(.youvs-find-avatar-left),
          :global(.youvs-find-avatar-right),
          :global(.youvs-find-vs-sticker),
          :global(.youvs-find-title),
          :global(.youvs-find-dot),
          :global(.youvs-find-confetti),
          :global(.youvs-find-spark),
          :global(.youvs-find-swoosh) {
            animation: none !important;
          }
          :global(.hero-sweep) { opacity: 0.18; }
          :global(.hero-ring) { opacity: 0.4; }
        }
        .youvs-card:focus-visible {
          border-color: rgba(52, 211, 153, 0.95) !important;
          box-shadow:
            0 0 0 3px rgba(16, 185, 129, 0.55),
            0 0 0 5px rgba(6, 182, 212, 0.45),
            0 0 24px rgba(16, 185, 129, 0.45),
            0 0 40px rgba(6, 182, 212, 0.28) !important;
        }
        @media (hover: hover) {
          .youvs-card:hover {
            transform: translateY(-3px);
            border-color: rgba(52, 211, 153, 0.95) !important;
            box-shadow:
              0 0 0 1px rgba(16, 185, 129, 0.3) inset,
              0 0 28px rgba(16, 185, 129, 0.55),
              0 0 48px rgba(6, 182, 212, 0.32),
              0 10px 28px rgba(0, 0, 0, 0.45) !important;
          }
          .youvs-card:hover:active {
            transform: translateY(-1px) scale(0.99);
            transition-duration: 80ms;
          }
        }
        @media (hover: none) {
          .youvs-card:active {
            transform: scale(0.97);
            border-color: rgba(52, 211, 153, 0.95) !important;
            box-shadow:
              0 0 0 1px rgba(16, 185, 129, 0.3) inset,
              0 0 24px rgba(16, 185, 129, 0.5),
              0 0 40px rgba(6, 182, 212, 0.28) !important;
            transition-duration: 80ms;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .youvs-card,
          .youvs-card:hover,
          .youvs-card:active,
          .youvs-card:hover:active {
            transform: none !important;
            transition: box-shadow 180ms ease-out, border-color 180ms ease-out !important;
          }
        }
      `}</style>
      <div className="p-1.5 sm:p-2.5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[9px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #34d399, #10b981)',
                color: '#022c1f',
                border: '1.5px solid #0d0d0d',
                boxShadow: '0 2px 0 rgba(0,0,0,0.55), 0 0 10px rgba(16,185,129,0.45)',
              }}
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2l2.39 4.84L17.8 7.6l-3.9 3.8.92 5.36L10 14.27 5.18 16.76l.92-5.36-3.9-3.8 5.41-.76L10 2z" />
              </svg>
              Your Battle
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{ background: topDotColor }}
            ></div>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider truncate"
              style={{ color: topDotColor }}
            >
              {topLabel}
            </span>
          </div>
          <span className="text-gray-400 text-[11px] font-medium flex-shrink-0 ml-2">{metaRight}</span>
        </div>

        {isIdle && searchState === 'searching' ? (
          // Cartoon, lively, full-container "Finding your battle"
          // animation. Replaces the previous small-avatar + green-neon-
          // dots radar with a bright, playful, full-bleed treatment:
          // bouncing avatars on either side of a chunky VS sticker,
          // animated background sparkles + confetti + swooshes, an
          // animated title, and a clearly-visible cancel affordance.
          // The elapsed-seconds counter stays in the card header
          // (driven by `searchTimer` -> `metaRight`).
          <div
            className="relative flex flex-1 flex-col items-center justify-center text-center py-1.5 sm:py-2 select-none min-h-0 sm:min-h-[112px] overflow-hidden"
          >
            {/* Background flair — pulsing rings, swooshes, confetti,
                sparkles. Pure presentation; no semantics. */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div
                className="youvs-find-ring absolute"
                style={{
                  left: '50%', top: '50%',
                  width: 120, height: 120,
                  marginLeft: -60, marginTop: -60,
                  borderRadius: '50%',
                  border: '2px solid rgba(251,191,36,0.45)',
                }}
              />
              <div
                className="youvs-find-ring absolute"
                style={{
                  left: '50%', top: '50%',
                  width: 120, height: 120,
                  marginLeft: -60, marginTop: -60,
                  borderRadius: '50%',
                  border: '2px solid rgba(34,211,238,0.4)',
                  animationDelay: '0.7s',
                }}
              />
              <div
                className="youvs-find-ring absolute"
                style={{
                  left: '50%', top: '50%',
                  width: 120, height: 120,
                  marginLeft: -60, marginTop: -60,
                  borderRadius: '50%',
                  border: '2px solid rgba(244,114,182,0.4)',
                  animationDelay: '1.4s',
                }}
              />
              {/* Swoosh lines on each side */}
              <svg
                className="absolute pointer-events-none"
                width="100%" height="100%"
                viewBox="0 0 360 160" preserveAspectRatio="none"
                style={{ inset: 0 }}
              >
                <g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7">
                  <line className="youvs-find-swoosh" x1="6" y1="40" x2="44" y2="40" />
                  <line className="youvs-find-swoosh" x1="2" y1="80" x2="48" y2="80" style={{ animationDelay: '0.2s' }} />
                  <line className="youvs-find-swoosh" x1="6" y1="120" x2="44" y2="120" style={{ animationDelay: '0.4s' }} />
                </g>
                <g stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7">
                  <line className="youvs-find-swoosh" x1="316" y1="40" x2="354" y2="40" style={{ animationDelay: '0.1s' }} />
                  <line className="youvs-find-swoosh" x1="312" y1="80" x2="358" y2="80" style={{ animationDelay: '0.3s' }} />
                  <line className="youvs-find-swoosh" x1="316" y1="120" x2="354" y2="120" style={{ animationDelay: '0.5s' }} />
                </g>
              </svg>
              {/* Confetti pieces, scattered around the layout */}
              <span className="youvs-find-confetti absolute" style={{ left: '12%', top: '14%', background: '#fbbf24', width: 6, height: 10, borderRadius: 2, transform: 'rotate(20deg)' }} />
              <span className="youvs-find-confetti absolute" style={{ left: '22%', top: '74%', background: '#22d3ee', width: 5, height: 9, borderRadius: 2, transform: 'rotate(-12deg)', animationDelay: '0.4s' }} />
              <span className="youvs-find-confetti absolute" style={{ left: '78%', top: '18%', background: '#f472b6', width: 6, height: 10, borderRadius: 2, transform: 'rotate(28deg)', animationDelay: '0.8s' }} />
              <span className="youvs-find-confetti absolute" style={{ left: '86%', top: '70%', background: '#34d399', width: 5, height: 9, borderRadius: 2, transform: 'rotate(-22deg)', animationDelay: '0.2s' }} />
              <span className="youvs-find-confetti absolute" style={{ left: '52%', top: '8%', background: '#a78bfa', width: 5, height: 8, borderRadius: 2, transform: 'rotate(8deg)', animationDelay: '1.0s' }} />
              <span className="youvs-find-confetti absolute" style={{ left: '46%', top: '88%', background: '#f97316', width: 5, height: 9, borderRadius: 2, transform: 'rotate(-8deg)', animationDelay: '0.6s' }} />
              {/* Sparkles in corners */}
              <span className="youvs-find-spark absolute" style={{ left: '6%', top: '8%', fontSize: 16, filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.7))' }}>✦</span>
              <span className="youvs-find-spark absolute" style={{ right: '6%', top: '60%', fontSize: 14, filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.7))', animationDelay: '0.6s' }}>✨</span>
              <span className="youvs-find-spark absolute" style={{ left: '8%', bottom: '8%', fontSize: 14, filter: 'drop-shadow(0 0 5px rgba(244,114,182,0.7))', animationDelay: '1.0s' }}>⚡</span>
              <span className="youvs-find-spark absolute" style={{ right: '4%', top: '8%', fontSize: 16, filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.7))', animationDelay: '0.3s' }}>✨</span>
            </div>

            {/* Avatars + chunky VS centerpiece */}
            <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-5 mb-2 sm:mb-3">
              <div
                className="youvs-find-avatar-left relative"
                style={{
                  borderRadius: '50%',
                  padding: 3,
                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 16px rgba(59,130,246,0.55)',
                  border: '2.5px solid #0d0d0d',
                }}
              >
                {myProfile?.id ? (
                  <PlayerAvatar user={youUser} isWinning={false} size={48} bgColor="#1e40af" />
                ) : (
                  <SilhouetteAvatar gradient="linear-gradient(135deg, #3b82f6, #06b6d4)" size={48} />
                )}
              </div>

              <div
                className="youvs-find-vs-sticker relative inline-flex items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)',
                  border: '3px solid #0d0d0d',
                  boxShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 18px rgba(251,146,60,0.6)',
                }}
              >
                <span
                  className="text-xl sm:text-2xl font-black tracking-tight leading-none italic"
                  style={{
                    color: '#fff',
                    WebkitTextStroke: '1.5px #0d0d0d',
                    textShadow: '2px 2px 0 #0d0d0d',
                  }}
                >
                  VS
                </span>
              </div>

              <div
                key={shuffleTick}
                className="youvs-find-avatar-right relative"
                style={{
                  borderRadius: '50%',
                  padding: 3,
                  background: ANONYMOUS_OPPONENTS[shuffleTick % ANONYMOUS_OPPONENTS.length].gradient,
                  boxShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 16px rgba(244,114,182,0.55)',
                  border: '2.5px solid #0d0d0d',
                }}
              >
                <SilhouetteAvatar
                  gradient={ANONYMOUS_OPPONENTS[shuffleTick % ANONYMOUS_OPPONENTS.length].gradient}
                  size={48}
                />
              </div>
            </div>

            {/* Animated title */}
            <p
              className="youvs-find-title text-sm sm:text-base font-extrabold leading-tight relative z-10 mb-1"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #f472b6, #22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                backgroundSize: '200% 200%',
              }}
            >
              Finding your battle…
            </p>

            <div className="flex items-center gap-1.5 mb-2 relative z-10" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="youvs-find-dot inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancelInCardSearch(); }}
              className="relative z-10 px-3.5 py-1.5 text-[11px] font-semibold text-gray-200 hover:text-red-400 rounded-lg transition-colors"
              style={{
                background: 'rgba(0,0,0,0.55)',
                border: '1.5px solid rgba(255,255,255,0.16)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
              aria-label="Cancel matchmaking"
            >
              Cancel
            </button>
          </div>
        ) : isActive ? (
          // Mortal Kombat-style hero treatment for the active "In
          // Battle" state. Fills the card with fighter portraits, a
          // giant cartoon VS mark, and a prominent prize plate so the
          // user immediately reads "this match matters". The status
          // pill, time-remaining label, and Preview toggle are kept
          // in roughly the same locations as the previous compact
          // layout so existing interactions stay intact. Animated
          // accents (sweep, pulsing rings, prize bob) gracefully
          // degrade under prefers-reduced-motion via the styles above.
          <>
            {/* Slim active-matchup layout — sized to match the
                sibling BattleCard rows in the Featured Battles
                carousel. The previous "hero arena" treatment
                (Mortal-Kombat-style portraits + giant VS + center
                "Battle Ends" fill + prize plate) rendered this card
                roughly 2x taller than its peers, which made the rail
                look uneven and ghosted the other cards. The slim
                layout mirrors BattleCard.compact: 40px avatars +
                small VS centerpiece + inline pot pill. Progress bar
                and "More" toggle below stay shared, so when peers
                expand on tap this card expands in lockstep. */}
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <PlayerAvatar user={youUser} isWinning={false} size={40} bgColor="#1e40af" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                    {youUser.username}
                  </p>
                  {(() => {
                    const startBalRaw = parseFloat(matchup?.startingBalance);
                    const startBal = Number.isFinite(startBalRaw) && startBalRaw > 0 ? startBalRaw : null;
                    const balRaw = youVsMyLiveBalance != null ? parseFloat(youVsMyLiveBalance)
                      : youVsMyBalance != null ? parseFloat(youVsMyBalance)
                      : null;
                    const bal = Number.isFinite(balRaw) ? balRaw : null;
                    const unreal = parseFloat(youVsMyUnrealizedPnl);
                    const pct = Number.isFinite(unreal) && startBal
                      ? ((unreal / startBal) * 100).toFixed(1)
                      : (bal != null && startBal ? (((bal - startBal) / startBal) * 100).toFixed(1) : null);
                    // Desktop: show balance + PnL chip so the user sees
                    // the same info-density the old hero header had.
                    // Mobile: keep the slim "You" label so the card
                    // stays compact in the carousel.
                    if (bal != null) {
                      return (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-wider sm:hidden" style={{ color: '#34d399' }}>
                            You
                          </span>
                          <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-bold tabular-nums" style={{ color: '#fff' }}>
                              {isBeta ? formatMoney(bal, 0) : `$${formatMoney(bal, 0)}`}
                            </span>
                            {pct != null && <PnlBadge pnlPercent={pct} size="small" />}
                          </div>
                        </>
                      );
                    }
                    return (
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>
                        You
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="px-2 flex flex-col items-center flex-shrink-0">
                <span
                  className="text-xl font-black text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                >
                  VS
                </span>
                <span className="text-gray-600 text-[9px] mt-0.5 uppercase tracking-widest">1v1</span>
              </div>
              <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                    {showOpponent ? (opponent?.username || 'Opponent') : 'Opponent'}
                  </p>
                  {(() => {
                    const startBalRaw = parseFloat(matchup?.startingBalance);
                    const startBal = Number.isFinite(startBalRaw) && startBalRaw > 0 ? startBalRaw : null;
                    const balRaw = youVsOppLiveBalance != null ? parseFloat(youVsOppLiveBalance)
                      : youVsOppBalance != null ? parseFloat(youVsOppBalance)
                      : null;
                    const bal = Number.isFinite(balRaw) ? balRaw : null;
                    const unreal = parseFloat(youVsOppUnrealizedPnl);
                    const pct = Number.isFinite(unreal) && startBal
                      ? ((unreal / startBal) * 100).toFixed(1)
                      : (bal != null && startBal ? (((bal - startBal) / startBal) * 100).toFixed(1) : null);
                    if (bal != null) {
                      return (
                        <>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider sm:hidden">
                            Opponent
                          </span>
                          <div className="hidden sm:flex items-center justify-end gap-1.5 mt-0.5">
                            {pct != null && <PnlBadge pnlPercent={pct} size="small" />}
                            <span className="text-[11px] font-bold tabular-nums" style={{ color: '#fff' }}>
                              {isBeta ? formatMoney(bal, 0) : `$${formatMoney(bal, 0)}`}
                            </span>
                          </div>
                        </>
                      );
                    }
                    return (
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Opponent
                      </span>
                    );
                  })()}
                </div>
                {showOpponent ? (
                  <PlayerAvatar
                    user={{
                      id: opponent?.id,
                      username: opponent?.username,
                      avatar: opponent?.avatar,
                    }}
                    isWinning={false}
                    size={40}
                    bgColor="#7c2d12"
                  />
                ) : (
                  <SilhouetteAvatar
                    gradient="linear-gradient(135deg, #fbbf24 0%, #f97316 100%)"
                    size={40}
                  />
                )}
              </div>
            </div>

            {/* Picks status row — mirrors BattleCard's picks pills /
                "Awaiting picks…" row so the YouVsCard active state
                contributes the same ~24px band of vertical content,
                keeping the carousel height aligned with sibling
                BattleCards instead of collapsing to a much shorter
                card. The actual picks list is shown via the More
                toggle expansion. */}
            <div
              className="mb-0.5 sm:mb-1 flex items-center gap-1.5 px-2 py-1 rounded-md"
              style={{ background: '#111', border: '1px solid #1a1a1a', minHeight: '24px' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot" />
              <span className="text-[9px] text-gray-500">
                {isExpanded ? 'See picks below' : 'Tap More for picks'}
              </span>
            </div>

            {/* Cartoon info chip row — mirrors BattleCard's chip band
                so the two cards keep matching info density. We render
                mode + pot chips so the user still gets a "this match
                is worth X" glance even though the pot pill moved out
                of the centered slot. */}
            {(() => {
              const modeKey = (matchup?.durationType || '').toLowerCase();
              const modeMeta = CARTOON_MODE_META[modeKey];
              const chips = [];
              if (modeMeta) {
                chips.push(
                  <CartoonChip
                    key="mode"
                    icon={modeMeta.icon}
                    label={modeMeta.label}
                    color={modeMeta.color}
                    animate="bounce"
                    ariaLabel={`Game mode ${modeMeta.label}`}
                  />
                );
              }
              if (pot != null) {
                chips.push(
                  <CartoonChip
                    key="pot"
                    icon="🏆"
                    label={isBeta ? `${formatMoney(pot, 0)} coins` : `$${formatMoney(pot, 0)}`}
                    color="orange"
                    animate="bounce"
                    ariaLabel={isBeta ? `Coin pot ${formatMoney(pot, 0)} coins` : `Prize pot $${formatMoney(pot, 0)}`}
                  />
                );
              }
              if (chips.length === 0) return null;
              return (
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5 sm:mb-1" style={{ minHeight: 18 }}>
                  {chips}
                </div>
              );
            })()}

            {/* Footer — mirrors BattleCard's footer (Started Xm ago
                on the left, Hide/More on the right) so the card
                terminates at the same vertical position as siblings.
                `mt-auto` pushes the footer to the bottom of the flex
                column, so when items-stretch or expanded peers grow
                the carousel row, this footer stays pinned. */}
            <div className="mt-auto pt-0.5 sm:pt-1">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  {(() => {
                    const startedAgo = formatStartedAgo(startsAt);
                    if (startedAgo) {
                      return <span className="text-gray-500 text-[10px] truncate">{startedAgo}</span>;
                    }
                    return <span className="text-gray-500 text-[10px] truncate">Live now</span>;
                  })()}
                </div>
                <span
                  className="text-[11px] font-medium flex items-center gap-1 flex-shrink-0"
                  style={{ color: '#34d399' }}
                >
                  {isExpanded ? 'Hide' : 'More'}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 220ms ease',
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>
          </>
        ) : isIdle ? (
          // Graffiti / cartoon PLAY NOW treatment — the sticker is the
          // focal point of the card. The buy-in / game-mode / pot
          // chips that used to live here moved into the confirmation
          // popup so the home card can lead with the call to action
          // and a short explainer of what tapping it actually does.
          <div className="flex flex-1 flex-col items-center justify-center text-center py-1 sm:py-2 select-none">
            <div className="relative inline-flex items-center justify-center mb-1 sm:mb-2 h-[50px] sm:h-[68px]">
              <svg
                className="absolute pointer-events-none hidden sm:block"
                width="260"
                height="84"
                viewBox="0 0 260 84"
                aria-hidden="true"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85">
                  <line className="youvs-motion-line" x1="6" y1="20" x2="44" y2="20" />
                  <line className="youvs-motion-line" x1="2" y1="42" x2="48" y2="42" style={{ animationDelay: '0.2s' }} />
                  <line className="youvs-motion-line" x1="6" y1="64" x2="44" y2="64" style={{ animationDelay: '0.4s' }} />
                  <line className="youvs-motion-line" x1="216" y1="20" x2="254" y2="20" style={{ animationDelay: '0.1s' }} />
                  <line className="youvs-motion-line" x1="212" y1="42" x2="258" y2="42" style={{ animationDelay: '0.3s' }} />
                  <line className="youvs-motion-line" x1="216" y1="64" x2="254" y2="64" style={{ animationDelay: '0.5s' }} />
                </g>
              </svg>

              <div
                className="youvs-play-sticker relative inline-flex items-center justify-center px-4 py-1 sm:px-6 sm:py-1.5 rounded-2xl sm:rounded-3xl"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)',
                  border: '4px solid #0d0d0d',
                  boxShadow: '0 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(251,146,60,0.6)',
                }}
              >
                <span
                  className="text-xl sm:text-3xl font-black tracking-tight leading-none"
                  style={{
                    color: '#fff',
                    WebkitTextStroke: '2px #0d0d0d',
                    textShadow: '3px 3px 0 #0d0d0d',
                    fontStyle: 'italic',
                    letterSpacing: '-0.01em',
                  }}
                >
                  PLAY NOW
                </span>
              </div>

              <div
                className="youvs-tag absolute"
                style={{
                  top: -12,
                  right: -12,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: '#10b981',
                  border: '2.5px solid #0d0d0d',
                  boxShadow: '0 3px 0 rgba(0,0,0,0.55)',
                }}
              >
                <span
                  className="text-[10px] sm:text-xs font-black uppercase tracking-wider"
                  style={{ color: '#0d0d0d', letterSpacing: '0.05em' }}
                >
                  1v1
                </span>
              </div>

              <span
                className="youvs-spark absolute text-2xl"
                style={{ top: -14, left: -18, filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.7))' }}
                aria-hidden="true"
              >
                ⚡
              </span>
              <span
                className="youvs-spark absolute text-xl"
                style={{ bottom: -10, right: 4, animationDelay: '0.6s', filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.7))' }}
                aria-hidden="true"
              >
                ✦
              </span>
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-white leading-tight px-2">
              Tap to face anyone in a 1v1
            </p>

            {searchError && (
              <p
                className={`text-[10px] font-medium mt-1.5 ${
                  searchError === 'Matchmaking cancelled.'
                    ? 'text-gray-400'
                    : 'text-red-400'
                }`}
                role="status"
              >
                {searchError}
              </p>
            )}
          </div>
        ) : (
          // Waiting / queued — unchanged from the existing layout
          // per the task contract. Active state has its own hero
          // branch above.
          <>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <PlayerAvatar user={youUser} isWinning={false} size={40} bgColor="#1e40af" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                    {youUser.username}
                  </p>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">You</span>
                </div>
              </div>

              <div className="px-3 flex flex-col items-center">
                <span
                  className="text-xl font-black text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                >
                  VS
                </span>
                <span className="text-gray-600 text-[9px] mt-0.5 uppercase tracking-widest">1v1</span>
              </div>

              <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  {showOpponent ? (
                    <>
                      <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>
                        {opponent.username || 'Opponent'}
                      </p>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Opponent
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate text-gray-300">
                        Random Opponent
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {isQueued ? 'Searching…' : 'Tap to start'}
                      </span>
                    </>
                  )}
                </div>
                {showOpponent ? (
                  <PlayerAvatar
                    user={{ id: opponent.id, username: opponent.username, avatar: opponent.avatar }}
                    isWinning={false}
                    size={40}
                    bgColor="#065f46"
                  />
                ) : (
                  <div
                    key={`anon-avatar-${opponentTick}`}
                    className="youvs-anon-fade"
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: '50%',
                      padding: 2,
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.45), rgba(6,182,212,0.45))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SilhouetteAvatar gradient={anonymousOpponent.gradient} size={40} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto">
              <span className="text-gray-600 text-[10px]">
                {progressLabel}
              </span>
              <div className="flex items-center gap-3">
                {(isWaiting || isQueued) && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!canCancel}
                    className="text-[11px] font-medium text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : (isQueued ? 'Leave Queue' : 'Cancel')}
                  </button>
                )}
                <span
                  className="text-[11px] font-semibold flex items-center gap-1"
                  style={{ color: '#34d399' }}
                >
                  {isExpanded ? 'Hide' : 'More'}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 220ms ease',
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 280ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              borderTop: '1px solid rgba(59,130,246,0.18)',
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 220ms ease',
              transitionDelay: isExpanded ? '120ms' : '0ms',
              cursor: 'default',
            }}
          >
            {/* Cartoon-themed headline pill — same 2.5px black border +
                hard shadow language as the rest of the popup, with the
                live status color driving the pill background so the
                headline reads as a "you are here" sticker. */}
            <div className="px-3.5 pt-3 pb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: `linear-gradient(180deg, ${topDotColor}, ${topDotColor}cc)`,
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 2px 0 #0a0a0a',
                }}
              >
                <span
                  className={topDotColor === '#f59e0b' || topDotColor === '#06b6d4' ? 'pick-pending-dot' : ''}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.7)' }}
                />
                <span className="text-white text-[10px] font-black uppercase tracking-[0.16em]">
                  {expandedHeadline}
                </span>
              </span>
            </div>

            {/* Cartoon body card — navy gradient + 2.5px black border +
                hard shadow + faint cyan inner glow so it matches the
                modal frame language. */}
            <div className="px-3.5 pb-3">
              <div
                className="rounded-xl px-3 py-2.5 text-[11.5px] text-gray-300 leading-snug font-semibold"
                style={{
                  background: 'linear-gradient(180deg,#0f1424,#0a0e1c)',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 3px 0 #0a0a0a, inset 0 0 0 1.5px rgba(6,182,212,0.18)',
                }}
              >
                {expandedBody}
              </div>
            </div>

            {/* Cartoon CTA — blue→cyan gradient with chunky black
                border, hard shadow, inset dark text bar, and a circular
                cyan-bordered chevron cap on the right edge, matching
                QuickMatchModal's "PLAY NOW" button language. */}
            <div className="px-3.5 pb-3.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNavigate(); }}
                className="w-full relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-black text-white uppercase tracking-[0.12em]"
                style={{
                  background: 'linear-gradient(180deg,#3b82f6 0%,#0891b2 100%)',
                  border: '2.5px solid #0a0a0a',
                  boxShadow: '0 4px 0 #0a0a0a, 0 0 18px rgba(6,182,212,0.45)',
                  letterSpacing: '0.14em',
                  textShadow: '0 2px 0 rgba(0,0,0,0.45)',
                }}
              >
                {ctaText}
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#0a0e1c',
                    border: '2px solid #67e8f9',
                    boxShadow: '0 0 8px rgba(6,182,212,0.7)',
                  }}
                >
                  <svg width="11" height="11" fill="none" stroke="#67e8f9" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>

            {isActive && matchup?.id && (
              <div className="px-3.5 pb-3.5" onClick={(e) => e.stopPropagation()}>
                <SlideToForfeit
                  onConfirm={async () => {
                    try {
                      const res = await fetch('/api/battles/forfeit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ matchupId: matchup.id }),
                      });
                      if (res.ok) {
                        try { await refreshMatchup(); } catch {}
                      }
                    } catch {}
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <MyBattleOverviewModal
      isOpen={showMyBattleOverview}
      onClose={() => setShowMyBattleOverview(false)}
      matchup={matchup}
      opponent={opponent}
      myProfile={myProfile}
      isBeta={isBeta}
      onOpenBattle={handleOverviewOpenBattle}
      onForfeit={handleOverviewForfeit}
      onMessageOpponent={handleOverviewMessage}
      onViewUpdates={handleOverviewViewUpdates}
      myLiveBalance={youVsMyLiveBalance}
      opponentLiveBalance={youVsOppLiveBalance}
      myUnrealizedPnl={youVsMyUnrealizedPnl}
      opponentUnrealizedPnl={youVsOppUnrealizedPnl}
    />
    <BattleModeChooser
      isOpen={showChooser}
      onClose={() => setShowChooser(false)}
      onPickQuickMatch={handleChooserQuickMatch}
      onPickChallengeFriend={handleChooserChallengeFriend}
      onPickPrivateMatch={handleChooserPrivateMatch}
      currentUser={myProfile ? { id: myProfile.id, username: myProfile.username, avatar: myProfile.avatar } : null}
    />
    {/* Quick Match modal — same component the /battle page mounts when
        the Start a Battle chooser picks Quick Match. Surfaces the full
        buy-in / mode picker before any matchmaking happens, so the
        home-page Quick Match flow no longer drops users straight into
        the queue with their persisted defaults. */}
    <QuickMatchModal
      isOpen={showQuickMatchModal}
      onClose={() => setShowQuickMatchModal(false)}
      userId={myProfile?.id || currentUserId || null}
      onMatchFound={(matchup, opponentMeta) => {
        setShowQuickMatchModal(false);
        // Refresh the global matchup context so the YouVsCard
        // immediately swaps from idle to "live in a battle" without
        // a full page reload.
        try { refreshMatchup(); } catch {}
        // Mirror /battle's post-match landing so users go straight
        // to wherever this matchup's mode lives — RUSH owns its own
        // gameplay page at /battle/rush/[id] (route immediately so
        // both players hit the voting screen at the same time), the
        // others land back on the dashboard after a brief beat so
        // users can start picking.
        if (matchup?.durationType === 'rush') {
          navigateToBattleStart(router, matchup);
        } else {
          setTimeout(() => navigateToBattleStart(router, matchup), 1200);
        }
      }}
    />
    {/* Legacy stepped pre-match popup. Kept mounted (gated by
        showPrePopup) for any future re-enable, but no entry point
        currently sets showPrePopup=true — the chooser now opens the
        full QuickMatchModal above instead. Safe to delete along with
        openPrePopup / handlePopupConfirm in a follow-up cleanup. */}
    <PreMatchPopup
      isOpen={showPrePopup}
      onClose={() => setShowPrePopup(false)}
      onConfirm={handlePopupConfirm}
      initialBuyIn={buyIn}
      initialGameMode={gameMode}
      balance={balance}
      currentUserId={myProfile?.id || null}
    />
    {/* In-card Play Friend / Private Match modals — mounted only when
        the home page supplies the friends list + current-user profile
        so the chooser experience stays on the home page (no jump to
        /battle). The /battle page mounts its own copy of these modals
        for the deep-link query handoff. */}
    {canMountChooserModals && (
      <>
        <PlayFriendModal
          isOpen={showPlayFriend}
          onClose={() => setShowPlayFriend(false)}
          friends={friends}
          currentUser={currentUser}
          initialBuyIn={lastBuyIn}
          onInviteSent={() => {
            if (onPlayFriendInviteSent) onPlayFriendInviteSent();
          }}
          onInviteCancelled={() => {
            if (onPlayFriendInviteCancelled) onPlayFriendInviteCancelled();
          }}
          onSwitchToPrivate={() => {
            setShowPlayFriend(false);
            setShowPrivateMatch(true);
          }}
        />
        <PrivateMatchModal
          isOpen={showPrivateMatch}
          onClose={() => setShowPrivateMatch(false)}
          onMatchJoined={(matchup) => {
            setShowPrivateMatch(false);
            if (onPrivateMatchJoined) {
              onPrivateMatchJoined(matchup);
            } else {
              // Mirror /battle's behavior: a created+joined private
              // match should land the user in the same lobby/active-
              // battle destination they would have reached on /battle.
              router.push('/battle');
            }
          }}
        />
      </>
    )}
    </>
  );
}

export default function LiveBattlesSection({
  compact = false,
  focusBattleId = null,
  currentUserId = null,
  youVsState = null,
  onYouVsClick = null,
  balance = null,
  // Forwarded straight to YouVsCard so the in-card chooser can mount
  // the Play Friend / Private Match modals without leaving the home
  // page. Optional — when omitted, the chooser falls back to the
  // legacy `router.push('/battle?openPlayFriend=1')` hand-off.
  friends = null,
  lastBuyIn = null,
  currentUser = null,
  onPlayFriendInviteSent = null,
  onPlayFriendInviteCancelled = null,
  onPrivateMatchJoined = null,
}) {
  const [battles, setBattles] = useState(() => getSimulatedBattles([]));
  const [avatars, setAvatars] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  // The compact dashboard carousel keeps each BattleCard's expansion
  // independent (see peerExpandedFor / setPeerExpanded below). Earlier we
  // shared a single `battlesExpanded` flag across every peer so the row
  // height stayed even, but that made Hide feel broken — clicking it on
  // one card collapsed every peer at once and any stray click on a peer
  // re-flipped the row open. Per-card expansion via `expandedKey` keyed
  // by battle id is the source of truth now; the row uses `items-start`
  // so an expanded card grows downward without stretching its neighbors.
  // When the YouVsCard's in-card matchmaking flow resolves, we hand
  // off to the existing match-found popup by mounting QuickMatchModal
  // pre-seeded into its `found` step. The user sees the same standard
  // modal they'd get from the modal's own search flow — just without
  // ever seeing config or searching.
  const [matchFoundData, setMatchFoundData] = useState(null);
  // Soft-retry state for the live battles fetch. Mirrors the inline
  // `RetryHint` pattern used on /battle for friends/requests/invites/matchup
  // /history: we surface a small "tap to retry" hint when the fetch fails or
  // times out, without forcing a full page reload.
  const [loadStatus, setLoadStatus] = useState('idle');
  const loadRef = useRef(null);
  const router = useRouter();

  const retryLiveBattles = useCallback(() => {
    const load = loadRef.current;
    if (!load) return;
    load({ isRetry: true });
  }, []);

  const toggleExpandedKey = useCallback((key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const youVsStatus = youVsState?.status || 'idle';
  const youVsIsIdle = youVsStatus !== 'active' && youVsStatus !== 'waiting' && youVsStatus !== 'queued';
  useEffect(() => {
    if (youVsIsIdle) {
      setExpandedKey((prev) => (prev === 'youvs' ? null : prev));
    }
  }, [youVsIsIdle]);

  // Each peer BattleCard owns its own expansion via the shared
  // `expandedKey` slot keyed by battle id. Clicking Preview opens that one
  // card; clicking Hide on it (or opening another) closes it. Earlier we
  // used a single shared `battlesExpanded` flag so every peer expanded at
  // once, but that made the Hide button feel broken: clicking Hide on one
  // card would also force-collapse a card the user had just expanded
  // elsewhere, and any stray click bubbling from a peer flipped the whole
  // row open. Per-card state fixes both: cards default to collapsed
  // (`expandedKey === null`) and Hide reliably closes the one card you
  // clicked. BattleCard forwards the desired next value to onToggle, so we
  // set/clear the shared key explicitly rather than blindly inverting.
  // The row uses items-stretch so all peer cards grow to match the
  // tallest sibling's height. Previously only the clicked card revealed
  // its pick preview, which left the other (force-stretched) peers
  // showing empty space below their footer. Treat any `peer:*` key as
  // "all peers expanded" so every card in the row reveals its preview
  // in lockstep. We still record which card was clicked in `expandedKey`
  // so Hide on any peer collapses the row back down cleanly.
  const anyPeerExpanded = typeof expandedKey === 'string' && expandedKey.startsWith('peer:');
  const peerExpandedFor = useCallback((_battleId) => anyPeerExpanded, [anyPeerExpanded]);
  const setPeerExpanded = useCallback((battleId) => (next) => {
    setExpandedKey((prev) => {
      if (next) return `peer:${battleId}`;
      // Hide on any peer collapses the whole row (since the row
      // expanded together, it should collapse together too).
      if (typeof prev === 'string' && prev.startsWith('peer:')) return null;
      return prev;
    });
  }, []);

  useEffect(() => {
    fetch('/api/admin/battle-avatars')
      .then(res => res.ok ? res.json() : { avatars: [] })
      .then(data => {
        const all = data.avatars || [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        const pool = shuffled.slice(0, 6);
        setAvatars(pool);
        // Only refresh the simulated placeholder list if no real battles
        // have been loaded yet. With the SSE push model `load()` may
        // resolve before this avatar fetch does, and we must not stomp
        // on real live battles with simulated entries.
        setBattles((prev) => {
          const allSimulated = prev.length > 0 && prev.every((b) => b.simulated);
          return allSimulated ? getSimulatedBattles(pool) : prev;
        });
      })
      .catch(() => {});
  }, []);

  // Always read the latest avatar pool inside `load()` without re-binding
  // the SSE subscription every time the avatars array changes.
  const avatarsRef = useRef(avatars);
  useEffect(() => { avatarsRef.current = avatars; }, [avatars]);

  // Live Battles list. Pushed in real time by the shared SSE singleton:
  // server-side publishers (`publishMatchupStart` / `publishMatchupEnd` in
  // `lib/battle-events.js`) emit a lightweight `highlights:refresh` global
  // event whenever any battle starts or completes, and the SSE stream fans
  // it out to every connected client. We refetch on those pushes (with a
  // short debounce so a burst at battle-end is coalesced) instead of
  // polling on a 30s timer. While SSE is unhealthy — including the public
  // unauthenticated view, where `/api/battles/stream` 401s and the shared
  // client emits `piks:disconnected` — a fallback poll keeps the list
  // populated on a slower cadence so we don't hammer the endpoint when
  // SSE is doing its job. Mirrors the recent-winners strip in pages/battle.js.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let debounce = null;
    let fallback = null;
    let fallbackGrace = null;

    // `isInitial` flips status to 'loading' on the very first mount fetch so
    // the hint stays hidden while we wait. `isRetry` flips to 'retrying' for
    // the manual tap-to-retry path. Background loads (SSE pushes, fallback
    // polls, reconnect catch-up) don't touch status until they resolve, so
    // a healthy stream never flickers the hint on or off.
    const load = async ({ isInitial = false, isRetry = false } = {}) => {
      if (cancelled) return;
      // Only the initial mount fetch and an explicit tap-to-retry are
      // "foreground" loads allowed to surface the failure hint. Background
      // loads (SSE-triggered reloads, fallback polls, reconnect catch-up)
      // must NOT flip to 'failed' on a transient blip — we always have
      // simulated battles on screen, so popping "Couldn't load this" on
      // every 30s background poll that times out (e.g. while upstream data
      // is flaky) is noise. A successful load of any kind still clears it.
      const foreground = isInitial || isRetry;
      if (isRetry) setLoadStatus('retrying');
      else if (isInitial) setLoadStatus('loading');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/battles/live', { signal: controller.signal });
        if (!res.ok) {
          if (!cancelled && foreground) setLoadStatus('failed');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const liveBattles = (data.battles || []).filter(b => {
          if (!b.user2 || b.remainingMs <= 0) return false;
          return true;
        });
        const simulated = getSimulatedBattles(avatarsRef.current);
        if (liveBattles.length >= 3) {
          setBattles(liveBattles);
        } else if (liveBattles.length > 0) {
          const remaining = simulated.slice(0, 3 - liveBattles.length);
          setBattles([...liveBattles, ...remaining]);
        } else {
          setBattles(simulated);
        }
        setLoadStatus('success');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching live battles:', err);
        }
        if (!cancelled && foreground) setLoadStatus('failed');
      } finally {
        clearTimeout(timeout);
      }
    };

    loadRef.current = load;

    // Coalesce bursts (e.g. matchup:end immediately followed by another
    // start when both sides accept a rematch handshake within a tick).
    const scheduleLoad = () => {
      if (debounce || cancelled) return;
      debounce = setTimeout(() => {
        debounce = null;
        load();
      }, 750);
    };

    const FALLBACK_GRACE_MS = 5000;
    const FALLBACK_INTERVAL_MS = 30000;

    const stopFallback = () => {
      if (fallbackGrace) { clearTimeout(fallbackGrace); fallbackGrace = null; }
      if (fallback) { clearInterval(fallback); fallback = null; }
    };

    const startFallback = () => {
      if (fallback || fallbackGrace || cancelled) return;
      fallbackGrace = setTimeout(() => {
        fallbackGrace = null;
        if (cancelled) return;
        load();
        fallback = setInterval(load, FALLBACK_INTERVAL_MS);
      }, FALLBACK_GRACE_MS);
    };

    // Initial fetch — render the list ASAP regardless of SSE health.
    load({ isInitial: true });

    const client = getBattleStreamClient();
    let unsubscribe = null;
    let watchdog = null;

    if (client) {
      unsubscribe = client.subscribe((ev) => {
        if (!ev || !ev.type) return;
        if (ev.type === 'highlights:refresh') {
          scheduleLoad();
          return;
        }
        if (ev.type === 'piks:disconnected') {
          startFallback();
          return;
        }
        if (ev.type === 'piks:reconnected' || ev.type === 'connected') {
          stopFallback();
          // Reconnect catch-up — pick up anything that joined or left the
          // list during the outage without waiting on the next push.
          load();
        }
      });

      // Late-mount safety: if the stream singleton was already in a known
      // state by the time we subscribed, react to it now (the lifecycle
      // events that established that state won't replay).
      if (typeof client.getState === 'function') {
        const initial = client.getState();
        if (initial === 'disconnected') startFallback();
      }

      // Watchdog: if SSE never reaches `connected` (auth wall for guests,
      // network failure, etc.), engage the fallback poll so the list
      // doesn't go indefinitely stale waiting on push.
      watchdog = setTimeout(() => {
        const s = typeof client.getState === 'function' ? client.getState() : null;
        if (s !== 'connected') startFallback();
      }, 10000);
    } else {
      // No EventSource available at all (very old browser / SSR fallback)
      // — just poll on the slow cadence.
      startFallback();
    }

    return () => {
      cancelled = true;
      loadRef.current = null;
      if (debounce) clearTimeout(debounce);
      if (watchdog) clearTimeout(watchdog);
      stopFallback();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Inline soft-retry hint shown when the live-battles fetch fails or times
  // out. Visually mirrors the `RetryHint` on /battle so the affordance feels
  // native to the page. Tapping it re-runs only this fetch via the latest
  // `loadRef`, so there's no full page reload and no other section is
  // touched. Hidden in idle/loading/success states per the task contract,
  // and additionally suppressed once we have any real (non-simulated)
  // battles in hand so a transient background poll/SSE blip doesn't pop the
  // hint while users are still looking at usable live data.
  const hasRealBattles = battles.some((b) => !b.simulated);
  const showRetryHint =
    (loadStatus === 'failed' || loadStatus === 'retrying') && !hasRealBattles;
  const retryHint = showRetryHint ? (
    <div className="text-center pb-2">
      <button
        type="button"
        onClick={retryLiveBattles}
        disabled={loadStatus === 'retrying'}
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-60"
        style={{ color: '#9ca3af' }}
        aria-label="Retry loading live battles"
      >
        {loadStatus === 'retrying' ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8" />
            </svg>
            Retrying…
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Couldn&apos;t load this — tap to retry
          </>
        )}
      </button>
    </div>
  ) : null;

  const sortedBattles = focusBattleId
    ? [...battles].sort((a, b) => (a.id === focusBattleId ? -1 : b.id === focusBattleId ? 1 : 0))
    : battles;

  if (compact) {
    const ownMatchupId = youVsState?.matchup?.id || null;
    const compactBattles = sortedBattles.filter(b => {
      if (ownMatchupId && b.id === ownMatchupId) return false;
      if (currentUserId) {
        if (b.user1?.id && b.user1.id === currentUserId) return false;
        if (b.user2?.id && b.user2.id === currentUserId) return false;
      }
      return true;
    });
    const featuredCount = compactBattles.length + (youVsState && youVsState.status !== 'idle' ? 1 : 0);
    return (
      <div className="mb-4">
        {/* Global keyframes / classes for the shared cartoon info chip
            primitive used by both the live battle cards and the
            "Your Battle" card. Emitted from the shared CartoonChip
            module so every consumer (including QuickMatchModal) gets
            consistent animations. Reduced-motion users get static
            chips per the homepage-wide pattern. */}
        <CartoonChipStyles />
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-500">Featured Battles</span>
            {featuredCount > 0 && (
              <span className="text-green-400 text-[10px] font-semibold">{featuredCount}</span>
            )}
          </div>
          <button onClick={() => router.push('/battle')} className="text-blue-400 text-xs">
            See All
          </button>
        </div>
        {retryHint}
        {/* items-start (instead of items-stretch) lets each card size to its
            own content. We previously stretched the row to match the tallest
            sibling so an "awaiting picks" card wouldn't look short next to a
            fully-locked battle, but with per-card expansion that stretching
            also forced collapsed peers to grow when one card was expanded —
            which read as ghost empty space below the Hide button and made the
            row feel broken. Letting cards grow naturally keeps the visual
            simple: collapsed cards stay short, expanded cards extend down,
            and the carousel stays horizontally scrollable either way. */}
        {/* Edge-to-edge on mobile/tablet: negative margin cancels the
            dashboard's px-4/sm:px-6 wrapper so this row runs to the
            viewport edges. On lg+ the row is clipped to the main column
            (lg:mx-0 / lg:pl-0) and wrapped in DesktopScrollRow so it never
            bleeds under the right sidebar — and gets a gutter scroll arrow. */}
        <DesktopScrollRow innerClassName="flex gap-3 items-stretch overflow-x-auto lg:overflow-x-visible pb-2 scrollbar-hide -mx-4 sm:-mx-6 lg:mx-0 pl-4 sm:pl-6 lg:pl-0 pr-2">
          <div className="flex-shrink-0 w-[380px] flex lg:w-auto lg:flex-1 lg:min-w-0 lg:max-w-[420px]">
            <YouVsCard
              youVsState={youVsState}
              onClick={onYouVsClick}
              isExpanded={expandedKey === 'youvs'}
              onToggle={() => toggleExpandedKey('youvs')}
              onMatchFound={(data) => setMatchFoundData(data)}
              currentUserId={currentUserId}
              balance={balance}
              friends={friends}
              lastBuyIn={lastBuyIn}
              currentUser={currentUser}
              onPlayFriendInviteSent={onPlayFriendInviteSent}
              onPlayFriendInviteCancelled={onPlayFriendInviteCancelled}
              onPrivateMatchJoined={onPrivateMatchJoined}
            />
          </div>
          {compactBattles.slice(0, 2).map(battle => (
            <div key={battle.id} className="flex-shrink-0 w-[380px] flex lg:w-auto lg:flex-1 lg:min-w-0 lg:max-w-[420px]">
              <BattleCard
                battle={battle}
                compact
                isExpanded={peerExpandedFor(battle.id)}
                onToggle={setPeerExpanded(battle.id)}
              />
            </div>
          ))}
        </DesktopScrollRow>
        <QuickMatchModal
          isOpen={!!matchFoundData}
          onClose={() => setMatchFoundData(null)}
          userId={currentUserId}
          presetMatch={matchFoundData}
          onMatchFound={(matchup) => {
            // Continue button on the standard match-found popup
            // routes to whichever destination the matchup's mode
            // owns — RUSH gets its dedicated 6-question gameshow
            // page at /battle/rush/[id]; original/tournament drop
            // back on the dashboard for the standard pick flow.
            setMatchFoundData(null);
            navigateToBattleStart(router, matchup || matchFoundData);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Shared cartoon chip animation styles — emitted here so the
          full Active Battles page picks up the same keyframes and
          reduced-motion override the homepage carousel uses. */}
      <CartoonChipStyles />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-500">Live Battles</span>
          {sortedBattles.length > 0 && (
            <span className="text-green-400 text-[10px] font-semibold">{sortedBattles.length} live</span>
          )}
        </div>
      </div>

      {retryHint}

      {sortedBattles.length === 0 ? (
        <div
          className="battle-cta-card rounded-xl cursor-pointer group transition-all duration-300 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1117 50%, #0a1628 100%)', border: '1px solid rgba(59,130,246,0.25)' }}
          onClick={() => {
            const startBtn = document.querySelector('.battle-start-btn');
            if (startBtn) startBtn.click();
          }}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="battle-cta-particle" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(59,130,246,0.4)', position: 'absolute', top: '15%', left: '10%' }}></div>
            <div className="battle-cta-particle" style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(6,182,212,0.5)', position: 'absolute', top: '25%', left: '75%', animationDelay: '1.5s' }}></div>
            <div className="battle-cta-particle" style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(59,130,246,0.3)', position: 'absolute', top: '70%', left: '85%', animationDelay: '0.8s' }}></div>
            <div className="battle-cta-particle" style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(16,185,129,0.4)', position: 'absolute', top: '80%', left: '20%', animationDelay: '2s' }}></div>
            <div className="battle-cta-particle" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(59,130,246,0.25)', position: 'absolute', top: '50%', left: '45%', animationDelay: '1s' }}></div>
          </div>

          <div className="relative flex items-center justify-between px-6 sm:px-10 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(6,182,212,0.12))', border: '2.5px solid rgba(59,130,246,0.5)', boxShadow: '0 0 20px rgba(59,130,246,0.15)' }}>
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">You</span>
              <span className="text-[10px] font-bold text-emerald-400 px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>FREE $10</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)', filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.3))' }}>VS</span>
              <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">1v1 Battle</span>
              <div className="flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full group-hover:gap-2.5 transition-all" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.15))', border: '1px solid rgba(59,130,246,0.3)' }}>
                <span className="text-xs font-semibold text-blue-400">Tap to Start</span>
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.12))', border: '2.5px solid rgba(16,185,129,0.5)', boxShadow: '0 0 20px rgba(16,185,129,0.15)' }}>
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Opponent</span>
              <span className="text-[10px] text-gray-600 font-medium">Real Players</span>
            </div>
          </div>
        </div>
      ) : sortedBattles.length > 0 ? (
        <div className="space-y-3">
          {sortedBattles.map(battle => (
            <BattleCard key={battle.id} battle={battle} focused={battle.id === focusBattleId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
