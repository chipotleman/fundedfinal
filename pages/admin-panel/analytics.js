import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalEvents: 0,
    totalSessions: 0,
    totalPageViews: 0,
    demoBets: 0,
    unplacedBets: 0,
    recentEvents: [],
    topPages: [],
    eventsByType: [],
  });
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin-panel/analytics?range=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color = 'green' }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs px-2 py-1 rounded-full bg-${color}-600/20 text-${color}-400`}>
          {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'Today'}
        </span>
      </div>
      <h3 className="text-gray-400 text-sm mb-1">{title}</h3>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );

  return (
    <AdminLayout title="Analytics">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400 mt-1">Track user behavior and platform metrics</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
        >
          <option value="1d">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard title="Total Events" value={analytics.totalEvents} icon="📊" color="blue" />
            <StatCard title="Sessions" value={analytics.totalSessions} icon="👥" color="green" />
            <StatCard title="Page Views" value={analytics.totalPageViews} icon="👁️" color="purple" />
            <StatCard title="Demo Bets" value={analytics.demoBets} icon="🎮" color="yellow" />
            <StatCard title="Unplaced Bets" value={analytics.unplacedBets} icon="🗑️" color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Events by Type</h2>
              {analytics.eventsByType.length === 0 ? (
                <p className="text-gray-400">No events recorded yet. Events will appear here once tracking is implemented.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.eventsByType.map((event, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                      <span className="text-white">{event.type}</span>
                      <span className="text-green-400 font-bold">{event.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Top Pages</h2>
              {analytics.topPages.length === 0 ? (
                <p className="text-gray-400">No page views recorded yet. Views will appear here once tracking is implemented.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topPages.map((page, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                      <span className="text-white truncate max-w-[200px]">{page.url}</span>
                      <span className="text-blue-400 font-bold">{page.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Events</h2>
            {analytics.recentEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">No events recorded yet</p>
                <p className="text-sm text-gray-500">
                  User interactions like page views, clicks, and bet selections will be tracked here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Event Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">User/Visitor</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {analytics.recentEvents.map((event, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {new Date(event.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                            {event.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-sm font-mono">
                          {event.userId || event.visitorId?.substring(0, 8) || 'Anonymous'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-[200px]">
                          {event.pageUrl || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
