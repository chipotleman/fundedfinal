import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function NFLRawTest() {
  const [feed, setFeed] = useState('inplay');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/nfl-raw-test?feed=${feed}`);
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [feed]);

  return (
    <div style={{ backgroundColor: '#111', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <Head>
        <title>NFL Raw Data Test</title>
      </Head>

      <h1 style={{ marginBottom: '20px' }}>NFL Goalserve Raw Data Test</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setFeed('inplay')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: feed === 'inplay' ? '#3b82f6' : '#333', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Inplay Feed
        </button>
        <button 
          onClick={() => setFeed('schedule')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: feed === 'schedule' ? '#3b82f6' : '#333', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Schedule Feed
        </button>
        <button 
          onClick={() => setFeed('scores')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: feed === 'scores' ? '#3b82f6' : '#333', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Scores Feed
        </button>
        <button 
          onClick={fetchData}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#22c55e', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#7f1d1d', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {data && (
        <div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '10px', color: '#3b82f6' }}>Summary</h2>
            <p><strong>Feed:</strong> {data.feed}</p>
            <p><strong>URL:</strong> {data.feedUrl}</p>
            {data.queryDate && <p><strong>Query Date (DD.MM.YYYY):</strong> <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{data.queryDate}</span></p>}
            <p><strong>Timestamp:</strong> {data.timestamp}</p>
            <p><strong>Response Status:</strong> {data.responseStatus}</p>
            <p><strong>Raw Text Length:</strong> {data.rawTextLength} bytes</p>
            <p><strong>NFL Games Found:</strong> {data.nflGamesFound}</p>
            {data.parseError && <p style={{ color: '#ef4444' }}><strong>Parse Error:</strong> {data.parseError}</p>}
            {data.error && <p style={{ color: '#ef4444' }}><strong>API Error:</strong> {data.error}</p>}
          </div>

          {data.oddsInfo && data.oddsInfo.length > 0 && (
            <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <h2 style={{ marginBottom: '10px', color: '#22c55e' }}>Parsed Odds Info ({data.oddsInfo.length} games)</h2>
              {data.oddsInfo.map((game, idx) => (
                <div key={idx} style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px' }}>
                  <h3 style={{ color: '#f59e0b' }}>{game.matchup}</h3>
                  <p><strong>Status:</strong> {game.status}</p>
                  {game.score && <p><strong>Score:</strong> {game.score}</p>}
                  {game.time && <p><strong>Time:</strong> {game.time}</p>}
                  {game.date && <p><strong>Date:</strong> {game.date}</p>}
                  {game.bookmakers && <p><strong>Bookmakers:</strong> {game.bookmakers.join(', ')}</p>}
                  
                  {game.bet365 && (
                    <div style={{ marginTop: '10px' }}>
                      <h4 style={{ color: '#3b82f6' }}>bet365 Odds:</h4>
                      <pre style={{ backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
                        {JSON.stringify(game.bet365, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {game.bwin && (
                    <div style={{ marginTop: '10px' }}>
                      <h4 style={{ color: '#a855f7' }}>bwin Odds:</h4>
                      <pre style={{ backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
                        {JSON.stringify(game.bwin, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {game.rawOdds && (
                    <div style={{ marginTop: '10px' }}>
                      <h4 style={{ color: '#ec4899' }}>Raw Odds Object:</h4>
                      <pre style={{ backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px', maxHeight: '300px' }}>
                        {JSON.stringify(game.rawOdds, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {game.allBookmakers && (
                    <details style={{ marginTop: '10px' }}>
                      <summary style={{ cursor: 'pointer', color: '#6b7280' }}>All Bookmakers (click to expand)</summary>
                      <pre style={{ backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '11px', maxHeight: '400px' }}>
                        {JSON.stringify(game.allBookmakers, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px' }}>
            <h2 style={{ marginBottom: '10px', color: '#ef4444' }}>Full Raw Response</h2>
            <pre style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '8px', overflow: 'auto', maxHeight: '600px', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {data.rawText || JSON.stringify(data.rawData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
