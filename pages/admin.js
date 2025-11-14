import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const router = useRouter();
  const adminEmail = 'mathewbaldwin13@yahoo.com';

  useEffect(() => {
    const fetchData = async () => {
      if (!session || session.user.email !== adminEmail) {
        alert('Access denied.');
        router.push('/');
        return;
      }

      try {
        // TODO: Create API route to fetch evaluations when admin features are needed
        setEvaluations([]);
      } catch (error) {
        console.error(error.message);
      }
      setLoading(false);
    };

    if (session !== undefined) {
      fetchData();
    }
  }, [session, router]);

  const markAsPaid = async (id) => {
    try {
      // TODO: Create API route to update evaluation status when admin features are needed
      alert('Admin feature requires API implementation');
    } catch (error) {
      console.error(error.message);
      alert('Error marking as paid.');
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
