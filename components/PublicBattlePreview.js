import Head from 'next/head';

function Avatar({ src, name, ringColor, glow }) {
  const initial = (name || '?')[0]?.toUpperCase() || '?';
  return (
    <div
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        border: `3px solid ${ringColor}`,
        boxShadow: glow,
        background: '#111',
      }}
    >
      {src ? (
        <img src={src} alt={name || ''} className="w-full h-full object-cover" />
      ) : (
        <span className="text-2xl sm:text-3xl font-black text-white/70">{initial}</span>
      )}
    </div>
  );
}

export default function PublicBattlePreview({ preview, onJoinClick, onLoginClick }) {
  if (!preview) return null;
  const { user1, user2, prize, mode, statusLabel, status } = preview;

  let statusColor = '#facc15';
  if (status === 'completed') statusColor = '#9ca3af';
  else if (status === 'waiting') statusColor = '#60a5fa';
  else if (status === 'cancelled') statusColor = '#f87171';

  return (
    <>
      <Head>
        <meta name="theme-color" content="#000000" />
      </Head>
      <div className="min-h-screen relative overflow-hidden bg-black flex flex-col">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
          }}
        />

        <nav className="sticky top-0 left-0 right-0 bg-black z-50">
          <div className="px-3 sm:px-6 py-1 sm:py-3 flex items-center justify-center">
            <img
              src="/pikslogotransparent.png"
              alt="Piks"
              className="h-[140px] sm:h-[180px] w-auto"
              style={{
                filter: 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
                animation: 'logoRedYellowGlow 4s infinite ease-in-out',
              }}
            />
          </div>
        </nav>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            <div
              className="rounded-2xl overflow-hidden p-5 sm:p-6"
              style={{
                background: 'linear-gradient(160deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)',
                border: '2px solid rgba(250,204,21,0.45)',
                boxShadow: '0 0 40px rgba(250,204,21,0.15)',
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: 'rgba(250,204,21,0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(250,204,21,0.4)',
                  }}
                >
                  {mode}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: statusColor,
                    border: `1px solid ${statusColor}66`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="flex items-center w-full">
                <div className="flex flex-col items-center" style={{ width: '38%' }}>
                  <Avatar
                    src={user1?.avatar}
                    name={user1?.username}
                    ringColor="#facc15"
                    glow="0 0 20px rgba(250,204,21,0.4)"
                  />
                  <p className="text-white text-sm font-bold truncate max-w-[120px] text-center mt-2">
                    {user1?.username || 'Player 1'}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center" style={{ width: '24%' }}>
                  <div
                    className="text-3xl sm:text-4xl font-black italic text-transparent bg-clip-text"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #facc15 0%, #ef4444 100%)',
                      WebkitBackgroundClip: 'text',
                    }}
                  >
                    VS
                  </div>
                </div>

                <div className="flex flex-col items-center" style={{ width: '38%' }}>
                  <Avatar
                    src={user2?.avatar}
                    name={user2?.username}
                    ringColor="#ef4444"
                    glow="0 0 20px rgba(239,68,68,0.3)"
                  />
                  <p className="text-white text-sm font-bold truncate max-w-[120px] text-center mt-2">
                    {user2?.username || 'Opponent'}
                  </p>
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">
                  Prize Pool
                </p>
                <p
                  className="text-2xl sm:text-3xl font-black mt-1"
                  style={{
                    color: '#facc15',
                    textShadow: '0 0 12px rgba(250,204,21,0.4)',
                  }}
                >
                  {prize}
                </p>
              </div>

              <button
                type="button"
                onClick={onJoinClick}
                className="mt-6 w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest text-black transition-transform active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
                  boxShadow: '0 8px 24px rgba(250,204,21,0.35)',
                }}
              >
                Sign up to join the action
              </button>

              <p className="mt-3 text-center text-[11px] text-gray-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onLoginClick || onJoinClick}
                  className="text-yellow-400 font-bold underline"
                >
                  Log in
                </button>
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] text-gray-500">
              You're viewing a public preview of this Piks battle.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
