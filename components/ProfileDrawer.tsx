import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function ProfileDrawer() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth';
  };

  const userEmail = session?.user?.email || '';

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50"
      ref={drawerRef}
    >
      {/* Profile Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-green-400 text-black rounded-full w-10 h-10 flex items-center justify-center font-bold hover:bg-green-500 transition z-50"
      >
        {userEmail ? userEmail[0].toUpperCase() : 'U'}
      </button>

      {/* Drawer expanding upward above icon */}
      {open && (
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-green-400 rounded-lg shadow-lg p-4 w-48"
        >
          <p className="text-green-300 text-sm mb-2 break-words text-center">{userEmail}</p>
          <button
            onClick={handleSignOut}
            className="w-full bg-green-400 text-black font-semibold py-1 rounded hover:bg-green-500 transition"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
