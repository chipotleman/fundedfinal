// pages/dashboard.js

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
        .order('evaluation_start_date', { ascending: false });

      if (error) {
        console.error('❌ Supabase fetch error:', error);
      } else {
        console.log('✅ Evaluations:', data);
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

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#a020f0', textAlign: 'center' }}>📊 RollrFunded Evaluations (Public View)</h1>
      {evaluations.length === 0 ? (
        <p style={{ textAlign: 'center', marginTop: '20px' }}>No evaluations found.</p>
      ) : (
        evaluations.map((evaluation) => (
          <div
            key={evaluation.id}
            style={{
              border: '1px solid #a020f0',
              borderRadius: '8px',
              padding: '10px',
              margin: '10px auto',
              maxWidth: '400px',
              background: '#111'
            }}
          >
            <p><strong>Email:</strong> {evaluation.email}</p>
            <p><strong>Status:</strong> {evaluation.status}</p>
            <p><strong>PNL:</strong> {evaluation.total_pnl}</p>
            <p><strong>Start:</strong> {new Date(evaluation.evaluation_start_date).toLocaleDateString()}</p>
            <p><strong>End:</strong> {new Date(evaluation.evaluation_end_date).toLocaleDateString()}</p>
          </div>
        ))
      )}
    </div>
  );
}
