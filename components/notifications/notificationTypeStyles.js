// Shared visual mapping for notification types so the Notifications page,
// the dropdown in the top nav, and (by reference) the toast colors all read
// like one system. Colors here mirror the palette used by GlobalToastContainer.

export const NOTIF_TYPES = {
  invite: {
    label: 'Battle Invite',
    accent: '#3b82f6',
    accentSoft: 'rgba(59,130,246,0.14)',
    accentBorder: 'rgba(59,130,246,0.45)',
    icon: 'sword',
  },
  rematch: {
    label: 'Rematch',
    accent: '#10b981',
    accentSoft: 'rgba(16,185,129,0.14)',
    accentBorder: 'rgba(16,185,129,0.45)',
    icon: 'refresh',
  },
  friend_request: {
    label: 'Friend Request',
    accent: '#a855f7',
    accentSoft: 'rgba(168,85,247,0.14)',
    accentBorder: 'rgba(168,85,247,0.45)',
    icon: 'userPlus',
  },
  message: {
    label: 'Message',
    accent: '#10b981',
    accentSoft: 'rgba(16,185,129,0.14)',
    accentBorder: 'rgba(16,185,129,0.45)',
    icon: 'chat',
  },
  achievement: {
    label: 'Achievement',
    accent: '#facc15',
    accentSoft: 'rgba(250,204,21,0.14)',
    accentBorder: 'rgba(250,204,21,0.5)',
    icon: 'trophy',
  },
  invite_ended: {
    label: 'Invite Ended',
    accent: '#94a3b8',
    accentSoft: 'rgba(148,163,184,0.14)',
    accentBorder: 'rgba(148,163,184,0.45)',
    icon: 'clock',
  },
  result_won: {
    label: 'Won',
    accent: '#3b82f6',
    accentSoft: 'rgba(59,130,246,0.14)',
    accentBorder: 'rgba(59,130,246,0.45)',
    icon: 'trophy',
  },
  result_lost: {
    label: 'Lost',
    accent: '#f87171',
    accentSoft: 'rgba(248,113,113,0.14)',
    accentBorder: 'rgba(248,113,113,0.45)',
    icon: 'flag',
  },
  result_push: {
    label: 'Push',
    accent: '#facc15',
    accentSoft: 'rgba(250,204,21,0.14)',
    accentBorder: 'rgba(250,204,21,0.5)',
    icon: 'flag',
  },
};

export function getResultStyle(outcome) {
  if (outcome === 'won') return NOTIF_TYPES.result_won;
  if (outcome === 'lost') return NOTIF_TYPES.result_lost;
  return NOTIF_TYPES.result_push;
}

const ICON_PATHS = {
  // Crossed swords — battle invite
  sword: (
    <>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M9.5 17.5 21 6V3h-3L6.5 14.5" />
      <path d="m11 13-6 6" />
      <path d="m8 16-4 4" />
      <path d="m5 21-2-2" />
    </>
  ),
  // Two arrows in a circle — rematch
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </>
  ),
  // Person with plus — friend request
  userPlus: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </>
  ),
  // Speech bubble — message
  chat: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  // Trophy — achievement / win
  trophy: (
    <>
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M6 22h12" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  // Flag — result lost / push
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
    </>
  ),
  // Clock — invite ended
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

export function NotifIcon({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) {
  const path = ICON_PATHS[name];
  if (!path) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export function TypeChip({ type, size = 'sm' }) {
  const style = NOTIF_TYPES[type];
  if (!style) return null;
  const compact = size === 'xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${
        compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
      style={{
        color: style.accent,
        backgroundColor: style.accentSoft,
        border: `1px solid ${style.accentBorder}`,
      }}
    >
      <NotifIcon name={style.icon} size={compact ? 9 : 10} color={style.accent} strokeWidth={2.5} />
      {style.label}
    </span>
  );
}

export function IconChip({ type, size = 36 }) {
  const style = NOTIF_TYPES[type];
  if (!style) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: style.accentSoft,
        border: `1px solid ${style.accentBorder}`,
        color: style.accent,
      }}
    >
      <NotifIcon name={style.icon} size={Math.round(size * 0.5)} color={style.accent} strokeWidth={2.25} />
    </span>
  );
}
