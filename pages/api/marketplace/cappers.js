import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { search, category, type } = req.query;

  try {
    // First get cappers
    const { data: cappers, error: cappersError } = await supabase
      .from('cappers')
      .select('*');

    if (cappersError) {
      throw cappersError;
    }

    // Then get stats separately to avoid relationship error
    const { data: stats, error: statsError } = await supabase
      .from('capper_stats')
      .select('*');

    if (statsError) {
      console.warn('Error fetching capper stats:', statsError);
    }

    // Combine the data
    const cappersWithStats = cappers?.map(capper => {
      const capperStats = stats?.find(stat => stat.capper_id === capper.id);
      return {
        ...capper,
        ...capperStats,
        helpedGetFunded: capperStats?.helped_get_funded || 0
      };
    }) || [];

    // Apply filters
    let filteredCappers = cappersWithStats;

    if (search) {
      filteredCappers = filteredCappers.filter(capper =>
        capper.name.toLowerCase().includes(search.toLowerCase()) ||
        capper.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (type && type !== 'all') {
      filteredCappers = filteredCappers.filter(capper => capper.type === type);
    }

    if (category && category !== 'all' && !['human', 'ai'].includes(category)) {
      filteredCappers = filteredCappers.filter(capper =>
        capper.categories && capper.categories.includes(category)
      );
    }

    // Ensure at least 10 visible cappers or AI models
    const visibleCappers = filteredCappers.slice(0, 10);

    res.status(200).json({
      cappers: visibleCappers || [],
      count: visibleCappers.length || 0
    });

  } catch (error) {
    console.error('Error fetching cappers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}