import { useState } from 'react';
import { usePushNotifications } from '../../contexts/PushNotificationsContext';

export default function PushOptInPrompt() {
  const push = usePushNotifications();
  const [error, setError] = useState(null);

  if (!push.showSoftPrompt) return null;
  if (!push.supported) return null;

  const isIOSWithoutPwa = push.iosInfo.ios && !push.iosInfo.standalone;

  const handleEnable = async () => {
    setError(null);
    if (isIOSWithoutPwa) return; // Show install instructions instead.
    const r = await push.subscribe();
    if (r.ok) {
      push.dismissSoftPrompt(false);
    } else if (r.reason === 'denied') {
      setError("Notifications are blocked. Enable them in your browser settings.");
      push.dismissSoftPrompt(true);
    } else {
      setError("Couldn't enable push notifications. Try again from Settings.");
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] p-4 sm:p-6 flex justify-center pointer-events-none"
    >
      <div className="pointer-events-auto bg-[#111] border border-[#1f1f1f] rounded-2xl shadow-2xl max-w-md w-full p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-base">Get notified the moment it counts</h3>
            <p className="text-gray-400 text-sm mt-1">
              Turn on push notifications for battle invites, opponent forfeits, results,
              and when your friends start a new battle. You can change this anytime in Settings.
            </p>

            {isIOSWithoutPwa && (
              <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
                On iPhone/iPad, you must first add Piks to your Home Screen
                (Share icon → "Add to Home Screen") and open it from there
                to enable push notifications.
              </div>
            )}

            {error && (
              <div className="mt-3 text-xs text-red-300">{error}</div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => push.dismissSoftPrompt(true)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white"
              >
                Not now
              </button>
              <button
                onClick={handleEnable}
                disabled={push.busy || isIOSWithoutPwa}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-500 hover:bg-green-400 text-black disabled:opacity-50"
              >
                {isIOSWithoutPwa ? 'Add to Home Screen first' : push.busy ? 'Enabling…' : 'Enable notifications'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
