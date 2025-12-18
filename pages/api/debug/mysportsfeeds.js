export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MYSPORTSFEEDS_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const authString = Buffer.from(`${apiKey}:MYSPORTSFEEDS`).toString('base64');
  const baseUrl = 'https://api.mysportsfeeds.com/v2.1/pull';
  
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const endpoints = [
    { name: 'NBA Games (Today)', url: `/nba/2024-2025-regular/date/${today}/games.json`, league: 'NBA' },
    { name: 'NBA Odds/Gamelines', url: `/nba/2024-2025-regular/date/${today}/odds_gamelines.json`, league: 'NBA' },
    { name: 'NBA Players', url: `/nba/players.json`, league: 'NBA' },
    { name: 'NBA Teams', url: `/nba/2024-2025-regular/teams.json`, league: 'NBA' },
    { name: 'NBA Standings', url: `/nba/2024-2025-regular/standings.json`, league: 'NBA' },
    { name: 'NFL Games (Today)', url: `/nfl/2024-regular/date/${today}/games.json`, league: 'NFL' },
    { name: 'NFL Odds/Gamelines', url: `/nfl/2024-regular/date/${today}/odds_gamelines.json`, league: 'NFL' },
    { name: 'NFL Players', url: `/nfl/players.json`, league: 'NFL' },
    { name: 'NFL Teams', url: `/nfl/2024-regular/teams.json`, league: 'NFL' },
    { name: 'MLB Games', url: `/mlb/2024-regular/games.json`, league: 'MLB' },
    { name: 'MLB Players', url: `/mlb/players.json`, league: 'MLB' },
    { name: 'NHL Games', url: `/nhl/2024-2025-regular/games.json`, league: 'NHL' },
    { name: 'NHL Players', url: `/nhl/players.json`, league: 'NHL' },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.url}`, {
        headers: { 'Authorization': `Basic ${authString}` }
      });

      let dataPreview = null;
      let recordCount = null;

      if (response.ok) {
        const data = await response.json();
        
        if (data.games) {
          recordCount = data.games.length;
          if (data.games[0]) {
            const g = data.games[0];
            dataPreview = `${g.schedule?.awayTeam?.abbreviation || 'Away'} @ ${g.schedule?.homeTeam?.abbreviation || 'Home'}`;
          }
        } else if (data.gameLines) {
          recordCount = data.gameLines.length;
          if (data.gameLines[0]?.lines?.[0]) {
            const line = data.gameLines[0].lines[0];
            dataPreview = `Spread: ${line.homeSpread?.homeSpread || 'N/A'}, O/U: ${line.overUnder?.overUnder || 'N/A'}`;
          }
        } else if (data.players) {
          recordCount = data.players.length;
          if (data.players[0]) {
            dataPreview = `${data.players[0].player?.firstName} ${data.players[0].player?.lastName}`;
          }
        } else if (data.teams) {
          recordCount = data.teams.length;
          if (data.teams[0]) {
            dataPreview = data.teams[0].team?.name || data.teams[0].team?.abbreviation;
          }
        } else if (data.standings) {
          recordCount = data.standings.length;
        }
      }

      results.push({
        name: endpoint.name,
        league: endpoint.league,
        endpoint: endpoint.url,
        status: response.status,
        statusText: response.status === 200 ? 'OK' : response.status === 401 ? 'Unauthorized' : response.status === 403 ? 'Forbidden' : response.statusText,
        accessible: response.ok,
        recordCount,
        dataPreview
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        league: endpoint.league,
        endpoint: endpoint.url,
        status: 'Error',
        statusText: error.message,
        accessible: false,
        recordCount: null,
        dataPreview: null
      });
    }
  }

  return res.status(200).json({
    apiKeyConfigured: true,
    apiKeyPrefix: apiKey.substring(0, 4) + '...',
    testedAt: new Date().toISOString(),
    results
  });
}
