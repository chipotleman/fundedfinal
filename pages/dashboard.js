import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [games, setGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const [expandedGames, setExpandedGames] = useState({});

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            if (profile?.bankroll) {
              setBankroll(parseFloat(profile.bankroll));
            }
            if (profile?.pnl) {
              setPnl(parseFloat(profile.pnl));
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const handleBetPlaced = (newBankroll) => {
    const bankrollValue = Number(newBankroll);
    if (!isNaN(bankrollValue)) {
      setBankroll(bankrollValue);
    }
  };

  const toggleGameExpanded = (gameId) => {
    setExpandedGames(prev => ({ ...prev, [gameId]: !prev[gameId] }));
  };

  const handleBetSlipClick = () => {
    setShowBetSlip(!showBetSlip);
  };

  const sports = ['NBA', 'NFL', 'NCAAB', 'NCAAF', 'MLB', 'NHL'];

  const baseGamesRef = useRef({});
  const betSlipRef = useRef(betSlip);
  
  useEffect(() => {
    betSlipRef.current = betSlip;
  }, [betSlip]);

  const [apiGames, setApiGames] = useState([]);
  const [gamesError, setGamesError] = useState(null);

  useEffect(() => {
    const fetchAllGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          setApiGames(data.games || []);
          setGamesError(null);
        } else {
          console.error('Failed to fetch games');
          setGamesError('Failed to load games');
        }
      } catch (error) {
        console.error('Error fetching games:', error);
        setGamesError('Failed to load games');
      }
    };
    
    fetchAllGames();
    const interval = setInterval(fetchAllGames, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const categorizedGames = useMemo(() => categorizeGames(apiGames), [apiGames]);

  useEffect(() => {
    setAllGames(apiGames);
    
    const activeGames = selectedTab === 'live' 
      ? [...categorizedGames.liveGames, ...(categorizedGames.recentlyCompletedGames || [])]
      : categorizedGames.upcomingGames;
    
    if (selectedSport === 'All Sports') {
      baseGamesRef.current = { 'All Sports': activeGames };
      setGames(activeGames);
    } else {
      const filteredGames = activeGames.filter(g => g.sportName === selectedSport);
      baseGamesRef.current = { [selectedSport]: filteredGames };
      setGames(filteredGames);
    }
    setLoading(false);
  }, [selectedSport, selectedTab, apiGames, categorizedGames]);


  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const OddsDisplay = ({ odds, isSelected }) => {
    const baseClass = isSelected ? 'text-white' : 'text-green-400';
    return (
      <div className={`text-sm font-bold ${baseClass}`}>
        {formatOdds(odds)}
      </div>
    );
  };

  const getSportIcon = (sport) => {
    const icons = {
      'NFL': '🏈',
      'NCAAF': '🏈',
      'NBA': '🏀', 
      'NCAAB': '🏀',
      'MLB': '⚾',
      'NHL': '🏒',
      'Soccer': '⚽'
    };
    return icons[sport] || '🏆';
  };

  const getSportLabel = (sport) => {
    const labels = {
      'NFL': 'Football',
      'NCAAF': 'College Football',
      'NBA': 'Basketball',
      'NCAAB': 'College Basketball',
      'MLB': 'Baseball',
      'NHL': 'Hockey'
    };
    return labels[sport] || sport;
  };

  const handleSportClick = (sport) => {
    if (selectedSport === sport) {
      setSelectedSport('All Sports');
    } else {
      setSelectedSport(sport);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDarkMode ? '#000000' : '#f5f5f5' }}>
      <TopNavbar 
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={handleBetSlipClick}
      />

      <div className="pt-4 sm:pt-6 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16">
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selectedTab === 'upcoming'
                  ? 'bg-green-600 text-white'
                  : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              Upcoming {categorizedGames.upcomingGames.length > 0 && `(${categorizedGames.upcomingGames.length})`}
            </button>
            <button
              onClick={() => setSelectedTab('live')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                selectedTab === 'live'
                  ? 'bg-red-600 text-white'
                  : isDarkMode ? 'bg-[#1a1a1a] text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${categorizedGames.liveGames.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
              Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}
            </button>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {sports.map((sport) => (
              <button
                key={sport}
                onClick={() => handleSportClick(sport)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: selectedSport === sport ? (isDarkMode ? '#1a1a1a' : '#e5e7eb') : 'transparent',
                  color: selectedSport === sport ? (isDarkMode ? '#ffffff' : '#111827') : (isDarkMode ? '#9ca3af' : '#6b7280'),
                  borderWidth: 1,
                  borderColor: selectedSport === sport ? (isDarkMode ? '#4b5563' : '#9ca3af') : (isDarkMode ? '#1f2937' : '#d1d5db')
                }}
              >
                <span className="text-base">{getSportIcon(sport)}</span>
                <span>{getSportLabel(sport)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h2 className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>Featured</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {allGames.slice(0, 3).map((game) => {
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              return (
                <div 
                  key={game.id} 
                  className="flex-shrink-0 w-[280px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" 
                  style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}
                  onClick={() => router.push(`/game/${game.id}`)}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">FEATURED</span>
                      <span className="text-gray-500 text-xs">{game.sportName}</span>
                      {isLive ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 text-xs font-medium">LIVE</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs ml-auto">{game.time || 'TBD'}</span>
                      )}
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.awayTeamFull || game.awayTeam}</span>
                        {isLive && <span className="font-bold" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.awayScore || 0}</span>}
                      </div>
                      <div className="text-gray-500 text-xs">@</div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.homeTeamFull || game.homeTeam}</span>
                        {isLive && <span className="font-bold" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.homeScore || 0}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam); }}
                        className="flex-1 rounded-lg py-3 px-3"
                        style={{
                          backgroundColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                          borderWidth: 1,
                          borderColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                        }}
                      >
                        <div className="text-xs mb-0.5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.homeTeamFull || game.homeTeam).split(' ').pop()}</div>
                        <div className="font-bold" style={{ color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#22c55e' }}>
                          {formatOdds(game.lines.moneyline.home)}
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam); }}
                        className="flex-1 rounded-lg py-3 px-3"
                        style={{
                          backgroundColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                          borderWidth: 1,
                          borderColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                        }}
                      >
                        <div className="text-xs mb-0.5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.awayTeamFull || game.awayTeam).split(' ').pop()}</div>
                        <div className="font-bold" style={{ color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#22c55e' }}>
                          {formatOdds(game.lines.moneyline.away)}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedTab === 'live' ? '⚡' : '📅'}</span>
              <h2 className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{selectedTab === 'live' ? 'Live Now' : 'Upcoming Games'}</h2>
              {selectedTab === 'live' && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>Loading games...</p>
              </div>
            ) : games.length > 0 ? (
              games.map(game => {
                const sport = game.sportName || 'NBA';
                const isExpanded = expandedGames[game.id];
                const isLive = game.isLive || game.status === 'IN_PROGRESS';
                const isFinal = game.isCompleted || game.status === 'FINAL';
                const linesLocked = game.linesLocked || isFinal;
                
                return (
                  <div 
                    key={game.id} 
                    className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" 
                    style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}
                    onClick={() => !isFinal && router.push(`/game/${game.id}`)}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-medium">{sport}</span>
                          {isFinal ? (
                            <span className="text-gray-400 text-xs font-bold">FINAL</span>
                          ) : isLive ? (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-red-500 text-xs font-medium">LIVE</span>
                              {game.quarter && <span className="text-gray-400 text-xs">• {game.quarter}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">{game.time || 'TBD'}</span>
                          )}
                        </div>
                        <svg 
                          className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.awayTeamFull || game.awayTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.awayScore || 0}</span>
                          ) : (
                            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.homeTeamFull || game.homeTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.homeScore || 0}</span>
                          ) : (
                            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                          )}
                        </div>
                      </div>

                      {linesLocked ? (
                        <div className="flex gap-3">
                          <div className="flex-1 rounded-xl py-3 px-4 text-center opacity-50" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#d1d5db' }}>
                            <div className="text-xs mb-1" style={{ color: '#6b7280' }}>Lines</div>
                            <div className="font-bold text-gray-500">LOCKED</div>
                          </div>
                          <div className="flex-1 rounded-xl py-3 px-4 text-center opacity-50" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#d1d5db' }}>
                            <div className="text-xs mb-1" style={{ color: '#6b7280' }}>Lines</div>
                            <div className="font-bold text-gray-500">LOCKED</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam); }}
                            className="flex-1 rounded-xl py-3 px-4"
                            style={{
                              backgroundColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                              borderWidth: 1,
                              borderColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                            }}
                          >
                            <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.awayTeamFull || game.awayTeam).split(' ').pop()}</div>
                            <div className="font-bold text-lg" style={{ color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>
                              {formatOdds(game.lines.moneyline.away)}
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam); }}
                            className="flex-1 rounded-xl py-3 px-4"
                            style={{
                              backgroundColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                              borderWidth: 1,
                              borderColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                            }}
                          >
                            <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.homeTeamFull || game.homeTeam).split(' ').pop()}</div>
                            <div className="font-bold text-lg" style={{ color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>
                              {formatOdds(game.lines.moneyline.home)}
                            </div>
                          </button>
                        </div>
                      )}

                      {isExpanded && !linesLocked && (
                        <div className="mt-4 pt-4 space-y-3" style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}>
                          <div>
                            <div className="text-xs font-medium mb-2 uppercase" style={{ color: isDarkMode ? '#6b7280' : '#6b7280' }}>Spread</div>
                            <div className="flex gap-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`); }}
                                className="flex-1 rounded-xl py-3 px-4"
                                style={{
                                  backgroundColor: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                                  borderWidth: 1,
                                  borderColor: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                                }}
                              >
                                <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.awayTeamFull || game.awayTeam).split(' ').pop()} {game.lines.spread.away.point}</div>
                                <div className="font-bold" style={{ color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#ffffff' : '#22c55e' }}>
                                  {formatOdds(game.lines.spread.away.odds)}
                                </div>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`); }}
                                className="flex-1 rounded-xl py-3 px-4"
                                style={{
                                  backgroundColor: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                                  borderWidth: 1,
                                  borderColor: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                                }}
                              >
                                <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.homeTeamFull || game.homeTeam).split(' ').pop()} {game.lines.spread.home.point}</div>
                                <div className="font-bold" style={{ color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#ffffff' : '#22c55e' }}>
                                  {formatOdds(game.lines.spread.home.odds)}
                                </div>
                              </button>
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-xs font-medium mb-2 uppercase" style={{ color: isDarkMode ? '#6b7280' : '#6b7280' }}>Total</div>
                            <div className="flex gap-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`); }}
                                className="flex-1 rounded-xl py-3 px-4"
                                style={{
                                  backgroundColor: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                                  borderWidth: 1,
                                  borderColor: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                                }}
                              >
                                <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{game.lines.total.over.point}</div>
                                <div className="font-bold" style={{ color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#ffffff' : '#22c55e' }}>
                                  {formatOdds(game.lines.total.over.odds)}
                                </div>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`); }}
                                className="flex-1 rounded-xl py-3 px-4"
                                style={{
                                  backgroundColor: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#16a34a' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                                  borderWidth: 1,
                                  borderColor: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#22c55e' : (isDarkMode ? '#374151' : '#d1d5db')
                                }}
                              >
                                <div className="text-xs mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{game.lines.total.under.point}</div>
                                <div className="font-bold" style={{ color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#ffffff' : '#22c55e' }}>
                                  {formatOdds(game.lines.total.under.odds)}
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <div className="rounded-2xl p-8 max-w-md mx-auto" style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}>
                  <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#9ca3af' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>No Games Available</h3>
                  <p style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Check back later for {selectedSport} games and betting lines.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BetSlip
        bankroll={bankroll}
        isOpen={showBetSlip}
        onClose={() => setShowBetSlip(false)}
        onBetPlaced={handleBetPlaced}
      />

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        @media (hover: none) and (pointer: coarse) {
          button:hover {
            background-color: inherit !important;
            border-color: inherit !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
