import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new auth page (NextAuth.js)
    router.push('/auth');
  }, [router]);

  return (
    <div style={{
      backgroundColor: "#000",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      color: "#fff",
      fontFamily: "sans-serif",
      flexDirection: "column"
    }}>
      <h1 style={{ color: "#a020f0", marginBottom: "20px" }}>Login to RollrFunded</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        theme="dark"
        providers={[]}
        magicLink
      />
    </div>
  );
}
