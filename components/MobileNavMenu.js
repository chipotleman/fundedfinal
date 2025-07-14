// components/MobileNavMenu.js
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function MobileNavMenu({ open, onClose, bankroll, progressPercent }) {
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const fetchAvatar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    fetchAvatar();
  }, []);

  return (
    <div className={`fixed inset-0 z-50 bg-black text-green-300 transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'} sm:hidden`}>
      <div className="flex justify-between items-center p-4">
        <div className="text-lg font-bold">Menu</div>
        <button onClick={onClose} className="text-2xl text-green-400">×</button>
      </div>

      {/* Avatar & Progress */}
      <div className="flex flex-col items-center my-4 space-y-2">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full border-2 border-green-400" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-green-400 flex items-center justify-center text-3xl">👤</div>
        )}
        <div className="text-sm">Balance: ${bankroll}</div>
        <div className="w-4/5 bg-zinc-800 rounded-full h-3 mt-2">
          <div className="bg-green-400 h-3 rounded-full" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="text-xs">{progressPercent.toFixed(1)}% to $2500</div>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-col items-center space-y-4 mt-6 text-lg font-semibold">
        <Link href="/home" onClick={onClose}>Home</Link>
        <Link href="/dashboard" onClick={onClose}>Dashboard</Link>
        <Link href="/rules" onClick={onClose}>Rules</Link>
        <Link href="/how-it-works" onClick={onClose}>How it Works</Link>
      </div>
    </div>
  );
}
