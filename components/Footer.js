import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const bg = isLight ? '#ffffff' : '#000000';
  const border = isLight ? '#e2e8f0' : '#1f2937';
  const link = isLight ? '#475569' : '#9ca3af';
  const sep = isLight ? '#94a3b8' : '#4b5563';

  return (
    <footer 
      className="px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t"
      style={{ 
        backgroundColor: bg,
        borderColor: border
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/rules" className="text-sm underline" style={{ color: link }}>
            House Rules
          </Link>
          <span style={{ color: sep }}>·</span>
          <Link href="/responsible-pikking" className="text-sm underline" style={{ color: link }}>
            Responsible Pikking
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/privacy" className="text-sm underline" style={{ color: link }}>
            Privacy Policy
          </Link>
          <span style={{ color: sep }}>·</span>
          <Link href="/terms" className="text-sm underline" style={{ color: link }}>
            Terms of Use
          </Link>
          <span style={{ color: sep }}>·</span>
          <Link href="/data-privacy" className="text-sm underline" style={{ color: link }}>
            Data Privacy Request
          </Link>
        </div>

        <div className="mb-6">
          <Link href="/pikking-101" className="text-sm underline" style={{ color: link }}>
            Pikking 101
          </Link>
        </div>

        <p className="text-sm mb-6" style={{ color: link }}>
          © Piks, {currentYear}
        </p>

        <p className="text-sm" style={{ color: link }}>
          For customer support, please contact us at{' '}
          <a href="mailto:help@thepiks.com" className="underline" style={{ color: link }}>
            help@thepiks.com
          </a>
        </p>
      </div>
    </footer>
  );
}
