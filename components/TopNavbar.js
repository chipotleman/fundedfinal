import Link from 'next/link';
import Image from 'next/image';

export default function TopNavbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-800 h-16 flex items-center justify-between px-6">
      <Link href="/home" className="flex items-center space-x-2">
        <Image src="/rollr-logo.png" alt="Rollr" width={110} height={30} />
      </Link>
      <div className="flex space-x-6 text-green-300 font-semibold text-sm">
        <Link href="/home" className="hover:text-[#4fe870] transition">Home</Link>
        <Link href="/dashboard" className="hover:text-[#4fe870] transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-[#4fe870] transition">Rules</Link>
      </div>
    </div>
  );
}
