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
      <h1 style={{ color: "#a020f0", marginBottom: "20px" }}>Redirecting to Login...</h1>
      <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
  );
}
