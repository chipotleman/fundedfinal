import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';

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
        border: `1px solid ${isWon ? 'rgba(16, 185, 129, 0.3)' : isLost ? 'rgba(239, 68, 68, 0.3)' : '#1a1a1a'}`,
        background: isWon ? 'rgba(16, 185, 129, 0.06)' : isLost ? 'rgba(239, 68, 68, 0.06)' : '#111',
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
          <span style={{ color: '#ffffff', fontSize: compact ? '10px' : '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>{pick.team}</span>
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
          border: isWinning ? '2px solid #10b981' : '2px solid #333',
        }}
      >
        {user.avatar ? (
          <img src={user.avatar} className="w-full h-full object-cover" alt="" style={{ borderRadius: '50%' }} />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>{user.username?.[0]?.toUpperCase() || '?'}</span>
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
  const picks = SIMULATED_PICKS[battle.id];

  const user1OnFire = parseFloat(user1.pnlPercent) > 10;
  const user2OnFire = parseFloat(user2.pnlPercent) > 10;

  if (compact) {
    return (
      <div
        className="flex-shrink-0 w-[360px] rounded-xl p-3 cursor-pointer flex flex-col"
        onClick={() => router.push(`/battle?battle=${battle.id}`)}
        style={{
          backgroundColor: '#0d0d0d',
          border: '1px solid #1a1a1a',
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
              <p className="text-white text-[11px] font-medium truncate max-w-[120px] flex items-center gap-0.5">
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
              <p className="text-white text-[11px] font-medium truncate max-w-[120px] flex items-center justify-end gap-0.5">
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <PnlBadge pnlPercent={user2.pnlPercent} size="small" />
            </div>
            <PlayerAvatar user={user2} isWinning={user2Winning} size={30} bgColor="#065f46" />
          </div>
        </div>
        {picks && (
          <div className="mt-2 flex gap-1">
            <div className="flex-1 min-w-0">
              {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
            </div>
            <span className="text-gray-600 text-[9px] self-center px-0.5">vs</span>
            <div className="flex-1 min-w-0">
              {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} compact />)}
            </div>
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
        backgroundColor: '#0d0d0d',
        border: focused ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid #1a1a1a',
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
              <p className="text-white text-sm font-medium truncate flex items-center gap-1">
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white text-sm font-bold tabular-nums">${(user1.balance || 0).toLocaleString()}</span>
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
              <p className="text-white text-sm font-medium truncate flex items-center justify-end gap-1">
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <div className="flex items-center gap-2 justify-end mt-0.5">
                <span className="text-white text-sm font-bold tabular-nums">${(user2.balance || 0).toLocaleString()}</span>
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

        {!picks && (
          <div className="mb-2 flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 pick-pending-dot"></div>
              <span className="text-[10px] text-gray-500 font-medium">Awaiting picks from both players...</span>
            </div>
            <span className="text-[9px] text-gray-600">0P vs 0P</span>
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
            <div style={{ borderTop: '1px solid #1a1a1a' }}>
              <div className="grid grid-cols-2 relative">
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: '#1a1a1a' }}></div>

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
      `}</style>
    </div>
  );
}

export default function LiveBattlesSection({ compact = false, focusBattleId = null }) {
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
        const liveBattles = (data.battles || []).filter(b => b.user2 && b.remainingMs > 0);
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
  }, [avatars]);

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
            className="rounded-xl p-4 cursor-pointer group transition-all duration-300"
            onClick={() => router.push('/battle')}
            style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Start a 1v1 Battle</p>
                <p className="text-gray-500 text-[11px]">Challenge an opponent</p>
              </div>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
          className="rounded-xl p-6 text-center cursor-pointer group transition-all duration-300"
          style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
          onClick={() => {
            const startBtn = document.querySelector('.battle-start-btn');
            if (startBtn) startBtn.click();
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-0.5">No live battles yet</p>
              <p className="text-gray-500 text-xs">Tap to start one and be the first</p>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium group-hover:gap-2.5 transition-all">
              <span>Start a Battle</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
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
