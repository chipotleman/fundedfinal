// pages/dashboard.js

export default function Dashboard() {
  const games = [
    { sport: 'NBA', matchup: 'Lakers vs Warriors', odds: '-110', time: '7:00 PM' },
    { sport: 'NFL', matchup: 'Cowboys vs Eagles', odds: '+125', time: '8:30 PM' },
    { sport: 'MLB', matchup: 'Yankees vs Red Sox', odds: '-135', time: '6:45 PM' },
    { sport: 'NBA', matchup: 'Celtics vs Heat', odds: '+105', time: '9:00 PM' },
    { sport: 'NFL', matchup: 'Packers vs Bears', odds: '-150', time: '4:25 PM' },
  ];

  return (
    <div style={{
      backgroundColor: '#000',
      color: '#a020f0',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '20px', textShadow: '0 0 10px #a020f0' }}>
        🏈 RollrFunded Sportsbook Slate
      </h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '15px'
      }}>
        {games.map((game, index) => (
          <div key={index} style={{
            backgroundColor: '#111',
            border: '1px solid #a020f0',
            borderRadius: '8px',
            padding: '15px',
            textAlign: 'center',
            boxShadow: '0 0 15px #a020f0'
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#fff' }}>{game.sport}</h2>
            <p style={{ margin: '5px 0', fontSize: '1.1rem', color: '#ccc' }}>{game.matchup}</p>
            <p style={{ margin: '5px 0', fontSize: '1rem', color: '#a020f0' }}>Odds: {game.odds}</p>
            <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#888' }}>{game.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
