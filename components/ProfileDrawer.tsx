import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProfileDrawer() {
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const drawerRef = useRef();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    };
    fetchUser();

    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="relative" ref={drawerRef}>
      {/* Profile Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-green-400 text-black rounded-full w-10 h-10 flex items-center justify-center font-bold hover:bg-green-500 transition"
      >
        {userEmail ? userEmail[0].toUpperCase() : 'U'}
      </button>

      {/* Drawer */}
      {open && (
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 translate-y-full bg-zinc-900 border border-green-400 rounded-lg shadow-lg p-4 w-48 z-50"
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
