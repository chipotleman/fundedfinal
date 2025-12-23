export function categorizeGames(games) {
  if (!games || !Array.isArray(games) || games.length === 0) {
    return {
      liveGames: [],
      upcomingGames: [],
      recentlyCompletedGames: [],
      allUpcoming: [],
      todayGamesCount: 0,
      tomorrowGamesCount: 0,
      isNighttime: false
    };
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const etOptions = { timeZone: 'America/New_York' };
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    ...etOptions,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const todayET = etFormatter.format(now);
  
  const liveGames = [];
  const upcomingGames = [];
  const recentlyCompletedGames = [];
  
  games.forEach(game => {
    if (!game) return;
    
    const isLive = game.isLive || game.status === 'IN_PROGRESS' || game.status === 'HALFTIME';
    const isCompleted = game.isCompleted || game.status === 'FINAL';
    
    if (isLive) {
      liveGames.push(game);
    } else if (isCompleted) {
      // Check if game completed within the last minute (show briefly with locked lines)
      const completedAt = game.completedAt ? new Date(game.completedAt) : null;
      if (completedAt && completedAt > oneMinuteAgo) {
        recentlyCompletedGames.push({
          ...game,
          linesLocked: true,
          status: 'FINAL'
        });
      }
    } else {
      upcomingGames.push(game);
    }
  });
  
  upcomingGames.sort((a, b) => {
    const timeA = a.startTime || a.commenceTime ? new Date(a.startTime || a.commenceTime).getTime() : 0;
    const timeB = b.startTime || b.commenceTime ? new Date(b.startTime || b.commenceTime).getTime() : 0;
    return timeA - timeB;
  });
  
  const getGameDateET = (game) => {
    const gameTime = game.startTime || game.commenceTime;
    if (!gameTime) return null;
    try {
      const gameDate = new Date(gameTime);
      if (isNaN(gameDate.getTime())) return null;
      return etFormatter.format(gameDate);
    } catch {
      return null;
    }
  };
  
  const todayGames = upcomingGames.filter(g => {
    const gameDate = getGameDateET(g);
    return gameDate && gameDate === todayET;
  });
  
  const tomorrowGames = upcomingGames.filter(g => {
    const gameDate = getGameDateET(g);
    return gameDate && gameDate !== todayET;
  });
  
  let currentHour = 12;
  try {
    const hour = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York', 
      hour: 'numeric', 
      hour12: false 
    });
    currentHour = parseInt(hour) || 12;
  } catch {
    currentHour = 12;
  }
  
  const isNighttime = currentHour >= 23 || currentHour < 6;
  
  let displayUpcoming = upcomingGames;
  
  if (todayGames.length > 0 && !isNighttime) {
    displayUpcoming = todayGames;
  } else if (todayGames.length === 0 || isNighttime) {
    displayUpcoming = upcomingGames.length > 0 ? upcomingGames : tomorrowGames;
  }
  
  return {
    liveGames,
    upcomingGames: displayUpcoming,
    recentlyCompletedGames,
    allUpcoming: upcomingGames,
    todayGamesCount: todayGames.length,
    tomorrowGamesCount: tomorrowGames.length,
    isNighttime
  };
}

export function filterGamesBySport(games, selectedSport) {
  if (!games || !Array.isArray(games)) return [];
  if (selectedSport === 'all' || selectedSport === 'All Sports') return games;
  return games.filter(game => game && game.sportName === selectedSport);
}
