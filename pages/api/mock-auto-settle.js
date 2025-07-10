// pages/api/mock-auto-settle.js

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
    // Fetch eligible games
    const { data: games, error } = await supabase
      .from('game_slates')
      .select('*')
      .lt('game_time', new Date().toISOString())
      .is('result', null);

    if (error) {
      console.error('❌ Fetch error:', error.message);
      return res.status(500).json({ error: 'Error fetching games.' });
    }

    if (!games || games.length === 0) {
      return res.status(200).json({ message: 'No eligible games to settle.' });
    }

    for (const game of games) {
      const teams = [];
      if (game.odds) {
        game.odds.split(',').forEach((pair) => {
          const [team] = pair.trim().split(':');
          if (team) {
            teams.push(team.trim());
          }
        });
      }

      if (teams.length < 2) continue;

      const randomWinner = teams[Math.floor(Math.random() * teams.length)];
      console.log(`Settling ${game.matchup} - Winner: ${randomWinner}`);

      // Mark game as settled
      await supabase
        .from('game_slates')
        .update({ result: randomWinner })
        .eq('id', game.id);

      // Call your settleBets API with correct fetch syntax
      await fetch(`${process.env.SITE_URL}/api/settleBets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchup_name: game.matchup,
          winner: randomWinner,
        }),
      });
    }

    res.status(200).json({ message: 'Mock auto-settlement completed.' });
  } catch (error) {
    console.error('❌ Settlement error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
