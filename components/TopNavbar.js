import Link from 'next/link';
import Image from 'next/image';

export default function TopNavbar() {
  return (
    <div className="fixed top-0 w-full z-50 bg-black h-24 flex items-center justify-between px-6 sm:px-10 shadow-md">
      <Image
        src="/rollr-logo.png"
        alt="Rollr Logo"
        width={170}
        height={50}
        priority
      />
      <nav className="flex space-x-6 text-green-300 font-semibold text-sm sm:text-base">
        <Link href="/home" className="hover:text-green-400 transition">Home</Link>
        <Link href="/dashboard" className="hover:text-green-400 transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-green-400 transition">Rules</Link>
      </nav>
    </div>
  );
}
