import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';

export default function Footer() {
  const { isDarkMode } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t"
      style={{ 
        backgroundColor: isDarkMode ? '#000000' : '#f5f5f5',
        borderColor: isDarkMode ? '#1f2937' : '#e5e7eb'
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/rules" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            House Rules
          </Link>
          <span style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }}>·</span>
          <Link href="/responsible-pikking" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Responsible Pikking
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
          <Link href="/privacy" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Privacy Policy
          </Link>
          <span style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }}>·</span>
          <Link href="/terms" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Terms of Use
          </Link>
          <span style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }}>·</span>
          <Link href="/data-privacy" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Data Privacy Request
          </Link>
        </div>

        <div className="mb-6">
          <Link href="/pikking-101" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Pikking 101
          </Link>
        </div>

        <p className="text-sm mb-6" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          © Piks, {currentYear}
        </p>

        <p className="text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          For customer support, please contact us at{' '}
          <a href="mailto:help@thepiks.com" className="underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            help@thepiks.com
          </a>
        </p>
      </div>
    </footer>
  );
}
