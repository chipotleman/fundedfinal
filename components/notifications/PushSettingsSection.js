import { useState } from 'react';
import { usePushNotifications } from '../../contexts/PushNotificationsContext';

const CATS = [
  { key: 'catInvites', label: 'Battle invites', help: 'When a friend challenges you to a battle' },
  { key: 'catForfeits', label: 'Opponent forfeits', help: 'When your opponent forfeits a battle you\'re in' },
  { key: 'catResults', label: 'Battle results', help: 'When a battle finishes (win, loss, or tie)' },
  { key: 'catFriendsLive', label: 'Friends going live', help: 'When a friend starts a new battle' },
  { key: 'catRematch', label: 'Rematch requests', help: 'When your opponent wants a rematch after a finished battle' },
];

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        value ? 'bg-blue-500' : 'bg-[#222]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function PushSettingsSection() {
  const push = usePushNotifications();
  const [error, setError] = useState(null);

  if (!push.supported) {
    return (
      <div className="bg-[#111] backdrop-blur-lg rounded-2xl border border-[#1a1a1a] p-8 mb-8">
        <h2 className="text-xl font-bold text-white mb-2">Push Notifications</h2>
        <p className="text-gray-400 text-sm">
          This browser doesn't support web push notifications. Try Chrome, Edge, or Firefox on
          desktop, or install Piks to your iPhone/iPad Home Screen on iOS 16.4+.
        </p>
      </div>
    );
  }

  const isIOSWithoutPwa = push.iosInfo.ios && !push.iosInfo.standalone;
  const blocked = push.permission === 'denied';

  const handleEnable = async () => {
    setError(null);
    const r = await push.subscribe();
    if (!r.ok) {
      if (r.reason === 'denied') setError('Notifications are blocked in your browser. Enable them in your browser settings to continue.');
      else if (r.reason === 'unsupported') setError('Push notifications are not supported in this browser.');
      else setError('Could not enable push notifications. Please try again.');
    }
  };

  return (
    <div className="bg-[#111] backdrop-blur-lg rounded-2xl border border-[#1a1a1a] p-8 mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Push Notifications</h2>
        {push.subscribed ? (
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wide">On</span>
        ) : (
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Off</span>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Get notified when something happens in Piks even when the app is closed.
      </p>

      {isIOSWithoutPwa && (
        <div className="mb-6 text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
          <strong className="block text-yellow-200 mb-1">iPhone/iPad users:</strong>
          To enable push notifications, tap the Share button in Safari and choose
          "Add to Home Screen", then open Piks from the new icon. iOS only allows
          notifications from installed PWAs (iOS 16.4+).
        </div>
      )}

      {blocked && (
        <div className="mb-6 text-xs text-red-300 bg-red-900/20 border border-red-900/40 rounded-lg p-3">
          You've blocked notifications for this site. Enable them again in your browser's
          site settings, then return here to subscribe.
        </div>
      )}

      {!push.subscribed ? (
        <button
          onClick={handleEnable}
          disabled={push.busy || isIOSWithoutPwa || blocked}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50"
        >
          {push.busy ? 'Enabling…' : 'Enable on this device'}
        </button>
      ) : (
        <button
          onClick={push.unsubscribe}
          disabled={push.busy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-white disabled:opacity-50"
        >
          {push.busy ? 'Disabling…' : 'Disable on this device'}
        </button>
      )}

      {error && <div className="mt-3 text-xs text-red-300">{error}</div>}

      {/* Categories */}
      <div className="mt-8 border-t border-[#1a1a1a] pt-6">
        <h3 className="text-white font-semibold mb-4">Notify me about</h3>
        <div className="space-y-4">
          {CATS.map(({ key, label, help }) => {
            // Show union of all device prefs — toggling updates all subscribed devices.
            const enabled = push.devices.length === 0
              ? true
              : push.devices.some(d => d[key]);
            return (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-white font-medium">{label}</div>
                  <div className="text-gray-400 text-sm">{help}</div>
                </div>
                <Toggle
                  value={enabled}
                  disabled={push.devices.length === 0}
                  onChange={(v) => push.updatePreferences({ [key]: v })}
                />
              </div>
            );
          })}
        </div>
        {push.devices.length === 0 && (
          <p className="text-xs text-gray-500 mt-3">
            Enable notifications above to manage which alerts you receive.
          </p>
        )}
      </div>

      {/* Devices */}
      {push.devices.length > 0 && (
        <div className="mt-8 border-t border-[#1a1a1a] pt-6">
          <h3 className="text-white font-semibold mb-4">Your devices</h3>
          <div className="space-y-2">
            {push.devices.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {d.deviceLabel || 'Browser'}
                    {d.endpoint === push.endpoint && (
                      <span className="ml-2 text-xs text-blue-400">This device</span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs">
                    Added {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <button
                  onClick={() => push.removeDevice(d.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md hover:bg-red-900/20"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
