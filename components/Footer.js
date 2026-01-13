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
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
          <Link href="/rules" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            House Rules
          </Link>
          <span style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }}>·</span>
          <Link href="/responsible-gaming" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Responsible Gaming
          </Link>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
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
          <Link href="/betting-101" className="text-sm underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            Sports Betting 101
          </Link>
        </div>

        <p className="text-sm mb-6" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          © Piks, {currentYear}
        </p>

        <p className="text-sm mb-6" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          Persons under 21 are not permitted to engage in sports wagering.
        </p>

        <p className="text-sm mb-6" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          If you or someone you know has a gambling problem, help is available. Call{' '}
          <a href="tel:1-800-522-4700" className="underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            1-800-522-4700
          </a>{' '}
          (National Council on Problem Gambling).
        </p>

        <p className="text-sm" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
          For customer support, please contact us at{' '}
          <a href="mailto:support@piksbets.com" className="underline" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            support@piksbets.com
          </a>
        </p>
      </div>
    </footer>
  );
}
