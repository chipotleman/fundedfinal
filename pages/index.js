// pages/index.js

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkSession();
  }, [router]);

  return (
    <div style={{
      backgroundColor: "#000",
      color: "#fff",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      fontFamily: "sans-serif",
      padding: "20px",
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: "2rem", color: "#a020f0", textShadow: "0 0 10px #a020f0" }}>
        Welcome to RollrFunded
      </h1>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        Get funded to bet, pass your challenge, and receive payouts.
      </p>
      <a
        href="/login"
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#a020f0",
          color: "#fff",
          borderRadius: "5px",
          textDecoration: "none"
        }}
      >
        Login to Get Funded
      </a>
    </div>
  );
}
