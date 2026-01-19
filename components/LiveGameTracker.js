import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveEvent } from '../hooks/useGoalserveLive';
import LiveFieldVisualization from './LiveFieldVisualization';

export default function LiveGameTracker({ gameId, sport = 'basketball_nba', initialData = null }) {
  const { event, isConnected, error, possession: livePossession, ballPosition: liveBallPosition, lastUpdate } = useLiveEvent(gameId, { autoConnect: true });
  
  const [gameData, setGameData] = useState(initialData);
  const [currentPossession, setCurrentPossession] = useState(initialData?.possession || null);
  const lastPossessionRef = useRef(null);

  // Update game data when event changes
  useEffect(() => {
    if (event) {
      const homeScore = event.homeScore ?? event.team1?.score ?? 0;
      const awayScore = event.awayScore ?? event.team2?.score ?? 0;
      
      setGameData(prev => ({
        ...prev,
        homeScore,
        awayScore,
        status: event.stateCode || event.status,
        timer: event.timer || event.elapsedTime,
        displayClock: event.displayClock,
        period: event.period,
        ballPosition: event.xy || event.ballPosition
      }));
    }
  }, [event]);
  
  // Separate effect for possession updates - track more aggressively
  useEffect(() => {
    // Get possession from multiple sources
    let newPoss = livePossession || event?.possession || event?.stats?.possession;
    
    // Normalize to 'home'/'away' string
    if (typeof newPoss === 'object' && newPoss !== null) {
      if (newPoss.home) newPoss = 'home';
      else if (newPoss.away) newPoss = 'away';
      else newPoss = null;
    }
    
    // Only update if possession actually changed
    if (newPoss && newPoss !== lastPossessionRef.current) {
      lastPossessionRef.current = newPoss;
      setCurrentPossession(newPoss);
    }
  }, [livePossession, event?.possession, event?.stats?.possession, lastUpdate]);

  // Also poll for initial possession if not set
  useEffect(() => {
    if (!currentPossession && initialData?.possession) {
      let poss = initialData.possession;
      if (typeof poss === 'object' && poss !== null) {
        if (poss.home) poss = 'home';
        else if (poss.away) poss = 'away';
        else poss = null;
      }
      if (poss) setCurrentPossession(poss);
    }
  }, [currentPossession, initialData?.possession]);

  // Get team name for display based on currentPossession
  const possessionTeam = useMemo(() => {
    if (!currentPossession) return null;
    if (currentPossession === 'home') return initialData?.home_team || 'Home';
    if (currentPossession === 'away') return initialData?.away_team || 'Away';
    return null;
  }, [currentPossession, initialData?.home_team, initialData?.away_team]);

  // Use ballPosition from real-time event, fall back to initialData
  const ballPosition = liveBallPosition || gameData?.ballPosition || initialData?.ballPosition || null;

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
          possession={currentPossession}
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
