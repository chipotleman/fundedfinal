import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import TapSurface from '../components/TapSurface';
import LiveGameTimer from '../components/LiveGameTimer';
import LiveActionFeed from '../components/LiveActionFeed';
import { inferLeague } from '../lib/leagueInference';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';
import { useGoalserveLive } from '../hooks/useGoalserveLive';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [selectedTab, setSelectedTab] = useState('live');
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

  const sports = ['NBA', 'NFL', 'NCAAB', 'NCAAF', 'MLB', 'NHL', 'Euro Basketball', "Int'l Hockey"];

  // Helper to get short team name for buttons, avoiding ambiguous names
  const getShortTeamName = (teamName, otherTeamName) => {
    // Remove trailing parenthetical suffixes like "(W)"
    const cleanName = (teamName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    const cleanOther = (otherTeamName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    
    const parts = cleanName.split(' ');
    const otherParts = cleanOther.split(' ');
    
    // If only one word, return it
    if (parts.length === 1) return cleanName;
    
    // Get last word of both teams to check for ambiguity
    const lastWord = parts[parts.length - 1];
    const otherLastWord = otherParts[otherParts.length - 1];
    
    // If both teams have the same last word (e.g., both "U23"), must use 2 words to differentiate
    if (lastWord === otherLastWord) {
      return parts.length >= 2 ? parts.slice(-2).join(' ') : cleanName;
    }
    
    // For 2-word names that are short enough, use both (e.g., "Morgan State")
    if (parts.length === 2) {
      const twoWords = parts.join(' ');
      // If combined is <= 12 chars, use both words
      if (twoWords.length <= 12) return twoWords;
    }
    
    // Otherwise just use the last word to avoid cutoff
    return lastWord;
  };

  const baseGamesRef = useRef({});
  const betSlipRef = useRef(betSlip);
  
  useEffect(() => {
    betSlipRef.current = betSlip;
  }, [betSlip]);

  const [apiGames, setApiGames] = useState([]);
  const [gamesError, setGamesError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const { liveScores, liveOdds, events: inplayEvents, isConnected: liveConnected } = useGoalserveLive({ autoConnect: true });
  
  // Adaptive polling - use refs to avoid closure issues
  const pollingIntervalRef = useRef(null);
  const currentIntervalRef = useRef(5000); // Start with fast polling for live updates
  const lastOddsUpdateRef = useRef(null);
  const lastFetchTimeRef = useRef(null);
  
  useEffect(() => {
    const fetchAllGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          setApiGames([...(data.games || [])]);
          setLastUpdated(new Date());
          setGamesError(null);
          
          // Track last odds update for stale detection (using refs to avoid closure issues)
          if (data.freshness?.lastOddsUpdate) {
            const newLastUpdate = data.freshness.lastOddsUpdate;
            const previousLastUpdate = lastOddsUpdateRef.current;
            const previousFetchTime = lastFetchTimeRef.current;
            
            // Detect stale data - if last_update hasn't changed in 45+ seconds
            if (previousLastUpdate && previousLastUpdate === newLastUpdate && previousFetchTime) {
              const staleTime = Date.now() - previousFetchTime;
              if (staleTime > 45000) {
                console.log('[DASHBOARD] Stale data detected, forcing refresh...');
                fetch('/api/games?refresh=true').then(r => r.json()).then(freshData => {
                  if (freshData.games) {
                    setApiGames([...(freshData.games || [])]);
                    setLastUpdated(new Date());
                    lastOddsUpdateRef.current = freshData.freshness?.lastOddsUpdate || null;
                    lastFetchTimeRef.current = Date.now();
                  }
                });
                return;
              }
            }
            
            // Update refs with new values
            if (newLastUpdate !== previousLastUpdate) {
              lastOddsUpdateRef.current = newLastUpdate;
              lastFetchTimeRef.current = Date.now();
            }
          }
          
          // Adaptive polling - adjust interval based on server recommendation
          const recommendedInterval = data.polling?.recommendedInterval || 60000;
          if (recommendedInterval !== currentIntervalRef.current) {
            console.log(`[DASHBOARD] Adjusting polling: ${currentIntervalRef.current}ms -> ${recommendedInterval}ms (live games: ${data.polling?.hasLiveGames})`);
            currentIntervalRef.current = recommendedInterval;
            // Clear and restart with new interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            pollingIntervalRef.current = setInterval(fetchAllGames, recommendedInterval);
          }
          
          console.log('[DASHBOARD] Games refreshed:', data.games?.length, 'games at', new Date().toLocaleTimeString(), 
            `(polling: ${currentIntervalRef.current}ms, live: ${data.polling?.hasLiveGames})`);
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
    pollingIntervalRef.current = setInterval(fetchAllGames, 5000);
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // SEPARATED DATA SOURCES - No more merging!
  // Live tab uses ONLY inplay SSE data (fastest, real-time)
  // Upcoming tab uses ONLY REST API data (scheduled games)
  
  // Convert inplay events to game format for Live tab
  const liveGamesFromInplay = useMemo(() => {
    return Object.values(inplayEvents || {}).map(event => {
      const homeTeam = event.homeTeam || event.stats?.[0]?.home || 'Home';
      const awayTeam = event.awayTeam || event.stats?.[0]?.away || 'Away';
      
      let homeScore = event.homeScore ?? 0;
      let awayScore = event.awayScore ?? 0;
      
      if (homeScore === 0 && awayScore === 0 && event.stats) {
        const totalStat = Object.values(event.stats).find(s => s.name === 'T');
        if (totalStat) {
          homeScore = parseInt(totalStat.home) || 0;
          awayScore = parseInt(totalStat.away) || 0;
        }
      }
      
      const sportIcons = {
        basketball: '🏀',
        hockey: '🏒',
        soccer: '⚽',
        amfootball: '🏈',
        baseball: '⚾',
        esports: '🎮'
      };
      const sportIcon = sportIcons[event.sport] || '🏆';
      const leagueName = event.league || inferLeague(homeTeam, awayTeam, event.sport);
      
      return {
        id: `inplay_${event.id}`,
        gameId: `inplay_${event.id}`,
        sport: event.sport,
        sportName: leagueName,
        league: leagueName,
        sportIcon: sportIcon,
        homeTeam: homeTeam.substring(0, 20),
        awayTeam: awayTeam.substring(0, 20),
        homeTeamFull: homeTeam,
        awayTeamFull: awayTeam,
        time: 'LIVE',
        commenceTime: new Date().toISOString(),
        status: 'IN_PROGRESS',
        isLive: true,
        isInplay: true,
        displayClock: event.displayClock,
        elapsedTime: event.elapsedTime,
        period: event.period,
        stateCode: event.stateCode,
        comments: event.comments || [],
        scores: {
          home: { total: homeScore },
          away: { total: awayScore }
        },
        lines: event.odds && Object.keys(event.odds).length > 0 ? {
          moneyline: {
            home: event.odds.moneyline?.home || null,
            away: event.odds.moneyline?.away || null
          },
          spread: {
            home: event.odds.spread?.home ? 
              { point: parseFloat(event.odds.spread.home.line) || 0, odds: parseFloat(event.odds.spread.home.odds) || -110 } 
              : null,
            away: event.odds.spread?.away ? 
              { point: parseFloat(event.odds.spread.away.line) || 0, odds: parseFloat(event.odds.spread.away.odds) || -110 } 
              : null
          },
          total: {
            over: (event.odds.total?.line !== undefined && event.odds.total?.line !== null) ? 
              { point: parseFloat(event.odds.total.line) || 0, odds: parseFloat(event.odds.total.over) || -110 } 
              : null,
            under: (event.odds.total?.line !== undefined && event.odds.total?.line !== null) ? 
              { point: parseFloat(event.odds.total.line) || 0, odds: parseFloat(event.odds.total.under) || -110 } 
              : null
          }
        } : null,
        dataSource: 'Goalserve Inplay'
      };
    });
  }, [inplayEvents]);
  
  // Helper to normalize team names for matching
  const normalizeTeamName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/state$/, 'st')
      .replace(/university$/, '');
  };
  
  // Get upcoming games from REST API (exclude any that are live in inplay)
  const upcomingGamesFromApi = useMemo(() => {
    return apiGames
      .map(game => ({ ...game, league: game.league || game.sportName }))
      .filter(game => {
        // Exclude games that are already showing in inplay
        const isInInplay = liveGamesFromInplay.some(inplay => {
          const home1 = normalizeTeamName(game.homeTeamFull || game.homeTeam);
          const away1 = normalizeTeamName(game.awayTeamFull || game.awayTeam);
          const home2 = normalizeTeamName(inplay.homeTeamFull || inplay.homeTeam);
          const away2 = normalizeTeamName(inplay.awayTeamFull || inplay.awayTeam);
          return (home1 === home2 && away1 === away2) || (home1 === away2 && away1 === home2);
        });
        // Also exclude games marked as live or completed by REST API
        return !isInInplay && !game.isLive && !game.isCompleted;
      });
  }, [apiGames, liveGamesFromInplay]);
  
  // Combined for backward compatibility with existing code
  const gamesWithLiveData = useMemo(() => {
    return [...liveGamesFromInplay, ...upcomingGamesFromApi];
  }, [liveGamesFromInplay, upcomingGamesFromApi]);

  // Simplified categorization - no merge logic needed
  const categorizedGames = useMemo(() => ({
    liveGames: liveGamesFromInplay,
    upcomingGames: upcomingGamesFromApi,
    recentlyCompletedGames: []
  }), [liveGamesFromInplay, upcomingGamesFromApi]);

  useEffect(() => {
    setAllGames(gamesWithLiveData);
    
    // Get both live and upcoming games - DON'T filter by tab here, show all
    const liveGames = [...categorizedGames.liveGames, ...(categorizedGames.recentlyCompletedGames || [])];
    const upcomingGames = categorizedGames.upcomingGames || [];
    
    // Choose which to display based on tab, but keep both available
    const activeGames = selectedTab === 'live' ? liveGames : upcomingGames;
    
    // Apply sport filter - match both specific leagues AND base sport fallbacks
    let filteredGames = activeGames;
    if (selectedSport !== 'All Sports') {
      // Map sport buttons to base sport fallbacks for matching
      const sportMappings = {
        'NBA': ['NBA', 'BASKETBALL', "WOMEN'S BASKETBALL"],
        'NCAAB': ['NCAAB', 'BASKETBALL', "WOMEN'S BASKETBALL", "WOMEN'S NCAAB"],
        'NFL': ['NFL', 'FOOTBALL'],
        'NCAAF': ['NCAAF', 'FOOTBALL'],
        'MLB': ['MLB', 'BASEBALL', 'COLLEGE BASEBALL'],
        'NHL': ['NHL', 'HOCKEY'],
        'Euro Basketball': ['EUROLEAGUE', 'TURKEY BASKETBALL', 'ITALY BASKETBALL', 'GREECE BASKETBALL', 'SPAIN BASKETBALL', 'FRANCE BASKETBALL', 'GERMANY BASKETBALL', 'EUROPEAN BASKETBALL', 'BASKETBALL'],
        "Int'l Hockey": ['HOCKEY', 'NHL']
      };
      const validSportNames = sportMappings[selectedSport] || [selectedSport];
      filteredGames = activeGames.filter(g => {
        const sportNameUpper = (g.sportName || '').toUpperCase();
        return validSportNames.some(name => sportNameUpper === name.toUpperCase());
      });
    }
    
    setGames(filteredGames);
    setLoading(false);
  }, [selectedSport, selectedTab, gamesWithLiveData, categorizedGames]);


  const formatOdds = (odds) => {
    if (odds === null || odds === undefined || odds === 0) return '-';
    const num = typeof odds === 'string' ? parseFloat(odds) : odds;
    if (isNaN(num)) return '-';
    return num > 0 ? `+${num}` : num.toString();
  };

  const formatSpread = (point) => {
    if (point === null || point === undefined) return '-';
    const num = parseFloat(point);
    if (isNaN(num)) return point;
    return num > 0 ? `+${num}` : num.toString();
  };

  const formatTotal = (point, type) => {
    if (point === null || point === undefined) return '-';
    const prefix = type === 'over' ? 'O' : 'U';
    return `${prefix} ${point}`;
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
      'Soccer': '⚽',
      'Euro Basketball': '🏀',
      "Int'l Hockey": '🏒'
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
            <TapSurface
              onTap={() => setSelectedTab('live')}
              isActive={selectedTab === 'live'}
              activeColor="#dc2626"
              inactiveColor={isDarkMode ? '#1a1a1a' : '#e5e7eb'}
              activeTextColor="#ffffff"
              inactiveTextColor={isDarkMode ? '#9ca3af' : '#4b5563'}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: selectedTab === 'live' ? '#ffffff' : (categorizedGames.liveGames.length > 0 ? '#ef4444' : '#6b7280')
                }}
              ></span>
              Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}
            </TapSurface>
            <TapSurface
              onTap={() => setSelectedTab('upcoming')}
              isActive={selectedTab === 'upcoming'}
              activeColor="#2563eb"
              inactiveColor={isDarkMode ? '#1a1a1a' : '#e5e7eb'}
              activeTextColor="#ffffff"
              inactiveTextColor={isDarkMode ? '#9ca3af' : '#4b5563'}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}
            >
              Upcoming {categorizedGames.upcomingGames.length > 0 && `(${categorizedGames.upcomingGames.length})`}
            </TapSurface>
            {lastUpdated && (
              <span className="text-xs" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {sports.map((sport) => (
              <TapSurface
                key={sport}
                onTap={() => handleSportClick(sport)}
                isActive={selectedSport === sport}
                activeColor={isDarkMode ? '#1a1a1a' : '#e5e7eb'}
                inactiveColor="transparent"
                activeTextColor={isDarkMode ? '#ffffff' : '#111827'}
                inactiveTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: selectedSport === sport ? (isDarkMode ? '#4b5563' : '#9ca3af') : (isDarkMode ? '#1f2937' : '#d1d5db')
                }}
              >
                <span style={{ fontSize: '16px' }}>{getSportIcon(sport)}</span>
                <span>{getSportLabel(sport)}</span>
              </TapSurface>
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
            {categorizedGames.liveGames.filter(g => g.lines && g.lines.moneyline).slice(0, 3).map((game) => {
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              return (
                <div 
                  key={game.id} 
                  className="flex-shrink-0 w-[280px] rounded-2xl overflow-hidden" 
                  style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-500 text-xs">{game.sportName}</span>
                      {isLive ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 text-xs font-medium">LIVE</span>
                          {game.displayClock && <span className="text-gray-400 text-xs">• {game.displayClock}</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs ml-auto">{game.time || 'TBD'}</span>
                      )}
                    </div>
                    <div 
                      className="mb-4 cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
                      onClick={() => router.push(`/game/${game.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base truncate" style={{ color: isDarkMode ? '#ffffff' : '#111827', maxWidth: '180px', display: 'block' }}>{game.awayTeamFull || game.awayTeam}</span>
                        {isLive && <span className="font-bold" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.scores?.away?.total || 0}</span>}
                      </div>
                      <div className="text-gray-500 text-xs">@</div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base truncate" style={{ color: isDarkMode ? '#ffffff' : '#111827', maxWidth: '180px', display: 'block' }}>{game.homeTeamFull || game.homeTeam}</span>
                        {isLive && <span className="font-bold" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.scores?.home?.total || 0}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {game.lines?.moneyline?.away ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                          activeColor="#2563eb"
                          inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                          style={{ flex: 1, borderRadius: '8px', padding: '12px', textAlign: 'center', borderWidth: '1px', borderStyle: 'solid', borderColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : (isDarkMode ? '#374151' : '#d1d5db'), minHeight: '56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                        >
                          <div style={{ fontSize: '12px', marginBottom: '2px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : (isDarkMode ? '#9ca3af' : '#6b7280'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{getShortTeamName(game.awayTeamFull || game.awayTeam, game.homeTeamFull || game.homeTeam)}</div>
                          <div style={{ fontWeight: 'bold', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.away)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '12px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '56px', opacity: 0.5 }}>
                          <div style={{ fontSize: '12px', marginBottom: '4px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>{getShortTeamName(game.awayTeamFull || game.awayTeam, game.homeTeamFull || game.homeTeam)}</div>
                          <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      )}
                      {game.lines?.moneyline?.home ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                          activeColor="#2563eb"
                          inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                          style={{ flex: 1, borderRadius: '8px', padding: '12px', textAlign: 'center', borderWidth: '1px', borderStyle: 'solid', borderColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : (isDarkMode ? '#374151' : '#d1d5db'), minHeight: '56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                        >
                          <div style={{ fontSize: '12px', marginBottom: '2px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : (isDarkMode ? '#9ca3af' : '#6b7280'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{getShortTeamName(game.homeTeamFull || game.homeTeam, game.awayTeamFull || game.awayTeam)}</div>
                          <div style={{ fontWeight: 'bold', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.home)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '12px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '56px', opacity: 0.5 }}>
                          <div style={{ fontSize: '12px', marginBottom: '4px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>{getShortTeamName(game.homeTeamFull || game.homeTeam, game.awayTeamFull || game.awayTeam)}</div>
                          <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      )}
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
                const hasAnyLines = game.lines && (game.lines.moneyline || game.lines.spread || game.lines.total);
                const linesLocked = game.linesLocked || isFinal || !hasAnyLines;
                
                return (
                  <div 
                    key={`${game.id}-${game.scores?.home?.total}-${game.scores?.away?.total}`} 
                    className="rounded-xl overflow-hidden" 
                    style={{ backgroundColor: isDarkMode ? '#111111' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(209, 213, 219, 1)' }}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-medium">{game.league || sport}</span>
                          {isFinal ? (
                            <span className="text-gray-400 text-xs font-bold">FINAL</span>
                          ) : isLive ? (
                            <LiveGameTimer 
                              elapsedTime={game.elapsedTime || game.displayClock}
                              period={game.period || game.quarter}
                              sport={game.sport || sport}
                              stateCode={game.stateCode}
                            />
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">{game.time || 'TBD'}</span>
                          )}
                        </div>
                      </div>
                      
                      <div 
                        className="space-y-2 mb-4 cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
                        onClick={() => router.push(`/game/${game.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.awayTeamFull || game.awayTeam}</span>
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.scores?.away?.total || 0}</span>
                          ) : (
                            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.homeTeamFull || game.homeTeam}</span>
                          </div>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-lg" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{game.scores?.home?.total || 0}</span>
                          ) : (
                            <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                          )}
                        </div>
                      </div>

                      {isLive && game.comments && game.comments.length > 0 && (
                        <div className="mb-4">
                          <LiveActionFeed 
                            comments={game.comments}
                            maxItems={3}
                            homeTeam={game.homeTeamFull || game.homeTeam}
                            awayTeam={game.awayTeamFull || game.awayTeam}
                          />
                        </div>
                      )}

                      {linesLocked ? (
                        <div>
                          <div className="flex gap-2 mb-1">
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Spread</div>
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Moneyline</div>
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Total</div>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                              <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* MINIMIZED VIEW - Saved for future use
                        <div className="flex gap-2">
                          <button
                            onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                            className="flex-1 rounded-lg py-3 px-3"
                            style={{
                              backgroundColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#2563eb' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                              borderWidth: 1,
                              borderColor: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : (isDarkMode ? '#374151' : '#d1d5db')
                            }}
                          >
                            <div className="text-xs mb-0.5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.awayTeamFull || game.awayTeam).split(' ').pop()} ML</div>
                            <div className="font-bold text-lg" style={{ color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>
                              {formatOdds(game.lines.moneyline.away)}
                            </div>
                          </button>
                          <button
                            onClick={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                            className="flex-1 rounded-lg py-3 px-3"
                            style={{
                              backgroundColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#2563eb' : (isDarkMode ? '#1a1a1a' : '#f3f4f6'),
                              borderWidth: 1,
                              borderColor: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : (isDarkMode ? '#374151' : '#d1d5db')
                            }}
                          >
                            <div className="text-xs mb-0.5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{(game.homeTeamFull || game.homeTeam).split(' ').pop()} ML</div>
                            <div className="font-bold text-lg" style={{ color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>
                              {formatOdds(game.lines.moneyline.home)}
                            </div>
                          </button>
                        </div>
                        */
                        <div>
                          <div className="flex gap-2 mb-1">
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Spread</div>
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Moneyline</div>
                            <div className="flex-1 text-center text-[10px] font-medium uppercase" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>Total</div>
                          </div>
                          <div className="flex gap-2 mb-2">
                            {game.lines?.spread?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center' }}
                              >
                                <div style={{ fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>{formatSpread(game.lines.spread.away.point)}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.away.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                              >
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.away)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.over ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                                isActive={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center' }}
                              >
                                <div style={{ fontSize: '12px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>{formatTotal(game.lines.total.over.point, 'over')}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.over.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {game.lines?.spread?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center' }}
                              >
                                <div style={{ fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>{formatSpread(game.lines.spread.home.point)}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.home.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                              >
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.home)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.under ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                                isActive={isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={isDarkMode ? '#1a1a1a' : '#f3f4f6'}
                                style={{ flex: 1, borderRadius: '8px', padding: '8px 4px', textAlign: 'center' }}
                              >
                                <div style={{ fontSize: '12px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#ffffff' : (isDarkMode ? '#ffffff' : '#111827') }}>{formatTotal(game.lines.total.under.point, 'under')}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#ffffff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.under.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div style={{ flex: 1, borderRadius: '8px', padding: '12px 4px', textAlign: 'center', backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', opacity: 0.5 }}>
                                <svg className="w-5 h-5" fill="none" stroke={isDarkMode ? '#6b7280' : '#9ca3af'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
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
