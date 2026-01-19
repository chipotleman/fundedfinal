import { useState, useEffect } from 'react';
import { useLiveEvent } from '../hooks/useGoalserveLive';
import LiveFieldVisualization from './LiveFieldVisualization';

export default function LiveGameTracker({ gameId, sport = 'basketball_nba', initialData = null }) {
  const { event, isConnected, error } = useLiveEvent(gameId, { autoConnect: true });
  
  const [gameData, setGameData] = useState(initialData);

  useEffect(() => {
    if (event) {
      // Handle both formats: normalized (homeScore/awayScore) and raw (team1/team2)
      const homeScore = event.homeScore ?? event.team1?.score ?? 0;
      const awayScore = event.awayScore ?? event.team2?.score ?? 0;
      
      // Possession can be string 'home'/'away' or object {home: bool, away: bool}
      let possession = event.possession || event.stats?.possession;
      
      // Debug: Log all event data for live games (once per sport type)
      const debugKey = `_${sport}EventLogged`;
      if (!window[debugKey]) {
        window[debugKey] = true;
        console.log(`[${sport} Event Debug]`, JSON.stringify(event, null, 2));
      }
      
      if (typeof possession === 'string') {
        possession = { home: possession === 'home', away: possession === 'away' };
      }
      
      setGameData(prev => ({
        ...prev,
        homeScore,
        awayScore,
        status: event.stateCode || event.status,
        timer: event.timer || event.elapsedTime,
        displayClock: event.displayClock,
        period: event.period,
        possession: possession || { home: false, away: false },
        ballPosition: event.xy || event.ballPosition
      }));
    }
  }, [event]);

  const getPossessionTeam = () => {
    const poss = gameData?.possession;
    if (!poss) return null;
    
    // Handle both object format {home: true, away: false} and string format 'home'/'away'
    if (typeof poss === 'string') {
      if (poss === 'home') return initialData?.home_team || 'Home';
      if (poss === 'away') return initialData?.away_team || 'Away';
      return null;
    }
    if (poss?.home) return initialData?.home_team || 'Home';
    if (poss?.away) return initialData?.away_team || 'Away';
    return null;
  };
  
  // Get possession as simple 'home' or 'away' string for zone-based positioning
  const getPossessionString = () => {
    const poss = gameData?.possession;
    if (!poss) return null;
    
    if (typeof poss === 'string') return poss;
    if (poss?.home) return 'home';
    if (poss?.away) return 'away';
    return null;
  };

  // Use ballPosition from real-time event, fall back to initialData
  const ballPosition = gameData?.ballPosition || initialData?.ballPosition || null;
  const possessionTeam = getPossessionTeam();

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-white/70 text-sm">
            {isConnected ? 'LIVE' : error || 'Connecting...'}
          </span>
        </div>
        {(gameData?.timer || initialData?.displayClock) && (
          <span className="text-white font-mono text-sm">
            {gameData?.displayClock || initialData?.displayClock || 
              ((gameData?.period || initialData?.period) && `${gameData?.period || initialData?.period} `) + 
              (gameData?.timer || '')}
          </span>
        )}
      </div>

      <div className="p-4">
        <LiveFieldVisualization 
          game={{ 
            sport_key: sport,
            homeTeam: initialData?.home_team,
            awayTeam: initialData?.away_team
          }}
          ballPosition={ballPosition}
          possession={getPossessionString()}
          className="rounded-lg overflow-hidden border border-white/20"
        />

        {possessionTeam && (
          <div className="mt-3 text-center">
            <span className="text-white/60 text-sm">
              <span className="text-white font-medium">{possessionTeam}</span>
              {' '}In Possession
            </span>
          </div>
        )}

        {event?.comments?.[0] && (
          <div className="mt-2 text-center">
            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
              {event.comments[0].text || event.comments[0]}
            </span>
          </div>
        )}

        {event?.odds && event.odds.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Home ML</div>
              <div className="text-green-400 font-mono">
                {event.odds[0]?.home || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Total</div>
              <div className="text-white font-mono">
                {event.odds[0]?.total || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Away ML</div>
              <div className="text-green-400 font-mono">
                {event.odds[0]?.away || '-'}
              </div>
            </div>
          </div>
        )}
      </div>

      {event?.timestamp && (
        <div className="px-4 py-2 border-t border-white/10 text-center">
          <span className="text-white/40 text-xs">
            Last update: {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
