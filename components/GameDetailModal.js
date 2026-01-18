import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import LiveFieldVisualization from './LiveFieldVisualization';

function formatOdds(odds) {
  if (odds === null || odds === undefined || isNaN(odds)) return '-';
  const num = parseInt(odds);
  return num > 0 ? `+${num}` : `${num}`;
}

function getOddsColorClass(odds) {
  const num = parseInt(odds);
  if (isNaN(num)) return 'text-gray-400';
  return num > 0 ? 'text-green-400' : 'text-yellow-400';
}

function getPossessionTeam(game) {
  if (game?.possession?.home) return game.homeTeam || game.home_team;
  if (game?.possession?.away) return game.awayTeam || game.away_team;
  return null;
}

function getGameStatus(game) {
  if (!game) return '';
  
  if (game.isLive || game.status === 'live') {
    const period = game.period || game.displayClock || '';
    const time = game.elapsedTime || game.timer || '';
    if (period && time) return `${period} ${time}`;
    if (period) return period;
    if (time) return time;
    return 'LIVE';
  }
  
  return game.status || 'Scheduled';
}

export default function GameDetailModal({ 
  game, 
  onClose, 
  onSelectBet,
  selectedBets = [],
  isLive = false
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    gameLines: true,
    playerProps: false,
  });
  
  const homeTeam = game?.homeTeam || game?.home_team || 'Home';
  const awayTeam = game?.awayTeam || game?.away_team || 'Away';
  const homeScore = game?.scores?.home?.total ?? game?.homeScore ?? 0;
  const awayScore = game?.scores?.away?.total ?? game?.awayScore ?? 0;
  const sportKey = game?.sport_key || game?.sport || 'basketball_nba';
  const league = game?.league || game?.sport_title || sportKey;
  
  const ballPosition = game?.ballPosition || null;
  const possessionTeam = getPossessionTeam(game);
  const gameStatus = getGameStatus(game);
  
  const lines = game?.lines || game?.odds || {};
  
  const moneylineHome = lines?.moneyline?.home || game?.moneylineHome;
  const moneylineAway = lines?.moneyline?.away || game?.moneylineAway;
  const spreadHome = lines?.spread?.home?.point || game?.spread;
  const spreadAway = spreadHome ? -spreadHome : null;
  const spreadHomeOdds = lines?.spread?.home?.price || -110;
  const spreadAwayOdds = lines?.spread?.away?.price || -110;
  const totalPoints = lines?.total?.over?.point || game?.total || 220;
  const overOdds = lines?.total?.over?.price || -110;
  const underOdds = lines?.total?.under?.price || -110;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isSelected = useCallback((selectionKey) => {
    return selectedBets.some(bet => bet.selectionKey === selectionKey || bet.id === selectionKey);
  }, [selectedBets]);

  const handleBetClick = (betType, odds, team, selectionKey) => {
    if (onSelectBet) {
      onSelectBet(game, betType, odds, team, selectionKey);
    }
  };

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'sgp', label: 'SGP' },
    { id: 'team', label: 'Team' },
    { id: 'quarter', label: isLive ? 'Period' : 'Quarter' },
    { id: 'half', label: 'Half' },
  ];

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg h-[90vh] sm:h-[85vh] bg-gray-900 rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-xs text-gray-400 uppercase tracking-wider">{league}</span>
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-gray-800 rounded">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-left">
              <span className="text-white font-semibold text-base truncate block">{awayTeam}</span>
            </div>
            
            <div className="flex items-center gap-3 px-4">
              {isLive && (
                <>
                  <span className="text-3xl font-bold text-yellow-400">{awayScore}</span>
                  <span className="text-3xl font-bold text-yellow-400">{homeScore}</span>
                </>
              )}
            </div>
            
            <div className="flex-1 text-right">
              <span className="text-white font-semibold text-base truncate block">{homeTeam}</span>
            </div>
          </div>
          
          {isLive && (
            <div className="flex justify-center mt-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">{awayScore > homeScore ? awayTeam : homeTeam} leads</span>
              </div>
            </div>
          )}
        </div>

        {isLive && (
          <div className="bg-gray-950 px-4 py-3">
            <div className="text-center mb-2">
              <span className="text-xs text-yellow-400 font-medium">{gameStatus}</span>
            </div>
            
            <LiveFieldVisualization 
              game={{ ...game, sport_key: sportKey }}
              ballPosition={ballPosition}
              className="rounded-lg overflow-hidden"
            />
            
            {possessionTeam && (
              <div className="text-center mt-3">
                <span className="text-xs text-gray-400">
                  <span className="text-white font-medium">{possessionTeam}</span>
                  {' '}In Possession
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button className="ml-auto p-1.5 hover:bg-gray-800 rounded">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-gray-800">
            <button
              onClick={() => toggleSection('gameLines')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50"
            >
              <span className="font-semibold text-white">Game Lines</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">SGP</span>
                {expandedSections.gameLines ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {expandedSections.gameLines && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-xs text-gray-500 text-center"></div>
                  <div className="text-xs text-gray-400 text-center truncate">{awayTeam}</div>
                  <div className="text-xs text-gray-400 text-center truncate">{homeTeam}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2 items-center">
                  <div className="text-sm text-gray-300">Spread</div>
                  <button
                    onClick={() => handleBetClick('spread', spreadAwayOdds, awayTeam, `${game.id}-spread-away`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-spread-away`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs text-gray-400">{spreadAway > 0 ? `+${spreadAway}` : spreadAway}</div>
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-spread-away`) ? 'text-black' : getOddsColorClass(spreadAwayOdds)}`}>
                      {formatOdds(spreadAwayOdds)}
                    </div>
                  </button>
                  <button
                    onClick={() => handleBetClick('spread', spreadHomeOdds, homeTeam, `${game.id}-spread-home`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-spread-home`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs text-gray-400">{spreadHome > 0 ? `+${spreadHome}` : spreadHome}</div>
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-spread-home`) ? 'text-black' : getOddsColorClass(spreadHomeOdds)}`}>
                      {formatOdds(spreadHomeOdds)}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2 items-center">
                  <div className="text-sm text-gray-300">Total</div>
                  <button
                    onClick={() => handleBetClick('total', overOdds, `Over ${totalPoints}`, `${game.id}-total-over`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-total-over`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs text-gray-400">O {totalPoints}</div>
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-total-over`) ? 'text-black' : getOddsColorClass(overOdds)}`}>
                      {formatOdds(overOdds)}
                    </div>
                  </button>
                  <button
                    onClick={() => handleBetClick('total', underOdds, `Under ${totalPoints}`, `${game.id}-total-under`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-total-under`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs text-gray-400">U {totalPoints}</div>
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-total-under`) ? 'text-black' : getOddsColorClass(underOdds)}`}>
                      {formatOdds(underOdds)}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-sm text-gray-300">Money Line</div>
                  <button
                    onClick={() => handleBetClick('moneyline', moneylineAway, awayTeam, `${game.id}-ml-away`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-ml-away`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-ml-away`) ? 'text-black' : getOddsColorClass(moneylineAway)}`}>
                      {formatOdds(moneylineAway)}
                    </div>
                  </button>
                  <button
                    onClick={() => handleBetClick('moneyline', moneylineHome, homeTeam, `${game.id}-ml-home`)}
                    className={`py-2.5 rounded-lg text-center transition-all ${
                      isSelected(`${game.id}-ml-home`)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${isSelected(`${game.id}-ml-home`) ? 'text-black' : getOddsColorClass(moneylineHome)}`}>
                      {formatOdds(moneylineHome)}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-gray-800">
            <button
              onClick={() => toggleSection('playerProps')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50"
            >
              <span className="font-semibold text-white">Player Props</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">SGP</span>
                {expandedSections.playerProps ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {expandedSections.playerProps && (
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-500 text-center py-4">
                  Player props coming soon
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
