// pages/dashboard.js

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
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError.message);
        }

        if (!session) {
          router.push('/login');
          return;
        }

        setUser(session.user);

        const { data, error: evalError } = await supabase
          .from('evaluations')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (evalError) {
          console.error('Evaluation fetch error:', evalError.message);
        }

        setEvaluation(data);
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>
        Loading your dashboard...
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>
        No funded evaluation found for your account.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "#000",  // black background
      color: "#fff",            // white text
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
