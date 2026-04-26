import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';
import QuickMatchModal from './QuickMatchModal';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../UserAvatar';
import MutualFriendsLine from '../social/MutualFriendsLine';
import { useProfileCacheOptional } from '../../contexts/ProfileCacheContext';
import { useMatchup } from '../../contexts/MatchupContext';
import { getBattleStreamClient } from '../../lib/battleStreamClient';

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
  const progress = battle.progressPercent || 0;
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
        className={`w-full rounded-xl cursor-pointer flex flex-col ${focused ? 'live-battle-highlight' : ''}`}
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
        <div className="p-3.5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400">${formatMoney(potSize, 0)}</span>
              <span className="text-gray-600 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
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
            <div className="flex gap-1 mb-2" style={{ minHeight: '32px' }}>
              <div className="flex-1 min-w-0">
                {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
              <span className="text-gray-600 text-[9px] self-center px-0.5">vs</span>
              <div className="flex-1 min-w-0">
                {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
              </div>
            </div>
          ) : picksLocked ? (
            <div className="mb-2 flex items-center gap-1.5 px-2 py-2 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '32px' }}>
              <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[9px] text-gray-500 truncate">{onlyUser1 ? `${user1.username || 'P1'} locked` : `${user2.username || 'P2'} locked`} · awaiting other</span>
            </div>
          ) : (
            <div className="mb-2 flex items-center gap-1.5 px-2 py-2 rounded-md" style={{ background: '#111', border: `1px solid ${'#1a1a1a'}`, minHeight: '32px' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
              <span className="text-[9px] text-gray-500">Awaiting picks...</span>
            </div>
          )}

          <div className="mt-auto">
            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}
              ></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-[10px]">{progress.toFixed(0)}% complete</span>
              <span className="text-[11px] font-medium text-blue-400 flex items-center gap-1">
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

        <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: '#1a1a1a' }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: '#3b82f6' }}></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600 text-[10px]">{progress.toFixed(0)}% complete</span>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/battle?battle=${battle.id}`); }}
            className="text-[11px] font-medium text-blue-400"
          >
            Watch
          </button>
        </div>
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
  { gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { gradient: 'linear-gradient(135deg, #f59e0b, #ec4899)' },
  { gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
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
// smallest available buy-in and the fastest mode so a tap on the
// graffiti "PLAY NOW" sticker drops the user into the lightest commit
// path. The QuickMatchModal still drives any other entry point with
// its own config screen.
const ONE_TAP_BUY_IN = 5;
const ONE_TAP_GAME_MODE = 'rush';

function YouVsCard({ youVsState, onClick, isExpanded = false, onToggle = null, onMatchFound = null }) {
  const router = useRouter();
  const { refresh: refreshMatchup } = useMatchup();
  const [cancelling, setCancelling] = useState(false);
  const status = youVsState?.status || 'idle';
  const myProfile = youVsState?.myProfile || null;
  const opponent = youVsState?.opponent || null;
  const matchup = youVsState?.matchup || null;
  const queueEntry = youVsState?.queueEntry || null;
  const initialTimeRemaining = youVsState?.timeRemaining ?? null;

  const isActive = status === 'active';
  const isWaiting = status === 'waiting';
  const isQueued = status === 'queued';
  const showOpponent = !!opponent && (isActive || isWaiting || isQueued);
  const isIdle = !isActive && !isWaiting && !isQueued;

  // In-card matchmaking state. Drives the new "finding battle" animation
  // that plays inside the card before the standard match-found popup
  // takes over. `idle` means we're showing the graffiti PLAY NOW
  // treatment; `searching` means we're polling for a match; `error`
  // shows a brief inline message before snapping back to idle.
  const [searchState, setSearchState] = useState('idle');
  const [searchError, setSearchError] = useState('');
  const [searchTimer, setSearchTimer] = useState(0);
  const [shuffleTick, setShuffleTick] = useState(0);
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
  }, [isIdle, searchState, cleanupSearchTimers]);

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

  let topLabel = 'Play Now';
  let topDotColor = '#fbbf24';
  let ctaText = 'Tap to Start a 1v1';
  let metaRight = '1v1 · $5';
  let progressLabel = 'Tap to start a 1v1';

  if (searchState === 'searching') {
    topLabel = 'Searching…';
    topDotColor = '#06b6d4';
    metaRight = `${searchTimer}s`;
  } else if (isActive) {
    topLabel = 'In Battle';
    topDotColor = '#10b981';
    ctaText = 'View Battle';
    if (pot != null && timeLeftMs > 0) {
      metaRight = `$${formatMoney(pot, 0)} · ${formatTimeRemaining(timeLeftMs)}`;
    } else if (pot != null) {
      metaRight = `$${formatMoney(pot, 0)} pot`;
    } else if (timeLeftMs > 0) {
      metaRight = formatTimeRemaining(timeLeftMs);
    } else {
      metaRight = 'Live now';
    }
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
      onMatchFound({
        opponent: opp || null,
        matchup: foundMatchup,
        buyIn: ONE_TAP_BUY_IN,
        gameMode: ONE_TAP_GAME_MODE,
      });
    }
    try { refreshMatchup(); } catch {}
  }, [cleanupSearchTimers, onMatchFound, refreshMatchup]);

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
    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn: ONE_TAP_BUY_IN, gameMode: ONE_TAP_GAME_MODE }),
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
  }, [cleanupSearchTimers, handleInCardMatchFound, handleSearchError, pollForInCardMatch]);

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

  const handleCardTap = () => {
    if (isIdle) {
      // While searching, the card is "busy" — only the explicit cancel
      // affordance should escape, never the card-wide tap.
      if (searchState === 'searching') return;
      // Clear any lingering cancel/error inline notice from the
      // previous attempt so the new search starts visually clean.
      if (cancelNoticeTimerRef.current) {
        clearTimeout(cancelNoticeTimerRef.current);
        cancelNoticeTimerRef.current = null;
      }
      setSearchError('');
      // Authenticated users get the new in-card matchmaking flow.
      // Signed-out users (no profile yet) fall back to navigating to
      // /battle so they can sign in / pick a mode there.
      if (myProfile?.id && onMatchFound) {
        startInCardSearch();
      } else {
        handleNavigate();
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

  return (
    <div
      className="youvs-card rounded-xl overflow-hidden cursor-pointer w-full flex flex-col relative"
      onClick={handleCardTap}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={
        isIdle
          ? 'Your battle — Tap to start a 1v1'
          : `Your battle — ${topLabel}. Tap to ${isExpanded ? 'hide' : 'show'} preview.`
      }
      aria-expanded={isIdle ? undefined : isExpanded}
      style={{
        background:
          'linear-gradient(180deg, rgba(139,92,246,0.14) 0%, rgba(6,182,212,0.08) 45%, rgba(13,13,13,0.95) 100%), #0d0d0d',
        border: isExpanded
          ? '1.5px solid rgba(167, 139, 250, 0.85)'
          : '1.5px solid rgba(139, 92, 246, 0.65)',
        boxShadow:
          '0 0 0 1px rgba(139,92,246,0.15) inset, 0 0 18px rgba(139,92,246,0.28), 0 0 32px rgba(6,182,212,0.12)',
        transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease-out, border-color 180ms ease-out',
        outline: 'none',
        willChange: 'transform',
      }}
    >
      <style jsx>{`
        @keyframes youvsAccentSlide {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
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
        :global(.youvs-dot) {
          animation: youvsDotsPulse 1.2s ease-in-out infinite;
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
          :global(.youvs-dot) {
            animation: none !important;
          }
        }
        .youvs-card:focus-visible {
          border-color: rgba(167, 139, 250, 0.95) !important;
          box-shadow:
            0 0 0 3px rgba(139, 92, 246, 0.55),
            0 0 0 5px rgba(6, 182, 212, 0.45),
            0 0 24px rgba(139, 92, 246, 0.45),
            0 0 40px rgba(6, 182, 212, 0.28) !important;
        }
        @media (hover: hover) {
          .youvs-card:hover {
            transform: translateY(-3px);
            border-color: rgba(167, 139, 250, 0.95) !important;
            box-shadow:
              0 0 0 1px rgba(139, 92, 246, 0.3) inset,
              0 0 28px rgba(139, 92, 246, 0.55),
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
            border-color: rgba(167, 139, 250, 0.95) !important;
            box-shadow:
              0 0 0 1px rgba(139, 92, 246, 0.3) inset,
              0 0 24px rgba(139, 92, 246, 0.5),
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
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6)',
          backgroundSize: '200% 100%',
          animation: 'youvsAccentSlide 3.5s linear infinite',
        }}
      />
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[9px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                color: '#fff',
                boxShadow: '0 0 10px rgba(139,92,246,0.45)',
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
          // In-card "finding battle" animation. Stays inside the same
          // card footprint — no navigation, no modal — until matchmaking
          // resolves and the standard match-found popup takes over.
          <div className="flex flex-col items-center justify-center text-center py-2 select-none" style={{ minHeight: 148 }}>
            <div
              className="relative flex items-center justify-center mb-2.5"
              style={{ width: 96, height: 96 }}
              aria-hidden="true"
            >
              <div
                className="youvs-ring absolute"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(6,182,212,0.55)',
                }}
              />
              <div
                className="youvs-ring absolute"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(139,92,246,0.45)',
                  animationDelay: '0.6s',
                }}
              />
              <div
                className="youvs-radar absolute"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.35) 60deg, transparent 120deg)',
                }}
              />
              <div
                key={shuffleTick}
                className="youvs-shuffle relative"
                style={{
                  borderRadius: '50%',
                  padding: 2,
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.65), rgba(139,92,246,0.65))',
                }}
              >
                <SilhouetteAvatar
                  gradient={ANONYMOUS_OPPONENTS[shuffleTick % ANONYMOUS_OPPONENTS.length].gradient}
                  size={56}
                />
              </div>
            </div>
            <p className="text-sm font-bold text-white mb-0.5">Finding your battle…</p>
            <div className="flex items-center gap-1.5 mb-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="youvs-dot inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancelInCardSearch(); }}
              className="px-3 py-1 text-[11px] font-medium text-gray-300 hover:text-red-400 rounded-lg transition-colors"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
              aria-label="Cancel matchmaking"
            >
              Cancel
            </button>
          </div>
        ) : isIdle ? (
          // Graffiti / cartoon PLAY NOW treatment — replaces the
          // cycling fake-opponent layout. This is the new single
          // eye-catching "play anyone" visual.
          <div className="flex flex-col items-center justify-center text-center py-2 select-none" style={{ minHeight: 148 }}>
            <div className="relative inline-flex items-center justify-center mb-2.5" style={{ height: 76 }}>
              <svg
                className="absolute pointer-events-none"
                width="180"
                height="60"
                viewBox="0 0 180 60"
                aria-hidden="true"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <g stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85">
                  <line className="youvs-motion-line" x1="6" y1="14" x2="30" y2="14" />
                  <line className="youvs-motion-line" x1="2" y1="30" x2="34" y2="30" style={{ animationDelay: '0.2s' }} />
                  <line className="youvs-motion-line" x1="6" y1="46" x2="30" y2="46" style={{ animationDelay: '0.4s' }} />
                  <line className="youvs-motion-line" x1="150" y1="14" x2="174" y2="14" style={{ animationDelay: '0.1s' }} />
                  <line className="youvs-motion-line" x1="146" y1="30" x2="178" y2="30" style={{ animationDelay: '0.3s' }} />
                  <line className="youvs-motion-line" x1="150" y1="46" x2="174" y2="46" style={{ animationDelay: '0.5s' }} />
                </g>
              </svg>

              <div
                className="youvs-play-sticker relative inline-flex items-center justify-center px-5 py-2 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ec4899 100%)',
                  border: '3px solid #0d0d0d',
                  boxShadow: '0 5px 0 rgba(0,0,0,0.55), 0 0 22px rgba(251,146,60,0.55)',
                }}
              >
                <span
                  className="text-3xl font-black tracking-tight leading-none"
                  style={{
                    color: '#fff',
                    WebkitTextStroke: '1.5px #0d0d0d',
                    textShadow: '2px 2px 0 #0d0d0d',
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
                  top: -10,
                  right: -8,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: '#10b981',
                  border: '2px solid #0d0d0d',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.55)',
                }}
              >
                <span
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: '#0d0d0d', letterSpacing: '0.05em' }}
                >
                  1v1
                </span>
              </div>

              <span
                className="youvs-spark absolute text-lg"
                style={{ top: -8, left: -10, filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.7))' }}
                aria-hidden="true"
              >
                ⚡
              </span>
              <span
                className="youvs-spark absolute text-base"
                style={{ bottom: -6, right: 4, animationDelay: '0.6s', filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.7))' }}
                aria-hidden="true"
              >
                ✦
              </span>
            </div>
            <p className="text-sm font-extrabold text-white">
              Tap to face anyone in a 1v1
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Random opponent · ${ONE_TAP_BUY_IN} buy-in · Instant match
            </p>
            {searchError && (
              <p
                className={`text-[10px] font-medium mt-1.5 ${
                  searchError === 'Matchmaking cancelled.' ? 'text-gray-400' : 'text-red-400'
                }`}
                role="status"
              >
                {searchError}
              </p>
            )}
          </div>
        ) : (
          // Active / waiting / queued — unchanged from the existing
          // layout per the task contract.
          <>
            <div className="flex items-center justify-between mb-3">
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
                  style={{ backgroundImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}
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

            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
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
                  style={{ color: '#a78bfa' }}
                >
                  {isExpanded ? 'Hide' : 'Preview'}
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveBattlesSection({ compact = false, focusBattleId = null, currentUserId = null, youVsState = null, onYouVsClick = null }) {
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
        <div className="flex gap-3 items-stretch overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex-shrink-0 w-[380px] flex">
            <YouVsCard
              youVsState={youVsState}
              onClick={onYouVsClick}
              isExpanded={expandedKey === 'youvs'}
              onToggle={() => toggleExpandedKey('youvs')}
              onMatchFound={(data) => setMatchFoundData(data)}
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
            // jumps the user to /battle so they land in the lobby
            // exactly as they would after the modal's own flow.
            setMatchFoundData(null);
            router.push('/battle');
          }}
        />
      </div>
    );
  }

  return (
    <div className="mb-6">
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
