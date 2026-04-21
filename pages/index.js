import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import TapSurface from '../components/TapSurface';
import LiveGameTimer from '../components/LiveGameTimer';
import ActiveBattleCard from '../components/ActiveBattleCard';
import WaitingBattleCard from '../components/WaitingBattleCard';
import PoolContainer from '../components/PoolContainer';
import DepositMatchContainer from '../components/DepositMatchContainer';
import DepositMatchAppliedBanner from '../components/DepositMatchAppliedBanner';
import ForfeitConfirmedModal from '../components/ForfeitConfirmedModal';
import LiveBattlesSection from '../components/battle/LiveBattlesSection';
import Footer from '../components/Footer';
import { inferLeague } from '../lib/leagueInference';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import { categorizeGames, filterGamesBySport } from '../lib/gamesUtils';
import { useGoalserveLive } from '../hooks/useGoalserveLive';
import useModalScrollLock from '../hooks/useModalScrollLock';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const { apiGames: contextApiGames, inplayEvents: contextInplayEvents, loading: gamesLoading, error: gamesError, lastUpdated, isDemoMode } = useGames();
  const { matchup, opponent, myProfile, myBalance: matchupBalance, opponentBalance, myLiveBalance, opponentLiveBalance, myUnrealizedPnl, opponentUnrealizedPnl, myPendingAtRiskCount, myBets, opponentBets, canSeeOpponentBets, hasActiveMatchup, isWaiting, isQueued, queueEntry, hasAnyMatchup, timeRemaining, refresh: refreshMatchup } = useMatchup();
  const [selectedSport, setSelectedSport] = useState('Live');
  const [showBattleWalkthrough, setShowBattleWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const [forfeitConfirmation, setForfeitConfirmation] = useState(null);

  const battleStartedRetryRef = useRef(null);

  useModalScrollLock(showBattleWalkthrough, { restoreScroll: true });

  useEffect(() => {
    if (router.query.battleStarted !== 'true') return;
    
    if (hasActiveMatchup) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      setShowBattleWalkthrough(true);
      router.replace('/', undefined, { shallow: true });
      if (battleStartedRetryRef.current) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
      }
      return;
    }

    refreshMatchup();
    let retryCount = 0;
    battleStartedRetryRef.current = setInterval(() => {
      retryCount++;
      refreshMatchup();
      if (retryCount >= 10) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
        router.replace('/', undefined, { shallow: true });
      }
    }, 1000);

    return () => {
      if (battleStartedRetryRef.current) {
        clearInterval(battleStartedRetryRef.current);
        battleStartedRetryRef.current = null;
      }
    };
  }, [router.query.battleStarted, hasActiveMatchup]);

  // Note: games/allGames are derived at render time via useMemo for SSR compatibility
  // These state setters are kept for legacy compatibility but initial values come from SSR
  const [gamesState, setGames] = useState([]);
  const [allGamesState, setAllGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const [expandedGames, setExpandedGames] = useState({});
  const scrollPositionRef = useRef(0);
  const isFrozenRef = useRef(false);

  // Scroll position restoration for iOS/iPad app switching
  // Uses localStorage (not sessionStorage) because iOS kills the page and clears sessionStorage
  useEffect(() => {
    const SCROLL_KEY = 'piks_dashboard_scroll';
    const SCROLL_TIME_KEY = 'piks_dashboard_scroll_time';
    const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes max age for saved position
    
    const saveScrollPosition = () => {
      const pos = window.scrollY || window.pageYOffset || 0;
      scrollPositionRef.current = pos;
      try {
        localStorage.setItem(SCROLL_KEY, String(pos));
        localStorage.setItem(SCROLL_TIME_KEY, String(Date.now()));
      } catch (e) {}
    };

    const getSavedScrollPosition = () => {
      try {
        const savedPos = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
        const savedTime = parseInt(localStorage.getItem(SCROLL_TIME_KEY) || '0', 10);
        // Only use saved position if it's recent enough
        if (savedPos > 0 && Date.now() - savedTime < MAX_AGE_MS) {
          return savedPos;
        }
      } catch (e) {}
      return 0;
    };

    const clearSavedScroll = () => {
      try {
        localStorage.removeItem(SCROLL_KEY);
        localStorage.removeItem(SCROLL_TIME_KEY);
      } catch (e) {}
    };

    // Restore scroll position immediately on mount
    const restoreScrollPosition = () => {
      const savedPos = getSavedScrollPosition();
      if (savedPos > 0) {
        scrollPositionRef.current = savedPos;
        window.scrollTo(0, savedPos);
        // Multiple attempts for iOS reliability
        requestAnimationFrame(() => window.scrollTo(0, savedPos));
        setTimeout(() => window.scrollTo(0, savedPos), 50);
        setTimeout(() => window.scrollTo(0, savedPos), 100);
        setTimeout(() => window.scrollTo(0, savedPos), 200);
      }
    };

    // Restore on mount
    restoreScrollPosition();

    // Track scroll continuously
    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(saveScrollPosition, 100);
    };

    // Save immediately before page hides (iOS may kill page right after)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      } else if (document.visibilityState === 'visible') {
        restoreScrollPosition();
      }
    };

    const handlePageHide = () => {
      saveScrollPosition();
    };

    const handlePageShow = (e) => {
      restoreScrollPosition();
    };

    // Window focus/blur for additional iOS coverage
    const handleBlur = () => saveScrollPosition();
    const handleFocus = () => restoreScrollPosition();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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

  // Use games from context (preloaded on app start)
  const apiGames = contextApiGames || [];
  const inplayEvents = contextInplayEvents || {};
  
  // Also get SSE data from hook for real-time updates
  const { liveScores, liveOdds, events: hookInplayEvents, isConnected: liveConnected } = useGoalserveLive({ autoConnect: true });
  
  // Merge context inplay events with hook inplay events (hook may have fresher data)
  const mergedInplayEvents = useMemo(() => {
    const merged = { ...inplayEvents };
    if (hookInplayEvents) {
      Object.entries(hookInplayEvents).forEach(([id, event]) => {
        merged[id] = event;
      });
    }
    return merged;
  }, [inplayEvents, hookInplayEvents]);

  // SEPARATED DATA SOURCES - No more merging!
  // Live tab uses ONLY inplay SSE data (fastest, real-time)
  // Upcoming tab uses ONLY REST API data (scheduled games)
  
  // Convert inplay events to game format for Live tab
  // FILTER: Only include games that have odds (otherwise show locked/unusable cards)
  const liveGamesFromInplay = useMemo(() => {
    return Object.values(mergedInplayEvents || {})
    .filter(event => {
      // Only show games that have at least some odds data
      const hasOdds = event.odds && (
        event.odds.moneyline?.home || 
        event.odds.moneyline?.away || 
        event.odds.spread?.home || 
        event.odds.total?.line
      );
      return hasOdds;
    })
    .map(event => {
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
  }, [mergedInplayEvents]);
  
  // Helper to normalize team names for matching
  const normalizeTeamName = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/state$/, 'st')
      .replace(/university$/, '');
  };
  
  // Get upcoming games from REST API (exclude any that are live in inplay or completed)
  const upcomingGamesFromApi = useMemo(() => {
    const result = apiGames
      .map(game => ({ ...game, league: game.league || game.sportName }))
      .filter(game => {
        // Exclude games that are already showing in inplay (live games from SSE)
        const isInInplay = liveGamesFromInplay.some(inplay => {
          const home1 = normalizeTeamName(game.homeTeamFull || game.homeTeam);
          const away1 = normalizeTeamName(game.awayTeamFull || game.awayTeam);
          const home2 = normalizeTeamName(inplay.homeTeamFull || inplay.homeTeam);
          const away2 = normalizeTeamName(inplay.awayTeamFull || inplay.awayTeam);
          return (home1 === home2 && away1 === away2) || (home1 === away2 && away1 === home2);
        });
        const isSimLive = isDemoMode && game.isSimulated && game.isLive;
        return !isInInplay && !game.isCompleted && !isSimLive;
      });
    return result;
  }, [apiGames, liveGamesFromInplay, isDemoMode]);
  
  // Combined for backward compatibility with existing code
  const gamesWithLiveData = useMemo(() => {
    return [...liveGamesFromInplay, ...upcomingGamesFromApi];
  }, [liveGamesFromInplay, upcomingGamesFromApi]);

  const simulatedLiveGames = useMemo(() => {
    if (!isDemoMode) return [];
    return apiGames.filter(g => g.isLive && g.isSimulated);
  }, [apiGames, isDemoMode]);

  const categorizedGames = useMemo(() => ({
    liveGames: isDemoMode && liveGamesFromInplay.length === 0
      ? simulatedLiveGames
      : liveGamesFromInplay,
    upcomingGames: upcomingGamesFromApi,
    recentlyCompletedGames: []
  }), [liveGamesFromInplay, upcomingGamesFromApi, isDemoMode, simulatedLiveGames]);

  // Sport filter mappings
  const sportMappings = useMemo(() => ({
    'NBA': ['NBA', 'BASKETBALL', "WOMEN'S BASKETBALL"],
    'NCAAB': ['NCAAB', 'BASKETBALL', "WOMEN'S BASKETBALL", "WOMEN'S NCAAB"],
    'NFL': ['NFL', 'FOOTBALL'],
    'NCAAF': ['NCAAF', 'FOOTBALL'],
    'MLB': ['MLB', 'BASEBALL', 'COLLEGE BASEBALL'],
    'NHL': ['NHL', 'HOCKEY'],
    'Euro Basketball': ['EUROLEAGUE', 'TURKEY BASKETBALL', 'ITALY BASKETBALL', 'GREECE BASKETBALL', 'SPAIN BASKETBALL', 'FRANCE BASKETBALL', 'GERMANY BASKETBALL', 'EUROPEAN BASKETBALL', 'BASKETBALL'],
    "Int'l Hockey": ['HOCKEY', 'NHL']
  }), []);

  // CRITICAL FOR SSR: Derive games at render time (not in useEffect)
  // This ensures games are in the HTML during server render
  const allGames = useMemo(() => gamesWithLiveData, [gamesWithLiveData]);
  
  const games = useMemo(() => {
    const liveGames = [...categorizedGames.liveGames, ...(categorizedGames.recentlyCompletedGames || [])];
    const upcomingGames = categorizedGames.upcomingGames || [];
    
    const filterBySport = (gamesToFilter, sport) => {
      const validSportNames = sportMappings[sport] || [sport];
      return gamesToFilter.filter(g => {
        const sportNameUpper = (g.sportName || '').toUpperCase();
        return validSportNames.some(name => sportNameUpper === name.toUpperCase());
      });
    };
    
    const sortChronologically = (gamesToSort) => {
      return [...gamesToSort].sort((a, b) => {
        const isLiveA = a.isLive || a.status === 'IN_PROGRESS';
        const isLiveB = b.isLive || b.status === 'IN_PROGRESS';
        if (isLiveA && !isLiveB) return -1;
        if (!isLiveA && isLiveB) return 1;
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
      });
    };
    
    if (selectedSport === 'Live') {
      return sortChronologically(liveGames);
    }
    
    const sportLiveGames = filterBySport(liveGames, selectedSport);
    const sportUpcomingGames = filterBySport(upcomingGames, selectedSport);
    return sortChronologically([...sportLiveGames, ...sportUpcomingGames]);
  }, [selectedSport, categorizedGames, sportMappings]);

  // Legacy effect to update state for components that depend on it
  useEffect(() => {
    setAllGames(allGames);
    setGames(games);
    setLoading(false);
  }, [allGames, games]);


  const { formatOdds } = useUserPreferences();

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
    setSelectedSport(sport);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar 
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={handleBetSlipClick}
      />

      <div className="pt-3 sm:pt-4 lg:pt-5 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-16">
        <div className="mb-4">
          <div className="overflow-x-auto overflow-y-visible scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-3 py-1" style={{ minWidth: 'max-content' }}>
              {hasActiveMatchup && matchup ? (
                <ActiveBattleCard
                  matchup={matchup}
                  opponent={opponent || { username: 'Opponent', avatar: null }}
                  myBalance={matchupBalance}
                  opponentBalance={opponentBalance}
                  myLiveBalance={myLiveBalance}
                  opponentLiveBalance={opponentLiveBalance}
                  myUnrealizedPnl={myUnrealizedPnl}
                  opponentUnrealizedPnl={opponentUnrealizedPnl}
                  opponentBets={opponentBets}
                  canSeeBets={canSeeOpponentBets}
                  myBetsCount={myBets?.length || 0}
                  myPendingAtRiskCount={myPendingAtRiskCount}
                  myProfile={myProfile}
                  onForfeit={() => {
                    const opponentSnapshot = opponent
                      ? { username: opponent.username, avatar: opponent.avatar }
                      : { username: 'Opponent', avatar: null };
                    fetch('/api/battles/forfeit', { method: 'POST' })
                      .then(r => r.json())
                      .then(data => {
                        if (data.success) {
                          setForfeitConfirmation({
                            opponent: opponentSnapshot,
                            payout: data.matchup?.winnerPayout,
                            totalPot: data.matchup?.totalPot,
                          });
                          refreshMatchup();
                        }
                      })
                      .catch(() => {});
                  }}
                />
              ) : isWaiting && matchup ? (
                <WaitingBattleCard matchup={matchup} myProfile={myProfile} opponent={opponent} />
              ) : isQueued && queueEntry ? (
                <WaitingBattleCard queueEntry={queueEntry} myProfile={myProfile} />
              ) : (
                <DepositMatchContainer />
              )}
              <PoolContainer />
              <DepositMatchAppliedBanner />
            </div>
          </div>
        </div>

        <div 
          className="sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-3"
          style={{ 
            top: 'var(--top-nav-height, 70px)',
            backgroundColor: '#000000',
          }}
        >
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide">
            {isDemoMode && (
              <div className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider">Demo</span>
              </div>
            )}
            <TapSurface
              onTap={() => handleSportClick('Live')}
              isActive={selectedSport === 'Live'}
              activeColor="#dc2626"
              inactiveColor="transparent"
              activeTextColor="#ffffff"
              inactiveTextColor={'#9ca3af'}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '600',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: selectedSport === 'Live' ? '#dc2626' : ('#1f2937')
              }}
            >
              <span 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: selectedSport === 'Live' ? '#ffffff' : (categorizedGames.liveGames.length > 0 ? '#ef4444' : '#6b7280')
                }}
              ></span>
              <span>Live {categorizedGames.liveGames.length > 0 && `(${categorizedGames.liveGames.length})`}</span>
            </TapSurface>
            {sports.map((sport) => (
              <TapSurface
                key={sport}
                onTap={() => handleSportClick(sport)}
                isActive={selectedSport === sport}
                activeColor={'#1a1a1a'}
                inactiveColor="transparent"
                activeTextColor={'#ffffff'}
                inactiveTextColor={'#9ca3af'}
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
                  borderColor: selectedSport === sport ? ('#4b5563') : ('#1f2937')
                }}
              >
                <span style={{ fontSize: '16px' }}>{getSportIcon(sport)}</span>
                <span>{getSportLabel(sport)}</span>
              </TapSurface>
            ))}
          </div>
        </div>

        <LiveBattlesSection
          compact
          currentUserId={user?.id}
          youVsState={{
            status: hasActiveMatchup
              ? 'active'
              : isWaiting
                ? 'waiting'
                : isQueued
                  ? 'queued'
                  : 'idle',
            myProfile: myProfile || (user ? { id: user.id, username: user.username || user.name, avatar: user.avatar } : null),
            opponent: opponent || null,
          }}
          onYouVsClick={() => router.push('/battle')}
        />

        <div className="mb-6">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Featured</h2>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {categorizedGames.liveGames.filter(g => g.lines && g.lines.moneyline).slice(0, 3).map((game) => {
              const isLive = game.isLive || game.status === 'IN_PROGRESS';
              return (
                <div 
                  key={game.id} 
                  className="flex-shrink-0 w-[260px] rounded-xl overflow-hidden" 
                  style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-gray-500 text-[11px] font-medium">{game.sportName}</span>
                      {isLive ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 text-[11px] font-semibold">LIVE</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[11px] ml-auto">{game.time || 'TBD'}</span>
                      )}
                    </div>
                    <div 
                      className="mb-3 cursor-pointer -mx-1.5 px-1.5 py-1 rounded-lg transition-colors"
                      onClick={() => router.push(`/game/${game.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: '170px' }}>{game.awayTeamFull || game.awayTeam}</span>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: '170px' }}>{game.homeTeamFull || game.homeTeam}</span>
                        {isLive && <span className="font-bold text-sm tabular-nums" style={{ color: '#ffffff' }}>{game.scores?.home?.total || 0}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {game.lines?.moneyline?.away ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                          activeColor="#2563eb"
                          inactiveColor={'#141414'}
                          style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : ('#222')}` }}
                        >
                          <div style={{ fontSize: '10px', marginBottom: '1px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTeamName(game.awayTeamFull || game.awayTeam, game.homeTeamFull || game.homeTeam)}</div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.away)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', backgroundColor: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                      )}
                      {game.lines?.moneyline?.home ? (
                        <TapSurface
                          onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                          isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                          activeColor="#2563eb"
                          inactiveColor={'#141414'}
                          style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : ('#222')}` }}
                        >
                          <div style={{ fontSize: '10px', marginBottom: '1px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTeamName(game.homeTeamFull || game.homeTeam, game.awayTeamFull || game.awayTeam)}</div>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#ffffff' : '#3b82f6' }}>
                            {formatOdds(game.lines.moneyline.home)}
                          </div>
                        </TapSurface>
                      ) : (
                        <div style={{ flex: 1, borderRadius: '8px', padding: '8px 6px', textAlign: 'center', backgroundColor: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
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
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{selectedSport === 'Live' ? 'Live Now' : getSportLabel(selectedSport)}</h2>
              {selectedSport === 'Live' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>}
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm" style={{ color: '#6b7280' }}>Loading games...</p>
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
                    key={game.id} 
                    className="rounded-xl overflow-hidden" 
                    style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}
                  >
                    <div className="px-3.5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[11px] font-medium">{game.league || sport}</span>
                          {game.isSimulated && (
                            <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">DEMO</span>
                          )}
                          {isFinal ? (
                            <span className="text-gray-500 text-[11px] font-semibold">FINAL</span>
                          ) : isLive ? (
                            <LiveGameTimer 
                              elapsedTime={game.elapsedTime || game.displayClock}
                              period={game.period || game.quarter}
                              sport={game.sport || sport}
                              stateCode={game.stateCode}
                            />
                          ) : (
                            <span className="text-gray-500 text-[11px] font-medium">{game.time || 'TBD'}</span>
                          )}
                        </div>
                      </div>
                      
                      <div 
                        className="mb-3 cursor-pointer -mx-1.5 px-1.5 py-0.5 rounded-lg transition-colors"
                        onClick={() => router.push(`/game/${game.id}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: 'calc(100% - 40px)' }}>{game.awayTeamFull || game.awayTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-sm tabular-nums flex-shrink-0 ml-2" style={{ color: '#ffffff' }}>{game.scores?.away?.total || 0}</span>
                          ) : (
                            <span className="text-gray-600 text-sm flex-shrink-0 ml-2">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate" style={{ color: '#ffffff', maxWidth: 'calc(100% - 40px)' }}>{game.homeTeamFull || game.homeTeam}</span>
                          {(isLive || isFinal) ? (
                            <span className="font-bold text-sm tabular-nums flex-shrink-0 ml-2" style={{ color: '#ffffff' }}>{game.scores?.home?.total || 0}</span>
                          ) : (
                            <span className="text-gray-600 text-sm flex-shrink-0 ml-2">-</span>
                          )}
                        </div>
                      </div>


                      {linesLocked ? (
                        <div>
                          <div className="flex gap-1.5 mb-1">
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Spread</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>ML</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Total</div>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            {[0,1,2].map(i => (
                              <div key={`lock-a-${i}`} className="flex-1 rounded-lg flex items-center justify-center" style={{ padding: '6px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            {[0,1,2].map(i => (
                              <div key={`lock-h-${i}`} className="flex-1 rounded-lg flex items-center justify-center" style={{ padding: '6px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex gap-1.5 mb-1">
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Spread</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>ML</div>
                            <div className="flex-1 text-center text-[9px] font-medium uppercase tracking-wider" style={{ color: '#4b5563' }}>Total</div>
                          </div>
                          <div className="flex gap-1.5 mb-1.5">
                            {game.lines?.spread?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.away, `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#fff' : ('#d1d5db') }}>{formatSpread(game.lines.spread.away.point)}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.awayTeamFull || game.awayTeam} ${game.lines.spread.away.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.away.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.away ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.away, game.awayTeamFull || game.awayTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'moneyline', game.awayTeamFull || game.awayTeam) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.away)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.over ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                                isActive={isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#fff' : ('#d1d5db') }}>{formatTotal(game.lines.total.over.point, 'over')}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'total', `Over ${game.lines.total.over.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.over.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {game.lines?.spread?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'spread', game.lines.spread.home, `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                isActive={isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#fff' : ('#d1d5db') }}>{formatSpread(game.lines.spread.home.point)}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'spread', `${game.homeTeamFull || game.homeTeam} ${game.lines.spread.home.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.spread.home.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.moneyline?.home ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'moneyline', game.lines.moneyline.home, game.homeTeamFull || game.homeTeam)}
                                isActive={isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: `1px solid ${isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'moneyline', game.homeTeamFull || game.homeTeam) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.moneyline.home)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                            {game.lines?.total?.under ? (
                              <TapSurface
                                onTap={() => addToBetSlip(game, 'total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                                isActive={isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`)}
                                activeColor="#2563eb"
                                inactiveColor={'#111'}
                                style={{ flex: 1, borderRadius: '6px', padding: '5px 2px', textAlign: 'center', border: `1px solid ${isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#3b82f6' : ('#1a1a1a')}` }}
                              >
                                <div style={{ fontSize: '11px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#fff' : ('#d1d5db') }}>{formatTotal(game.lines.total.under.point, 'under')}</div>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: isBetInSlip(game, 'total', `Under ${game.lines.total.under.point}`) ? '#fff' : '#3b82f6' }}>
                                  {formatOdds(game.lines.total.under.odds)}
                                </div>
                              </TapSurface>
                            ) : (
                              <div className="flex-1 rounded-md flex items-center justify-center" style={{ padding: '5px 2px', backgroundColor: '#111', opacity: 0.35 }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="#4b5563" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
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
              <div className="text-center py-10">
                <div className="rounded-xl p-6 max-w-sm mx-auto" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${'#1a1a1a'}`, boxShadow: 'none' }}>
                  <p className="text-sm font-medium mb-1" style={{ color: '#ffffff' }}>No Games Available</p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>Check back later for {selectedSport} games.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      <BetSlip
        bankroll={bankroll}
        isOpen={showBetSlip}
        onClose={() => setShowBetSlip(false)}
        onBetPlaced={handleBetPlaced}
      />

      {showBattleWalkthrough && hasActiveMatchup && matchup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <style>{`
            @keyframes wtSlideUp {
              from { opacity: 0; transform: translateY(30px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes wtPulse {
              0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
              50% { box-shadow: 0 0 40px rgba(59,130,246,0.5); }
            }
            @keyframes wtFadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div 
            className="w-full max-w-[380px] rounded-2xl overflow-hidden flex flex-col"
            style={{ 
              background: 'linear-gradient(180deg, #0a1628 0%, #0d0d0d 100%)',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              animation: 'wtSlideUp 0.4s ease-out, wtPulse 3s ease-in-out infinite',
              boxShadow: 'none',
              maxHeight: 'calc(100dvh - 2rem)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: walkthroughStep === i ? '24px' : '8px', backgroundColor: walkthroughStep >= i ? '#3b82f6' : ('#333') }}></div>
                ))}
              </div>
              <button onClick={() => { setShowBattleWalkthrough(false); setWalkthroughDismissed(true); setWalkthroughStep(0); }} className="text-gray-600 text-xs">Skip</button>
            </div>

            <div key={walkthroughStep} className="flex-1 overflow-y-auto min-h-0" style={{ animation: 'wtFadeIn 0.3s ease-out' }}>
              {walkthroughStep === 0 && (
                <>
                  <div className="px-5 pt-2 pb-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-xs font-bold uppercase tracking-wider">Battle Started</span>
                    </div>
                    <h2 className={`text-xl font-bold mb-1 ${'text-white'}`}>You're Matched!</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>You've been paired for a 1v1 battle.</p>
                  </div>
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #3b82f6' }}>
                          {(myProfile?.avatar || user?.avatar) ? (
                            <img src={myProfile?.avatar || user?.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-bold text-lg ${'text-white'}`}>{(myProfile?.username || user?.username || user?.name || '')[0]?.toUpperCase() || 'P'}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate max-w-[90px] ${'text-white'}`}>{myProfile?.username || user?.username || user?.name || ''}</p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <span className="text-2xl font-black text-blue-400">VS</span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={{ backgroundColor: '#1a1a1a', border: '2px solid #06b6d4' }}>
                          {opponent?.avatar ? (
                            <img src={opponent.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-bold text-lg ${'text-white'}`}>{(opponent?.username || 'O')[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate max-w-[90px] ${'text-white'}`}>{opponent?.username || 'Opponent'}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Mode</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>{matchup.durationMinutes <= 200 ? 'RUSH' : matchup.durationMinutes <= 1500 ? 'ORIGINAL' : 'TOURNAMENT'}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Pot</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>${(() => {
                          const payout = parseFloat(matchup.winnerPayout);
                          if (payout > 0) return payout.toLocaleString();
                          const gross = parseFloat(matchup.potSize || matchup.startingBalance * 2 || 20000);
                          const fee = parseFloat(matchup.platformFee);
                          const net = fee > 0 ? gross - fee : gross - gross * 0.10;
                          return net.toLocaleString();
                        })()}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Time</p>
                        <p className={`font-bold text-sm ${'text-white'}`}>
                          {timeRemaining ? (() => {
                            const m = Math.floor(timeRemaining / 60000);
                            const h = Math.floor(m / 60);
                            const d = Math.floor(h / 24);
                            if (d > 0) return `${d}d ${h % 24}h`;
                            if (h > 0) return `${h}h ${m % 60}m`;
                            return `${m}m`;
                          })() : 'Starting'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {walkthroughStep === 1 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <h2 className={`text-lg font-bold mb-1 ${'text-white'}`}>How It Works</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>Three simple steps to win</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-400 text-xs font-bold">1</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Place Your Picks</p>
                        <p className="text-gray-500 text-xs">Browse games below and add bets to your slip. Pick spreads, moneylines, or totals.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-400 text-xs font-bold">2</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Grow Your Balance</p>
                        <p className="text-gray-500 text-xs">You both start with ${parseFloat(matchup.startingBalance || 10000).toLocaleString()}. Winning picks grow your bankroll.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-orange-400 text-xs font-bold">3</span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Highest Balance Wins</p>
                        <p className="text-gray-500 text-xs">When time runs out, the player with the higher balance takes 90% of the pot.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {walkthroughStep === 2 && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">💡</span>
                    </div>
                    <h2 className={`text-lg font-bold mb-1 ${'text-white'}`}>Tips to Win</h2>
                    <p className={`text-sm ${'text-gray-400'}`}>Quick strategy guide</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">📊</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Track the Banner</p>
                        <p className="text-gray-500 text-xs">Your battle status bar at the top shows both balances and time left in real-time.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">🔒</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Hidden Bets</p>
                        <p className="text-gray-500 text-xs">Your opponent can't see your picks until you've placed at least one bet — and vice versa.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#111', border: `1px solid ${'#222'}` }}>
                      <span className="text-lg mt-0.5">⚡</span>
                      <div>
                        <p className={`text-sm font-semibold ${'text-white'}`}>Manage Risk</p>
                        <p className="text-gray-500 text-xs">Don't go all-in early. Spread your bets across games to build a steady lead.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex-shrink-0 flex gap-2">
              {walkthroughStep > 0 && (
                <button
                  onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                  className="py-3 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb', border: '1px solid #333' }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (walkthroughStep < 2) {
                    setWalkthroughStep(walkthroughStep + 1);
                  } else {
                    setShowBattleWalkthrough(false);
                    setWalkthroughDismissed(true);
                    setWalkthroughStep(0);
                  }
                }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              >
                {walkthroughStep === 0 ? 'How Does It Work?' : walkthroughStep === 1 ? 'Got It, Any Tips?' : 'Start Picking'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <ForfeitConfirmedModal
        isOpen={!!forfeitConfirmation}
        onClose={() => setForfeitConfirmation(null)}
        opponent={forfeitConfirmation?.opponent}
        payout={forfeitConfirmation?.payout}
        totalPot={forfeitConfirmation?.totalPot}
      />
    </div>
  );
}

// Server-side rendering for ZERO delay game loading
// Serve cached data instantly - never block on cache warming
export async function getServerSideProps() {
  try {
    const { getInplayService } = require('../lib/goalserve-inplay');
    const { getScheduledGamesForSSR } = require('../lib/goalserve-autostart');
    
    const service = getInplayService();
    
    // Get whatever is cached RIGHT NOW - no waiting
    const events = service.getEventsForSSR();
    const scheduledGames = getScheduledGamesForSSR();
    
    console.log(`[Dashboard SSR] Serving ${events.length} live + ${scheduledGames.length} scheduled (instant)`);
    
    return {
      props: {
        initialInplayEvents: events,
        initialApiGames: scheduledGames,
      },
    };
  } catch (error) {
    console.error('[Dashboard SSR] Error:', error);
    return {
      props: {
        initialInplayEvents: [],
        initialApiGames: [],
      },
    };
  }
}
