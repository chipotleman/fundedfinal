import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import { PROMO_SLOT_TYPES } from '../../lib/promoSlots';

const PROMO_TYPE_LABELS = PROMO_SLOT_TYPES.reduce((acc, t) => {
  acc[t.id] = t.label;
  return acc;
}, {});

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalEvents: 0, totalSessions: 0, totalPageViews: 0, demoBets: 0, unplacedBets: 0,
    recentEvents: [], topPages: [], eventsByType: [], promoSlotStats: [],
  });
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => { fetchAnalytics(); }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin-panel/analytics?range=${dateRange}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setAnalytics(data); }
    } catch (error) { console.error('Failed to fetch analytics:', error); }
    finally { setLoading(false); }
  };

  const statCards = [
    { title: 'Total Events', value: analytics.totalEvents, icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>), gradient: 'from-blue-500 to-cyan-500', bgGlow: 'bg-blue-500/20' },
    { title: 'Sessions', value: analytics.totalSessions, icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>), gradient: 'from-green-500 to-emerald-500', bgGlow: 'bg-green-500/20' },
    { title: 'Page Views', value: analytics.totalPageViews, icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>), gradient: 'from-purple-500 to-pink-500', bgGlow: 'bg-purple-500/20' },
    { title: 'Demo Bets', value: analytics.demoBets, icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>), gradient: 'from-yellow-500 to-orange-500', bgGlow: 'bg-yellow-500/20' },
    { title: 'Unplaced Bets', value: analytics.unplacedBets, icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>), gradient: 'from-red-500 to-rose-500', bgGlow: 'bg-red-500/20' },
  ];

  return (
    <AdminLayout title="Analytics" requiredPermission="analytics">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="text-gray-400">Track user behavior and platform metrics</p>
        </div>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all">
          <option value="1d">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin"></div></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {statCards.map((stat, index) => (
              <div key={index} className="glass-card p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <div className={`absolute -top-8 -right-8 w-24 h-24 ${stat.bgGlow} rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
                <div className="relative">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-r ${stat.gradient} text-white w-fit mb-3`}>{stat.icon}</div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Events by Type</h2>
                <div className="p-2 rounded-lg bg-blue-500/20"><svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
              </div>
              {analytics.eventsByType.length === 0 ? (
                <div className="text-center py-8"><p className="text-gray-500">No events recorded yet</p></div>
              ) : (
                <div className="space-y-3">
                  {analytics.eventsByType.map((event, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-white font-medium">{event.type}</span>
                      <span className="text-purple-400 font-bold">{event.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Top Pages</h2>
                <div className="p-2 rounded-lg bg-purple-500/20"><svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></div>
              </div>
              {analytics.topPages.length === 0 ? (
                <div className="text-center py-8"><p className="text-gray-500">No page views recorded yet</p></div>
              ) : (
                <div className="space-y-3">
                  {analytics.topPages.map((page, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-white truncate max-w-[200px]">{page.url}</span>
                      <span className="text-blue-400 font-bold">{page.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">Promo Slot Performance</h2>
              <div className="p-2 rounded-lg bg-pink-500/20"><svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
            </div>
            <p className="text-gray-400 text-sm mb-6">Impressions and clicks per dashboard slot and container type. Slot 1 is the leftmost slot.</p>
            {analytics.promoSlotStats.length === 0 ? (
              <div className="text-center py-8"><p className="text-gray-500">No promo activity recorded in this range yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Slot</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Container</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Impressions</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Clicks</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analytics.promoSlotStats.map((row, idx) => {
                      const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white text-sm font-semibold">Slot {Number(row.slotIndex) + 1}</td>
                          <td className="px-4 py-3 text-gray-300 text-sm">{PROMO_TYPE_LABELS[row.containerType] || row.containerType}</td>
                          <td className="px-4 py-3 text-blue-400 text-sm font-bold text-right">{row.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-purple-400 text-sm font-bold text-right">{row.clicks.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-300 text-sm text-right">{ctr.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Recent Events</h2>
              <div className="p-2 rounded-lg bg-green-500/20"><svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            </div>
            {analytics.recentEvents.length === 0 ? (
              <div className="text-center py-12"><svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg><p className="text-gray-500">No events recorded yet</p><p className="text-sm text-gray-600 mt-1">User interactions will appear here once tracking is active</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User/Visitor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analytics.recentEvents.map((event, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-sm">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs">{event.eventType}</span></td>
                        <td className="px-4 py-3 text-white text-sm font-mono">{event.userId || event.visitorId?.substring(0, 8) || 'Anonymous'}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-[200px]">{event.pageUrl || '-'}</td>
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
