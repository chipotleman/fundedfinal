
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search, category, type } = req.query;

  try {
    let query = supabase
      .from('cappers')
      .select(`
        *,
        capper_stats (
          win_rate,
          total_picks,
          followers,
          rating,
          roi,
          current_streak
        )
      `);

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (category && category !== 'all' && !['human', 'ai'].includes(category)) {
      query = query.contains('categories', [category]);
    }

    const { data: cappers, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform data to match expected format
    const transformedCappers = cappers.map(capper => ({
      ...capper,
      winRate: capper.capper_stats?.[0]?.win_rate || 0,
      totalPicks: capper.capper_stats?.[0]?.total_picks || 0,
      followers: capper.capper_stats?.[0]?.followers || 0,
      rating: capper.capper_stats?.[0]?.rating || 0,
      roi: capper.capper_stats?.[0]?.roi || 0,
      currentStreak: capper.capper_stats?.[0]?.current_streak || 0
    }));

    res.status(200).json({ cappers: transformedCappers });

  } catch (error) {
    console.error('Error fetching cappers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
