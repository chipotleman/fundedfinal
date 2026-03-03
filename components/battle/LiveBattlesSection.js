import { useState, useEffect, useCallback } from 'react';
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

function PickPill({ pick }) {
  const statusColor = pick.status === 'won' ? 'text-green-400 bg-green-500/10 border-green-500/20' 
    : pick.status === 'lost' ? 'text-red-400 bg-red-500/10 border-red-500/20' 
    : 'text-gray-300 bg-white/5 border-white/10';
  const statusIcon = pick.status === 'won' ? '✓' : pick.status === 'lost' ? '✗' : '•';
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${statusColor}`}>
      <span className="opacity-70">{statusIcon}</span>
      <span className="font-semibold">{pick.team}</span>
      <span className="opacity-60">{pick.type}</span>
      <span className="opacity-50">({pick.odds})</span>
    </div>
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

  if (compact) {
    return (
      <div className="flex-shrink-0 w-[280px] bg-gradient-to-br from-gray-900/80 to-gray-800/40 border border-gray-700/30 rounded-xl p-3 transition-all cursor-pointer"
        onClick={() => router.push(`/battle?battle=${battle.id}`)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-bold uppercase">Live</span>
          </div>
          <span className="text-gray-400 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs overflow-hidden ${user1Winning ? 'ring-1 ring-green-400' : ''} bg-gradient-to-br from-blue-600 to-blue-800`}>
              {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user1.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate max-w-[65px]">{user1.username || 'Player 1'}</p>
              <p className={`text-[10px] font-bold ${parseFloat(user1.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user1.pnlPercent) >= 0 ? '+' : ''}{user1.pnlPercent}%
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-yellow-400 text-[10px] font-black">VS</span>
            <span className="text-yellow-400/70 text-[9px]">${potSize.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 text-right">
              <p className="text-white text-xs font-medium truncate max-w-[65px]">{user2.username || 'Player 2'}</p>
              <p className={`text-[10px] font-bold ${parseFloat(user2.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user2.pnlPercent) >= 0 ? '+' : ''}{user2.pnlPercent}%
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs overflow-hidden ${user2Winning ? 'ring-1 ring-green-400' : ''} bg-gradient-to-br from-red-600 to-red-800`}>
              {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user2.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
          </div>
        </div>
        {picks && (
          <div className="mt-2 flex gap-1 overflow-hidden">
            <div className="flex gap-0.5 flex-wrap">
              {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} />)}
            </div>
            <span className="text-gray-600 text-[9px] self-center">vs</span>
            <div className="flex gap-0.5 flex-wrap">
              {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} />)}
            </div>
          </div>
        )}
        <BattleChat battleId={battle.id} compact />
        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-gradient-to-br from-gray-900/60 to-gray-800/40 border rounded-2xl overflow-hidden transition-all ${focused ? 'border-blue-500/60 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10' : 'border-gray-700/40'}`}
      onClick={() => picks && setExpanded(!expanded)}
      style={{ cursor: picks ? 'pointer' : 'default' }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs font-bold">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xs font-bold">${potSize.toFixed(0)} Pot</span>
            <span className="text-gray-500 text-xs">{formatTimeRemaining(timeLeft)} left</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0 ${user1Winning ? 'ring-2 ring-green-400 shadow-lg shadow-green-500/20' : 'ring-1 ring-gray-600'} bg-gradient-to-br from-blue-600 to-blue-800`}>
              {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user1.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">{user1.username || 'Player 1'}</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">${(user1.balance || 0).toLocaleString()}</span>
                <span className={`text-xs font-bold ${parseFloat(user1.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {parseFloat(user1.pnlPercent) >= 0 ? '+' : ''}{user1.pnlPercent}%
                </span>
              </div>
              {picks && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-gray-500 text-[10px]">{picks.user1.length} pick{picks.user1.length !== 1 ? 's' : ''}</span>
                  <span className="text-green-400 text-[10px]">{picks.user1.filter(p => p.status === 'won').length}W</span>
                  <span className="text-red-400 text-[10px]">{picks.user1.filter(p => p.status === 'lost').length}L</span>
                  <span className="text-gray-400 text-[10px]">{picks.user1.filter(p => p.status === 'pending').length}P</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-3 flex flex-col items-center">
            <span className="text-yellow-400 text-lg font-black">VS</span>
            {picks && (
              <span className="text-gray-500 text-[9px] mt-0.5">{expanded ? 'Hide picks' : 'View picks'}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-white text-sm font-bold truncate">{user2.username || 'Player 2'}</p>
              <div className="flex items-center gap-2 justify-end">
                <span className={`text-xs font-bold ${parseFloat(user2.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {parseFloat(user2.pnlPercent) >= 0 ? '+' : ''}{user2.pnlPercent}%
                </span>
                <span className="text-gray-400 text-xs">${(user2.balance || 0).toLocaleString()}</span>
              </div>
              {picks && (
                <div className="flex items-center gap-1 mt-1 justify-end">
                  <span className="text-gray-500 text-[10px]">{picks.user2.length} pick{picks.user2.length !== 1 ? 's' : ''}</span>
                  <span className="text-green-400 text-[10px]">{picks.user2.filter(p => p.status === 'won').length}W</span>
                  <span className="text-red-400 text-[10px]">{picks.user2.filter(p => p.status === 'lost').length}L</span>
                  <span className="text-gray-400 text-[10px]">{picks.user2.filter(p => p.status === 'pending').length}P</span>
                </div>
              )}
            </div>
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0 ${user2Winning ? 'ring-2 ring-green-400 shadow-lg shadow-green-500/20' : 'ring-1 ring-gray-600'} bg-gradient-to-br from-red-600 to-red-800`}>
              {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user2.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
          </div>
        </div>

        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-[10px]">{progress.toFixed(0)}% complete</span>
          {!battle.simulated && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/battle?battle=${battle.id}`); }}
              className="text-blue-400 text-xs font-medium transition-colors"
            >
              Watch
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {picks && (
            <div className="border-t border-gray-700/40 bg-black/20">
              <div className="grid grid-cols-2 divide-x divide-gray-700/30">
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0">
                      {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[8px] text-white font-bold">{user1.username?.[0]}</span>}
                    </div>
                    <span className="text-white text-[11px] font-semibold truncate">{user1.username}'s Picks</span>
                  </div>
                  <div className="space-y-1.5">
                    {picks.user1.map((pick, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <PickPill pick={pick} />
                        <span className="text-gray-500 text-[9px]">${pick.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2 justify-end">
                    <span className="text-white text-[11px] font-semibold truncate">{user2.username}'s Picks</span>
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center flex-shrink-0">
                      {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[8px] text-white font-bold">{user2.username?.[0]}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {picks.user2.map((pick, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <PickPill pick={pick} />
                        <span className="text-gray-500 text-[9px]">${pick.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <BattleChat battleId={battle.id} />
        </>
      )}
    </div>
  );
}

export default function LiveBattlesSection({ compact = false, focusBattleId = null }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatars, setAvatars] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/battle-avatars')
      .then(res => res.ok ? res.json() : { avatars: [] })
      .then(data => {
        const all = data.avatars || [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        setAvatars(shuffled.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const fetchBattles = useCallback(async () => {
    try {
      const res = await fetch('/api/battles/live');
      if (res.ok) {
        const data = await res.json();
        let liveBattles = (data.battles || []).filter(b => b.user2 && b.remainingMs > 0);
        if (liveBattles.length === 0) {
          liveBattles = getSimulatedBattles(avatars);
        }
        setBattles(liveBattles);
      }
    } catch (err) {
      console.error('Error fetching live battles:', err);
      setBattles(getSimulatedBattles(avatars));
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{compact ? '🔥' : '⚔️'}</span>
          <h3 className={`font-bold ${compact ? 'text-sm' : 'text-base'} text-white`}>
            {compact ? 'Featured Battles' : 'Live Battles'}
          </h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <h3 className="font-bold text-sm text-white">Featured Battles</h3>
            {sortedBattles.length > 0 && (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sortedBattles.length}</span>
            )}
          </div>
          <button onClick={() => router.push('/battle')} className="text-blue-400 text-xs transition-colors">
            See All
          </button>
        </div>
        {sortedBattles.length === 0 ? (
          <div
            className="flex-shrink-0 w-[260px] bg-gradient-to-br from-gray-900/40 to-gray-800/20 border border-gray-700/20 rounded-xl p-4 cursor-pointer transition-all"
            onClick={() => router.push('/battle')}
          >
            <div className="text-center">
              <span className="text-2xl block mb-1">⚔️</span>
              <p className="text-gray-400 text-xs">No live battles right now.</p>
              <p className="text-blue-400 text-xs font-medium mt-1">Start one!</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
          <span className="text-xl">⚔️</span>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Live Battles</h3>
          {sortedBattles.length > 0 && (
            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sortedBattles.length} live</span>
          )}
        </div>
      </div>

      {sortedBattles.length === 0 ? (
        <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-8 text-center">
          <span className="text-3xl block mb-2">⚔️</span>
          <p className="text-gray-500 text-sm">No live battles right now</p>
          <p className="text-gray-600 text-xs mt-1">Start one and show everyone how it's done!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBattles.map(battle => (
            <BattleCard key={battle.id} battle={battle} focused={battle.id === focusBattleId} />
          ))}
        </div>
      )}
    </div>
  );
}
