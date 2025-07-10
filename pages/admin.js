// pages/admin.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminPanel() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const adminEmail = 'mathewbaldwin13@yahoo.com'; // Update as needed

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || session.user.email !== adminEmail) {
        alert('Access denied.');
        window.location.href = '/';
        return;
      }

      const { data, error } = await supabase
        .from('evaluations')
        .select('*');

      if (error) {
        console.error(error.message);
      } else {
        setEvaluations(data);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const markAsPaid = async (id) => {
    const { error } = await supabase
      .from('evaluations')
      .update({ payout_status: 'paid', status: 'completed' })
      .eq('id', id);

    if (error) {
      console.error(error.message);
      alert('Error marking as paid.');
    } else {
      alert('Marked as paid.');
      location.reload();
    }
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading admin panel...</div>;
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#a020f0', fontSize: '2rem', textAlign: 'center' }}>Admin Panel</h1>
      <div style={{ maxWidth: '800px', margin: '0 auto', marginTop: '20px' }}>
        {evaluations.map(evaluation => (
          <div key={evaluation.id} style={{
            backgroundColor: '#111',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '10px',
            border: '1px solid #333'
          }}>
            <p><strong>Email:</strong> {evaluation.email}</p>
            <p><strong>Status:</strong> {evaluation.status}</p>
            <p><strong>Payout Status:</strong> {evaluation.payout_status}</p>
            <p><strong>Evaluation Ends:</strong> {new Date(evaluation.evaluation_end_date).toLocaleDateString()}</p>
            {evaluation.payout_status === 'approved' && (
              <button
                onClick={() => markAsPaid(evaluation.id)}
                style={{
                  backgroundColor: '#a020f0',
                  color: '#fff',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Mark as Paid
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
