import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { isDarkMode } = useTheme();
  const isWon = pick.status === 'won';
  const isLost = pick.status === 'lost';
  const isPending = pick.status === 'pending';

  const neutralBorder = isDarkMode ? '#1a1a1a' : '#e5e7eb';
  const neutralBg = isDarkMode ? '#111' : '#f9fafb';

  return (
    <div
      className="pick-chip-card"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '5px' : '8px',
        padding: compact ? '5px 7px' : '8px 10px',
        borderRadius: compact ? '6px' : '8px',
        border: `1px solid ${isWon ? 'rgba(16, 185, 129, 0.3)' : isLost ? 'rgba(239, 68, 68, 0.3)' : neutralBorder}`,
        background: isWon ? 'rgba(16, 185, 129, 0.06)' : isLost ? 'rgba(239, 68, 68, 0.06)' : neutralBg,
      }}
    >
      <div
        style={{
          width: compact ? '18px' : '22px',
          height: compact ? '18px' : '22px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isWon ? 'rgba(16, 185, 129, 0.2)' : isLost ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
          border: `1.5px solid ${isWon ? '#10b981' : isLost ? '#ef4444' : '#4b5563'}`,
        }}
      >
        {isWon && <svg width={compact ? "10" : "12"} height={compact ? "10" : "12"} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isLost && <svg width={compact ? "10" : "12"} height={compact ? "10" : "12"} viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isPending && <div className="pick-pending-dot" style={{ width: compact ? '5px' : '6px', height: compact ? '5px' : '6px', borderRadius: '50%', background: '#6b7280' }}></div>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '4px' : '6px', marginBottom: compact ? '0px' : '2px' }}>
          <span style={{ color: isDarkMode ? '#ffffff' : '#111827', fontSize: compact ? '10px' : '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>{pick.team}</span>
          <span
            style={{
              fontSize: compact ? '8px' : '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              padding: compact ? '0px 3px' : '1px 5px',
              borderRadius: '3px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {pick.type}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '4px' : '8px' }}>
          <span style={{ color: '#3b82f6', fontSize: compact ? '11px' : '13px', fontWeight: 800 }}>{pick.odds}</span>
          <span style={{ color: '#6b7280', fontSize: compact ? '9px' : '10px', fontWeight: 500 }}>${pick.amount}</span>
        </div>
      </div>
    </div>
  );
}


function MomentumIcon() {
  return <span className="live-momentum-flame text-[10px]" title="On fire!">🔥</span>;
}

function PlayerAvatar({ user, isWinning, size = 44, bgColor = '#1e40af', onClick }) {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else if (user.id) {
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
          border: isWinning ? '2px solid #10b981' : `2px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
        }}
      >
        {user.avatar ? (
          <img src={user.avatar} className="w-full h-full object-cover" alt="" style={{ borderRadius: '50%' }} />
        ) : (
          <span className="font-bold" style={{ fontSize: size * 0.35, color: isDarkMode ? '#fff' : '#fff' }}>{user.username?.[0]?.toUpperCase() || '?'}</span>
        )}
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

function BattleCard({ battle, compact, focused }) {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(battle.remainingMs || 0);
  const [expanded, setExpanded] = useState(false);

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
    return (
      <div
        className="flex-shrink-0 w-[360px] rounded-xl p-3 cursor-pointer flex flex-col"
        onClick={() => router.push(`/battle?battle=${battle.id}`)}
        style={{
          backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff',
          border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`,
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-400">${potSize.toFixed(0)}</span>
            <span className="text-gray-600 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={30} bgColor="#1e40af" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate max-w-[120px] flex items-center gap-0.5" style={{ color: isDarkMode ? '#fff' : '#111' }}>
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <PnlBadge pnlPercent={user1.pnlPercent} size="small" />
            </div>
          </div>
          <div className="flex flex-col items-center px-1">
            <span className="text-[10px] font-bold text-gray-600">VS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-medium truncate max-w-[120px] flex items-center justify-end gap-0.5" style={{ color: isDarkMode ? '#fff' : '#111' }}>
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <PnlBadge pnlPercent={user2.pnlPercent} size="small" />
            </div>
            <PlayerAvatar user={user2} isWinning={user2Winning} size={30} bgColor="#065f46" />
          </div>
        </div>
        {picks ? (
          <div className="mt-2 flex gap-1" style={{ minHeight: '36px' }}>
            <div className="flex-1 min-w-0">
              {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
            </div>
            <span className="text-gray-600 text-[9px] self-center px-0.5">vs</span>
            <div className="flex-1 min-w-0">
              {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
            </div>
          </div>
        ) : picksLocked ? (
          <div className="mt-2 rounded-md" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, minHeight: '36px' }}>
            <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1">
              <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[9px] text-gray-500">Reveals when both lock in</span>
            </div>
            <div className="flex gap-1.5 px-2 pb-1.5">
              <div className={`flex-1 flex items-center gap-1 py-1 px-1.5 rounded text-[9px] font-medium truncate ${onlyUser1 ? 'text-green-400' : 'text-gray-600'}`} style={{ background: onlyUser1 ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                {onlyUser1 ? '✓' : '○'} {user1.username || 'Player 1'}
              </div>
              <div className={`flex-1 flex items-center justify-end gap-1 py-1 px-1.5 rounded text-[9px] font-medium truncate ${onlyUser2 ? 'text-green-400' : 'text-gray-600'}`} style={{ background: onlyUser2 ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                {user2.username || 'Player 2'} {onlyUser2 ? '✓' : '○'}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-2 rounded-md" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`, minHeight: '44px' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
            <span className="text-[9px] text-gray-500">Awaiting picks...</span>
          </div>
        )}
        <BattleChat battleId={battle.id} compact />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff',
        border: focused ? '1px solid rgba(6, 182, 212, 0.3)' : `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}`,
        boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div className="p-3.5" onClick={() => picks && setExpanded(!expanded)} style={{ cursor: picks ? 'pointer' : 'default' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-gray-400">${potSize.toFixed(0)} pot</span>
            <span className="text-gray-600 text-[11px]">{formatTimeRemaining(timeLeft)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={40} bgColor="#1e40af" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1" style={{ color: isDarkMode ? '#fff' : '#111' }}>
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold tabular-nums" style={{ color: isDarkMode ? '#fff' : '#111' }}>${(user1.balance || 0).toLocaleString()}</span>
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
              <p className="text-sm font-medium truncate flex items-center justify-end gap-1" style={{ color: isDarkMode ? '#fff' : '#111' }}>
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <div className="flex items-center gap-2 justify-end mt-0.5">
                <span className="text-sm font-bold tabular-nums" style={{ color: isDarkMode ? '#fff' : '#111' }}>${(user2.balance || 0).toLocaleString()}</span>
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
          <div className="mb-2 flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
              <span className="text-[10px] text-gray-500 font-medium">Awaiting picks from both players...</span>
            </div>
            <span className="text-[9px] text-gray-600">0P vs 0P</span>
          </div>
        )}

        {picksLocked && (
          <div className="mb-2 rounded-lg" style={{ background: isDarkMode ? '#111' : '#f3f4f6', border: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
            <div className="flex items-center gap-2 px-3 py-2">
              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              <span className="text-[10px] text-gray-500 font-medium">Reveals when both players lock in</span>
            </div>
            <div className="flex gap-2 px-3 pb-2.5">
              <div className="flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-md" style={{ background: onlyUser1 ? 'rgba(16,185,129,0.08)' : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'), border: onlyUser1 ? '1px solid rgba(16,185,129,0.2)' : `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
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
              <div className="flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-md" style={{ background: onlyUser2 ? 'rgba(16,185,129,0.08)' : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'), border: onlyUser2 ? '1px solid rgba(16,185,129,0.2)' : `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
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

        <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: isDarkMode ? '#1a1a1a' : '#e5e7eb' }}>
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
            <div style={{ borderTop: `1px solid ${isDarkMode ? '#1a1a1a' : '#e5e7eb'}` }}>
              <div className="grid grid-cols-2 relative">
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: isDarkMode ? '#1a1a1a' : '#e5e7eb' }}></div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{user1.username}'s Picks</span>
                  </div>
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

export default function LiveBattlesSection({ compact = false, focusBattleId = null, currentUserId = null }) {
  const { isDarkMode } = useTheme();
  const [battles, setBattles] = useState(() => getSimulatedBattles([]));
  const [avatars, setAvatars] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/battle-avatars')
      .then(res => res.ok ? res.json() : { avatars: [] })
      .then(data => {
        const all = data.avatars || [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        setAvatars(shuffled.slice(0, 6));
        setBattles(getSimulatedBattles(shuffled.slice(0, 6)));
      })
      .catch(() => {});
  }, []);

  const fetchBattles = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/battles/live', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const liveBattles = (data.battles || []).filter(b => {
          if (!b.user2 || b.remainingMs <= 0) return false;
          if (currentUserId && (String(b.user1?.id) === String(currentUserId) || String(b.user2?.id) === String(currentUserId))) return false;
          return true;
        });
        const simulated = getSimulatedBattles(avatars);
        if (liveBattles.length >= 3) {
          setBattles(liveBattles);
        } else if (liveBattles.length > 0) {
          const remaining = simulated.slice(0, 3 - liveBattles.length);
          setBattles([...liveBattles, ...remaining]);
        } else {
          setBattles(simulated);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching live battles:', err);
      }
    }
  }, [avatars, currentUserId]);

  useEffect(() => {
    fetchBattles();
    const interval = setInterval(fetchBattles, 30000);
    return () => clearInterval(interval);
  }, [fetchBattles]);

  const sortedBattles = focusBattleId
    ? [...battles].sort((a, b) => (a.id === focusBattleId ? -1 : b.id === focusBattleId ? 1 : 0))
    : battles;

  if (compact) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-500">Featured Battles</span>
            {sortedBattles.length > 0 && (
              <span className="text-green-400 text-[10px] font-semibold">{sortedBattles.length}</span>
            )}
          </div>
          <button onClick={() => router.push('/battle')} className="text-blue-400 text-xs">
            See All
          </button>
        </div>
        {sortedBattles.length === 0 ? (
          <div
            className="battle-cta-card rounded-xl cursor-pointer group transition-all duration-300 overflow-hidden relative"
            onClick={() => router.push('/battle')}
            style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1117 50%, #0a1628 100%)', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="battle-cta-particle" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(59,130,246,0.4)', position: 'absolute', top: '20%', left: '15%' }}></div>
              <div className="battle-cta-particle" style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(6,182,212,0.4)', position: 'absolute', top: '60%', left: '80%', animationDelay: '1s' }}></div>
              <div className="battle-cta-particle" style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(59,130,246,0.3)', position: 'absolute', top: '40%', left: '50%', animationDelay: '2s' }}></div>
              <div className="battle-cta-particle" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(16,185,129,0.3)', position: 'absolute', top: '75%', left: '30%', animationDelay: '0.5s' }}></div>
            </div>

            <div className="relative flex items-center justify-between px-4 py-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.15))', border: '2px solid rgba(59,130,246,0.4)' }}>
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">You</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>VS</span>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">1v1 Battle</span>
                <div className="flex items-center gap-1 mt-1 group-hover:gap-2 transition-all">
                  <span className="text-[11px] font-semibold text-blue-400">Tap to Start</span>
                  <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15))', border: '2px solid rgba(16,185,129,0.4)' }}>
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opponent</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 items-stretch overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {sortedBattles.map(battle => (
              <BattleCard key={battle.id} battle={battle} compact />
            ))}
          </div>
        )}
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
