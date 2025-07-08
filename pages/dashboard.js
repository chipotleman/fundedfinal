import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvaluations = async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .limit(10);

      if (error) {
        console.error('❌ Supabase fetch error:', error);
      } else {
        console.log('✅ Supabase evaluations:', data);
        setEvaluations(data);
      }
      setLoading(false);
    };

    fetchEvaluations();
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        No evaluations found.
      </div>
    );
  }

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1>Funded Evaluations</h1>
      {evaluations.map((evalItem) => (
        <div key={evalItem.id} style={{ border: '1px solid #444', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
          <p>Email: {evalItem.email}</p>
          <p>Status: {evalItem.status}</p>
          <p>PNL: {evalItem.total_pnl}</p>
          <p>Start: {new Date(evalItem.evaluation_start_date).toLocaleDateString()}</p>
          <p>End: {new Date(evalItem.evaluation_end_date).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
