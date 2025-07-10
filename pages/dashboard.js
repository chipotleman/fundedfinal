// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import ProfileDrawer from '../components/ProfileDrawer';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUserAndEvaluation = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError.message);
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
        console.error('Error fetching evaluation:', evalError.message);
      } else {
        setEvaluation(data);
      }

      setLoading(false);
    };

    getUserAndEvaluation();
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
      backgroundColor: "#000",
      color: "#fff",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
      padding: "20px",
      textAlign: "center"
    }}>
      {/* Header with Profile Drawer */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
        paddingBottom: "20px"
      }}>
        <h1 style={{ fontSize: "2rem", color: "#a020f0", textShadow: "0 0 10px #a020f0" }}>
          Dashboard
        </h1>
        <ProfileDrawer />
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        <h2 style={{ fontSize: "1.5rem", color: "#a020f0", textShadow: "0 0 8px #a020f0" }}>
          Welcome, {user.email}
        </h2>
        <p style={{ color: "#ccc", marginTop: "20px" }}>
          Funded Balance: $5,000
        </p>
        <p style={{ color: "#ccc", marginTop: "10px" }}>
          Evaluation Period ends: {new Date(evaluation.evaluation_end_date).toLocaleDateString()}
        </p>
        <p style={{ color: "#ccc", marginTop: "10px" }}>
          Status: {evaluation.status}
        </p>
      </div>
    </div>
  );
}
