import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_bets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching bets:', error.message);
      } else {
        setBets(data);
      }
      setLoading(false);
    };

    fetchBets();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📊 RollrFunded Dashboard</h1>
      {loading ? (
        <p>Loading bets...</p>
      ) : bets.length === 0 ? (
        <p>No bets found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 border">Created</th>
                <th className="px-2 py-1 border">Status</th>
                <th className="px-2 py-1 border">PNL</th>
                <th className="px-2 py-1 border">Selection</th>
                <th className="px-2 py-1 border">Stake</th>
                <th className="px-2 py-1 border">Odds</th>
                <th className="px-2 py-1 border">Market Type</th>
                <th className="px-2 py-1 border">Matchup</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <tr key={bet.id} className="text-center">
                  <td className="border px-2 py-1">
                    {new Date(bet.created_at).toLocaleString()}
                  </td>
                  <td className="border px-2 py-1">{bet.status}</td>
                  <td className="border px-2 py-1">
                    {bet.pnl !== null ? `$${bet.pnl.toFixed(2)}` : '-'}
                  </td>
                  <td className="border px-2 py-1">{bet.selection || '-'}</td>
                  <td className="border px-2 py-1">
                    {bet.stake !== null ? `$${bet.stake}` : '-'}
                  </td>
                  <td className="border px-2 py-1">
                    {bet.odds !== null ? bet.odds : '-'}
                  </td>
                  <td className="border px-2 py-1">{bet.market_type || '-'}</td>
                  <td className="border px-2 py-1">{bet.matchup_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
