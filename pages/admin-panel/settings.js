import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';
import {
  PROMO_SLOT_TYPES,
  DEFAULT_PROMO_SLOTS,
  normalizePromoSlots,
} from '../../lib/promoSlots';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'Piks',
    betaMode: true,
    maintenanceMode: false,
    demoEnabled: true,
    challengeTiers: {
      starter: { price: 149, funding: 5000, profitSplit: 90 },
      pro: { price: 249, funding: 10000, profitSplit: 90 },
      elite: { price: 399, funding: 25000, profitSplit: 90 },
    },
    challengeRules: {
      minPicks: 20,
      minRiskPercent: 1,
      maxRiskPercent: 5,
      maxDailyLoss: 10,
      maxDrawdown: 15,
      profitTarget: 20,
      cashoutFee: 10,
      inactivityDays: 5,
    },
    promoSlots: DEFAULT_PROMO_SLOTS.map((s) => ({ ...s })),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('admin_token')
        : null;
    fetch('/api/admin-panel/settings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setSettings((prev) => ({
          ...prev,
          ...data,
          promoSlots: normalizePromoSlots(data.promoSlots),
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('admin_token')
          : null;
      const res = await fetch('/api/admin-panel/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updatePromoSlot = (idx, patch) => {
    setSettings((prev) => {
      const next = prev.promoSlots.map((slot, i) =>
        i === idx ? { ...slot, ...patch } : slot,
      );
      return { ...prev, promoSlots: next };
    });
  };

  const movePromoSlot = (idx, direction) => {
    setSettings((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.promoSlots.length) return prev;
      const next = [...prev.promoSlots];
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return { ...prev, promoSlots: next };
    });
  };

  return (
    <AdminLayout title="Settings" requiredPermission="settings">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">System Settings</h1>
        <p className="text-gray-400">Configure platform settings and challenge rules</p>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            General Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Site Name</label>
              <input type="text" value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.betaMode} onChange={(e) => setSettings({ ...settings, betaMode: e.target.checked })} className="w-5 h-5 rounded bg-white/5 border-white/10 text-purple-500 focus:ring-purple-500" />
                <span className="text-gray-300">Beta Mode</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} className="w-5 h-5 rounded bg-white/5 border-white/10 text-purple-500 focus:ring-purple-500" />
                <span className="text-gray-300">Maintenance Mode</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.demoEnabled} onChange={(e) => setSettings({ ...settings, demoEnabled: e.target.checked })} className="w-5 h-5 rounded bg-white/5 border-white/10 text-purple-500 focus:ring-purple-500" />
                <span className="text-gray-300">Demo Enabled</span>
              </label>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            Promo Slots
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Configure the four promo containers that auto-rotate at the top of the dashboard. Disabled or empty slots are skipped.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.promoSlots.map((slot, idx) => (
              <div key={idx} className="p-5 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white">Slot {idx + 1}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => movePromoSlot(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Move slot ${idx + 1} up`}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => movePromoSlot(idx, 1)}
                      disabled={idx === settings.promoSlots.length - 1}
                      aria-label={`Move slot ${idx + 1} down`}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) => updatePromoSlot(idx, { enabled: e.target.checked })}
                      className="w-5 h-5 rounded bg-white/5 border-white/10 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">Enabled</span>
                  </label>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Container</label>
                    <select
                      value={slot.containerType}
                      onChange={(e) => updatePromoSlot(idx, { containerType: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                    >
                      {PROMO_SLOT_TYPES.map((t) => (
                        <option key={t.id} value={t.id} className="bg-gray-900">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            Challenge Tiers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(settings.challengeTiers).map(([tier, config]) => (
              <div key={tier} className="p-5 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-lg font-bold text-white capitalize mb-4">{tier}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
                    <input type="number" value={config.price} onChange={(e) => setSettings({ ...settings, challengeTiers: { ...settings.challengeTiers, [tier]: { ...config, price: parseInt(e.target.value) } } })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Funding ($)</label>
                    <input type="number" value={config.funding} onChange={(e) => setSettings({ ...settings, challengeTiers: { ...settings.challengeTiers, [tier]: { ...config, funding: parseInt(e.target.value) } } })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Profit Split (%)</label>
                    <input type="number" value={config.profitSplit} onChange={(e) => setSettings({ ...settings, challengeTiers: { ...settings.challengeTiers, [tier]: { ...config, profitSplit: parseInt(e.target.value) } } })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            Challenge Rules
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(settings.challengeRules).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                <input type="number" value={value} onChange={(e) => setSettings({ ...settings, challengeRules: { ...settings.challengeRules, [key]: parseInt(e.target.value) } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleSave} disabled={saving || loading} className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center gap-2">
            {saving ? (
              <><span className="animate-spin">⏳</span> Saving...</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Settings</>
            )}
          </button>
          {saved && <span className="text-green-400 flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Settings saved successfully!</span>}
        </div>
      </div>
    </AdminLayout>
  );
}
