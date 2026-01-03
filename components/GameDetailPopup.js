import { useState, useEffect } from 'react';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function GameDetailPopup({ isOpen, onClose, game }) {
  const { addToBetSlip, isBetInSlip } = useBetSlip();
  const [liveData, setLiveData] = useState(null);
  const [activeTab, setActiveTab] = useState('Game Lines');

  const tabs = ['Live SGP', 'Featured', 'Game Lines', 'Player Props'];

  // Store scroll position when popup opens, restore on close
  // Using overflow:hidden only to prevent background scroll without affecting layout
  useEffect(() => {
    if (!isOpen) return;
    
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      // Only restore scroll if we're actually closing (component unmounting while open)
    };
  }, [isOpen]);

  // Reset liveData when game changes so we use fresh data from parent
  useEffect(() => {
    setLiveData(null);
  }, [game?.id]);

  // Optionally fetch updated data, but less frequently to avoid conflicts with dashboard
  useEffect(() => {
    if (!isOpen || !game?.id) return;
    
    // Only fetch if the popup has been open for a while (30 seconds)
    // This avoids conflicting with the dashboard's own polling
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          const updatedGame = data.games?.find(g => String(g.id) === String(game.id));
          if (updatedGame) {
            setLiveData(updatedGame);
          }
        }
      } catch (error) {
        console.error('Error fetching live data:', error);
      }
    }, 30000);
    
    return () => clearTimeout(timeoutId);
  }, [isOpen, game?.id]);

  if (!isOpen || !game) return null;

  const currentGame = liveData || game;
  const lines = currentGame.lines || {};
  const moneyline = lines.moneyline || { home: 0, away: 0 };
  const spread = lines.spread || { 
    home: { point: 0, odds: 0 }, 
    away: { point: 0, odds: 0 } 
  };
  const total = lines.total || { 
    over: { point: 0, odds: 0 }, 
    under: { point: 0, odds: 0 } 
  };
  const hasLines = currentGame.lines && (moneyline.home !== 0 || moneyline.away !== 0);
  const isLive = currentGame.isLive || currentGame.status === 'IN_PROGRESS';
  const isFinal = currentGame.isCompleted || currentGame.status === 'FINAL';

  const formatOdds = (odds) => {
    if (typeof odds !== 'number' || odds === 0) return '-';
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const formatSpread = (point) => {
    if (point === null || point === undefined || point === 0) return '-';
    const num = parseFloat(point);
    if (isNaN(num)) return point;
    return num > 0 ? `+${num}` : num.toString();
  };

  const handleAddToBetSlip = (betType, odds, selection) => {
    if (!currentGame) return;
    addToBetSlip(currentGame, betType, odds, selection);
  };

  const checkBetInSlip = (betType, selection) => {
    if (!currentGame) return false;
    return isBetInSlip(currentGame, betType, selection);
  };

  const sport = currentGame.sport_key || 'basketball_nba';
  const isBasketball = sport.includes('basketball');
  const isFootball = sport.includes('football');
  const isHockey = sport.includes('hockey');

  const getAbbreviation = (teamName) => {
    if (!teamName) return '???';
    const abbrevMap = {
      'Lakers': 'LAL', 'Celtics': 'BOS', 'Warriors': 'GSW', 'Nets': 'BKN',
      'Knicks': 'NYK', 'Heat': 'MIA', 'Bulls': 'CHI', 'Bucks': 'MIL',
      'Suns': 'PHX', 'Mavericks': 'DAL', 'Nuggets': 'DEN', 'Clippers': 'LAC',
      'Sixers': 'PHI', '76ers': 'PHI', 'Raptors': 'TOR', 'Hawks': 'ATL',
      'Hornets': 'CHA', 'Cavaliers': 'CLE', 'Pistons': 'DET', 'Pacers': 'IND',
      'Magic': 'ORL', 'Wizards': 'WAS', 'Timberwolves': 'MIN', 'Thunder': 'OKC',
      'Trail Blazers': 'POR', 'Blazers': 'POR', 'Kings': 'SAC', 'Spurs': 'SAS',
      'Jazz': 'UTA', 'Grizzlies': 'MEM', 'Pelicans': 'NOP', 'Rockets': 'HOU',
    };
    const lastWord = teamName.split(' ').pop();
    return abbrevMap[lastWord] || lastWord?.substring(0, 3).toUpperCase() || '???';
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 sticky top-0 bg-[#0a0a0a] z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center flex-1">
          <div className="text-gray-400 text-xs">{currentGame.sportName?.toUpperCase() || 'SPORT'}</div>
          <div className="text-blue-400 font-semibold text-sm">
            {currentGame.awayTeam || 'Away'} @ {currentGame.homeTeam || 'Home'}
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Scoreboard */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-2 mx-auto border border-gray-600">
              <span className="text-lg font-bold text-white">{getAbbreviation(currentGame.awayTeam)}</span>
            </div>
            <div className="text-gray-400 text-sm">{currentGame.awayTeam || 'Away'}</div>
            <div className="text-white text-4xl font-bold mt-1">
              {isLive || isFinal ? (currentGame.scores?.away?.total ?? 0) : '-'}
            </div>
          </div>

          <div className="text-center px-4">
            {isLive ? (
              <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded">
                {currentGame.quarter || 'LIVE'}
              </div>
            ) : isFinal ? (
              <div className="text-gray-400 font-bold">FINAL</div>
            ) : (
              <div className="text-gray-400 text-sm">{currentGame.time || 'TBD'}</div>
            )}
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-2 mx-auto border border-gray-600">
              <span className="text-lg font-bold text-white">{getAbbreviation(currentGame.homeTeam)}</span>
            </div>
            <div className="text-gray-400 text-sm">{currentGame.homeTeam || 'Home'}</div>
            <div className="text-white text-4xl font-bold mt-1">
              {isLive || isFinal ? (currentGame.scores?.home?.total ?? 0) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Court/Field Visualization for Live Games */}
      {isLive && (
        <div className="px-4 pb-4">
          <div 
            className="relative w-full rounded-lg overflow-hidden border border-gray-600"
            style={{ 
              aspectRatio: '2/1',
              background: isBasketball 
                ? 'linear-gradient(135deg, #8B6914 0%, #A07818 50%, #8B6914 100%)' 
                : isFootball 
                ? 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%)'
                : isHockey
                ? 'linear-gradient(135deg, #e8f4f8 0%, #d0e8f0 50%, #e8f4f8 100%)'
                : '#333'
            }}
          >
            {isBasketball && (
              <>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/30" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                  {currentGame.quarter || 'LIVE'}
                </div>
                <div className="absolute left-[30%] top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full shadow-lg animate-pulse" />
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700 px-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24">
        {activeTab === 'Game Lines' && (
          <div className="bg-[#111] rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <span className="text-white font-semibold">Game Lines</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">SGP</span>
            </div>
            
            {/* Column Headers */}
            <div className="grid grid-cols-4 text-center text-xs text-gray-500 py-2 border-b border-gray-700 px-2">
              <div></div>
              <div>SPREAD</div>
              <div>MONEY</div>
              <div>TOTAL</div>
            </div>

            {/* Away Team Row */}
            <div className="grid grid-cols-4 items-center py-3 px-2 border-b border-gray-800">
              <div className="text-white text-sm font-medium pl-2 truncate">
                {currentGame.awayTeam || 'Away'}
              </div>
              
              <button
                onClick={() => handleAddToBetSlip('spread', spread.away, `${currentGame.awayTeamFull || currentGame.awayTeam} ${spread.away.point}`)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('spread', `${currentGame.awayTeamFull || currentGame.awayTeam} ${spread.away.point}`)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-white text-xs font-bold">{formatSpread(spread.away?.point)}</div>
                <div className="text-blue-400 text-xs">{formatOdds(spread.away?.odds)}</div>
              </button>

              <button
                onClick={() => handleAddToBetSlip('moneyline', moneyline.away, currentGame.awayTeamFull || currentGame.awayTeam)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('moneyline', currentGame.awayTeamFull || currentGame.awayTeam)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-green-400 text-sm font-bold">{formatOdds(moneyline.away)}</div>
              </button>

              <button
                onClick={() => handleAddToBetSlip('total', total.over, `Over ${total.over.point}`)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('total', `Over ${total.over.point}`)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-white text-xs font-bold">O {total.over?.point || '-'}</div>
                <div className="text-blue-400 text-xs">{formatOdds(total.over?.odds)}</div>
              </button>
            </div>

            {/* @ symbol */}
            <div className="text-gray-500 text-xs pl-4 py-1">@</div>

            {/* Home Team Row */}
            <div className="grid grid-cols-4 items-center py-3 px-2">
              <div className="text-white text-sm font-medium pl-2 truncate">
                {currentGame.homeTeam || 'Home'}
              </div>
              
              <button
                onClick={() => handleAddToBetSlip('spread', spread.home, `${currentGame.homeTeamFull || currentGame.homeTeam} ${spread.home.point}`)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('spread', `${currentGame.homeTeamFull || currentGame.homeTeam} ${spread.home.point}`)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-white text-xs font-bold">{formatSpread(spread.home?.point)}</div>
                <div className="text-blue-400 text-xs">{formatOdds(spread.home?.odds)}</div>
              </button>

              <button
                onClick={() => handleAddToBetSlip('moneyline', moneyline.home, currentGame.homeTeamFull || currentGame.homeTeam)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('moneyline', currentGame.homeTeamFull || currentGame.homeTeam)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-green-400 text-sm font-bold">{formatOdds(moneyline.home)}</div>
              </button>

              <button
                onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under.point}`)}
                disabled={!hasLines}
                className={`mx-1 rounded-lg py-2 px-1 text-center transition-all ${
                  !hasLines ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                  checkBetInSlip('total', `Under ${total.under.point}`)
                    ? 'bg-blue-600 border border-blue-500'
                    : 'bg-gray-800 border border-gray-600 hover:border-blue-500'
                }`}
              >
                <div className="text-white text-xs font-bold">U {total.under?.point || '-'}</div>
                <div className="text-blue-400 text-xs">{formatOdds(total.under?.odds)}</div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Live SGP' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">SGP</div>
            <p className="text-gray-400">Build your Same Game Parlay</p>
          </div>
        )}

        {activeTab === 'Featured' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">Featured</div>
            <p className="text-gray-400">Featured bets coming soon</p>
          </div>
        )}

        {activeTab === 'Player Props' && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">Player Props</div>
            <p className="text-gray-400">Player prop bets coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
