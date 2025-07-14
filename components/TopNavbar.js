import Link from 'next/link';
import Image from 'next/image';

export default function TopNavbar() {
  return (
    <div className="fixed top-0 left-0 w-full bg-black text-green-300 border-b border-zinc-800 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <Image src="/rollr-logo.png" alt="Rollr Logo" width={120} height={40} priority />
        </div>
        <div className="flex space-x-8 text-lg font-mono">
          <Link href="/home" className="hover:text-[#4fe870] transition">Home</Link>
          <Link href="/dashboard" className="hover:text-[#4fe870] transition">Dashboard</Link>
          <Link href="/rules" className="hover:text-[#4fe870] transition">Rules</Link>
        </div>
      </div>
    </div>
  );
}
