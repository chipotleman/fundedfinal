import { useState, useEffect } from 'react';

export default function LeagueNameTest() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamStatus, setStreamStatus] = useState('connecting...');

  useEffect(() => {
    const eventSource = new EventSource('/api/goalserve/stream');
    
    eventSource.onopen = () => {
      setStreamStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          setStreamStatus(`connected - ${data.status?.eventCount || 0} events cached`);
        }
        
        if (data.type === 'initial' && data.events) {
          setEvents(data.events);
          setLoading(false);
        }
        
        if (data.type === 'update' && data.event) {
          setEvents(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(e => e.id === data.event.id);
            if (idx >= 0) {
              updated[idx] = data.event;
            } else {
              updated.push(data.event);
            }
            return updated;
          });
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    eventSource.onerror = (e) => {
      setStreamStatus('error - check console');
      setError('Stream connection failed');
      setLoading(false);
    };

    return () => eventSource.close();
  }, []);

  const groupedBySport = events.reduce((acc, event) => {
    const sport = event.sport || 'unknown';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(event);
    return acc;
  }, {});

  const uniqueLeagues = [...new Set(events.map(e => e.league).filter(Boolean))].sort();

  return (
    <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ marginBottom: '20px' }}>League Name Test</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#111', borderRadius: '8px' }}>
        <strong>Stream Status:</strong> {streamStatus}
      </div>

      {loading && <p>Loading inplay events...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '10px' }}>Unique League Names ({uniqueLeagues.length})</h2>
        {uniqueLeagues.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {uniqueLeagues.map((league, i) => (
              <li key={i} style={{ padding: '5px 0', borderBottom: '1px solid #333' }}>
                <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>{league}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#888' }}>No league names found in events</p>
        )}
      </div>

      {Object.entries(groupedBySport).map(([sport, sportEvents]) => (
        <div key={sport} style={{ marginBottom: '30px' }}>
          <h2 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>
            {sport.toUpperCase()} ({sportEvents.length} events)
          </h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #444' }}>ID</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #444' }}>League (raw)</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #444' }}>Home Team</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #444' }}>Away Team</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #444' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {sportEvents.map(event => (
                <tr key={event.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '8px' }}>{event.id}</td>
                  <td style={{ padding: '8px' }}>
                    <code style={{ backgroundColor: event.league ? '#1a4a1a' : '#4a1a1a', padding: '2px 6px', borderRadius: '4px' }}>
                      {event.league || '(none)'}
                    </code>
                  </td>
                  <td style={{ padding: '8px' }}>{event.homeTeam}</td>
                  <td style={{ padding: '8px' }}>{event.awayTeam}</td>
                  <td style={{ padding: '8px' }}>{event.homeScore} - {event.awayScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3>Raw Event Data (first 3)</h3>
        <pre style={{ overflow: 'auto', fontSize: '12px', backgroundColor: '#111', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(events.slice(0, 3), null, 2)}
        </pre>
      </div>
    </div>
  );
}
