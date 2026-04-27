import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';
import QuickMatchModal from './QuickMatchModal';
import BattleModeChooser from './BattleModeChooser';
import PlayFriendModal from './PlayFriendModal';
import PrivateMatchModal from './PrivateMatchModal';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../UserAvatar';
import MutualFriendsLine from '../social/MutualFriendsLine';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';
import { useMatchup } from '../../contexts/MatchupContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';
import {
  PLAY_NOW_SKIP_CONFIRM_KEY,
  PLAY_NOW_SKIP_CONFIRM_VERSION,
} from '../../lib/playNowConfirm';
import { readLocalOneTapPrefs, writeLocalOneTapPrefs, fetchOneTapPrefs, saveOneTapPrefs } from '../../utils/oneTapPrefs';
import { CartoonChip, CARTOON_MODE_META, CartoonChipStyles } from './CartoonChip';
import PreMatchPopup from './PreMatchPopup';
import haptic from '../../utils/haptics';

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


function getSimulatedBattles(avatars) {
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

      <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? '6px' : '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(battle.remainingMs || 0);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = compact ? isExpanded : internalExpanded;
  const setExpanded = compact ? () => onToggle?.() : setInternalExpanded;
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
        className={`w-full h-full rounded-xl cursor-pointer flex flex-col ${focused ? 'live-battle-highlight' : ''}`}
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
        <div className="p-2 sm:p-3.5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400">${formatMoney(potSize, 0)}</span>
              <span className="text-gray-600 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mb-1.5 sm:mb-3">
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
            <div className="flex gap-1 mb-1 sm:mb-2" style={{ minHeight: '32px' }}>
              <div className="flex-1 min-w-0">
                {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
              <span className="text-gray-600 text-[9px] self-center px-0.5">vs</span>
              <div className="flex-1 min-w-0">
                {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
            </div>
          ) : picksLocked ? (
            <div className="mb-1 sm:mb-2 flex items-center gap-1.5 px-2 py-2 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '32px' }}>
              <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[9px] text-gray-500 truncate">{onlyUser1 ? `${user1.username || 'P1'} locked` : `${user2.username || 'P2'} locked`} · awaiting other</span>
            </div>
          ) : (
            <div className="mb-1 sm:mb-2 flex items-center gap-1.5 px-2 py-2 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '32px' }}>
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
              <div className="flex items-center gap-1.5 flex-wrap mb-1 sm:mb-2" style={{ minHeight: 22 }}>
                {chips}
              </div>
            );
          })()}

          <div className="mt-auto pt-1 sm:pt-1.5">
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
                <div className="grid grid-cols-2 gap-2 px-3.5 pb-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 truncate">
                      {user1.username || 'Player 1'}'s picks
                    </div>
                    {user1.id && (
                      <div className="mb-1.5">
                        <MutualFriendsLine
                          userId={user1.id}
                          username={user1.username}
                          size="xs"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {picks.user1.length === 0 ? (
                        <div className="text-[10px] text-gray-600">No picks yet</div>
                      ) : (
                        picks.user1.map((pick, i) => <PickPill key={i} pick={pick} compact />)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 truncate text-right">
                      {user2.username || 'Player 2'}'s picks
                    </div>
                    {user2.id && (
                      <div className="mb-1.5 flex justify-end">
                        <MutualFriendsLine
                          userId={user2.id}
                          username={user2.username}
                          size="xs"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {picks.user2.length === 0 ? (
                        <div className="text-[10px] text-gray-600 text-right">No picks yet</div>
                      ) : (
                        picks.user2.map((pick, i) => <PickPill key={i} pick={pick} compact />)
                      )}
                    </div>
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
                  onClick={(e) => { e.stopPropagation(); router.push(`/battle?battle=${battle.id}`); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
                  }}
                >
                  See More
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
      className={`rounded-xl overflow-hidden ${focused ? 'live-battle-highlight' : ''}`}
      style={{
        backgroundColor: '#0d0d0d',
        border: focused ? '1px solid rgba(6, 182, 212, 0.5)' : `1px solid ${'#1a1a1a'}`,
        boxShadow: 'none',
      }}
    >
      <div className="p-3.5" onClick={() => picks && setExpanded(!expanded)} style={{ cursor: picks ? 'pointer' : 'default' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-gray-400">${formatMoney(potSize, 0)} pot</span>
            <span className="text-gray-600 text-[11px]">{formatTimeRemaining(timeLeft)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={40} bgColor="#1e40af" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1" style={{ color: '#fff' }}>
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold tabular-nums" style={{ color: '#fff' }}>${formatMoney(user1.balance || 0, 0)}</span>
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
                <span className="text-sm font-bold tabular-nums" style={{ color: '#fff' }}>${formatMoney(user2.balance || 0, 0)}</span>
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
                onClick={(e) => { e.stopPropagation(); router.push(`/battle?battle=${battle.id}`); }}
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

// Slide-to-forfeit affordance for the active YOUR BATTLE card. The
// thumb is dragged across the track; releasing past ~88% of the
// track snaps to the end, fires a haptic, and invokes onConfirm.
// Releasing earlier snaps the thumb back to the start. Pointer
// events keep mouse + touch on the same code path so it feels
// fluid on phones and trackpads alike.
function SlideToForfeit({ onConfirm, disabled = false }) {
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const startPointerXRef = useRef(0);
  const startThumbRef = useRef(0);
  const thumbXRef = useRef(0);
  const maxXRef = useRef(0);
  const [thumbX, setThumbX] = useState(0);
  const [maxX, setMaxX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const THUMB = 44;
  const COMPLETE_RATIO = 0.88;

  useEffect(() => { thumbXRef.current = thumbX; }, [thumbX]);
  useEffect(() => { maxXRef.current = maxX; }, [maxX]);

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setMaxX(Math.max(0, el.clientWidth - THUMB - 4));
    };
    measure();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && trackRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(trackRef.current);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }
    return () => {
      if (ro) ro.disconnect();
      else if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const animateTo = useCallback((target, onDone) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const step = (now) => {
      const dt = Math.min(0.05, ((now || Date.now()) - last) / 1000);
      last = now || Date.now();
      const current = thumbXRef.current;
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        thumbXRef.current = target;
        setThumbX(target);
        animRef.current = null;
        if (onDone) onDone();
        return;
      }
      const next = current + diff * Math.min(1, dt * 14);
      thumbXRef.current = next;
      setThumbX(next);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const handlePointerDown = (e) => {
    if (disabled || confirming) return;
    e.preventDefault();
    e.stopPropagation();
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setDragging(true);
    startPointerXRef.current = e.clientX;
    startThumbRef.current = thumbXRef.current;
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startPointerXRef.current;
    const next = Math.max(0, Math.min(maxXRef.current, startThumbRef.current + dx));
    thumbXRef.current = next;
    setThumbX(next);
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const max = maxXRef.current;
    if (max > 0 && thumbXRef.current / max >= COMPLETE_RATIO) {
      animateTo(max, () => {
        try { haptic.warning(); } catch {}
        setConfirming(true);
        Promise.resolve(onConfirm && onConfirm()).catch(() => {}).finally(() => {
          setConfirming(false);
          animateTo(0);
        });
      });
    } else {
      animateTo(0);
    }
  };

  const progress = maxX > 0 ? thumbX / maxX : 0;
  const trackBg = `linear-gradient(90deg, rgba(239,68,68,${0.16 + progress * 0.30}) 0%, rgba(249,115,22,${0.10 + progress * 0.22}) 100%)`;

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: 48,
        borderRadius: 999,
        background: trackBg,
        border: '1px solid rgba(239,68,68,0.40)',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          color: 'rgba(252,165,165,0.95)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: confirming ? 0 : Math.max(0.18, 1 - progress * 1.4),
          transition: dragging ? 'none' : 'opacity 200ms ease',
        }}
      >
        {confirming ? 'Forfeiting…' : 'Slide to forfeit'}
      </div>
      <div
        role="button"
        aria-label="Slide to forfeit battle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => { e.stopPropagation(); }}
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          boxShadow: '0 4px 14px rgba(239,68,68,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          transform: `translateX(${thumbX}px)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
          cursor: disabled || confirming ? 'not-allowed' : 'grab',
          touchAction: 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

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
  const status = youVsState?.status || 'idle';
  const myProfile = youVsState?.myProfile || null;
  const opponent = youVsState?.opponent || null;
  const matchup = youVsState?.matchup || null;
  const queueEntry = youVsState?.queueEntry || null;
  const initialTimeRemaining = youVsState?.timeRemaining ?? null;

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
  let metaRight = `1v1 · $${buyIn} · ${selectedGameMode.label}`;
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
    metaRight = timeLeftMs > 0 ? formatTimeRemaining(timeLeftMs) : 'Live now';
    progressLabel = `${progressPercent.toFixed(0)}% complete`;
  } else if (isWaiting) {
    topLabel = 'Waiting';
    topDotColor = '#f59e0b';
    ctaText = 'Open Lobby';
    const lobbyAge = startsAt ? Math.max(0, now - new Date(startsAt).getTime()) : 0;
    if (pot != null && lobbyAge > 0) {
      metaRight = `$${formatMoney(pot, 0)} · ${formatElapsed(lobbyAge)}`;
    } else if (pot != null) {
      metaRight = `$${formatMoney(pot, 0)} pot`;
    } else {
      metaRight = 'Awaiting opponent';
    }
    progressLabel = lobbyAge > 0 ? `Lobby open ${formatElapsed(lobbyAge)}` : 'Lobby ready';
  } else if (isQueued) {
    topLabel = 'Searching';
    topDotColor = '#06b6d4';
    ctaText = 'View Queue';
    const queueAge = queuedAt ? Math.max(0, now - new Date(queuedAt).getTime()) : 0;
    if (pot != null && queueAge > 0) {
      metaRight = `$${formatMoney(pot, 0)} · ${formatElapsed(queueAge)}`;
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
    if (onClick) onClick();
    else router.push('/battle');
  };

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
      <div className="p-2 sm:p-3.5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
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
            className="relative flex flex-1 flex-col items-center justify-center text-center py-2 sm:py-3 select-none min-h-0 sm:min-h-[160px] overflow-hidden"
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
            <div
              className="hero-arena relative flex flex-col flex-1 mt-0.5 mb-1.5 sm:mb-2 rounded-lg overflow-hidden"
              style={{
                minHeight: 138,
                background:
                  'radial-gradient(120% 90% at 50% 35%, rgba(16,185,129,0.30) 0%, rgba(6,182,212,0.16) 35%, rgba(13,13,13,0) 70%), radial-gradient(80% 60% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0a1413 0%, #050a0c 100%)',
                border: '1.5px solid rgba(16,185,129,0.35)',
                boxShadow:
                  'inset 0 0 0 1px rgba(16,185,129,0.18), inset 0 16px 24px rgba(0,0,0,0.45)',
              }}
            >
              {/* Arena floor lines — faint perspective hint at the
                  bottom edge so the radial gradient reads as an arena
                  pit rather than a flat panel. */}
              <svg
                className="absolute inset-x-0 bottom-0 pointer-events-none w-full"
                height="48"
                viewBox="0 0 380 48"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{ opacity: 0.5 }}
              >
                <defs>
                  <linearGradient id="hero-arena-grid" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(16,185,129,0)" />
                    <stop offset="100%" stopColor="rgba(16,185,129,0.55)" />
                  </linearGradient>
                </defs>
                <g stroke="url(#hero-arena-grid)" strokeWidth="0.6" fill="none">
                  <line x1="0" y1="48" x2="380" y2="48" />
                  <line x1="0" y1="36" x2="380" y2="36" />
                  <line x1="0" y1="24" x2="380" y2="24" />
                </g>
              </svg>
              {/* Diagonal sheen sweeping across the arena. */}
              <div className="hero-sweep absolute inset-0 pointer-events-none" aria-hidden="true" />

              {/* Fighter row */}
              <div className="relative flex items-start justify-between gap-1 px-2 pt-2.5 sm:pt-3">
                {/* You — emerald/cyan corner */}
                <div className="flex flex-col items-center min-w-0 flex-1">
                  <div className="relative" style={{ width: 64, height: 64 }}>
                    <span
                      className="hero-ring hero-ring-you absolute inset-0 rounded-full"
                      aria-hidden="true"
                    />
                    <span
                      className="hero-ring hero-ring-you absolute inset-0 rounded-full"
                      aria-hidden="true"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)',
                        padding: 3,
                        border: '2.5px solid #0d0d0d',
                        boxShadow:
                          '0 4px 0 rgba(0,0,0,0.55), 0 0 16px rgba(16,185,129,0.55)',
                      }}
                    >
                      <div className="rounded-full overflow-hidden w-full h-full bg-black flex items-center justify-center">
                        <UserAvatar user={youUser} size={52} />
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-1 px-1.5 py-0.5 rounded-md max-w-full"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(6,182,212,0.45))',
                      border: '1.5px solid #0d0d0d',
                      boxShadow: '0 2px 0 rgba(0,0,0,0.55)',
                    }}
                  >
                    <span
                      className="block text-[10px] font-black uppercase tracking-wider truncate text-center"
                      style={{
                        color: '#fff',
                        textShadow: '1px 1px 0 #0d0d0d',
                        maxWidth: 110,
                      }}
                    >
                      {youUser.username}
                    </span>
                  </div>
                </div>

                {/* Cartoon VS centerpiece */}
                <div className="relative flex flex-col items-center justify-center px-1 flex-shrink-0 self-center">
                  <span
                    className="hero-vs text-3xl sm:text-4xl font-black italic leading-none"
                    style={{
                      color: '#fff',
                      WebkitTextStroke: '2px #0d0d0d',
                      textShadow:
                        '3px 3px 0 #0d0d0d, 0 0 18px rgba(251,191,36,0.55)',
                      letterSpacing: '-0.04em',
                      fontFamily: 'Impact, "Arial Black", sans-serif',
                    }}
                  >
                    VS
                  </span>
                </div>

                {/* Opponent — orange/red corner */}
                <div className="flex flex-col items-center min-w-0 flex-1">
                  <div className="relative" style={{ width: 64, height: 64 }}>
                    <span
                      className="hero-ring hero-ring-opp absolute inset-0 rounded-full"
                      aria-hidden="true"
                    />
                    <span
                      className="hero-ring hero-ring-opp absolute inset-0 rounded-full"
                      aria-hidden="true"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                        padding: 3,
                        border: '2.5px solid #0d0d0d',
                        boxShadow:
                          '0 4px 0 rgba(0,0,0,0.55), 0 0 16px rgba(239,68,68,0.55)',
                      }}
                    >
                      <div className="rounded-full overflow-hidden w-full h-full bg-black flex items-center justify-center">
                        {showOpponent ? (
                          <UserAvatar
                            user={{
                              id: opponent.id,
                              username: opponent.username,
                              avatar: opponent.avatar,
                            }}
                            size={52}
                          />
                        ) : (
                          <SilhouetteAvatar
                            gradient={['#fbbf24', '#f97316']}
                            size={52}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-1 px-1.5 py-0.5 rounded-md max-w-full"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(239,68,68,0.55), rgba(249,115,22,0.45))',
                      border: '1.5px solid #0d0d0d',
                      boxShadow: '0 2px 0 rgba(0,0,0,0.55)',
                    }}
                  >
                    <span
                      className="block text-[10px] font-black uppercase tracking-wider truncate text-center"
                      style={{
                        color: '#fff',
                        textShadow: '1px 1px 0 #0d0d0d',
                        maxWidth: 110,
                      }}
                    >
                      {showOpponent ? opponent?.username || 'Opponent' : 'Opponent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prize plate — pot styled as a prize callout so a
                  glance reads "this match is worth $X". Falls back to
                  a green "Live now" plate if no pot data is available
                  so the bottom of the arena is never empty. */}
              <div className="relative flex justify-center mt-auto pb-2 pt-1.5">
                {pot != null ? (
                  <div
                    className="hero-prize relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{
                      background:
                        'linear-gradient(135deg, #facc15 0%, #f59e0b 60%, #ea580c 100%)',
                      border: '2.5px solid #0d0d0d',
                      boxShadow:
                        '0 4px 0 rgba(0,0,0,0.55), 0 0 22px rgba(251,191,36,0.65)',
                    }}
                    aria-label={`Prize pot $${formatMoney(pot, 0)}`}
                  >
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: '#2a1404' }}
                    >
                      Pot
                    </span>
                    <span
                      className="text-base sm:text-lg font-black tabular-nums"
                      style={{
                        color: '#fff',
                        WebkitTextStroke: '1.5px #0d0d0d',
                        textShadow: '2px 2px 0 #0d0d0d',
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                        fontFamily: 'Impact, "Arial Black", sans-serif',
                      }}
                    >
                      ${formatMoney(pot, 0)}
                    </span>
                  </div>
                ) : (
                  <div
                    className="hero-prize inline-flex items-center px-3 py-1 rounded-full"
                    style={{
                      background:
                        'linear-gradient(135deg, #34d399, #10b981)',
                      border: '2.5px solid #0d0d0d',
                      boxShadow: '0 3px 0 rgba(0,0,0,0.55)',
                    }}
                  >
                    <span
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: '#022c1f' }}
                    >
                      Live Now
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Match progress — kept so the active card still tells
                time-of-match. Visually unchanged from before so the
                rail stays familiar. */}
            <div
              className="h-1 rounded-full overflow-hidden mb-1 sm:mb-2"
              style={{ background: '#1a1a1a' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
              ></div>
            </div>

            {/* Footer — Preview toggle stays in the same place as
                before so the existing expand/collapse interaction
                is preserved. */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-[10px]">{progressLabel}</span>
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            </div>
          </>
        ) : isIdle ? (
          // Graffiti / cartoon PLAY NOW treatment — the sticker is the
          // focal point of the card. The buy-in / game-mode / pot
          // chips that used to live here moved into the confirmation
          // popup so the home card can lead with the call to action
          // and a short explainer of what tapping it actually does.
          <div className="flex flex-1 flex-col items-center justify-center text-center py-2 sm:py-3 select-none min-h-0 sm:min-h-[148px]">
            <div className="relative inline-flex items-center justify-center mb-2 sm:mb-3 h-[58px] sm:h-[100px]">
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
                className="youvs-play-sticker relative inline-flex items-center justify-center px-5 py-2 sm:px-8 sm:py-3 rounded-2xl sm:rounded-3xl"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)',
                  border: '4px solid #0d0d0d',
                  boxShadow: '0 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(251,146,60,0.6)',
                }}
              >
                <span
                  className="text-2xl sm:text-5xl font-black tracking-tight leading-none"
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
            <p className="text-sm sm:text-base font-extrabold text-white leading-tight px-2">
              Tap to face anyone in a 1v1
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 px-3 leading-snug">
              Pick your stake &amp; mode in the next step
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
            <div className="flex items-center justify-between mb-1.5 sm:mb-3">
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

            <div className="h-1 rounded-full overflow-hidden mb-1 sm:mb-2 mt-auto" style={{ background: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
              ></div>
            </div>
            <div className="flex items-center justify-between">
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
            <div className="px-3.5 pt-3 pb-2 flex items-center gap-1.5">
              <div
                className={topDotColor === '#f59e0b' || topDotColor === '#06b6d4' ? 'pick-pending-dot' : ''}
                style={{ width: 6, height: 6, borderRadius: '50%', background: topDotColor, boxShadow: `0 0 6px ${topDotColor}` }}
              ></div>
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: topDotColor }}>
                {expandedHeadline}
              </span>
            </div>

            <div className="px-3.5 pb-3">
              <div
                className="rounded-md px-3 py-2 text-[11px] text-gray-400 leading-snug"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}
              >
                {expandedBody}
              </div>
            </div>

            <div className="px-3.5 pb-3.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNavigate(); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
                }}
              >
                {ctaText}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
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
    <BattleModeChooser
      isOpen={showChooser}
      onClose={() => setShowChooser(false)}
      onPickQuickMatch={handleChooserQuickMatch}
      onPickChallengeFriend={handleChooserChallengeFriend}
      onPickPrivateMatch={handleChooserPrivateMatch}
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
        // to the dashboard to start picking.
        setTimeout(() => router.push('/?battleStarted=true'), 1200);
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
      if (isRetry) setLoadStatus('retrying');
      else if (isInitial) setLoadStatus('loading');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('/api/battles/live', { signal: controller.signal });
        if (!res.ok) {
          if (!cancelled) setLoadStatus('failed');
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
        if (!cancelled) setLoadStatus('failed');
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
        {/* items-stretch (instead of items-start) lets every card in the
            horizontal carousel match the tallest sibling's height. Without
            this, a battle whose players haven't both locked in their picks
            renders shorter than one with picks (since the picks row + the
            "🎯 X vs Y piks" cartoon chip are conditional), which made the
            "awaiting" cards look out of place next to fully-locked battles
            and the YouVsCard. The cards themselves already use w-full h-full
            on their outer wrapper, so they fill the stretched parent
            cleanly. */}
        <div className="flex gap-3 items-stretch overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex-shrink-0 w-[380px] flex">
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
          {compactBattles.map(battle => (
            <div key={battle.id} className="flex-shrink-0 w-[380px] flex">
              <BattleCard
                battle={battle}
                compact
                isExpanded={expandedKey === battle.id}
                onToggle={() => toggleExpandedKey(battle.id)}
              />
            </div>
          ))}
        </div>
        <QuickMatchModal
          isOpen={!!matchFoundData}
          onClose={() => setMatchFoundData(null)}
          userId={currentUserId}
          presetMatch={matchFoundData}
          onMatchFound={() => {
            // Continue button on the standard match-found popup
            // lands the user back on the dashboard so they can
            // immediately start making picks for their new battle —
            // mirrors the modal's own default redirect target.
            setMatchFoundData(null);
            router.push('/?battleStarted=true');
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
