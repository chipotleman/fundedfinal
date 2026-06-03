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
