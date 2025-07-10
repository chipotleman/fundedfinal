// pages/api/fetch-slates.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return null;
  return decimal >= 2
    ? `+${Math.round((decimal - 1) * 100)}`
    : `${Math.round(-100 / (decimal - 1))}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/upcoming/odds/?regions=us&apiKey=eac5530694937d832146f4be09a72b55`
    );
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error('Invalid data from OddsAPI:', data);
      return res.status(500).json({ error: 'Invalid data from OddsAPI', data });
    }

    const formattedGames = data.slice(0, 20).map((game) => {
      const market = game.bookmakers?.[0]?.markets?.find(
        (m) => m.key === 'h2h'
      );

      const odds = {};
      market?.outcomes?.forEach((o) => {
        odds[o.name] = decimalToAmerican(o.price);
      });

      return {
        sport: game.sport_title,
        matchup: `${game.home_team} vs ${game.away_team}`,
        home_team: game.home_team,
        away_team: game.away_team,
        odds,
        game_time: game.commence_time,
      };
    });

    for (const game of formattedGames) {
      const { error } = await supabase
        .from('game_slates')
        .upsert(game, { onConflict: 'matchup' });

      if (error) {
        c
