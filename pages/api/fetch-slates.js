// pages/api/fetch-slates.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/upcoming/odds/?regions=us&apiKey=eac5530694937d832146f4be09a72b55`);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error('Invalid data from OddsAPI:', data);
      return res.status(500).json({ error: 'Invalid data from OddsAPI', data });
    }

    const formattedGames = data.slice(0, 20).map(game => ({
      sport: game.sport_title,
      matchup: `${game.home_team} vs ${game.away_team}`,
      odds: game.bookmakers?.[0]?.markets?.[0]?.outcomes?.map(o => `${o.name}: ${o.price}`).join(', ') || 'N/A',
      game_time: game.commence_time,
    }));

    const { error } = await supabase.from('game_slates').insert(formattedGames);

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(500).json({ error: 'Supabase insert failed', details: error });
    }

    res.status(200).json({ message: 'Slates fetched and stored', count: formattedGames.length });
  } catch (error) {
    console.error('❌ Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
}
