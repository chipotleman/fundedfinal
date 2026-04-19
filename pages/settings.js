import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import PushSettingsSection from '../components/notifications/PushSettingsSection';
import VoiceChatTest from '../components/settings/VoiceChatTest';
import { BANNER_LIBRARY } from '../lib/teamCatalog';

const NOTIF_LABELS = {
  betResults: ['Bet Results', 'Get notified when your bets are settled'],
  challengeUpdates: ['Challenge Updates', 'Updates on your challenge progress'],
  promotions: ['Promotions & Offers', 'Special offers and promotions'],
  weeklyReports: ['Weekly Reports', 'Weekly performance summaries'],
};

const PRIVACY_LABELS = {
  profileVisible: ['Profile Visible', 'Allow other users to view your profile'],
  showStats: ['Show Statistics', 'Display your betting statistics publicly'],
  showInLeaderboard: ['Show in Leaderboard', 'Appear in public leaderboards'],
};

const DEFAULTS = {
  email: '',
  username: '',
  bio: '',
  avatar: '',
  bannerUrl: '',
  instagramHandle: '',
  facebookUrl: '',
  oddsFormat: 'american',
  notifications: {
    betResults: true,
    challengeUpdates: true,
    promotions: false,
    weeklyReports: true,
  },
  privacy: {
    profileVisible: true,
    showStats: true,
    showInLeaderboard: true,
  },
};

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? 'bg-green-500' : 'bg-[#222]'
      }`}
      aria-pressed={value}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border ${
        isError
          ? 'bg-red-500/15 border-red-500/40 text-red-300'
          : 'bg-green-500/15 border-green-500/40 text-green-300'
      }`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { setOddsFormat, refresh: refreshPrefs } = useUserPreferences();

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/auth?redirect=/settings');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.settings) {
            setForm({ ...DEFAULTS, ...data.settings });
          }
        } else {
          showToast('Could not load your settings', 'error');
        }
      } catch (err) {
        showToast('Could not load your settings', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, router]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateNested = (group, key, value) =>
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));

  async function saveSection(section, payload) {
    setSavingSection(section);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || 'Failed to save', 'error');
        return false;
      }
      if (data?.settings) setForm({ ...DEFAULTS, ...data.settings });
      if (payload.oddsFormat) setOddsFormat(payload.oddsFormat);
      refreshPrefs();
      showToast('Saved');
      return true;
    } catch (err) {
      showToast('Failed to save', 'error');
      return false;
    } finally {
      setSavingSection(null);
    }
  }

  async function handleFile(file, kind) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }
    const maxBytes = kind === 'banner' ? 4 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`Max size is ${maxBytes / 1024 / 1024}MB`, 'error');
      return;
    }
    if (kind === 'banner') setUploadingBanner(true); else setUploadingAvatar(true);
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error('upload-url-failed');
      const { uploadURL, objectPath } = await urlRes.json();
      const up = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!up.ok) throw new Error('upload-failed');
      if (kind === 'banner') update('bannerUrl', objectPath);
      else update('avatar', objectPath);
    } catch (err) {
      showToast('Upload failed. Try a different image or paste a URL.', 'error');
    } finally {
      if (kind === 'banner') setUploadingBanner(false); else setUploadingAvatar(false);
    }
  }

  async function sendPasswordReset() {
    setResetting(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data?.message || 'Password reset email sent.');
      } else {
        showToast(data?.error || 'Could not send reset email', 'error');
      }
    } catch (err) {
      showToast('Could not send reset email', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function deleteAccount() {
    const confirmed = typeof window !== 'undefined' &&
      window.confirm('Permanently delete your account? This cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/user/delete-account', { method: 'POST' });
      if (res.ok) {
        showToast('Account deletion requested. You will be signed out.');
        setTimeout(() => router.push('/api/auth/signout'), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || 'Account deletion is not available yet. Contact support.', 'error');
      }
    } catch (err) {
      showToast('Account deletion is not available yet. Contact support.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sectionClass = 'bg-[#111] backdrop-blur-lg rounded-2xl border border-[#1a1a1a] p-6 sm:p-8 mb-8';
  const inputClass = 'w-full bg-[#1a1a1a] text-white px-3 py-2 rounded-lg border border-[#222] focus:border-green-400 focus:outline-none';

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <TopNavbar
        bankroll={15450}
        pnl={2450}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

          {/* Profile */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-6">Profile</h2>

            <div className="space-y-5">
              <div className="text-xs text-gray-500">
                Want to change your banner or avatar with the full editor? Visit{' '}
                <a href={`/profile/${session?.user?.id || ''}`} className="text-green-400 hover:text-green-300 underline">My Profile</a>.
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a1a1a] border border-[#222] flex items-center justify-center">
                    {form.avatar ? (
                      <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">👤</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFile(e.target.files?.[0], 'avatar')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-[#222] text-gray-200"
                    >
                      {uploadingAvatar ? 'Uploading…' : 'Upload image'}
                    </button>
                    <input
                      type="url"
                      value={form.avatar}
                      onChange={(e) => update('avatar', e.target.value)}
                      placeholder="…or paste an image URL"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Username</label>
                <input
                  type="text"
                  value={form.username}
                  maxLength={100}
                  onChange={(e) => update('username', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Bio</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  maxLength={500}
                  onChange={(e) => update('bio', e.target.value)}
                  placeholder="Tell others about yourself…"
                  className={inputClass}
                />
                <div className="text-[10px] text-gray-500 mt-1 text-right">{(form.bio || '').length}/500</div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    saveSection('profile', {
                      username: form.username,
                      bio: form.bio,
                      avatar: form.avatar,
                      bannerUrl: form.bannerUrl,
                    })
                  }
                  disabled={savingSection === 'profile'}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg"
                >
                  {savingSection === 'profile' ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </div>
          </section>

          {/* Account */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-6">Account</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Email</label>
                <input type="email" value={form.email} disabled readOnly className={`${inputClass} opacity-70 cursor-not-allowed`} />
                <p className="text-xs text-gray-500 mt-1">Contact support to change the email on your account.</p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={sendPasswordReset}
                  disabled={resetting}
                  className="w-full sm:w-auto bg-[#1a1a1a] hover:bg-[#222] text-white font-medium py-2.5 px-4 rounded-lg border border-[#222]"
                >
                  {resetting ? 'Sending…' : 'Send password reset email'}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  We'll email you a secure link so you can pick a new password.
                </p>
              </div>

              <div className="mt-6 border border-red-500/30 bg-red-500/5 rounded-xl p-4">
                <h3 className="text-red-400 font-semibold mb-1">Danger zone</h3>
                <p className="text-sm text-gray-400 mb-3">Deleting your account is permanent and cannot be undone.</p>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg"
                >
                  {deleting ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-6">Preferences</h2>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Odds format</label>
              <div className="inline-flex rounded-lg border border-[#222] overflow-hidden">
                {[
                  { id: 'american', label: 'American (-110 / +120)' },
                  { id: 'decimal', label: 'Decimal (1.91 / 2.20)' },
                ].map((opt) => {
                  const active = form.oddsFormat === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update('oddsFormat', opt.id)}
                      className={`px-4 py-2 text-sm font-medium ${
                        active ? 'bg-green-500 text-black' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#222]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Used when odds are displayed across the app.
              </p>

              <div className="flex justify-end mt-5">
                <button
                  type="button"
                  onClick={() => saveSection('preferences', { oddsFormat: form.oddsFormat })}
                  disabled={savingSection === 'preferences'}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg"
                >
                  {savingSection === 'preferences' ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
            </div>
          </section>

          {/* Social */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-1">Social</h2>
            <p className="text-sm text-gray-500 mb-6">Shown on your public profile so other players can find you.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Instagram handle</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-[#1a1a1a] border border-r-0 border-[#222] text-gray-400 rounded-l-lg">@</span>
                  <input
                    type="text"
                    value={form.instagramHandle}
                    onChange={(e) => update('instagramHandle', e.target.value.replace(/^@+/, ''))}
                    placeholder="yourhandle"
                    className={`${inputClass} rounded-l-none`}
                    maxLength={50}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Facebook profile URL</label>
                <input
                  type="url"
                  value={form.facebookUrl}
                  onChange={(e) => update('facebookUrl', e.target.value)}
                  placeholder="https://facebook.com/yourname"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    saveSection('social', {
                      instagramHandle: form.instagramHandle,
                      facebookUrl: form.facebookUrl,
                    })
                  }
                  disabled={savingSection === 'social'}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg"
                >
                  {savingSection === 'social' ? 'Saving…' : 'Save socials'}
                </button>
              </div>
            </div>
          </section>

          {/* Push notifications (existing) */}
          <PushSettingsSection />

          {/* Voice chat self-test (existing) */}
          <VoiceChatTest />

          {/* Notifications */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-6">Notifications</h2>
            <div className="space-y-4">
              {Object.entries(NOTIF_LABELS).map(([key, [label, desc]]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-[#1a1a1a] last:border-0">
                  <div className="pr-4">
                    <div className="text-white font-medium">{label}</div>
                    <div className="text-gray-400 text-sm">{desc}</div>
                  </div>
                  <Toggle
                    value={!!form.notifications[key]}
                    onChange={(v) => updateNested('notifications', key, v)}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => saveSection('notifications', { notifications: form.notifications })}
                  disabled={savingSection === 'notifications'}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg"
                >
                  {savingSection === 'notifications' ? 'Saving…' : 'Save notifications'}
                </button>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-white mb-6">Privacy</h2>
            <div className="space-y-4">
              {Object.entries(PRIVACY_LABELS).map(([key, [label, desc]]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-[#1a1a1a] last:border-0">
                  <div className="pr-4">
                    <div className="text-white font-medium">{label}</div>
                    <div className="text-gray-400 text-sm">{desc}</div>
                  </div>
                  <Toggle
                    value={!!form.privacy[key]}
                    onChange={(v) => updateNested('privacy', key, v)}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => saveSection('privacy', { privacy: form.privacy })}
                  disabled={savingSection === 'privacy'}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-5 py-2 rounded-lg"
                >
                  {savingSection === 'privacy' ? 'Saving…' : 'Save privacy'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
