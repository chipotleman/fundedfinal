// pages/index.js

export default function Home() {
  return (
    <div style={{
      backgroundColor: "#000",
      color: "#fff",
      minHeight: "100vh",
      fontFamily: "sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      textAlign: "center"
    }}>
      <h1 style={{
        fontSize: "2.5rem",
        fontWeight: "bold",
        color: "#a020f0",
        textShadow: "0 0 20px #a020f0"
      }}>
        Get Funded to Bet Sports
      </h1>
      <p style={{
        fontSize: "1.2rem",
        maxWidth: "500px",
        marginTop: "20px",
        lineHeight: "1.5",
        color: "#ccc"
      }}>
        Risk-free. Keep 80% of profits. Prove your skill in 14 days with RollrFunded and bet with real odds without risking your own cash.
      </p>
    <button
  style={{
    marginTop: "30px",
    padding: "15px 30px",
    fontSize: "1rem",
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "#a020f0",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 0 15px #a020f0"
  }}
  onClick={async () => {
    const res = await fetch('/api/checkout_sessions', { method: 'POST' });
    const data = await res.json();
    window.location.href = data.url;
  }}
>
  Get Funded Now - $199
</button>


      <div style={{ marginTop: "60px", maxWidth: "500px" }}>
        <h2 style={{
          fontSize: "1.5rem",
          color: "#a020f0",
          marginBottom: "20px"
        }}>
          Why RollrFunded?
        </h2>
        <ul style={{ listStyle: "none", padding: 0, textAlign: "left", color: "#ccc" }}>
          <li>✅ Risk-free funded accounts</li>
          <li>✅ Keep 80% of profits</li>
          <li>✅ Real odds, real data</li>
        </ul>
      </div>
    </div>
  )
}
