import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

function formatTimeRemaining(ms) {
  if (!ms || ms <= 0) return 'Ended';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function BattleDetailsPopup({ 
  isOpen, 
  onClose, 
  matchup, 
  opponent, 
  myBalance, 
  opponentBalance,
  myBets = [],
  opponentBets = [],
  canSeeOpponentBets,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('your');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const { isDarkMode } = useTheme();

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
    if (!matchup?.endsAt) return;
    const updateTime = () => {
      const remaining = new Date(matchup.endsAt).getTime() - Date.now();
      setTimeRemaining(remaining);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [matchup?.endsAt]);

  if (!isOpen || !matchup || !opponent) return null;

  const myBalanceNum = parseFloat(myBalance || 0);
  const oppBalanceNum = parseFloat(opponentBalance || 0);
  const isWinning = myBalanceNum > oppBalanceNum;
  const isLosing = myBalanceNum < oppBalanceNum;
  const winnerPayout = parseFloat(matchup.winnerPayout || 0);

  const myPendingBets = myBets.filter(b => b.status === 'pending');
  const mySettledBets = myBets.filter(b => b.status !== 'pending');
  const oppPendingBets = opponentBets.filter(b => b.status === 'pending');
  const oppSettledBets = opponentBets.filter(b => b.status !== 'pending');

  const renderBetCard = (bet, index) => (
    <div 
      key={bet.id || index}
      className={`p-3 rounded-lg ${
        isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {bet.selection || bet.matchupName}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {bet.matchupName} {bet.marketType ? `• ${bet.marketType}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            ${parseFloat(bet.stake || 0).toLocaleString()}
          </p>
          <div className="flex items-center gap-2 justify-end">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>@ {bet.odds}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              bet.status === 'won' ? 'bg-green-500/20 text-green-500' :
              bet.status === 'lost' ? 'bg-red-500/20 text-red-500' :
              bet.status === 'push' ? 'bg-gray-500/20 text-gray-400' :
              'bg-yellow-500/20 text-yellow-500'
            }`}>
              {bet.status === 'pending' ? 'Pending' :
               bet.status === 'won' ? `+$${parseFloat(bet.pnl || 0).toLocaleString()}` :
               bet.status === 'lost' ? `-$${parseFloat(bet.stake || 0).toLocaleString()}` :
               'Push'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden ${
        isDarkMode ? 'bg-[#0a0a0a]' : 'bg-white'
      }`}>
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition"
          >
            ✕
          </button>
          
          <p className={`text-xs uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Time Remaining
          </p>
          <p className={`text-3xl font-bold ${
            timeRemaining && timeRemaining < 3600000 ? 'text-red-500 animate-pulse' : 'text-white'
          }`}>
            {formatTimeRemaining(timeRemaining)}
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center flex-1">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2 ${
                isWinning ? 'bg-gradient-to-br from-green-500 to-green-600 ring-2 ring-green-400' : 
                isLosing ? 'bg-gradient-to-br from-gray-600 to-gray-700' :
                'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                You
              </div>
              <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>You</p>
              <p className={`text-xl font-bold ${isWinning ? 'text-green-500' : isLosing ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                ${myBalanceNum.toLocaleString()}
              </p>
            </div>
            
            <div className="text-2xl font-bold text-blue-500">VS</div>
            
            <div className="text-center flex-1">
              {opponent.avatar ? (
                <img 
                  src={opponent.avatar} 
                  alt={opponent.username}
                  className={`w-16 h-16 mx-auto rounded-full mb-2 ${
                    isLosing ? 'ring-2 ring-green-400' : ''
                  }`}
                />
              ) : (
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2 ${
                  isLosing ? 'bg-gradient-to-br from-green-500 to-green-600 ring-2 ring-green-400' : 
                  isWinning ? 'bg-gradient-to-br from-gray-600 to-gray-700' :
                  'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
                </div>
              )}
              <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{opponent.username}</p>
              <p className={`text-xl font-bold ${isLosing ? 'text-green-500' : isWinning ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                ${oppBalanceNum.toLocaleString()}
              </p>
            </div>
          </div>

          <div className={`text-center p-4 rounded-xl mb-6 ${
            isDarkMode ? 'bg-[#111111] border border-gray-800/50' : 'bg-gray-100'
          }`}>
            <p className={`text-xs uppercase mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Piks Pool</p>
            <p className="text-2xl font-bold text-yellow-500">${winnerPayout.toLocaleString()}</p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Winner takes all</p>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('your')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === 'your'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222]' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Your Bets ({myBets.length})
            </button>
            <button
              onClick={() => setActiveTab('opponent')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === 'opponent'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222]' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Opponent ({opponentBets.length})
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === 'rules'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222]' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Rules
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {activeTab === 'your' && (
              <>
                {myBets.length === 0 ? (
                  <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    You haven't placed any bets yet
                  </p>
                ) : (
                  myBets.map((bet, i) => renderBetCard(bet, i))
                )}
              </>
            )}

            {activeTab === 'opponent' && (
              <>
                {!canSeeOpponentBets ? (
                  <div className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    <span className="text-3xl mb-2 block">🔒</span>
                    <p>Place a bet to unlock opponent's picks</p>
                  </div>
                ) : opponentBets.length === 0 ? (
                  <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    Opponent hasn't placed any bets yet
                  </p>
                ) : (
                  opponentBets.map((bet, i) => renderBetCard(bet, i))
                )}
              </>
            )}

            {activeTab === 'rules' && (
              <div className={`space-y-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111]' : 'bg-gray-100'}`}>
                  <p className="font-medium text-blue-500">Starting Balance</p>
                  <p>${parseFloat(matchup.startingBalance || 0).toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111]' : 'bg-gray-100'}`}>
                  <p className="font-medium text-blue-500">Duration</p>
                  <p>{matchup.duration || 'N/A'}</p>
                </div>
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111]' : 'bg-gray-100'}`}>
                  <p className="font-medium text-blue-500">Winner Determination</p>
                  <p>Highest balance when time expires wins the pot</p>
                </div>
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-[#111111]' : 'bg-gray-100'}`}>
                  <p className="font-medium text-blue-500">Platform Fee</p>
                  <p>10% of combined pot</p>
                </div>
              </div>
            )}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="w-full mt-4 py-2 text-blue-500 text-sm hover:text-blue-400 transition"
            >
              Refresh Bets
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
