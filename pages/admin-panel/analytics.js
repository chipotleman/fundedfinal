import { useState, useEffect, useMemo, Fragment } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import { PROMO_SLOT_TYPES } from '../../lib/promoSlots';
import { getBadgeForAchievement } from '../../lib/achievementBadges';

const PROMO_TYPE_LABELS = PROMO_SLOT_TYPES.reduce((acc, t) => {
  acc[t.id] = t.label;
  return acc;
}, {});

const RARITY_BADGE_STYLE = {
  Common: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Uncommon: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Rare: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Epic: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const RANGE_DAYS = { '1d': 1, '7d': 7, '30d': 30 };

function buildDayBuckets(daysAgo) {
  const days = [];
  const now = new Date();
  for (let i = daysAgo - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function PromoTrendChart({ days, impressions, clicks }) {
  const width = 480;
  const height = 140;
  const padL = 32;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(1, ...impressions, ...clicks);
  const n = days.length;
  const xFor = (i) => padL + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;
  const pathFor = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const gridLines = [0, 0.5, 1].map((p) => padT + innerH - p * innerH);
  const showEveryX = n > 14 ? Math.ceil(n / 7) : 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Daily impressions and clicks">
      {gridLines.map((y, i) => (
        <line key={i} x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {[0, 0.5, 1].map((p, i) => (
        <text key={i} x={padL - 6} y={padT + innerH - p * innerH + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.5)">
          {Math.round(maxVal * p)}
        </text>
      ))}
      <path d={pathFor(impressions)} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={pathFor(clicks)} fill="none" stroke="#c084fc" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {impressions.map((v, i) => (
        <circle key={`i-${i}`} cx={xFor(i)} cy={yFor(v)} r="2.5" fill="#60a5fa">
          <title>{`${days[i]} · ${v.toLocaleString()} impressions`}</title>
        </circle>
      ))}
      {clicks.map((v, i) => (
        <circle key={`c-${i}`} cx={xFor(i)} cy={yFor(v)} r="2.5" fill="#c084fc">
          <title>{`${days[i]} · ${v.toLocaleString()} clicks`}</title>
        </circle>
      ))}
      {days.map((d, i) => {
        if (i % showEveryX !== 0 && i !== n - 1) return null;
        const label = d.slice(5);
        return (
          <text key={d} x={xFor(i)} y={height - 10} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalEvents: 0, totalSessions: 0, totalPageViews: 0, demoBets: 0, unplacedBets: 0,
    recentEvents: [], topPages: [], eventsByType: [], promoSlotStats: [], promoSlotDailyStats: [],
    badgeShareStats: [],
    badgeShareTotals: { totalShares: 0, nativeShares: 0, filesShares: 0, clipboardShares: 0, profileVisits: 0 },
    itemShareStats: [],
    itemShareTotalsByType: [],
  });
  const [dateRange, setDateRange] = useState('7d');
  const [expandedPromo, setExpandedPromo] = useState(null);

  useEffect(() => { fetchAnalytics(); setExpandedPromo(null); }, [dateRange]);

  const days = useMemo(() => buildDayBuckets(RANGE_DAYS[dateRange] || 7), [dateRange]);

  const promoDailyByKey = useMemo(() => {
    const map = new Map();
    for (const r of analytics.promoSlotDailyStats || []) {
      const key = `${r.slotIndex}|${r.containerType}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key).set(r.day, { impressions: r.impressions, clicks: r.clicks });
    }
    return map;
  }, [analytics.promoSlotDailyStats]);

  const seriesFor = (slotIndex, containerType) => {
    const key = `${slotIndex}|${containerType}`;
    const byDay = promoDailyByKey.get(key);
    const impressions = days.map((d) => (byDay?.get(d)?.impressions) || 0);
    const clicks = days.map((d) => (byDay?.get(d)?.clicks) || 0);
    return { impressions, clicks };
  };

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
            <p className="text-gray-400 text-sm mb-6">Impressions and clicks per dashboard slot and container type. Slot 1 is the leftmost slot. Click any row to see the day-by-day trend.</p>
            {analytics.promoSlotStats.length === 0 ? (
              <div className="text-center py-8"><p className="text-gray-500">No promo activity recorded in this range yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 w-8"></th>
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
                      const rowKey = `${row.slotIndex}|${row.containerType}`;
                      const isOpen = expandedPromo === rowKey;
                      const series = isOpen ? seriesFor(row.slotIndex, row.containerType) : null;
                      return (
                        <Fragment key={rowKey}>
                          <tr
                            className="hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => setExpandedPromo(isOpen ? null : rowKey)}
                            aria-expanded={isOpen}
                          >
                            <td className="px-4 py-3 text-gray-400">
                              <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </td>
                            <td className="px-4 py-3 text-white text-sm font-semibold">Slot {Number(row.slotIndex) + 1}</td>
                            <td className="px-4 py-3 text-gray-300 text-sm">{PROMO_TYPE_LABELS[row.containerType] || row.containerType}</td>
                            <td className="px-4 py-3 text-blue-400 text-sm font-bold text-right">{row.impressions.toLocaleString()}</td>
                            <td className="px-4 py-3 text-purple-400 text-sm font-bold text-right">{row.clicks.toLocaleString()}</td>
                            <td className="px-4 py-3 text-gray-300 text-sm text-right">{ctr.toFixed(1)}%</td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-white/[0.02]">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="flex items-center gap-4 mb-2 text-xs">
                                  <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-blue-400"></span><span className="text-gray-400">Impressions</span></div>
                                  <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-purple-400"></span><span className="text-gray-400">Clicks</span></div>
                                  <span className="text-gray-500 ml-auto">Daily totals · {days.length === 1 ? 'today' : `last ${days.length} days`}</span>
                                </div>
                                <PromoTrendChart days={days} impressions={series.impressions} clicks={series.clicks} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">Badge Share Performance</h2>
              <div className="p-2 rounded-lg bg-cyan-500/20"><svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" /></svg></div>
            </div>
            <p className="text-gray-400 text-sm mb-4">Which achievement badges players share most, broken down by share path (native sheet, files share, or clipboard fallback). Profile visits count opens of <code className="text-cyan-300">/profile/&#123;id&#125;?ref=badge_share</code> referral links.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Total Shares', value: analytics.badgeShareTotals?.totalShares || 0, color: 'text-white' },
                { label: 'Native', value: analytics.badgeShareTotals?.nativeShares || 0, color: 'text-blue-300' },
                { label: 'Files', value: analytics.badgeShareTotals?.filesShares || 0, color: 'text-emerald-300' },
                { label: 'Clipboard', value: analytics.badgeShareTotals?.clipboardShares || 0, color: 'text-orange-300' },
                { label: 'Profile Visits', value: analytics.badgeShareTotals?.profileVisits || 0, color: 'text-cyan-300' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/5 border border-white/5 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
            {(!analytics.badgeShareStats || analytics.badgeShareStats.length === 0) ? (
              <div className="text-center py-8"><p className="text-gray-500">No badge shares recorded in this range yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Badge</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rarity</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Shares</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Native</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Files</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Clipboard</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Profile Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analytics.badgeShareStats.map((row) => {
                      const meta = getBadgeForAchievement(row.achievementId) || {};
                      const rarity = row.rarity || meta.rarity || 'Common';
                      const rarityClass = RARITY_BADGE_STYLE[rarity] || RARITY_BADGE_STYLE.Common;
                      const displayName = meta.name || row.achievementId;
                      return (
                        <tr key={row.achievementId} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white text-sm font-semibold">
                            <div>{displayName}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{row.achievementId}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${rarityClass}`}>{rarity}</span>
                          </td>
                          <td className="px-4 py-3 text-white text-sm font-bold text-right">{row.totalShares.toLocaleString()}</td>
                          <td className="px-4 py-3 text-blue-300 text-sm text-right">{row.nativeShares.toLocaleString()}</td>
                          <td className="px-4 py-3 text-emerald-300 text-sm text-right">{row.filesShares.toLocaleString()}</td>
                          <td className="px-4 py-3 text-orange-300 text-sm text-right">{row.clipboardShares.toLocaleString()}</td>
                          <td className="px-4 py-3 text-cyan-300 text-sm font-bold text-right">{row.profileVisits.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">Item Share Performance</h2>
              <div className="p-2 rounded-lg bg-purple-500/20"><svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></div>
            </div>
            <p className="text-gray-400 text-sm mb-4">Generic share tracking for non-badge surfaces (bet/win shares, profile frame shares, etc.) recorded via <code className="text-purple-300">lib/shareTracking.js</code>. Grouped by <code className="text-purple-300">itemType</code> + <code className="text-purple-300">itemId</code> with the most popular items first.</p>
            {(!analytics.itemShareTotalsByType || analytics.itemShareTotalsByType.length === 0) ? (
              <div className="text-center py-8"><p className="text-gray-500">No item shares recorded in this range yet</p></div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {analytics.itemShareTotalsByType.map((row) => (
                    <div key={row.itemType} className="rounded-xl bg-white/5 border border-white/5 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">{row.itemType}</p>
                      <p className="text-lg font-bold text-white">{(row.totalShares || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        N {row.nativeShares || 0} · F {row.filesShares || 0} · C {row.clipboardShares || 0} · T {row.twitterShares || 0} · D {row.imageDownloadShares || 0} · CT {row.copyTextShares || 0}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Item Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Item ID</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Shares</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Native</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Files</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Clipboard</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Twitter</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Image DL</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Copy Text</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {analytics.itemShareStats.map((row, idx) => (
                        <tr key={`${row.itemType}-${row.itemId || 'null'}-${idx}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white text-sm font-semibold">{row.itemType}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono truncate max-w-[180px]">{row.itemId || <span className="text-gray-600">—</span>}</td>
                          <td className="px-4 py-3 text-white text-sm font-bold text-right">{(row.totalShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-blue-300 text-sm text-right">{(row.nativeShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-emerald-300 text-sm text-right">{(row.filesShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-orange-300 text-sm text-right">{(row.clipboardShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-cyan-300 text-sm text-right">{(row.twitterShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-pink-300 text-sm text-right">{(row.imageDownloadShares || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-yellow-300 text-sm text-right">{(row.copyTextShares || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
