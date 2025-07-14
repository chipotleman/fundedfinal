import Link from 'next/link';
import { useRouter } from 'next/router';

export default function TopNavbar() {
  const router = useRouter();

  const linkClass = (path) =>
    router.pathname === path
      ? 'text-[#4fe870] font-bold'
      : 'text-white hover:text-[#4fe870]';

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-2xl text-white font-bold">
        🥊 Rollr
      </Link>
      <div className="space-x-6 text-sm">
        <Link href="/home" className={linkClass('/home')}>Home</Link>
        <Link href="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
        <Link href="/rules" className={linkClass('/rules')}>Rules</Link>
      </div>
    </nav>
  );
}
