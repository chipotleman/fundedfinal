// pages/dashboard.js

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUserEmail(data.user.email);
      } else {
        setUserEmail('Guest');
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>
        Loading your dashboard...
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
        Welcome to RollrFunded
      </h1>
      <p style={{ color: "#ccc", maxWidth: "400px", marginTop: "20px" }}>
        User: {userEmail}
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Funded Balance: $5,000
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Evaluation Period: 14 days remaining
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Status: Active
      </p>
    </div>
  )
}
