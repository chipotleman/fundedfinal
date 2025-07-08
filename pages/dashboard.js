// pages/dashboard.js
import BetSelector from '../components/BetSelector';
console.log('Logged-in user email:', user?.email);


import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        <BetSelector user={user} />

        return;
      }
      setUser(session.user);

      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
       .ilike('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching evaluation:', error);
      } else {
        setEvaluation(data);
      }
      setLoading(false);
    };
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Loading your dashboard...
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
        No funded evaluation found for your account.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "#000",
      color: "#fff",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "sans-serif",
      padding: "20px",
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: "2rem", color: "#a020f0", textShadow: "0 0 10px #a020f0" }}>
        Welcome, {user?.email || "User"}
      </h1>
      <p style={{ color: "#ccc", marginTop: "20px" }}>
        Funded Balance: $5,000
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Evaluation Period ends: {evaluation.evaluation_end_date ? new Date(evaluation.evaluation_end_date).toLocaleDateString() : "N/A"}
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Status: {evaluation.status || "N/A"}
      </p>
    </div>
  );
}
