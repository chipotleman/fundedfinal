export default function Dashboard() {
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
      <h1 style={{
        fontSize: "2rem",
        color: "#a020f0",
        textShadow: "0 0 10px #a020f0"
      }}>Welcome to RollrFunded</h1>
      <p style={{ color: "#ccc", maxWidth: "400px", marginTop: "20px" }}>
        Your 14-day funded evaluation has started. You have a $5,000 simulated bankroll.
      </p>
      <p style={{ color: "#ccc", marginTop: "10px" }}>
        We will track your bets, profit, and evaluation progress here.
      </p>
    </div>
  )
}
