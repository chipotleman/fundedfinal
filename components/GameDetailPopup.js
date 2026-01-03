import { useState, useEffect } from 'react';
import { useBetSlip } from '../contexts/BetSlipContext';
import LiveGameTracker from './LiveGameTracker';

export default function GameDetailPopup({ isOpen, onClose, game }) {
  const { addToBetSlip, isBetInSlip } = useBetSlip();
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !game?.id) return;
    
    const fetchLiveData = async () => {
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
    };

    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15000);
    return () => clearInterval(interval);
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

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button 
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-gray-800 transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-white font-semibold text-sm">{currentGame.sportName?.toUpperCase() || 'GAME'}</div>
          <div className="text-gray-400 text-xs">
            {isLive ? 'LIVE' : isFinal ? 'FINAL' : currentGame.time || 'Upcoming'}
          </div>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
        <div className="flex-shrink-0">
          <LiveGameTracker 
            gameId={currentGame.id} 
            sport={currentGame.sport_key || 'basketball_nba'}
            initialData={{
              home_team: currentGame.homeTeamFull || currentGame.homeTeam,
              away_team: currentGame.awayTeamFull || currentGame.awayTeam,
              home_score: currentGame.scores?.home?.total || 0,
              away_score: currentGame.scores?.away?.total || 0
            }}
          />
        </div>

        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-3 gap-2 h-full">
            <div className="bg-[#111] rounded-xl border border-gray-800 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
                <span className="text-white font-semibold text-sm">Spread</span>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2 p-2">
                <button
                  onClick={() => handleAddToBetSlip('spread', spread.away, `${currentGame.awayTeamFull || currentGame.awayTeam} ${spread.away.point}`)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('spread', `${currentGame.awayTeamFull || currentGame.awayTeam} ${spread.away.point}`)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px] truncate">{currentGame.awayTeam}</div>
                  <div className="text-white font-bold text-sm">{formatSpread(spread.away?.point)}</div>
                  <div className="text-blue-400 text-xs">{formatOdds(spread.away?.odds)}</div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('spread', spread.home, `${currentGame.homeTeamFull || currentGame.homeTeam} ${spread.home.point}`)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('spread', `${currentGame.homeTeamFull || currentGame.homeTeam} ${spread.home.point}`)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px] truncate">{currentGame.homeTeam}</div>
                  <div className="text-white font-bold text-sm">{formatSpread(spread.home?.point)}</div>
                  <div className="text-blue-400 text-xs">{formatOdds(spread.home?.odds)}</div>
                </button>
              </div>
            </div>

            <div className="bg-[#111] rounded-xl border border-gray-800 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
                <span className="text-white font-semibold text-sm">Total</span>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2 p-2">
                <button
                  onClick={() => handleAddToBetSlip('total', total.over, `Over ${total.over.point}`)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('total', `Over ${total.over.point}`)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px]">Over</div>
                  <div className="text-white font-bold text-sm">{total.over?.point || '-'}</div>
                  <div className="text-blue-400 text-xs">{formatOdds(total.over?.odds)}</div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('total', total.under, `Under ${total.under.point}`)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('total', `Under ${total.under.point}`)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px]">Under</div>
                  <div className="text-white font-bold text-sm">{total.under?.point || '-'}</div>
                  <div className="text-blue-400 text-xs">{formatOdds(total.under?.odds)}</div>
                </button>
              </div>
            </div>

            <div className="bg-[#111] rounded-xl border border-gray-800 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
                <span className="text-white font-semibold text-sm">Moneyline</span>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2 p-2">
                <button
                  onClick={() => handleAddToBetSlip('moneyline', moneyline.away, currentGame.awayTeamFull || currentGame.awayTeam)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('moneyline', currentGame.awayTeamFull || currentGame.awayTeam)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px] truncate">{currentGame.awayTeam}</div>
                  <div className="text-blue-400 font-bold text-lg">{formatOdds(moneyline.away)}</div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('moneyline', moneyline.home, currentGame.homeTeamFull || currentGame.homeTeam)}
                  disabled={!hasLines}
                  className={`flex-1 rounded-lg p-2 text-center transition-all min-h-0 ${
                    !hasLines ? 'opacity-50 cursor-not-allowed bg-[#1a1a1a]' :
                    checkBetInSlip('moneyline', currentGame.homeTeamFull || currentGame.homeTeam)
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="text-gray-400 text-[10px] truncate">{currentGame.homeTeam}</div>
                  <div className="text-blue-400 font-bold text-lg">{formatOdds(moneyline.home)}</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
