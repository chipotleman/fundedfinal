import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function WsDebugPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/goalserve/debug');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const toggleExpand = (id) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <Head>
        <title>WebSocket Debug - Goalserve</title>
      </Head>

      <h1 style={{ color: '#00ff88' }}>Goalserve WebSocket Debug</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={fetchData} 
          style={{ padding: '10px 20px', marginRight: '10px', backgroundColor: '#00ff88', color: '#000', border: 'none', cursor: 'pointer' }}
        >
          Refresh Now
        </button>
        <label style={{ cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={autoRefresh} 
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          Auto-refresh (1s)
        </label>
      </div>

      {loading && !data && <p>Loading...</p>}
      {error && <p style={{ color: '#ff4444' }}>Error: {error}</p>}

      {data && (
        <>
          <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
            <h2 style={{ color: '#00aaff', marginTop: 0 }}>Connection Status</h2>
            <pre style={{ backgroundColor: '#222', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(data.connection, null, 2)}
            </pre>
            <p>Live Events: <strong style={{ color: '#00ff88' }}>{data.counts?.liveEvents || 0}</strong></p>
            <p>Available Events: <strong>{data.counts?.availableEvents || 0}</strong></p>
            <p>Subscribers: <strong>{data.counts?.subscribers || 0}</strong></p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#00aaff' }}>Live Events ({data.liveEvents?.length || 0})</h2>
            
            {data.liveEvents?.length === 0 && (
              <p style={{ color: '#888' }}>No live events from WebSocket</p>
            )}

            {data.liveEvents?.map((event) => (
              <div 
                key={event.id} 
                style={{ 
                  backgroundColor: '#1a1a1a', 
                  padding: '15px', 
                  marginBottom: '10px', 
                  borderRadius: '8px',
                  border: event.parsedOdds ? '1px solid #00ff88' : '1px solid #444'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '16px' }}>{event.awayTeam} @ {event.homeTeam}</strong>
                    <span style={{ marginLeft: '15px', color: '#888' }}>{event.sport} - {event.league}</span>
                  </div>
                  <div style={{ fontSize: '20px', color: '#00ff88' }}>
                    {event.awayScore} - {event.homeScore}
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <strong style={{ color: '#ffaa00' }}>Parsed Odds:</strong>
                  {event.parsedOdds ? (
                    <pre style={{ backgroundColor: '#222', padding: '10px', borderRadius: '4px', marginTop: '5px', overflow: 'auto' }}>
                      {JSON.stringify(event.parsedOdds, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ color: '#ff4444', marginLeft: '10px' }}>No parsed odds</span>
                  )}
                </div>

                <button 
                  onClick={() => toggleExpand(event.id)}
                  style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}
                >
                  {expandedEvents[event.id] ? 'Hide' : 'Show'} Full Event Data
                </button>

                {expandedEvents[event.id] && (
                  <pre style={{ backgroundColor: '#111', padding: '10px', borderRadius: '4px', marginTop: '10px', overflow: 'auto', maxHeight: '400px', fontSize: '11px' }}>
                    {JSON.stringify(event.fullEvent, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </section>

          <section>
            <h2 style={{ color: '#00aaff' }}>Raw API Response</h2>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                alert('Copied to clipboard!');
              }}
              style={{ marginBottom: '10px', padding: '10px 20px', backgroundColor: '#00aaff', color: '#000', border: 'none', cursor: 'pointer' }}
            >
              Copy Full JSON to Clipboard
            </button>
            <pre style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', overflow: 'auto', maxHeight: '500px', fontSize: '11px' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}
