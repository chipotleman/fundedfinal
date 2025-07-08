// pages/api/fetch-slates.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sports = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl', 'soccer_epl'];
  const apiKey = 'eac5530694937d832146f4be09a72b55';

  try {
    for (const sport of sports) {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals`);
      const data = await response.json();

      for (const game of data) {
        const { commence_time, home_team, away_team, sport_key, bookmakers } = game;

        for (const bookmaker of bookmakers) {
          for (const market of bookmaker.markets) {
            const oddsData = {
              bookmaker: bookmaker.title,
              outcomes: market.outcomes
            };

            const { error } = await supabase
              .from('available_bets')
              .insert([{
                sport: sport_key,
                home_team,
                away_team,
                commence_time,
                market_type: market.key,
                odds: oddsData
              }]);

            if (error) {
              console.error('Supabase insertion error:', error);
            }
          }
        }
      }
    }

    res.status(200).json({ message: 'Slates fetched and stored successfully' });
  } catch (error) {
    console.error('Error fetching slates:', error);
    res.status(500).json({ error: 'Failed to fetch slates' });
  }
}
