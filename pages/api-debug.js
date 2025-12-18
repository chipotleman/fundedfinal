import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function APIDebug() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        const response = await fetch('/api/debug/mysportsfeeds');
        if (!response.ok) {
          throw new Error('Failed to fetch API status');
        }
        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/debug/mysportsfeeds');
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>MySportsFeeds API Debug</title>
      </Head>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">MySportsFeeds API Access Debug</h1>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Refresh'}
            </button>
          </div>

          {results && (
            <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">API Key:</span>
                  <span className="ml-2 font-mono">{results.apiKeyPrefix}</span>
                </div>
                <div>
                  <span className="text-gray-400">Tested:</span>
                  <span className="ml-2">{new Date(results.testedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Testing API endpoints...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-400">Error: {error}</p>
            </div>
          )}

          {results && !loading && (
            <>
              <div className="mb-4 flex gap-4">
                <div className="bg-green-900/30 border border-green-600 rounded-lg px-4 py-2">
                  <span className="text-green-400 font-bold">
                    {results.results.filter(r => r.accessible).length}
                  </span>
                  <span className="text-gray-400 ml-2">Accessible</span>
                </div>
                <div className="bg-red-900/30 border border-red-600 rounded-lg px-4 py-2">
                  <span className="text-red-400 font-bold">
                    {results.results.filter(r => !r.accessible).length}
                  </span>
                  <span className="text-gray-400 ml-2">Blocked</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="text-left p-3 border-b border-gray-700">Endpoint</th>
                      <th className="text-left p-3 border-b border-gray-700">League</th>
                      <th className="text-center p-3 border-b border-gray-700">Status</th>
                      <th className="text-center p-3 border-b border-gray-700">Access</th>
                      <th className="text-center p-3 border-b border-gray-700">Records</th>
                      <th className="text-left p-3 border-b border-gray-700">Sample Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((result, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}>
                        <td className="p-3 border-b border-gray-800">
                          <div className="font-medium">{result.name}</div>
                          <div className="text-xs text-gray-500 font-mono truncate max-w-xs">{result.endpoint}</div>
                        </td>
                        <td className="p-3 border-b border-gray-800">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-400">
                            {result.league}
                          </span>
                        </td>
                        <td className="p-3 border-b border-gray-800 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            result.status === 200 ? 'bg-green-900/50 text-green-400' :
                            result.status === 401 ? 'bg-yellow-900/50 text-yellow-400' :
                            result.status === 403 ? 'bg-red-900/50 text-red-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {result.status} {result.statusText}
                          </span>
                        </td>
                        <td className="p-3 border-b border-gray-800 text-center">
                          {result.accessible ? (
                            <span className="text-green-400 text-xl">✓</span>
                          ) : (
                            <span className="text-red-400 text-xl">✗</span>
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-800 text-center">
                          {result.recordCount !== null ? (
                            <span className="font-mono">{result.recordCount}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-800">
                          {result.dataPreview ? (
                            <span className="text-gray-300 text-sm">{result.dataPreview}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h3 className="font-bold mb-2">Understanding the Results:</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li><span className="text-green-400">200 OK</span> - You have access to this endpoint</li>
                  <li><span className="text-yellow-400">401 Unauthorized</span> - API key issue or invalid credentials</li>
                  <li><span className="text-red-400">403 Forbidden</span> - Your subscription doesn't include this data</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
