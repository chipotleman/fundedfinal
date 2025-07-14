import Link from 'next/link';
import Image from 'next/image';

export default function TopNavBar() {
  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-zinc-800 flex items-center justify-between px-6 py-4 shadow">
      <div className="flex items-center space-x-4">
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={120} height={40} priority />
        <Link href="/home" className="text-white hover:text-green-400 transition font-bold">Home</Link>
        <Link href="/dashboard" className="text-white hover:text-green-400 transition font-bold">Dashboard</Link>
        <Link href="/rules" className="text-white hover:text-green-400 transition font-bold">How It Works</Link>
      </div>
    </nav>
  );
}
